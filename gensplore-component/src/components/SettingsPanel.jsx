import React from 'react';
import Slider from 'rc-slider';
import "rc-slider/assets/index.css";
import { AiOutlineZoomIn, AiOutlineZoomOut } from 'react-icons/ai';
import { MdSettings } from 'react-icons/md';
import { PiTagChevronFill } from "react-icons/pi";

const SettingsPanel = ({ zoomLevel, setZoomLevel, configModalOpen, setConfigModalOpen, setFeatureOffcanvasOpen, comparisonPanelOpen, setComparisonPanelOpen, comparisonCount, comparisonStatus }) => {
  return (
    <>
      <button className="comparison-toolbar-button" type="button" aria-label="Compare FASTA"
        aria-expanded={comparisonPanelOpen} aria-controls="comparison-drawer-panel"
        title={comparisonStatus?.error || "Compare an alternative FASTA"}
        onClick={() => setComparisonPanelOpen(true)}>
        Compare{comparisonStatus?.busy ? ' …' : comparisonStatus?.error ? ' !' : comparisonCount !== undefined ? ` (${comparisonCount})` : ''}
      </button>
    <button className="inline-block text-gray-400 hover:text-gray-600" aria-label="Features" title="Features" onClick={() => setFeatureOffcanvasOpen(true)}>
        <PiTagChevronFill className="inline-block" />
      </button>
      <button className="inline-block text-gray-400  hover:text-gray-600" aria-label="Settings" title="Settings" onClick={() => setConfigModalOpen(true)}>
        <MdSettings className="inline-block" />
      </button>
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
        style={{ flex: 1, minWidth: 40, maxWidth: 150 }}
        className="inline-block"
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

export default SettingsPanel;