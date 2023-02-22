const baseToComplement = { A: "T", T: "A", G: "C", C: "G", N: "N", "-": "-" };

export const getReverseComplement = (sequence) => {
  return sequence
    .split("")
    .map((base) => baseToComplement[base])
    .reverse()
    .join("");
};

export const filterFeatures = (features, search) => {
  return features.filter((feature) => {
    // if feature name contains search string
    if (feature.name.toLowerCase().includes(search.toLowerCase())) {
      return true;
    }
    const product =
      feature.notes && feature.notes.product ? feature.notes.product[0] : "";
    if (product.toLowerCase().includes(search.toLowerCase())) {
      return true;
    }
    const locus_tag =
      feature.notes && feature.notes.locus_tag
        ? feature.notes.locus_tag[0]
        : "";
    if (locus_tag.toLowerCase().includes(search.toLowerCase())) {
      return true;
    }
    return false;
  });
};
