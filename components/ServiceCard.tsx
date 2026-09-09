
import React from 'react';
import { motion } from 'framer-motion';
import { Service, Business, User } from '../types';
import Button from './Button';
import { CheckCircleIcon } from './Icon';
import { Users, Star, Heart, Share2, Clock, Sparkles } from 'lucide-react';
import NeighborAvatar from './NeighborAvatar';
import { shareServiceLink } from '../services/share';
import { getCategoryImage, DEFAULT_CATEGORY_IMAGE } from '../services/categoryImages';
import Link from './Link';

interface ServiceCardProps {
  service: Service;
  business: Business | undefined;
  onSignUp: () => void;
  isSignedUp: boolean;
  onBusinessClick?: () => void;
  onServiceClick?: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  currentUser?: User | null;
  users?: User[];
  onUpdateUser?: (user: User) => void;
  onOptOut?: () => void;
  // Real crawlable URLs, e.g. "/business/acme" and "/business/acme/carpet-clean".
  // When provided, the logo/name/title click targets render as a real
  // <a href> instead of a plain div/button — see components/Link.tsx.
  businessHref?: string;
  serviceHref?: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service, business, onSignUp, isSignedUp, onBusinessClick, onServiceClick, isWishlisted, onToggleWishlist, currentUser, users = [], onUpdateUser, onOptOut, businessHref, serviceHref
}) => {
  const discountedPrice = (service.standardPrice || 0) * (1 - (service.discountPercentage || 0) / 100);
  const isGoalMet = (service.currentSignups || 0) >= (service.requiredSignups || 0);
  const connectedJoinedCount = (service.signedUpUserIds || []).filter(id => currentUser?.connections?.includes(id)).length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl shadow-sm hover:shadow-xl flex flex-col h-full transition-all duration-300 border border-gray-200 group relative hover:z-50"
    >
      {/* Top Image Banner */}
      <div className="relative h-32 w-full bg-gray-200 overflow-hidden shrink-0 rounded-t-2xl">
        <img
          src={service.imageUrl || getCategoryImage(service.category)}
          alt={service.category}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
        />
        <div className="absolute top-3 left-3 right-12 flex flex-col gap-2 items-start">
          {service.expiresAt && (
            <div className="bg-red-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="overflow-hidden text-ellipsis">Expires {new Date(service.expiresAt).toLocaleDateString()}</span>
            </div>
          )}
          {service.isAIGenerated && (
            <div 
              className="bg-purple-500/90 backdrop-blur-sm text-white p-2 rounded-full shadow-sm flex items-center justify-center"
              title="AI Generated Deal"
            >
              <Sparkles className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          {onToggleWishlist && (
            <div className="flex flex-col gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleWishlist(); }}
                className={`p-2 rounded-full backdrop-blur-sm shadow-sm transition-colors ${isWishlisted ? 'bg-red-50 text-red-500' : 'bg-white/90 text-gray-500 hover:text-red-500'}`}
                aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart className="w-4 h-4" fill={isWishlisted ? "currentColor" : "none"} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); shareServiceLink(serviceHref || window.location.pathname); }}
                className="p-2 rounded-full bg-white/90 text-gray-500 hover:text-primary-500 backdrop-blur-sm shadow-sm transition-colors"
                title="Share Deal"
                aria-label="Share deal"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex-grow flex flex-col relative pt-8">
        {/* Overlapping Business Logo */}
        {businessHref ? (
          <Link
            href={businessHref}
            onNavigate={() => onBusinessClick?.()}
            className="absolute -top-6 left-4 p-1 bg-white rounded-xl shadow-md hover:scale-105 transition-transform block"
          >
            <img
              src={business?.logoUrl || `https://picsum.photos/seed/${business?.name || 'biz'}/100`}
              alt={business?.name}
              className="w-12 h-12 rounded-lg object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
            />
          </Link>
        ) : (
          <div
            className="absolute -top-6 left-4 p-1 bg-white rounded-xl shadow-md cursor-pointer hover:scale-105 transition-transform"
            onClick={onBusinessClick}
          >
            <img
              src={business?.logoUrl || `https://picsum.photos/seed/${business?.name || 'biz'}/100`}
              alt={business?.name}
              className="w-12 h-12 rounded-lg object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
            />
          </div>
        )}

        <div className="mb-2 group">
          <div className="flex items-center justify-between mb-1">
            {businessHref ? (
              <Link
                href={businessHref}
                onNavigate={() => onBusinessClick?.()}
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-semibold text-primary-600 uppercase tracking-wider hover:underline truncate pr-2"
              >
                {business?.name}
              </Link>
            ) : (
              <p
                className="text-[10px] font-semibold text-primary-600 uppercase tracking-wider cursor-pointer hover:underline truncate pr-2"
                onClick={(e) => { e.stopPropagation(); onBusinessClick?.(); }}
              >
                {business?.name}
              </p>
            )}
            {business?.rating ? (
              <div className="flex items-center text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
                <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500 mr-1" />
                {Number(business.rating).toFixed(1)}
              </div>
            ) : null}
          </div>
          {serviceHref ? (
            <Link href={serviceHref} onNavigate={() => onServiceClick?.()} className="block">
              <h3 className="text-lg font-extrabold text-gray-900 leading-tight line-clamp-2 group-hover:text-primary transition-colors">{service.title}</h3>
            </Link>
          ) : (
            <h3
              className="text-lg font-extrabold text-gray-900 leading-tight line-clamp-2 group-hover:text-primary transition-colors cursor-pointer"
              onClick={onServiceClick}
            >
              {service.title}
            </h3>
          )}
        </div>

        {serviceHref ? (
          <Link href={serviceHref} onNavigate={() => onServiceClick?.()} className="text-gray-600 text-xs mb-1 flex-grow line-clamp-2 block">
            {service.description}
          </Link>
        ) : (
          <p className="text-gray-600 text-xs mb-1 flex-grow line-clamp-2 cursor-pointer" onClick={onServiceClick}>
            {service.description}
          </p>
        )}
      </div>

      <div className="p-3 bg-green-50 border-t border-green-200 shrink-0 flex flex-col gap-3 rounded-b-2xl">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <p className="text-green-700 font-black text-2xl leading-none whitespace-nowrap">${discountedPrice.toFixed(0)}</p>
              <p className="text-gray-500 text-xs line-through leading-none whitespace-nowrap">${service.standardPrice.toFixed(0)}</p>
            </div>
            <span className="bg-green-600 text-white text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap shrink-0">
              {service.discountPercentage}% OFF
            </span>
          </div>
          <div className="w-full">
            <div className={`w-full rounded-full h-1.5 overflow-hidden ${isGoalMet ? 'bg-green-100' : 'bg-[#F0B100]/20'}`}>
              <div
                className={`h-1.5 rounded-full ${isGoalMet ? 'bg-green-500' : 'bg-[#F0B100]'}`}
                style={{ width: `${Math.min(100, ((service.currentSignups || 0) / (service.requiredSignups || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-green-700 text-[9px] font-semibold mt-0.5 flex items-center gap-0.5 whitespace-nowrap">
              <Users className="w-2.5 h-2.5 shrink-0" />
              {service.currentSignups || 0} of {service.requiredSignups} neighbors joined
            </p>
          </div>
          {connectedJoinedCount > 0 && (
            <p className="text-[10px] font-bold text-primary-700 flex items-center gap-1">
              {connectedJoinedCount} connection{connectedJoinedCount === 1 ? '' : 's'} joined!
            </p>
          )}
          <div className="flex -space-x-2 items-center">
            {/* Render joined users */}
            {users.filter(u => service.signedUpUserIds?.includes(u.id))
              .sort((a, b) => {
                const aConnected = currentUser?.connections?.includes(a.id) ? 1 : 0;
                const bConnected = currentUser?.connections?.includes(b.id) ? 1 : 0;
                return bConnected - aConnected;
              })
              .slice(0, 3)
              .map((user, idx) => (
                <div key={`neighbor-${user.id}-${idx}`} className="relative z-10 flex">
                  <NeighborAvatar 
                    user={user} 
                    currentUser={currentUser || null} 
                    onUpdateUser={onUpdateUser} 
                    showName={false}
                    size="sm"
                  />
                </div>
              ))}
            
            {/* Render +X if more than 3 joined */}
            {(service.signedUpUserIds?.length || 0) > 3 && (
              <div className="flex h-5 w-5 rounded-full ring-2 ring-white bg-green-100 items-center justify-center text-green-800 text-[9px] font-bold z-20 relative">
                +{(service.signedUpUserIds?.length || 0) - 3}
              </div>
            )}

            {/* Render empty slots if less than required */}
            {Array.from({ length: Math.min(Math.max(0, (service.requiredSignups || 1) - (service.signedUpUserIds?.length || 0)), 3 - Math.min(service.signedUpUserIds?.length || 0, 3)) }).map((_, idx) => (
              <div key={`empty-${idx}`} className="flex h-5 w-5 rounded-full ring-2 ring-white bg-green-50 border border-dashed border-green-300 items-center justify-center z-0 relative">
              </div>
            ))}
          </div>
        </div>

        <div className="w-full">
          {isSignedUp ? (
            <div className="flex flex-col gap-1 w-full">
              {service.status === 'completed' && (
                <div className="flex items-center justify-center gap-1.5 text-green-700 font-bold bg-green-100 py-2 px-1 rounded-xl text-xs border border-green-300">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </div>
              )}
              <Button
                onClick={(e) => { e.stopPropagation(); shareServiceLink(serviceHref || window.location.pathname); }}
                fullWidth
                variant="outline"
                className="py-2 text-xs rounded-xl flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </Button>
              {onOptOut && (
                <button
                  disabled={service.status === 'completed'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (service.status === 'completed') return;
                    if (window.confirm(`Leave "${service.title}"? You can rejoin later if it's still open.`)) {
                      onOptOut();
                    }
                  }}
                  title={service.status === 'completed' ? 'This deal is completed and can no longer be left.' : undefined}
                  className={`text-[10px] font-medium text-center transition-colors ${
                    service.status === 'completed'
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-500 hover:text-red-500'
                  }`}
                >
                  Leave Deal
                </button>
              )}
            </div>
          ) : isGoalMet && service.closeAfterThreshold ? (
            <div className="flex items-center justify-center text-gray-500 font-bold bg-gray-100 py-2.5 px-1 rounded-xl text-xs border border-gray-200">
               <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
               <span>Closed</span>
            </div>
          ) : isGoalMet ? (
            <button
              onClick={(e) => { e.stopPropagation(); onServiceClick(); }}
              className="w-full flex items-center justify-center gap-1.5 text-green-700 font-bold bg-white py-2.5 px-1 rounded-xl text-xs border border-green-500 hover:bg-green-50 transition-colors"
            >
               <CheckCircleIcon className="w-3.5 h-3.5" />
               <span>Join the Unlocked Deal</span>
            </button>
          ) : (
             <Button onClick={(e) => { e.stopPropagation(); onServiceClick(); }} fullWidth className="py-2.5 text-xs rounded-xl shadow-md hover:shadow-lg transition-shadow">
               View Deal
             </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ServiceCard;
