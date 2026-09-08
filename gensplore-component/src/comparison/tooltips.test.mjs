import test from 'node:test';
import assert from 'node:assert/strict';
import { changeTooltip, letterTooltip } from './tooltips.mjs';

const gap = { type: 'Ambiguous', start: 2, end: 8, reference: 'AAAAAA', alternative: 'NNNNNN' };
test('coverage gap tooltips explain uncertainty without printing sequences', () => {
  assert.equal(changeTooltip(gap), 'No confident call · reference positions 3–8');
  assert.equal(changeTooltip(gap, 'gene'), 'Amino acid unresolved because of ambiguous nucleotide calls · gene · reference residues 3–8');
  const text = letterTooltip({ letter: 'A', position: 3, changes: [gap] });
  assert.match(text, /Reference A · position 4/);
  assert.match(text, /No confident call/);
  assert(!text.includes('NNNNNN'));
});
test('reference and sample letters are distinct on both strands', () => {
  const change = { type: 'Substitution', start: 2, end: 3, reference: 'A', alternative: 'G' };
  assert.equal(changeTooltip(change), 'Reference A → sample G · reference position 3');
  assert.equal(letterTooltip({ letter: 'T', position: 2, changes: [change], reverseComplement: true, complement: () => 'C' }), 'Reference T → sample C · position 3 · reverse complement');
  assert.equal(letterTooltip({ letter: 'K', position: 4, changes: [], gene: 'gene' }), 'gene · Reference K · residue 5');
});
test('indels describe reference coordinates and bound inserted text', () => {
  assert.equal(changeTooltip({ ...gap, type: 'Deletion' }), 'Deleted in this sequence · reference positions 3–8');
  assert.equal(changeTooltip({ type: 'Insertion', start: 0, end: 0, alternative: 'GAC' }), 'Inserted after reference position 0 · GAC');
  const text = changeTooltip({ type: 'Insertion', start: 4, end: 4, alternative: 'A'.repeat(200) }, 'gene');
  assert.match(text, /after reference residue 4 · gene/);
  assert.match(text, /200 letters/);
  assert(text.length < 120);
});
test('downstream reference amino acids are not presented as confident sample calls after frameshifts', () => {
  const text = letterTooltip({ letter: 'K', position: 5, changes: [{ type: 'Frameshift', start: 2, end: 3 }], gene: 'gene' });
  assert.match(text, /sample amino acid is uncertain/);
});
