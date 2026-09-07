import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import AlignmentWorker from '../comparison/worker.js?worker&inline';

export default function ComparisonPanel({ reference, features, fastaUrl, alignedSequence, onResult, onGoTo, open, setOpen, onStatus }) {
  const [fasta, setFasta] = useState(null);
  const [url, setUrl] = useState(fastaUrl || '');
  const [request, setRequest] = useState(0);
  const [source, setSource] = useState(fastaUrl || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const generation = useRef(0);
  const previousAligned = useRef();
  useEffect(() => {
    if (alignedSequence || previousAligned.current) {
      generation.current++;
      setFasta(null);
      setSource('');
    }
    previousAligned.current = alignedSequence;
  }, [alignedSequence]);
  useEffect(() => { onStatus({ busy, error }); }, [busy, error, onStatus]);
  useEffect(() => { if (error) setOpen(true); }, [error, setOpen]);
  const clear = () => { setResult(null); onResult(null); setError(''); };
  useEffect(() => {
    setUrl(fastaUrl || '');
    setSource(fastaUrl || '');
    if (!fastaUrl) {
      generation.current++;
      setFasta(null);
      setResult(null);
      onResult(null);
      setError('');
      setBusy(false);
    }
  }, [fastaUrl, onResult]);
  useEffect(() => {
    if (!source || alignedSequence) return;
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
  }, [source, request, alignedSequence]);
  useEffect(() => {
    if (fasta === null && !alignedSequence) { setResult(null); onResult(null); return; }
    clear();
    setBusy(true);
    const worker = new AlignmentWorker();
    const id = generation.current;
    let cancelled = false;
    worker.onmessage = ({ data }) => {
      if (cancelled || id !== generation.current) return;
      setBusy(false);
      if (data.error) setError(data.error);
      else { setResult(data); onResult(data); }
    };
    worker.onerror = () => {
      if (cancelled || id !== generation.current) return;
      setError('Alignment failed. Please try another FASTA.'); setBusy(false);
    };
    worker.postMessage({ reference, features, fasta, alignedSequence });
    return () => { cancelled = true; worker.terminate(); };
  }, [reference, features, fasta, alignedSequence, onResult]);
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
  return <Dialog open={open} onClose={() => setOpen(false)} className="gensplore comparison-drawer">
    <div className="comparison-drawer-overlay" aria-hidden="true" />
    <DialogPanel id="comparison-drawer-panel" className="comparison-drawer-content">
      <div className="comparison-drawer-header">
        <DialogTitle>Compare FASTA</DialogTitle>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close comparison">×</button>
      </div>
      <section className="comparison-panel" aria-label="Compare FASTA">
    {!alignedSequence && <><label>FASTA file <input type="file" accept=".fa,.fasta,.fna,.txt" onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }} /></label>
    <form onSubmit={e => { e.preventDefault(); setSource(url.trim()); setRequest(value => value + 1); }}>
      <label>FASTA URL <input type="text" inputMode="url" className="comparison-url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.org/alternative.fasta" required /></label>
      <button type="submit">Load URL</button>
    </form>
    {(fasta !== null || source || result || error || busy) && <button onClick={() => { generation.current++; setSource(''); setFasta(null); setBusy(false); clear(); }}>Clear</button>}
    </>}
    {busy && <p role="status">Loading / aligning FASTA…</p>}
    {error && <p role="alert">{error}</p>}
    {result && <><p role="status" className="comparison-summary">
      <strong>{result.differences.length} {result.differences.length === 1 ? 'change' : 'changes'}</strong>
      <span title={result.name}>{result.name}</span>
    </p>
      {result.proteins?.some(protein => protein?.warning) && <ul aria-label="Amino-acid comparison notes">
        {result.proteins.map((protein, index) => protein?.warning && <li key={index}>{features[index].name}: {protein.warning}</li>)}
      </ul>}
      {result.differences.length > 0 && <div className="comparison-table"><table><thead><tr><th title="1-based reference coordinates; insertions follow the indicated base">Ref. position</th><th>Type</th><th>Reference</th><th>Alternative</th><th aria-label="Navigate"></th></tr></thead><tbody>
        {result.differences.map((d, index) => <tr key={index}><td>{d.type === 'Insertion' ? `After ${d.start}` : d.end > d.start + 1 ? `${d.start + 1}–${d.end}` : d.start + 1}</td><td>{d.type}</td><td>{d.reference || '—'}</td><td>{d.alternative || '—'}</td><td><button onClick={() => { setOpen(false); requestAnimationFrame(() => onGoTo(Math.min(d.start, reference.length - 1))); }}>Go to</button></td></tr>)}
      </tbody></table></div>}
    </>}
      </section>
    </DialogPanel>
  </Dialog>;
}
