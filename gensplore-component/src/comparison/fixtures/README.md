# Comparison fixtures

Public-domain INSDC records, used by `align.test.mjs` to keep the comparison honest
against a real divergent, partially covered sample rather than only synthetic DNA.

- `NC_045512.2.fasta` — SARS-CoV-2 reference (Wuhan-Hu-1).
- `QB007131.fasta` — GenBank QB007131.1, a PJ.2.1 genome (a BA.3.2 descendant).
  Several hundred substitutions from the reference, with unsequenced ends and no
  N padding, which is the shape most GISAID/INSDC downloads have.
- `QB007131.nextclade-aligned.fasta` — the same sample as aligned by Nextclade
  (reference length, deletions as `-`, unsequenced ends as `N`), from the
  Nextstrain open dataset via <https://lapis.cov-spectrum.org>.
