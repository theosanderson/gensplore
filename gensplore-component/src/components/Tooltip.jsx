import { useState, useEffect } from "react";

const Tooltip = ({ hoveredInfo }) => {
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // position to right of mouse unless x is too close to right edge
  const left_or_right =
    tooltipPosition.x > window.innerWidth - 320
      ? {
          right: `${window.innerWidth - tooltipPosition.x + 10}px`,
        }
      : {
          left: `${tooltipPosition.x + 10}px`,
        };

  const tooltipStyles = {
    position: "fixed",
    ...(tooltipPosition.y > window.innerHeight - 130
      ? { bottom: `${window.innerHeight - tooltipPosition.y + 10}px` }
      : { top: `${tooltipPosition.y + 10}px` }),
    ...left_or_right,
    maxWidth: "min(300px, calc(100vw - 20px))",
    pointerEvents: "none",
    overflowWrap: "anywhere",
    visibility: hoveredInfo ? "visible" : "hidden",

    zIndex: 1000,
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div role="tooltip" style={tooltipStyles} className="text-sm bg-gray-100 p-2 rounded">
      {hoveredInfo && <span>{hoveredInfo.label}</span>}
      {hoveredInfo && hoveredInfo.product && (
        <div className="text-xs">{hoveredInfo.product}</div>
      )}
    </div>
  );
};

export default Tooltip;
