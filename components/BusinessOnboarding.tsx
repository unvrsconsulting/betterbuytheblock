import React, { useState } from 'react';
import { User, Business, UserType } from '../types';
import { Building2, MapPin, CheckCircle, AlertCircle, Loader2, Upload, Building } from 'lucide-react';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import BusinessOfferingsEditor from './BusinessOfferingsEditor';
import { checkContent } from '../services/contentModeration';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { useVerifiedImageUpload } from '../hooks/useVerifiedImageUpload';
import { getCities, searchNeighborhoods } from '../services/neighborhoods';

interface BusinessOnboardingProps {
  currentUser: User | null;
  onComplete: (business: Partial<Business>) => void;
  onCancel: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ['Business', 'Contact', 'Service Area', 'Services'];

const BusinessOnboarding: React.FC<BusinessOnboardingProps> = ({ currentUser, onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('NC');
  const [zip, setZip] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [gmbUrl, setGmbUrl] = useState('');
  const [noGmb, setNoGmb] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceAreaCities, setServiceAreaCities] = useState<string[]>([]);
  const [serviceAreaNeighborhoodIds, setServiceAreaNeighborhoodIds] = useState<string[]>([]);
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [offerings, setOfferings] = useState<Business['offerings']>([]);
  const [contentError, setContentError] = useState<string | null>(null);

  const { neighborhoods } = useNeighborhoods();
  const cities = getCities(neighborhoods);
  const banner = useVerifiedImageUpload();

  const toggleServiceCity = (c: string) => {
    setServiceAreaCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };
  const toggleServiceNeighborhood = (id: string) => {
    setServiceAreaNeighborhoodIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const filteredNeighborhoods = searchNeighborhoods(neighborhoods, neighborhoodSearch, 20);
  const selectedNeighborhoodObjs = neighborhoods.filter(n => serviceAreaNeighborhoodIds.includes(n.id));

  const handleNext = () => {
    if (step === 1) {
      const nameCheck = checkContent(businessName, { minLength: 2, maxLength: 80, fieldName: 'Business name' });
      if (!nameCheck.allowed) {
        setContentError(nameCheck.reason || 'That business name could not be submitted.');
        return;
      }
      if (!category) {
        setContentError('Please select a category for your business.');
        return;
      }
      if (!street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
        setContentError("Please enter your business's full street address, city, state, and zip.");
        return;
      }
      if (description.trim()) {
        const descCheck = checkContent(description, { minLength: 10, maxLength: 1000, fieldName: 'Description' });
        if (!descCheck.allowed) {
          setContentError(descCheck.reason || 'That description could not be submitted.');
          return;
        }
      }
      setContentError(null);
    }
    if (step === 2) {
      if (!phone.trim()) {
        setContentError('Please enter a phone number so neighbors can reach you.');
        return;
      }
      if (!EMAIL_PATTERN.test(email.trim())) {
        setContentError('Please enter a valid business email address.');
        return;
      }
      if (!noGmb && !gmbUrl.trim()) {
        setContentError('A Google Business Profile URL is required so we can verify your business, or check the box if you don\'t have one.');
        return;
      }
      if (banner.imageError) {
        setContentError('Fix the banner image issue above before continuing.');
        return;
      }
      setContentError(null);
    }
    if (step < 5) setStep(step + 1);
    else {
      onComplete({
        name: businessName,
        category,
        street,
        city,
        state,
        zip,
        address: `${street}, ${city}, ${state} ${zip}`,
        description,
        website,
        phone,
        email,
        googleBusinessUrl: noGmb ? undefined : gmbUrl,
        logoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=random`,
        coverImageUrl: banner.imageUrl || undefined,
        serviceAreaCities,
        serviceAreaNeighborhoodIds,
        offerings,
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-primary-50 p-8 text-center">
        <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Grow your business with BetterBuyTheBlock</h1>
        <p className="text-gray-600">Reach local customers by offering exclusive group discounts.</p>
      </div>

      <div className="p-8">
        <div className="flex justify-between mb-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
          <div className="absolute top-1/2 left-0 h-0.5 bg-primary -z-10 -translate-y-1/2 transition-all" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s <= 4 && <span className={`text-[10px] mt-1 font-medium ${step >= s ? 'text-primary-700' : 'text-gray-400'}`}>{STEP_LABELS[s - 1]}</span>}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tell us about your business</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => { setBusinessName(e.target.value); if (contentError) setContentError(null); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="e.g. Acme Plumbing"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <CategoryPicker value={category} onChange={(c) => { setCategory(c); if (contentError) setContentError(null); }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={street}
                  onChange={(e) => { setStreet(e.target.value); if (contentError) setContentError(null); }}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="123 Main St"
                />
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => { setCity(e.target.value); if (contentError) setContentError(null); }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Raleigh"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => { setState(e.target.value); if (contentError) setContentError(null); }}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none uppercase"
                  placeholder="NC"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => { setZip(e.target.value); if (contentError) setContentError(null); }}
                  maxLength={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="27601"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">Description</label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); if (contentError) setContentError(null); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="What services do you offer?"
                rows={4}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact & Branding</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); if (contentError) setContentError(null); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (contentError) setContentError(null); }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="contact@yourbusiness.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website URL <span className="text-gray-400">(optional)</span></label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Business Profile URL</label>
              <input
                type="url"
                value={gmbUrl}
                onChange={(e) => { setGmbUrl(e.target.value); if (contentError) setContentError(null); }}
                disabled={noGmb}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Link to your Google Business Profile"
              />
              <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noGmb}
                  onChange={(e) => {
                    setNoGmb(e.target.checked);
                    if (e.target.checked) setGmbUrl('');
                    if (contentError) setContentError(null);
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                I don't have a Google Business Profile
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Banner Image <span className="text-gray-400">(optional)</span></label>
              <p className="text-xs text-gray-500 mb-2">Shown across the top of your public business page.</p>
              <div className="flex items-center gap-3">
                <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed cursor-pointer text-sm font-medium shrink-0 transition-colors ${banner.imageError ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-600 hover:border-primary hover:text-primary'}`}>
                  {banner.isUploading || banner.isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {banner.imageUrl ? 'Change banner' : 'Upload banner'}
                  <input type="file" accept="image/*" onChange={banner.handleFileChange} className="hidden" />
                </label>
                {banner.imageUrl && !banner.imageError && (
                  <img src={banner.imageUrl} alt="Banner preview" className="h-14 w-24 rounded-lg object-cover border border-gray-200" />
                )}
              </div>
              {banner.imageError && <p className="text-red-500 text-xs mt-1">{banner.imageError}</p>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Where do you work?</h2>
            <p className="text-sm text-gray-600 mb-4">This becomes the default targeting when you create a deal — you can still adjust it per deal.</p>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Building className="w-4 h-4" /> Cities you serve</p>
              <div className="flex flex-wrap gap-1.5">
                {cities.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleServiceCity(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      serviceAreaCities.includes(c) ? 'border-primary bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1 mt-4">Specific neighborhoods <span className="font-normal text-gray-400">(optional, separate from cities above)</span></p>
              <input
                type="text"
                value={neighborhoodSearch}
                onChange={(e) => setNeighborhoodSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-2"
                placeholder="Search neighborhoods..."
              />
              {selectedNeighborhoodObjs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedNeighborhoodObjs.map(n => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleServiceNeighborhood(n.id)}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold border border-primary bg-primary-50 text-primary-700 flex items-center gap-1"
                    >
                      {n.name} <span className="text-primary-400">×</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {filteredNeighborhoods.filter(n => !serviceAreaNeighborhoodIds.includes(n.id)).slice(0, 12).map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => toggleServiceNeighborhood(n.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {n.name} <span className="text-gray-400">{n.city}, NC</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Services You Offer</h2>
            <p className="text-sm text-gray-600 mb-4">Up to 10 — shown on your public profile. This is separate from the discounted neighborhood deals you'll create afterward.</p>
            <BusinessOfferingsEditor offerings={offerings || []} onChange={setOfferings} cities={cities} />
          </div>
        )}

        {contentError && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {contentError}
          </p>
        )}

        {step === 5 && (
          <div className="space-y-4 text-center py-8">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
            <p className="text-gray-600 mb-6">Your business profile is ready. You can now start creating deals for neighborhoods.</p>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <Button variant="outline" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              (step === 1 && (!businessName || !category || !street.trim() || !city.trim() || !state.trim() || !zip.trim())) ||
              (step === 2 && (!phone.trim() || !email.trim() || (!noGmb && !gmbUrl.trim()) || banner.isUploading || banner.isVerifying))
            }
          >
            {step === 5 ? 'Go to Dashboard' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BusinessOnboarding;
