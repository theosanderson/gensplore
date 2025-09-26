import React from "react";

const kindColor = {
  snp: "bg-red-100 text-red-700",
  insertion: "bg-blue-100 text-blue-700",
  deletion: "bg-emerald-100 text-emerald-700",
};

function toTsv(variants) {
  const header = [
    "type",
    "refPos",
    "length",
    "refBases",
    "altBases",
    "features",
  ].join("\t");

  const rows = variants.map((variant) =>
    [
      variant.kind,
      variant.refPos,
      variant.length,
      variant.refBases || "-",
      variant.altBases || "-",
      (variant.annotationHits || []).join(", ") || "-",
    ].join("\t")
  );

  return [header, ...rows].join("\n");
}

const VariantPanel = ({
  variants,
  activeVariantId,
  onSelect,
  onNavigate,
  stats,
}) => {
  const variantCount = variants.length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toTsv(variants));
    } catch (err) {
      console.error("Unable to copy variant table", err);
      window.alert("Unable to copy variant table to clipboard");
    }
  };

  return (
    <div className="py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-200 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Detected variants</h2>
          <p className="text-sm text-gray-500">
            {variantCount === 0
              ? "No nucleotide differences detected"
              : `${variantCount} event${variantCount === 1 ? "" : "s"} across ${stats?.referenceLength?.toLocaleString?.() || stats?.referenceLength || ""} bp`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {variantCount > 0 && (
            <>
              <button
                className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                onClick={() => onNavigate("prev")}
              >
                Previous
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                onClick={() => onNavigate("next")}
              >
                Next
              </button>
            </>
          )}
          <button
            className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            onClick={handleCopy}
          >
            Copy TSV
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm text-gray-700">
          <div className="bg-gray-50 rounded px-3 py-2">
            <div className="font-medium text-gray-600">Identity</div>
            <div className="text-gray-900">{(stats.identity * 100).toFixed(2)}%</div>
          </div>
          <div className="bg-gray-50 rounded px-3 py-2">
            <div className="font-medium text-gray-600">Reference coverage</div>
            <div className="text-gray-900">{(stats.coverage * 100).toFixed(2)}%</div>
          </div>
          <div className="bg-gray-50 rounded px-3 py-2">
            <div className="font-medium text-gray-600">Matches</div>
            <div className="text-gray-900">
              {stats.matches?.toLocaleString?.() || stats.matches || 0} / {stats.referenceLength?.toLocaleString?.() || stats.referenceLength || 0}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Type</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Position</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Length</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Ref</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Alt</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Features</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {variants.map((variant) => {
              const badgeClass = kindColor[variant.kind] || "bg-gray-100 text-gray-700";
              const isActive = variant.id === activeVariantId;
              return (
                <tr
                  key={variant.id}
                  className={`${isActive ? "bg-indigo-50" : "hover:bg-gray-50"} cursor-pointer`}
                  onClick={() => onSelect(variant)}
                >
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded ${badgeClass}`}>
                      {variant.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{variant.kind === "insertion" ? `${variant.refPos} / ${variant.refPos + 1}` : variant.refPos}</td>
                  <td className="px-3 py-2 font-mono">{variant.length}</td>
                  <td className="px-3 py-2 font-mono break-all">
                    {variant.refBases || "—"}
                  </td>
                  <td className="px-3 py-2 font-mono break-all">
                    {variant.altBases || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {(variant.annotationHits || []).length > 0
                      ? variant.annotationHits.join(", ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {variants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No differences detected compared with the reference sequence.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VariantPanel;
