import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedSequence } from './selection.mjs';
import { compareAligned } from './aligned.mjs';
import { alignTerminalPadding } from './align.mjs';

test('reference-only selection and out-of-bounds drags retain substring behavior', () => {
  assert.equal(selectedSequence('ACGT', 1, 3), 'CG');
  assert.equal(selectedSequence('ACGT', -2, 7), 'ACGT');
  assert.equal(selectedSequence('ACGT', 2, 2), '');
});
test('aligned sample selection includes substitutions, Ns and insertions but omits deletions', () => {
  const ref = 'ACGTACGT';
  const comparison = compareAligned(ref, { sequence: 'NT--NCGN', insertions: [
    { position: 0, sequence: 'G' }, { position: 4, sequence: 'AA' }, { position: 8, sequence: 'T' },
  ] });
  assert.equal(selectedSequence(ref, 0, 8, comparison), 'GNTAANCGNT');
  assert.equal(selectedSequence(ref, 1, 5, comparison), 'TAAN');
  assert.equal(selectedSequence(ref, 2, 3, comparison), '');
});
test('insertion boundaries partition adjacent selections without duplication', () => {
  const ref = 'ACGT';
  const comparison = compareAligned(ref, { sequence: ref, insertions: [
    { position: 0, sequence: 'T' }, { position: 2, sequence: 'GG' }, { position: 4, sequence: 'A' },
  ] });
  assert.equal(selectedSequence(ref, 0, 2, comparison), 'TACGG');
  assert.equal(selectedSequence(ref, 2, 4, comparison), 'GTA');
  assert.equal(selectedSequence(ref, 0, 0, comparison), '');
});
test('partially selected ambiguous runs use the corresponding sample bases', () => {
  const comparison = compareAligned('AAAAAA', { sequence: 'ANRYTA' });
  assert.equal(selectedSequence('AAAAAA', 2, 4, comparison), 'RY');
});
test('FASTA comparisons reconstruct the original sample, including trimmed padding', () => {
  for (const [reference, sample] of [
    ['AAACGTCC', 'NNACGATNN'],
    ['ACGTACGT', 'NTGTACNN'],
    ['ACGTACGT', 'ACGACGT'],
    ['ACGT', 'NNNN'],
  ]) assert.equal(selectedSequence(reference, 0, reference.length, alignTerminalPadding(reference, sample)), sample);
});
