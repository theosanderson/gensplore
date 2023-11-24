import React from "react";

const GenomeDisplay = ({ annotations, annotationToggles }) => {
  const displayedAnnotations = annotations.filter(
    (annotation) => annotationToggles[annotation],
  );

  return (
    <div>
      {displayedAnnotations.map((annotation) => (
        <div key={annotation}>{annotation}</div>
      ))}
    </div>
  );
};

export default GenomeDisplay;
