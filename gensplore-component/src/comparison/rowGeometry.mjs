// GenBank locations include both endpoints; display rows exclude rowEnd.
export function featureLocations(feature, sequenceLength) {
  if (feature.locations?.length) return feature.locations;
  return feature.start > feature.end
    ? [{ start: feature.start, end: sequenceLength - 1 }, { start: 0, end: feature.end }]
    : [{ start: feature.start, end: feature.end }];
}

export function clipFeatureLocations(locations, rowStart, rowEnd) {
  return locations.filter(location => location.start < rowEnd && location.end >= rowStart).map(location => ({
    start: Math.max(location.start, rowStart) - rowStart,
    end: Math.min(location.end, rowEnd - 1) - rowStart,
    startIsActual: location.start >= rowStart,
    endIsActual: location.end < rowEnd,
  }));
}

// Insertions belong to the row containing the boundary, not necessarily the
// middle of the adjacent codon. At a feature end, keep the label with its ribbon.
export function proteinChangeRowPosition(change, locations, sequenceLength) {
  if (change.type !== 'Insertion' || change.pointerPosition === undefined) return change.anchor;
  let position = Math.min(sequenceLength - 1, Math.max(0, Math.floor(change.pointerPosition + 0.5)));
  const contains = p => locations.some(location => p >= location.start && p <= location.end);
  if (!contains(position) && contains(position - 1)) position--;
  return position;
}
