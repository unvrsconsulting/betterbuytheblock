import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Star, MapPin, Phone, Globe, ShieldCheck, MessageSquarePlus, Award, CheckCircle, ChevronDown, ThumbsUp, Images, Search, Tag } from 'lucide-react';
import { Business, Service, Review, User, Neighborhood } from '../types';
import { DEFAULT_CATEGORY_IMAGE, buildUnsplashUrl, getCategoryImage } from '../services/categoryImages';
import ServiceCard from './ServiceCard';
import ReviewModal from './ReviewModal';
import Button from './Button';
import { GoogleIcon } from './Icon';
import { servicePath, categoryCityPath } from '../services/seo/pageContent.js';
import Link from './Link';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface BusinessProfileProps {
  business: Business;
  services: Service[];
  allServices: Service[];
  reviews: Review[];
  allBusinesses: Business[];
  neighborhoods: Neighborhood[];
  onSignUp: (serviceId: string) => void;
  currentUserSignedUpIds: string[];
  currentUser?: User | null;
  users?: User[];
  isAuthenticated?: boolean;
  onAddReview: (rating: number, text: string) => void;
  onBack: () => void;
  onServiceClick: (serviceId: string) => void;
  onBusinessClick: (businessId: string) => void;
  onCategoryCityClick?: (categoryName: string, cityName: string) => void;
}

