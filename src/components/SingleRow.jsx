import ColorHash from "color-hash";
import { getReverseComplement, filterFeatures } from "../utils";
var colorHash = new ColorHash({ lightness: [0.75, 0.9, 0.7, 0.8] });

const getColor = (feature, product) => {
  switch (feature.type) {
    case "CDS":
      switch (feature.name) {
        case "S":
          return "#ff7373";
        case "nsp3":
          return "#d3ffce";

        case "leader":
          return "#ff7f50";

        case "nsp2":
          return "#ddffdd";

        case "nsp4":
          return "#ff7373";

        case "N":
          return "#7fffd4";
        case "E":
          return "#ff7f50";
        case "M":
          return "#eeee88";
        case "nsp12; RdRp":
          return "#ff7f50";
        case "nsp6":
          return "#ee99ee";
        case "nsp7":
          return "#99ee99";

        case "nsp8":
          return "#ff7373";
        case "nsp10":
          return "#d3ffce";

        case "nsp14":
          return "#ff7f50";
        case "nsp15":
          return "#ddffdd";
        case "nsp16":
          return "#ffeeee";
        case "nsp13":
          return "#ff7f50";

        default:
          return colorHash.hex(feature.name + product + feature.type);
      }
    case "gene":
      return "blue";
    case "misc_feature":
      return "green";
    case "5'UTR":
      return "orange";
    case "3'UTR":
      return "orange";
    default:
      return colorHash.hex(feature.name + product + feature.type);
  }
};

const codonToAminoAcid = (codon) => {
  switch (codon) {
    case "TTT":
    case "TTC":
      return "F";
    case "TTA":
    case "TTG":
    case "CTT":
    case "CTC":
    case "CTA":
    case "CTG":
      return "L";
    case "ATT":
    case "ATC":
    case "ATA":
      return "I";
    case "ATG":
      return "M";
    case "GTT":
    case "GTC":
    case "GTA":
    case "GTG":
      return "V";
    case "TCT":
    case "TCC":
    case "TCA":
    case "TCG":
    case "AGT":
    case "AGC":
      return "S";
    case "CCT":
    case "CCC":
    case "CCA":
    case "CCG":
      return "P";
    case "ACT":
    case "ACC":
    case "ACA":
    case "ACG":
      return "T";
    case "GCT":
    case "GCC":
    case "GCA":
    case "GCG":
      return "A";
    case "TAT":
    case "TAC":
      return "Y";
    case "TAA":
    case "TAG":
    case "TGA":
      return "*";
    case "CAT":
    case "CAC":
      return "H";
    case "CAA":
    case "CAG":
      return "Q";
    case "AAT":
    case "AAC":
      return "N";
    case "AAA":
    case "AAG":
      return "K";
    case "GAT":
    case "GAC":
      return "D";
    case "GAA":
    case "GAG":
      return "E";
    case "TGT":
    case "TGC":
      return "C";
    case "TGG":
      return "W";
    case "CGT":
    case "CGC":
    case "CGA":
    case "CGG":
    case "AGA":
    case "AGG":
      return "R";
    case "GGT":
    case "GGC":
    case "GGA":
    case "GGG":
      return "G";
    default:
      return "X";
  }
};

const SingleRow = ({
  parsedSequence,
  rowStart,
  rowEnd,
  setHoveredInfo,
  rowId,
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
  enableRC
}) => {
  const zoomFactor = 2 ** zoomLevel;
  const sep = 10 * zoomFactor;

  const fullSequence = parsedSequence.sequence;
  const rowSequence = fullSequence.slice(rowStart, rowEnd);

  const relevantFeatures = parsedSequence.features.filter(
    (feature) =>
      feature.type !== "source" &&
      feature.type !== "gene" &&
      feature.type !== "mRNA" &&
      ((feature.start >= rowStart && feature.start <= rowEnd) ||
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
          fontSize={zoomLevel < -0.5 ? "10" : "12"}
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
          x1={x}
          y1={y + 5}
          x2={x + width}
          y2={y + 5}
          stroke={getColor(feature, product)}
          // width 2
          strokeWidth={1.5}
        />
        {feature.blocks.map((block, j) => (
          <rect
            x={block.start * sep - extraFeat}
            y={y}
            width={(block.end - block.start) * sep + extraFeat * 2}
            height={10}
            fill={getColor(feature, product)}
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
        // figure out which nucleotide was clicked
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        const nucleotide =
          Math.floor((x - extraPadding) / sep + 0.5) + rowStart;
        setWhereMouseWentDown(nucleotide);
        setWhereMouseWentUp(null);
        e.preventDefault();
      }}
      onMouseUp={(e) => {
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
