export const DEFAULT_MAX_DIFF_SIZE = 800000;

function ensureComparableLength(reference, comparison) {
  if (reference.length === 0) {
    throw new Error("Primary reference sequence is empty");
  }

  if (comparison.length === 0) {
    throw new Error("Comparison FASTA sequence is empty");
  }

  if (reference.length > DEFAULT_MAX_DIFF_SIZE || comparison.length > DEFAULT_MAX_DIFF_SIZE) {
    throw new Error(
      "Sequences exceed supported size for browser-side alignment (800kb default limit)"
    );
  }
}

function myersDiff(reference, comparison) {
  const ref = Array.from(reference);
  const alt = Array.from(comparison);
  const n = ref.length;
  const m = alt.length;

  ensureComparableLength(reference, comparison);

  const max = n + m;
  let v = new Map();
  v.set(1, 0);
  const trace = [];
  let found = false;

  for (let d = 0; d <= max && !found; d++) {
    const current = new Map();
    for (let k = -d; k <= d; k += 2) {
      let x;
      const xFromDown = v.has(k - 1) ? v.get(k - 1) + 1 : 0;
      const xFromUp = v.has(k + 1) ? v.get(k + 1) : 0;

      if (k === -d || (k !== d && xFromUp >= xFromDown)) {
        x = xFromUp;
      } else {
        x = xFromDown;
      }

      let y = x - k;
      while (x < n && y < m && ref[x] === alt[y]) {
        x += 1;
        y += 1;
      }

      current.set(k, x);

      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
    trace.push(current);
    v = current;
  }

  const ops = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d > 0; d--) {
    const k = x - y;
    const prevMap = trace[d - 1];

    let prevK;
    const down = prevMap.has(k - 1) ? prevMap.get(k - 1) : -Infinity;
    const up = prevMap.has(k + 1) ? prevMap.get(k + 1) : -Infinity;

    if (k === -d || (k !== d && down < up)) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = prevMap.has(prevK) ? prevMap.get(prevK) : 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ type: "equal", char: ref[x - 1] });
      x -= 1;
      y -= 1;
    }

    if (x === prevX && y !== prevY) {
      ops.push({ type: "insert", char: alt[y - 1] });
      y -= 1;
    } else {
      ops.push({ type: "delete", char: ref[x - 1] });
      x -= 1;
    }
  }

  while (x > 0 && y > 0) {
    ops.push({ type: "equal", char: ref[x - 1] });
    x -= 1;
    y -= 1;
  }

  while (x > 0) {
    ops.push({ type: "delete", char: ref[x - 1] });
    x -= 1;
  }

  while (y > 0) {
    ops.push({ type: "insert", char: alt[y - 1] });
    y -= 1;
  }

  ops.reverse();
  return ops;
}

function buildAlignment(ops) {
  const alignedRef = [];
  const alignedAlt = [];

  ops.forEach((op) => {
    if (op.type === "equal") {
      alignedRef.push(op.char);
      alignedAlt.push(op.char);
    }
    if (op.type === "delete") {
      alignedRef.push(op.char);
      alignedAlt.push("-");
    }
    if (op.type === "insert") {
      alignedRef.push("-");
      alignedAlt.push(op.char);
    }
  });

  return { alignedRef, alignedAlt };
}

function deriveVariants(alignedRef, alignedAlt) {
  const variants = [];
  let refIndex = 0;
  let cursor = 0;
  let variantId = 0;

  while (cursor < alignedRef.length) {
    const refChar = alignedRef[cursor];
    const altChar = alignedAlt[cursor];

    if (refChar === altChar) {
      if (refChar !== "-") {
        refIndex += 1;
      }
      cursor += 1;
      continue;
    }

    if (refChar !== "-" && altChar !== "-") {
      const refBases = [];
      const altBases = [];
      const startRefIndex = refIndex;
      let innerCursor = cursor;
      while (
        innerCursor < alignedRef.length &&
        alignedRef[innerCursor] !== "-" &&
        alignedAlt[innerCursor] !== "-" &&
        alignedRef[innerCursor] !== alignedAlt[innerCursor]
      ) {
        refBases.push(alignedRef[innerCursor]);
        altBases.push(alignedAlt[innerCursor]);
        innerCursor += 1;
        refIndex += 1;
      }

      refBases.forEach((base, idx) => {
        variants.push({
          id: `var-${variantId++}`,
          kind: "snp",
          refPos: startRefIndex + idx + 1,
          zeroBasedRefPos: startRefIndex + idx,
          length: 1,
          refBases: base,
          altBases: altBases[idx],
        });
      });

      cursor = innerCursor;
      continue;
    }

    if (refChar !== "-" && altChar === "-") {
      const refBases = [];
      const startRefIndex = refIndex;
      let innerCursor = cursor;
      while (
        innerCursor < alignedRef.length &&
        alignedRef[innerCursor] !== "-" &&
        alignedAlt[innerCursor] === "-"
      ) {
        refBases.push(alignedRef[innerCursor]);
        innerCursor += 1;
        refIndex += 1;
      }

      variants.push({
        id: `var-${variantId++}`,
        kind: "deletion",
        refPos: startRefIndex + 1,
        zeroBasedRefPos: startRefIndex,
        length: refBases.length,
        refBases: refBases.join(""),
        altBases: "",
      });

      cursor = innerCursor;
      continue;
    }

    if (refChar === "-" && altChar !== "-") {
      const altBases = [];
      const startRefIndex = refIndex;
      let innerCursor = cursor;
      while (
        innerCursor < alignedRef.length &&
        alignedRef[innerCursor] === "-" &&
        alignedAlt[innerCursor] !== "-"
      ) {
        altBases.push(alignedAlt[innerCursor]);
        innerCursor += 1;
      }

      variants.push({
        id: `var-${variantId++}`,
        kind: "insertion",
        refPos: startRefIndex,
        zeroBasedRefPos: startRefIndex,
        length: altBases.length,
        refBases: "",
        altBases: altBases.join(""),
      });

      cursor = innerCursor;
      continue;
    }

    cursor += 1;
  }

  return variants;
}

