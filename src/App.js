import React, { useState, useEffect } from "react";

import './App.css';

import { genbankToJson } from "bio-parsers";
import { useMeasure } from 'react-use'; // or just 'react-use-measure'



const Tooltip = ({ hoveredInfo }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const tooltipStyles = {
    position: "absolute",
    top: `${tooltipPosition.y - 10}px`,
    left: `${tooltipPosition.x + 10}px`,
    visibility: hoveredInfo ? "visible" : "hidden",
    background: "white",
    color: "black",
    padding: "5px",
    border: "1px solid black",
    zIndex: 1000,
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      setTooltipPosition({ x: e.pageX, y: e.pageY });
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div style={tooltipStyles}>
      {hoveredInfo && <span>{hoveredInfo.label}</span>}
    </div>
  );
};

const getColor = (type) => {
  switch (type) {
    case "CDS":
      return "red";
    case "gene":
      return "blue";
    case "misc_feature":
      return "green";
    case "5'UTR":
      return "orange";
    case "3'UTR":
      return "orange";
    default:
      return "black";
  }
};

const SingleRow = ({ parsedSequence, rowStart, rowEnd, setHoveredInfo, rowWidth }) => {

  const fullSequence = parsedSequence.sequence;
  const rowSequence = fullSequence.slice(rowStart, rowEnd);
  const relevantFeatures = parsedSequence.features.filter(
    (feature) => (
      feature.type !== "source" && 
      feature.type !== "gene" &&
      (
      (feature.start >= rowStart && feature.start <= rowEnd) ||
      (feature.end >= rowStart && feature.end <= rowEnd) ||
      (feature.start <= rowStart && feature.end >= rowEnd))
    )
  );
  if (rowStart==0){
    //console.log(relevantFeatures);
  }
  const featureBlocks = relevantFeatures.map((feature, i) => {
    let startIsActual = true;
    let startPos;
    let endPos
    if (feature.start < rowStart )
    {
      startPos = 0;
      startIsActual = false;
    }
    else
    {
      startPos = feature.start - rowStart;
    }
    let endIsActual = true;
    if (feature.end > rowEnd)
    {
      endPos = rowEnd - rowStart;
      endIsActual = false;
    }
    else
    {
      endPos = feature.end - rowStart;
    }
    const locations = feature.locations ? feature.locations : [{
      start: feature.start,
      end: feature.end,
    }];
    const forTranslation = feature.notes && feature.notes.translation ? feature.notes.translation[0] : null;
    // create an object which maps nucleotide positions on this row to the corresponding amino acid
    // positions in the translation
    // for each location in this row: check if it is in any of the locations, if so, figure out which codon it is in
    // and add it to the map

    const codonMap = [];
    if (forTranslation){

    for (let j = rowStart; j < rowEnd; j++) {
      let positionSoFar = 0;
      for (let k = 0; k < locations.length; k++) {
        if (j >= locations[k].start && j <= locations[k].end) {
          
          const codonStart =  (j );
          const codonEnd = codonStart + 2;
          const codonIndex = Math.floor((j - (locations[k].start - positionSoFar)) / 3);
          const frame = (j - (locations[k].start - positionSoFar)) % 3;
          if (frame != 1) {
            continue;
          }
          
          const aminoAcid = forTranslation[codonIndex];
         
          
          codonMap.push({
            start: codonStart- rowStart,
            end: codonEnd - rowStart,
            aminoAcid: aminoAcid,
            codonIndex: codonIndex,
            gene: feature.name,
          });
        
        }
        positionSoFar += locations[k].end - locations[k].start ;
      }
    }
  }
  //console.log(codonMap);




    

    return ({
      start: startPos,
      end: endPos,
      startIsActual: startIsActual,
      endIsActual: endIsActual,
      name: feature.name,
      type: feature.type,
      strand: feature.strand,
      locations: locations,
      codonMap: codonMap,
      key: i
    });
  });


  const extraPadding = 25;

  // Calculate dimensions and tick interval
  const width = rowSequence.length * 10; // 10 pixels per character
  let height = 70 + featureBlocks.length * 15;
  const numTicks = Math.ceil(width / 60); // One tick every 60 pixels
  const tickInterval = Math.ceil(rowSequence.length / numTicks);

  // Generate tick labels
  const tickLabels = Array.from({ length: numTicks }, (_, i) => {
    return i * tickInterval + rowStart;
  });

  // Generate ticks and labels
  const ticks = tickLabels.map((label, i) => {
    const x = ((label - rowStart) / (rowEnd - rowStart)) * width;
    return (
      <g key={i}>
        <line x1={x} y1={0} x2={x} y2={10} stroke="black" />
        <text x={x} y={20} textAnchor="middle" fontSize="10"
        >
          {label+1}
        </text>
      </g>
    );
  });

  // Generate sequence characters
  const chars = rowSequence.split("").map((char, i) => {
    const x = i * 10;
    return (
      <text key={i} x={x} y={10} textAnchor="middle" fontSize="12"
      onMouseEnter={
        () => setHoveredInfo({
         
          label: `Nucleotide ${i + rowStart + 1}: ${char}`
        })
      }
      onMouseLeave={() => setHoveredInfo(null)}

      >
        {char}
      </text>
    );
  });

  const featureBlocksSVG = featureBlocks.map((feature, i) => {
    const x = feature.start * 10;
    const width = (feature.end - feature.start) * 10;
    const y = 7 + i * 15;
    const extraFeat=5;
    
    return (
      <g key={i}>
        <rect x={x-extraFeat} y={y} width={width+extraFeat*2} height={10} fill={
          getColor(feature.type)
        } />
        <text x={x-10} y={y} textAnchor="left" fontSize="10"
        >
          {feature.name == "Untitled Feature" ? feature.type : feature.name}
        </text>
        {
          feature.codonMap.map((codon, j) => {
            return (
              <text key={j} x={codon.start*10} y={y+10} textAnchor="middle" fontSize="10"
              onMouseOver={
                () => setHoveredInfo({
                  label: `${codon.gene}: ${codon.aminoAcid}${codon.codonIndex+1}`
                })
              }
              onMouseLeave={() => setHoveredInfo(null)}

              >
                {codon.aminoAcid}
              </text>
            );
          }
          )

        }
      </g>
    );
  });


  // Concatenate sequence characters and ticks with SVG
  return (
    <div style={{ position: "relative", height: `${height}px` }}>
      <svg
        width={width+10}
        height={height - 20}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <g transform={`translate(${extraPadding}, ${height-40})`}>{ticks}</g>
        {// line above ticks 
        }
        <line x1={0+extraPadding} y1={height-40} x2={width+extraPadding} y2={height-40} 
        x2={width}
        stroke="black" />
        <g transform={`translate(${extraPadding}, ${height-55})`}>{chars}</g>
        <g transform={`translate(${extraPadding}, 5)`}>{featureBlocksSVG}</g>
      </svg>
    </div>
  );
};



