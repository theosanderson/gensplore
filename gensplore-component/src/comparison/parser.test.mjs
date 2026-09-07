import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { genbankToJson } from '@teselagen/bio-parsers';
import { featureLocations } from './rowGeometry.mjs';

test('the current parser preserves joined reverse and circular feature coordinates', async () => {
  const text = `LOCUS       Synthetic                 30 bp    DNA     circular SYN 01-JAN-2026
DEFINITION  Synthetic coordinate test.
FEATURES             Location/Qualifiers
     CDS             complement(join(2..4,8..10))
                     /gene="joined"
     CDS             join(25..30,1..6)
                     /gene="wrapped"
ORIGIN
        1 aaaaaaaaaa aaaaaaaaaa aaaaaaaaaa
//
`;
  const { parsedSequence } = (await genbankToJson(text))[0];
  const [joined, wrapped] = parsedSequence.features;
  assert.equal(joined.strand, -1);
  assert.deepEqual(featureLocations(joined, 30), [{ start: 1, end: 3 }, { start: 7, end: 9 }]);
  assert.deepEqual(featureLocations(wrapped, 30), [{ start: 24, end: 29 }, { start: 0, end: 5 }]);
});

test('the phage fixture retains its annotations across the parser migration', async () => {
  const reference = await readFile(new URL('../../../website/public/phix174.gb', import.meta.url), 'utf8');
  const { parsedSequence } = (await genbankToJson(reference))[0];
  assert.equal(parsedSequence.sequence.length, 5386);
  assert.equal(parsedSequence.features.length, 32);
  const wrapped = parsedSequence.features.find(feature => feature.type === 'CDS' && feature.start === 3980);
  assert.deepEqual(featureLocations(wrapped, 5386), [{ start: 3980, end: 5385 }, { start: 0, end: 135 }]);
});
