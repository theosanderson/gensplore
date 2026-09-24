import { align, align_peptides as alignPeptidePair, initSync } from './nextclade/align.js';
import wasm from './nextclade/wasm.js';
import { compareAligned } from './aligned.mjs';
import { featureLocations } from './rowGeometry.mjs';

// Alignment memory grows about 480 bytes per base (250 MB at this limit) and time
// faster than linearly: about 1.5 s here for typical genomes, longer for repetitive ones.
export const MAX_LENGTH = 500000;

let loaded;
// Compiling needs WebAssembly, which a Content-Security-Policy without
// 'wasm-unsafe-eval' forbids.
export function loadNextclade() {
  if (loaded === undefined) {
    try {
      const bytes = Uint8Array.from(atob(wasm), c => c.charCodeAt(0));
      initSync({ module: new WebAssembly.Module(bytes) });
      loaded = true;
    } catch { loaded = false; }
  }
  return loaded;
}

// (CDS id, start, exclusive end, strand) quadruples in transcript order, from the
// first complete codon, so gap openings between codons are cheaper than within them.
export function cdsSegments(features, referenceLength) {
  const segments = [];
  features.filter(feature => feature.type === 'CDS').forEach((feature, id) => {
    const strand = feature.strand < 0 ? -1 : 1;
    const locations = featureLocations(feature, referenceLength)
      .filter(({ start, end }) => Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start <= end && end < referenceLength)
      .map(({ start, end }) => [start, end + 1]);
    if (strand < 0) locations.reverse();
    const codonStart = Number([feature.notes?.codon_start].flat()[0] ?? 1);
    let offset = [1, 2, 3].includes(codonStart) ? codonStart - 1 : 0;
    for (const [start, end] of locations) {
      const skip = Math.min(offset, end - start);
      offset -= skip;
      if (end - start > skip) segments.push(id, strand < 0 ? start : start + skip, strand < 0 ? end - skip : end, strand);
    }
  });
  return new Int32Array(segments);
}

function requireNextclade() {
  if (!loadNextclade()) throw new Error("Alignment needs WebAssembly. If this page sets a Content-Security-Policy, allow 'wasm-unsafe-eval' in script-src.");
}

// Align with Nextclade, then compare its alignment projected onto the reference:
// unsequenced ends become N (missing coverage) and query-only bases insertions.
// `alignmentParams` overrides Nextclade's defaults, as a dataset's pathogen.json
// `alignmentParams` does (for example SARS-CoV-2's gapAlignmentSide: 'right').
export function alignWithNextclade(reference, sequence, features = [], alignmentParams) {
  if (!reference.length || !sequence.length) throw new Error('Both sequences must contain bases.');
  if (Math.max(reference.length, sequence.length) > MAX_LENGTH) throw new Error(`Comparison supports sequences up to ${MAX_LENGTH.toLocaleString('en-US')} bases.`);
  // Nothing to seed; an all-N sample covers no reference bases.
  if (/^N+$/.test(sequence)) return { distance: 0, differences: [], coverage: { start: 0, end: 0 } };
  requireNextclade();
  let alignedReference, alignedQuery;
  try {
    [alignedReference, alignedQuery] = align(reference, sequence, cdsSegments(features, reference.length), JSON.stringify(alignmentParams ?? {})).split('\n');
  } catch (error) {
    throw new Error(`Could not align this sequence to the reference: ${error.message} Use a related sequence in the same orientation as the reference.`);
  }
  let projected = '';
  const insertions = [];
  for (let i = 0; i < alignedReference.length; i++) {
    if (alignedReference[i] !== '-') projected += alignedQuery[i];
    else if (insertions.at(-1)?.end === i) { insertions.at(-1).sequence += alignedQuery[i]; insertions.at(-1).end++; }
    else insertions.push({ position: projected.length, sequence: alignedQuery[i], end: i + 1 });
  }
  const leading = projected.match(/^-*/)[0].length;
  const trailing = leading === projected.length ? 0 : projected.match(/-*$/)[0].length;
  projected = 'N'.repeat(leading) + projected.slice(leading, projected.length - trailing) + 'N'.repeat(trailing);
  const { distance, differences, coverage } = compareAligned(reference, {
    sequence: projected, insertions: insertions.map(({ position, sequence }) => ({ position, sequence })),
  });
  return { distance, differences, coverage };
}

// Peptides are aligned as Nextclade's translate_cds does: with its banded amino-acid
// aligner, the band estimated (calculate_aa_alignment_params) from the gaps in the
// coding nucleotide alignment, deleted bases being query gaps and inserted bases
// reference gaps. X is an unknown residue: missing data, reported as ambiguous.
export function alignPeptides(reference, alternative, { deleted = 0, inserted = 0 } = {}, alignmentParams) {
  if (!reference.length || !alternative.length) throw new Error('Both peptides must contain residues.');
  requireNextclade();
  const bandWidth = Math.trunc((deleted + inserted) / 3) + 5;
  const meanShift = Math.trunc((deleted - inserted) / 6);
  const [alignedReference, alignedAlternative] = alignPeptidePair(reference, alternative, bandWidth, meanShift, JSON.stringify(alignmentParams ?? {})).split('\n');
  const differences = [];
  let position = 0;
  for (let i = 0; i < alignedReference.length; i++) {
    const ref = alignedReference[i], alt = alignedAlternative[i];
    if (ref !== alt) {
      const type = ref === '-' ? 'Insertion' : alt === '-' ? 'Deletion' : ref === 'X' || alt === 'X' ? 'Ambiguous' : 'Substitution';
      const last = differences.at(-1);
      // Indels and runs of unknown residues form single differences.
      const run = type === 'Insertion' || type === 'Deletion' || (type === 'Ambiguous' && alt === 'X' && /^X*$/.test(last?.alternative));
      if (last && last.type === type && run && last.end === position) {
        last.reference += ref === '-' ? '' : ref;
        last.alternative += alt === '-' ? '' : alt;
        last.end += ref === '-' ? 0 : 1;
      } else differences.push({ type, start: position, end: position + (ref === '-' ? 0 : 1), reference: ref === '-' ? '' : ref, alternative: alt === '-' ? '' : alt });
    }
    if (ref !== '-') position++;
  }
  return differences;
}
