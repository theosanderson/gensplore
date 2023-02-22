import { useState, useEffect } from "react";

const Tooltip = ({ hoveredInfo }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // position to right of mouse unless x is too close to right edge
  const left_or_right =
    tooltipPosition.x > window.innerWidth - 200
      ? {
          right: `${window.innerWidth - tooltipPosition.x + 10}px`,
        }
      : {
          left: `${tooltipPosition.x + 10}px`,
        };

  const tooltipStyles = {
    position: "absolute",
    top: `${tooltipPosition.y + 10}px`,
    ...left_or_right,
    visibility: hoveredInfo ? "visible" : "hidden",

    zIndex: 1000,
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      setTooltipPosition({ x: e.pageX, y: e.pageY });
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div style={tooltipStyles} className="text-sm bg-gray-100 p-2 rounded">
      {hoveredInfo && <span>{hoveredInfo.label}</span>}
      {hoveredInfo && hoveredInfo.product && (
        <div className="text-xs">{hoveredInfo.product}</div>
      )}
    </div>
  );
};

export default Tooltip;
