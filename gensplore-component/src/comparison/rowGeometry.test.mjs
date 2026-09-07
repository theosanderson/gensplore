import test from 'node:test';
import assert from 'node:assert/strict';
import { featureLocations, clipFeatureLocations, proteinChangeRowPosition } from './rowGeometry.mjs';

test('a feature starting at the next row does not leak into the current row', () => {
  assert.deepEqual(clipFeatureLocations([{ start: 100, end: 120 }], 0, 100), []);
});
test('row clipping preserves exactly one copy of every annotated base', () => {
  const locations = [{ start: 98, end: 101 }];
  assert.deepEqual(clipFeatureLocations(locations, 0, 100), [{ start: 98, end: 99, startIsActual: true, endIsActual: false }]);
  assert.deepEqual(clipFeatureLocations(locations, 100, 200), [{ start: 0, end: 1, startIsActual: false, endIsActual: true }]);
});
test('a feature ending on a row edge retains its terminal arrow only on that row', () => {
  const locations = [{ start: 90, end: 99 }];
  assert.equal(clipFeatureLocations(locations, 0, 100)[0].endIsActual, true);
  assert.deepEqual(clipFeatureLocations(locations, 100, 200), []);
});
test('joined locations cannot create an extra block at rowEnd', () => {
  assert.equal(clipFeatureLocations([{ start: 10, end: 20 }, { start: 100, end: 120 }], 0, 100).length, 1);
});
test('origin-spanning annotations split into valid segments', () => {
  const locations = featureLocations({ start: 95, end: 4 }, 100);
  assert.deepEqual(locations, [{ start: 95, end: 99 }, { start: 0, end: 4 }]);
  assert.deepEqual(clipFeatureLocations(locations, 0, 50), [{ start: 0, end: 4, startIsActual: true, endIsActual: true }]);
});
test('AA insertion uses its boundary row when the next codon straddles the wrap', () => {
  const change = { type: 'Insertion', anchor: 100, pointerPosition: 98.5 };
  assert.equal(proteinChangeRowPosition(change, [{ start: 0, end: 199 }], 200), 99);
});
test('exact row-boundary insertions belong to the next row once', () => {
  assert.equal(proteinChangeRowPosition({ type: 'Insertion', anchor: 101, pointerPosition: 99.5 }, [{ start: 0, end: 199 }], 200), 100);
});
test('terminal and reverse-strand boundaries stay with the annotated ribbon', () => {
  const change = { type: 'Insertion', anchor: 98, pointerPosition: 99.5 };
  assert.equal(proteinChangeRowPosition(change, [{ start: 0, end: 99 }], 200), 99);
  assert.equal(proteinChangeRowPosition({ ...change, pointerPosition: 199.5 }, [{ start: 0, end: 199 }], 200), 199);
  assert.equal(proteinChangeRowPosition({ ...change, pointerPosition: -0.5 }, [{ start: 0, end: 199 }], 200), 0);
});
