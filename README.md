# Gensplore

A simple genome browser for smallish genomes (e.g. viruses and bacteria)

![image](https://user-images.githubusercontent.com/19732295/219011538-43b9b66b-0227-4171-87c6-08b496a7bf2e.png)

## https://gensplore.genomium.org/

### Adding custom genomes

For viewing a custom genome every now and then, just use the "Choose file" option. If you are doing this all the time you might want an easier method. Bacterial genomes load too slowly from NCBI for us to load them directly, but you can upload your own to a website that allows CORS access, then go to `http://gensplore.theo.io/?gb=http://mywebsite.com/myfile.gb`. If you have trouble with this feel free to raise an Issue and we may be able to add your genome.

### React component

There is now a React component for embedding Gensplore in your own website. See [here](gensplore-component/README.md) for details.



### Comparing an alternative FASTA

> **Alignment is powered by [Nextclade](https://github.com/nextstrain/nextclade).**
> Sequence comparison in Gensplore runs Nextclade's nucleotide and amino-acid
> aligners, compiled to WebAssembly, directly in your browser. Nextclade is
> developed by the [Nextstrain](https://nextstrain.org) team and released under the
> MIT license; we are very grateful to its authors. If you use comparisons from
> Gensplore in your work, please [cite Nextclade](#acknowledgements).

Load a GenBank reference, then click the **Compare FASTA** (⇄) icon in the bottom-right toolbar to
open the comparison drawer and choose a
local `.fasta`/`.fa`/`.fna` file or load a URL. A shared link can supply both files:

`/?gb=https%3A%2F%2Fexample.org%2Freference.gb&fasta=https%3A%2F%2Fexample.org%2Falternative.fasta`

Remote servers must allow CORS. Local files are processed in the browser.
The drawer retains its input and results when closed; **Go to** closes it and
centres the requested position. URL-supplied comparisons load automatically.
The comparison lists substitutions, insertions, deletions, and ambiguous-base
differences, shows labelled changes on a separate track above the reference, and provides
**Go to** navigation. Substitutions show reference → alternative, insertions use
`INS +bases` with a pointer to the insertion boundary, and deletions use
`DEL bases` with a red strike through the deleted reference letters. Substituted
reference letters have an amber strike on both DNA and AA lines. Closely spaced
labels stack to avoid overlaps.
In comparison mode, copying a selection copies the sample sequence for the selected
reference span. Substitutions and insertions are included, deleted bases are omitted,
and unknown bases remain Ns, including terminal padding. Insertions belong to the
preceding reference base; a selection starting at the first base also includes any
insertion before the reference. Copy as reverse complement uses the same sample
selection. Without a comparison, copying uses the reference.
Positions are 1-based reference coordinates; insertions are labelled with the
preceding reference position (0 means before the first base).

Supply one DNA FASTA record in the same orientation as the reference, up to
100,000 bases. It is aligned with [Nextclade](https://github.com/nextstrain/nextclade)'s
nucleotide aligner, compiled to WebAssembly and run in the comparison worker:
seed matches place the sample on the reference, then a banded alignment widens its
band as needed, so large insertions and deletions and divergent lineages (for
example a SARS-CoV-2 genome several hundred substitutions from Wuhan-Hu-1) align.
Pages with a Content-Security-Policy must allow `'wasm-unsafe-eval'` in `script-src`.
Samples too short or too unrelated to seed (Nextclade looks for exact matches of
at least 40 bases) are rejected rather than aligned arbitrarily.

Samples need not start at the same position as the reference or be padded:
terminal gaps are free, and reference positions beyond the sample's ends are
reported as missing coverage rather than as deletions. Terminal Ns are missing
coverage in the same way, and Ns anywhere in the sample are missing data rather
than edits; each run is reported as one ambiguous difference.
Missing regions remain visible as coverage-gap callouts and faded reference letters
on both nucleotide and amino-acid tracks, including partially covered codons. The drawer
shows the covered reference range; all-N input reports no covered bases. Protein
comparisons exclude terminal residues touching missing coverage, including partial
codons, without calling deletions or frameshifts.

A gapped record whose length matches the reference (such as Nextclade aligned
output) is used in the coordinates supplied, without being realigned, so its gap
placement is preserved; note that such files omit insertions relative to the
reference. Other gapped records are ungapped and aligned here. Reverse
orientations, circular rotations, and rearrangements are not handled automatically.

As in Nextclade, gap openings within a codon of an annotated CDS cost more than
openings between codons, so deletions in coding regions keep the reading frame
where an equally good placement allows. Nextclade's defaults are used unless the
component's `alignmentParams` prop overrides them with a Nextclade dataset's
pathogen.json `alignmentParams`; datasets tune, for example, which of several
equally scoring gap placements is chosen. With the SARS-CoV-2 dataset's parameters,
a divergent test sample reproduces Nextclade's nucleotide and amino-acid calls
exactly.

Ambiguous IUPAC symbols are compared literally and labelled separately
from substitutions. Translated peptides are aligned as in Nextclade: with its
banded amino-acid aligner, the band estimated from the indels in the coding
nucleotide alignment, so there is no fixed limit on AA edits. Amino-acid substitutions, insertions, and deletions appear above each affected
coding ribbon, with reference protein positions and deletion strikes. Synonymous
changes have no AA marker. Joined locations, reverse strands, and `codon_start`
are respected. AA comparison uses literal codon translation for tables 1 and 11
within the annotated span; initiation and extension beyond that span are not
inferred. Frameshifts are labelled at their start, with downstream AA comparisons
omitted. Boundary insertions and unsupported translation tables/exceptions get
an explicit note. Biological function is not predicted.

Try the bundled phiX174 reference and identical FASTA control at
`/?gb=/phix174.gb&fasta=/phix174.fasta` (expected: zero differences).
Source: [NCBI NC_001422.1](https://www.ncbi.nlm.nih.gov/nuccore/NC_001422.1),
downloaded 2026-09-07. Additional tests use artificial sequences to exercise edits.
Run the alignment tests with:
`node --test gensplore-component/src/comparison/*.test.mjs`.

### Acknowledgements

Gensplore's sequence comparison is built on **[Nextclade](https://github.com/nextstrain/nextclade)**
by the [Nextstrain](https://nextstrain.org) team (MIT license): its seeded, banded
nucleotide aligner, codon-aware gap placement and peptide aligner are used for the alignment.

> Aksamentov I, Roemer C, Hodcroft EB, Neher RA (2021). Nextclade: clade assignment,
> mutation calling and quality control for viral genomes. *Journal of Open Source
> Software* 6(67), 3773. <https://doi.org/10.21105/joss.03773>

Try Nextclade itself at <https://clades.nextstrain.org> for clade assignment, QC and
much more.

### Development

With Node.js 24, run `npm ci` at the repository root. `npm run build` builds
the component and website; `npm start` serves the website. Run `npm test` for
unit tests and `npm run test:package` for packaged React compatibility checks.

The aligner's WebAssembly build (from `gensplore-component/align-wasm/`, which
pins the Nextclade commit) is committed under
`gensplore-component/src/comparison/nextclade/`, so building needs no Rust. After
changing the crate or bumping Nextclade, regenerate it with
`npm run build:wasm --workspace=gensplore` (needs rustup and wasm-pack).
