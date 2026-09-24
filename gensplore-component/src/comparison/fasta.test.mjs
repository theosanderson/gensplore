import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFasta } from './fasta.mjs';

test('FASTA validation and normalization', () => {
  assert.deepEqual(parseFasta('>synthetic phage test\nacgt n\r\n'), { name: 'synthetic phage test', sequence: 'ACGTN', aligned: null });
  for (const bad of ['', 'ACGT', '>a\n', '>a\n---', '>a\nACGT\n>b\nACGT']) assert.throws(() => parseFasta(bad));
});
test('gapped FASTA reports both the ungapped bases and the supplied alignment', () => {
  // Aligner output (Nextclade writes deletions as - and unsequenced ends as N).
  assert.deepEqual(parseFasta('>aligned\nAC--gT\n'), { name: 'aligned', sequence: 'ACGT', aligned: 'AC--GT' });
  assert.deepEqual(parseFasta('>dots\nAC..GT\n').aligned, 'AC--GT');
});
test('bundled phiX174 FASTA matches its GenBank reference', async () => {
  const { readFile } = await import('node:fs/promises');
  const gb = await readFile(new URL('../../../website/public/phix174.gb', import.meta.url), 'utf8');
  const fasta = await readFile(new URL('../../../website/public/phix174.fasta', import.meta.url), 'utf8');
  const reference = gb.split('ORIGIN')[1].split('//')[0].replace(/[^a-z]/gi, '').toUpperCase();
  const record = parseFasta(fasta);
  assert.equal(reference.length, 5386);
  assert.equal(record.sequence, reference);
});