function computeStats(alignedRef, alignedAlt, referenceLength) {
  let matches = 0;
  let refCovered = 0;

  for (let i = 0; i < alignedRef.length; i += 1) {
    const refChar = alignedRef[i];
    const altChar = alignedAlt[i];
    if (refChar !== "-") {
      refCovered += 1;
    }
    if (refChar === altChar && refChar !== "-") {
      matches += 1;
    }
  }

  return {
    identity: matches / referenceLength,
    coverage: refCovered / referenceLength,
    matches,
    referenceLength,
  };
}

function normaliseVariants(variants) {
  if (!variants || variants.length === 0) {
    return [];
  }

  const normalised = [];
  let idx = 0;

  while (idx < variants.length) {
    const variant = variants[idx];
    if (variant.kind === "deletion" || variant.kind === "insertion") {
      const refStart = variant.zeroBasedRefPos;
      let deletionBases = "";
      let insertionBases = "";
      let refPos = variant.refPos;

      let localIdx = idx;
      while (
        localIdx < variants.length &&
        variants[localIdx].kind === "deletion" &&
        variants[localIdx].zeroBasedRefPos <= refStart + deletionBases.length
      ) {
        const del = variants[localIdx];
        deletionBases += del.refBases;
        localIdx += 1;
      }

      let insertionIdx = localIdx;
      while (
        insertionIdx < variants.length &&
        variants[insertionIdx].kind === "insertion" &&
        variants[insertionIdx].zeroBasedRefPos <= refStart + insertionBases.length
      ) {
        const ins = variants[insertionIdx];
        insertionBases += ins.altBases;
        insertionIdx += 1;
      }

      if (deletionBases.length > 0 && deletionBases.length === insertionBases.length) {
        for (let offset = 0; offset < deletionBases.length; offset += 1) {
          const refBase = deletionBases[offset];
          const altBase = insertionBases[offset];
          if (refBase === altBase) continue;
          normalised.push({
            id: `var-normalised-${normalised.length}`,
            kind: "snp",
            refPos: refPos + offset,
            zeroBasedRefPos: refStart + offset,
            length: 1,
            refBases: refBase,
            altBases: altBase,
          });
        }
        idx = Math.max(insertionIdx, localIdx);
        continue;
      }
    }

    normalised.push(variant);
    idx += 1;
  }

  return normalised;
}

export function mapVariantsToFeatures(variants, features) {
  if (!features || !Array.isArray(features)) {
    return variants;
  }

  const enriched = variants.map((variant) => {
    const overlapping = new Set();
    features.forEach((feature) => {
      if (!feature) return;
      const locations = feature.locations && feature.locations.length
        ? feature.locations
        : [
            {
              start: feature.start,
              end: feature.end,
            },
          ];

      const overlaps = locations.some((loc) => {
        const locStart = Math.min(loc.start, loc.end);
        const locEnd = Math.max(loc.start, loc.end);
        if (variant.kind === "insertion") {
          return variant.zeroBasedRefPos >= locStart && variant.zeroBasedRefPos <= locEnd;
        }
        const variantStart = variant.zeroBasedRefPos;
        const variantEnd = variant.zeroBasedRefPos + Math.max(variant.length - 1, 0);
        return variantStart <= locEnd && variantEnd >= locStart;
      });

      if (overlaps) {
        const label = feature.name || feature.type || "Unnamed feature";
        overlapping.add(label);
      }
    });

    return {
      ...variant,
      annotationHits: Array.from(overlapping),
    };
  });

  return enriched;
}

export function diffSequences(reference, comparison) {
  if (reference.length === comparison.length) {
    const variants = [];
    let matches = 0;
    for (let i = 0; i < reference.length; i += 1) {
      const refBase = reference[i];
      const altBase = comparison[i];
      if (refBase === altBase) {
        matches += 1;
        continue;
      }
      variants.push({
        id: `var-${variants.length}`,
        kind: "snp",
        refPos: i + 1,
        zeroBasedRefPos: i,
        length: 1,
        refBases: refBase,
        altBases: altBase,
      });
    }
    return {
      variants,
      stats: {
        identity: matches / reference.length,
        coverage: 1,
        matches,
        referenceLength: reference.length,
      },
    };
  }

  const ops = myersDiff(reference, comparison);
  const { alignedRef, alignedAlt } = buildAlignment(ops);
  const variants = normaliseVariants(deriveVariants(alignedRef, alignedAlt));
  const stats = computeStats(alignedRef, alignedAlt, reference.length);
  return {
    variants,
    stats,
  };
}
