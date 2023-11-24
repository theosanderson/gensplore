import React from 'react';
import Slider from 'rc-slider';
import "rc-slider/assets/index.css";
import { AiOutlineZoomIn, AiOutlineZoomOut } from 'react-icons/ai';
import { MdSettings } from 'react-icons/md';
import { PiTagChevronFill } from "react-icons/pi";

const SettingsPanel = ({ zoomLevel, setZoomLevel, configModalOpen, setConfigModalOpen, setFeatureOffcanvasOpen }) => {
  return (
    <>
    <button className="inline-block mr-4 text-gray-400 hover:text-gray-600" onClick={() => setFeatureOffcanvasOpen(true)}>
        <PiTagChevronFill className="inline-block" />
      </button>
      <button className="inline-block mr-4 text-gray-400  hover:text-gray-600" onClick={() => setConfigModalOpen(true)}>
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
        style={{ width: 150 }}
        className="inline-block mx-3"
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