const FaqAccordion: React.FC<{ items: { q: string; a: string }[] }> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="divide-y divide-gray-100">
        {items.map((item, idx) => (
          <div key={idx}>
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between text-left px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900 text-sm">{item.q}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${openIndex === idx ? 'rotate-180' : ''}`} />
            </button>
            {openIndex === idx && (
              <p className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{item.a}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const BusinessProfile: React.FC<BusinessProfileProps> = ({
  business,
  services,
  allServices,
  reviews,
  allBusinesses,
  neighborhoods,
  onSignUp,
  currentUserSignedUpIds,
  currentUser,
  users = [],
  isAuthenticated,
  onAddReview,
  onBack,
  onServiceClick,
  onBusinessClick,
  onCategoryCityClick
}) => {
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [dealSearch, setDealSearch] = useState('');
  const [dealCategoryFilter, setDealCategoryFilter] = useState('All');
  const [dealSortBy, setDealSortBy] = useState('recommended');

  const hasJoinedThisBusiness = !!currentUser && allServices.some(
    s => s.businessId === business.id && (s.signedUpUserIds || []).includes(currentUser.id)
  );

  const activeServices = services.filter(s => s.status !== 'completed');
  const completedServices = services.filter(s => s.status === 'completed');

  const activeDealCategories = Array.from(new Set(activeServices.map(s => s.category)));

  const filteredActiveServices = useMemo(() => {
    const query = dealSearch.trim().toLowerCase();
    let list = activeServices.filter(s =>
      (dealCategoryFilter === 'All' || s.category === dealCategoryFilter) &&
      (query === '' || s.title.toLowerCase().includes(query) || s.description.toLowerCase().includes(query))
    );
    list = [...list];
    switch (dealSortBy) {
      case 'price_low':
        list.sort((a, b) => (a.standardPrice * (1 - a.discountPercentage / 100)) - (b.standardPrice * (1 - b.discountPercentage / 100)));
        break;
      case 'price_high':
        list.sort((a, b) => (b.standardPrice * (1 - b.discountPercentage / 100)) - (a.standardPrice * (1 - a.discountPercentage / 100)));
        break;
      case 'discount_high':
        list.sort((a, b) => b.discountPercentage - a.discountPercentage);
        break;
      default:
        break;
    }
    return list;
  }, [activeServices, dealSearch, dealCategoryFilter, dealSortBy]);

  const dealsPageSize = typeof window !== 'undefined' && window.innerWidth < 640 ? 4 : 8;
  const [visibleDealsCount, setVisibleDealsCount] = useState(dealsPageSize);
  const visibleActiveServices = filteredActiveServices.slice(0, visibleDealsCount);

  const businessOwnServices = allServices.filter(s => s.businessId === business.id);

  // Find categories this business operates in
  const businessCategories = Array.from(new Set(businessOwnServices.map(s => s.category)));

  // Find other businesses that share at least one of this business's actual categories.
  // No random fallback — an unrelated business (e.g. pool maintenance next to lawn care)
  // is worse than just not showing the section.
  const similarBusinesses = allBusinesses
    .filter(b => b.id !== business.id)
    .filter(b => {
      const bServices = allServices.filter(s => s.businessId === b.id);
      return bServices.some(s => businessCategories.includes(s.category));
    })
    .slice(0, 3);

  const recommendPercent = reviews.length > 0
    ? Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100)
    : null;

  // Google's real review count (from their own public listing) vs. written
  // reviews actually posted on this platform — kept distinct so neither
  // number misrepresents the other.
  const googleReviewCount = business.reviewCount || 0;
  const platformReviewCount = reviews.length;

  const servicesOffered = Array.from(new Set(businessOwnServices.map(s => s.title)));

  const servedNeighborhoodIds = Array.from(new Set(businessOwnServices.flatMap(s => s.neighborhoodIds || [])));
  const servedNeighborhoods = neighborhoods.filter(n => servedNeighborhoodIds.includes(n.id) && n.lat != null && n.lng != null);
  // The real, full service area — a business serves its whole city, not just
  // the small neighborhoodIds sample used for the map markers above.
  const servedCities: string[] = Array.from(new Set<string>(businessOwnServices.flatMap(s => s.servedCities || []))).sort();
  const mapCenter: [number, number] = servedNeighborhoods.length > 0
    ? [servedNeighborhoods[0].lat as number, servedNeighborhoods[0].lng as number]
    : [35.7847, -78.6319];

  const faqItems = [
    {
      q: `How is ${business.name} overall rated?`,
      a: business.rating
        ? `${business.name} has an average rating of ${Number(business.rating).toFixed(1)} out of 5 stars based on ${business.reviewCount || 0} reviews.`
        : `${business.name} doesn't have enough reviews yet to show an average rating.`,
    },
    {
      q: `Does ${business.name} offer free estimates?`,
      a: business.amenities?.includes('Free Estimates')
        ? `Yes, ${business.name} offers free estimates.`
        : `${business.name} hasn't listed free estimates on their profile - ask them directly when requesting a deal.`,
    },
    {
      q: `Is ${business.name} licensed?`,
      a: business.isLicensed
        ? `Yes, ${business.name} is a licensed business${business.licenseNumber ? ` (license #${business.licenseNumber})` : ''}.`
        : `${business.name} hasn't listed license information on their profile.`,
    },
    {
      q: `Are warranties offered by ${business.name}?`,
      a: business.amenities?.includes('Warranty Included')
        ? `Yes, ${business.name} includes a warranty on their work.`
        : `${business.name} hasn't listed warranty information on their profile - ask them directly when requesting a deal.`,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-[95%] mx-auto px-4 sm:px-6 py-8"
    >
      <button
        onClick={onBack}
        className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
      >
        &larr; Back to Results
      </button>

      {/* Business Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-10">
        <div className="h-48 bg-gray-900 relative">
          <img
            src={business.coverImageUrl || getCategoryImage(business.category)}
            alt="Business Cover"
            className="w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
          />
        </div>
        <div className="px-8 pb-8 relative">
          <div className="absolute -top-16 left-8 p-2 bg-white rounded-2xl shadow-md">
            <img
              src={business.logoUrl}
              alt={business.name}
              className="w-24 h-24 rounded-xl object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
            />
          </div>

          <div className="pt-12 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{business.name}</h1>
              {business.isProspective && (
                <div className="inline-flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                  Not yet a confirmed partner
                </div>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <button
                  onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="flex items-center gap-1 hover:underline"
                >
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-gray-900">{business.rating ? Number(business.rating).toFixed(1) : 'New'}</span>
                  <span>({googleReviewCount} review{googleReviewCount === 1 ? '' : 's'})</span>
                </button>
                {!business.isProspective && (
                  <div className="flex items-center gap-1 text-green-600 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    Background Checked
                  </div>
                )}
              </div>
              {business.isProspective && (
                <p className="text-sm text-gray-500 mb-4 max-w-xl">
                  This is a real Wake County business we found in this category - they haven't joined BetterBuyTheBlock yet. The deal below is a proposal, not something they've offered. Request it to help bring them here.
                </p>
              )}
              {(business.highlights?.length || 0) > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {business.highlights!.map(h => (
                    <span key={h} className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs font-bold px-2.5 py-1 rounded-full border border-primary-100">
                      <Award className="w-3 h-3" /> {h}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-gray-700 max-w-2xl text-lg">{business.description || 'Local home service professional.'}</p>
            </div>

            <div className="flex flex-col gap-3 min-w-[200px] bg-gray-50 border border-gray-200 rounded-2xl p-5">
              {business.category && (
                <span className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 text-xs font-bold px-2.5 py-1 rounded-full border border-primary-100 self-start">
                  <Tag className="w-3 h-3" /> {business.category}
                </span>
              )}
              {business.address ? (
                <div className="flex items-center gap-3 text-gray-600">
                  <MapPin className="w-5 h-5 text-gray-500 shrink-0" />
                  <span>{business.address}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-gray-600">
                  <MapPin className="w-5 h-5 text-gray-500 shrink-0" />
                  <span>Serves your area</span>
                </div>
              )}
              {business.phone && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Phone className="w-5 h-5 text-gray-500 shrink-0" />
                  <a href={`tel:${business.phone}`} className="hover:text-primary transition-colors">{business.phone}</a>
                </div>
              )}
              {business.website && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Globe className="w-5 h-5 text-gray-500 shrink-0" />
                  <a
                    href={business.website.startsWith('http') ? business.website : `https://${business.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Visit website
                  </a>
                </div>
              )}
              {business.isLicensed && (
                <div className="flex items-center gap-3 text-gray-600">
                  <ShieldCheck className="w-5 h-5 text-gray-500 shrink-0" />
                  <span>Licensed{business.licenseNumber ? ` - ${business.licenseNumber}` : ''}</span>
                </div>
              )}
              {business.googleBusinessUrl && (
                <a
                  href={business.googleBusinessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-gray-600 hover:text-primary transition-colors"
                >
                  <GoogleIcon className="w-5 h-5 shrink-0" />
                  <span className="text-primary hover:underline">View on Google</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Active Neighborhood Deals</h2>
        </div>

        {activeServices.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={dealSearch}
                onChange={(e) => { setDealSearch(e.target.value); setVisibleDealsCount(dealsPageSize); }}
                placeholder="Search deals..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            {activeDealCategories.length > 1 && (
              <select
                value={dealCategoryFilter}
                onChange={(e) => { setDealCategoryFilter(e.target.value); setVisibleDealsCount(dealsPageSize); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="All">All Categories</option>
                {activeDealCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select
              value={dealSortBy}
              onChange={(e) => { setDealSortBy(e.target.value); setVisibleDealsCount(dealsPageSize); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            >
              <option value="recommended">Recommended</option>
              <option value="discount_high">Highest Discount</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        )}

        {activeServices.length > 0 ? (
          filteredActiveServices.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-6">
                {visibleActiveServices.map(service => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    business={business}
                    serviceHref={servicePath(business, service)}
                    onSignUp={() => onSignUp(service.id)}
                    isSignedUp={currentUserSignedUpIds.includes(service.id)}
                    onBusinessClick={() => {}} // Already on profile
                    onServiceClick={() => onServiceClick(service.id)}
                    users={users}
                  />
                ))}
              </div>
              {filteredActiveServices.length > visibleActiveServices.length && (
                <div className="text-center mb-10">
                  <button
                    onClick={() => setVisibleDealsCount(c => c + dealsPageSize)}
                    className="px-6 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Load More Deals
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200 mb-10">
              <p className="text-gray-500">No deals match your search or filters.</p>
            </div>
          )
        ) : (
          <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200 mb-10">
            <p className="text-gray-500">No active deals for your neighborhood right now.</p>
          </div>
        )}

        {/* Services Offered + Amenities + Memberships */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {servicesOffered.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-gray-500" /> Services Offered
              </h3>
              <div className="flex flex-wrap gap-2">
                {servicesOffered.map(title => (
                  <span key={title} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm px-3 py-1.5 rounded-full">
                    <Tag className="w-3.5 h-3.5 text-gray-500" /> {title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(business.amenities?.length || 0) > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-gray-500" /> Amenities
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-3">
                {business.amenities!.map(a => (
                  <div key={a} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-primary-600 shrink-0" /> {a}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {(business.memberships?.length || 0) > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-10">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-gray-500" /> Memberships & Affiliates
            </h3>
            <div className="flex flex-wrap gap-2">
              {business.memberships!.map(m => (
                <span key={m} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-100">
                  <Award className="w-3.5 h-3.5" /> {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Gallery of Work */}
        {(business.galleryPhotoIds?.length || 0) > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Images className="w-6 h-6 text-gray-500" /> Gallery of Work
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {business.galleryPhotoIds!.map((photoId, idx) => (
                <img
                  key={idx}
                  src={buildUnsplashUrl(photoId, 500, 400)}
                  alt={`${business.name} work sample ${idx + 1}`}
                  className="w-full h-40 sm:h-48 object-cover rounded-xl border border-gray-200"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Service Area Coverage Map */}
        {(servedNeighborhoods.length > 0 || servedCities.length > 0) && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Service Area Coverage</h2>
            <p className="text-gray-500 text-sm mb-4">
              {business.name} currently serves {servedNeighborhoods.length} neighborhood{servedNeighborhoods.length === 1 ? '' : 's'}.
            </p>
            {servedCities.length > 0 && (() => {
              const category = business.category;
              return (
                <div className="flex flex-wrap gap-2 mb-6">
                  {servedCities.map(city => (
                    category && onCategoryCityClick ? (
                      <Link
                        key={city}
                        href={categoryCityPath(category, city)}
                        onNavigate={() => onCategoryCityClick(category, city)}
                        className="inline-flex items-center bg-primary-50 text-primary-700 text-sm font-medium px-3 py-1.5 rounded-full border border-primary-100 hover:bg-primary-100 transition-colors"
                      >
                        {city}
                      </Link>
                    ) : (
                      <span key={city} className="inline-flex items-center bg-gray-100 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-full">
                        {city}
                      </span>
                    )
                  ))}
                </div>
              );
            })()}
            {servedNeighborhoods.length > 0 && (
            <div className="h-80 rounded-2xl overflow-hidden border border-gray-200 z-0 relative">
              <MapContainer center={mapCenter} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {servedNeighborhoods.map(n => (
                  <Marker key={n.id} position={[n.lat as number, n.lng as number]} />
                ))}
              </MapContainer>
            </div>
            )}
          </div>
        )}

        <div id="reviews" className="border-t border-gray-200 pt-10 mb-10 scroll-mt-24">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Reviews on BetterBuyTheBlock ({platformReviewCount})</h2>
            {hasJoinedThisBusiness && (
              <Button
                variant="outline"
                onClick={() => setIsReviewModalOpen(true)}
                className="flex items-center gap-1.5 text-sm py-1.5 px-3"
              >
                <MessageSquarePlus className="w-4 h-4" /> Leave a Review
              </Button>
            )}
          </div>

          {/* Overall rating + recommend summary */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 flex flex-col sm:flex-row items-center gap-8">
            <div className="text-center">
              <p className="text-5xl font-black text-gray-900">{business.rating ? Number(business.rating).toFixed(1) : 'New'}</p>
              <div className="flex justify-center gap-0.5 my-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className={`w-4 h-4 ${star <= Math.round(business.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-500">{googleReviewCount} Google review{googleReviewCount === 1 ? '' : 's'}</p>
            </div>
            {recommendPercent !== null && (
              <div className="text-center sm:text-left sm:border-l sm:pl-8 border-gray-200 flex items-center gap-3">
                <ThumbsUp className="w-8 h-8 text-primary-600 shrink-0 hidden sm:block" />
                <div>
                  <p className="text-3xl font-black text-primary-600">{recommendPercent}%</p>
                  <p className="text-sm text-gray-600">of neighbors would recommend {business.name}</p>
                </div>
              </div>
            )}
          </div>

          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map(review => (
                <div key={review.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold">
                        {review.userName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{review.userName}</p>
                        <p className="text-xs text-gray-500">{new Date(review.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{review.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
              <p className="text-gray-500">
                {googleReviewCount > 0
                  ? `No written reviews on BetterBuyTheBlock yet - the rating above is ${business.name}'s public Google rating.`
                  : 'No reviews yet.'}
              </p>
            </div>
          )}
        </div>

        {/* Auto-generated FAQ */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <FaqAccordion items={faqItems} />
        </div>

        {completedServices.length > 0 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Completed Deals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-10 opacity-75">
              {completedServices.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  business={business}
                  serviceHref={servicePath(business, service)}
                  onSignUp={() => {}}
                  isSignedUp={true}
                  onBusinessClick={() => {}}
                  onServiceClick={() => onServiceClick(service.id)}
                  users={users}
                />
              ))}
            </div>
          </>
        )}

        {similarBusinesses.length > 0 && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-t border-gray-200 pt-10">Similar Business Offerings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similarBusinesses.map(simBiz => (
                <div
                  key={simBiz.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => onBusinessClick(simBiz.id)}
                >
                  <img
                    src={simBiz.logoUrl}
                    alt={simBiz.name}
                    className="w-16 h-16 rounded-lg object-cover mb-3"
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
                  />
                  <h3 className="font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1">{simBiz.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span>{simBiz.rating ? Number(simBiz.rating).toFixed(1) : 'New'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        businessName={business.name}
        onSubmit={(rating, text) => {
          onAddReview(rating, text);
          setIsReviewModalOpen(false);
        }}
      />
    </motion.div>
  );
};

export default BusinessProfile;
