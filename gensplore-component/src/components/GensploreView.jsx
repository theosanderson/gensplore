import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useLayoutEffect,
    useCallback,
  } from "react";
  
import "../App.css"
import Offcanvas from './Offcanvas';
import ContextMenu from './ContextMenu';

import Tooltip from "./Tooltip";
import { getReverseComplement, filterFeatures } from "../utils";
import SingleRow from "./SingleRow";
import SettingsPanel from "./SettingsPanel";
import { Dialog } from "@headlessui/react";
import { genbankToJson } from "bio-parsers";
import { useMeasure } from "react-use"; // or just 'react-use-measure'
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ToastContainer, toast } from "react-toastify";
import SearchPanel from "../SearchPanel";

function GensploreView({ genbankString, searchInput, setSearchInput }) {
    const [searchPanelOpen, setSearchPanelOpen] = useState(false);
    const [zoomLevel, setRawZoomLevel] = useState(0);
    const [whereMouseWentDown, setWhereMouseWentDown] = useState(null);
    const [whereMouseWentUp, setWhereMouseWentUp] = useState(null);
    const [whereMouseCurrentlyIs, setWhereMouseCurrentlyIs] = useState(null);
    const [searchType, setSearchType] = useState("nuc");
  
    const [ref, { width }] = useMeasure();
  
    const [hoveredInfo, setHoveredInfo] = useState(null);
    const [contextMenu, setContextMenu] = useState({ x: null, y: null });
    const [genbankData, setGenbankData] = useState(null);
    const [sequenceHits, setSequenceHits] = useState([]);
    const [curSeqHitIndex, setCurSeqHitIndex] = useState(0);
    const [includeRC, setIncludeRC] = useState(false);
  
    // safely convert searchInput to int
    const intSearchInput = searchType === "nuc" ? parseInt(searchInput) : null;
    const annotSearchInput = searchType === "annot" ? searchInput : null;
    const sequenceSearchInput = searchType === "sequence" && searchInput ? searchInput.toUpperCase() : null;
  
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
          if (whereMouseWentDown !== null && whereMouseWentUp !== null) {
            copySelectedSequence(e.shiftKey);
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
    const [enableRC, setEnableRC] = useState(false);
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [scrollToFeature, setScrollToFeature] = useState(null);
  
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
      if (!scrollToFeature) return;
      const row = Math.floor(scrollToFeature.start / rowWidth);
      rowVirtualizer.scrollToIndex(row + 1, { align: "center" });

      setScrollToFeature(null);
    }, [scrollToFeature, rowWidth]);



      
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
      
      // we want to find all locations that match and store them with setSequenceHits as [start,end]
      const seqHits = [];
      let start = 0;
      const rc = getReverseComplement(strippedSequenceInput);
      console.log("rc", rc);
      while (true) {
        const hit1 = fullSequence.indexOf(strippedSequenceInput, start);
        const hit2 = includeRC ? fullSequence.indexOf(rc, start) : -1;
        let hit;

if (hit1 === -1) {
    // If hit1 is -1, use hit2 (regardless of what hit2 is)
    hit = hit2;
} else if (hit2 === -1) {
    // If hit1 is not -1 but hit2 is, use hit1
    hit = hit1;
} else {
    // If neither hit1 nor hit2 is -1, take the smaller of the two
    hit = Math.min(hit1, hit2);
}
  
        if (hit === -1) break;
        seqHits.push([hit, hit + strippedSequenceInput.length]);
        start = hit + 1;
      }
      setSequenceHits(seqHits);
    console.log("length",seqHits.length)
     if(seqHits.length==0){
         return
     }
  
      const row = Math.floor(seqHits[curSeqHitIndex][0] / rowWidth);
      console.log("row", row);
      rowVirtualizer.scrollToIndex(row + 1, { align: "center" });
      setLastSearch(sequenceSearchInput);
    }, [sequenceSearchInput, curSeqHitIndex,includeRC]);
  
    const [featureOffcanvasOpen, setFeatureOffcanvasOpen] = useState(false);
    const [featureVisibility, setFeatureVisibility] = useState({});
    const visibleFeatures = useMemo(() => {
        if (!genbankData) return [];
        const visibleFeatures = [];
        genbankData.parsedSequence.features.forEach((feature, i) => {
            if (featureVisibility[i]) {
                visibleFeatures.push(feature);
            }
        });
        return visibleFeatures;
    }, [featureVisibility, genbankData]);



  useEffect(() => {
    if (!genbankData) return;
    const newFeatureVisibility = {};
    /*
       feature.type !== "source" &&
      feature.type !== "gene" &&
      feature.type !== "mRNA" &&
      */
    genbankData.parsedSequence.features.forEach((feature, i) => {
        newFeatureVisibility[i] = feature.type !== "source" && feature.type !== "gene" && feature.type !== "mRNA"
    }
    );
    setFeatureVisibility(newFeatureVisibility);
    }, [genbankData]);

  
    // Handle context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      
        setContextMenu({ x: e.clientX, y: e.clientY });
      
    };

    const handleCloseContextMenu = () => {
      setContextMenu({ x: null, y: null });
    };

    const copySelectedSequence = (asReverseComplement = false) => {
      if (whereMouseWentDown===null || whereMouseWentUp===null) return;
      
      const selStart = Math.min(whereMouseWentDown, whereMouseWentUp);
      const selEnd = Math.max(whereMouseWentDown, whereMouseWentUp);
      let selectedText = genbankData.parsedSequence.sequence.substring(selStart, selEnd);
      
      if (asReverseComplement) {
        selectedText = getReverseComplement(selectedText);
      }
      
      navigator.clipboard.writeText(selectedText);
      toast.success(`Copied ${asReverseComplement ? 'reverse complement ' : ''}to clipboard`);
    };

    const handleCopySelection = () => {
      copySelectedSequence(false);
      handleCloseContextMenu();
    };

    const handleCopyRC = () => {
      copySelectedSequence(true);
      handleCloseContextMenu();
    };

    useEffect(() => {
      document.addEventListener('click', handleCloseContextMenu);
      return () => {
        document.removeEventListener('click', handleCloseContextMenu);
      };
    }, []);


  
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
  

    return (<>
      <div onContextMenu={handleContextMenu}>
    <Dialog
    open={configModalOpen}
    onClose={() => setConfigModalOpen(false)}
    className="fixed z-50 max-w-2xl px-4 py-6 bg-white rounded-lg shadow-xl sm:px-6 sm:py-8 sm:pb-4 sm:pt-6"
  >
  
    <Dialog.Panel
      className="fixed inset-0 flex items-center justify-center bg-gray-500 bg-opacity-75 transition-opacity"
      style={{ zIndex: 1000 }}
    >
      <div className="bg-white rounded-lg px-4 py-4 sm:px-6 sm:py-6 shadow-md max-w-md mx-auto">
        <Dialog.Title
          as="h3"
          className="text-lg font-medium leading-6 text-gray-900 mb-4"
        >
        Settings
        </Dialog.Title>
  
        <Dialog.Description
          className="text-base text-gray-600 mb-4"
        >
          Customize appearance
        </Dialog.Description>
  
        <p className="text-sm text-gray-500">
        <label>
          <input type="checkbox" checked={enableRC} onChange={(e) => setEnableRC(e.target.checked)} /> 
          <span className="ml-2">Display antisense strand</span>
          </label>
        </p>
  
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-transparent rounded-md hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            onClick={() => setConfigModalOpen(false)}
          >
            Close
          </button>
          </div>
      </div>
    </Dialog.Panel>
  </Dialog>
  
  
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
  
        <div className="fixed bottom-0 right-0 z-10 w-72 h-12 p-2 rounded shadow bg-white">
          <SettingsPanel zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} configModalOpen={configModalOpen} setConfigModalOpen={setConfigModalOpen}
          setFeatureOffcanvasOpen={setFeatureOffcanvasOpen} />
        </div>
  
        <div className="w-full">
          <Tooltip hoveredInfo={hoveredInfo} />
          {genbankData && (
            <div ref={ref}>
              {
                // small logo on left, name and definition on right
              }
              {whereMouseWentDown !== null && whereMouseWentUp !== null && (
                <div className="fixed bottom-1 left-1 z-10 px-2 py-2 text-xs rounded shadow bg-white text-gray-700">
                  Selection: {Math.min(whereMouseWentDown, whereMouseWentUp)} - {Math.max(whereMouseWentDown, whereMouseWentUp)}
                  <br/>
                  Length: {Math.abs(whereMouseWentUp - whereMouseWentDown)}
                </div>
              )}
            
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
                            visibleFeatures={visibleFeatures}
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
                            enableRC={enableRC}
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

      {contextMenu.x !== null && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onCopy={handleCopySelection}
          onCopyRC={handleCopyRC}
        />
      )}
   
      {featureOffcanvasOpen && (
        <Offcanvas isOpen={featureOffcanvasOpen} onClose={() => setFeatureOffcanvasOpen(false)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
         
            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Feature
            </th>
            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">

            </th>
            
           
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
            
          {genbankData?.parsedSequence.features.map((feature, index) => (
            
            <tr key={index} 
            >
              
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                <input
                  type="checkbox"
                  className="focus:ring-indigo-500 text-indigo-600 border-gray-300 rounded mr-2"
                  checked={!!featureVisibility[index]}
                  onChange={() => {
                    const newFeatureVisibility = { ...featureVisibility };
                    newFeatureVisibility[index] = !newFeatureVisibility[index];
                    setFeatureVisibility(newFeatureVisibility);
                  }
                    }
                />
              {feature.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{
                feature.notes?.product?.join(", ")
              }</td>
              
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{feature.type}</td>
              <td>
              <button
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-1 px-1 border border-gray-400 rounded shadow text-sm "
                onClick={() => {
                  setFeatureOffcanvasOpen(false);
                  setScrollToFeature(feature);
                 
                }}
              >
                Go to
              </button>

              </td>
             
              
            </tr>
          ))}
        </tbody>
      </table>
        </Offcanvas>
      )}
      </div>
    </>
  );
}

export default GensploreView;
