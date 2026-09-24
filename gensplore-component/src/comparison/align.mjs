export const DEFAULT_EDIT_LIMIT = 256;
// Substitutions do not widen the band, so they may exceed the indel limit on long
// sequences; this share of the compared reference bounds them against unrelated input.
// SARS-CoV-2 lineages sit near 0.5%; 5% leaves headroom without accepting noise.
export const SUBSTITUTION_FRACTION = 0.05;
// Gap openings cost more than one edit so that contiguous indels stay together and
// an indel pair is not preferred over a short run of substitutions (a false frameshift).
const GAP_OPEN = 4;

export function parseFasta(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines[0]?.startsWith('>')) throw new Error('Expected a FASTA header starting with >.');
  if (lines.slice(1).some(line => line.startsWith('>'))) throw new Error('Please supply exactly one FASTA record.');
  // Aligner output (e.g. Nextclade) carries gaps; report them so a record already in
  // reference coordinates can be used as supplied instead of being realigned.
  const raw = lines.slice(1).join('').replace(/\s/g, '').replace(/\./g, '-').toUpperCase();
  if (!raw || /[^ACGTRYSWKMBDHVN-]/.test(raw)) throw new Error('Expected a DNA sequence (IUPAC bases, optionally gapped).');
  const sequence = raw.replace(/-/g, '');
  if (!sequence) throw new Error('Expected a DNA sequence (IUPAC bases, optionally gapped).');
  return { name: lines[0].slice(1).trim() || 'Alternative', sequence, aligned: raw.includes('-') ? raw : null };
}

// Protein-side counterpart of alignSample: padding describes missing coverage at the
// same starting point as the reference.
// Clip the corresponding reference ends too, retaining its original coordinates.
// Keep this separate from literal alignment (also used for protein sequences).
export function alignTerminalPadding(reference, alternative, unknown = 'N', limit = DEFAULT_EDIT_LIMIT, { leading = Infinity, trailing: maxTrailing = Infinity } = {}) {
  if (!reference.length || !alternative.length) throw new Error('Both sequences must contain bases.');
  if (Math.max(reference.length, alternative.length) > 100000) throw new Error('Comparison supports sequences up to 100,000 bases.');
  let start = 0, trailing = 0;
  while (start < alternative.length && start < leading && alternative[start] === unknown) start++;
  if (start === alternative.length) return { distance: 0, differences: [], coverage: { start: 0, end: 0 } };
  while (trailing < alternative.length - start && trailing < maxTrailing && alternative[alternative.length - trailing - 1] === unknown) trailing++;
  const end = reference.length - trailing;
  if (start >= end) throw new Error('Terminal padding leaves no comparable reference span.');
  const result = align(reference.slice(start, end), alternative.slice(start, alternative.length - trailing), limit, unknown);
  return { ...result, coverage: { start, end }, differences: result.differences.map(d => ({
    ...d, start: d.start + start, end: d.end + start,
  })) };
}

const ANCHOR = 24, ANCHOR_SEARCH = 500;
// Where the first N-free k-mer near one end of the sample lands in the reference,
// projected back to that end. Only unique exact matches are trusted.
function anchor(reference, sample, fromEnd) {
  const flip = s => [...s].reverse().join('');
  const ref = fromEnd ? flip(reference) : reference, alt = fromEnd ? flip(sample) : sample;
  for (let offset = 0; offset + ANCHOR <= Math.min(alt.length, ANCHOR_SEARCH); offset += ANCHOR) {
    const kmer = alt.slice(offset, offset + ANCHOR);
    if (kmer.includes('N')) continue;
    const at = ref.indexOf(kmer);
    if (at < 0 || ref.indexOf(kmer, at + 1) >= 0) continue;
    return Math.max(0, at - offset);
  }
  return 0;
}

// Align a sample that may cover only part of the reference: terminal Ns, and
// reference ends beyond the sample's anchored ends, are missing coverage.
export function alignSample(reference, alternative, limit = DEFAULT_EDIT_LIMIT) {
  if (!reference.length || !alternative.length) throw new Error('Both sequences must contain bases.');
  if (Math.max(reference.length, alternative.length) > 100000) throw new Error('Comparison supports sequences up to 100,000 bases.');
  let start = 0, trailing = 0;
  while (start < alternative.length && alternative[start] === 'N') start++;
  if (start === alternative.length) return { distance: 0, differences: [], coverage: { start: 0, end: 0 } };
  while (alternative[alternative.length - trailing - 1] === 'N') trailing++;
  const core = alternative.slice(start, alternative.length - trailing);
  // Padding fixes the coordinates when present; otherwise anchoring may clip more.
  const refStart = Math.max(start, anchor(reference, core, false));
  const refEnd = Math.min(reference.length - trailing, reference.length - anchor(reference, core, true));
  if (refStart >= refEnd) throw new Error('The sample does not overlap a comparable reference span.');
  const result = align(reference.slice(refStart, refEnd), core, limit);
  return { ...result, coverage: { start: refStart, end: refEnd }, differences: result.differences.map(d => ({
    ...d, start: d.start + refStart, end: d.end + refStart,
  })) };
}

