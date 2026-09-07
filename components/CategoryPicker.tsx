import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { CATEGORY_GROUPS } from '../constants';

interface CategoryPickerProps {
  value: string;
  onChange: (category: string) => void;
  placeholder?: string;
  id?: string;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({ value, onChange, placeholder = 'Search categories...', id }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORY_GROUPS
      .map(group => ({
        ...group,
        categories: q ? group.categories.filter(c => c.toLowerCase().includes(q)) : group.categories,
      }))
      .filter(group => group.categories.length > 0);
  }, [query]);

  const handleSelect = (category: string) => {
    onChange(category);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          id={id}
          type="text"
          value={isOpen ? query : value}
          onFocus={() => { setIsOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); if (!isOpen) setIsOpen(true); }}
          className="w-full pl-10 pr-9 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          placeholder={value && !isOpen ? value : placeholder}
        />
        <ChevronDown className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-full max-h-72 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-200 py-2">
          {filteredGroups.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No categories match "{query}".</p>
          ) : (
            filteredGroups.map(group => (
              <div key={group.name} className="mb-1 last:mb-0">
                <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">{group.name}</p>
                {group.categories.map(category => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleSelect(category)}
                    className={`w-full flex items-center justify-between text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${category === value ? 'text-primary-700 font-semibold bg-primary-50' : 'text-gray-700'}`}
                  >
                    {category}
                    {category === value && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryPicker;
