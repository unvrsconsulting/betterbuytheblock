import React, { useState } from 'react';
import { BusinessOffering } from '../types';
import { Plus, X, Loader2, Upload, ImageOff, AlertCircle } from 'lucide-react';
import Button from './Button';
import { useVerifiedImageUpload } from '../hooks/useVerifiedImageUpload';
import { checkContent } from '../services/contentModeration';

const MAX_OFFERINGS = 10;

interface BusinessOfferingsEditorProps {
  offerings: BusinessOffering[];
  onChange: (offerings: BusinessOffering[]) => void;
  cities: string[];
}

const BusinessOfferingsEditor: React.FC<BusinessOfferingsEditorProps> = ({ offerings, onChange, cities }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const image = useVerifiedImageUpload();

  const toggleCity = (city: string) => {
    setSelectedCities(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]);
  };

  const handleAdd = () => {
    const titleCheck = checkContent(title, { minLength: 2, maxLength: 80, fieldName: 'Service name' });
    if (!titleCheck.allowed) {
      setFormError(titleCheck.reason || 'That service name could not be added.');
      return;
    }
    if (description.trim()) {
      const descCheck = checkContent(description, { minLength: 10, maxLength: 300, fieldName: 'Description' });
      if (!descCheck.allowed) {
        setFormError(descCheck.reason || 'That description could not be added.');
        return;
      }
    }
    if (image.imageError) {
      setFormError('Fix the image issue above before adding this service.');
      return;
    }
    setFormError('');

    const newOffering: BusinessOffering = {
      id: `offering_${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      imageUrl: image.imageUrl || undefined,
      cities: selectedCities,
    };
    onChange([...offerings, newOffering]);
    setTitle('');
    setDescription('');
    setSelectedCities([]);
    image.reset();
  };

  const handleRemove = (id: string) => {
    onChange(offerings.filter(o => o.id !== id));
  };

  return (
    <div className="space-y-4">
      {offerings.length > 0 && (
        <div className="space-y-2">
          {offerings.map(o => (
            <div key={o.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
              {o.imageUrl ? (
                <img src={o.imageUrl} alt={o.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <ImageOff className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{o.title}</p>
                {o.description && <p className="text-xs text-gray-500 truncate">{o.description}</p>}
                {o.cities.length > 0 && <p className="text-xs text-gray-400">{o.cities.join(', ')}</p>}
              </div>
              <button type="button" onClick={() => handleRemove(o.id)} className="text-gray-400 hover:text-red-500 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {offerings.length >= MAX_OFFERINGS ? (
        <p className="text-sm text-gray-500">You've added the maximum of {MAX_OFFERINGS} services.</p>
      ) : (
        <div className="p-4 border border-dashed border-gray-300 rounded-xl space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Service Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (formError) setFormError(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="e.g. Gutter Cleaning"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); if (formError) setFormError(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              rows={2}
              placeholder="A sentence or two about this service"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Service Locations <span className="text-gray-400">(optional)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {cities.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCity(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    selectedCities.includes(c) ? 'border-primary bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Photo <span className="text-gray-400">(optional)</span></label>
            <div className="flex items-center gap-2">
              <label className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed cursor-pointer text-sm font-medium shrink-0 transition-colors ${image.imageError ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-600 hover:border-primary hover:text-primary'}`}>
                {image.isUploading || image.isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {image.imageUrl ? 'Change photo' : 'Upload photo'}
                <input type="file" accept="image/*" onChange={image.handleFileChange} className="hidden" />
              </label>
              {image.imageUrl && !image.imageError && (
                <img src={image.imageUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
              )}
            </div>
            {image.imageError && <p className="text-red-500 text-xs mt-1">{image.imageError}</p>}
          </div>
          {formError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleAdd}
            disabled={!title.trim() || image.isUploading || image.isVerifying}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Service
          </Button>
        </div>
      )}
    </div>
  );
};

export default BusinessOfferingsEditor;