// Banded global alignment. Each substitution or inserted/deleted base costs one,
// and each gap opening costs GAP_OPEN more, so contiguous indels stay together and
// an indel pair does not replace a short run of substitutions (a false frameshift).
// The band bounds inserted/deleted bases by the limit; substitutions do not leave it.
// Unknown symbols in the alternative (N, or X for proteins) are missing data and
// cost nothing, though they are still reported as ambiguous differences.
export function align(reference, alternative, limit = DEFAULT_EDIT_LIMIT, unknown = 'N') {
  const n = reference.length, m = alternative.length;
  if (!n || !m) throw new Error('Both sequences must contain bases.');
  if (Math.max(n, m) > 100000) throw new Error('Comparison supports sequences up to 100,000 bases.');
  const budget = Math.max(limit, Math.floor(n * SUBSTITUTION_FRACTION));
  const tooDifferent = () => new Error(`Sequences exceed the comparison limit (${limit} inserted or deleted bases, ${budget} edits in total). Use a closely related sequence in the same orientation as the reference.`);
  if (Math.abs(n - m) > limit) throw tooDifferent();
  // States: diagonal, deletion, insertion.
  const width = 2 * limit + 1, inf = 0xFFFFFFFF;
  const trace = new Uint8Array((n + 1) * width);
  const bestState = (a, b, c) => a <= b && a <= c ? 0 : b <= c ? 1 : 2;
  let previous = new Uint32Array(width * 3).fill(inf);
  previous[limit * 3] = 0;
  for (let j = 1; j <= Math.min(m, limit); j++) {
    previous[(j + limit) * 3 + 2] = j + GAP_OPEN;
    trace[j + limit] = (j === 1 ? 0 : 2) << 4;
  }
  for (let i = 1; i <= n; i++) {
    const current = new Uint32Array(width * 3).fill(inf);
    for (let j = Math.max(0, i - limit); j <= Math.min(m, i + limit); j++) {
      const k = j - i + limit, slot = k * 3;
      if (j === 0) {
        current[slot + 1] = i + GAP_OPEN;
        trace[i * width + k] = (i === 1 ? 0 : 1) << 2;
        continue;
      }
      const diagonalState = bestState(previous[slot], previous[slot + 1], previous[slot + 2]);
      current[slot] = Math.min(inf, previous[slot + diagonalState] + (reference[i - 1] === alternative[j - 1] || alternative[j - 1] === unknown ? 0 : 1));
      let deletionState = 0, insertionState = 0;
      if (k + 1 < width) {
        const from = slot + 3;
        const a = previous[from] + 1 + GAP_OPEN;
        const b = previous[from + 1] + 1;
        const c = previous[from + 2] + 1 + GAP_OPEN;
        deletionState = bestState(a, b, c);
        current[slot + 1] = Math.min(inf, a, b, c);
      }
      if (k > 0) {
        const from = slot - 3;
        const a = current[from] + 1 + GAP_OPEN;
        const b = current[from + 1] + 1 + GAP_OPEN;
        const c = current[from + 2] + 1;
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
  if (previous[finalSlot + state] === inf) throw tooDifferent();
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
  // Reported distance counts edits only: no gap-opening costs, no missing data.
  let distance = 0, indels = 0;
  for (const [ref, alt] of steps) {
    if (ref === '-' || alt === '-') indels++;
    if (ref !== alt && alt !== unknown) distance++;
  }
  if (indels > limit || distance > budget) throw tooDifferent();
  const differences = [];
  let position = 0;
  for (const [ref, alt] of steps) {
    if (ref !== alt) {
      const type = ref === '-' ? 'Insertion' : alt === '-' ? 'Deletion' : /[^ACGT]/.test(ref + alt) ? 'Ambiguous' : 'Substitution';
      const last = differences.at(-1);
      // Indels and runs of missing data (e.g. amplicon dropouts) form single differences.
      const run = type === 'Insertion' || type === 'Deletion' || (type === 'Ambiguous' && alt === unknown && /^(.)\1*$/.test(last?.alternative + alt));
      if (last && last.type === type && run && last.end === position) {
        last.reference += ref === '-' ? '' : ref;
        last.alternative += alt === '-' ? '' : alt;
        last.end += ref === '-' ? 0 : 1;
      } else differences.push({ type, start: position, end: position + (ref === '-' ? 0 : 1), reference: ref === '-' ? '' : ref, alternative: alt === '-' ? '' : alt });
    }
    if (ref !== '-') position++;
  }
  return { distance, differences };
}
