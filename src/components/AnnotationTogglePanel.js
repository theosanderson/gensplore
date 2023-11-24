import React, { useState } from 'react';

const AnnotationTogglePanel = ({ annotations }) => {
  const [toggleState, setToggleState] = useState({});

  const handleToggle = (annotation) => {
    setToggleState(prevState => ({
      ...prevState,
      [annotation]: !prevState[annotation]
    }));
  };

  return (
    <div>
      {annotations.map(annotation => (
        <div key={annotation}>
          <label>
            {annotation}
            <input
              type="checkbox"
              checked={toggleState[annotation] || false}
              onChange={() => handleToggle(annotation)}
            />
          </label>
        </div>
      ))}
    </div>
  );
};

export default AnnotationTogglePanel;
