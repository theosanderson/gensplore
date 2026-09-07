import ColorHash from "color-hash";
import { featureLocations, clipFeatureLocations, proteinChangeRowPosition } from "../comparison/rowGeometry.mjs";
import { getReverseComplement, filterFeatures } from "../utils";
import getColor from "../utils/getColor";
import codonToAminoAcid from "../utils/codonMapping";
import { toast } from "react-toastify/unstyled";
import "@fontsource/open-sans/latin-400.css";
import "@fontsource/open-sans-condensed/latin-300.css";

const SHARP_POINT_OFFSET = 6;
const BLUNT_POINT_OFFSET = 1;

var colorHash = new ColorHash({ lightness: [0.75, 0.9, 0.7, 0.8] });

function assignFeatureLanes(featureBlocks) {
  // Sort by .start ascending
  const sorted = featureBlocks.slice().sort((a, b) => a.start - b.start);

  const lanes = [];
  sorted.forEach((feature) => {
    let placed = false;
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
      let overlap = false;
      for (const otherFeature of lanes[laneIndex]) {
        if (
          feature.start <= otherFeature.end &&
          feature.end >= otherFeature.start
        ) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        lanes[laneIndex].push(feature);
        feature.lane = laneIndex;
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([feature]);
      feature.lane = lanes.length - 1;
    }
  });

  return lanes.length;
}

/**
 * Helper to detect bounding-box overlap in 2D.
 * Assumes boxes are {left, top, right, bottom}.
 */
function boxesOverlap(a, b) {
  return !(a.left > b.right || a.right < b.left || a.top > b.bottom || a.bottom < b.top);
}

/**
 * Attempt to place a label so it doesn't overlap previously placed labels
 * and doesn't go outside of the feature's horizontal range.
 *
 * @param {number} desiredX - The initial x position to try
 * @param {number} y        - The y position (top)
 * @param {string} text     - The label string
 * @param {Array} usedBoxes - List of {left,top,right,bottom} boxes already in use
 * @param {number} maxTries - Number of times to nudge to the right before giving up
 * @param {number} featureX - Left boundary of the feature
 * @param {number} featureWidth - The feature's total width
 * @return {{x:number} | null} The placed coordinate or null if no fit
 */
function placeLabel(desiredX, y, text, usedBoxes, maxTries, featureX, featureWidth) {
  const avgCharWidth = 6;  // Tweak as needed
  const labelWidth = text.length * avgCharWidth +10;
  const labelHeight = 10; // Rough line height

  // The label must fit within the feature: from featureX to (featureX + featureWidth - labelWidth).
  const minX = featureX;
  const maxX = featureX + featureWidth ;

  // If the feature is too short to fit the label at all, just give up.
  if (maxX < minX) {
    return null;
  }

  // Clamp initial X to [minX, maxX].
  //let newX = Math.max(minX, Math.min(desiredX, maxX));
  let newX = desiredX == 0 ? desiredX -5 : desiredX;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const box = {
      left: newX,
      top: y,
      right: newX + labelWidth,
      bottom: y + labelHeight,
    };

    const overlap = usedBoxes.some((b) => boxesOverlap(box, b));
    if (!overlap) {
      // Found a free spot within the feature bounds
      usedBoxes.push(box);
      return { x: newX };
    }

    // Nudge to the right
    newX += 10;
    // If newX extends beyond the feature boundary, stop and fail.
    if (newX > maxX) {
      break;
    }
  }
  // If we get here, no suitable position was found
  return null;
}

