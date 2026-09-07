import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X } from 'lucide-react';
import Button from './Button';

interface LocationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShareLocation: () => void;
}

const LocationPromptModal: React.FC<LocationPromptModalProps> = ({ isOpen, onClose, onShareLocation }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-primary-100 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Find Deals in The Triangle</h2>
              <p className="text-gray-600 mb-8">
                Share your location to instantly see the best home service deals and top-rated professionals in Wake County and surrounding areas.
              </p>
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => {
                    onShareLocation();
                    onClose();
                  }}
                  className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Navigation className="w-5 h-5" />
                  Share My Location
                </Button>
                <button 
                  onClick={onClose}
                  className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
                >
                  Enter manually instead
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LocationPromptModal;
