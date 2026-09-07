import React, { useEffect, useRef, useState } from 'react';
import AlignmentWorker from '../comparison/worker.js?worker&inline';

export default function ComparisonPanel({ reference, fastaUrl, onResult, onGoTo }) {
  const [fasta, setFasta] = useState(null);
  const [url, setUrl] = useState(fastaUrl || '');
  const [request, setRequest] = useState(0);
  const [source, setSource] = useState(fastaUrl || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const generation = useRef(0);
  const clear = () => { setResult(null); onResult(null); setError(''); };
  useEffect(() => { setUrl(fastaUrl || ''); setSource(fastaUrl || ''); }, [fastaUrl]);
  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    const id = ++generation.current;
    clear(); setFasta(null); setBusy(true);
    (async () => {
      try {
        const parsed = new URL(source, window.location.href);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an HTTP or HTTPS URL.');
        const response = await fetch(parsed, { signal: controller.signal });
        if (!response.ok) throw new Error(`FASTA request failed (${response.status}).`);
        const text = await response.text();
        if (text.length > 1000000) throw new Error('FASTA file is too large.');
        if (id === generation.current) setFasta(text);
      } catch (e) { if (!controller.signal.aborted && id === generation.current) { setError(e.message); setBusy(false); } }
    })();
    return () => controller.abort();
  }, [source, request]);
  useEffect(() => {
    if (fasta === null) { setResult(null); onResult(null); return; }
    clear();
    setBusy(true);
    const worker = new AlignmentWorker();
    worker.onmessage = ({ data }) => {
      setBusy(false);
      if (data.error) setError(data.error);
      else { setResult(data); onResult(data); }
    };
    worker.onerror = () => { setError('Alignment failed. Please try another FASTA.'); setBusy(false); };
    worker.postMessage({ reference, fasta });
    return () => worker.terminate();
  }, [reference, fasta, onResult]);
  const loadFile = async (file) => {
    if (!file) return;
    const id = ++generation.current;
    setSource(''); setFasta(null); clear(); setBusy(true);
    try {
      if (file.size > 1000000) throw new Error('FASTA file is too large.');
      const text = await file.text();
      if (id === generation.current) setFasta(text);
    } catch (e) { if (id === generation.current) { setError(e.message); setBusy(false); } }
  };
  return <section className="comparison-panel" aria-label="Compare FASTA">
    <h3>Compare an alternative FASTA</h3>
    <p>One complete DNA sequence, in the reference orientation and starting at the same point. Up to 100,000 bases and 128 edits. Ambiguous bases are reported separately; no biological effects are predicted.</p>
    <label>FASTA file <input type="file" accept=".fa,.fasta,.fna,.txt" onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }} /></label>
    <form onSubmit={e => { e.preventDefault(); setSource(url.trim()); setRequest(value => value + 1); }}>
      <label>FASTA URL <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.org/alternative.fasta" required /></label>
      <button type="submit">Load URL</button>
    </form>
    <p>Remote FASTA servers must allow CORS access.</p>
    <button onClick={() => { generation.current++; setSource(''); setFasta(null); setBusy(false); clear(); }}>Clear comparison</button>
    {busy && <p role="status">Loading / aligning FASTA…</p>}
    {error && <p role="alert">{error}</p>}
    {result && <><p role="status">{result.name}: {result.differences.length} difference(s), {result.distance} base edit(s). Coordinates refer to the reference (1-based); insertions occur after the indicated base, with 0 meaning before the first base.</p>
      {result.differences.length > 0 && <p className="comparison-legend" aria-label="Change marker legend">
        <span><b style={{ color: '#92400e' }}>G → A</b> substitution (reference → alternative)</span>
        <span><b style={{ color: '#1d4ed8' }}>INS +AC</b> insertion at the pointer</span>
        <span><b style={{ color: '#b91c1c' }}>DEL <s>AC</s></b> deleted reference bases</span>
        <span><b style={{ color: '#6d28d9' }}>?</b> ambiguous base</span>
      </p>}
      {result.differences.length > 0 && <div className="comparison-table"><table><thead><tr><th>Position</th><th>Type</th><th>Reference</th><th>Alternative</th><th>Navigate</th></tr></thead><tbody>
        {result.differences.map((d, index) => <tr key={index}><td>{d.type === 'Insertion' ? `After ${d.start}` : d.end > d.start + 1 ? `${d.start + 1}–${d.end}` : d.start + 1}</td><td>{d.type}</td><td>{d.reference || '—'}</td><td>{d.alternative || '—'}</td><td><button onClick={() => onGoTo(Math.min(d.start, reference.length - 1))}>Go to</button></td></tr>)}
      </tbody></table></div>}
    </>}
  </section>;
}
