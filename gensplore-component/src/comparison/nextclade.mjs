import { align, initSync } from './nextclade/align.js';
import wasm from './nextclade/wasm.js';
import { compareAligned } from './aligned.mjs';
import { featureLocations } from './rowGeometry.mjs';

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

// Align with Nextclade, then compare its alignment projected onto the reference:
// unsequenced ends become N (missing coverage) and query-only bases insertions.
export function alignWithNextclade(reference, sequence, features = []) {
  if (!reference.length || !sequence.length) throw new Error('Both sequences must contain bases.');
  if (Math.max(reference.length, sequence.length) > 100000) throw new Error('Comparison supports sequences up to 100,000 bases.');
  // Nothing to seed; an all-N sample covers no reference bases.
  if (/^N+$/.test(sequence)) return { distance: 0, differences: [], coverage: { start: 0, end: 0 } };
  if (!loadNextclade()) throw new Error("Alignment needs WebAssembly. If this page sets a Content-Security-Policy, allow 'wasm-unsafe-eval' in script-src.");
  let alignedReference, alignedQuery;
  try {
    [alignedReference, alignedQuery] = align(reference, sequence, cdsSegments(features, reference.length)).split('\n');
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
