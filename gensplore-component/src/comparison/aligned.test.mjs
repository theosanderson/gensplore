import test from 'node:test';
import assert from 'node:assert/strict';
import { compareAligned } from './aligned.mjs';

test('preserves supplied gaps, ambiguous stretches and multi-base insertions', () => {
  const result = compareAligned('ACGTACGT', { name: 'synthetic', sequence: 'AT--NNGT', insertions: [{ position: 0, sequence: 'GAC' }, { position: 8, sequence: 'T' }] });
  assert.equal(result.name, 'synthetic');
  assert.deepEqual(result.differences.map(d => [d.type, d.start, d.end, d.alternative]), [['Insertion', 0, 0, 'GAC'], ['Substitution', 1, 2, 'T'], ['Deletion', 2, 4, ''], ['Ambiguous', 4, 6, 'NN'], ['Insertion', 8, 8, 'T']]);
});
test('does not impose the FASTA edit limit or realign repeats', () => {
  const result = compareAligned('A'.repeat(500), { name: 'masked', sequence: 'N'.repeat(300) + 'A'.repeat(199) + '-' });
  assert.equal(result.distance, 301);
  assert.equal(result.differences.length, 2);
  assert.equal(result.differences[1].start, 499);
});
test('rejects mismatched references, invalid bases and ambiguous insertion coordinates', () => {
  for (const input of [{ sequence: 'A' }, { sequence: 'A?' }, { sequence: 'AA', insertions: [{ position: 3, sequence: 'G' }] }, { sequence: 'AA', insertions: [{ position: 1, sequence: '-' }] }, { sequence: 'AA', insertions: [{ position: 1, sequence: 'G' }, { position: 1, sequence: 'T' }] }]) assert.throws(() => compareAligned('AA', input));
});

test('ambiguous stretches replace each coding base without changing coding length', async () => {
  const { compareProtein } = await import('./proteins.mjs');
  const reference = 'ATGAAAGGG';
  const { differences } = compareAligned(reference, { name: 'synthetic', sequence: 'ATGNNNGGG' });
  for (const strand of [1, -1]) {
    const result = compareProtein(reference, { type: 'CDS', start: 0, end: 8, strand }, differences);
    assert.equal(result.warning, undefined);
    assert.equal(result.changes.length, 1);
    assert.equal(result.changes[0].type, 'Ambiguous');
    assert.equal(result.changes[0].alternative, 'X');
  }
});
