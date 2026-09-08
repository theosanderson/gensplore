import test from 'node:test';
import assert from 'node:assert/strict';
import { compareAligned } from './aligned.mjs';

test('preserves supplied gaps, ambiguous stretches and multi-base insertions', () => {
  const result = compareAligned('ACGTACGT', { name: 'synthetic', sequence: 'AT--NNGT', insertions: [{ position: 0, sequence: 'GAC' }, { position: 8, sequence: 'T' }] });
  assert.equal(result.name, 'synthetic');
  assert.deepEqual(result.differences.map(d => [d.type, d.start, d.end, d.alternative]), [['Insertion', 0, 0, 'GAC'], ['Substitution', 1, 2, 'T'], ['Deletion', 2, 4, ''], ['Ambiguous', 4, 6, 'NN'], ['Insertion', 8, 8, 'T']]);
});
test('does not impose the FASTA edit limit or realign repeats', () => {
  const result = compareAligned('A'.repeat(500), { name: 'masked', sequence: 'A' + 'N'.repeat(300) + 'A'.repeat(198) + '-' });
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

test('consecutive uncovered amino acids form one coverage gap on either strand', async () => {
  const { compareProtein } = await import('./proteins.mjs');
  const reference = 'ATGAAAGGGCCCTAA';
  const { differences } = compareAligned(reference, { sequence: 'ATGNNNNNNNNNTAA' });
  for (const strand of [1, -1]) {
    const result = compareProtein(reference, { type: 'CDS', start: 0, end: 14, strand }, differences);
    assert.equal(result.warning, undefined);
    assert.equal(result.changes.length, 1);
    assert.equal(result.changes[0].type, 'Ambiguous');
    assert.equal(result.changes[0].start, 1);
    assert.equal(result.changes[0].end, 4);
    assert.equal(result.changes[0].alternative, 'XXX');
  }
});


test('pre-aligned terminal Ns bypass the AA limit and preserve covered coordinates', async () => {
  const { compareProtein } = await import('./proteins.mjs');
  const reference = 'GCT'.repeat(300) + 'ATGGCTTAA' + 'GCT'.repeat(300);
  const result = compareAligned(reference, { sequence: 'N'.repeat(900) + 'ATGGTTTAA' + 'N'.repeat(900) });
  assert.deepEqual(result.coverage, { start: 900, end: 909 });
  assert.equal(result.distance, 1);
  assert.equal(result.differences[0].start, 904);
  for (const strand of [1, -1]) {
    const protein = compareProtein(reference, { type: 'CDS', start: 0, end: reference.length - 1, strand }, result.differences, result.coverage);
    assert.equal(protein.warning, undefined);
    assert.equal(protein.changes.length, 1);
    assert.equal(protein.changes[0].anchor, 904);
  }
});
test('pre-aligned all-N samples report no coverage', () => {
  const result = compareAligned('ACGT', { sequence: 'NNNN' });
  assert.deepEqual(result.coverage, { start: 0, end: 0 });
  assert.deepEqual(result.differences, []);
});
