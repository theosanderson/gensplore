import React from 'react';
import GensploreComponent from '../components/GensploreView';

// This default export determines where your story goes in the story list
export default {
  title: 'GensploreComponent',
  component: GensploreComponent
};

const Template = (args) => <GensploreComponent genbankString={
`LOCUS       Sample100bp       100 bp    DNA     linear   UNK 24-NOV-2023
DEFINITION  Synthetic construct, 100 bp DNA fragment with 42 bp coding sequence.
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
     source          1..100
                     /organism="synthetic construct"
                     /mol_type="genomic DNA"
                     /db_xref="taxon:000000"
     CDS             30..71
                     /codon_start=1
                     /product="mini protein"
                     /protein_id="AAA00000.1"
ORIGIN      
        1 atgctagcta cgtagctatg ctagctagct agctagctag ctgatgaaaa aaaaaa
       61 atatattata actgactgac tgactgactg actgactgac
//
`
}/>;

export const Primary = Template.bind({});

