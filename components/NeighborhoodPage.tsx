import React from 'react';
import { MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Service, Business, Neighborhood, User } from '../types';
import ServiceCard from './ServiceCard';
import { TagIcon } from './Icon';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface NeighborhoodPageProps {
  neighborhoodId: string;
  neighborhoods: Neighborhood[];
  services: Service[];
  businesses: Business[];
  currentUser: User | null;
  users: User[];
  onSignUp: (serviceId: string) => void;
  onBusinessClick: (businessId: string) => void;
  onServiceClick: (serviceId: string) => void;
  onToggleWishlist: (serviceId: string) => void;
  onUpdateUser: (user: User) => void;
  onBack: () => void;
}

const NeighborhoodPage: React.FC<NeighborhoodPageProps> = ({
  neighborhoodId,
  neighborhoods,
  services,
  businesses,
  currentUser,
  users,
  onSignUp,
  onBusinessClick,
  onServiceClick,
  onToggleWishlist,
  onUpdateUser,
  onBack,
}) => {
  const neighborhood = neighborhoods.find(n => n.id === neighborhoodId);
  const neighborhoodServices = services.filter(s => (s.neighborhoodIds || []).includes(neighborhoodId));

  if (!neighborhood) {
    return (
      <section className="pt-12 max-w-4xl mx-auto px-4 sm:px-6">
        <button onClick={onBack} className="text-primary hover:underline mb-6 inline-flex items-center font-medium">&larr; Back to Home</button>
        <p className="text-gray-500">Neighborhood not found.</p>
      </section>
    );
  }

  return (
    <section className="pt-12 max-w-[95%] mx-auto px-4 sm:px-6">
      <button onClick={onBack} className="text-primary hover:underline mb-6 inline-flex items-center font-medium">&larr; Back to Home</button>

      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-primary-600 font-semibold text-sm uppercase tracking-wider mb-2">
            <MapPin className="w-4 h-4" /> {neighborhood.city}, NC
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{neighborhood.name}</h1>
          <p className="text-gray-600 max-w-xl">
            {neighborhoodServices.length > 0
              ? `${neighborhoodServices.length} active neighborhood deal${neighborhoodServices.length === 1 ? '' : 's'} available in ${neighborhood.name}.`
              : `No deals in ${neighborhood.name} yet — check back soon, or request one from a business you like.`}
          </p>
        </div>
        {neighborhood.lat != null && neighborhood.lng != null && (
          <div className="w-full md:w-72 h-48 rounded-2xl overflow-hidden border border-gray-200 shrink-0 z-0 relative">
            <MapContainer center={[neighborhood.lat, neighborhood.lng]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <Marker position={[neighborhood.lat, neighborhood.lng]} />
            </MapContainer>
          </div>
        )}
      </div>

      {neighborhoodServices.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 pb-16">
          {neighborhoodServices.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              business={businesses.find(b => b.id === service.businessId)}
              onSignUp={() => onSignUp(service.id)}
              isSignedUp={(service.signedUpUserIds || []).includes(currentUser?.id || '')}
              onBusinessClick={() => onBusinessClick(service.businessId)}
              onServiceClick={() => onServiceClick(service.id)}
              isWishlisted={(currentUser?.wishlist || []).includes(service.id)}
              onToggleWishlist={() => onToggleWishlist(service.id)}
              currentUser={currentUser}
              users={users}
              onUpdateUser={onUpdateUser}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 mb-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TagIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No deals here yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Businesses haven't targeted {neighborhood.name} yet. Search from the homepage to see nearby deals instead.
          </p>
        </div>
      )}
    </section>
  );
};

export default NeighborhoodPage;
