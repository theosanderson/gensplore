import React from 'react';

const Offcanvas = ({ isOpen, onClose, children }) => {
  return (
    <div className={`${isOpen ? 'fixed' : 'hidden'} inset-0 overflow-hidden`}
    style={
        {
            zIndex: 20
        }
    }>
      <div className="absolute inset-0 overflow-hidden">
        {/* Background overlay */}
        <div className="absolute inset-0 bg-gray-500 bg-opacity-50 transition-opacity" onClick={onClose}></div>

        {/* Offcanvas Panel from Bottom */}
        <section className="absolute  bottom-0 w-full"
     
        >
          {/* Offcanvas Panel */}
          <div className="relative w-full  mx-auto"   >
            <div className="flex flex-col h-96 bg-white shadow-xl overflow-y-scroll">
            
              <div className="mt-6 relative flex-1 px-4 sm:px-6">
                {/* Place your content here */}
                {children}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Offcanvas;
