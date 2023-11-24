import React from 'react';
import GensploreComponent from '../components/GensploreView';

// This default export determines where your story goes in the story list
export default {
  title: 'GensploreComponent',
  component: GensploreComponent
};

const Template = (args) => <GensploreComponent genbankString={
`LOCUS       Sample100bp       100 bp    DNA     linear   UNK 24-NOV-2023
DEFINITION  Synthetic construct, 100 bp DNA fragment.
ACCESSION   XXX00000000
VERSION     XXX00000000.1
KEYWORDS    .
SOURCE      synthetic DNA construct
  ORGANISM  synthetic construct
            other sequences; artificial sequences.
REFERENCE   1  (bases 1 to 100)
  AUTHORS   Doe,J.
  TITLE     Direct Submission
  JOURNAL   Submitted (24-NOV-2023) to the GenBank
FEATURES             Location/Qualifiers
     CDS             1..100
                     /organism="synthetic construct"
                     /mol_type="genomic DNA"
                     /db_xref="taxon:000000"
ORIGIN      
        1 atgctagctg acgtacgtac gtagctagct agctagctac gtagctagct agctagctag
       61 ctgactgact gactgactga ctgactgact gactgactga
//`
}/>;

export const Primary = Template.bind({});

