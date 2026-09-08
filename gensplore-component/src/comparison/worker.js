import { compareAligned } from './aligned.mjs';
import { compareProteins } from './proteins.mjs';
import { alignTerminalPadding, parseFasta } from './align.mjs';
self.onmessage = ({ data }) => {
  try {
    const record = data.alignedSequence || parseFasta(data.fasta);
    const result = data.alignedSequence ? compareAligned(data.reference, record) : alignTerminalPadding(data.reference, record.sequence);
    self.postMessage({ ...result, name: record.name,
      proteins: compareProteins(data.reference, data.features || [], result.differences, result.coverage) });
  } catch (error) { self.postMessage({ error: error.message }); }
};
