import { useState, version } from 'react';
import Gensplore, { type GensploreProps } from 'gensplore';

export default function Viewer({ genbankString }: Pick<GensploreProps, 'genbankString'>) {
  const [title, setTitle] = useState('Waiting');
  const [fastaUrl, setFastaUrl] = useState<string | undefined>('/alternative.fasta');
  return <>
    <p id="react-version">{version}</p>
    <p id="viewer-title">{title}</p>
    <button onClick={() => setFastaUrl(undefined)}>Remove comparison</button>
    <Gensplore genbankString={genbankString} fastaUrl={fastaUrl} setTitleCallback={setTitle} />
  </>;
}
