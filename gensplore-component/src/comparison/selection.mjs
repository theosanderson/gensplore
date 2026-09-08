// Selection boundaries are zero-based reference coordinates, with an exclusive end.
// Insertions belong to the preceding reference base (including at the right edge);
// an insertion before the reference is included when the selection starts at zero.
export function selectedSequence(reference, start, end, comparison) {
  start = Math.max(0, Math.min(reference.length, start));
  end = Math.max(0, Math.min(reference.length, end));
  if (start >= end) return '';
  const bases = [...reference.slice(start, end)];
  if (!comparison) return bases.join('');
  const { coverage, differences } = comparison;
  if (coverage) {
    for (let p = start; p < end; p++) {
      if (p < coverage.start || p >= coverage.end) bases[p - start] = 'N';
    }
  }
  const insertions = new Map();
  for (const difference of differences) {
    if (difference.type === 'Insertion') {
      if ((difference.start > start && difference.start <= end) || (start === 0 && difference.start === 0)) {
        insertions.set(difference.start, difference.alternative);
      }
      continue;
    }
    for (let p = Math.max(start, difference.start); p < Math.min(end, difference.end); p++) {
      bases[p - start] = difference.type === 'Deletion' ? '' : difference.alternative[p - difference.start];
    }
  }
  let sequence = insertions.get(start) || '';
  for (let p = start; p < end; p++) sequence += bases[p - start] + (insertions.get(p + 1) || '');
  return sequence;
}
