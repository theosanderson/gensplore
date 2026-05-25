# Comparative Genome Mode Specification

## Overview
Enable researchers to juxtapose a primary GenBank genome with a secondary raw FASTA sequence, perform on-the-fly alignment, and visualise nucleotide-level differences (SNPs, insertions, deletions) directly inside Gensplore. The goal is to support rapid strain comparisons without external tooling, while keeping performance acceptable for viral and small bacterial genomes (≤5 Mb).

## Primary Use Cases
- Inspecting mutations in a newly sequenced isolate against a reference genome already loaded in Gensplore.
- Comparing lab-engineered constructs with their parental strain to verify edits.
- Sharing permalinks that open a synchronised comparative view for collaborators.

## Inputs & Loading Flow
- **Primary genome:** Continue to accept GenBank via URL, upload, or query parameter as today.
- **Secondary genome:** Accept a raw FASTA file/string (single contig expected). Support both file upload and `?compare=` query parameter pointing at a CORS-enabled URL.
- **Validation:** Reject multi-sequence FASTA, prompt user to choose which contig, or allow concatenation if lengths match. Warn when sequences differ by >20% length, suggesting whole-genome aligners if necessary.

## Alignment & Variant Detection
1. **Preprocessing**
   - Uppercase both sequences; strip whitespace; ensure matching alphabet (ATGCN, optionally ambiguous IUPAC codes).
2. **Alignment Strategy**
   - Default to a lightweight global aligner (e.g. Needleman–Wunsch via WASM library or a banded dynamic programming approach) when length ≤200 kb.
   - For longer inputs, switch to seed-and-extend (e.g. minimap2 WASM build) to keep runtime reasonable; show loading spinner with progress.
3. **Variant Calling**
   - Traverse the aligned sequences to derive a difference list:
     - **SNP:** aligned positions with different bases.
     - **Insertion/Deletion:** gaps introduced in one sequence; collapse consecutive gaps into single events with length metadata.
   - Map variant coordinates back to primary sequence 1-based indexes.
4. **Caching**
   - Cache alignment output in IndexedDB keyed by primary accession + FASTA checksum for rapid re-open.

## Data Structures
```ts
interface ComparativeSession {
  referenceAccession: string;
  compareSource: {
    type: 'upload' | 'url';
    name: string;
    checksum: string;
  };
  variants: VariantEvent[];
  alignmentMeta: {
    algorithm: 'global' | 'minimap2';
    identity: number; // 0-1
    coverage: number; // fraction of reference positions aligned
  };
}

interface VariantEvent {
  kind: 'snp' | 'insertion' | 'deletion';
  refPos: number;          // position in primary genome (1-based)
  length: number;          // 1 for SNP, >1 for indels
  refBases: string;        // reference bases involved
  altBases: string;        // comparison bases
  annotationHits?: string[]; // feature IDs overlapped
}
```

## UI/UX Requirements
- **Mode Toggle:** Add a "Compare genome" CTA beside existing upload controls. Selecting it opens a panel for FASTA upload/URL entry.
- **Alignment Status Banner:** Sticky banner showing progress (parsing → aligning → calling variants). On success, report identity % and variant counts.
- **Variant Layer:**
  - Overlay markers on the linear viewer (e.g. colored glyphs above the row) with tooltips showing event type and sequence.
  - Highlight affected features (CDS, regulatory regions) using existing feature metadata with an optional filter "Show variants only".
- **Variant Table:** Offcanvas or modal listing sortable events with columns: position, type, length, overlapping feature, codon impact (if applicable). Provide copy/export to TSV.
- **Jump Controls:** Prev/next buttons cycle through variants, auto-centering the viewer.
- **Secondary Sequence Preview:** Collapsible accordion showing the FASTA header and truncated sequence for verification.

## Error Handling & Messaging
- Time-out alignment after configurable limit (e.g. 30 seconds) and advise downloading alignment CLI tools for very large genomes.
- Display clear error when FASTA format invalid, ambiguous characters dominate (>5%), or alignment identity <70%.
- For insertions relative to the reference, annotate them as occurring between positions `N` and `N+1`.

## Permalink & Session Sharing
- Extend query state with `compareSource` pointer (URL) plus `compareChecksum` for cache lookup.
- When secondary genome was uploaded locally, offer a downloadable session JSON. Visitors can import the session to rehydrate the comparative view without re-uploading raw data.

## Performance Considerations
- Run alignment and variant calling in Web Workers to avoid blocking the UI.
- Lazy-load heavy WASM bundles only when user enters compare mode.
- Cap maximum FASTA size (configurable, default 5 Mb) with override flag in advanced settings.

## Testing Strategy
- Unit tests for FASTA parsing edge cases and variant diffing logic using synthetic sequences.
- Snapshot tests for the variant table and overlay renderers.
- Integration test simulating URL-based compare load with mocked fetch responses.

## Open Questions
- Should we support multi-contig FASTA by letting users pick contigs or aligning each separately?
- Do we want amino-acid level consequence annotation (e.g. synonymous vs. non-synonymous) in the initial release?
- How to surface confidence when ambiguous characters (N, R, Y...) dominate alignment blocks?

