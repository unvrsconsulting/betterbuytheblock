import React, { useState } from 'react';
import { Business } from '../types';
import { MapPin, AlertCircle } from 'lucide-react';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import { checkContent } from '../services/contentModeration';

interface BusinessEditProfileProps {
  business: Business;
  onSave: (updates: Partial<Business>) => void;
  onCancel: () => void;
}

const BusinessEditProfile: React.FC<BusinessEditProfileProps> = ({ business, onSave, onCancel }) => {
  const [name, setName] = useState(business.name || '');
  const [category, setCategory] = useState(business.category || '');
  const [address, setAddress] = useState(business.address || '');
  const [description, setDescription] = useState(business.description || '');
  const [website, setWebsite] = useState(business.website || '');
  const [gmbUrl, setGmbUrl] = useState(business.googleBusinessUrl || '');
  const [phone, setPhone] = useState(business.phone || '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

    if (!address.trim()) {
      setFormError("Please enter your business's primary address.");
      return;
    }
    if (!phone.trim()) {
      setFormError('Please enter a phone number so neighbors can reach you.');
      return;
    }
    setFormError(null);

    onSave({
      name: name.trim(),
      category,
      address: address.trim(),
      description: description.trim(),
      website: website.trim() || undefined,
      phone: phone.trim(),
      googleBusinessUrl: gmbUrl.trim() || undefined,
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Business Address</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="123 Main St, Raleigh, NC 27601"
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

        {formError && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
          </p>
        )}

        <div className="flex justify-between pt-6 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </div>
  );
};

export default BusinessEditProfile;
