import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, User as UserIcon, Building2, Users as UsersIcon, MapPin, Navigation } from 'lucide-react';
import Button from './Button';
import { User, UserType } from '../types';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { searchNeighborhoods, findNearestNeighborhood } from '../services/neighborhoods';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onSignUp: (user: User, accountType: 'resident' | 'business') => void;
  onSignIn: (userId: string) => void;
  defaultAccountType?: 'resident' | 'business';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, users, onSignUp, onSignIn, defaultAccountType }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [accountType, setAccountType] = useState<'resident' | 'business'>(defaultAccountType || 'resident');
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [showNeighborhoodDropdown, setShowNeighborhoodDropdown] = useState(false);
  const { neighborhoods } = useNeighborhoods();

  const filteredNeighborhoods = searchNeighborhoods(neighborhoods, neighborhoodSearch, 6);

  useEffect(() => {
    if (isOpen) {
      setAccountType(defaultAccountType || 'resident');
      if (defaultAccountType === 'business') {
        setIsLogin(false);
      }
    }
  }, [isOpen, defaultAccountType]);

  const resetAndClose = () => {
    setEmail('');
    setName('');
    setError('');
    setIsLogin(true);
    setNeighborhoodId('');
    setNeighborhoodSearch('');
    onClose();
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestNeighborhood(neighborhoods, position.coords.latitude, position.coords.longitude);
        if (nearest) {
          setNeighborhoodId(nearest.id);
          setNeighborhoodSearch(`${nearest.name}, ${nearest.city}, NC`);
          setShowNeighborhoodDropdown(false);
        }
      },
      (error) => console.error('Error getting location:', error)
    );
  };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (isLogin) {
      const existing = users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
      if (!existing) {
        setError('No local profile found with that email. Try signing up instead.');
        return;
      }
      onSignIn(existing.id);
    } else {
      if (!name.trim() || !email.trim()) {
        setError('Name and email are required.');
        return;
      }
      if (!neighborhoodId) {
        setError('Please select your neighborhood.');
        return;
      }
      if (users.some(u => u.email?.toLowerCase() === email.trim().toLowerCase())) {
        setError('A profile with that email already exists. Try signing in instead.');
        return;
      }
      const newUser: User = {
        id: `local-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        type: UserType.RESIDENT,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random`,
        neighborhoodId,
        wishlist: [],
        connections: [],
        connectionCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      };
      onSignUp(newUser, accountType);
    }
    resetAndClose();
  };

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
              onClick={resetAndClose}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                {isLogin ? 'Welcome Back' : accountType === 'business' ? 'List Your Business' : 'Join the Neighborhood'}
              </h2>
              <p className="text-xs text-gray-500 text-center mb-6">
                Free local profile — stored only in this browser, no password needed.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              {!isLogin && (
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">I'm signing up as a...</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountType('resident')}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-colors ${accountType === 'resident' ? 'border-primary bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                      <UsersIcon className="w-5 h-5" />
                      <span className="text-sm font-semibold">Neighbor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('business')}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-colors ${accountType === 'business' ? 'border-primary bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                      <Building2 className="w-5 h-5" />
                      <span className="text-sm font-semibold">Business</span>
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="Jane Doe"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                {!isLogin && (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Neighborhood</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={neighborhoodSearch}
                        onChange={(e) => { setNeighborhoodSearch(e.target.value); setShowNeighborhoodDropdown(true); if (neighborhoodId) setNeighborhoodId(''); }}
                        onFocus={() => setShowNeighborhoodDropdown(true)}
                        onBlur={() => setTimeout(() => setShowNeighborhoodDropdown(false), 200)}
                        className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="Search your neighborhood or city..."
                      />
                    </div>
                    {showNeighborhoodDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {filteredNeighborhoods.length > 0 ? (
                          filteredNeighborhoods.map((n, index) => (
                            <div
                              key={`n-${n.id}-${index}`}
                              className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                              onMouseDown={() => {
                                setNeighborhoodId(n.id);
                                setNeighborhoodSearch(`${n.name}, ${n.city}, NC`);
                                setShowNeighborhoodDropdown(false);
                              }}
                            >
                              <div className="font-medium text-gray-900 text-sm">{n.name}</div>
                              <div className="text-xs text-gray-500">{n.city}, NC</div>
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
                      className="mt-1.5 text-xs font-bold text-primary-600 hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Use my current location
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full py-3 rounded-xl font-bold mt-2">
                  {isLogin ? 'Sign In' : accountType === 'business' ? 'Create Business Account' : 'Create Profile'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-600">
                {isLogin ? "Don't have a profile? " : "Already have a profile? "}
                <button
                  onClick={() => { setError(''); setIsLogin(!isLogin); }}
                  className="text-primary font-bold hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
