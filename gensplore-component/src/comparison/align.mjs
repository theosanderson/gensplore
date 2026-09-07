export function parseFasta(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines[0]?.startsWith('>')) throw new Error('Expected a FASTA header starting with >.');
  if (lines.slice(1).some(line => line.startsWith('>'))) throw new Error('Please supply exactly one FASTA record.');
  const sequence = lines.slice(1).join('').replace(/\s/g, '').toUpperCase();
  if (!sequence || /[^ACGTRYSWKMBDHVN]/.test(sequence)) throw new Error('Expected an ungapped DNA sequence (IUPAC bases).');
  return { name: lines[0].slice(1).trim() || 'Alternative', sequence };
}

// Banded global Levenshtein alignment. A result costing <= limit is globally
// optimal: any path leaving the band must already cost more than limit.
export function align(reference, alternative, limit = 128) {
  const n = reference.length, m = alternative.length;
  if (!n || !m) throw new Error('Both sequences must contain bases.');
  if (Math.max(n, m) > 100000) throw new Error('Comparison supports sequences up to 100,000 bases.');
  const tooDifferent = () => new Error(`Sequences exceed the ${limit}-edit comparison limit. Use complete sequences in the same orientation and with the same starting point.`);
  if (Math.abs(n - m) > limit) throw tooDifferent();
  const width = 2 * limit + 1, inf = limit + 1;
  const trace = new Uint8Array((n + 1) * width);
  let previous = new Uint32Array(width).fill(inf);
  for (let j = 0; j <= Math.min(m, limit); j++) previous[j + limit] = j;
  for (let i = 1; i <= n; i++) {
    const current = new Uint32Array(width).fill(inf);
    for (let j = Math.max(0, i - limit); j <= Math.min(m, i + limit); j++) {
      const k = j - i + limit;
      if (j === 0) { current[k] = i; trace[i * width + k] = 1; continue; }
      const diagonal = previous[k] + (reference[i - 1] === alternative[j - 1] ? 0 : 1);
      const deletion = k + 1 < width ? previous[k + 1] + 1 : inf;
      const insertion = k > 0 ? current[k - 1] + 1 : inf;
      current[k] = Math.min(diagonal, deletion, insertion, inf);
      trace[i * width + k] = current[k] === diagonal ? 0 : current[k] === deletion ? 1 : 2;
    }
    previous = current;
  }
  const distance = previous[m - n + limit];
  if (distance > limit) throw tooDifferent();
  let i = n, j = m;
  const steps = [];
  while (i || j) {
    const direction = i === 0 ? 2 : j === 0 ? 1 : trace[i * width + j - i + limit];
    if (direction === 0) { steps.push([reference[--i], alternative[--j]]); }
    else if (direction === 1) steps.push([reference[--i], '-']);
    else steps.push(['-', alternative[--j]]);
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
