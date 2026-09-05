import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Star, MapPin, CheckCircle, ShieldCheck, Phone, Globe, ArrowRight, Share2, ChevronDown, UserCog } from 'lucide-react';
import { Service, Business, Review, User, Neighborhood } from '../types';
import Button from './Button';
import ProgressBar from './ProgressBar';
import ServiceCard from './ServiceCard';
import NeighborAvatar from './NeighborAvatar';
import { shareServiceLink } from '../services/share';
import { getCategoryImage, DEFAULT_CATEGORY_IMAGE } from '../services/categoryImages';

const FAQ_ITEMS = [
  {
    q: "What happens after I join?",
    a: "You'll be counted toward the neighborhood total right away. Once enough neighbors join, the deal unlocks and you'll be contacted to schedule the service at the discounted rate."
  },
  {
    q: "What if the deal doesn't unlock before it expires?",
    a: "If not enough neighbors join in time, the deal simply expires and nothing is charged — joining doesn't commit you to payment up front."
  },
  {
    q: "Can I leave a deal after joining?",
    a: "Yes. Head to your Profile page to manage or leave any deal you've joined."
  },
  {
    q: "How will I be contacted if the deal unlocks?",
    a: "You'll get a notification in the app, and the business will typically reach out directly using the contact info on file to schedule."
  },
];

interface ServiceProfileProps {
  service: Service;
  business: Business;
  reviews: Review[];
  similarServices?: Service[];
  providerServices?: Service[];
  signedUpUsers?: User[];
  users?: User[];
  currentUser?: User | null;
  onUpdateUser?: (user: User) => void;
  onSignUp: () => void;
  isSignedUp: boolean;
  onBusinessClick: () => void;
  onServiceClick?: (serviceId: string) => void;
  onBack: () => void;
  neighborhoods?: Neighborhood[];
  onNeighborhoodClick?: (neighborhoodId: string) => void;
  onToggleWishlist?: (serviceId: string) => void;
}

