import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useLayoutEffect,
  } from "react";
import { FaRegCopy } from "react-icons/fa";
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
import VariantPanel from "./VariantPanel";
import ClipLoader from "react-spinners/ClipLoader";
import {
  diffSequences,
  mapVariantsToFeatures,
  DEFAULT_MAX_DIFF_SIZE,
} from "../utils/comparison";

function GensploreView({
    genbankString,
    searchInput = '',
    setSearchInput = () => {},
    setTitleCallback,
    compareSequence,
    compareLoading = false,
    compareError = null,
    onCompareFile = () => {},
    onCompareUrl = () => {},
    onClearCompare = () => {},
  }) {
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
    const [variantEvents, setVariantEvents] = useState([]);
    const [variantStats, setVariantStats] = useState(null);
    const [variantPanelOpen, setVariantPanelOpen] = useState(false);
    const [activeVariantIndex, setActiveVariantIndex] = useState(0);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [compareComputeState, setCompareComputeState] = useState("idle");
    const [compareComputeError, setCompareComputeError] = useState(null);
    const [compareModalOpen, setCompareModalOpen] = useState(false);
    const [compareUrlInput, setCompareUrlInput] = useState("");
  
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
      if (!genbankString) {
        setGenbankData(null);
        return;
      }

      const loadGenbankString = async () => {
        try {
          const genbankObject = await genbankToJson(genbankString);
          if (!Array.isArray(genbankObject) || genbankObject.length === 0) {
            throw new Error("Unable to parse GenBank content");
          }
          const parsed = genbankObject[0];
          if (!parsed?.parsedSequence?.sequence) {
            throw new Error("GenBank record missing sequence data");
          }
          parsed.parsedSequence.sequence = parsed.parsedSequence.sequence.toUpperCase();
          setGenbankData(parsed);
          if (setTitleCallback) {
            setTitleCallback(parsed.parsedSequence.name + " | Gensplore");
          }
        } catch (error) {
          console.error("Error loading GenBank file:", error);
          toast.error("Unable to parse GenBank input. Please verify the file contents.");
          setGenbankData(null);
        }
      };

      loadGenbankString();
    }, [genbankString, setTitleCallback]);
  
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

    const variantsByRow = useMemo(() => {
      if (!variantEvents || variantEvents.length === 0 || !rowWidth) {
        return new Map();
      }

      const map = new Map();
      const maxRowIndex = Math.max(rowData.length - 1, 0);

      const pushToRow = (rowIndex, variant) => {
        if (rowIndex < 0) return;
        const safeRow = Math.min(rowIndex, maxRowIndex);
        const existing = map.get(safeRow) || [];
        existing.push(variant);
        map.set(safeRow, existing);
      };

      variantEvents.forEach((variant) => {
        if (!variant) return;

        if (variant.kind === "insertion") {
          const rowIndex = Math.floor(variant.zeroBasedRefPos / rowWidth);
          pushToRow(rowIndex, variant);
          return;
        }

        const start = Math.max(0, variant.zeroBasedRefPos);
        const end = Math.max(start, variant.zeroBasedRefPos + Math.max(variant.length - 1, 0));
        const startRow = Math.floor(start / rowWidth);
        const endRow = Math.floor(end / rowWidth);
        for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
          pushToRow(rowIndex, variant);
        }
      });

      return map;
    }, [variantEvents, rowWidth, rowData.length]);
  
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

    useEffect(() => {
      if (!variantEvents || variantEvents.length === 0) {
        return;
      }
      if (activeVariantIndex < 0 || activeVariantIndex >= variantEvents.length) {
        return;
      }
      if (!rowWidth || rowData.length === 0) {
        return;
      }

      const targetVariant = variantEvents[activeVariantIndex];
      if (!targetVariant) {
        return;
      }
      const targetPos = Math.max(targetVariant.zeroBasedRefPos, 0);
      const row = Math.floor(targetPos / rowWidth);
      const safeRow = Math.min(Math.max(row, 0), rowData.length - 1);
      rowVirtualizer.scrollToIndex(safeRow + 1, { align: "center" });
      setSelectedVariantId(targetVariant.id);
    }, [activeVariantIndex, variantEvents, rowWidth, rowData.length, rowVirtualizer]);

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


    useEffect(() => {
      if (!genbankData?.parsedSequence?.sequence || !compareSequence?.sequence) {
        setVariantEvents([]);
        setVariantStats(null);
        setActiveVariantIndex(0);
        setSelectedVariantId(null);
        setCompareComputeState(compareSequence ? "idle" : "inactive");
        setCompareComputeError(null);
        return;
      }

      let cancelled = false;
      const runComparison = async () => {
        setCompareComputeState("running");
        setCompareComputeError(null);
        try {
          await new Promise((resolve) => setTimeout(resolve, 0));
          const { variants, stats } = diffSequences(
            genbankData.parsedSequence.sequence,
            compareSequence.sequence
          );
          if (cancelled) return;
          const annotatedVariants = mapVariantsToFeatures(
            variants,
            genbankData.parsedSequence.features
          );
          setVariantEvents(annotatedVariants);
          setVariantStats({
            ...stats,
            comparisonHeader: compareSequence.header,
            comparisonLength: compareSequence.length,
          });
          setCompareComputeState("completed");
          if (annotatedVariants.length > 0) {
            setActiveVariantIndex(0);
            setSelectedVariantId(annotatedVariants[0].id);
          } else {
            setActiveVariantIndex(-1);
            setSelectedVariantId(null);
          }
        } catch (err) {
          if (cancelled) return;
          console.error(err);
          setVariantEvents([]);
          setVariantStats(null);
          setCompareComputeState("error");
          setCompareComputeError(err.message || "Failed to compare sequences");
        }
      };

      runComparison();

      return () => {
        cancelled = true;
      };
    }, [genbankData, compareSequence]);

  
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

    const handleVariantSelect = (variant) => {
      if (!variantEvents || variantEvents.length === 0) return;
      if (!variant) return;
      const index = variantEvents.findIndex((v) => v.id === variant.id);
      if (index !== -1) {
        setActiveVariantIndex(index);
        setVariantPanelOpen(true);
      }
    };

    const navigateVariants = (direction) => {
      if (!variantEvents || variantEvents.length === 0) return;
      setVariantPanelOpen(true);
      setActiveVariantIndex((prev) => {
        if (prev < 0) {
          return 0;
        }
        if (direction === "next") {
          return prev >= variantEvents.length - 1 ? 0 : prev + 1;
        }
        if (direction === "prev") {
          return prev <= 0 ? variantEvents.length - 1 : prev - 1;
        }
        return prev;
      });
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

    useEffect(() => {
      if (!compareModalOpen) {
        setCompareUrlInput("");
      }
    }, [compareModalOpen]);


  
    //console.log("virtualItems", virtualItems);
  
    if (!width) {
      return (
        <div className="w-full h-full p-5">
          <div ref={ref} className="w-full h-full" />
        </div>
      );
    }

    if (!genbankData) {
      return (
        <div className="w-full h-full flex items-center justify-center text-gray-600">
          Awaiting GenBank content…
        </div>
      );
    }


    const hasComparison = Boolean(compareSequence?.sequence);
    const totalVariants = variantEvents.length;
    const comparisonErrorMessage = compareError || compareComputeError;
    const isComparisonBusy = compareLoading || compareComputeState === "running";
    const comparisonIdentity = variantStats?.identity;
    const comparisonCoverage = variantStats?.coverage;

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

    <Dialog
      open={compareModalOpen}
      onClose={() => setCompareModalOpen(false)}
      className="fixed inset-0 z-[1200] overflow-y-auto"
    >
      <div className="flex min-h-full items-center justify-center px-4 py-6 text-center">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
        <Dialog.Panel className="relative w-full max-w-xl transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
          <Dialog.Title className="text-lg font-medium text-gray-900">
            Load comparison FASTA
          </Dialog.Title>
          <p className="mt-1 text-sm text-gray-500">
            Compare the current genome with a secondary FASTA sequence (≤ {DEFAULT_MAX_DIFF_SIZE.toLocaleString()} bp recommended).
          </p>

          {compareError && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {compareError}
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Fetch from URL</label>
              <div className="mt-2 flex gap-2">
                <input
                  type="url"
                  value={compareUrlInput}
                  onChange={(e) => setCompareUrlInput(e.target.value)}
                  placeholder="https://example.com/sequence.fasta"
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  className="px-3 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                  onClick={() => {
                    const trimmed = compareUrlInput.trim();
                    if (!trimmed) return;
                    onCompareUrl(trimmed);
                    setCompareModalOpen(false);
                  }}
                >
                  Load
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Upload FASTA file</label>
              <input
                type="file"
                accept=".fa,.fasta,.fna,.txt,.seq"
                className="mt-2 block w-full text-sm text-gray-600"
                onChange={(event) => {
                  const file = event.target.files && event.target.files[0];
                  if (!file) return;
                  onCompareFile(file);
                  setCompareModalOpen(false);
                  event.target.value = "";
                }}
              />
              <p className="mt-1 text-xs text-gray-500">
                File remains local to this browser session.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setCompareModalOpen(false)}
            >
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>


      <div className="w-full p-5 pl-0">
        <ToastContainer />
        {(!hasComparison && !compareLoading && !comparisonErrorMessage) && (
          <div className="fixed top-4 left-4 z-20">
            <button
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
              onClick={() => setCompareModalOpen(true)}
            >
              Compare genome
            </button>
          </div>
        )}

        {(hasComparison || compareLoading || comparisonErrorMessage) && (
          <div className="fixed top-4 left-4 right-4 md:left-8 md:right-auto md:w-96 z-20">
            <div className="bg-white border border-gray-200 shadow-lg rounded-md px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Comparative mode
                  </div>
                  <div className="text-sm font-semibold text-gray-800 break-words">
                    {compareSequence?.header || "Uploaded FASTA"}
                  </div>
                  {compareSequence?.length && (
                    <div className="text-xs text-gray-500">
                      {compareSequence.length.toLocaleString()} bp
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <button
                    className="text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setCompareModalOpen(true)}
                  >
                    Replace FASTA
                  </button>
                  <button
                    className="text-xs text-red-500 hover:text-red-600"
                    onClick={() => {
                      onClearCompare();
                      setVariantEvents([]);
                      setVariantStats(null);
                      setActiveVariantIndex(-1);
                      setSelectedVariantId(null);
                      setCompareComputeState("idle");
                      setCompareComputeError(null);
                      setCompareUrlInput("");
                    }}
                  >
                    Clear comparison
                  </button>
                </div>
              </div>

              {isComparisonBusy && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <ClipLoader size={16} color="#6b7280" />
                  Aligning sequences…
                </div>
              )}

              {comparisonErrorMessage && !isComparisonBusy && (
                <div className="text-sm text-red-600">
                  {comparisonErrorMessage}
                </div>
              )}

              {!isComparisonBusy && !comparisonErrorMessage && hasComparison && (
                <div className="text-sm text-gray-700 space-y-1">
                  <div>
                    Identity: {comparisonIdentity != null ? `${(comparisonIdentity * 100).toFixed(2)}%` : "—"}
                    {comparisonCoverage != null &&
                      ` · coverage ${(comparisonCoverage * 100).toFixed(2)}%`}
                  </div>
                  {totalVariants === 0 && (
                    <div className="text-xs text-gray-500">No nucleotide differences detected.</div>
                  )}
                </div>
              )}

              {compareSequence?.ambiguousFraction > 0.05 && (
                <div className="text-xs text-amber-600">
                  Warning: comparison FASTA contains {(compareSequence.ambiguousFraction * 100).toFixed(1)}% ambiguous bases.
                </div>
              )}

              {!isComparisonBusy && !comparisonErrorMessage && totalVariants > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <button
                    className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
                    onClick={() => navigateVariants("prev")}
                  >
                    Prev
                  </button>
                  <span>
                    Variant {Math.max(activeVariantIndex, 0) + 1} of {totalVariants}
                  </span>
                  <button
                    className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
                    onClick={() => navigateVariants("next")}
                  >
                    Next
                  </button>
                  <button
                    className="ml-auto px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"
                    onClick={() => setVariantPanelOpen(true)}
                  >
                    Open variant table
                  </button>
                </div>
              )}

              {!hasComparison && compareLoading && (
                <div className="text-sm text-gray-600">Downloading comparison FASTA…</div>
              )}
            </div>
          </div>
        )}
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
              {whereMouseWentDown !== null && (whereMouseWentUp !== null || whereMouseCurrentlyIs !== null) && (
                <div className="fixed bottom-1 left-1 z-10 px-3 py-2 text-sm rounded-lg shadow-lg bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
                  <div className="flex flex-col ">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-700">Selection:</span>
                      <span className="font-mono text-gray-700">
                        {Math.min(whereMouseWentDown, whereMouseWentUp || whereMouseCurrentlyIs)+1} - {Math.max(whereMouseWentDown, whereMouseWentUp || whereMouseCurrentlyIs)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-700">Length:</span>
                      <span className="font-mono text-gray-700 flex items-center">
                        {Math.abs((whereMouseWentUp || whereMouseCurrentlyIs) - whereMouseWentDown)} bp
                        <button 
                          onClick={() => copySelectedSequence()}
                          className="ml-2 p-1 hover:bg-gray-200 rounded-full"
                          title="Copy selection"
                        >
                          <FaRegCopy className="h-4 w-4 text-gray-500" />
                        </button>
                      </span>
                    </div>
                  </div>
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
                            variantEvents={variantsByRow.get(virtualitem.index) || []}
                            highlightedVariantId={selectedVariantId}
                            onVariantSelect={handleVariantSelect}
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

      {variantPanelOpen && (
        <Offcanvas isOpen={variantPanelOpen} onClose={() => setVariantPanelOpen(false)}>
          <VariantPanel
            variants={variantEvents}
            activeVariantId={selectedVariantId}
            onSelect={(variant) => handleVariantSelect(variant)}
            onNavigate={(direction) => navigateVariants(direction)}
            stats={variantStats}
          />
        </Offcanvas>
      )}
      </div>
    </>
  );
}

export default GensploreView;
