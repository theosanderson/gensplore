import test from 'node:test';
import assert from 'node:assert/strict';
import { align } from './align.mjs';
import { compareProtein } from './proteins.mjs';
const feature = (sequence, extra = {}) => ({ type: 'CDS', name: 'Synthetic coding feature', start: 0, end: sequence.length - 1, strand: 1, ...extra });
const compare = (reference, alternative, extra = {}) => compareProtein(reference, feature(reference, extra), align(reference, alternative).differences);

test('synonymous changes do not produce amino-acid markers', () => {
  assert.deepEqual(compare('ATGGCTTAA', 'ATGGCCTAA').changes, []);
});
test('amino-acid substitutions include reference residue and genome anchor', () => {
  const result = compare('ATGGCTTAA', 'ATGGTTTAA');
  assert.deepEqual(result.changes, [{ type: 'Substitution', start: 1, end: 2, reference: 'A', alternative: 'V', anchor: 4, aaPosition: 2 }]);
});
test('multiple changes in one codon are translated together', () => {
  const result = compare('ATGGCTTAA', 'ATGTATTAA');
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].alternative, 'Y');
});
test('in-frame insertion and deletion are single amino-acid events', () => {
  const ref = 'ATGGCTGAATAA', alt = 'ATGGCTGACGAATAA';
  const inserted = compare(ref, alt).changes;
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].type, 'Insertion');
  assert.equal(inserted[0].alternative, 'D');
  assert.equal(inserted[0].aaPosition, 2);
  const deleted = compare(alt, ref).changes;
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].type, 'Deletion');
  assert.equal(deleted[0].reference, 'D');
});
test('reverse strand changes use coding direction and correct reference coordinate', () => {
  const result = compare('TTAAGCCAT', 'TTAACCCAT', { strand: -1 });
  assert.equal(result.changes[0].reference, 'A');
  assert.equal(result.changes[0].alternative, 'G');
  assert.equal(result.changes[0].anchor, 4);
});
test('joined and origin-spanning locations retain coding order', () => {
  const ref = 'GCTTAACCCATG', alt = 'GTTTAACCCATG';
  const result = compare(ref, alt, { start: 9, end: 5, locations: [{start: 9,end: 11},{start: 0,end: 5}] });
  assert.equal(result.codons.map(c => c.aminoAcid).join(''), 'MA*');
  assert.equal(result.changes[0].aaPosition, 2);
  assert.equal(result.changes[0].anchor, 1);
});
test('codon_start offsets and translation-table limits are respected', () => {
  assert.equal(compare('AATGGCTTAA', 'AATGGTTTAA', {notes: {codon_start: [2], transl_table: [11]}}).changes[0].aaPosition, 2);
  assert.match(compare('ATGGCTTAA', 'ATGGTTTAA', {notes: {transl_table: [4]}}).warning, /unavailable/);
});
test('frameshifts are explicit and do not generate misleading downstream substitutions', () => {
  const result = compare('ATGGCTGAATAA', 'ATGGACTGAATAA');
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].type, 'Frameshift');
  assert.equal(result.changes[0].aaPosition, 2);
});
test('coding-boundary insertions are marked uncertain', () => {
  const result = compare('ATGGCTTAA', 'CATGGCTTAA');
  assert.match(result.warning, /boundary/);
  assert.deepEqual(result.changes, []);
});

test('insertion pointers sit between reference codons', () => {
  const result = compare('ATGGCTGAATAA', 'ATGGCTGACGAATAA');
  assert.equal(result.changes[0].pointerPosition, 5.5);
});
test('stop and ambiguous codons remain explicit', () => {
  const stop = compare('ATGTGGGCT', 'ATGTGAGCT');
  assert.equal(stop.changes[0].alternative, '*');
  const ambiguous = compare('ATGGCTTAA', 'ATGNNNTAA');
  assert.equal(ambiguous.changes[0].type, 'Ambiguous');
  assert.equal(ambiguous.changes[0].alternative, 'X');
});
