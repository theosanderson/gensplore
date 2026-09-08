# Gensplore

A simple genome browser for smallish genomes (e.g. viruses and bacteria)

![image](https://user-images.githubusercontent.com/19732295/219011538-43b9b66b-0227-4171-87c6-08b496a7bf2e.png)

## https://gensplore.genomium.org/

### Adding custom genomes

For viewing a custom genome every now and then, just use the "Choose file" option. If you are doing this all the time you might want an easier method. Bacterial genomes load too slowly from NCBI for us to load them directly, but you can upload your own to a website that allows CORS access, then go to `http://gensplore.theo.io/?gb=http://mywebsite.com/myfile.gb`. If you have trouble with this feel free to raise an Issue and we may be able to add your genome.

### React component

There is now a React component for embedding Gensplore in your own website. See [here](gensplore-component/README.md) for details.



### Comparing an alternative FASTA

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
Positions are 1-based reference coordinates; insertions are labelled with the
preceding reference position (0 means before the first base).

Supply one ungapped DNA FASTA record, in the same orientation and with the same
starting point as the reference. This is a global minimum-edit alignment for
closely related sequences, limited to 100,000 bases and 256 edits within the compared span.
Terminal Ns in the alternative are treated as missing coverage: the matching
reference ends are excluded without shifting reference coordinates. The drawer
shows the covered reference range; all-N input reports no covered bases. Protein
comparisons exclude terminal residues touching missing coverage, including partial
codons, without calling deletions or frameshifts. Internal Ns still count toward
the edit limit. Unpadded partial sequences, reverse orientations, circular rotations,
and rearrangements are not handled automatically. Among alignments with the same base-edit count, fewer gap openings are preferred
so contiguous insertions/deletions remain together. Repeat regions may still admit
equally optimal gap placements. Ambiguous IUPAC symbols are compared literally and labelled separately
from substitutions. Amino-acid substitutions, insertions, and deletions appear above each affected
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

### Development

With Node.js 24, run `npm ci` at the repository root. `npm run build` builds
the component and website; `npm start` serves the website. Run `npm test` for
unit tests and `npm run test:package` for packaged React compatibility checks.
