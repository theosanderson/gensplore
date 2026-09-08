// Restore missing coverage for display only, after alignment. These markers must
// not consume the edit budget or change the differences used to copy the sample.
export function comparisonForDisplay(reference, comparison) {
  if (!comparison?.coverage) return comparison;
  const { coverage } = comparison;
  const missing = position => position < coverage.start || position >= coverage.end;
  const gap = (sequence, start, end, unknown) => ({
    type: 'Ambiguous', start, end, reference: sequence.slice(start, end), alternative: unknown.repeat(end - start),
  });
  const differences = [...comparison.differences];
  if (coverage.end === 0) differences.push(gap(reference, 0, reference.length, 'N'));
  else {
    if (coverage.start > 0) differences.push(gap(reference, 0, coverage.start, 'N'));
    if (coverage.end < reference.length) differences.push(gap(reference, coverage.end, reference.length, 'N'));
  }
  differences.sort((a, b) => a.start - b.start || a.end - b.end);
  const proteins = comparison.proteins?.map(protein => {
    if (!protein) return protein;
    const { codons } = protein;
    const changes = [...protein.changes];
    const sequence = codons.map(codon => codon.aminoAcid).join('');
    // Joined and reverse-strand features use each codon's actual reference bases.
    const uncovered = codons.map((codon, index) => codon.positions.some(missing)
      && !changes.some(change => change.type === 'Ambiguous' && index >= change.start && index < change.end));
    for (let start = 0; start < codons.length;) {
      if (!uncovered[start]) { start++; continue; }
      let end = start + 1;
      while (end < codons.length && uncovered[end]) end++;
      changes.push({ ...gap(sequence, start, end, 'X'), anchor: codons[start].positions[1], aaPosition: start + 1 });
      start = end;
    }
    changes.sort((a, b) => a.start - b.start || a.end - b.end);
    return { ...protein, changes };
  });
  return { ...comparison, differences, proteins };
}
