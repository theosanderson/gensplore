import React, { useState } from 'react';
import GensploreComponent from '../components/GensploreView';
import { parseFasta } from '../utils/fasta';
import referenceGenome from '../assets/reference.gb?raw';

export default {
  title: 'GensploreComponent',
  component: GensploreComponent,
};

const Template = (args) => {
  const [compareSequence, setCompareSequence] = useState(null);
  const [compareError, setCompareError] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const handleFile = async (file) => {
    try {
      const text = await file.text();
      const parsed = parseFasta(text);
      setCompareSequence({
        ...parsed,
        source: { type: 'upload', name: file.name },
      });
      setCompareError(null);
    } catch (err) {
      setCompareSequence(null);
      setCompareError(err.message || 'Unable to parse FASTA');
    }
  };

  return (
    <GensploreComponent
      {...args}
      compareSequence={compareSequence}
      compareError={compareError}
      searchInput={searchInput}
      setSearchInput={setSearchInput}
      onCompareFile={handleFile}
      onCompareUrl={() => {
        setCompareError('URL loading is not wired in this Storybook shim.');
      }}
      onClearCompare={() => {
        setCompareSequence(null);
        setCompareError(null);
      }}
    />
  );
};

export const Default = Template.bind({});
Default.args = {
  genbankString: referenceGenome,
  showLogo: true,
};