const ServiceProfile: React.FC<ServiceProfileProps> = ({
  service,
  business,
  reviews,
  similarServices = [],
  providerServices = [],
  signedUpUsers = [],
  users = [],
  currentUser,
  onUpdateUser,
  onSignUp,
  isSignedUp,
  onBusinessClick,
  onServiceClick,
  onBack,
  neighborhoods = [],
  onNeighborhoodClick,
  onToggleWishlist
}) => {
  const discountedPrice = (service.standardPrice || 0) * (1 - (service.discountPercentage || 0) / 100);
  const isGoalMet = (service.currentSignups || 0) >= (service.requiredSignups || 0);
  const isClosed = isGoalMet && !!service.closeAfterThreshold;
  const connectedJoinedCount = signedUpUsers.filter(u => currentUser?.connections?.includes(u.id)).length;
  const featuredReview = reviews.find(r => r.rating === 5);

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
        &larr; Back
      </button>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-10">
        <div className="h-64 bg-gray-200 relative">
          <img
            src={service.imageUrl || getCategoryImage(service.category, 1200, 400)}
            alt={service.category}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getCategoryImage('', 1200, 400); }}
          />
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold text-gray-800 shadow-sm">
            {service.category}
          </div>
        </div>

        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-12">
            {/* Main Content */}
            <div className="flex-1">
              <div 
                className="inline-flex items-center gap-3 mb-6 cursor-pointer group"
                onClick={onBusinessClick}
              >
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-200 group-hover:border-primary transition-colors"
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
                />
                <div>
                  <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider group-hover:underline">{business.name}</p>
                  {business?.rating ? (
                    <div className="flex items-center text-sm font-bold text-gray-700">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                      {Number(business.rating).toFixed(1)} ({business.reviewCount} reviews)
                    </div>
                  ) : null}
                </div>
              </div>

              <h1 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">{service.title}</h1>

              {neighborhoods.length > 0 && (() => {
                const CHIP_LIMIT = 8;
                const visibleNeighborhoods = neighborhoods.slice(0, CHIP_LIMIT);
                const hiddenCount = neighborhoods.length - visibleNeighborhoods.length;
                const distinctCities = Array.from(new Set(neighborhoods.map(n => n.city)));
                return (
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Available in {neighborhoods.length} neighborhood{neighborhoods.length === 1 ? '' : 's'}
                      {distinctCities.length <= 3 ? ` across ${distinctCities.join(', ')}` : ` across ${distinctCities.length} cities`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {visibleNeighborhoods.map(n => (
                        <button
                          key={n.id}
                          onClick={() => onNeighborhoodClick?.(n.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full hover:bg-primary-100 transition-colors"
                        >
                          <MapPin className="w-3 h-3" /> {n.name}, {n.city}
                        </button>
                      ))}
                      {hiddenCount > 0 && (
                        <span className="text-xs font-medium text-gray-400 px-2.5 py-1">+{hiddenCount} more</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <p className="text-lg text-gray-700 mb-8 leading-relaxed">{service.description}</p>

              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-8">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  Neighborhood Deal Details
                </h3>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>Exclusive bulk pricing negotiated for your neighborhood.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>Service scheduled efficiently when enough neighbors join.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>Vetted local professional with verified reviews.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Sidebar / Pricing Card */}
            <div className="w-full md:w-80 shrink-0">
              <div className="space-y-6 sticky top-24">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                  <div className="text-center mb-6">
                    <p className="text-gray-500 line-through text-lg mb-1">${(service.standardPrice || 0).toFixed(2)}</p>
                    <p className="text-5xl font-black text-gray-900 mb-2">${(discountedPrice || 0).toFixed(2)}</p>
                    <div className="inline-block bg-orange-100 text-orange-800 font-bold px-3 py-1 rounded-full text-sm">
                      Save {service.discountPercentage || 0}%
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                      <span>{service.currentSignups || 0} Joined</span>
                      <span>{service.requiredSignups || 1} Needed</span>
                    </div>
                    <ProgressBar current={service.currentSignups || 0} total={service.requiredSignups || 1} />
                    <p className="text-center text-xs text-gray-500 mt-3">
                      {isGoalMet
                        ? (isClosed ? "Deal unlocked — signups are now closed." : "Deal unlocked! You can still join.")
                        : `Only ${(service.requiredSignups || 1) - (service.currentSignups || 0)} more needed to unlock!`}
                    </p>
                  </div>

                  {isGoalMet ? (
                    isClosed ? (
                      <div className="mb-4 flex items-center justify-center text-gray-600 font-bold bg-gray-100 p-3 rounded-xl border border-gray-200">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Deal Unlocked — Signups Closed
                      </div>
                    ) : (
                      <div className="mb-4 flex items-center justify-center text-green-700 font-bold bg-green-50 p-3 rounded-xl border border-green-200">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Deal Unlocked!
                      </div>
                    )
                  ) : null}

                  {signedUpUsers.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-700 mb-2">Interested Neighbors:</p>
                      {connectedJoinedCount > 0 && (
                        <p className="text-xs font-bold text-primary-700 mb-2">
                          {connectedJoinedCount} of your connections joined!
                        </p>
                      )}
                      <div className="flex -space-x-2 overflow-hidden">
                        {[...signedUpUsers]
                          .sort((a, b) => {
                            const aConnected = currentUser?.connections?.includes(a.id) ? 1 : 0;
                            const bConnected = currentUser?.connections?.includes(b.id) ? 1 : 0;
                            return bConnected - aConnected;
                          })
                          .slice(0, 8)
                          .map((user, idx) => (
                            <NeighborAvatar 
                              key={`profile-neighbor-${user.id}-${idx}`} 
                              user={user} 
                              currentUser={currentUser || null} 
                              onUpdateUser={onUpdateUser} 
                            />
                          ))}
                        {signedUpUsers.length > 8 && (
                          <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-bold z-10 relative">
                            +{signedUpUsers.length - 8}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isSignedUp ? (
                    <>
                      <Button
                        onClick={() => shareServiceLink(service.id)}
                        className="w-full py-4 text-lg rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        variant="outline"
                      >
                        <Share2 className="w-5 h-5" /> Share Deal
                      </Button>
                      <p className="text-xs text-center text-gray-500 mt-4 flex items-center justify-center gap-1.5">
                        <UserCog className="w-3.5 h-3.5" />
                        Manage or leave this deal from your Profile.
                      </p>
                    </>
                  ) : isClosed ? (
                    <div className="w-full py-4 text-center text-gray-500 font-bold bg-gray-100 rounded-xl border border-gray-200">
                      Signups Closed
                    </div>
                  ) : isGoalMet ? (
                    <button
                      onClick={onSignUp}
                      className="w-full flex items-center justify-center gap-2 text-green-700 font-bold bg-white py-4 text-lg rounded-xl border border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Join the Unlocked Deal
                    </button>
                  ) : (
                    <Button
                      onClick={onSignUp}
                      className="w-full py-4 text-lg rounded-xl shadow-md hover:shadow-lg transition-all"
                    >
                      {service.isAIGenerated ? "Request Deal" : "Join Deal"}
                    </Button>
                  )}

                  {service.isAIGenerated && !isSignedUp && (
                    <p className="text-xs text-center text-gray-500 mt-4">
                      This is an AI-suggested deal. By requesting it, we will contact the business to confirm this pricing for your neighborhood.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Good to Know / Featured Review row - aligned siblings */}
          <div className="flex flex-col md:flex-row gap-12 mt-8">
            <div className="flex-1">
              <FaqAccordion />
            </div>
            {featuredReview && (
              <div className="w-full md:w-80 shrink-0">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex gap-0.5 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 italic leading-relaxed line-clamp-4 mb-3">"{featuredReview.text}"</p>
                  <p className="text-xs font-bold text-gray-900">
                    — {featuredReview.userName}{featuredReview.isVerifiedNeighbor ? ', Verified Neighbor' : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Provider Offers Section */}
      {providerServices.length > 0 && (
        <div className="mt-12 mb-12 bg-primary-50 rounded-3xl p-8 border border-primary-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            More Deals from {business.name}
          </h2>
          <div className="relative -mx-8">
            <div className="pointer-events-none absolute top-0 bottom-4 left-0 w-10 sm:w-16 bg-gradient-to-r from-primary-50 to-transparent z-20" />
            <div className="pointer-events-none absolute top-0 bottom-4 right-0 w-10 sm:w-16 bg-gradient-to-l from-primary-50 to-transparent z-20" />
            <div className="flex overflow-x-auto pb-4 gap-6 snap-x no-scrollbar px-8 scroll-pl-8 scroll-pr-8">
              {providerServices.map(providerService => (
                <div key={providerService.id} className="snap-start shrink-0 w-[85vw] sm:w-72">
                  <ServiceCard
                    service={providerService}
                    business={business}
                    onSignUp={() => {}}
                    isSignedUp={(providerService.signedUpUserIds || []).includes(currentUser?.id || '')}
                    onBusinessClick={onBusinessClick}
                    onServiceClick={() => onServiceClick && onServiceClick(providerService.id)}
                    isWishlisted={(currentUser?.wishlist || []).includes(providerService.id)}
                    onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(providerService.id) : undefined}
                    currentUser={currentUser}
                    users={users}
                    onUpdateUser={onUpdateUser}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Reviews for {business.name}</h2>
        {reviews.length > 0 ? (
          <div className="flex overflow-x-auto pb-2 gap-6 snap-x no-scrollbar">
            {reviews.map(review => (
              <div key={review.id} className="snap-start shrink-0 w-[85vw] sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)] bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold shrink-0">
                      {review.userName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-sm truncate">{review.userName}</p>
                      </div>
                      <p className="text-xs text-gray-500">{new Date(review.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                </div>
                {review.isVerifiedNeighbor && (
                  <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-green-200 mb-3">
                    <CheckCircle className="w-3 h-3" /> Verified Neighbor
                  </span>
                )}
                <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-4">{review.text}</p>
                {review.photos && review.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {review.photos.map((photo, idx) => (
                      <img key={idx} src={photo} alt="Review photo" className="w-20 h-20 object-cover rounded-lg border border-gray-200 shrink-0" referrerPolicy="no-referrer" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
            <p className="text-gray-500">No reviews yet for this business.</p>
          </div>
        )}
      </div>

      {/* Similar Offers Section */}
      {similarServices.length > 0 && (
        <div className="mt-12 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Similar Deals You Might Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {similarServices.map(similarService => (
              <ServiceCard
                key={similarService.id}
                service={similarService}
                business={undefined} // Pass undefined or find the business if needed, but ServiceCard handles undefined
                onSignUp={() => {}} // Handled by parent or just navigate
                isSignedUp={false}
                onServiceClick={() => onServiceClick && onServiceClick(similarService.id)}
                users={users}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const FaqAccordion: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
      <h3 className="font-bold text-gray-900 p-6 pb-2">Good to know</h3>
      <div className="divide-y divide-gray-100">
        {FAQ_ITEMS.map((item, idx) => (
          <div key={idx}>
            <button
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              className="w-full flex items-center justify-between text-left px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900 text-sm">{item.q}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${openIndex === idx ? 'rotate-180' : ''}`} />
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

export default ServiceProfile;
