import { align, parseFasta } from './align.mjs';
self.onmessage = ({ data }) => {
  try {
    const record = parseFasta(data.fasta);
    self.postMessage({ ...align(data.reference, record.sequence), name: record.name });
  } catch (error) { self.postMessage({ error: error.message }); }
};
