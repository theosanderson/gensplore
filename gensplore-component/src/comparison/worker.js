import { compareProteins } from './proteins.mjs';
import { align, parseFasta } from './align.mjs';
self.onmessage = ({ data }) => {
  try {
    const record = parseFasta(data.fasta);
    const result = align(data.reference, record.sequence);
    self.postMessage({ ...result, name: record.name,
      proteins: compareProteins(data.reference, data.features || [], result.differences) });
  } catch (error) { self.postMessage({ error: error.message }); }
};