const SingleRow = ({
  parsedSequence,
  rowStart,
  rowEnd,
  setHoveredInfo,
  rowId,
  intSearchInput,
  annotSearchInput,
  zoomLevel,
  whereMouseWentDown,
  setWhereMouseWentDown,
  whereMouseWentUp,
  setWhereMouseWentUp,
  whereMouseCurrentlyIs,
  setWhereMouseCurrentlyIs,
  sequenceHits,
  curSeqHitIndex,
  enableRC,
  visibleFeatures,
  differences = [],
  proteins,
}) => {
  const zoomFactor = 2 ** zoomLevel;
  const sep = 10 * zoomFactor;
  const fullSequence = parsedSequence.sequence;
  const rowSequence = fullSequence.slice(rowStart, rowEnd);

  // Filter relevant features
  const relevantFeatures = visibleFeatures.filter(feature =>
    featureLocations(feature, fullSequence.length)
      .some(location => location.start < rowEnd && location.end >= rowStart)
  );

  const searchFeatures = !annotSearchInput
    ? []
    : filterFeatures(relevantFeatures, annotSearchInput);

  const isSelected =
    (intSearchInput >= rowStart && intSearchInput <= rowEnd) ||
    searchFeatures.length > 0;

  // Build feature objects
  const featureBlocks = relevantFeatures.map((feature, i) => {
    const protein = proteins?.[parsedSequence.features.indexOf(feature)];

    const locations = featureLocations(feature, fullSequence.length);
    const blocks = clipFeatureLocations(locations, rowStart, rowEnd);

    // For translations
    const seqLength = locations.reduce(
      (acc, loc) => acc + loc.end - loc.start + 1,
      0
    );
    let codonMap = [];
    if (zoomLevel > -2 && (feature.type === "CDS" || feature.type === "mat_peptide")) {
      for (let j = rowStart; j < rowEnd; j++) {
        let positionSoFar = 0;
        for (let k = 0; k < locations.length; k++) {
          if (j >= locations[k].start && j <= locations[k].end) {
            const nucIndex = j;
            const codonIndexInitial = Math.floor(
              (j - (locations[k].start - positionSoFar)) / 3
            );
            const codonIndex =
              feature.strand > 0
                ? codonIndexInitial
                : seqLength / 3 - codonIndexInitial - 1;
            const frame = (j - (locations[k].start - positionSoFar)) % 3;
            if (frame !== 1) continue;

            const middleIndex = nucIndex;
            const middleChar = fullSequence.slice(middleIndex, middleIndex + 1);
            const firstIndex =
              nucIndex - locations[k].start > 0
                ? nucIndex - 1
                : locations[k - 1]?.end;
            const firstChar = fullSequence.slice(firstIndex, firstIndex + 1);

            const lastIndex =
              nucIndex < locations[k].end
                ? nucIndex + 1
                : locations[k + 1]?.start;
            const lastChar = fullSequence.slice(lastIndex, lastIndex + 1);

            const codonSeq = firstChar + middleChar + lastChar;
            const aminoAcid = codonToAminoAcid(
              feature.strand > 0
                ? codonSeq
                : getReverseComplement(codonSeq)
            );
            codonMap.push({
              first: firstIndex - rowStart,
              middle: nucIndex - rowStart,
              last: lastIndex - rowStart,
              aminoAcid,
              codonIndex,
              gene: feature.name,
            });
          }
          positionSoFar += locations[k].end - locations[k].start + 1;
        }
      }
    }

    if (protein?.codons.length) {
      codonMap = protein.codons.filter(codon => codon.positions[1] >= rowStart && codon.positions[1] < rowEnd).map(codon => ({
        first: codon.positions[0] - rowStart, middle: codon.positions[1] - rowStart,
        last: codon.positions[2] - rowStart, aminoAcid: codon.aminoAcid,
        codonIndex: codon.codonIndex, gene: feature.name,
      }));
    }

    return {
      start: Math.min(...blocks.map(block => block.start)),
      end: Math.max(...blocks.map(block => block.end)),
      proteinChanges: protein?.changes || [],
      blocks,
      name: feature.name,
      type: feature.type,
      notes: feature.notes,
      strand: feature.strand,
      locations,
      codonMap,
      lane: 0,
      key: i,
    };
  });

  // Assign lanes
  const laneCount = assignFeatureLanes(featureBlocks);

  // Dimensions
  const extraPadding = 25;
  const baseHeight = 70;
  const rowSpacing = 20;
  const width = rowSequence.length * sep;

  // Place change labels in separate lanes above the reference. Labels can be
  // wider than their nucleotide span, particularly when zoomed out.
  const rowDifferences = differences.filter(d => d.type === 'Insertion'
    ? d.start >= rowStart && (d.start < rowEnd || (d.start === rowEnd && rowEnd === fullSequence.length))
    : d.start < rowEnd && d.end > rowStart);
  const changeLaneEnds = [];
  const changeLabelWidth = Math.max(width, 120);
  const changeLabels = rowDifferences.map(d => {
    const start = Math.max(rowStart, d.start);
    const end = Math.min(rowEnd, d.end);
    const insertion = d.type === 'Insertion';
    const anchor = insertion
      ? (d.start - rowStart - 0.5) * sep
      : ((start + end - 1) / 2 - rowStart) * sep;
    const label = insertion ? `INS +${d.alternative}`
      : d.type === 'Deletion' ? `DEL ${d.reference}`
      : d.type === 'Ambiguous' ? `? ${d.reference} → ${d.alternative}`
      : `${d.reference} → ${d.alternative}`;
    const maxCharacters = Math.max(8, Math.floor((changeLabelWidth - 20) / 7));
    const displayLabel = label.length > maxCharacters ? `${label.slice(0, maxCharacters - 1)}…` : label;
    const labelWidth = Math.min(changeLabelWidth, displayLabel.length * 7 + 16);
    const left = Math.max(-sep / 2, Math.min(anchor - labelWidth / 2, changeLabelWidth - labelWidth));
    let lane = changeLaneEnds.findIndex(right => right + 8 <= left);
    if (lane === -1) lane = changeLaneEnds.length;
    changeLaneEnds[lane] = left + labelWidth;
    const color = insertion ? '#1d4ed8' : d.type === 'Deletion' ? '#b91c1c'
      : d.type === 'Ambiguous' ? '#6d28d9' : '#92400e';
    const background = insertion ? '#eff6ff' : d.type === 'Deletion' ? '#fef2f2'
      : d.type === 'Ambiguous' ? '#f5f3ff' : '#fffbeb';
    const position = insertion ? `after reference base ${d.start}`
      : `reference ${d.start + 1}${d.end > d.start + 1 ? `–${d.end}` : ''}`;
    const description = `${d.type} at ${position}: ${d.reference || '—'} → ${d.alternative || '—'}`;
    return { ...d, start, end, anchor, displayLabel, labelWidth, left, lane, color, background, description };
  });
  const changeTrackHeight = changeLabels.length ? 18 + changeLaneEnds.length * 28 : 0;
  let height = baseHeight + laneCount * rowSpacing + changeTrackHeight;

  // Reserve space above each AA ribbon independently. Features sharing a lane
  // also share label occupancy, preventing labels from colliding at their edges.
  const proteinLaneEnds = Array.from({ length: laneCount }, () => []);
  featureBlocks.forEach(feature => {
    feature.proteinLabels = feature.proteinChanges.filter(change => {
      const position = proteinChangeRowPosition(change, feature.locations, fullSequence.length);
      return position >= rowStart && position < rowEnd;
    })
      .sort((a, b) => a.anchor - b.anchor).map(change => {
        const residue = change.end > change.start + 1 ? `${change.start + 1}–${change.end}` : change.start + 1;
        const text = change.type === 'Insertion' ? `AA INS +${change.alternative} · after ${change.aaPosition}`
          : change.type === 'Deletion' ? `AA DEL ${change.reference} · ${residue}`
          : change.type === 'Frameshift' ? `Frame shift · AA ${change.aaPosition}`
          : `AA ${change.reference}${change.aaPosition} → ${change.alternative}`;
        const maxCharacters = Math.max(8, Math.floor((changeLabelWidth - 20) / 7));
        const label = text.length > maxCharacters ? `${text.slice(0, maxCharacters - 1)}…` : text;
        const labelWidth = Math.min(changeLabelWidth, label.length * 7 + 16);
        const anchor = ((change.pointerPosition ?? change.anchor) - rowStart) * sep;
        const left = Math.max(-sep / 2, Math.min(anchor - labelWidth / 2, changeLabelWidth - labelWidth));
        const ends = proteinLaneEnds[feature.lane];
        let lane = ends.findIndex(right => right + 8 <= left);
        if (lane === -1) lane = ends.length;
        ends[lane] = left + labelWidth;
        const color = change.type === 'Insertion' ? '#1d4ed8' : change.type === 'Deletion' ? '#b91c1c'
          : ['Frameshift', 'Ambiguous'].includes(change.type) ? '#6d28d9' : '#92400e';
        return { ...change, text, label, labelWidth, anchor, left, lane, color };
      });
  });
  const proteinLaneOffsets = [];
  let proteinTrackHeight = 0;
  proteinLaneEnds.forEach((ends, lane) => {
    proteinLaneOffsets[lane] = lane * rowSpacing + proteinTrackHeight;
    proteinTrackHeight += ends.length ? 12 + ends.length * 26 : 0;
  });
  height += proteinTrackHeight;

  // Ticks
  const spacing = rowStart > 10000 ? 60 : 40;
  const approxNumTicks = Math.ceil(width / spacing);
  let tickInterval = Math.ceil(rowSequence.length / approxNumTicks);
  const options = [
    5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000,
    200000, 500000, 1000000, 2000000, 5000000, 10000000,
  ];
  tickInterval = options.find((o) => o >= tickInterval) || tickInterval;
  const modulus = rowStart % tickInterval;
  const numTicks = Math.floor((rowEnd - rowStart) / tickInterval) + 1;
  const tickLabels = Array.from({ length: numTicks }, (_, i) => {
    return (i + 1) * tickInterval + rowStart - modulus - 1;
  });
  const ticks = tickLabels.map((label, i) => {
    const x = ((label - rowStart) / (rowEnd - rowStart)) * width;
    return (
      <g key={i}>
        <line x1={x} y1={0} x2={x} y2={10} stroke="black" />
        <text x={x} y={20} textAnchor="middle" fontSize="10">
          {label + 1}
        </text>
      </g>
    );
  });

  // Sequence
  let chars = null;
  let chars2 = null;
  if (zoomLevel > -1) {
    chars = rowSequence.split("").map((char, i) => {
      const x = i * sep;
      return (
        <text
          key={i}
          x={x}
          y={10}
          textAnchor="middle"
          fontSize={zoomLevel < -1 ? "11" : "12"}
          fontFamily={zoomLevel < -0.25 ? "Open Sans Condensed" : "sans-serif"}
          fontWeight={zoomLevel < -0.25 ? "600" : "400"}
          fillOpacity={0.9}
          onMouseEnter={() =>
            setHoveredInfo({
              label: `Nucleotide ${i + rowStart + 1}: ${char}`,
            })
          }
          onMouseLeave={() => setHoveredInfo(null)}
        >
          {char}
        </text>
      );
    });
  }

  const rc = { A: "T", T: "A", C: "G", G: "C", N: "N" };
  if (zoomLevel > -1) {
    chars2 = rowSequence.split("").map((char, i) => {
      const x = i * sep;
      return (
        <text
          key={i}
          x={x}
          y={10}
          textAnchor="middle"
          fontSize={zoomLevel < -1 ? "11" : "12"}
          fontFamily={zoomLevel < -0.25 ? "Open Sans Condensed" : "sans-serif"}
          fontWeight={zoomLevel < -0.25 ? "600" : "400"}
          fillOpacity={0.9}
          onMouseEnter={() =>
            setHoveredInfo({
              label: `Nucleotide ${i + rowStart + 1}: ${char}`,
            })
          }
          onMouseLeave={() => setHoveredInfo(null)}
        >
          {rc[char]}
        </text>
      );
    });
  }

  const codonZoomThreshold = -2;

  const handleFeatureClick = (feature) => {
    const minLoc = feature.locations
      .map((loc) => Math.min(loc.start, loc.end))
      .reduce((a, b) => Math.min(a, b));
    const maxLoc = feature.locations
      .map((loc) => Math.max(loc.start, loc.end))
      .reduce((a, b) => Math.max(a, b));
    setWhereMouseWentDown(minLoc);
    setWhereMouseWentUp(maxLoc + 1);
    if (feature.locations.length > 1) {
      toast.info(
        `This feature has multiple locations. The selection will be from the start of the first location to the end of the last location.`
      );
    }
  };

  // Keep track of used label boxes so we can shift/hide labels if needed
  const usedLabelBoxes = [];

  const featureBlocksSVG = featureBlocks.map((feature) => {
    // Feature's bounding box in the row
    const featureX = feature.start * sep;
    const featureWidth = (feature.end - feature.start) * sep;
    const aaLabelCount = proteinLaneEnds[feature.lane].length;
    const y = 7 + proteinLaneOffsets[feature.lane] + (aaLabelCount ? 12 + aaLabelCount * 26 : 0);

    const product = feature.notes?.product || "";
    let betterName = feature.type === "mat_peptide" ? product : feature.name;
    const altName = feature.type === "mat_peptide" ? feature.name : product;
    if (betterName === "Untitled Feature") betterName = feature.type;

    return (
      <g key={feature.key}>
        {/* AA changes belong to this ribbon, above its amino-acid sequence. */}
        {feature.proteinLabels.map((change, index) => <path key={`aa-pointer-${index}`}
          d={`M ${change.left + change.labelWidth / 2} ${y - 14 - change.lane * 26} L ${change.anchor} ${y - 7} L ${change.anchor} ${y + 3}`}
          fill="none" stroke={change.color} strokeWidth={1.25} />)}
        {feature.proteinLabels.map((change, index) => <g key={`aa-label-${index}`} role="img" aria-label={`${feature.name}: ${change.text}`}>
          <title>{feature.name}: {change.text}{change.type === 'Frameshift' ? '; downstream amino-acid correspondence is uncertain' : ''}</title>
          <rect x={change.left} y={y - 34 - change.lane * 26} width={change.labelWidth} height={20}
            rx={4} fill="white" stroke={change.color} />
          <text x={change.left + change.labelWidth / 2} y={y - 20 - change.lane * 26}
            textAnchor="middle" fontSize={12} fontFamily="monospace" fontWeight={600} fill={change.color}>{change.label}</text>
        </g>)}
        {/* Baseline from start to end */}
        <line
          x1={featureX + 2}
          y1={y + 5}
          x2={featureX + featureWidth - 2}
          y2={y + 5}
          stroke={getColor(feature, product)}
          strokeWidth={1.5}
        />

        {/* Sub-locations */}
        {feature.blocks.map((block, j) => {
          const blockX1 = block.start * sep - 5 * zoomFactor;
          const blockX2 = block.end * sep + 5 * zoomFactor;
          return (
            <path
              key={`block-${j}`}
              d={`${
                feature.strand < 0
                  ? // Reverse
                    `M ${blockX2} ${y}
                    ${
                      block.startIsActual
                        ? `L ${blockX1 + SHARP_POINT_OFFSET} ${y}
                           L ${blockX1} ${y + 5}
                           L ${blockX1 + SHARP_POINT_OFFSET} ${y + 10}`
                        : `L ${blockX1 + BLUNT_POINT_OFFSET} ${y}
                           L ${blockX1} ${y + 5}
                           L ${blockX1 + BLUNT_POINT_OFFSET} ${y + 10}`
                    }
                    L ${blockX2} ${y + 10}
                    L ${blockX2} ${y}
                    `
                  : // Forward
                    `M ${blockX1} ${y}
                    ${
                      block.endIsActual
                        ? `L ${blockX2 - SHARP_POINT_OFFSET} ${y}
                           L ${blockX2} ${y + 5}
                           L ${blockX2 - SHARP_POINT_OFFSET} ${y + 10}`
                        : `L ${blockX2 - BLUNT_POINT_OFFSET} ${y}
                           L ${blockX2} ${y + 5}
                           L ${blockX2 - BLUNT_POINT_OFFSET} ${y + 10}`
                    }
                    L ${blockX1} ${y + 10}
                    L ${blockX1} ${y}
                    `
              } Z`}
              fill={getColor(feature, product)}
              onClick={() => handleFeatureClick(feature)}
              onMouseEnter={() => {
                if (zoomLevel < codonZoomThreshold) {
                  setHoveredInfo({
                    label: `${feature.name}: ${feature.type}`,
                    product: altName,
                    locusTag: feature.notes?.locus_tag || null,
                  });
                }
              }}
              onMouseLeave={() => {
                if (zoomLevel < codonZoomThreshold) setHoveredInfo(null);
              }}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        {/* Attempt to place label within the feature's horizontal range */}
        {(() => {
          // Let’s say we *try* to place it near the left edge: x just before the feature’s line
          const desiredX = featureX ;
          const desiredY = y; 
          // We now call placeLabel with the feature boundary
          const placed = placeLabel(
            desiredX,
            desiredY,
            betterName,
            usedLabelBoxes,
            20,      // maxTries
            featureX,
            featureWidth
          );
          if (!placed) {
            // Could not place the label; skip it
            return null;
          }
          return (
            <text x={placed.x} y={desiredY} fontSize="10" textAnchor="left">
              {betterName}
            </text>
          );
        })()}

        {/* Codon-based amino acids */}
        {feature.codonMap.map((codon, j) => (
          <g key={j}>
            {zoomLevel > codonZoomThreshold && (
              <text
                x={codon.middle * sep}
                y={y + 9}
                textAnchor="middle"
                fontSize="10"
                onClick={() => handleFeatureClick(feature)}
                onMouseOver={() =>
                  setHoveredInfo({
                    label: `${betterName}: ${codon.aminoAcid}${codon.codonIndex + 1}`,
                    product: altName,
                    locusTag: feature.notes?.locus_tag || null,
                  })
                }
                onMouseLeave={() => setHoveredInfo(null)}
                fillOpacity={0.75}
                style={{ cursor: "pointer" }}
              >
                {codon.aminoAcid}
              </text>
            )}
            {codon.middle > 2 && zoomLevel > -0.5 && (
              <text
                x={codon.middle * sep}
                y={y - 1}
                textAnchor="middle"
                fontSize="7"
                fillOpacity={0.4}
              >
                {codon.codonIndex + 1}
              </text>
            )}
          </g>
        ))}

        {/* Match DNA strike colors on the reference amino-acid letters. */}
        {feature.codonMap.map(codon => {
          const change = feature.proteinChanges.find(change => ['Deletion', 'Substitution'].includes(change.type) && codon.codonIndex >= change.start && codon.codonIndex < change.end);
          if (!change) return null;
          return <line key={`aa-changed-${codon.codonIndex}`} x1={codon.middle * sep - 5} x2={codon.middle * sep + 5}
            y1={y + 5} y2={y + 5} stroke={change.type === 'Deletion' ? '#b91c1c' : '#92400e'} strokeWidth={1.7} pointerEvents="none" />;
        })}
        {/* (Optional) lines for codon boundaries */}
        {zoomLevel > -2 &&
          feature.codonMap.map((codon, j) => {
            const codonPad = 15 * zoomFactor;
            return (
              <g key={`codonline-${j}`}>
                {codon.middle > 1 && codon.middle < 3 && (
                  <line
                    x1={codon.middle * sep - codonPad}
                    y1={y}
                    x2={codon.middle * sep - codonPad}
                    y2={y + 10}
                    stroke="black"
                    strokeOpacity={0.1}
                  />
                )}
                <line
                  x1={codon.middle * sep + codonPad}
                  y1={y}
                  x2={codon.middle * sep + codonPad}
                  y2={y + 10}
                  stroke="black"
                  strokeOpacity={0.1}
                />
              </g>
            );
          })}
      </g>
    );
  });

  // Search tick
  let searchTick = null;
  if (intSearchInput != null && intSearchInput >= rowStart && intSearchInput <= rowEnd) {
    searchTick = (
      <g key="search-tick">
        <line
          x1={(intSearchInput - rowStart) * sep}
          y1={0}
          x2={(intSearchInput - rowStart) * sep}
          y2={10}
          stroke="red"
        />
        <rect
          x={(intSearchInput - rowStart) * sep - 30}
          y={0}
          width={60}
          height={30}
          fill="#ffffee"
        />
        <text
          x={(intSearchInput - rowStart) * sep}
          y={20}
          textAnchor="middle"
          fontSize="10"
          fill="red"
        >
          {intSearchInput + 1}
        </text>
      </g>
    );
  }

  // Selection rectangle
  let selectionRect = null;
  if (whereMouseWentDown != null) {
    const alternative = whereMouseWentUp != null ? whereMouseWentUp : whereMouseCurrentlyIs;
    const rectStart = Math.min(whereMouseWentDown, alternative);
    const rectEnd = Math.max(whereMouseWentDown, alternative);
    selectionRect = (
      <rect
        x={extraPadding + (rectStart - rowStart - 0.5) * sep}
        y={0}
        width={(rectEnd - rectStart) * sep}
        height={height}
        fill="#bbbbff"
        fillOpacity={0.5}
      />
    );
  }

  // Sequence hits
  let sequenceHitRects = null;
  if (sequenceHits.length > 0) {
    sequenceHitRects = sequenceHits.map((hit, i) => {
      let [start, end] = hit;
      if (end < rowStart || start > rowEnd) {
        return null;
      }
      if (start < rowStart) start = rowStart;
      if (end > rowEnd) end = rowEnd;

      return (
        <rect
          key={`hit-${i}`}
          x={extraPadding + (start - rowStart - 0.5) * sep}
          y={0}
          width={(end - start) * sep}
          height={height}
          fill={i === curSeqHitIndex ? "#ff8888" : "#ffbbbb"}
          fillOpacity={0.5}
        />
      );
    });
  }

  return (
    <div
      style={{
        position: "relative",
        height: `${height}px`,
        ...(isSelected ? { backgroundColor: "#ffffee" } : {}),
      }}
      onMouseDown={(e) => {
        if (e.button === 2) return;
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        const nucleotide = Math.floor((x - extraPadding) / sep + 0.5) + rowStart;
        setWhereMouseWentDown(nucleotide);
        setWhereMouseWentUp(null);
        e.preventDefault();
      }}
      onMouseUp={(e) => {
        if (e.button === 2) return;
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        const nucleotide = Math.floor((x - extraPadding) / sep + 0.5) + rowStart;
        if (Math.abs(nucleotide - whereMouseWentDown) < 1) {
          setWhereMouseWentDown(null);
          setWhereMouseWentUp(null);
        } else {
          setWhereMouseWentUp(nucleotide);
          e.preventDefault();
        }
      }}
      onMouseMove={(e) => {
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        const nucleotide = Math.floor((x - extraPadding) / sep + 0.5) + rowStart;
        setWhereMouseCurrentlyIs(nucleotide);
      }}
      id={`row-${rowId}`}
    >
      <svg
        width={Math.max(width, (changeLabels.length || proteinTrackHeight) ? changeLabelWidth : 0) + 40}
        height={height - 20 + (enableRC ? 20 : 0)}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {selectionRect}
        <g>{sequenceHitRects}</g>

        {/* Ticks */}
        <g fillOpacity={0.7}>
          <g transform={enableRC ? `translate(0,20)` : ""}>
            <g transform={`translate(${extraPadding}, ${height - 40})`} style={{ zIndex: -5 }}>
              {ticks}
            </g>
            {searchTick && (
              <g transform={`translate(${extraPadding}, ${height - 40})`}>
                {searchTick}
              </g>
            )}
          </g>
        </g>

        {/* Baseline */}
        <line
          x1={extraPadding}
          y1={height - 40}
          x2={width + extraPadding}
          y2={height - 40}
          stroke="black"
        />

        {/* Change labels sit above the reference, connected to their exact span. */}
        {changeLabels.length > 0 && <g aria-label="Reference-relative changes" transform={`translate(${extraPadding}, 0)`}>
          {changeLabels.map((d, i) => <g key={`connector-${i}`}>
            <path d={`M ${d.left + d.labelWidth / 2} ${height - 69 - d.lane * 28} L ${d.anchor} ${height - 61} L ${d.anchor} ${height - 56}`}
              fill="none" stroke={d.color} strokeWidth={1.25} />
            {d.type === 'Insertion'
              ? <path d={`M ${d.anchor - 4} ${height - 57} L ${d.anchor} ${height - 51} L ${d.anchor + 4} ${height - 57}`}
                  fill={d.color} />
              : <rect x={(d.start - rowStart - 0.5) * sep} y={height - 57}
                  width={(d.end - d.start) * sep} height={15} fill={d.background} />}
          </g>)}
          {changeLabels.map((d, i) => <g key={`label-${i}`} role="img" aria-label={d.description}>
            <title>{d.description}</title>
            <rect x={d.left} y={height - 91 - d.lane * 28} width={d.labelWidth} height={22}
              rx={4} fill={d.background} stroke={d.color} />
            <text x={d.left + d.labelWidth / 2} y={height - 76 - d.lane * 28}
              textAnchor="middle" fontSize={12} fontWeight={600} fontFamily="monospace" fill={d.color}>
              {d.displayLabel}
            </text>
          </g>)}
        </g>}
        {/* Forward sequence */}
        <g transform={`translate(${extraPadding}, ${height - 55})`}>
          {chars}
        </g>

        {/* Strike changed reference letters: amber substitutions, red deletions. */}
        <g aria-label="Changed reference bases" pointerEvents="none" transform={`translate(${extraPadding}, 0)`}>
          {changeLabels.filter(d => ['Deletion', 'Substitution'].includes(d.type)).map((d, i) => <line key={i}
            x1={(d.start - rowStart - 0.5) * sep} x2={(d.end - rowStart - 0.5) * sep}
            y1={height - 49} y2={height - 49} stroke={d.color} strokeWidth={2} />)}
        </g>

        {/* Reverse complement */}
        {enableRC && (
          <g transform={`translate(${extraPadding}, ${height - 55 + 19})`}>
            {chars2}
          </g>
        )}

        {/* Features */}
        <g transform={`translate(${extraPadding}, 5)`}>{featureBlocksSVG}</g>
      </svg>
    </div>
  );
};

export default SingleRow;
