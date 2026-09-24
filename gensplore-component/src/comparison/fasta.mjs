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
