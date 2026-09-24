import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFasta } from './align.mjs';
import { compareAligned } from './aligned.mjs';
import { alignWithNextclade, cdsSegments, loadNextclade } from './nextclade.mjs';
import { parseReference } from './parseReference.mjs';

const fixture = async name => parseFasta(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const website = name => readFile(new URL(`../../../website/public/${name}`, import.meta.url), 'utf8');
// Low LCG bits cycle with a short period; take high bits so the sequence is not repetitive.
const randomSequence = (length, seed) => Array.from({ length }, () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return 'ACGT'[(seed >>> 16) % 4];
}).join('');

test('the embedded Nextclade module loads', () => {
  assert.equal(loadNextclade(), true);
});

test('CDS segments follow transcript order from the first complete codon', () => {
  const features = [
    { type: 'gene', start: 0, end: 99 },
    { type: 'CDS', start: 10, end: 20, strand: 1 },
    { type: 'CDS', strand: 1, locations: [{ start: 30, end: 40 }, { start: 40, end: 60 }], notes: { codon_start: [2] } },
    { type: 'CDS', strand: -1, locations: [{ start: 70, end: 80 }, { start: 85, end: 95 }], notes: { codon_start: [3] } },
    { type: 'CDS', start: 90, end: 5, strand: 1 },
  ];
  assert.deepEqual([...cdsSegments(features, 100)], [
    0, 10, 21, 1,
    1, 31, 41, 1, 1, 40, 61, 1,
    // Reverse strand: the 3'-most location is transcribed first, trimmed at its end.
    2, 85, 94, -1, 2, 70, 81, -1,
    // Origin-spanning features wrap.
    3, 90, 100, 1, 3, 0, 6, 1,
  ]);
});

test('a divergent SARS-CoV-2 sample matches Nextclade’s own alignment', async () => {
  const reference = (await fixture('NC_045512.2.fasta')).sequence;
  const raw = await fixture('QB007131.fasta');
  const published = await fixture('QB007131.nextclade-aligned.fasta');
  const { features } = (await parseReference(await website('sequence.gb')))[0].parsedSequence;
  const result = alignWithNextclade(reference, raw.sequence, features);
  const expected = compareAligned(reference, { ...published, sequence: published.aligned });
  // The unsequenced ends are missing coverage, not terminal edits.
  assert.deepEqual(result.coverage, expected.coverage);
  const count = (r, type) => r.differences.filter(d => d.type === type).reduce((n, d) => n + Math.max(1, d.end - d.start), 0);
  assert.equal(count(result, 'Deletion'), count(expected, 'Deletion'));
  // Equally scoring gap placements in repeats may differ from the published run;
  // everything else agrees.
  const substitutions = r => new Set(r.differences.filter(d => d.type === 'Substitution').map(d => `${d.start}${d.alternative}`));
  const ours = substitutions(result), theirs = substitutions(expected);
  const shared = [...ours].filter(s => theirs.has(s)).length;
  assert.ok(shared >= theirs.size - 3, `only ${shared} of ${theirs.size} substitutions agreed`);
  // Nextclade's aligned FASTA omits insertions; they are reported here.
  assert.ok(result.differences.some(d => d.type === 'Insertion'));
});

test('indels longer than the JavaScript aligner’s band are aligned', () => {
  const reference = randomSequence(6000, 5);
  const sample = reference.slice(0, 2000) + reference.slice(2400, 4000) + randomSequence(300, 9) + reference.slice(4000);
  const { differences, coverage } = alignWithNextclade(reference, sample);
  assert.deepEqual(coverage, { start: 0, end: reference.length });
  assert.deepEqual(differences.map(({ type, start, end }) => ({ type, start, end })), [
    { type: 'Deletion', start: 2000, end: 2400 },
    { type: 'Insertion', start: 4000, end: 4000 },
  ]);
  assert.equal(differences[1].alternative.length, 300);
});

test('terminal Ns and unsequenced ends are missing coverage', () => {
  const reference = randomSequence(3000, 7);
  const edited = reference.slice(500, 1500) + (reference[1500] === 'A' ? 'C' : 'A') + reference.slice(1501, 2500);
  const result = alignWithNextclade(reference, 'N'.repeat(40) + edited.slice(40));
  assert.deepEqual(result.coverage, { start: 540, end: 2500 });
  assert.deepEqual(result.differences, [{ type: 'Substitution', start: 1500, end: 1501, reference: reference[1500], alternative: edited[1000] }]);
});

test('an all-N sample covers no reference bases', () => {
  assert.deepEqual(alignWithNextclade(randomSequence(3000, 7), 'N'.repeat(2000)), { distance: 0, differences: [], coverage: { start: 0, end: 0 } });
});

test('the bundled phiX174 FASTA aligns to its GenBank reference', async () => {
  const { sequence } = (await parseReference(await website('phix174.gb')))[0].parsedSequence;
  const record = parseFasta(await website('phix174.fasta'));
  assert.deepEqual(alignWithNextclade(sequence, record.sequence), { distance: 0, differences: [], coverage: { start: 0, end: sequence.length } });
});

test('an unrelated sequence is rejected', () => {
  assert.throws(() => alignWithNextclade(randomSequence(3000, 3), randomSequence(3000, 4)), /Could not align/);
});
