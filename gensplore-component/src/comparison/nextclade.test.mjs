import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFasta } from './fasta.mjs';
import { compareAligned } from './aligned.mjs';
import { alignWithNextclade, cdsSegments, loadNextclade, MAX_LENGTH } from './nextclade.mjs';
import { compareProteins } from './proteins.mjs';
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

// alignmentParams from the Nextclade SARS-CoV-2 dataset's pathogen.json
// (nextstrain/sars-cov-2/wuhan-hu-1/orfs, 2026-09-07--17-10-15Z).
const SARS_COV_2_PARAMS = { excessBandwidth: 12, terminalBandwidth: 100, allowedMismatches: 4, gapAlignmentSide: 'right', minSeedCover: 0.1 };

test('a divergent SARS-CoV-2 sample reproduces Nextclade’s nucleotide and amino-acid calls', async () => {
  const reference = (await fixture('NC_045512.2.fasta')).sequence;
  const raw = await fixture('QB007131.fasta');
  const published = await fixture('QB007131.nextclade-aligned.fasta');
  const { features } = (await parseReference(await website('sequence.gb')))[0].parsedSequence;
  const result = alignWithNextclade(reference, raw.sequence, features, SARS_COV_2_PARAMS);
  // Nextclade's aligned FASTA omits insertions; everything else is identical.
  const expected = compareAligned(reference, { ...published, sequence: published.aligned });
  assert.deepEqual(result.coverage, expected.coverage);
  assert.deepEqual(result.differences.filter(d => d.type !== 'Insertion'), expected.differences);

  // Nextclade's amino-acid calls for the CDSs this GenBank record shares with its
  // dataset (it splits ORF1ab into ORF1a and ORF1b; ours has a ribosomal slippage).
  const calls = (await readFile(new URL('./fixtures/QB007131.nextclade-aa.txt', import.meta.url), 'utf8')).trim().split('\n');
  const proteins = compareProteins(reference, features, result.differences, result.coverage, SARS_COV_2_PARAMS);
  const ours = [];
  const names = new Set();
  features.forEach((feature, index) => {
    if (feature.type !== 'CDS' || !proteins[index] || /^orf1|^nsp|^leader/.test(feature.name)) return;
    const name = feature.name === 'ORF9B' ? 'ORF9b' : feature.name;
    names.add(name);
    assert.equal(proteins[index].warning, undefined, name);
    for (const change of proteins[index].changes) {
      if (change.type === 'Substitution') ours.push(`${name}:${change.reference}${change.aaPosition}${change.alternative}`);
      else if (change.type === 'Deletion') [...change.reference].forEach((residue, k) => ours.push(`${name}:${residue}${change.aaPosition + k}-`));
      else if (change.type === 'Insertion') ours.push(`ins_${name}:${change.aaPosition}:${change.alternative}`);
      else assert.fail(`unexpected ${change.type} in ${name}`);
    }
  });
  const theirs = calls.filter(call => names.has(call.replace(/^ins_/, '').split(':')[0]));
  assert.ok(theirs.length > 100);
  assert.deepEqual(ours.sort(), theirs.sort());
});

test('without dataset parameters, Nextclade’s defaults still agree up to equally scoring gap placement', async () => {
  const reference = (await fixture('NC_045512.2.fasta')).sequence;
  const raw = await fixture('QB007131.fasta');
  const published = await fixture('QB007131.nextclade-aligned.fasta');
  const result = alignWithNextclade(reference, raw.sequence);
  const expected = compareAligned(reference, { ...published, sequence: published.aligned });
  assert.deepEqual(result.coverage, expected.coverage);
  const count = (r, type) => r.differences.filter(d => d.type === type).reduce((n, d) => n + d.end - d.start, 0);
  assert.equal(count(result, 'Deletion'), count(expected, 'Deletion'));
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

test('sequences up to the length limit are aligned; longer ones are rejected', () => {
  const reference = randomSequence(MAX_LENGTH, 13);
  const edited = reference.slice(1000, 250000) + (reference[250000] === 'A' ? 'C' : 'A') + reference.slice(250001, 400000) + reference.slice(400300);
  const { coverage, differences } = alignWithNextclade(reference, edited);
  assert.deepEqual(coverage, { start: 1000, end: MAX_LENGTH });
  assert.deepEqual(differences.map(d => d.type), ['Substitution', 'Deletion']);
  assert.equal(differences[0].start, 250000);
  // Bases repeated across the deletion's ends allow equally scoring placements.
  const [deletion] = differences.slice(1);
  assert.equal(deletion.end - deletion.start, 300);
  assert.ok(Math.abs(deletion.start - 400000) <= 3, `deletion at ${deletion.start}`);
  assert.throws(() => alignWithNextclade(reference + 'A', reference), /up to 500,000 bases/);
});
