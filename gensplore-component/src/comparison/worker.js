import { compareAligned } from './aligned.mjs';
import { compareProteins } from './proteins.mjs';
import { parseFasta } from './fasta.mjs';
import { alignWithNextclade } from './nextclade.mjs';
self.onmessage = ({ data }) => {
  try {
    const record = data.alignedSequence || parseFasta(data.fasta);
    // A gapped record already in reference coordinates keeps the gap placement it was
    // given; anything else is aligned here by Nextclade.
    const preAligned = data.alignedSequence || (record.aligned?.length === data.reference.length ? { ...record, sequence: record.aligned } : null);
    const result = preAligned ? compareAligned(data.reference, preAligned)
      : alignWithNextclade(data.reference, record.sequence, data.features || [], data.alignmentParams);
    self.postMessage({ ...result, name: record.name,
      proteins: compareProteins(data.reference, data.features || [], result.differences, result.coverage, data.alignmentParams) });
  } catch (error) { self.postMessage({ error: error.message }); }
};
