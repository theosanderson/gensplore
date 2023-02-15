import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from "react";
import 'rc-slider/assets/index.css';
import './App.css';

import ClipLoader from "react-spinners/ClipLoader";
import { genbankToJson } from "bio-parsers";
import { useMeasure } from 'react-use'; // or just 'react-use-measure'
import {FaSearch,FaTimes, FaZoo} from 'react-icons/fa';
import {DebounceInput} from 'react-debounce-input';
import { useVirtualizer, useWindowVirtualizer} from '@tanstack/react-virtual';
import Slider, {Range} from "rc-slider";
import {AiOutlineZoomIn,AiOutlineZoomOut} from 'react-icons/ai';
import {GiDna1} from 'react-icons/gi';
import ColorHash from 'color-hash';
import { useNavigate, useLocation } from "react-router-dom"
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import qs from "qs"
import { U } from "ve-sequence-utils/lib/DNAComplementMap";
var colorHash = new ColorHash({lightness: [0.75, 0.9, 0.7,0.8]});


const filterFeatures = (features, search) => {
  return features.filter((feature) => {
    // if feature name contains search string
    if(feature.name.toLowerCase().includes(search.toLowerCase())){
      return true;
    }
    const product = feature.notes && feature.notes.product ? feature.notes.product[0] : "";
    if(product.toLowerCase().includes(search.toLowerCase())){
      return true;
    }
    const locus_tag = feature.notes && feature.notes.locus_tag ? feature.notes.locus_tag[0] : "";
    if(locus_tag.toLowerCase().includes(search.toLowerCase())){
      return true;
    }
    return false;
  });
}

const useQueryState = query => {
  const location = useLocation()
  const navigate = useNavigate()

  const setQuery = useCallback(
    value => {
      const existingQueries = qs.parse(location.search, {
        ignoreQueryPrefix: true,
      })

      const queryString = qs.stringify(
        { ...existingQueries, [query]: value },
        { skipNulls: true }
      )

      navigate(`${location.pathname}?${queryString}`)
    },
    [navigate, location, query]
  )

  return [
    qs.parse(location.search, { ignoreQueryPrefix: true })[query],
    setQuery,
  ]
}

const Tooltip = ({ hoveredInfo }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // position to right of mouse unless x is too close to right edge
  const left_or_right = tooltipPosition.x > window.innerWidth - 200 ? {
    right: `${window.innerWidth - tooltipPosition.x + 10}px`,
  } : {
    left: `${tooltipPosition.x + 10}px`,
  };

  const tooltipStyles = {
    position: "absolute",
    top: `${tooltipPosition.y + 10}px`,
    ...left_or_right,
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
      {hoveredInfo && hoveredInfo.product && (
        <div className="text-xs">{hoveredInfo.product}</div>
        
      )}
      
    </div>
  );
};

