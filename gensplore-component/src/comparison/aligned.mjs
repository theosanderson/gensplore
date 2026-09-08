// Consume a reference-coordinate alignment without moving its gaps.
export function compareAligned(reference, input) {
  if (!input || typeof input.sequence !== 'string') throw new Error('Expected an aligned DNA sequence.');
  const sequence = input.sequence.toUpperCase();
  if (!reference.length || sequence.length !== reference.length) throw new Error('Aligned sequence length must match the reference.');
  if (/[^ACGTRYSWKMBDHVN-]/.test(sequence)) throw new Error('Aligned sequences must contain IUPAC DNA bases or deletion gaps (-).');
  let coverageStart = 0, coverageEnd = sequence.length;
  while (coverageStart < coverageEnd && sequence[coverageStart] === 'N') coverageStart++;
  while (coverageEnd > coverageStart && sequence[coverageEnd - 1] === 'N') coverageEnd--;
  const coverage = coverageStart === coverageEnd ? { start: 0, end: 0 } : { start: coverageStart, end: coverageEnd };
  const differences = [];
  let distance = 0;
  for (let start = coverage.start; start < coverage.end;) {
    if (sequence[start] === reference[start]) { start++; continue; }
    const type = sequence[start] === '-' ? 'Deletion' : /[^ACGT]/.test(sequence[start] + reference[start]) ? 'Ambiguous' : 'Substitution';
    let end = start + 1;
    if (type === 'Deletion' || type === 'Ambiguous') {
      while (end < coverage.end && sequence[end] !== reference[end] && (type === 'Deletion' ? sequence[end] === '-' : sequence[end] !== '-' && /[^ACGT]/.test(sequence[end] + reference[end]))) end++;
    }
    differences.push({ type, start, end, reference: reference.slice(start, end), alternative: type === 'Deletion' ? '' : sequence.slice(start, end) });
    distance += end - start;
    start = end;
  }
  const positions = new Set();
  for (const insertion of input.insertions || []) {
    const position = insertion.position;
    const bases = typeof insertion.sequence === 'string' ? insertion.sequence.toUpperCase() : '';
    if (!Number.isInteger(position) || position < 0 || position > reference.length || positions.has(position)) throw new Error('Insertions need unique integer positions from 0 to the reference length.');
    if (!bases || /[^ACGTRYSWKMBDHVN]/.test(bases)) throw new Error('Insertions must contain ungapped IUPAC DNA bases.');
    positions.add(position);
    differences.push({ type: 'Insertion', start: position, end: position, reference: '', alternative: bases });
    distance += bases.length;
  }
  differences.sort((a, b) => a.start - b.start || a.end - b.end);
  return { name: input.name || 'Alternative', distance, differences, coverage };
}
