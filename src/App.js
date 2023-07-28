import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
} from "react";
import "rc-slider/assets/index.css";
import "./App.css";

import ClipLoader from "react-spinners/ClipLoader";
import { genbankToJson } from "bio-parsers";
import { useMeasure } from "react-use"; // or just 'react-use-measure'
import { FaSearch, FaTimes, FaZoo } from "react-icons/fa";
import { DebounceInput } from "react-debounce-input";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import Slider, { Range } from "rc-slider";
import { AiOutlineZoomIn, AiOutlineZoomOut } from "react-icons/ai";
import { GiDna1 } from "react-icons/gi";
import {BsArrowRightCircleFill, BsArrowLeftCircleFill} from "react-icons/bs";
import { ToastContainer, toast } from "react-toastify";
import { useDebounce, useQueryState } from "./hooks";
import "react-toastify/dist/ReactToastify.css";
import Tooltip from "./components/Tooltip";
import { getReverseComplement, filterFeatures } from "./utils";
import SingleRow from "./components/SingleRow";



function SearchPanel({
  searchPanelOpen,
  setSearchPanelOpen,
  searchInput,
  setSearchInput,
  searchType,
  setSearchType,
  curSeqHitIndex,
  sequenceHits,
  setCurSeqHitIndex,
  includeRC,
  setIncludeRC
}) {
  const handleInputChange = (event) => {
    setCurSeqHitIndex(0);
    setSearchInput(event.target.value);
    // if event.target.value has only ACGT characters, then set searchType to sequence
    // if event.target.value has non-numeric characters, then set searchType to annot
    // if event.target.value has only numeric characters, then set searchType to nuc
    if (/^[0-9]+$/.test(event.target.value)) {
      setSearchType("nuc");
    }
    else if (/^[ACGTacgt]+$/.test(event.target.value)) {
      setSearchType("sequence");
    }
    else if (/^[^0-9]+$/.test(event.target.value)) {
      setSearchType("annot");
    }

  };

  const searchOption = [
    { value: "nuc", label: "nuc. index" },
    { value: "annot", label: "annotation" },
    { value: "sequence", label: "sequence"}
  ];

  return (
    <div className="bg-white p-1 text-sm shadow rounded ">
      <div className="flex items-center">
      {searchPanelOpen ? (
        <>
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
            placeholder={searchType === "nuc" ? "nuc. index" : searchType === "annot" ? "gene name" : "ATGGC.."}
            id="search-input"
            // don't autocomplete
            autoComplete="off"
          />
          <button
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded inline-flex items-center"
            onClick={() => {
              setSearchPanelOpen(false);
              setSearchInput(null);
            }}
          >
            <FaTimes className="mr-2" />
          </button>
        </>
      ) : (
        <button
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded inline-flex items-center"
          onClick={() => setSearchPanelOpen(true)}
        >
          <FaSearch className="mr-2" />
        </button>
      )}
      </div>
      {
        searchType === "sequence" && (
          <div className="my-2 text-gray-400 text-left px-3">
            <input type="checkbox" value={includeRC} onChange={() => {
              
              setIncludeRC(!includeRC);
          setCurSeqHitIndex(0);
            }
            
        }/>
            <label className="ml-2 text-gray-900">Include reverse complement</label>

            {sequenceHits.length > 0 && (
              <>
              <button>
                <BsArrowLeftCircleFill onClick={() => setCurSeqHitIndex((x) => x==0? sequenceHits.length-1: x-1)}
                className="mx-3 text-gray-600" />
              </button>
          
          
            
            
            Hit {curSeqHitIndex + 1} of {sequenceHits.length}

          
              <button>
                <BsArrowRightCircleFill onClick={() => setCurSeqHitIndex((x) => x==sequenceHits.length-1? 0: x+1)}
                className="mx-3 text-gray-600" />
              </button>
              </>
            )}
            {sequenceHits.length === 0 && (
              <>
                No hits found
              </>
            )}
          </div>
        )

      }
    </div>
  );
}

