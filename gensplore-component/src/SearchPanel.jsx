import React, {
    useState,
    useEffect,
  } from "react";

import { FaSearch, FaTimes } from "react-icons/fa";
import { DebounceInput } from "react-debounce-input";

// settings icon


import {BsArrowRightCircleFill, BsArrowLeftCircleFill} from "react-icons/bs";


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
          searchType === "sequence" && searchInput && searchInput.length>0&& (
            <div className="my-2 text-gray-400 text-left px-3">
              <label className="text-gray-900"> <input type="checkbox" value={includeRC} onChange={() => {
                
                setIncludeRC(!includeRC);
            setCurSeqHitIndex(0);
              }
              
          }/>&nbsp;Include reverse complement</label>
  
              {sequenceHits.length > 0 && (
                <>
                <button>
                  <BsArrowLeftCircleFill onClick={() => setCurSeqHitIndex((x) => x==0? sequenceHits.length-1: x-1)}
                  className="mx-3 text-gray-600 hover:text-gray-800" />
                </button>
            
            
              
              
              Hit {curSeqHitIndex + 1} of {sequenceHits.length}
  
            
                <button>
                  <BsArrowRightCircleFill onClick={() => setCurSeqHitIndex((x) => x==sequenceHits.length-1? 0: x+1)}
                  className="mx-3 text-gray-600  hover:text-gray-800" />
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
  
    export default SearchPanel;
  