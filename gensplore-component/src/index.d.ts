import type { ReactElement } from "react";

export interface AlignedSequence {
  name: string;
  /** One IUPAC base or deletion gap (-) per reference base. Insertions are separate. */
  sequence: string;
  /** Position is the number of reference bases before the insertion: 0 is before the first base. */
  insertions?: Array<{ position: number; sequence: string }>;
}

export interface GensploreProps {
  /** GenBank file contents, including the reference sequence and annotations. */
  genbankString: string;
  /** Optional URL of one ungapped alternative FASTA record. Requires CORS access. */
  fastaUrl?: string;
  /** Pre-aligned input; takes precedence over FASTA input and preserves supplied gap placement. */
  alignedSequence?: AlignedSequence;
  /** Controlled search value. Omit to let the viewer manage its own search. */
  searchInput?: string | null;
  /** Called when the search changes; null clears the search. */
  setSearchInput?: (value: string | null) => void;
  /** Called with the reference/comparison title; does not change document.title itself. */
  setTitleCallback?: (title: string) => void;
}

export default function Gensplore(props: GensploreProps): ReactElement;