const getColor = (feature, product) => {
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
          return colorHash.hex(feature.name+ product+feature.type);
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
      return colorHash.hex(feature.name+ product+feature.type);
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

const baseToComplement = {"A":"T","T":"A","G":"C","C":"G","N":"N","-":"-"};

const getReverseComplement = (sequence) => {
  return sequence.split("").map((base) => baseToComplement[base]).reverse().join("");
}

const SingleRow = ({ parsedSequence, rowStart, rowEnd, setHoveredInfo, rowId, intSearchInput,annotSearchInput , zoomLevel, whereMouseWentDown, setWhereMouseWentDown,
whereMouseWentUp, setWhereMouseWentUp,
whereMouseCurrentlyIs,setWhereMouseCurrentlyIs}) => {

 

  const zoomFactor = 2**zoomLevel;
  const sep = 10 * zoomFactor;




  
 



  const fullSequence = parsedSequence.sequence;
  const rowSequence = fullSequence.slice(rowStart, rowEnd);

  const relevantFeatures = parsedSequence.features.filter(
    (feature) => (
      feature.type !== "source" && 
      feature.type !== "gene" &&
      feature.type !== "mRNA" &&
      (
      (feature.start >= rowStart && feature.start <= rowEnd) ||
      (feature.end >= rowStart && feature.end <= rowEnd) ||
      (feature.start <= rowStart && feature.end >= rowEnd))
    )
  );

  const searchFeatures = !annotSearchInput ? [] : filterFeatures(relevantFeatures,annotSearchInput)

  const isSelected = (intSearchInput>=rowStart && intSearchInput<=rowEnd) || searchFeatures.length>0;

  if (rowStart==0){
    //console.log(relevantFeatures);
  }

  const featureBlocks = relevantFeatures.map((feature, i) => {
   
    let startPos2;
    let endPos2;
    
    if (feature.start < rowStart )
    {
      startPos2 = 0;
     
    }
    else
    {
      startPos2 = feature.start - rowStart;
    }

    if (feature.end > rowEnd)
    {
      endPos2 = rowEnd - rowStart;
      
    }
    else
    {
      endPos2 = feature.end - rowStart;
    }


    const locations = feature.locations ? feature.locations : [{
      start: feature.start,
      end: feature.end,
    }];

    const blocks = locations.filter(
      (location) => (
        (location.start >= rowStart && location.start <= rowEnd) ||
        (location.end >= rowStart && location.end <= rowEnd) ||
        (location.start <= rowStart && location.end >= rowEnd)
      )

    ).map((location, j) => {
      let startPos;
      let endPos;
      let startIsActual = true;
      


    if (location.start < rowStart )
    {
      startPos = 0;
      startIsActual = false;
    }
    else
    {
      startPos = location.start - rowStart;
    }
    let endIsActual = true;
    if (location.end > rowEnd)
    {
      endPos = rowEnd - rowStart;
      endIsActual = false;
    }
    else
    {
      endPos = location.end - rowStart;
    }
  return {
      start: startPos,
      end: endPos,
      startIsActual: startIsActual,
      endIsActual: endIsActual,

  }
  });


    
    
    // positions in the translation
    // for each location in this row: check if it is in any of the locations, if so, figure out which codon it is in
    // and add it to the map

    const seqLength = locations.reduce((acc, location) => acc + location.end - location.start + 1, 0);

    const codonMap = [];
    if (feature.type=="CDS" | feature.type=="mat_peptide"){

    for (let j = rowStart; j < rowEnd; j++) {
      let positionSoFar = 0;
      for (let k = 0; k < locations.length; k++) {
        if (j >= locations[k].start && j <= locations[k].end) {
          
          const codonStart =  (j );
          const codonEnd = codonStart + 2;
          const codonIndexInitial = Math.floor((j - (locations[k].start - positionSoFar)) / 3);
          const codonIndex = feature.strand>0 ? codonIndexInitial : seqLength/3 - codonIndexInitial -1;
          const frame = (j - (locations[k].start - positionSoFar)) % 3;
          if (frame != 1) {
            continue;
          }


          const codonSeq = fullSequence.slice(codonStart-1, codonEnd );
         

          
          const aminoAcid = codonToAminoAcid(feature.strand>0 ? codonSeq : getReverseComplement(codonSeq));
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
      start: startPos2,
      end: endPos2,
    
      blocks: blocks,
      name: feature.name,
      type: feature.type,
      notes: feature.notes,
      strand: feature.strand,
      locations: locations,
      codonMap: codonMap,
      key: i
    });
  });


  const extraPadding = 25;

  // Calculate dimensions and tick interval
  const width = rowSequence.length * sep; // 10 pixels per character
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
        // bold
     
        >
          {label+1}
        </text>
      </g>
    );
  });

  // Generate sequence characters
  let chars = null;

  if (zoomLevel> -1) {chars = rowSequence.split("").map((char, i) => {
    const x = i * sep;
    return (
      <text key={i} x={x} y={10} textAnchor="middle" fontSize={
        zoomLevel< -0.5?"10":"12"} fillOpacity={0.9}
     
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
}
const codonZoomThreshold = -2

  const featureBlocksSVG = featureBlocks.map((feature, i) => {
    const x = feature.start * sep;
    console.log(x, "x");


    const width = (feature.end - feature.start) * sep;
    console.log(width, "width");
    const y = 7 + i * 20;
    const extraFeat=5*zoomFactor;
    const codonPad =15*zoomFactor;

    const product = feature.notes ? feature.notes.product : "";
    let betterName = feature.type =="mat_peptide" ? product : feature.name;

    const altName =feature.type =="mat_peptide" ? feature.name : product;
    if (betterName=="Untitled Feature") betterName=feature.type;


   
    
    return (
      <g key={i}>
        <line x1={x} y1={y+5} x2={x+width} y2={y+5} stroke={getColor(feature,product)} 
        // width 2
        strokeWidth={1.5}
        />
        {feature.blocks.map((block, j) => (

        <rect x={block.start * sep -extraFeat} y={y} width={(block.end-block.start)*sep + extraFeat*2 } height={10} fill={
          getColor(feature, product)
        } 
        onMouseEnter={
          () => {
            if (zoomLevel< codonZoomThreshold)  setHoveredInfo({
            label: `${feature.name}: ${feature.type}`,
            product: altName,
            locusTag: feature.notes && feature.notes.locus_tag ? feature.notes.locus_tag : null,
          })}
        }
        onMouseLeave={() => {
         if (zoomLevel < codonZoomThreshold) setHoveredInfo(null)}}

        
        />
        ))}


        <text x={x-10} y={y} textAnchor="left" fontSize="10"
        >
          {betterName}
        </text>
        {
          feature.codonMap.map((codon, j) => {
            return (<>
              {
                zoomLevel> codonZoomThreshold && <text key={j} x={codon.start*sep} y={y+9} textAnchor="middle" fontSize="10"
              onMouseOver={
                () => setHoveredInfo({
                  label: `${betterName}: ${codon.aminoAcid}${codon.codonIndex+1}`,
                  product: altName,
                  locusTag: feature.notes && feature.notes.locus_tag ? feature.notes.locus_tag : null,

                })
              }
              onMouseLeave={() => setHoveredInfo(null)}

      fillOpacity={0.75}

              >
                {codon.aminoAcid}
              </text>}
              {codon.start >2 && zoomLevel> -0.5 &&
              <text key={"bb"+j} x={codon.start*sep} y={y-1} textAnchor="middle" fontSize="7" fillOpacity={0.4}
              //fontWeight="bold"
              >
                {codon.codonIndex+1}
              </text>
        }
              
              </>
            );
          }

          )

        }
        { zoomLevel>-2 &&
          feature.codonMap.map((codon, j) => {
            // create a line either side of the codon

            return (
              <g key={j}>
                {codon.start>1 && codon.start<3 &&
                <line x1={codon.start*sep-codonPad} y1={y} x2={codon.start*sep-codonPad} y2={y+10} stroke="black" strokeOpacity={0.1} />
          }
                <line x1={codon.start*sep+codonPad} y1={y} x2={codon.start*sep+codonPad} y2={y+10} stroke="black" strokeOpacity={0.1} />
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
  if (intSearchInput != null && intSearchInput >= rowStart && intSearchInput <= rowEnd) {
   searchTick = (
    <g key={-1}>
      <line x1={(intSearchInput-rowStart)*sep} y1={0} x2={(intSearchInput-rowStart)*sep} y2={10} stroke="red" />
      {//rect behind tick
  }
      <rect x={(intSearchInput-rowStart)*sep-30} y={0} width={60} height={30} fill="#ffffee"  />
      <text x={(intSearchInput-rowStart)*sep} y={20} textAnchor="middle" fontSize="10"
      fill="red"
      >
        {intSearchInput+1}
      </text>
    </g>
  );
  }

  let selectionRect = null;
  let selTempStart = null;
  let selTempEnd = null;
  //console.log(whereMouseWentDown, whereMouseWentUp, whereMouseCurrentlyIs);

  if(whereMouseWentDown != null ){
    

  const alternative = whereMouseWentUp != null ? whereMouseWentUp : whereMouseCurrentlyIs;

  const rectStart = Math.min(whereMouseWentDown, alternative);
  const rectEnd = Math.max(whereMouseWentDown, alternative);
  //console.log(rectStart, rectEnd);
  selectionRect = (
    <rect x={extraPadding+(rectStart-rowStart-0.5)*sep} y={0} width={(rectEnd-rectStart)*sep} height={height} fill="#bbbbff" fillOpacity={0.5} />
  );

  }

  
  



  // Concatenate sequence characters and ticks with SVG
  return (
    <div style={{ position: "relative", height: `${height}px`,
    ...(isSelected? {backgroundColor: "#ffffee"} : {})
    
    }} 
    onMouseDown={e => {
      // figure out which nucleotide was clicked
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
      const nucleotide = Math.floor((x - extraPadding) / sep +0.5) + rowStart;
      setWhereMouseWentDown(nucleotide);
      setWhereMouseWentUp(null);
      e.preventDefault();

    }
    }

    onMouseUp={e => {
      // figure out which nucleotide was clicked
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
      const nucleotide = Math.floor((x - extraPadding) / sep +0.5) + rowStart;
      if (Math.abs(nucleotide - whereMouseWentDown) <= 1) {
        // if the mouse didn't move, then this is a click

        setWhereMouseWentDown(null);
        setWhereMouseWentUp(null);
      }
      else {
        // otherwise, this is a drag
        setWhereMouseWentUp(nucleotide);
        e.preventDefault();
      }
    }
    }

    onMouseMove={e => {
      // figure out which nucleotide was clicked
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
      const nucleotide = Math.floor((x - extraPadding) / sep +0.5) + rowStart;
      setWhereMouseCurrentlyIs(nucleotide);
    }
    }

    
    id={`row-${rowId}`}>
      <svg
        width={width+40}
        height={height - 20}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {selectionRect}
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

function SearchPanel({ searchPanelOpen,setSearchPanelOpen,searchInput,setSearchInput,searchType, setSearchType }) {
   

  const handleInputChange = (event) => {
    setSearchInput(event.target.value);
    // if event.target.value has non-numeric characters, then set searchType to annot
    if (event.target.value.match(/[^0-9]/)) {
      setSearchType("annot");
      console.log("setting searchType to annot");
    }
  
  };
  
  const searchOption = [
    { value: "nuc", label: "nucleotide" },
    { value: "annot", label: "annotation" },
  ];

  return (
    <div className="bg-white p-1 text-sm shadow rounded flex items-center">
      {searchPanelOpen ? ((<>
      <select
       
        value={searchType}
        onChange={(option) => setSearchType(option.value)}
        className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-2 rounded inline-flex items-center"
      >
        {searchOption.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>



      <DebounceInput
      minLength={2}
        debounceTimeout={300}
        type="text"
        value={searchInput}
        onChange={handleInputChange}
        className="mx-2 bg-white focus:outline-none focus:shadow-outline border border-gray-300 rounded-lg py-2 px-4 block w-full appearance-none leading-normal"
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
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded inline-flex items-center"
          onClick={() => setSearchPanelOpen(true)}
        >
         <FaSearch className="mr-2" />
        </button>
      )}
    </div>
  );
}

const ConfigPanel = ({zoomLevel,setZoomLevel}) => {
  // zoom slider
  return (
    <>
    <button className="inline-block" onClick={() => setZoomLevel(
      (x) => x-0.1
    )}><AiOutlineZoomOut className="inline-block" /></button>
    <Slider
      value={zoomLevel}
      onChange={(x) => setZoomLevel(x)}
      min={-6.5}
      max={1}
      step={0.001}
      style={{ width: 150 }}
      className="inline-block mx-5"
    />
    <button className="inline-block" onClick={() => setZoomLevel(
      (x) => x+0.1
    )}><AiOutlineZoomIn className="inline-block" /></button>
    </>
  );
};
    






function GensploreView({genbankString, searchInput, setSearchInput}) {
 
   const [searchPanelOpen, setSearchPanelOpen] = useState(false);
   const [zoomLevel, setRawZoomLevel] = useState(0);
   const [whereMouseWentDown, setWhereMouseWentDown] = useState(null);
   const [whereMouseWentUp, setWhereMouseWentUp] = useState(null);
   const [whereMouseCurrentlyIs, setWhereMouseCurrentlyIs] = useState(null);  
   const [searchType, setSearchType] = useState("nuc");

  const [ref, { width }] = useMeasure();
  
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [genbankData, setGenbankData] = useState(null);


  // safely convert searchInput to int
  const intSearchInput = searchType === "nuc" ? parseInt(searchInput) : null;
  const annotSearchInput = searchType === "annot" ? searchInput : null;

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
    const loadGenbankString= async () => {
      try {
        
        const genbankObject = await genbankToJson(genbankString);
        console.log("GenBank file loaded:", genbankObject);
        // to uppercase
        genbankObject[0].parsedSequence.sequence = genbankObject[0].parsedSequence.sequence.toUpperCase();
        setGenbankData(genbankObject[0]);
      } catch (error) {
        console.error("Error loading GenBank file:", error);
      }
    };
    loadGenbankString();
  }, []);


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
  


   // detect ctrl-F and open search panel
   useEffect(() => {
    const handleKeyDown = (e) => {
     
    // ctrl-C
    if ((e.ctrlKey || e.metaKey) && e.keyCode === 67) {
      
      const selStart = Math.min(whereMouseWentDown,whereMouseWentUp);
      const selEnd = Math.max(whereMouseWentDown,whereMouseWentUp);
      //console.log(selStart,selEnd);
      const selectedText = genbankData.parsedSequence.sequence.substring(selStart,selEnd);
      if (selectedText){
      console.log(selectedText);
      navigator.clipboard.writeText(selectedText);
      e.preventDefault();
      }
    }


    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [genbankData, whereMouseWentDown, whereMouseWentUp]);
  


  
  let  rowWidth= Math.floor(width*.0965/(2**zoomLevel));
  // rowWidth minimum 50
  if (rowWidth < 30) {
    rowWidth = 30;
  }
  //console.log("rowWidth", rowWidth);



  let fullSequence, sequenceLength;
  if(genbankData){
    fullSequence = genbankData.parsedSequence.sequence;
    sequenceLength = fullSequence.length;
  }


  const rowData = useMemo(() => {
    if (!fullSequence) return [];
    const rowData = [];

  
  
  for (let i = 0; i < sequenceLength; i += rowWidth) {
   
    rowData.push({
      rowStart: i,
      rowEnd: (i + rowWidth > sequenceLength ? sequenceLength : i + rowWidth)
    });
  }
  return rowData;
}
, [fullSequence, rowWidth,sequenceLength]);


  const parentRef = useRef(null);
  const parentOffsetRef = useRef(0);

  useLayoutEffect(() => {
    parentOffsetRef.current = parentRef.current?.offsetTop ?? 0
  }, [])

  


  const rowVirtualizer = useWindowVirtualizer({
    count: rowData.length,
    estimateSize: () => 60,
    scrollMargin: parentOffsetRef.current,
  })



  const virtualItems = rowVirtualizer.getVirtualItems();
  const [centeredNucleotide, setCenteredNucleotide] = useState(null);
  

  const setZoomLevel = (x) => {
    const middleRow = virtualItems[Math.floor(virtualItems.length / 2)].index
    const middleRowStart = rowData[middleRow].rowStart;
    const middleRowEnd = rowData[middleRow].rowEnd;
    const middleRowMiddle = Math.floor((middleRowStart + middleRowEnd) / 2);
    setCenteredNucleotide(middleRowMiddle);
    console.log("middleRowMiddle", middleRowMiddle);
    setRawZoomLevel(x);
 }

 useEffect(() => {
    if (!centeredNucleotide) return;
    const row = Math.floor(centeredNucleotide / rowWidth);
    rowVirtualizer.scrollToIndex(row, {align:"center",
    smoothScroll:false});
    setCenteredNucleotide(null);
    console.log("scrolling to", centeredNucleotide);
  }, [centeredNucleotide,zoomLevel]);


  const [lastSearch, setLastSearch] = useState(null);

 

  useEffect(() => {
    if(!intSearchInput) return;
    const row = Math.floor(intSearchInput / rowWidth);
    if(intSearchInput === lastSearch){
      return
    }
    // checkrow is valid
    if(row > rowData.length){
      return

    }

      rowVirtualizer.scrollToIndex(row+1, {align:"center"});
    
    setLastSearch(intSearchInput);

  
    

  }, [intSearchInput, rowWidth]);
  useEffect(() => {
    if(!annotSearchInput) return;
    const strippedAnnotInput = annotSearchInput.replace(/\s/g, "");
    if (strippedAnnotInput === "") return;
    // search the features for one that matches
    const matchingFeatures = filterFeatures(genbankData.parsedSequence.features, strippedAnnotInput);
    if(matchingFeatures.length === 0){
      toast.error("No matching features found");
      return;
    }
    const firstMatchingFeature = matchingFeatures[0];
    const row = Math.floor(firstMatchingFeature.start / rowWidth);
    rowVirtualizer.scrollToIndex(row+1, {align:"center"});
    setLastSearch(annotSearchInput);
  }, [annotSearchInput]);





  //console.log("virtualItems", virtualItems);

  if (!genbankData ) {
    return <div>Loading...</div>;
  }

  

  

  if(!width){
    return (
      <div className="w-full h-full p-5">
        <div ref={ref} className="w-full h-full" />
       
      </div>
    );

  }

  return (
    <div className="w-full p-5">
       <ToastContainer />
      {true && (
        <div className="fixed top-0 right-0 z-10">
          <SearchPanel
          searchInput = {searchInput}
          setSearchInput = {setSearchInput}
          searchPanelOpen={searchPanelOpen}
          setSearchPanelOpen={setSearchPanelOpen}
          searchType={searchType}
          setSearchType={setSearchType}
          
          />
        </div>
      )}

      <div className="fixed bottom-0 right-0 z-10 w-64 h-12 p-2 rounded shadow bg-white">
        <ConfigPanel 
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        />
      </div>


     
    <div className="w-full">
      <Tooltip hoveredInfo={hoveredInfo} />
      {genbankData && (
        <div ref={ref} >
          {
            // small logo on left, name and definition on right
          }
          <div className="flex flex-row">
            <div className="flex flex-col">
              <h3 className="text-xl mr-3 text-gray-700 ml-4 font-bold ">
              <a href="/"><GiDna1 className="inline" />
              
                Gensplore
                </a></h3>
              </div>
              </div>
            <div className="flex flex-col ml-4 mt-3 text-gray-900">

          <h2 className="text-2xl"
          >{genbankData.parsedSequence.name}</h2>
          <div>
            <div className="flex flex-row">
              <span>{genbankData.parsedSequence.definition}</span>
              </div>
            

            
            </div>
            </div>
         <div ref={parentRef}  className="mt-5 h-80">
         <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
          className="stripybg"
        >
         <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${
              virtualItems[0].start - rowVirtualizer.options.scrollMargin
            }px)`,
          }}
          className="whitebg"
        >
         
          {virtualItems.map((virtualitem) => {
            const row = rowData[virtualitem.index];
            //return (<div>{genbankData.parsedSequence.sequence.slice(row.start,row.end)}</div>)
            return (
            <div ref={rowVirtualizer.measureElement}
            data-index={virtualitem.index}
            key={virtualitem.key}>
              <SingleRow key={virtualitem.index} parsedSequence={genbankData.parsedSequence} rowStart={row.rowStart} rowEnd={row.rowEnd}
            rowWidth={rowWidth}
            setHoveredInfo={setHoveredInfo}
            rowId={virtualitem.index}
            intSearchInput={intSearchInput-1}
            annotSearchInput={annotSearchInput}
            
            renderProperly={true}
            zoomLevel={zoomLevel}
            whereMouseWentDown={whereMouseWentDown}
            setWhereMouseWentDown={setWhereMouseWentDown}
            whereMouseWentUp={whereMouseWentUp}
            setWhereMouseWentUp={setWhereMouseWentUp}
            whereMouseCurrentlyIs={whereMouseCurrentlyIs}
            setWhereMouseCurrentlyIs={setWhereMouseCurrentlyIs}
          
            />
            </div>)
 } 
          )
}
          </div>
          </div>
          </div>


        </div>
      )}
    </div>
    </div>
  );
  
}


const App = () => {
  const addlExamples = [
    ["Monkeypox clade II","NC_063383.1"],
    ["HIV-1","NC_001802.1"],
    ["M. tuberculosis","https://cov2tree.nyc3.cdn.digitaloceanspaces.com/gensplore/mtb.gb"],
    ["E. coli K12","https://cov2tree.nyc3.cdn.digitaloceanspaces.com/gensplore/k12.gb"]
  
   
   
  ]
  
  // option to either load from URL or upload a file
  const [genbankString, setGenbankString] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadFromUrl = async (url) => {
    setGenbankString(null);
    setLoading(true);
    const response = await fetch(url);
    // check for errors
    if (!response.ok) {
      setLoading(false);
      window.alert("Error loading file: for large Genbank files, try using the 'Load from file' option instead.");
      return;
    }

    const text = await response.text();
    setGenbankString(text);
    setLoading(false);
  };

  const loadFromFile = async (file) => {
   
    const text = await file.text();
  
    setGenbankString(text);
    setLoaded(true);

  };



  const [gbUrl, setGbUrl] = useQueryState("gb")
  const [loaded, setLoaded] = useQueryState("loaded")
  const [searchInput, setSearchInput] = useQueryState("search")

  useEffect(() => {
    if (gbUrl) {
      loadFromUrl(gbUrl);
    }
  }, [gbUrl]);

  const ready = genbankString && (loaded || gbUrl);

  const [beingDraggedOver, setBeingDraggedOver] = useState(false);
  const [genbankId, setGenbankId] = useState(null);

  const loadFromGenbankId = async (id) => {

    const strippedOfWhitespace = id.replace(/\s/g, '')
    // if no length, do nothing
    if (strippedOfWhitespace.length<= 3) {
      return
    }
  
    const url = `https://genbank-api.vercel.app/api/genbank/${strippedOfWhitespace}` 
    setGbUrl(url)
  }


  // create UI for loading from URL or file
  return (<>
    {ready &&<GensploreView genbankString={genbankString} 
    searchInput={searchInput}
    setSearchInput={setSearchInput}
    />}
    {!ready && loading && (
     <div className="w-full h-full text-gray-700 flex flex-col justify-center items-center">
      <ClipLoader color={"#ccc"} loading={loading} size={150} className="mt-20" />
    </div>
      )}

    {!ready && !loading && (

<div className="w-full h-full text-gray-700 flex flex-col justify-center items-center"
// handle dragover
onDragOver={(e) => {
  e.preventDefault();
  setBeingDraggedOver(true);
}}
// handle dragleave
onDragLeave={(e) => {
  e.preventDefault();
  setBeingDraggedOver(false);
}}
// handle drop
onDrop={(e) => {
  
  e.preventDefault();
  setBeingDraggedOver(false);
  loadFromFile(e.dataTransfer.files[0]);
}}





>
<div className="fixed bottom-5 text-center w-full">
    <a className="text-gray-300 hover:text-gray-500" href="https://github.com/theosanderson/gensplore">View code on GitHub</a>
</div>


<h3 className="text-2xl mr-3 text-gray-700 ml-3 font-bold text-center mt-4 mb-4 ">
                <GiDna1 className="inline" />
                
                Gensplore</h3>
  <div className="flex flex-row justify-center">
   
   
    <div className="flex flex-col">
      <h2 className="text-l">Upload a GenBank file, or drag and drop</h2>
      {beingDraggedOver && (
        <div className="border rounded-lg py-2 px-3 mt-2 text-center text-green-500">
          Drop file now to load
          </div>
          )}
      <input
        type="file"
        className="border rounded-lg py-2 px-3 mt-2 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
        onChange={(e) => loadFromFile(e.target.files[0])}
      />
    </div>
  </div>
 
<div className="flex flex-row justify-center mt-5 border-t border-gray-300 pt-5 text-center ">
  
    <div className="flex flex-col">
      <h2 className="text-l mb-5">or enter a GenBank ID:</h2>
     <div>
     <input
        type="text"
        className="border rounded-lg py-2 px-3 mt-2focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
        onChange={(e) => setGenbankId(e.target.value)}
        placeholder="NC..."
      />
      <button
        className="bg-gray-100 ml-3 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded shadow"
        onClick={() =>{
          loadFromGenbankId(genbankId)
        }
        }
      >
        Load
      </button>
     </div>
     <div>
      {genbankId && genbankId.length > 1 && (
        <p className="text-gray-500 text-xs mt-2">
          This will only work for virus-sized genomes, for bacterial genomes please upload a file above.
          </p>)}
     </div>

      
</div>

</div>
<div className="flex flex-row justify-center mt-5 border-t border-gray-300 pt-5 text-center">
    <div className="flex flex-col">
      <h2 className="text-l">or select an example:</h2>
      <ul>
        <li>
          <button
            className="text-blue-400 hover:text-blue-700 mb-3 mt-3"
            onClick={() => setGbUrl("/sequence.gb")}
          >
            SARS-CoV-2 reference genome
          </button>
        </li>
        <li>
          <button
            className="text-blue-400 hover:text-blue-700 mb-3"
            onClick={() => setGbUrl("/sequence2.gb")}
          >
            <i>P. falciparum</i> chromosome 14
          </button>
        </li>
        {addlExamples.map((example) => (
          <li>
            <button
              className="text-blue-400 hover:text-blue-700 mb-3"
              onClick={
                
                example[1].startsWith("http") ? () => setGbUrl(example[1]) :
                () => loadFromGenbankId(example[1])}
            >
              {example[0]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </div>
</div>
    )}
  </>);
};




    

export default App;
