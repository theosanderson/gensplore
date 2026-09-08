const range = (start, end) => end > start + 1 ? `${start + 1}–${end}` : `${start + 1}`;
const shortSequence = value => value.length > 24 ? `${value.slice(0, 24)}… (${value.length} letters)` : value;

export function changeTooltip(change, gene) {
  const aa = gene !== undefined;
  const location = aa ? `${gene} · reference ${change.end > change.start + 1 ? 'residues' : 'residue'} ${range(change.start, change.end)}`
    : `reference ${change.end > change.start + 1 ? 'positions' : 'position'} ${range(change.start, change.end)}`;
  if (change.type === 'Ambiguous') return aa
    ? `Amino acid unresolved because of ambiguous nucleotide calls · ${location}`
    : `No confident call · ${location}`;
  if (change.type === 'Deletion') return `Deleted in this sequence · ${location}`;
  if (change.type === 'Insertion') return `Inserted after reference ${aa ? 'residue' : 'position'} ${change.start}${aa ? ` · ${gene}` : ''} · ${shortSequence(change.alternative)}`;
  if (change.type === 'Frameshift') return `Frame shift · ${location}; downstream amino-acid correspondence is uncertain`;
  return `Reference ${shortSequence(change.reference)} → sample ${shortSequence(change.alternative)} · ${location}`;
}

export function letterTooltip({ letter, position, changes, gene, reverseComplement = false, complement = value => value }) {
  const prefix = gene !== undefined ? `${gene} · Reference ${letter} · residue ${position + 1}`
    : `Reference ${letter} · position ${position + 1}${reverseComplement ? ' · reverse complement' : ''}`;
  const change = changes.find(change => change.type !== 'Insertion' && position >= change.start && position < change.end);
  if (change) {
    if (change.type === 'Substitution') {
      const alternative = change.alternative[position - change.start];
      return `Reference ${letter} → sample ${reverseComplement ? complement(alternative) : alternative} · ${gene !== undefined ? `${gene} · residue` : 'position'} ${position + 1}${reverseComplement ? ' · reverse complement' : ''}`;
    }
    return `${prefix} · ${changeTooltip(change, gene)}`;
  }
  if (gene !== undefined && changes.some(change => change.type === 'Frameshift' && position >= change.start)) {
    return `${prefix} · downstream of a frame shift; sample amino acid is uncertain`;
  }
  return prefix;
}
