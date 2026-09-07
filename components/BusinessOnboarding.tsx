import React, { useState } from 'react';
import { User, Business, UserType } from '../types';
import { Building2, MapPin, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import { checkContent } from '../services/contentModeration';

interface BusinessOnboardingProps {
  currentUser: User | null;
  onComplete: (business: Partial<Business>) => void;
  onCancel: () => void;
}

const BusinessOnboarding: React.FC<BusinessOnboardingProps> = ({ currentUser, onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [gmbUrl, setGmbUrl] = useState('');
  const [noGmb, setNoGmb] = useState(false);
  const [phone, setPhone] = useState('');
  const [contentError, setContentError] = useState<string | null>(null);

  const handleNext = () => {
    if (step === 1) {
      const nameCheck = checkContent(businessName, { minLength: 2, maxLength: 80, fieldName: 'Business name' });
      if (!nameCheck.allowed) {
        setContentError(nameCheck.reason || 'That business name could not be submitted.');
        return;
      }
      if (!noGmb && !gmbUrl.trim()) {
        setContentError('A Google Business Profile URL is required so we can verify your business, or check the box if you don\'t have one.');
        return;
      }
      if (!category) {
        setContentError('Please select a category for your business.');
        return;
      }
      if (!address.trim()) {
        setContentError('Please enter your business\'s primary address.');
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
    if (step === 2 && !phone.trim()) {
      setContentError('Please enter a phone number so neighbors can reach you.');
      return;
    }
    if (step < 3) setStep(step + 1);
    else {
      onComplete({
        name: businessName,
        category,
        address,
        description,
        website,
        phone,
        googleBusinessUrl: noGmb ? undefined : gmbUrl,
        logoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=random`,
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
          <div className="absolute top-1/2 left-0 h-0.5 bg-primary -z-10 -translate-y-1/2 transition-all" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > s ? <CheckCircle className="w-5 h-5" /> : s}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Business Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); if (contentError) setContentError(null); }}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="123 Main St, Raleigh, NC 27601"
                />
              </div>
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
                onChange={(e) => { setGmbUrl(e.target.value); if (contentError) setContentError(null); }}
                disabled={noGmb}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:bg-gray-50 disabled:text-gray-500"
                placeholder="Link to your Google Business Profile"
              />
              <p className="text-xs text-gray-500 mt-1">
                We use this to verify your business and to add a "View on Google" link to your public profile.
              </p>
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>
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
          </div>
        )}

        {contentError && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {contentError}
          </p>
        )}

        {step === 3 && (
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
              (step === 1 && (!businessName || !category || !address.trim() || (!noGmb && !gmbUrl.trim()))) ||
              (step === 2 && !phone.trim())
            }
          >
            {step === 3 ? 'Go to Dashboard' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BusinessOnboarding;