const ConfigPanel = ({ zoomLevel, setZoomLevel }) => {
  // zoom slider
  return (
    <>
      <button
        className="inline-block"
        onClick={() => setZoomLevel((x) => x - 0.1)}
      >
        <AiOutlineZoomOut className="inline-block" />
      </button>
      <Slider
        value={zoomLevel}
        onChange={(x) => setZoomLevel(x)}
        min={-9.5}
        max={1}
        step={0.001}
        style={{ width: 150 }}
        className="inline-block mx-5"
      />
      <button
        className="inline-block"
        onClick={() => setZoomLevel((x) => x + 0.1)}
      >
        <AiOutlineZoomIn className="inline-block" />
      </button>
    </>
  );
};

function GensploreView({ genbankString, searchInput, setSearchInput }) {
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [zoomLevel, setRawZoomLevel] = useState(0);
  const [whereMouseWentDown, setWhereMouseWentDown] = useState(null);
  const [whereMouseWentUp, setWhereMouseWentUp] = useState(null);
  const [whereMouseCurrentlyIs, setWhereMouseCurrentlyIs] = useState(null);
  const [searchType, setSearchType] = useState("nuc");

  const [ref, { width }] = useMeasure();

  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [genbankData, setGenbankData] = useState(null);
  const [sequenceHits, setSequenceHits] = useState([]);
  const [curSeqHitIndex, setCurSeqHitIndex] = useState(0);
  const [includeRC, setIncludeRC] = useState(false);

  // safely convert searchInput to int
  const intSearchInput = searchType === "nuc" ? parseInt(searchInput) : null;
  const annotSearchInput = searchType === "annot" ? searchInput : null;
  const sequenceSearchInput = searchType === "sequence" ? searchInput.toUpperCase() : null;

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
    const loadGenbankString = async () => {
      try {
        const genbankObject = await genbankToJson(genbankString);
        console.log("GenBank file loaded:", genbankObject);
        // to uppercase
        genbankObject[0].parsedSequence.sequence =
          genbankObject[0].parsedSequence.sequence.toUpperCase();
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
        }, 100);
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
        const selStart = Math.min(whereMouseWentDown, whereMouseWentUp);
        const selEnd = Math.max(whereMouseWentDown, whereMouseWentUp);
        //console.log(selStart,selEnd);
        let selectedText = genbankData.parsedSequence.sequence.substring(
          selStart,
          selEnd
        );
        if (selectedText) {
          if (e.shiftKey) {
            selectedText = getReverseComplement(selectedText);
          }
          console.log(selectedText);
          navigator.clipboard.writeText(selectedText);
          toast.success(
            `Copied ${e.shiftKey ? "reverse complement" : ""} to clipboard`
          );
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [genbankData, whereMouseWentDown, whereMouseWentUp]);

  let rowWidth = Math.floor((width * 0.0965) / 2 ** zoomLevel);
  // rowWidth minimum 50
  if (rowWidth < 30) {
    rowWidth = 30;
  }
  //console.log("rowWidth", rowWidth);

  let fullSequence, sequenceLength;
  if (genbankData) {
    fullSequence = genbankData.parsedSequence.sequence;
    sequenceLength = fullSequence.length;
  }

  const rowData = useMemo(() => {
    if (!fullSequence) return [];
    const rowData = [];

    for (let i = 0; i < sequenceLength; i += rowWidth) {
      rowData.push({
        rowStart: i,
        rowEnd: i + rowWidth > sequenceLength ? sequenceLength : i + rowWidth,
      });
    }
    return rowData;
  }, [fullSequence, rowWidth, sequenceLength]);

  const parentRef = useRef(null);
  const parentOffsetRef = useRef(0);

  useLayoutEffect(() => {
    parentOffsetRef.current = parentRef.current?.offsetTop ?? 0;
  }, []);

  const rowVirtualizer = useWindowVirtualizer({
    count: rowData.length,
    estimateSize: () => 90,
    scrollMargin: parentOffsetRef.current,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const [centeredNucleotide, setCenteredNucleotide] = useState(null);

  const setZoomLevel = (x) => {
    const middleRow = virtualItems[Math.floor(virtualItems.length / 2)].index;
    const middleRowStart = rowData[middleRow].rowStart;
    const middleRowEnd = rowData[middleRow].rowEnd;
    const middleRowMiddle = Math.floor((middleRowStart + middleRowEnd) / 2);
    setCenteredNucleotide(middleRowMiddle);
    console.log("middleRowMiddle", middleRowMiddle);
    setRawZoomLevel(x);
  };

  useEffect(() => {
    if (!centeredNucleotide) return;
    // if there is a selection, use that instead
    if (whereMouseWentDown && whereMouseWentUp) {
      const midPoint = Math.floor((whereMouseWentDown + whereMouseWentUp) / 2);
      rowVirtualizer.scrollToIndex(3 + Math.floor(midPoint / rowWidth), {
        align: "center",
        smoothScroll: false,
      });
      setCenteredNucleotide(null);
      return;
    }
    const row = Math.floor(centeredNucleotide / rowWidth);
    rowVirtualizer.scrollToIndex(row, {
      align: "center",
      smoothScroll: false,
    });
    setCenteredNucleotide(null);
    console.log("scrolling to", centeredNucleotide);
  }, [centeredNucleotide, zoomLevel]);

  const [lastSearch, setLastSearch] = useState(null);

  useEffect(() => {
    if (!intSearchInput) return;
    const row = Math.floor(intSearchInput / rowWidth);
    if (intSearchInput === lastSearch) {
      return;
    }
    // checkrow is valid
    if (row > rowData.length) {
      return;
    }

    rowVirtualizer.scrollToIndex(row + 1, { align: "center" });

    setLastSearch(intSearchInput);
  }, [intSearchInput, rowWidth]);
  useEffect(() => {
    if (!annotSearchInput) return;
    const strippedAnnotInput = annotSearchInput.replace(/\s/g, "");
    if (strippedAnnotInput === "") return;
    // search the features for one that matches
    const matchingFeatures = filterFeatures(
      genbankData.parsedSequence.features,
      strippedAnnotInput
    );
    if (matchingFeatures.length === 0) {
      toast.error("No matching features found");
      return;
    }
    const firstMatchingFeature = matchingFeatures[0];
    const row = Math.floor(firstMatchingFeature.start / rowWidth);
    rowVirtualizer.scrollToIndex(row + 1, { align: "center" });
    setLastSearch(annotSearchInput);
  }, [annotSearchInput]);


  useEffect(() => {
    if(!sequenceSearchInput) {
      setSequenceHits([]);
      return;
    }
    const strippedSequenceInput = sequenceSearchInput.replace(/\s/g, "");
    if (strippedSequenceInput === ""){
      setSequenceHits([]);
      return;
    }
    console.log("strippedSequenceInput", strippedSequenceInput);
    const matchingSequence = fullSequence.indexOf(strippedSequenceInput);
    
    if(matchingSequence === -1) {
      //toast.error("No matching sequence found");
      setSequenceHits([]);

      return;
    }
    // we want to find all locations that match and store them with setSequenceHits as [start,end]
    const seqHits = [];
    let start = 0;
    const rc = getReverseComplement(strippedSequenceInput);
    console.log("rc", rc);
    while (true) {
      const hit1 = fullSequence.indexOf(strippedSequenceInput, start);
      const hit2 = includeRC ? fullSequence.indexOf(rc, start) : -1;
      const hit = hit1 === -1 ? hit2 : (hit2 === -1 ? hit1 : Math.min(hit1, hit2));

      if (hit === -1) break;
      seqHits.push([hit, hit + strippedSequenceInput.length]);
      start = hit + 1;
    }
    setSequenceHits(seqHits);

    const row = Math.floor(seqHits[curSeqHitIndex][0] / rowWidth);
    console.log("row", row);
    rowVirtualizer.scrollToIndex(row + 1, { align: "center" });
    setLastSearch(sequenceSearchInput);
  }, [sequenceSearchInput, curSeqHitIndex,includeRC]);


  //console.log("virtualItems", virtualItems);

  if (!genbankData) {
    return <div>Loading...</div>;
  }

  if (!width) {
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
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            searchPanelOpen={searchPanelOpen}
            setSearchPanelOpen={setSearchPanelOpen}
            searchType={searchType}
            setSearchType={setSearchType}
            curSeqHitIndex={curSeqHitIndex}
            setCurSeqHitIndex={setCurSeqHitIndex}
            sequenceHits={sequenceHits}
            includeRC={includeRC}
            setIncludeRC={setIncludeRC}
          />
        </div>
      )}

      <div className="fixed bottom-0 right-0 z-10 w-64 h-12 p-2 rounded shadow bg-white">
        <ConfigPanel zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} />
      </div>

      <div className="w-full">
        <Tooltip hoveredInfo={hoveredInfo} />
        {genbankData && (
          <div ref={ref}>
            {
              // small logo on left, name and definition on right
            }
            <div className="flex flex-row">
              <div className="flex flex-col">
                <h3 className="text-xl mr-3 text-gray-700 ml-4 font-bold ">
                  <a href="/">
                    <GiDna1 className="inline" />
                    Gensplore
                  </a>
                </h3>
              </div>
            </div>
            <div className="flex flex-col ml-4 mt-3 text-gray-900">
              <h2 className="text-2xl">{genbankData.parsedSequence.name}</h2>
              <div>
                <div className="flex flex-row">
                  <span>{genbankData.parsedSequence.definition}</span>
                </div>
              </div>
            </div>
            <div ref={parentRef} className="mt-5 h-80">
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  width: "100%",
                  position: "relative",
                }}
                className="stripybg"
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${
                      virtualItems[0].start -
                      rowVirtualizer.options.scrollMargin
                    }px)`,
                  }}
                  className="whitebg"
                >
                  {virtualItems.map((virtualitem) => {
                    const row = rowData[virtualitem.index];
                    //return (<div>{genbankData.parsedSequence.sequence.slice(row.start,row.end)}</div>)
                    return (
                      <div
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualitem.index}
                        key={virtualitem.key}
                      >
                        <SingleRow
                          key={virtualitem.index}
                          parsedSequence={genbankData.parsedSequence}
                          rowStart={row.rowStart}
                          rowEnd={row.rowEnd}
                          rowWidth={rowWidth}
                          setHoveredInfo={setHoveredInfo}
                          rowId={virtualitem.index}
                          intSearchInput={intSearchInput - 1}
                          annotSearchInput={annotSearchInput}
                          renderProperly={true}
                          zoomLevel={zoomLevel}
                          whereMouseWentDown={whereMouseWentDown}
                          setWhereMouseWentDown={setWhereMouseWentDown}
                          whereMouseWentUp={whereMouseWentUp}
                          setWhereMouseWentUp={setWhereMouseWentUp}
                          whereMouseCurrentlyIs={whereMouseCurrentlyIs}
                          setWhereMouseCurrentlyIs={setWhereMouseCurrentlyIs}
                          sequenceHits={sequenceHits}
                          curSeqHitIndex={curSeqHitIndex}
                        />
                      </div>
                    );
                  })}
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
    ["Mpox clade II", "NC_063383.1"],
    ["HIV-1", "NC_001802.1"],
    [
      "M. tuberculosis",
      "https://cov2tree.nyc3.cdn.digitaloceanspaces.com/gensplore/mtb.gb",
    ],
    [
      "E. coli K12",
      "https://cov2tree.nyc3.cdn.digitaloceanspaces.com/gensplore/k12.gb",
    ],
  ];

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
      window.alert(
        "Error loading file: for large Genbank files, try using the 'Load from file' option instead."
      );
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

  const [gbUrl, setGbUrl] = useQueryState("gb");
  const [loaded, setLoaded] = useQueryState("loaded");
  const [searchInput, setSearchInput] = useQueryState("search");

  useEffect(() => {
    if (gbUrl) {
      loadFromUrl(gbUrl);
    }
  }, [gbUrl]);

  const ready = genbankString && (loaded || gbUrl);

  const [beingDraggedOver, setBeingDraggedOver] = useState(false);
  const [genbankId, setGenbankId] = useState(null);

  const loadFromGenbankId = async (id) => {
    const strippedOfWhitespace = id.replace(/\s/g, "");
    // if no length, do nothing
    if (strippedOfWhitespace.length <= 3) {
      return;
    }

    const url = `https://genbank-api.vercel.app/api/genbank/${strippedOfWhitespace}`;
    setGbUrl(url);
  };

  const [genbankResults, setGenbankResults] = useState(null);

  const doGenBankSearch = async (searchTerm) => {
    let query =
      searchTerm +
      ' AND genome AND (biomol_genomic[PROP] AND ("1"[SLEN] : "1000000"[SLEN]))';
    /// restrict to viruses, bacteria and protists, or SAR
    query +=
      ' AND ("Viruses"[Organism] OR "Bacteria"[Organism] OR "Protista"[Organism] OR "SAR"[Organism])';
    const url = `https://genbank-api.vercel.app/api/genbank_search/${query}`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        data = data.filter((d) => d.accession != "uids");
        setGenbankResults(data);
      });
  };
  // debounce the search
  const debouncedId = useDebounce(genbankId, 500);

  useEffect(() => {
    if (debouncedId) {
      //doGenBankSearch(debouncedId);
      console.log("would search");
    }
  }, [debouncedId]);

  // create UI for loading from URL or file
  return (
    <>
      {ready && (
        <GensploreView
          genbankString={genbankString}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
        />
      )}
      {!ready && loading && (
        <div className="w-full h-full text-gray-700 flex flex-col justify-center items-center">
          <ClipLoader
            color={"#ccc"}
            loading={loading}
            size={150}
            className="mt-20"
          />
        </div>
      )}

      {!ready && !loading && (
        <div
          className="w-full h-full text-gray-700 flex flex-col justify-center items-center"
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
            <a
              className="text-gray-300 hover:text-gray-500"
              href="https://github.com/theosanderson/gensplore"
            >
              View code on GitHub
            </a>
          </div>

          <h3 className="text-2xl mr-3 text-gray-700 ml-3 font-bold text-center mt-4 mb-4 ">
            <GiDna1 className="inline" />
            Gensplore
          </h3>
          <div className="flex flex-row justify-center">
            <div className="flex flex-col">
              <h2 className="text-l">
                Upload a GenBank file, or drag and drop
              </h2>
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
                  onKeyUp={(e) => {
                    if (e.key === "Enter") {
                      loadFromGenbankId(genbankId);
                    }
                  }}
                />
                <button
                  className="bg-gray-100 ml-3 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 border border-gray-400 rounded shadow"
                  onClick={() => {
                    loadFromGenbankId(genbankId);
                  }}
                >
                  Load accession
                </button>
              </div>
              <div>
                {genbankId && genbankId.length > 1 && (
                  <p className="text-gray-500 text-xs mt-2">
                    This will only work for virus-sized genomes, for bacterial
                    genomes please upload a file above.
                  </p>
                )}
              </div>
              {genbankResults && genbankResults.length > 0 && (
                <div className="mt-5 text-xs">
                  <h3 className="text-l">
                    We also tried searching for this query:
                  </h3>
                  <div
                    // scroll y
                    className="h-24 overflow-y-auto"
                  >
                    <ul>
                      {genbankResults.map((result) => (
                        <li key={result.description}>
                          <button
                            className="text-blue-400 hover:text-blue-700 mb-1 mt-1"
                            onClick={() =>
                              setGbUrl(
                                `https://genbank-api.vercel.app/api/genbank/${result.description}`
                              )
                            }
                          >
                            {result.description}: {result.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
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
                        example[1].startsWith("http")
                          ? () => setGbUrl(example[1])
                          : () => loadFromGenbankId(example[1])
                      }
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
    </>
  );
};

export default App;
