import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonForDisplay } from './coverage.mjs';
import { compareAligned } from './aligned.mjs';
import { alignTerminalPadding } from './align.mjs';
import { compareProteins } from './proteins.mjs';
import { selectedSequence } from './selection.mjs';

const feature = (reference, strand = 1) => ({ type: 'CDS', start: 0, end: reference.length - 1, strand });
const compare = (reference, sequence, features, aligned) => {
  const result = aligned ? compareAligned(reference, { sequence }) : alignTerminalPadding(reference, sequence);
  return { ...result, proteins: compareProteins(reference, features, result.differences, result.coverage) };
};

test('long trimmed ends remain visible on DNA and AA tracks without using the budget', () => {
  const reference = 'GCT'.repeat(300) + 'ATGGCTTAA' + 'GCT'.repeat(300);
  const sample = 'N'.repeat(900) + 'ATGGTTTAA' + 'N'.repeat(900);
  for (const aligned of [false, true]) {
    const result = compare(reference, sample, [feature(reference, 1), feature(reference, -1)], aligned);
    const snapshot = structuredClone(result);
    const display = comparisonForDisplay(reference, result);
    assert.equal(display.distance, 1);
    assert.deepEqual(display.differences.map(d => [d.type, d.start, d.end]), [
      ['Ambiguous', 0, 900], ['Substitution', 904, 905], ['Ambiguous', 909, 1809],
    ]);
    for (const protein of display.proteins) {
      assert.equal(protein.warning, undefined);
      assert.equal(protein.changes.filter(d => d.type === 'Substitution').length, 1);
      assert.deepEqual(protein.changes.filter(d => d.type === 'Ambiguous').map(d => [d.start, d.end]), [[0, 300], [303, 603]]);
      for (const gap of protein.changes.filter(d => d.type === 'Ambiguous')) {
        assert.equal(gap.anchor, protein.codons[gap.start].positions[1]);
      }
    }
    assert.deepEqual(result, snapshot);
    assert.equal(selectedSequence(reference, 0, reference.length, result), sample);
  }
});
test('all-N samples show the whole reference as uncovered', () => {
  const reference = 'ATGGCTTAA';
  const result = compare(reference, 'N'.repeat(reference.length), [feature(reference)], true);
  const display = comparisonForDisplay(reference, result);
  assert.equal(result.differences.length, 0);
  assert.equal(display.differences.length, 1);
  assert.deepEqual([display.differences[0].start, display.differences[0].end], [0, 9]);
  assert.deepEqual(display.proteins[0].changes.map(d => [d.type, d.start, d.end]), [['Ambiguous', 0, 3]]);
});
test('partial terminal codons are shown as unresolved on both strands', () => {
  const reference = 'ATGGCTTAA';
  const result = compare(reference, 'NTGGCTTAN', [feature(reference, 1), feature(reference, -1)], true);
  for (const protein of comparisonForDisplay(reference, result).proteins) {
    assert.deepEqual(protein.changes.map(d => [d.type, d.start, d.end]), [['Ambiguous', 0, 1], ['Ambiguous', 2, 3]]);
  }
});
test('joined features retain existing ambiguous markers without duplication', () => {
  const reference = 'GCTTAACCCATG';
  const features = [{ ...feature(reference), locations: [{ start: 9, end: 11 }, { start: 0, end: 5 }] }];
  const result = compare(reference, 'NNNTAACCCATG', features, true);
  const display = comparisonForDisplay(reference, result);
  assert.equal(display.proteins[0].changes.length, 1);
  assert.deepEqual([display.proteins[0].changes[0].start, display.proteins[0].changes[0].end], [1, 2]);
});
test('coverage remains visible when a protein alignment exceeds its limit', () => {
  const reference = 'GCT'.repeat(260);
  const result = compare(reference, 'NNN' + 'GTT'.repeat(258) + 'NNN', [feature(reference)], true);
  const display = comparisonForDisplay(reference, result);
  assert.match(display.proteins[0].warning, /alignment limit/);
  assert.deepEqual(display.proteins[0].changes.map(d => [d.start, d.end]), [[0, 1], [259, 260]]);
});
test('reference-only mode remains unchanged', () => {
  assert.equal(comparisonForDisplay('ACGT', null), null);
});
