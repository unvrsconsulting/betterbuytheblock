import React, { useState } from 'react';
import { Business } from '../types';
import { MapPin, AlertCircle, Loader2, Upload, Building } from 'lucide-react';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import BusinessOfferingsEditor from './BusinessOfferingsEditor';
import { checkContent } from '../services/contentModeration';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { useVerifiedImageUpload } from '../hooks/useVerifiedImageUpload';
import { getCities, searchNeighborhoods } from '../services/neighborhoods';

interface BusinessEditProfileProps {
  business: Business;
  onSave: (updates: Partial<Business>) => void;
  onCancel: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BusinessEditProfile: React.FC<BusinessEditProfileProps> = ({ business, onSave, onCancel }) => {
  const [name, setName] = useState(business.name || '');
  const [category, setCategory] = useState(business.category || '');
  const [street, setStreet] = useState(business.street || '');
  const [city, setCity] = useState(business.city || '');
  const [state, setState] = useState(business.state || 'NC');
  const [zip, setZip] = useState(business.zip || '');
  const [description, setDescription] = useState(business.description || '');
  const [website, setWebsite] = useState(business.website || '');
  const [gmbUrl, setGmbUrl] = useState(business.googleBusinessUrl || '');
  const [phone, setPhone] = useState(business.phone || '');
  const [email, setEmail] = useState(business.email || '');
  const [serviceAreaCities, setServiceAreaCities] = useState<string[]>(business.serviceAreaCities || []);
  const [serviceAreaNeighborhoodIds, setServiceAreaNeighborhoodIds] = useState<string[]>(business.serviceAreaNeighborhoodIds || []);
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [offerings, setOfferings] = useState<Business['offerings']>(business.offerings || []);
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { neighborhoods } = useNeighborhoods();
  const cities = getCities(neighborhoods);
  const banner = useVerifiedImageUpload(business.coverImageUrl || '');

  const toggleServiceCity = (c: string) => {
    setServiceAreaCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };
  const toggleServiceNeighborhood = (id: string) => {
    setServiceAreaNeighborhoodIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const filteredNeighborhoods = searchNeighborhoods(neighborhoods, neighborhoodSearch, 20);
  const selectedNeighborhoodObjs = neighborhoods.filter(n => serviceAreaNeighborhoodIds.includes(n.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nameCheck = checkContent(name, { minLength: 2, maxLength: 80, fieldName: 'Business name' });
    if (!nameCheck.allowed) {
      setNameError(nameCheck.reason || 'That business name could not be submitted.');
      return;
    }
    setNameError(null);

    if (description.trim()) {
      const descCheck = checkContent(description, { minLength: 10, maxLength: 1000, fieldName: 'Description' });
      if (!descCheck.allowed) {
        setDescriptionError(descCheck.reason || 'That description could not be submitted.');
        return;
      }
    }
    setDescriptionError(null);

    if (!street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      setFormError("Please enter your business's full street address, city, state, and zip.");
      return;
    }
    if (!phone.trim()) {
      setFormError('Please enter a phone number so neighbors can reach you.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFormError('Please enter a valid business email address.');
      return;
    }
    if (banner.imageError) {
      setFormError('Fix the banner image issue above before saving.');
      return;
    }
    setFormError(null);

    onSave({
      name: name.trim(),
      category,
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      address: `${street.trim()}, ${city.trim()}, ${state.trim()} ${zip.trim()}`,
      description: description.trim(),
      website: website.trim() || undefined,
      phone: phone.trim(),
      email: email.trim(),
      googleBusinessUrl: gmbUrl.trim() || undefined,
      coverImageUrl: banner.imageUrl || undefined,
      serviceAreaCities,
      serviceAreaNeighborhoodIds,
      offerings,
    });
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-primary-50 p-8 text-center">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Edit Business Profile</h1>
        <p className="text-gray-600">Keep your business information up to date for neighbors.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="e.g. Acme Plumbing"
          />
          {nameError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {nameError}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
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
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="Raleigh"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
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
              onChange={(e) => setZip(e.target.value)}
              maxLength={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="27601"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); if (descriptionError) setDescriptionError(null); }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="What services do you offer?"
            rows={4}
          />
          {descriptionError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {descriptionError}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="(555) 123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="contact@yourbusiness.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
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
            onChange={(e) => setGmbUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="Link to your Google Business Profile"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profile Banner Image</label>
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

        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5"><Building className="w-4 h-4" /> Service Area — Cities</p>
          <p className="text-xs text-gray-500 mb-2">Used as the default targeting when you create a new deal.</p>
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
          <p className="text-sm font-medium text-gray-700 mb-1">Service Area — Specific Neighborhoods <span className="font-normal text-gray-400">(optional)</span></p>
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

        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-1">Services You Offer</p>
          <p className="text-xs text-gray-500 mb-2">Up to 10 — shown on your public profile.</p>
          <BusinessOfferingsEditor offerings={offerings || []} onChange={setOfferings} cities={cities} />
        </div>

        {formError && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
          </p>
        )}

        <div className="flex justify-between pt-6 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={banner.isUploading || banner.isVerifying}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
};

export default BusinessEditProfile;
