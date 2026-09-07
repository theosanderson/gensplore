import { genbankToJson } from '@teselagen/bio-parsers';

// isOligo disables the parser’s automatic T-to-U conversion for RNA records.
// Preserve the supplied alphabet; Gensplore does not otherwise use this flag.
export async function parseReference(text) {
  const records = await genbankToJson(text, { isOligo: true });
  for (const record of records) {
    if (record.parsedSequence?.sequence) {
      record.parsedSequence.sequence = record.parsedSequence.sequence.toUpperCase();
    }
  }
  return records;
}
