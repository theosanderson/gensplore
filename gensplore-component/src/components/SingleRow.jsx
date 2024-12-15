import ColorHash from "color-hash";
import { getReverseComplement, filterFeatures, } from "../utils";
import getColor from "../utils/getColor";
import codonToAminoAcid from "../utils/codonMapping";
import { toast } from "react-toastify";
import '@fontsource/open-sans';
import '@fontsource/open-sans-condensed';

// Arrow point configuration
const SHARP_POINT_OFFSET = 6;  // Offset for actual feature ends (sharp points)
const BLUNT_POINT_OFFSET = 1;   // Offset for row boundary ends (semi-blunt)

var colorHash = new ColorHash({ lightness: [0.75, 0.9, 0.7, 0.8] });

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
  visibleFeatures
}) => {
  const zoomFactor = 2 ** zoomLevel;
  const sep = 10 * zoomFactor;

  const fullSequence = parsedSequence.sequence;
  const rowSequence = fullSequence.slice(rowStart, rowEnd);

  const relevantFeatures = visibleFeatures.filter(
    (feature) => ((feature.start >= rowStart && feature.start <= rowEnd) ||
        (feature.end >= rowStart && feature.end <= rowEnd) ||
        (feature.start <= rowStart && feature.end >= rowEnd))
  );

  const searchFeatures = !annotSearchInput
    ? []
    : filterFeatures(relevantFeatures, annotSearchInput);

  const isSelected =
    (intSearchInput >= rowStart && intSearchInput <= rowEnd) ||
    searchFeatures.length > 0;

  if (rowStart == 0) {
    //console.log(relevantFeatures);
  }

  const featureBlocks = relevantFeatures.map((feature, i) => {
    let startPos2;
    let endPos2;

    if (feature.start < rowStart) {
      startPos2 = 0;
    } else {
      startPos2 = feature.start - rowStart;
    }

    if (feature.end > rowEnd) {
      endPos2 = rowEnd - rowStart;
    } else {
      endPos2 = feature.end - rowStart;
    }

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
        (location) =>
          (location.start >= rowStart && location.start <= rowEnd) ||
          (location.end >= rowStart && location.end <= rowEnd) ||
          (location.start <= rowStart && location.end >= rowEnd)
      )
      .map((location, j) => {
        let startPos;
        let endPos;
        let startIsActual = true;

        if (location.start < rowStart) {
          startPos = 0;
          startIsActual = false;
        } else {
          startPos = location.start - rowStart;
        }
        let endIsActual = true;
        if (location.end > rowEnd) {
          endPos = rowEnd - rowStart;
          endIsActual = false;
        } else {
          endPos = location.end - rowStart;
        }
        return {
          start: startPos,
          end: endPos,
          startIsActual: startIsActual,
          endIsActual: endIsActual,
        };
      });

    // positions in the translation
    // for each location in this row: check if it is in any of the locations, if so, figure out which codon it is in
    // and add it to the map

    const seqLength = locations.reduce(
      (acc, location) => acc + location.end - location.start + 1,
      0
    );

    const codonMap = [];
    if (
      zoomLevel > -2 &&
      (feature.type == "CDS") | (feature.type == "mat_peptide")
    ) {
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
            if (frame != 1) {
              continue;
            }

            const middleIndex = nucIndex;
            const middleChar = fullSequence.slice(middleIndex, middleIndex + 1);
            const firstIndex =
              nucIndex - locations[k].start > 0
                ? nucIndex - 1
                : locations[k - 1].end;
            const firstChar = fullSequence.slice(firstIndex, firstIndex + 1);
            const lastIndex =
              nucIndex < locations[k].end
                ? nucIndex + 1
                : locations[k + 1].start;
            const lastChar = fullSequence.slice(lastIndex, lastIndex + 1);
            const codonSeq = firstChar + middleChar + lastChar;
            //console.log(nucIndex, locations[k].start, firstChar, middleChar, lastChar);

            const aminoAcid = codonToAminoAcid(
              feature.strand > 0 ? codonSeq : getReverseComplement(codonSeq)
            );
            //const aminoAcid = forTranslation[codonIndex];

            codonMap.push({
              first: firstIndex - rowStart,
              middle: nucIndex - rowStart,
              last: lastIndex - rowStart,
              aminoAcid: aminoAcid,
              codonIndex: codonIndex,
              gene: feature.name,
            });
          }
          positionSoFar += locations[k].end - locations[k].start + 1;
        }
      }
    }
    //console.log(codonMap);

    return {
      start: startPos2,
      end: endPos2,

      blocks: blocks,
      name: feature.name,
      type: feature.type,
      notes: feature.notes,
      strand: feature.strand,
      locations: locations,
      codonMap: codonMap,
      key: i,
    };
  });

  const extraPadding = 25;

  // Calculate dimensions and tick interval
  const width = rowSequence.length * sep; // 10 pixels per character
  let height = 70 + featureBlocks.length * 20;
  // if rowStart is more than 5 digits, then we need more spacing
  const spacing = rowStart > 10000 ? 60 : 40;
  const approxNumTicks = Math.ceil(width / spacing); // One tick every 60 pixels
  let tickInterval = Math.ceil(rowSequence.length / approxNumTicks);
  const options = [
    5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000,
    200000, 500000, 1000000, 2000000, 5000000, 10000000,
  ];
  // find option just larger than tickInterval

  tickInterval = options.find((option) => option >= tickInterval);
  const modulus = rowStart % tickInterval;
  const numTicks = Math.floor((rowEnd - rowStart) / tickInterval) + 1;

  // Generate tick labels
  const tickLabels = Array.from({ length: numTicks }, (_, i) => {
    return (i + 1) * tickInterval + rowStart - modulus - 1;
  });

  // Generate ticks and labels
  const ticks = tickLabels.map((label, i) => {
    const x = ((label - rowStart) / (rowEnd - rowStart)) * width;
    return (
      <g key={i}>
        <line x1={x} y1={0} x2={x} y2={10} stroke="black" />
        <text
          x={x}
          y={20}
          textAnchor="middle"
          fontSize="10"
          // bold
        >
          {label + 1}
        </text>
      </g>
    );
  });

  // Generate sequence characters
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
          fontFamily={zoomLevel < -0.25 ? "Open Sans Condensed" : "Open Sans"}
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
  const rc = {"A": "T", "T": "A", "C": "G", "G": "C", "N": "N"};
  if (//window.RC &&
   zoomLevel > -1) {
    // Generate reverse complement sequence characters
    chars2 = rowSequence.split("").map((char, i) => {
      const x = i * sep;
      return (
        <text
          key={i}
          x={x}
          y={10}
          textAnchor="middle"
          fontSize={zoomLevel < -0.5 ? "10" : "12"}
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
    const minLoc = feature.locations.map((loc) => Math.min(loc.start, loc.end)).reduce((a, b) => Math.min(a, b));
    const maxLoc = feature.locations.map((loc) => Math.max(loc.start, loc.end)).reduce((a, b) => Math.max(a, b));
    setWhereMouseWentDown(minLoc);
    setWhereMouseWentUp(maxLoc+1);
    if (feature.locations.length > 1) {
      toast.info(
        `This feature has multiple locations. The selection will be from the start of the first location to the end of the last location.`
      );
    }
    console.log(feature);
  };

  const featureBlocksSVG = featureBlocks.map((feature, i) => {
    const x = feature.start * sep;

    const width = (feature.end - feature.start) * sep;

    const y = 7 + i * 20;
    const extraFeat = 5 * zoomFactor;
    const codonPad = 15 * zoomFactor;

    const product = feature.notes ? feature.notes.product : "";
    let betterName = feature.type == "mat_peptide" ? product : feature.name;

    const altName = feature.type == "mat_peptide" ? feature.name : product;
    if (betterName == "Untitled Feature") betterName = feature.type;

    return (
      <g key={i}>
        <line
          x1={x + 2}
          y1={y + 5}
          x2={x + width - 2}
          y2={y + 5}
          stroke={getColor(feature, product)}
          // width 2
          strokeWidth={1.5}
        />
        {feature.blocks.map((block, j) => (
          <path
            d={`${feature.strand < 0 ?
                // Reverse strand
                `M ${block.end * sep + extraFeat} ${y}
                ${block.startIsActual ? 
                  // Sharp point for actual start
                  `L ${block.start * sep - extraFeat + SHARP_POINT_OFFSET} ${y}
                   L ${block.start * sep - extraFeat} ${y + 5}
                   L ${block.start * sep - extraFeat + SHARP_POINT_OFFSET} ${y + 10}`
                  :
                  // Semi-blunt end for row boundary
                  `L ${block.start * sep - extraFeat + BLUNT_POINT_OFFSET} ${y}
                   L ${block.start * sep - extraFeat} ${y + 5}
                   L ${block.start * sep - extraFeat + BLUNT_POINT_OFFSET} ${y + 10}`
                }
                L ${block.end * sep + extraFeat} ${y + 10}
                L ${block.end * sep + extraFeat} ${y}`
                :
                // Forward strand
                `M ${block.start * sep - extraFeat} ${y}
                ${block.endIsActual ?
                  // Sharp point for actual end
                  `L ${block.end * sep + extraFeat - SHARP_POINT_OFFSET} ${y}
                   L ${block.end * sep + extraFeat} ${y + 5}
                   L ${block.end * sep + extraFeat - SHARP_POINT_OFFSET} ${y + 10}`
                  :
                  // Semi-blunt end for row boundary
                  `L ${block.end * sep + extraFeat - BLUNT_POINT_OFFSET} ${y}
                   L ${block.end * sep + extraFeat} ${y + 5}
                   L ${block.end * sep + extraFeat - BLUNT_POINT_OFFSET} ${y + 10}`
                }
                L ${block.start * sep - extraFeat} ${y + 10}
                L ${block.start * sep - extraFeat} ${y}`
                }
                Z`}
            fill={getColor(feature, product)}
            onClick={() => handleFeatureClick(feature)}
            onMouseEnter={() => {
              if (zoomLevel < codonZoomThreshold)
                setHoveredInfo({
                  label: `${feature.name}: ${feature.type}`,
                  product: altName,
                  locusTag:
                    feature.notes && feature.notes.locus_tag
                      ? feature.notes.locus_tag
                      : null,
                });
            }}
            onMouseLeave={() => {
              if (zoomLevel < codonZoomThreshold) setHoveredInfo(null);
            }}
            style={{cursor: 'pointer'}}
          />
        ))}

        <text x={x - 10} y={y} textAnchor="left" fontSize="10">
          {betterName}
        </text>
        {feature.codonMap.map((codon, j) => {
          return (
            <>
              {zoomLevel > codonZoomThreshold && (
                <text
                  key={j}
                  x={codon.middle * sep}
                  y={y + 9}
                  textAnchor="middle"
                  fontSize="10"
                  onClick={() => handleFeatureClick(feature)}
                  onMouseOver={() =>
                    setHoveredInfo({
                      label: `${betterName}: ${codon.aminoAcid}${
                        codon.codonIndex + 1
                      }`,
                      product: altName,
                      locusTag:
                        feature.notes && feature.notes.locus_tag
                          ? feature.notes.locus_tag
                          : null,
                    })
                  }
                  onMouseLeave={() => setHoveredInfo(null)}
                  fillOpacity={0.75}
                  style={{cursor: 'pointer'}}
                >
                  {codon.aminoAcid}
                </text>
              )}
              {codon.middle > 2 && zoomLevel > -0.5 && (
                <text
                  key={"bb" + j}
                  x={codon.middle * sep}
                  y={y - 1}
                  textAnchor="middle"
                  fontSize="7"
                  fillOpacity={0.4}
                  //fontWeight="bold"
                >
                  {codon.codonIndex + 1}
                </text>
              )}
            </>
          );
        })}
        {zoomLevel > -2 &&
          feature.codonMap.map((codon, j) => {
            // create a line either side of the codon

            return (
              <g key={j}>
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

  // create a tick specifically at searchInput
  let searchTick = null;
  if (
    intSearchInput != null &&
    intSearchInput >= rowStart &&
    intSearchInput <= rowEnd
  ) {
    searchTick = (
      <g key={-1}>
        <line
          x1={(intSearchInput - rowStart) * sep}
          y1={0}
          x2={(intSearchInput - rowStart) * sep}
          y2={10}
          stroke="red"
        />
        {
          //rect behind tick
        }
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

  let selectionRect = null;
  let selTempStart = null;
  let selTempEnd = null;
  //console.log(whereMouseWentDown, whereMouseWentUp, whereMouseCurrentlyIs);

  if (whereMouseWentDown != null) {
    const alternative =
      whereMouseWentUp != null ? whereMouseWentUp : whereMouseCurrentlyIs;

    const rectStart = Math.min(whereMouseWentDown, alternative);
    const rectEnd = Math.max(whereMouseWentDown, alternative);
    //console.log(rectStart, rectEnd);
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

  let sequenceHitRects = null;

  if(sequenceHits.length > 0){
    sequenceHitRects = [];
    for(let i = 0; i < sequenceHits.length; i++){
      const hit = sequenceHits[i];
      let [start, end] = hit;
      // if the hit is outside the current view, skip it
      if(start > rowEnd || end < rowStart){
        continue;
      }
      // if the hit is partially outside the current view, clip it
      if(start < rowStart){
        start = rowStart;
      }
      if(end > rowEnd){
        end = rowEnd;
      }
      sequenceHitRects.push(
        <rect
          x={extraPadding + (start - rowStart - 0.5) * sep}
          y={0}
          width={(end - start) * sep}
          height={height}
          fill={i==curSeqHitIndex? "#ff8888":"#ffbbbb"}
          fillOpacity={0.5}
        />
      );
    }
  }

            



  // Concatenate sequence characters and ticks with SVG
  return (
    <div
      style={{
        position: "relative",
        height: `${height}px`,
        ...(isSelected ? { backgroundColor: "#ffffee" } : {}),
      }}
      onMouseDown={(e) => {
        // if right mouse button, don't do anything
        if (e.button == 2) {
          return;
        }
        // figure out which nucleotide was clicked
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        const nucleotide =
          Math.floor((x - extraPadding) / sep + 0.5) + rowStart;
        setWhereMouseWentDown(nucleotide);
        setWhereMouseWentUp(null);
        e.preventDefault();
      }}
      onMouseUp={(e) => {
        // if right mouse button, don't do anything
        if (e.button == 2) {
          return;
        }
        // figure out which nucleotide was clicked
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        const nucleotide =
          Math.floor((x - extraPadding) / sep + 0.5) + rowStart;
        if (Math.abs(nucleotide - whereMouseWentDown) <= 1) {
          // if the mouse didn't move, then this is a click

          setWhereMouseWentDown(null);
          setWhereMouseWentUp(null);
        } else {
          // otherwise, this is a drag
          setWhereMouseWentUp(nucleotide);
          e.preventDefault();
        }
      }}
      onMouseMove={(e) => {
        // figure out which nucleotide was clicked
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        const nucleotide =
          Math.floor((x - extraPadding) / sep + 0.5) + rowStart;
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
        <g>
          {sequenceHitRects}
        </g>
        <g fillOpacity={0.7}>
        <g transform={enableRC ? `translate(0,20)` : ""}>
        
          <g
            transform={`translate(${extraPadding}, ${height - 40})`}
            style={{ zIndex: -5 }}
          >
            {ticks}
          </g>
          {searchTick && (
            <g transform={`translate(${extraPadding}, ${height - 40})`}>
              {searchTick}
            </g>
          )}
          {
            // line above ticks
          }
          
        </g>
        </g>
        <line
            x1={0 + extraPadding}
            y1={height - 40}
            x2={width + extraPadding + 0}
            y2={height - 40}
            stroke="black"
          />

        <g transform={`translate(${extraPadding}, ${height - 55})`}>{chars}</g>
        
        {enableRC &&
          <g transform={`translate(${extraPadding}, ${height - 55 + 19})`}>{chars2}</g>

        }
        <g transform={`translate(${extraPadding}, 5)`}>{featureBlocksSVG}</g>
       
      </svg>
    </div>
  );
};

export default SingleRow;
