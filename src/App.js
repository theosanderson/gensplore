import React, { useState, useEffect } from "react";

import './App.css';

import { genbankToJson } from "bio-parsers";
import { useMeasure } from 'react-use'; // or just 'react-use-measure'
import {FaSearch,FaTimes} from 'react-icons/fa';
import {DebounceInput} from 'react-debounce-input';

const Tooltip = ({ hoveredInfo }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const tooltipStyles = {
    position: "absolute",
    top: `${tooltipPosition.y + 20}px`,
    left: `${tooltipPosition.x + 0}px`,
    visibility: hoveredInfo ? "visible" : "hidden",
    
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
    <div style={tooltipStyles} className="text-sm bg-gray-100 p-2 rounded">
      {hoveredInfo && <span>{hoveredInfo.label}</span>}
    </div>
  );
};

const getColor = (feature) => {
  switch (feature.type) {
    case "CDS":
      switch (feature.name){
        case "S":
          return "#ff7373";
        case "nsp3":
          return "#d3ffce"

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
          return "#ff7f50"
        case "nsp6":
          return "#ee99ee"
        case "nsp7":
          return "#99ee99"

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
          return "#c39797";
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
      return "black";
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
      return "STOP";
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

const SingleRow = ({ parsedSequence, rowStart, rowEnd, setHoveredInfo, rowId, searchInput, renderProperly }) => {
  if (!renderProperly)
  {
    return <div style={{height:60, borderBottom: "1px solid #eee"}}
    id={`row-${rowId}`}></div>
  }

  const isSelected = searchInput>=rowStart && searchInput<=rowEnd;
  if(isSelected){
    console.log("selected");
  }



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
    
    // positions in the translation
    // for each location in this row: check if it is in any of the locations, if so, figure out which codon it is in
    // and add it to the map

    const codonMap = [];
    if (feature.type=="CDS" ){

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


          const codonSeq = fullSequence.slice(codonStart-1, codonEnd );
          //console.log(codonSeq);

          
          const aminoAcid = codonToAminoAcid(codonSeq);
          //const aminoAcid = forTranslation[codonIndex];
          
          codonMap.push({
            start: codonStart- rowStart,
            end: codonEnd - rowStart,
            aminoAcid: aminoAcid,
            codonIndex: codonIndex,
            gene: feature.name,
          });
        
        }
        positionSoFar += locations[k].end - locations[k].start +1;
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
  let height = 70 + featureBlocks.length * 20;
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
    const y = 7 + i * 20;
    const extraFeat=5;
    const codonPad =15;
    
    return (
      <g key={i}>
        <rect x={x-extraFeat} y={y} width={width+extraFeat*2} height={10} fill={
          getColor(feature)
        } />
        <text x={x-10} y={y} textAnchor="left" fontSize="10"
        >
          {feature.name == "Untitled Feature" ? feature.type : feature.name}
        </text>
        {
          feature.codonMap.map((codon, j) => {
            return (<>
              <text key={j} x={codon.start*10} y={y+9} textAnchor="middle" fontSize="10"
              onMouseOver={
                () => setHoveredInfo({
                  label: `${codon.gene}: ${codon.aminoAcid}${codon.codonIndex+1}`
                })
              }
              onMouseLeave={() => setHoveredInfo(null)}

      fillOpacity={0.75}

              >
                {codon.aminoAcid}
              </text>
              <text key={j} x={codon.start*10} y={y-1} textAnchor="middle" fontSize="7" fillOpacity={0.4}>
                {codon.codonIndex+1}
              </text>
              
              </>
            );
          }

          )

        }
        {
          feature.codonMap.map((codon, j) => {
            // create a line either side of the codon

            return (
              <g key={j}>
                {codon.start>1 && codon.start<3 &&
                <line x1={codon.start*10-codonPad} y1={y} x2={codon.start*10-codonPad} y2={y+10} stroke="black" strokeOpacity={0.1} />
          }
                <line x1={codon.start*10+codonPad} y1={y} x2={codon.start*10+codonPad} y2={y+10} stroke="black" strokeOpacity={0.1} />
              </g>
            );

        }
        
        )
        }
      </g>
    );
  });

  // create a tick specifically at searchInput
  let searchTick = null;
  if (searchInput != null && searchInput >= rowStart && searchInput <= rowEnd) {
   searchTick = (
    <g key={-1}>
      <line x1={(searchInput-rowStart)*10} y1={0} x2={(searchInput-rowStart)*10} y2={10} stroke="red" />
      {//rect behind tick
  }
      <rect x={(searchInput-rowStart)*10-30} y={0} width={60} height={30} fill="#ffffee"  />
      <text x={(searchInput-rowStart)*10} y={20} textAnchor="middle" fontSize="10"
      fill="red"
      >
        {searchInput+1}
      </text>
    </g>
  );
  }


  // Concatenate sequence characters and ticks with SVG
  return (
    <div style={{ position: "relative", height: `${height}px`,
    ...(isSelected? {backgroundColor: "#ffffee"} : {})
    
    }} id={`row-${rowId}`}>
      <svg
        width={width+40}
        height={height - 20}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <g
        fillOpacity={0.7}
        >
        <g transform={`translate(${extraPadding}, ${height-40})`} style={
          {zIndex:-5}
        }>{ticks}</g>
        {searchTick && <g transform={`translate(${extraPadding}, ${height-40})`}>{searchTick}</g>
}
        {// line above ticks 
        }
        <line x1={0+extraPadding} y1={height-40} x2={width+extraPadding+0} y2={height-40} 
       
        stroke="black" />
        </g>

        <g transform={`translate(${extraPadding}, ${height-55})`}>{chars}</g>
        <g transform={`translate(${extraPadding}, 5)`}>{featureBlocksSVG}</g>
      </svg>
    </div>
  );
};

function SearchPanel({ searchPanelOpen,setSearchPanelOpen,searchInput,setSearchInput }) {
   

  const handleInputChange = (event) => {
    setSearchInput(event.target.value);
  
  };

  return (
    <div className="bg-gray-100 p-1 text-sm">
      {searchPanelOpen ? ((<>
      <DebounceInput
      minLength={2}
        debounceTimeout={300}
        type="text"
        value={searchInput}
        onChange={handleInputChange}
        placeholder="nuc index"
        id="search-input"
        // don't autocomplete
        autoComplete="off"
      />
      <button 
      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded inline-flex items-center"
      onClick={() => {setSearchPanelOpen(false)
      setSearchInput(null)}}
      >
        <FaTimes className="mr-2" />
      </button></>
      )) : (
        <button
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded inline-flex items-center"
          onClick={() => setSearchPanelOpen(true)}
        >
         <FaSearch className="mr-2" />
        </button>
      )}
    </div>
  );
}





function App() {
 
   const [searchPanelOpen, setSearchPanelOpen] = useState(false);
   // detect ctrl-F and open search panel
    useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.keyCode === 70) {
        e.preventDefault();
        setSearchPanelOpen(true);
        // focus on search input
        setTimeout(() => {
          document.getElementById("search-input").focus();
          // select all text
          document.getElementById("search-input").select();
        }
        , 100);
    }

    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  const [ref, { width }] = useMeasure();
  //console.log("width", width);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [genbankData, setGenbankData] = useState(null);
  const [searchInput, setSearchInput] = useState(null);

  // safely convert searchInput to int
  const intSearchInput = parseInt(searchInput);

  const [whereOnPage, setWhereOnPage] = useState(0);

  // listen to scroll
  function getDocHeight() {
    var D = document;
    return Math.max(
        Math.max(D.body.scrollHeight, D.documentElement.scrollHeight),
        Math.max(D.body.offsetHeight, D.documentElement.offsetHeight),
        Math.max(D.body.clientHeight, D.documentElement.clientHeight)
    );
  }
  useEffect(() => {
    // capture how far down the page we are as a percentage
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const winHeight = window.innerHeight;
      const docHeight = getDocHeight();
      const totalDocScrollLength = docHeight - winHeight;
      const scrollPosition = scrollTop / totalDocScrollLength;
      // if difference is more than 1%, update
      if (Math.abs(scrollPosition - whereOnPage) > 0.05) {
        // debounce
        setWhereOnPage(scrollPosition);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [whereOnPage]);






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

  
  let  rowWidth= Math.floor(width*.0965);
  // rowWidth minimum 50
  if (rowWidth < 40) {
    rowWidth = 40;
  }


  // useEffect
  useEffect(() => {
    if(!intSearchInput) return;
    const row = Math.floor(intSearchInput / rowWidth);
    console.log("row", row);
  
    

    setTimeout(() => {
      const rowElement = document.getElementById(`row-${row}`);
    if (!rowElement) return;
      rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    setTimeout(() => {
      const rowElement = document.getElementById(`row-${row}`);
      if (!rowElement) return;
      rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1000);
  }, [intSearchInput]);

  if (!genbankData ) {
    return <div>Loading...</div>;
  }

  const rowData = [];
  const fullSequence = genbankData.parsedSequence.sequence;
  const sequenceLength = fullSequence.length;
  for (let i = 0; i < sequenceLength; i += rowWidth) {
    rowData.push({
      rowStart: i,
      rowEnd: (i + rowWidth > sequenceLength ? sequenceLength : i + rowWidth)
    });
  }

  if(!width){
    return (
      <div className="w-full h-full p-5">
        <div ref={ref} className="w-full h-full" />
        Loading...
      </div>
    );

  }

  return (
    <div className="w-full p-5">
      {true && (
        <div className="fixed top-0 right-0 z-10">
          <SearchPanel
          searchInput = {searchInput}
          setSearchInput = {setSearchInput}
          searchPanelOpen={searchPanelOpen}
          setSearchPanelOpen={setSearchPanelOpen}
          
          />
        </div>
      )}


     
    <div ref={ref} className="w-full">
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
            rowId={index}
            searchInput={intSearchInput-1}
            renderProperly={(Math.abs(whereOnPage - (index / rowData.length)) < 0.2)
            || (row.rowStart>=intSearchInput && row.rowEnd<=intSearchInput)}
          
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