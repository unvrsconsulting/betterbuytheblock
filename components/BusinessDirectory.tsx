import React, { useMemo, useState } from 'react';
import { Business, Service, Neighborhood } from '../types';
import { Search, Star, MapPin, Tag, Building2 } from 'lucide-react';
import { DEFAULT_CATEGORY_IMAGE } from '../services/categoryImages';
import { businessPath } from '../services/seo/pageContent.js';
import Link from './Link';

interface BusinessDirectoryProps {
  businesses: Business[];
  services: Service[];
  neighborhoods: Neighborhood[];
  onBusinessClick: (businessId: string) => void;
}

type SortBy = 'rating' | 'reviews' | 'name';

const BusinessDirectory: React.FC<BusinessDirectoryProps> = ({ businesses, services, neighborhoods, onBusinessClick }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [cityFilter, setCityFilter] = useState('All Cities');
  const [sortBy, setSortBy] = useState<SortBy>('rating');

  const neighborhoodById = useMemo(() => new Map(neighborhoods.map(n => [n.id, n])), [neighborhoods]);

  const businessCategories = useMemo(() => {
    const map = new Map<string, Set<string>>();
    services.forEach(s => {
      if (!map.has(s.businessId)) map.set(s.businessId, new Set());
      map.get(s.businessId)!.add(s.category);
    });
    return map;
  }, [services]);

  const businessCities = useMemo(() => {
    const map = new Map<string, Set<string>>();
    services.forEach(s => {
      (s.neighborhoodIds || []).forEach(nId => {
        const n = neighborhoodById.get(nId);
        if (!n) return;
        if (!map.has(s.businessId)) map.set(s.businessId, new Set());
        map.get(s.businessId)!.add(n.city);
      });
    });
    return map;
  }, [services, neighborhoodById]);

  const allCategories = useMemo(
    () => Array.from(new Set(services.map(s => s.category))).sort(),
    [services]
  );
  const allCities = useMemo(() => {
    const cities = new Set<string>();
    businessCities.forEach(citySet => citySet.forEach(city => cities.add(city)));
    return Array.from(cities).sort();
  }, [businessCities]);

  const filteredBusinesses = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = businesses.filter(b => {
      const cats = businessCategories.get(b.id) || new Set();
      const cities = businessCities.get(b.id) || new Set();
      const matchesQuery = query === '' ||
        b.name.toLowerCase().includes(query) ||
        (b.description || '').toLowerCase().includes(query);
      const matchesCategory = categoryFilter === 'All Categories' || cats.has(categoryFilter);
      const matchesCity = cityFilter === 'All Cities' || cities.has(cityFilter);
      return matchesQuery && matchesCategory && matchesCity;
    });

    list = [...list];
    switch (sortBy) {
      case 'reviews':
        list.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        break;
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }
    return list;
  }, [businesses, businessCategories, businessCities, search, categoryFilter, cityFilter, sortBy]);

  return (
    <section className="pt-12 pb-16">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-primary-600" />
          Browse Local Businesses
        </h1>
        <p className="text-gray-500 max-w-2xl">
          {businesses.length} verified Wake County businesses offering neighborhood group deals.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 mb-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search businesses..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm bg-white"
        >
          <option>All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm bg-white"
        >
          <option>All Cities</option>
          {allCities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm bg-white"
        >
          <option value="rating">Highest Rated</option>
          <option value="reviews">Most Reviews</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      {filteredBusinesses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {filteredBusinesses.map(business => {
            const cats = Array.from(businessCategories.get(business.id) || []);
            const cities = Array.from(businessCities.get(business.id) || []);
            return (
              <Link
                key={business.id}
                href={businessPath(business)}
                onNavigate={() => onBusinessClick(business.id)}
                className="text-left block bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-200 transition-all p-5 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={business.logoUrl}
                    alt={business.name}
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 line-clamp-1">{business.name}</h3>
                    {business.rating ? (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        {Number(business.rating).toFixed(1)} <span className="text-gray-500">({business.reviewCount || 0})</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">New</span>
                    )}
                  </div>
                </div>

                {business.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-grow">{business.description}</p>
                )}

                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {cats.slice(0, 2).map(c => (
                    <span key={c} className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">
                      <Tag className="w-3 h-3" /> {c}
                    </span>
                  ))}
                  {cities.length > 0 && (
                    <span className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs font-medium px-2 py-1 rounded-full">
                      <MapPin className="w-3 h-3" /> {cities[0]}{cities.length > 1 ? ` +${cities.length - 1}` : ''}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No businesses match your filters</h3>
          <p className="text-gray-500 max-w-md mx-auto">Try adjusting your search, category, or city filter.</p>
        </div>
      )}
    </section>
  );
};

export default BusinessDirectory;
