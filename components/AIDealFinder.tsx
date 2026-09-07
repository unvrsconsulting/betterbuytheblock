import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Neighborhood } from '../types';
import { Search, MapPin, CheckCircle } from 'lucide-react';
import Button from './Button';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { searchNeighborhoods } from '../services/neighborhoods';

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
  onSelectNeighborhood?: (neighborhoodId: string) => void;
  onLocalSearch?: (query: string) => void;
  compact?: boolean;
}

const AIDealFinder: React.FC<AIDealFinderProps> = ({ currentNeighborhood, onSelectNeighborhood, onLocalSearch, compact = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditingNeighborhood, setIsEditingNeighborhood] = useState(false);
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [showNeighborhoodDropdown, setShowNeighborhoodDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const neighborhoodInputRef = useRef<HTMLInputElement>(null);
  const { neighborhoods } = useNeighborhoods();
  const filteredNeighborhoods = searchNeighborhoods(neighborhoods, neighborhoodSearch, 6);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setIsEditingNeighborhood(false);
        setShowNeighborhoodDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isEditingNeighborhood) neighborhoodInputRef.current?.focus();
  }, [isEditingNeighborhood]);

  const handleSelectNeighborhood = (neighborhoodId: string) => {
    onSelectNeighborhood?.(neighborhoodId);
    setIsEditingNeighborhood(false);
    setShowNeighborhoodDropdown(false);
    setNeighborhoodSearch('');
  };

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
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-6">
                Wake County Home Services <br className="hidden md:block" />
                <span className="text-primary-400">at Discounted Rates</span>
              </h1>
            </>
          )}

          <form onSubmit={handleSearch} className={`bg-white p-1.5 rounded-xl shadow-2xl flex flex-col md:flex-row gap-1.5 w-full max-w-5xl mx-auto relative ${compact ? 'border border-gray-200' : ''}`} ref={searchContainerRef}>
            <div className={`${compact ? 'md:flex-1' : 'md:w-[40%]'} flex items-center px-3 py-2 ${compact ? '' : 'border-b md:border-b-0 md:border-r border-gray-200'} relative`}>
              <Search className="w-4 h-4 text-gray-500 mr-2.5 shrink-0" />
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
                      <Search className="w-4 h-4 text-gray-500" />
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!compact && (
              <div className="md:w-[50%] relative px-3 py-2">
                {isEditingNeighborhood ? (
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
                    <input
                      ref={neighborhoodInputRef}
                      type="text"
                      value={neighborhoodSearch}
                      onChange={(e) => { setNeighborhoodSearch(e.target.value); setShowNeighborhoodDropdown(true); }}
                      onFocus={() => setShowNeighborhoodDropdown(true)}
                      placeholder="Search your neighborhood or city..."
                      className="w-full bg-transparent border-none focus:ring-0 text-gray-900 placeholder-gray-500 text-sm outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setIsEditingNeighborhood(true); setShowNeighborhoodDropdown(true); }}
                    className="flex items-center gap-2.5 min-w-0 w-full text-left group"
                  >
                    <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="text-gray-900 text-sm truncate flex-1">
                      {currentNeighborhood ? `${currentNeighborhood.name}, ${currentNeighborhood.city}` : 'Set your neighborhood'}
                    </span>
                    <span className="text-sm font-bold text-primary-600 group-hover:underline shrink-0">
                      Change
                    </span>
                  </button>
                )}
                {showNeighborhoodDropdown && isEditingNeighborhood && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto text-left">
                    {filteredNeighborhoods.length > 0 ? (
                      filteredNeighborhoods.map((n, index) => (
                        <div
                          key={`n-${n.id}-${index}`}
                          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                          onMouseDown={() => handleSelectNeighborhood(n.id)}
                        >
                          <div className="font-medium text-gray-900 text-sm">{n.name}</div>
                          <div className="text-xs text-gray-500">{n.city}, NC</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2.5 text-sm text-gray-500">No neighborhoods found</div>
                    )}
                  </div>
                )}
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
