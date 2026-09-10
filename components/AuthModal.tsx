import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, User as UserIcon, Building2, Users as UsersIcon, MapPin, Navigation, Phone, CheckCircle2, Home } from 'lucide-react';
import Button from './Button';
import { User, UserType } from '../types';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { searchNeighborhoods, findNearestNeighborhood } from '../services/neighborhoods';
import { CATEGORY_GROUPS } from '../constants';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onSignUp: (user: User, accountType: 'resident' | 'business') => void;
  onSignIn: (userId: string) => void;
  defaultAccountType?: 'resident' | 'business';
  // When set, sign-up only ever creates this account type — the entry
  // point already said which one (the "List Services" button is
  // business-only, the header "Sign In" is residents-only), so there's no
  // toggle to switch away from it.
  lockAccountType?: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, users, onSignUp, onSignIn, defaultAccountType, lockAccountType }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [accountType, setAccountType] = useState<'resident' | 'business'>(defaultAccountType || 'resident');
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [showNeighborhoodDropdown, setShowNeighborhoodDropdown] = useState(false);
  const { neighborhoods } = useNeighborhoods();

  const [address, setAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeNote, setGeocodeNote] = useState('');

  const [phone, setPhone] = useState('');
  // 'unknown' until the first send attempt tells us whether Twilio is wired
  // up — once we learn it isn't, we stop requiring `verified` before signup
  // can proceed, so a real visitor is never blocked by our own missing
  // credentials. See api/phone-verify.ts.
  const [phoneVerifyAvailable, setPhoneVerifyAvailable] = useState<'unknown' | true | false>('unknown');
  const [phoneVerifyStatus, setPhoneVerifyStatus] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'verified'>('idle');
  const [phoneVerifyError, setPhoneVerifyError] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [interestedCategories, setInterestedCategories] = useState<string[]>([]);

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
    setAddress('');
    setGeocodeNote('');
    setPhone('');
    setPhoneVerifyStatus('idle');
    setPhoneVerifyError('');
    setOtpCode('');
    setInterestedCategories([]);
    onClose();
  };

  // Runs on address blur — turns the typed address into lat/lng via our own
  // Census Geocoder proxy (see api/geocode.ts) and reuses the same
  // findNearestNeighborhood util "Use my current location" already relies
  // on, so a matched address fills in exactly what that button would have.
  const handleGeocodeAddress = async () => {
    if (!address.trim() || address.trim().length < 5) return;
    setIsGeocoding(true);
    setGeocodeNote('');
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.matched) {
        setGeocodeNote("Couldn't match that address to a neighborhood — search for it below instead.");
        return;
      }
      const nearest = findNearestNeighborhood(neighborhoods, data.lat, data.lng);
      if (nearest) {
        setNeighborhoodId(nearest.id);
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

  const PHONE_DIGITS_PATTERN = /^\d{10}$/;

  const handleSendCode = async () => {
    const digits = phone.replace(/\D/g, '');
    if (!PHONE_DIGITS_PATTERN.test(digits)) {
      setPhoneVerifyError('Enter a valid 10-digit phone number first.');
      return;
    }
    setPhoneVerifyError('');
    setPhoneVerifyStatus('sending');
    try {
      const res = await fetch('/api/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone: digits }),
      });
      const data = await res.json();
      if (res.status === 503 && data.configured === false) {
        setPhoneVerifyAvailable(false);
        setPhoneVerifyStatus('idle');
        return;
      }
      if (!res.ok) {
        setPhoneVerifyAvailable(true);
        setPhoneVerifyStatus('idle');
        setPhoneVerifyError(data.error || 'Could not send a code, try again.');
        return;
      }
      setPhoneVerifyAvailable(true);
      setPhoneVerifyStatus('sent');
    } catch (err) {
      console.error('Send verification code failed', err);
      setPhoneVerifyStatus('idle');
      setPhoneVerifyError('Could not send a code, try again.');
    }
  };

  const handleCheckCode = async () => {
    const digits = phone.replace(/\D/g, '');
    if (!otpCode.trim()) {
      setPhoneVerifyError('Enter the code you were sent.');
      return;
    }
    setPhoneVerifyError('');
    setPhoneVerifyStatus('checking');
    try {
      const res = await fetch('/api/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', phone: digits, code: otpCode.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setPhoneVerifyStatus('verified');
      } else {
        setPhoneVerifyStatus('sent');
        setPhoneVerifyError('That code was incorrect — try again.');
      }
    } catch (err) {
      console.error('Check verification code failed', err);
      setPhoneVerifyStatus('sent');
      setPhoneVerifyError('Could not check that code, try again.');
    }
  };

  const toggleInterestedCategory = (category: string) => {
    setInterestedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
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
      if (accountType === 'resident' && !address.trim()) {
        setError('Please enter your address.');
        return;
      }
      if (!neighborhoodId) {
        setError('Please select your neighborhood.');
        return;
      }
      if (accountType === 'resident') {
        const digits = phone.replace(/\D/g, '');
        if (!PHONE_DIGITS_PATTERN.test(digits)) {
          setError('Please enter a valid 10-digit phone number.');
          return;
        }
        // Only actually require the verify step to have completed if we know
        // the service is live — see phoneVerifyAvailable's definition above.
        if (phoneVerifyAvailable !== false && phoneVerifyStatus !== 'verified') {
          setError('Please verify your phone number.');
          return;
        }
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
        ...(accountType === 'resident' ? {
          address: address.trim(),
          phone: phone.replace(/\D/g, ''),
          phoneVerified: phoneVerifyStatus === 'verified',
          interestedCategories,
        } : {}),
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
                Free local profile - stored only in this browser, no password needed.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              {!isLogin && !lockAccountType && (
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

                {!isLogin && accountType === 'resident' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <div className="relative">
                      <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onBlur={handleGeocodeAddress}
                        className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        placeholder="123 Main St, Raleigh, NC 27601"
                        required={accountType === 'resident'}
                      />
                    </div>
                    {isGeocoding && <p className="mt-1.5 text-xs text-gray-500">Looking up your neighborhood...</p>}
                    {!isGeocoding && geocodeNote && <p className="mt-1.5 text-xs text-gray-500">{geocodeNote}</p>}
                  </div>
                )}

                {!isLogin && (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Neighborhood {accountType === 'resident' && <span className="font-normal text-gray-400">(matched from your address above — search here if that's wrong)</span>}
                    </label>
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

                {!isLogin && accountType === 'resident' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value); setPhoneVerifyStatus('idle'); setPhoneVerifyError(''); }}
                          className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:bg-gray-50 disabled:text-gray-400"
                          placeholder="(919) 555-1234"
                          required
                          disabled={phoneVerifyStatus === 'verified'}
                        />
                      </div>
                      {phoneVerifyStatus === 'verified' ? (
                        <span className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-xl bg-green-50 text-green-700 text-sm font-bold border border-green-200">
                          <CheckCircle2 className="w-4 h-4" /> Verified
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendCode}
                          disabled={phoneVerifyStatus === 'sending' || phoneVerifyAvailable === false}
                          className="shrink-0 px-4 rounded-xl border-2 border-primary text-primary-700 text-sm font-bold hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                          {phoneVerifyStatus === 'sending' ? 'Sending...' : phoneVerifyStatus === 'sent' || phoneVerifyStatus === 'checking' ? 'Resend' : 'Send code'}
                        </button>
                      )}
                    </div>

                    {phoneVerifyAvailable === false && (
                      <p className="mt-1.5 text-xs text-gray-500">Phone verification is temporarily unavailable — you can still create your profile with this number.</p>
                    )}

                    {(phoneVerifyStatus === 'sent' || phoneVerifyStatus === 'checking') && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Enter the 6-digit code"
                        />
                        <button
                          type="button"
                          onClick={handleCheckCode}
                          disabled={phoneVerifyStatus === 'checking'}
                          className="shrink-0 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-50"
                        >
                          {phoneVerifyStatus === 'checking' ? 'Checking...' : 'Verify'}
                        </button>
                      </div>
                    )}

                    {phoneVerifyError && <p className="mt-1.5 text-xs text-red-600">{phoneVerifyError}</p>}
                  </div>
                )}

                {!isLogin && accountType === 'resident' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      What are you interested in? <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                      {CATEGORY_GROUPS.flatMap(g => g.categories).map(category => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => toggleInterestedCategory(category)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            interestedCategories.includes(category)
                              ? 'border-primary bg-primary-50 text-primary-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
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
