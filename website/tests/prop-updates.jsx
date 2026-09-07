// Manual browser regression fixture: exercises prop updates without remounting
// the embedded viewer. This page is not an entry point in the production build.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Gensplore from 'gensplore';
import '../src/index.css';

const sequenceA = 'AAAACCCC'.repeat(4) + 'CG'.repeat(120);
const sequenceB = 'CG'.repeat(136);
const genbank = (name, sequence) => `LOCUS       ${name.padEnd(16)} ${String(sequence.length).padStart(10)} bp    DNA     linear   UNK 01-JAN-2000
DEFINITION  Synthetic prop update regression fixture.
ACCESSION   ${name}
FEATURES             Location/Qualifiers
ORIGIN
        1 ${sequence.toLowerCase()}
//
`;
const references = [genbank('REFERENCE_A', sequenceA), genbank('REFERENCE_B', sequenceB)];
const updateTitle = title => { document.title = title; };
function Fixture() {
  const [reference, setReference] = useState(0);
  const [fastaUrl, setFastaUrl] = useState('/tests/prop-updates.fasta');
  const [search, setSearch] = useState('');
  return <>
    <nav aria-label="Regression controls" style={{ display: 'flex', gap: 12, padding: 12, flexWrap: 'wrap' }}>
      <button onClick={() => setFastaUrl('/tests/prop-updates.fasta')}>Load comparison prop</button>
      <button onClick={() => setFastaUrl(undefined)}>Remove prop</button>
      <button onClick={() => setFastaUrl('')}>Empty prop</button>
      <button onClick={() => setReference(0)}>Reference A</button>
      <button onClick={() => setReference(1)}>Reference B</button>
    </nav>
    <Gensplore genbankString={references[reference]} fastaUrl={fastaUrl}
      searchInput={search} setSearchInput={setSearch} setTitleCallback={updateTitle} />
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