function App() {
  const [ref, { width }] = useMeasure();
  //console.log("width", width);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [genbankData, setGenbankData] = useState(null);

  useEffect(() => {
    const loadGenbankFile = async () => {
      try {
        const response = await fetch("/sequence.gb");
        const text = await response.text();
        const genbankObject = await genbankToJson(text);
        console.log("GenBank file loaded:", genbankObject);
        // to uppercase
        genbankObject[0].parsedSequence.sequence = genbankObject[0].parsedSequence.sequence.toUpperCase();
        setGenbankData(genbankObject[0]);
      } catch (error) {
        console.error("Error loading GenBank file:", error);
      }
    };
    loadGenbankFile();
  }, []);

  if (!genbankData ) {
    return <div>Loading...</div>;
  }
  let  rowWidth= Math.floor(width*.097);
  // rowWidth minimum 50
  if (rowWidth < 50) {
    rowWidth = 50;
  }

  const rowData = [];
  const fullSequence = genbankData.parsedSequence.sequence;
  const sequenceLength = fullSequence.length;
  for (let i = 0; i < sequenceLength; i += rowWidth) {
    rowData.push({
      rowStart: i,
      rowEnd: i + rowWidth,
    });
  }


  return (
    <div className="w-full h-full p-5">
    <div ref={ref} >
      <Tooltip hoveredInfo={hoveredInfo} />
      {genbankData && (
        <div>
          <h2 className="text-2xl"
          >{genbankData.parsedSequence.name}</h2>
          <div>
            <div className="flex flex-row">
              <span>{genbankData.parsedSequence.definition}</span>
              </div>
            

            </div>
         <div className="mt-5">
          {rowData.map((row, index) => (
            <SingleRow key={index} parsedSequence={genbankData.parsedSequence} rowStart={row.rowStart} rowEnd={row.rowEnd}
            rowWidth={rowWidth}
            setHoveredInfo={setHoveredInfo}
            />
          ))}
          </div>


        </div>
      )}
    </div>
    </div>
  );
  
}

export default App;