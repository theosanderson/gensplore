export function parseFasta(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines[0]?.startsWith('>')) throw new Error('Expected a FASTA header starting with >.');
  if (lines.slice(1).some(line => line.startsWith('>'))) throw new Error('Please supply exactly one FASTA record.');
  const sequence = lines.slice(1).join('').replace(/\s/g, '').toUpperCase();
  if (!sequence || /[^ACGTRYSWKMBDHVN]/.test(sequence)) throw new Error('Expected an ungapped DNA sequence (IUPAC bases).');
  return { name: lines[0].slice(1).trim() || 'Alternative', sequence };
}

// Banded global alignment, minimizing base edits first and gap openings second.
// Any path leaving the band already costs more than the allowed edit limit.
export function align(reference, alternative, limit = 128) {
  const n = reference.length, m = alternative.length;
  if (!n || !m) throw new Error('Both sequences must contain bases.');
  if (Math.max(n, m) > 100000) throw new Error('Comparison supports sequences up to 100,000 bases.');
  const tooDifferent = () => new Error(`Sequences exceed the ${limit}-edit comparison limit. Use complete sequences in the same orientation and with the same starting point.`);
  if (Math.abs(n - m) > limit) throw tooDifferent();
  // A valid alignment has at most limit gap openings, so one base edit always
  // outweighs all gap-opening tie breakers. States: diagonal, deletion, insertion.
  const width = 2 * limit + 1, editCost = limit + 1, inf = editCost * editCost;
  const trace = new Uint8Array((n + 1) * width);
  const bestState = (a, b, c) => a <= b && a <= c ? 0 : b <= c ? 1 : 2;
  let previous = new Uint32Array(width * 3).fill(inf);
  previous[limit * 3] = 0;
  for (let j = 1; j <= Math.min(m, limit); j++) {
    previous[(j + limit) * 3 + 2] = j * editCost + 1;
    trace[j + limit] = (j === 1 ? 0 : 2) << 4;
  }
  for (let i = 1; i <= n; i++) {
    const current = new Uint32Array(width * 3).fill(inf);
    for (let j = Math.max(0, i - limit); j <= Math.min(m, i + limit); j++) {
      const k = j - i + limit, slot = k * 3;
      if (j === 0) {
        current[slot + 1] = i * editCost + 1;
        trace[i * width + k] = (i === 1 ? 0 : 1) << 2;
        continue;
      }
      const diagonalState = bestState(previous[slot], previous[slot + 1], previous[slot + 2]);
      current[slot] = Math.min(inf, previous[slot + diagonalState] + (reference[i - 1] === alternative[j - 1] ? 0 : editCost));
      let deletionState = 0, insertionState = 0;
      if (k + 1 < width) {
        const from = slot + 3;
        const a = previous[from] + editCost + 1;
        const b = previous[from + 1] + editCost;
        const c = previous[from + 2] + editCost + 1;
        deletionState = bestState(a, b, c);
        current[slot + 1] = Math.min(inf, a, b, c);
      }
      if (k > 0) {
        const from = slot - 3;
        const a = current[from] + editCost + 1;
        const b = current[from + 1] + editCost + 1;
        const c = current[from + 2] + editCost;
        insertionState = bestState(a, b, c);
        current[slot + 2] = Math.min(inf, a, b, c);
      }
      // Three two-bit predecessor states share one byte per band cell.
      trace[i * width + k] = diagonalState | (deletionState << 2) | (insertionState << 4);
    }
    previous = current;
  }
  const finalSlot = (m - n + limit) * 3;
  let state = bestState(previous[finalSlot], previous[finalSlot + 1], previous[finalSlot + 2]);
  const distance = Math.floor(previous[finalSlot + state] / editCost);
  if (distance > limit) throw tooDifferent();
  let i = n, j = m;
  const steps = [];
  while (i || j) {
    const predecessor = (trace[i * width + j - i + limit] >> (state * 2)) & 3;
    if (state === 0) steps.push([reference[--i], alternative[--j]]);
    else if (state === 1) steps.push([reference[--i], '-']);
    else steps.push(['-', alternative[--j]]);
    state = predecessor;
  }
  steps.reverse();
  const differences = [];
  let position = 0;
  for (const [ref, alt] of steps) {
    if (ref !== alt) {
      const type = ref === '-' ? 'Insertion' : alt === '-' ? 'Deletion' : /[^ACGT]/.test(ref + alt) ? 'Ambiguous' : 'Substitution';
      const last = differences.at(-1);
      if (last && last.type === type && type !== 'Substitution' && type !== 'Ambiguous' && last.end === position) {
        last.reference += ref === '-' ? '' : ref;
        last.alternative += alt === '-' ? '' : alt;
        last.end += ref === '-' ? 0 : 1;
      } else differences.push({ type, start: position, end: position + (ref === '-' ? 0 : 1), reference: ref === '-' ? '' : ref, alternative: alt === '-' ? '' : alt });
    }
    if (ref !== '-') position++;
  }
  return { distance, differences };
}
