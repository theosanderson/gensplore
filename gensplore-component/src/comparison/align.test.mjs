import test from 'node:test';
import assert from 'node:assert/strict';
import { align, alignTerminalPadding, parseFasta } from './align.mjs';

test('FASTA validation and normalization', () => {
  assert.deepEqual(parseFasta('>synthetic phage test\nacgt n\r\n'), { name: 'synthetic phage test', sequence: 'ACGTN' });
  for (const bad of ['', 'ACGT', '>a\n', '>a\nAC-G', '>a\nACGT\n>b\nACGT']) assert.throws(() => parseFasta(bad));
});
test('identical sequence and substitution coordinates', () => {
  assert.deepEqual(align('ACGT', 'ACGT').differences, []);
  assert.deepEqual(align('ACGT', 'ATGT').differences, [{ type: 'Substitution', start: 1, end: 2, reference: 'C', alternative: 'T' }]);
});
test('insertions and deletions at both ends and internally', () => {
  for (const [ref, alt, type, start, end, bases] of [
    ['ACGT', 'TTACGT', 'Insertion', 0, 0, 'TT'],
    ['ACGT', 'ACGTAA', 'Insertion', 4, 4, 'AA'],
    ['ACGT', 'ACTTGT', 'Insertion', 2, 2, 'TT'],
    ['TTACGT', 'ACGT', 'Deletion', 0, 2, 'TT'],
    ['ACGTAA', 'ACGT', 'Deletion', 4, 6, 'AA'],
  ]) {
    const d = align(ref, alt).differences;
    assert.deepEqual(d, [{ type, start, end, reference: type === 'Deletion' ? bases : '', alternative: type === 'Insertion' ? bases : '' }]);
  }
});
test('ambiguity is not labelled substitution', () => {
  assert.equal(align('ACGT', 'ANGT').differences[0].type, 'Ambiguous');
});
test('limits fail explicitly', () => {
  assert.throws(() => align('A', 'AAAA', 2), /limit/);
  assert.throws(() => align('AAA', 'TTT', 2), /limit/);
  assert.throws(() => align('A'.repeat(100001), 'A'), /100,000/);
  assert.throws(() => align('', 'A'), /contain/);
});
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] !== b[j - 1]));
    row = next;
  }
  return row[b.length];
}
test('banded alignment agrees with full dynamic programming and reconstructs alternatives', () => {
  let seed = 42;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const sequence = () => Array.from({ length: 1 + random(20) }, () => 'ACGT'[random(4)]).join('');
  for (let trial = 0; trial < 500; trial++) {
    const a = sequence(), b = sequence(), expected = distance(a, b), limit = 8;
    if (expected > limit) { assert.throws(() => align(a, b, limit)); continue; }
    const result = align(a, b, limit);
    assert.equal(result.distance, expected);
    let rebuilt = '', position = 0;
    for (const d of result.differences) {
      rebuilt += a.slice(position, d.start) + d.alternative;
      position = d.end;
    }
    assert.equal(rebuilt + a.slice(position), b);
  }
});

test('bundled phiX174 FASTA matches its GenBank reference', async () => {
  const { readFile } = await import('node:fs/promises');
  const gb = await readFile(new URL('../../../website/public/phix174.gb', import.meta.url), 'utf8');
  const fasta = await readFile(new URL('../../../website/public/phix174.fasta', import.meta.url), 'utf8');
  const reference = gb.split('ORIGIN')[1].split('//')[0].replace(/[^a-z]/gi, '').toUpperCase();
  const record = parseFasta(fasta);
  assert.equal(reference.length, 5386);
  assert.equal(record.sequence, reference);
  assert.deepEqual(align(reference, record.sequence), { distance: 0, differences: [] });
});

test('equally optimal alignments prefer contiguous insertions and deletions', () => {
  const reference = 'ATGAGGCGT';
  const alternative = 'ATGAGGACGCGT';
  for (const [a, b, type] of [[reference, alternative, 'Insertion'], [alternative, reference, 'Deletion']]) {
    const result = align(a, b);
    assert.equal(result.distance, 3);
    assert.equal(result.differences.length, 1);
    assert.equal(result.differences[0].type, type);
  }
});
test('distinct insertions separated by matching sequence remain distinct', () => {
  const result = align('ACGTACGTACGT', 'ACGATACGTACGAT');
  assert.equal(result.distance, 2);
  assert.equal(result.differences.length, 2);
  assert.ok(result.differences.every(d => d.type === 'Insertion'));
});


test('terminal N padding does not consume the edit budget or shift coordinates', () => {
  const ref = 'A'.repeat(400) + 'CGTA' + 'C'.repeat(400);
  const alt = 'N'.repeat(400) + 'CTTA' + 'N'.repeat(400);
  const result = alignTerminalPadding(ref, alt);
  assert.equal(result.distance, 1);
  assert.deepEqual(result.coverage, { start: 400, end: 404 });
  assert.deepEqual(result.differences, [{ type: 'Substitution', start: 401, end: 402, reference: 'G', alternative: 'T' }]);
});
test('padding supports covered indels and preserves insertion coordinates', () => {
  const result = alignTerminalPadding('AAACGTCC', 'NNACGATNN');
  assert.deepEqual(result.differences, [{ type: 'Insertion', start: 5, end: 5, reference: '', alternative: 'A' }]);
  assert.deepEqual(result.coverage, { start: 2, end: 6 });
});
test('internal Ns and real divergence still consume the edit budget', () => {
  assert.throws(() => alignTerminalPadding('A'.repeat(302), 'A' + 'N'.repeat(300) + 'A'), /limit/);
  assert.throws(() => alignTerminalPadding('A'.repeat(302), 'N' + 'C'.repeat(300) + 'N'), /limit/);
  assert.deepEqual(alignTerminalPadding('ACGT', 'ANGT').differences, align('ACGT', 'ANGT').differences);
});
test('all-N input has no coverage; validation runs before trimming', () => {
  assert.deepEqual(alignTerminalPadding('ACGT', 'NNNN'), { distance: 0, differences: [], coverage: { start: 0, end: 0 } });
  assert.throws(() => alignTerminalPadding('A', ''), /contain/);
  assert.throws(() => alignTerminalPadding('A', 'N'.repeat(100001)), /100,000/);
  assert.throws(() => alignTerminalPadding('AC', 'NNNC'), /no comparable/);
});


test('default DNA limit accepts 256 edits and rejects 257, including padded input', () => {
  for (const compare of [align, alignTerminalPadding]) {
    assert.equal(compare('A'.repeat(256), 'C'.repeat(256)).distance, 256);
    assert.throws(() => compare('A'.repeat(257), 'C'.repeat(257)), /256-edit/);
  }
  assert.equal(alignTerminalPadding('G' + 'A'.repeat(256) + 'G', 'N' + 'C'.repeat(256) + 'N').distance, 256);
});
