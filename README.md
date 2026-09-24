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
> MIT license.

Load a GenBank reference, then click the **Compare FASTA** (⇄) icon in the bottom-right toolbar to
open the comparison drawer and choose a
local `.fasta`/`.fa`/`.fna` file or load a URL. A shared link can supply both files:

`/?gb=https%3A%2F%2Fexample.org%2Freference.gb&fasta=https%3A%2F%2Fexample.org%2Falternative.fasta`

Remote servers must allow CORS. Local files are processed in the browser.

In comparison mode, copying a selection copies the sample sequence for the selected
reference span. 

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
