import React from 'react';

const ContextMenu = ({ x, y, onClose, onCopy, onCopyRC }) => {
  if (x === null || y === null) return null;

  return (
    <div 
      className="fixed bg-white shadow-lg border border-gray-200 rounded-md py-1 z-50"
      style={{ left: x, top: y }}
    >
      <button
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        onClick={onCopy}
      >
        Copy Selection
      </button>
      <button
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        onClick={onCopyRC}
      >
        Copy as Reverse Complement
      </button>
    </div>
  );
};

export default ContextMenu;
