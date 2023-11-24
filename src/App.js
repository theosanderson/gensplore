import React, {
  useState,
  useEffect,
} from "react";



import "./App.css";
import ClipLoader from "react-spinners/ClipLoader";

import GensploreView from "./components/GensploreView";
import { useDebounce, useQueryState } from "./hooks";
import "react-toastify/dist/ReactToastify.css";
import { GiDna1 } from "react-icons/gi";
// import github icon
import { FaGithub } from "react-icons/fa";





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
          <div className="fixed bottom-5 text-center w-full bg-white">
            <a
              className="text-gray-500 hover:text-gray-700 "
              href="https://github.com/theosanderson/gensplore"
            >
              <FaGithub className="inline mr-1.5 mb-0.5" />
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
