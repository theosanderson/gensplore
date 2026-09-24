import { compareAligned } from './aligned.mjs';
import { compareProteins } from './proteins.mjs';
import { alignSample, parseFasta } from './align.mjs';
self.onmessage = ({ data }) => {
  try {
    const record = data.alignedSequence || parseFasta(data.fasta);
    // A gapped record already in reference coordinates keeps the gap placement it was
    // given; anything else is aligned here.
    const preAligned = data.alignedSequence || (record.aligned?.length === data.reference.length ? { ...record, sequence: record.aligned } : null);
    const result = preAligned ? compareAligned(data.reference, preAligned) : alignSample(data.reference, record.sequence);
    self.postMessage({ ...result, name: record.name,
      proteins: compareProteins(data.reference, data.features || [], result.differences, result.coverage) });
  } catch (error) { self.postMessage({ error: error.message }); }
};
