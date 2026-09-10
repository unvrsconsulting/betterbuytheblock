import React, { useState } from 'react';
import { User, Business, Service, DealRequest } from '../types';
import { MapPin, Heart, Edit2, Save, X, Clock, CheckCircle, XCircle, Navigation, Home, Phone, Tag } from 'lucide-react';
import ServiceCard from './ServiceCard';
import ConnectionsPanel from './ConnectionsPanel';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { searchNeighborhoods, findNearestNeighborhood } from '../services/neighborhoods';
import { CATEGORY_GROUPS } from '../constants';

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  map.setView([lat, lng], map.getZoom());
  return null;
}

interface UserProfileProps {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  services: Service[];
  businesses: Business[];
  users?: User[];
  dealRequests?: DealRequest[];
  onSignUp: (serviceId: string) => void;
  onBusinessClick: (businessId: string) => void;
  onServiceClick: (serviceId: string) => void;
  onToggleWishlist: (serviceId: string) => void;
  onUpdateProfile: (updates: Partial<User>) => Promise<void>;
  onOptOut?: (serviceId: string) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({
  currentUser,
  setCurrentUser,
  services,
  businesses,
  users = [],
  dealRequests = [],
  onSignUp,
  onBusinessClick,
  onServiceClick,
  onToggleWishlist,
  onUpdateProfile,
  onOptOut
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editNeighborhood, setEditNeighborhood] = useState(currentUser?.neighborhoodId || '');
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [showNeighborhoodDropdown, setShowNeighborhoodDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editAddress, setEditAddress] = useState(currentUser?.address || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeNote, setGeocodeNote] = useState('');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [editInterestedCategories, setEditInterestedCategories] = useState<string[]>(currentUser?.interestedCategories || []);
  const { neighborhoods } = useNeighborhoods();

  // Initialize search text when editing starts
  React.useEffect(() => {
    if (isEditing) {
      const currentN = neighborhoods.find(n => n.id === editNeighborhood);
      if (currentN) {
        setNeighborhoodSearch(`${currentN.name}, ${currentN.city}, NC`);
      }
    }
  }, [isEditing, editNeighborhood, neighborhoods]);

  const filteredNeighborhoods = searchNeighborhoods(neighborhoods, neighborhoodSearch, 8);

  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Please sign in to view your profile</h2>
      </div>
    );
  }

  const handleSave = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await onUpdateProfile({
        name: editName,
        neighborhoodId: editNeighborhood,
        address: editAddress.trim() || undefined,
        phone: editPhone.trim() || undefined,
        // Changing the number invalidates whatever verification was done for
        // the old one — never carry a "verified" badge over to a number
        // nobody actually confirmed.
        phoneVerified: editPhone.trim() === (currentUser.phone || '') ? currentUser.phoneVerified : false,
        interestedCategories: editInterestedCategories,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeocodeAddress = async () => {
    if (!editAddress.trim() || editAddress.trim().length < 5) return;
    setIsGeocoding(true);
    setGeocodeNote('');
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: editAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.matched) {
        setGeocodeNote("Couldn't match that address to a neighborhood — search for it below instead.");
        return;
      }
      const nearest = findNearestNeighborhood(neighborhoods, data.lat, data.lng);
      if (nearest) {
        setEditNeighborhood(nearest.id);
        setNeighborhoodSearch(`${nearest.name}, ${nearest.city}, NC`);
        setGeocodeNote(`Matched to ${nearest.name}, ${nearest.city} — not right? Search for it below instead.`);
      } else {
        setGeocodeNote("Couldn't match that address to a neighborhood — search for it below instead.");
      }
    } catch (err) {
      console.error('Address lookup failed', err);
      setGeocodeNote("Couldn't look up that address right now — search for your neighborhood below instead.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const toggleInterestedCategory = (category: string) => {
    setEditInterestedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nearest = findNearestNeighborhood(neighborhoods, position.coords.latitude, position.coords.longitude);
        if (nearest) {
          setEditNeighborhood(nearest.id);
          setNeighborhoodSearch(`${nearest.name}, ${nearest.city}, NC`);
          setShowNeighborhoodDropdown(false);
          // Save immediately — detecting a location should stick even if the user
          // never clicks the separate Save button afterward.
          try {
            await onUpdateProfile({ neighborhoodId: nearest.id });
          } catch (error) {
            console.error('Failed to save detected location', error);
          }
        }
      },
      (error) => {
        console.error('Error getting location:', error);
      }
    );
  };

  const getStatusIcon = (status: DealRequest['status']) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'accepted': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'declined': return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (status: DealRequest['status']) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'accepted': return 'Accepted';
      case 'declined': return 'Declined';
    }
  };

  const renderMap = (neighborhoodId: string) => {
    const n = neighborhoods.find(n => n.id === neighborhoodId);
    if (!n || !n.lat || !n.lng) return null;
    return (
      <div className="w-full h-48 rounded-xl overflow-hidden mt-4 border border-gray-200 z-0 relative">
        <MapContainer center={[n.lat, n.lng]} zoom={14} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[n.lat, n.lng]} />
          <MapUpdater lat={n.lat} lng={n.lng} />
        </MapContainer>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-8 md:p-12 flex flex-col md:flex-row items-start gap-8 relative">
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-6 right-6 p-2 text-gray-500 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          ) : null}

          <div className="w-24 h-24 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-3xl font-bold shrink-0 mt-2">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          
          <div className="text-center md:text-left flex-1 w-full">
            {isEditing ? (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    onBlur={handleGeocodeAddress}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="123 Main St, Raleigh, NC 27601"
                  />
                  {isGeocoding && <p className="mt-1.5 text-xs text-gray-500">Looking up your neighborhood...</p>}
                  {!isGeocoding && geocodeNote && <p className="mt-1.5 text-xs text-gray-500">{geocodeNote}</p>}
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Neighborhood</label>
                  <input
                    type="text"
                    value={neighborhoodSearch}
                    onChange={(e) => {
                      setNeighborhoodSearch(e.target.value);
                      setShowNeighborhoodDropdown(true);
                    }}
                    onFocus={() => { setShowNeighborhoodDropdown(true); setNeighborhoodSearch(''); }}
                    onBlur={() => setTimeout(() => setShowNeighborhoodDropdown(false), 200)}
                    placeholder="Search by neighborhood or city..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                  {showNeighborhoodDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredNeighborhoods.length > 0 ? (
                        filteredNeighborhoods.map((n, index) => (
                          <div
                            key={`n-${n.id}-${index}`}
                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                            onMouseDown={() => {
                              setEditNeighborhood(n.id);
                              setNeighborhoodSearch(`${n.name}, ${n.city}, NC`);
                              setShowNeighborhoodDropdown(false);
                            }}
                          >
                            <div className="font-medium text-gray-900">{n.name}</div>
                            <div className="text-sm text-gray-500">{n.city}, NC</div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-sm text-gray-500">No neighborhoods found</div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    className="mt-2 text-xs font-bold text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Use my current location
                  </button>
                </div>

                {editNeighborhood && renderMap(editNeighborhood)}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="(919) 555-1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interested in <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                    {CATEGORY_GROUPS.flatMap(g => g.categories).map(category => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleInterestedCategory(category)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          editInterestedCategories.includes(category)
                            ? 'border-primary bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(currentUser?.name || '');
                      setEditNeighborhood(currentUser?.neighborhoodId || '');
                      setEditAddress(currentUser?.address || '');
                      setEditPhone(currentUser?.phone || '');
                      setEditInterestedCategories(currentUser?.interestedCategories || []);
                      setGeocodeNote('');
                    }}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{currentUser?.name || 'User'}</h1>
                <p className="text-gray-500 flex items-center justify-center md:justify-start gap-2 mb-1">
                  <MapPin className="w-4 h-4" />
                  {(() => {
                    const n = neighborhoods.find(n => n.id === currentUser?.neighborhoodId);
                    return n ? `${n.name}, ${n.city}, NC` : 'Your Neighborhood';
                  })()}
                </p>
                {currentUser?.address && (
                  <p className="text-gray-500 flex items-center justify-center md:justify-start gap-2 mb-1">
                    <Home className="w-4 h-4" /> {currentUser.address}
                  </p>
                )}
                {currentUser?.phone && (
                  <p className="text-gray-500 flex items-center justify-center md:justify-start gap-2 mb-1">
                    <Phone className="w-4 h-4" /> {currentUser.phone}
                    {currentUser.phoneVerified && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                  </p>
                )}
                {(currentUser?.interestedCategories?.length || 0) > 0 && (
                  <div className="flex items-start justify-center md:justify-start gap-2 mb-4 mt-2">
                    <Tag className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                    <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                      {currentUser!.interestedCategories!.map(cat => (
                        <span key={cat} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{cat}</span>
                      ))}
                    </div>
                  </div>
                )}
                {currentUser?.neighborhoodId && renderMap(currentUser.neighborhoodId)}
              </>
            )}
          </div>
          
        </div>
      </div>
      
      {/* Active Deals */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6 mt-12">Your Active Deals</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {services.filter(s => (s.signedUpUserIds || []).includes(currentUser?.id || '')).length > 0 ? (
          services.filter(s => (s.signedUpUserIds || []).includes(currentUser?.id || '')).map((service, index) => (
            <ServiceCard
              key={`active-${service.id}-${index}`}
              service={service}
              business={businesses.find(b => b.id === service.businessId)}
              onSignUp={() => onSignUp(service.id)}
              isSignedUp={true}
              onBusinessClick={() => onBusinessClick(service.businessId)}
              onServiceClick={() => onServiceClick(service.id)}
              isWishlisted={(currentUser?.wishlist || []).includes(service.id)}
              onToggleWishlist={() => onToggleWishlist(service.id)}
              currentUser={currentUser}
              users={users}
              onUpdateUser={setCurrentUser}
              onOptOut={onOptOut ? () => onOptOut(service.id) : undefined}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl">
            <p className="text-gray-500">You haven't joined any deals yet.</p>
          </div>
        )}
      </div>

      {/* Wishlist */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Heart className="w-6 h-6 text-red-500" fill="currentColor" />
        Wishlist & Favorites
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {services.filter(s => (currentUser?.wishlist || []).includes(s.id)).length > 0 ? (
          services.filter(s => (currentUser?.wishlist || []).includes(s.id)).map((service, index) => (
            <ServiceCard
              key={`wishlist-${service.id}-${index}`}
              service={service}
              business={businesses.find(b => b.id === service.businessId)}
              onSignUp={() => onSignUp(service.id)}
              isSignedUp={(service.signedUpUserIds || []).includes(currentUser?.id || '')}
              onBusinessClick={() => onBusinessClick(service.businessId)}
              onServiceClick={() => onServiceClick(service.id)}
              isWishlisted={true}
              onToggleWishlist={() => onToggleWishlist(service.id)}
              currentUser={currentUser}
              users={users}
              onUpdateUser={setCurrentUser}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl">
            <p className="text-gray-500">Your wishlist is empty.</p>
          </div>
        )}
      </div>

      {/* Deal Requests History */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Deal Requests</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
        {dealRequests.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {[...dealRequests].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((request) => (
              <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{request.serviceName}</h3>
                    {request.businessId && (
                      <p className="text-sm text-gray-500 mt-1">
                        Requested from: <span className="font-medium text-gray-700">{businesses.find(b => b.id === request.businessId)?.name || 'Unknown Business'}</span>
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{request.description}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Requested on {new Date(request.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-100 shrink-0">
                    {getStatusIcon(request.status)}
                    <span className="font-medium text-sm text-gray-700">{getStatusText(request.status)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">You haven't requested any custom deals yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
