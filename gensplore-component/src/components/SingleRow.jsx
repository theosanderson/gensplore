import ColorHash from "color-hash";
import { getReverseComplement, filterFeatures } from "../utils";
import getColor from "../utils/getColor";
import codonToAminoAcid from "../utils/codonMapping";
import { toast } from "react-toastify";
import "@fontsource/open-sans";
import "@fontsource/open-sans-condensed";

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
 * Assumes boxes are {left,top,right,bottom} objects.
 */
function boxesOverlap(a, b) {
  return !(a.left > b.right || a.right < b.left || a.top > b.bottom || a.bottom < b.top);
}

/**
 * Attempt to place a label so it doesn't overlap previously placed labels.
 * - x,y is the “ideal” top-left anchor in the SVG coordinate space
 * - text is the label string
 * - usedBoxes is an array of bounding boxes already in use
 * - maxTries is how many times to shift right before giving up
 * Returns either {x: newX} if placed, or null if we can't place it.
 */
function placeLabel(x, y, text, usedBoxes, maxTries = 10) {
  const avgCharWidth = 6; // tweak as needed
  const labelWidth = text.length * avgCharWidth;
  const labelHeight = 10; // rough line height

  let newX = x;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const box = {
      left: newX,
      top: y,
      right: newX + labelWidth,
      bottom: y + labelHeight,
    };

    // Check overlap with existing boxes
    const overlap = usedBoxes.some((b) => boxesOverlap(box, b));
    if (!overlap) {
      // Place label here
      usedBoxes.push(box);
      return { x: newX };
    }
    // Otherwise, nudge further right
    newX += 10;
  }

  // If we get here, we never found a spot
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
}) => {
  const zoomFactor = 2 ** zoomLevel;
  const sep = 10 * zoomFactor;
  const fullSequence = parsedSequence.sequence;
  const rowSequence = fullSequence.slice(rowStart, rowEnd);

  const relevantFeatures = visibleFeatures.filter(
    (feature) =>
      (feature.start >= rowStart && feature.start <= rowEnd) ||
      (feature.end >= rowStart && feature.end <= rowEnd) ||
      (feature.start <= rowStart && feature.end >= rowEnd)
  );

  const searchFeatures = !annotSearchInput
    ? []
    : filterFeatures(relevantFeatures, annotSearchInput);

  const isSelected =
    (intSearchInput >= rowStart && intSearchInput <= rowEnd) ||
    searchFeatures.length > 0;

  // Build featureBlocks
  const featureBlocks = relevantFeatures.map((feature, i) => {
    const startPos2 = feature.start < rowStart ? 0 : feature.start - rowStart;
    const endPos2 =
      feature.end > rowEnd ? rowEnd - rowStart : feature.end - rowStart;

    const locations = feature.locations
      ? feature.locations
      : [
          {
            start: feature.start,
            end: feature.end,
          },
        ];

    const blocks = locations
      .filter(
        (loc) =>
          (loc.start >= rowStart && loc.start <= rowEnd) ||
          (loc.end >= rowStart && loc.end <= rowEnd) ||
          (loc.start <= rowStart && loc.end >= rowEnd)
      )
      .map((loc) => {
        let startIsActual = true;
        let endIsActual = true;
        let s = loc.start;
        let e = loc.end;
        if (s < rowStart) {
          s = rowStart;
          startIsActual = false;
        }
        if (e > rowEnd) {
          e = rowEnd;
          endIsActual = false;
        }
        return {
          start: s - rowStart,
          end: e - rowStart,
          startIsActual,
          endIsActual,
        };
      });

    // For translations
    const seqLength = locations.reduce(
      (acc, loc) => acc + loc.end - loc.start + 1,
      0
    );
    const codonMap = [];
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

    return {
      start: startPos2,
      end: endPos2,
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
  const height = baseHeight + laneCount * rowSpacing;
  const width = rowSequence.length * sep;

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
    const x = feature.start * sep;
    const w = (feature.end - feature.start) * sep;
    const y = 7 + feature.lane * 20;
    const product = feature.notes?.product || "";
    let betterName = feature.type === "mat_peptide" ? product : feature.name;
    const altName = feature.type === "mat_peptide" ? feature.name : product;
    if (betterName === "Untitled Feature") betterName = feature.type;

    return (
      <g key={feature.key}>
        {/* Baseline from start to end */}
        <line
          x1={x + 2}
          y1={y + 5}
          x2={x + w - 2}
          y2={y + 5}
          stroke={getColor(feature, product)}
          strokeWidth={1.5}
        />
        {/* Feature blocks (sub-locations) */}
        {feature.blocks.map((block, j) => (
          <path
            key={`block-${j}`}
            d={`${
              feature.strand < 0
                ? // Reverse
                  `M ${block.end * sep + 5 * zoomFactor} ${y}
                  ${
                    block.startIsActual
                      ? `L ${
                          block.start * sep -
                          5 * zoomFactor +
                          SHARP_POINT_OFFSET
                        } ${y}
                        L ${
                          block.start * sep - 5 * zoomFactor
                        } ${y + 5}
                        L ${
                          block.start * sep -
                          5 * zoomFactor +
                          SHARP_POINT_OFFSET
                        } ${y + 10}`
                      : `L ${
                          block.start * sep -
                          5 * zoomFactor +
                          BLUNT_POINT_OFFSET
                        } ${y}
                        L ${
                          block.start * sep - 5 * zoomFactor
                        } ${y + 5}
                        L ${
                          block.start * sep -
                          5 * zoomFactor +
                          BLUNT_POINT_OFFSET
                        } ${y + 10}`
                  }
                  L ${block.end * sep + 5 * zoomFactor} ${y + 10}
                  L ${block.end * sep + 5 * zoomFactor} ${y}
                  `
                : // Forward
                  `M ${block.start * sep - 5 * zoomFactor} ${y}
                  ${
                    block.endIsActual
                      ? `L ${
                          block.end * sep +
                          5 * zoomFactor -
                          SHARP_POINT_OFFSET
                        } ${y}
                        L ${block.end * sep + 5 * zoomFactor} ${y + 5}
                        L ${
                          block.end * sep +
                          5 * zoomFactor -
                          SHARP_POINT_OFFSET
                        } ${y + 10}`
                      : `L ${
                          block.end * sep +
                          5 * zoomFactor -
                          BLUNT_POINT_OFFSET
                        } ${y}
                        L ${block.end * sep + 5 * zoomFactor} ${y + 5}
                        L ${
                          block.end * sep +
                          5 * zoomFactor -
                          BLUNT_POINT_OFFSET
                        } ${y + 10}`
                  }
                  L ${block.start * sep - 5 * zoomFactor} ${y + 10}
                  L ${block.start * sep - 5 * zoomFactor} ${y}
                  `
            } Z`}
            fill={getColor(feature, product)}
            onClick={() => handleFeatureClick(feature)}
            onMouseEnter={() => {
              if (zoomLevel < codonZoomThreshold) {
                setHoveredInfo({
                  label: `${feature.name}: ${feature.type}`,
                  product: altName,
                  locusTag:
                    feature.notes?.locus_tag || null,
                });
              }
            }}
            onMouseLeave={() => {
              if (zoomLevel < codonZoomThreshold) setHoveredInfo(null);
            }}
            style={{ cursor: "pointer" }}
          />
        ))}

        {/* Attempt to place the feature's label text without overlap */}
        {(() => {
          // If you prefer to anchor the text slightly to the left of “x”:
          const desiredX = x==0 ? -5 : x ;
          const desiredY = y; 
          const placed = placeLabel(desiredX, desiredY, betterName, usedLabelBoxes, 20);
          if (!placed) {
            // If we failed to place, we can either skip, or show partial, etc.
            return null; // Hide the label
          }
          return (
            <text
              x={placed.x}
              y={desiredY}
              fontSize="10"
              textAnchor="left"
            >
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

  // A tick for intSearchInput if relevant
  let searchTick = null;
  if (
    intSearchInput != null &&
    intSearchInput >= rowStart &&
    intSearchInput <= rowEnd
  ) {
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
    const alternative =
      whereMouseWentUp != null ? whereMouseWentUp : whereMouseCurrentlyIs;
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
        if (Math.abs(nucleotide - whereMouseWentDown) <= 1) {
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
        width={width + 40}
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
        {/* Forward sequence */}
        <g transform={`translate(${extraPadding}, ${height - 55})`}>
          {chars}
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
