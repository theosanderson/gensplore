import { genbankToJson } from '@teselagen/bio-parsers';

// The parser converts T to U for RNA records. Use one nucleotide alphabet for
// reference display, reverse complements, translation, and FASTA comparisons.
export async function parseReference(text) {
  const records = await genbankToJson(text);
  for (const record of records) {
    if (record.parsedSequence?.sequence) {
      record.parsedSequence.sequence = record.parsedSequence.sequence.toUpperCase().replace(/U/g, 'T');
    }
  }
  return records;
}
