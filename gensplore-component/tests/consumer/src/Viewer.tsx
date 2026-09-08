import { useState, version } from 'react';
import Gensplore, { type GensploreProps, type AlignedSequence } from 'gensplore';

export default function Viewer({ genbankString }: Pick<GensploreProps, 'genbankString'>) {
  const [title, setTitle] = useState('Waiting');
  const [fastaUrl, setFastaUrl] = useState<string | undefined>('/alternative.fasta');
  const [alignedSequence, setAlignedSequence] = useState<AlignedSequence>();
  return <>
    <p id="react-version">{version}</p>
    <p id="viewer-title">{title}</p>
    <button onClick={() => setFastaUrl(undefined)}>Remove comparison</button>
    <button onClick={() => {
      const reference = genbankString.split(/ORIGIN[^\n]*\n/)[1].split('//')[0].replace(/[\s0-9]/g, '').toUpperCase();
      setAlignedSequence({ name: 'Aligned preview', sequence: 'N'.repeat(30) + reference.slice(30, 60) + 'N'.repeat(300) + reference.slice(360), insertions: [{ position: 40, sequence: 'GAC' }] });
    }}>Use aligned sequence</button>
    <button onClick={() => setAlignedSequence(undefined)}>Remove aligned sequence</button>
    <Gensplore genbankString={genbankString} fastaUrl={fastaUrl} alignedSequence={alignedSequence} setTitleCallback={setTitle} />
  </>;
}
