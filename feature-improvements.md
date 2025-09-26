# Feature Improvement Ideas

- **Stateful permalinks and session sharing**  
  Extend the existing query parameter wiring to capture zoom level, search mode, selected feature, and genome source so a working view can be re-opened or shared with a collaborator. For local uploads, fall back to a downloadable “session” bundle that re-hydrates the browser state.

- **Feature grouping, filters, and legend**  
  Build on the Offcanvas feature list by adding quick filters by feature type (CDS, tRNA, regulatory, etc.), bulk toggle controls, and an always-visible color legend so users can understand the lane colouring without opening the panel repeatedly.

- **Optional analytical tracks**  
  Offer toggleable overlays for GC content, codon usage heatmaps, repeats, or predicted ORFs. Lightweight summaries alongside the base viewer help users spot hotspots without leaving Gensplore for separate tooling.

- **Comparative genome mode**  
  Allow loading a second GenBank sequence to align against the primary view, highlight SNPs/indels, and jump between differences. Even a coarse diff or BLAST-lite summary would make cross-strain comparisons much faster for users.

- **Finish the NCBI search hand-off**  
  Wire the existing `doGenBankSearch` logic through the UI so typing a partial accession/gene suggests candidate records with metadata, pagination, and error feedback. Caching previous results will keep the API snappy while staying within rate limits.

- **Offline caching and fast re-open**  
  Cache the most recently downloaded GenBank plus static assets with IndexedDB/service workers so bacterial genomes reopen instantly and remain usable on flaky connections. Surface a “recent genomes” list seeded from this storage.

- **Richer component API surface**  
  Expose callback props such as `onFeatureClick`, `onSelectionChange`, theming hooks, and ship TypeScript definitions. This would make embedding the component inside other React apps easier and opens the door to downstream integrations (analytics panels, custom tooltips, etc.).
