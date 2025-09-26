export function parseFasta(fastaText) {
  if (!fastaText || typeof fastaText !== "string") {
    throw new Error("FASTA content must be a non-empty string");
  }

  const lines = fastaText.split(/\r?\n/);
  let currentHeader = null;
  let currentSeq = [];
  const entries = [];

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (line.startsWith(">")) {
      if (currentHeader) {
        entries.push({
          header: currentHeader,
          sequence: currentSeq.join(""),
        });
      }
      currentHeader = line.substring(1).trim();
      currentSeq = [];
    } else {
      if (!currentHeader) {
        throw new Error(
          "FASTA sequence encountered before any header line (>)"
        );
      }
      currentSeq.push(line.replace(/\s+/g, ""));
    }
  });

  if (currentHeader) {
    entries.push({
      header: currentHeader,
      sequence: currentSeq.join(""),
    });
  }

  if (entries.length === 0) {
    throw new Error("No FASTA entries found");
  }

  if (entries.length > 1) {
    throw new Error("Multiple FASTA entries detected; please provide a single contig");
  }

  const entry = entries[0];
  if (!entry.sequence) {
    throw new Error("FASTA entry contained no sequence characters");
  }

  const cleanedSequence = entry.sequence.toUpperCase();
  const ambiguousCount = (cleanedSequence.match(/[^ACGTN-]/g) || []).length;
  const ambiguousFraction = ambiguousCount / cleanedSequence.length;

  return {
    header: entry.header,
    sequence: cleanedSequence,
    length: cleanedSequence.length,
    ambiguousFraction,
  };
}

export function summarizeFastaMeta({ header, length, ambiguousFraction }) {
  return {
    header,
    length,
    ambiguousFraction,
  };
}

export function makeFastaChecksum(sequence) {
  if (!sequence) return "";
  let hash = 0;
  for (let i = 0; i < sequence.length; i += Math.ceil(sequence.length / 5000) || 1) {
    const charCode = sequence.charCodeAt(i);
    hash = (hash * 31 + charCode) >>> 0;
  }
  return hash.toString(16);
}
