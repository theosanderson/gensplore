import ColorHash from "color-hash";
var colorHash = new ColorHash({ lightness: [0.75, 0.9, 0.7, 0.8] });

const getColor = (feature, product) => {
  switch (feature.type) {
    case "CDS":
      switch (feature.name) {
        case "S":
          return "#ff7373";
        case "nsp3":
          return "#d3ffce";

        case "leader":
          return "#ff7f50";

        case "nsp2":
          return "#ddffdd";

        case "nsp4":
          return "#ff7373";

        case "N":
          return "#7fffd4";
        case "E":
          return "#ff7f50";
        case "M":
          return "#eeee88";
        case "nsp12; RdRp":
          return "#ff7f50";
        case "nsp6":
          return "#ee99ee";
        case "nsp7":
          return "#99ee99";

        case "nsp8":
          return "#ff7373";
        case "nsp10":
          return "#d3ffce";

        case "nsp14":
          return "#ff7f50";
        case "nsp15":
          return "#ddffdd";
        case "nsp16":
          return "#ffeeee";
        case "nsp13":
          return "#ff7f50";

        default:
          return colorHash.hex(feature.name + product + feature.type);
      }
    case "gene":
      return "blue";
    case "misc_feature":
      return "green";
    case "5'UTR":
      return "orange";
    case "3'UTR":
      return "orange";
    default:
      return colorHash.hex(feature.name + product + feature.type);
  }
};

export default getColor;