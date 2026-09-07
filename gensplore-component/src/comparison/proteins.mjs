import codonToAminoAcid from './codonMapping.mjs';
import { align } from './align.mjs';
import { featureLocations } from './rowGeometry.mjs';

const complement = { A: 'T', T: 'A', C: 'G', G: 'C', R: 'Y', Y: 'R', S: 'S', W: 'W', K: 'M', M: 'K', B: 'V', V: 'B', D: 'H', H: 'D', N: 'N' };
const reverseComplement = sequence => [...sequence].reverse().map(base => complement[base] || 'N').join('');
const translate = sequence => {
  let protein = '';
  for (let i = 0; i + 2 < sequence.length; i += 3) protein += codonToAminoAcid(sequence.slice(i, i + 3));
  return protein;
};
const qualifier = (feature, name, fallback) => {
  const value = feature.notes?.[name];
  return (Array.isArray(value) ? value[0] : value) ?? fallback;
};

// Compare literal translations of the annotated coding span. No phenotype or
// protein-function inference. Unsupported translation annotations are explicit.
export function compareProtein(reference, feature, differences) {
  if (!['CDS', 'mat_peptide'].includes(feature.type)) return null;
  const locations = featureLocations(feature, reference.length);
  const positions = [];
  for (const location of locations) {
    if (!Number.isInteger(location.start) || !Number.isInteger(location.end) || location.start < 0 || location.end >= reference.length || location.end < location.start) {
      return { warning: 'Unsupported coding location', codons: [], changes: [] };
    }
    for (let p = location.start; p <= location.end; p++) positions.push(p);
  }
  if (feature.strand < 0) positions.reverse();
  const offset = Number(qualifier(feature, 'codon_start', 1)) - 1;
  if (![0, 1, 2].includes(offset)) return { warning: 'Unsupported codon_start', codons: [], changes: [] };
  positions.splice(0, offset);
  const table = Number(qualifier(feature, 'transl_table', 1));
  if (![1, 11].includes(table) || ['transl_except', 'ribosomal_slippage', 'exception'].some(key => feature.notes?.[key])) {
    return { warning: 'AA comparison unavailable for this translation table or exception', codons: [], changes: [] };
  }
  const codingIndex = new Map(positions.map((p, i) => [p, i]));
  const orient = sequence => feature.strand < 0 ? reverseComplement(sequence) : sequence;
  const dna = positions.map(p => orient(reference[p])).join('');
  const protein = translate(dna);
  const codons = [...protein].map((aminoAcid, index) => ({
    positions: positions.slice(index * 3, index * 3 + 3), aminoAcid, codonIndex: index,
  }));
  const deleted = new Set(), replacements = new Map(), insertions = new Map();
  let frameIndex = Infinity, boundaryWarning = false;
  for (const d of differences) {
    if (d.type === 'Insertion') {
      const next = feature.strand < 0 ? d.start - 1 : d.start;
      const index = codingIndex.get(next);
      const previous = feature.strand < 0 ? d.start : d.start - 1;
      if (index > 0 && positions[index - 1] === previous) {
        insertions.set(index, orient(d.alternative));
        if (d.alternative.length % 3) frameIndex = Math.min(frameIndex, index);
      } else if (codingIndex.has(next) || codingIndex.has(previous)) boundaryWarning = true;
    } else if (d.type === 'Deletion') {
      const affected = [];
      for (let p = d.start; p < d.end; p++) {
        const index = codingIndex.get(p);
        if (index !== undefined) { deleted.add(index); affected.push(index); }
      }
      if (affected.length % 3) frameIndex = Math.min(frameIndex, ...affected);
    } else {
      for (let position = d.start; position < d.end; position++) {
        const index = codingIndex.get(position);
        if (index !== undefined) replacements.set(index, orient(d.alternative[position - d.start]));
      }
    }
  }
  let alternateDna = '';
  const alternateOffsets = [];
  for (let index = 0; index < positions.length; index++) {
    alternateOffsets[index] = alternateDna.length;
    alternateDna += insertions.get(index) || '';
    if (!deleted.has(index)) alternateDna += replacements.get(index) ?? dna[index];
  }
  const frameCodon = Math.floor(frameIndex / 3);
  const refPeptide = Number.isFinite(frameIndex) ? protein.slice(0, frameCodon) : protein;
  const altPeptide = translate(Number.isFinite(frameIndex) ? alternateDna.slice(0, alternateOffsets[frameCodon * 3]) : alternateDna);
  let changes = [];
  const makeChange = d => {
    const index = Math.min(d.start, Math.max(0, codons.length - 1));
    const residue = codons[index];
    const insertionPointer = d.start < codons.length
      ? (residue?.positions[0] ?? positions[0]) + (feature.strand < 0 ? 0.5 : -0.5)
      : (residue?.positions[2] ?? positions[0]) + (feature.strand < 0 ? -0.5 : 0.5);
    return { ...d, anchor: residue?.positions[1] ?? positions[0],
      ...(d.type === 'Insertion' ? { pointerPosition: insertionPointer } : {}),
      // Insertions refer to the boundary before the indexed reference residue.
      aaPosition: d.type === 'Insertion' ? d.start : d.start + 1 };
  };
  try {
    if (refPeptide && altPeptide) {
      changes = align(refPeptide, altPeptide).differences.map(d => makeChange({ ...d,
        type: d.type === 'Ambiguous' ? /X/.test(d.reference + d.alternative) ? 'Ambiguous' : 'Substitution' : d.type,
      }));
    } else if (refPeptide || altPeptide) {
      changes = [makeChange({ type: refPeptide ? 'Deletion' : 'Insertion', start: 0, end: refPeptide.length, reference: refPeptide, alternative: altPeptide })];
    }
  } catch {
    return { codons, changes: [], warning: 'AA comparison exceeds the alignment limit' };
  }
  if (Number.isFinite(frameIndex)) changes.push(makeChange({ type: 'Frameshift', start: frameCodon, end: frameCodon + 1, reference: '', alternative: '' }));
  return { codons, changes, warning: boundaryWarning ? 'Insertion at a coding boundary: AA assignment is uncertain' : undefined };
}

export function compareProteins(reference, features, differences) {
  return features.map(feature => compareProtein(reference, feature, differences));
}
