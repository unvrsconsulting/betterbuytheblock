import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Neighborhood } from '../types';
import { Search, MapPin, CheckCircle } from 'lucide-react';
import Button from './Button';

const SUGGESTIONS = [
  "Power washing",
  "Lawn mowing",
  "House cleaning",
  "Window cleaning",
  "Gutter cleaning",
  "Pool maintenance",
  "Pest control",
  "HVAC tune-up",
  "Carpet cleaning",
  "Tree trimming"
];

interface AIDealFinderProps {
  currentNeighborhood?: Neighborhood;
  onChangeNeighborhoodClick?: () => void;
  onLocalSearch?: (query: string) => void;
  compact?: boolean;
}

const AIDealFinder: React.FC<AIDealFinderProps> = ({ currentNeighborhood, onChangeNeighborhoodClick, onLocalSearch, compact = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (onLocalSearch) {
      onLocalSearch(searchQuery.trim());
    }
    setSearchQuery('');
    setShowSuggestions(false);
  };

  return (
    <div className={`relative ${compact ? 'mb-8' : 'bg-gray-900 overflow-hidden mb-12'}`}>
      {/* Background Image */}
      {!compact && (
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=2070&auto=format&fit=crop"
            alt="Beautiful home exterior"
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
        </div>
      )}

      <div className={`relative max-w-[95%] mx-auto px-4 sm:px-6 ${compact ? 'py-4' : 'py-10 lg:py-14'} flex flex-col items-center text-center`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl w-full"
        >
          {!compact && (
            <>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-3">
                Wake County Home Services <br className="hidden md:block" />
                <span className="text-primary-400">at Discounted Rates</span>
              </h1>
              <p className="text-base md:text-lg text-gray-300 mb-6 max-w-2xl mx-auto">
                Search for services in your neighborhood
              </p>
            </>
          )}

          <form onSubmit={handleSearch} className={`bg-white p-1.5 rounded-xl shadow-2xl flex flex-col md:flex-row gap-1.5 w-full max-w-5xl mx-auto relative ${compact ? 'border border-gray-200' : ''}`} ref={searchContainerRef}>
            <div className={`${compact ? 'md:flex-1' : 'md:w-[40%]'} flex items-center px-3 py-2 ${compact ? '' : 'border-b md:border-b-0 md:border-r border-gray-200'} relative`}>
              <Search className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="What service do you need?"
                className="w-full bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-500 text-sm outline-none"
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  {SUGGESTIONS.filter(s => (s || '').toLowerCase().includes((searchQuery || '').toLowerCase())).slice(0, 5).map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-left text-gray-700 flex items-center gap-3"
                      onClick={() => {
                        setSearchQuery(suggestion);
                        setShowSuggestions(false);
                      }}
                    >
                      <Search className="w-4 h-4 text-gray-400" />
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!compact && (
              <div className="md:w-[50%] flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-900 text-sm truncate">
                    {currentNeighborhood ? `${currentNeighborhood.name}, ${currentNeighborhood.city}` : 'Set your neighborhood'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onChangeNeighborhoodClick}
                  className="text-sm font-bold text-primary-600 hover:underline shrink-0 ml-3"
                >
                  Change
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="py-2 px-6 rounded-lg text-sm font-bold flex items-center justify-center gap-2 md:w-auto w-full whitespace-nowrap"
            >
              Find Deals
            </Button>
          </form>

          {!compact && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-gray-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-primary-400" />
                Free for businesses to list
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-primary-400" />
                Free to join a deal
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-primary-400" />
                Real neighbors, real savings
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AIDealFinder;
