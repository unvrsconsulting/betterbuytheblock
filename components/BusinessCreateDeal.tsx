import React, { useState, useMemo } from 'react';
import { User, Business, Service, Neighborhood, NeighborhoodAudience } from '../types';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Circle } from 'react-leaflet';
import L from 'leaflet';
import Button from './Button';
import CategoryPicker from './CategoryPicker';
import ServiceCard from './ServiceCard';
import { CheckCircle, MapPin, DollarSign, Users, Tag, Sparkles, Loader2, Image as ImageIcon, Search, Pencil, X, AlertCircle, Upload, Bookmark, FileUp } from 'lucide-react';
import { verifyDealImage, generateDealRecommendations } from '../services/scraperService';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { useCityStats } from '../hooks/useCityStats';
import { searchNeighborhoods, getCities, neighborhoodsWithinRadius, estimateNeighborhoodPrice, estimateHomeCount } from '../services/neighborhoods';
import { checkContent } from '../services/contentModeration';
import { loadState, saveState } from '../services/localStore';
import { STARTING_BUSINESS_BALANCE } from '../constants';
import AddFundsControl from './AddFundsControl';

const MIN_IMAGE_WIDTH = 800;
const MIN_IMAGE_HEIGHT = 400;

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

function DrawAreaClickHandler({ active, onPick }: { active: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (active) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export interface DealBillingInfo {
  // Exactly the amount shown as "Total Due Today" (new deal) or "Additional Cost
  // for New Neighborhoods" (edit) on the review step. Zero when an edit adds no
  // new neighborhoods.
  amount: number;
  // The neighborhoods this charge actually paid for — all selected neighborhoods
  // for a new deal, or only the newly-added ones for an edit.
  chargedNeighborhoodIds: string[];
}

interface BusinessCreateDealProps {
  business: Business;
  initialService?: Service;
  onComplete: (service: Partial<Service>, selectedNeighborhoods: string[], billing: DealBillingInfo) => void;
  onCancel: () => void;
  onAddFunds: (amount: number) => void;
}

const BusinessCreateDeal: React.FC<BusinessCreateDealProps> = ({ business, initialService, onComplete, onCancel, onAddFunds }) => {
  const isEditing = !!initialService;
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(initialService?.title || '');
  const [description, setDescription] = useState(initialService?.description || '');
  const [category, setCategory] = useState(initialService?.category || '');
  const [standardPrice, setStandardPrice] = useState<number | ''>(initialService?.standardPrice ?? '');
  const [discountPercentage, setDiscountPercentage] = useState<number | ''>(initialService?.discountPercentage ?? '');
  const [requiredSignups, setRequiredSignups] = useState<number | ''>(initialService?.requiredSignups ?? '');
  const [closeAfterThreshold, setCloseAfterThreshold] = useState(initialService?.closeAfterThreshold || false);
  const [imageUrl, setImageUrl] = useState(initialService?.imageUrl || '');
  const [imageError, setImageError] = useState('');
  const [isVerifyingImage, setIsVerifyingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [expiresAt, setExpiresAt] = useState(
    initialService?.expiresAt
      ? new Date(initialService.expiresAt).toISOString().split('T')[0]
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(initialService?.neighborhoodIds || []);
  const originalNeighborhoodIds = useMemo(() => new Set(initialService?.neighborhoodIds || []), [initialService]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isGettingRecs, setIsGettingRecs] = useState(false);
  const [neighborhoodSearch, setNeighborhoodSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('All Cities');
  const [savedAudiences, setSavedAudiences] = useState<NeighborhoodAudience[]>(
    () => loadState<NeighborhoodAudience[]>(`savedAudiences_${business.id}`, [])
  );
  const [audienceNameDraft, setAudienceNameDraft] = useState('');
  const [isSavingAudience, setIsSavingAudience] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<{ matched: number; unmatched: string[] } | null>(null);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawCenter, setDrawCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [drawRadiusMiles, setDrawRadiusMiles] = useState(3);
  const [contentError, setContentError] = useState<string | null>(null);

  const { neighborhoods } = useNeighborhoods();
  const { cityStats } = useCityStats();

  const cities = useMemo(() => getCities(neighborhoods), [neighborhoods]);

  const cityScopedNeighborhoods = useMemo(
    () => (cityFilter === 'All Cities' ? neighborhoods : neighborhoods.filter(n => n.city === cityFilter)),
    [neighborhoods, cityFilter]
  );

  const filteredCandidates = useMemo(
    () => searchNeighborhoods(cityScopedNeighborhoods, neighborhoodSearch, 30),
    [cityScopedNeighborhoods, neighborhoodSearch]
  );

  const selectedNeighborhoodObjs = useMemo(
    () => neighborhoods.filter(n => selectedNeighborhoods.includes(n.id)),
    [neighborhoods, selectedNeighborhoods]
  );

  const candidateIds = useMemo(() => new Set(filteredCandidates.map(n => n.id)), [filteredCandidates]);
  const allExtraSelected = selectedNeighborhoodObjs.filter(n => !candidateIds.has(n.id));
  const extraSelectedCards = allExtraSelected.slice(0, 30);
  const hiddenSelectedCount = allExtraSelected.length - extraSelectedCards.length;
  const visibleNeighborhoods = [...extraSelectedCards, ...filteredCandidates];

  const handleGetRecommendations = async () => {
    if (!category) return;
    setIsGettingRecs(true);
    const recs = await generateDealRecommendations(category, business.name);
    setRecommendations(recs);
    setIsGettingRecs(false);
  };

  const applyRecommendation = (rec: any) => {
    setTitle(rec.title);
    setDescription(rec.description);
    setStandardPrice(rec.standardPrice);
    setDiscountPercentage(rec.discountPercentage);
    setRequiredSignups(rec.requiredSignups);
  };

  const handleImageBlur = async () => {
    if (!imageUrl) {
      setImageError('');
      return;
    }
    setIsVerifyingImage(true);
    setImageError('');
    const result = await verifyDealImage(imageUrl);
    if (!result.isAppropriate) {
      setImageError(result.reason || 'Image is not appropriate.');
    }
    setIsVerifyingImage(false);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.');
      return;
    }

    setIsUploadingImage(true);
    setImageError('');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth < MIN_IMAGE_WIDTH || img.naturalHeight < MIN_IMAGE_HEIGHT) {
          setImageError(
            `Image is ${img.naturalWidth}×${img.naturalHeight}px — minimum required is ${MIN_IMAGE_WIDTH}×${MIN_IMAGE_HEIGHT}px.`
          );
          setIsUploadingImage(false);
          return;
        }
        setImageUrl(dataUrl);
        setIsUploadingImage(false);
      };
      img.onerror = () => {
        setImageError('Could not read that image file.');
        setIsUploadingImage(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setImageError('Could not read that image file.');
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const discountedPrice = useMemo(() => {
    const price = Number(standardPrice) || 0;
    const discount = Number(discountPercentage) || 0;
    return Math.max(0, price * (1 - discount / 100));
  }, [standardPrice, discountPercentage]);

  const previewService: Service = useMemo(() => ({
    id: 'preview',
    businessId: business.id,
    neighborhoodIds: selectedNeighborhoods,
    title: title || 'Your deal title',
    description: description || 'Your deal description will appear here.',
    category: category || 'Category',
    standardPrice: Number(standardPrice) || 0,
    discountPercentage: Number(discountPercentage) || 0,
    requiredSignups: Number(requiredSignups) || 0,
    currentSignups: 0,
    signedUpUserIds: [],
    imageUrl: imageUrl || undefined,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    closeAfterThreshold,
  }), [business.id, selectedNeighborhoods, title, description, category, standardPrice, discountPercentage, requiredSignups, imageUrl, expiresAt, closeAfterThreshold]);

  const toggleNeighborhood = (id: string) => {
    setSelectedNeighborhoods(prev =>
      prev.includes(id) ? prev.filter(nId => nId !== id) : [...prev, id]
    );
  };

  const handleSelectAllInCity = () => {
    if (cityFilter === 'All Cities') return;
    setSelectedNeighborhoods(prev => {
      const ids = new Set(prev);
      cityScopedNeighborhoods.forEach(n => ids.add(n.id));
      return Array.from(ids);
    });
  };

  const handleClearSelection = () => setSelectedNeighborhoods([]);

  const neighborhoodsInDrawArea = useMemo(
    () => (drawCenter ? neighborhoodsWithinRadius(neighborhoods, drawCenter.lat, drawCenter.lng, drawRadiusMiles) : []),
    [neighborhoods, drawCenter, drawRadiusMiles]
  );

  const handleApplyDrawArea = () => {
    if (neighborhoodsInDrawArea.length === 0) return;
    setSelectedNeighborhoods(prev => {
      const ids = new Set(prev);
      neighborhoodsInDrawArea.forEach(n => ids.add(n.id));
      return Array.from(ids);
    });
  };

  const handleClearDrawArea = () => {
    setDrawCenter(null);
  };

  const persistAudiences = (audiences: NeighborhoodAudience[]) => {
    setSavedAudiences(audiences);
    saveState(`savedAudiences_${business.id}`, audiences);
  };

  const handleSaveAudience = () => {
    const name = audienceNameDraft.trim();
    if (!name || selectedNeighborhoods.length === 0) return;
    const audience: NeighborhoodAudience = {
      id: `aud-${Date.now()}`,
      name,
      neighborhoodIds: selectedNeighborhoods,
    };
    persistAudiences([...savedAudiences, audience]);
    setAudienceNameDraft('');
    setIsSavingAudience(false);
  };

  const handleLoadAudience = (audience: NeighborhoodAudience) => {
    setSelectedNeighborhoods(prev => Array.from(new Set([...prev, ...audience.neighborhoodIds])));
  };

  const handleDeleteAudience = (id: string) => {
    persistAudiences(savedAudiences.filter(a => a.id !== id));
  };

  const normalizeNeighborhoodName = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const handleBulkUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || '';
      const lines = text.split(/\r?\n|,/).map(l => l.trim()).filter(Boolean);

      const byName = new Map<string, Neighborhood[]>();
      neighborhoods.forEach(n => {
        const key = normalizeNeighborhoodName(n.name);
        const list = byName.get(key) || [];
        list.push(n);
        byName.set(key, list);
      });

      const matchedIds = new Set<string>();
      const unmatched: string[] = [];

      lines.forEach(line => {
        const [namePart, cityPart] = line.split(/\s*[-—]\s*|\s*\|\s*/);
        const key = normalizeNeighborhoodName(namePart || line);
        const candidates = byName.get(key);
        if (!candidates || candidates.length === 0) {
          unmatched.push(line);
          return;
        }
        if (candidates.length === 1 || !cityPart) {
          matchedIds.add(candidates[0].id);
          return;
        }
        const cityMatch = candidates.find(c => normalizeNeighborhoodName(c.city) === normalizeNeighborhoodName(cityPart));
        matchedIds.add((cityMatch || candidates[0]).id);
      });

      setSelectedNeighborhoods(prev => Array.from(new Set([...prev, ...matchedIds])));
      setBulkUploadResult({ matched: matchedIds.size, unmatched });
    };
    reader.readAsText(file);
  };

  const handleNext = () => {
    if (step === 1) {
      const titleCheck = checkContent(title, { minLength: 5, maxLength: 100, fieldName: 'Deal title' });
      if (!titleCheck.allowed) {
        setContentError(titleCheck.reason || 'That title could not be submitted.');
        return;
      }
      const descCheck = checkContent(description, { minLength: 20, maxLength: 1000, fieldName: 'Description' });
      if (!descCheck.allowed) {
        setContentError(descCheck.reason || 'That description could not be submitted.');
        return;
      }
      setContentError(null);
    }
    if (step < 3) setStep(step + 1);
    else {
      onComplete({
        title,
        description,
        category,
        standardPrice: Number(standardPrice),
        discountPercentage: Number(discountPercentage),
        requiredSignups: Number(requiredSignups),
        businessId: business.id,
        currentSignups: initialService?.currentSignups ?? 0,
        signedUpUserIds: initialService?.signedUpUserIds ?? [],
        status: initialService?.status ?? 'active',
        isAIGenerated: initialService?.isAIGenerated ?? false,
        imageUrl,
        expiresAt: new Date(expiresAt).toISOString(),
        closeAfterThreshold,
      }, selectedNeighborhoods, {
        amount: totalCost,
        chargedNeighborhoodIds: isEditing ? newNeighborhoodIds : selectedNeighborhoods,
      });
    }
  };

  const neighborhoodPrices = useMemo(
    () => new Map(selectedNeighborhoodObjs.map(n => [n.id, estimateNeighborhoodPrice(n)])),
    [selectedNeighborhoodObjs]
  );
  const getNeighborhoodCost = (id: string) => neighborhoodPrices.get(id) ?? 5;
  const newNeighborhoodIds = selectedNeighborhoods.filter(id => !originalNeighborhoodIds.has(id));
  const totalCost = (isEditing ? newNeighborhoodIds : selectedNeighborhoods).reduce(
    (sum, id) => sum + getNeighborhoodCost(id),
    0
  );

  const currentBalance = business.balance ?? STARTING_BUSINESS_BALANCE;
  // A zero-cost edit (no new neighborhoods added) never needs blocking, even if
  // a legacy balance happens to be negative — there's nothing to charge for.
  const insufficientFunds = totalCost > 0 && totalCost > currentBalance;
  const shortfall = insufficientFunds ? totalCost - currentBalance : 0;
  // Balance After always equals Current Balance minus the cost shown on this
  // review step — the same totalCost used for the "Pay $X & Publish/Save"
  // button and the billing history entry that gets recorded on completion.
  const balanceAfter = currentBalance - totalCost;

  const centerLat = selectedNeighborhoodObjs[0]?.lat ?? filteredCandidates[0]?.lat ?? 35.7847;
  const centerLng = selectedNeighborhoodObjs[0]?.lng ?? filteredCandidates[0]?.lng ?? -78.6319;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden my-8">
      <div className="bg-primary-50 p-4 sm:p-8 text-center border-b border-primary-100">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{isEditing ? 'Edit Deal' : 'Create a New Deal'}</h1>
        <p className="text-gray-600">
          {isEditing ? 'Update your offer or expand the neighborhoods you target.' : 'Design your offer and select the neighborhoods you want to target.'}
        </p>
      </div>

      <div className="p-4 sm:p-8">
        <div className="flex justify-between mb-8 relative max-w-2xl mx-auto">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
          <div className="absolute top-1/2 left-0 h-0.5 bg-primary -z-10 -translate-y-1/2 transition-all" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
          {['Deal Details', 'Targeting', 'Review'].map((label, i) => {
            const s = i + 1;
            return (
              <div key={s} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 ${step >= s ? 'bg-primary text-white shadow-md' : 'bg-gray-200 text-gray-500'}`}>
                  {step > s ? <CheckCircle className="w-6 h-6" /> : s}
                </div>
                <span className={`text-xs font-medium ${step >= s ? 'text-primary-700' : 'text-gray-500'}`}>{label}</span>
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="space-y-6 flex-1 min-w-0 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 min-w-0">
                  <CategoryPicker value={category} onChange={setCategory} />
                </div>
                <Button
                  variant="outline"
                  onClick={handleGetRecommendations}
                  disabled={!category || isGettingRecs}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto shrink-0"
                >
                  {isGettingRecs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                  Get Ideas
                </Button>
              </div>
            </div>

            {recommendations.length > 0 && (
              <div className="bg-primary-50 p-4 rounded-xl border border-primary-100">
                <h3 className="text-sm font-bold text-primary-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> AI Recommendations
                </h3>
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-primary-100 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-gray-900 text-sm">{rec.title}</div>
                        <div className="text-xs text-gray-500">{rec.discountPercentage}% off • {rec.requiredSignups} signups</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => applyRecommendation(rec)}>Apply</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (contentError) setContentError(null); }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="e.g. Spring Yard Cleanup Special"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); if (contentError) setContentError(null); }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                placeholder="Describe what's included in this deal..."
                rows={4}
              />
            </div>

            {contentError && (
              <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {contentError}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Standard Price ($)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-5 w-5 text-gray-500" />
                  </div>
                  <input 
                    type="number" 
                    value={standardPrice}
                    onChange={(e) => setStandardPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Tag className="h-5 w-5 text-gray-500" />
                  </div>
                  <input 
                    type="number" 
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value ? Number(e.target.value) : '')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Required Signups</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-5 w-5 text-gray-500" />
                  </div>
                  <input 
                    type="number" 
                    value={requiredSignups}
                    onChange={(e) => setRequiredSignups(e.target.value ? Number(e.target.value) : '')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    placeholder="5"
                  />
                </div>
              </div>
            </div>

            {(standardPrice !== '' || discountPercentage !== '') && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <Tag className="w-5 h-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-800">
                  Neighbors will pay <span className="font-black text-lg">${discountedPrice.toFixed(2)}</span>
                  {standardPrice !== '' && <span className="text-gray-500 line-through ml-2">${Number(standardPrice).toFixed(2)}</span>}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">After the deal unlocks</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCloseAfterThreshold(false)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${!closeAfterThreshold ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
                >
                  <div className="font-bold text-gray-900 text-sm mb-1">Keep it open</div>
                  <div className="text-xs text-gray-500">Neighbors can keep joining after you hit your goal.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setCloseAfterThreshold(true)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${closeAfterThreshold ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
                >
                  <div className="font-bold text-gray-900 text-sm mb-1">Close signups automatically</div>
                  <div className="text-xs text-gray-500">Stop accepting new neighbors once you hit {requiredSignups || 'your goal'}.</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Image (Optional)</label>
              <p className="text-xs text-gray-500 mb-2">Minimum {MIN_IMAGE_WIDTH}&times;{MIN_IMAGE_HEIGHT}px. Uploads below this size will be rejected.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ImageIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    type="url"
                    value={imageUrl.startsWith('data:') ? '' : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onBlur={handleImageBlur}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none ${imageError ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="https://example.com/image.jpg"
                  />
                  {isVerifyingImage && <div className="absolute right-3 top-3"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>}
                </div>
                <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer text-sm font-medium shrink-0 transition-colors ${imageError ? 'border-red-300 text-red-600' : 'border-gray-300 text-gray-600 hover:border-primary hover:text-primary'}`}>
                  {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload Image
                  <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                </label>
              </div>
              {imageError && <p className="text-red-500 text-xs mt-2">{imageError}</p>}
              {imageUrl && !imageError && (
                <img src={imageUrl} alt="Deal preview" className="mt-3 h-32 w-full max-w-sm object-cover rounded-xl border border-gray-200" />
              )}
            </div>

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Live Preview</p>
            <ServiceCard
              service={previewService}
              business={business}
              onSignUp={() => {}}
              isSignedUp={false}
            />
          </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3 space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Target Neighborhoods</h2>
              <p className="text-sm text-gray-600 mb-4">Select the neighborhoods where you want to offer this deal. Cost per neighborhood scales with its estimated home count.</p>

              <div className="flex gap-2">
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option>All Cities</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={neighborhoodSearch}
                    onChange={(e) => setNeighborhoodSearch(e.target.value)}
                    placeholder="Search neighborhoods..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>

              {cityFilter !== 'All Cities' && (
                <button
                  type="button"
                  onClick={handleSelectAllInCity}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Select all {cityScopedNeighborhoods.length} in {cityFilter}
                </button>
              )}

              {cityFilter !== 'All Cities' && cityStats[cityFilter] && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    {cityFilter} — real Wake County property records
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="font-bold text-gray-900">{cityStats[cityFilter].homeCount.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">single-family homes</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">${Math.round(cityStats[cityFilter].avgAssessedValue / 1000)}k</p>
                      <p className="text-xs text-gray-500">avg. assessed value</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{cityStats[cityFilter].avgSqFt.toLocaleString()} sq ft</p>
                      <p className="text-xs text-gray-500">avg. home size</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{cityStats[cityFilter].avgYearBuilt}</p>
                      <p className="text-xs text-gray-500">avg. year built</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">Source: Wake County GIS parcel data</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsDrawMode(prev => !prev);
                  if (isDrawMode) setDrawCenter(null);
                }}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${isDrawMode ? 'bg-primary-50 border-primary text-primary-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                <Pencil className="w-4 h-4" />
                {isDrawMode ? 'Drawing on map — click to place area' : 'Draw a service area on the map'}
              </button>

              <label className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                <FileUp className="w-4 h-4" />
                Upload neighborhood name list
                <input type="file" accept=".txt,.csv" onChange={handleBulkUploadFile} className="hidden" />
              </label>
              {bulkUploadResult && (
                <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                  <p className="text-gray-700">
                    Matched <strong>{bulkUploadResult.matched}</strong> neighborhood{bulkUploadResult.matched === 1 ? '' : 's'}
                    {bulkUploadResult.unmatched.length > 0 && `, ${bulkUploadResult.unmatched.length} not found`}.
                  </p>
                  {bulkUploadResult.unmatched.length > 0 && (
                    <p className="text-gray-500">Not found: {bulkUploadResult.unmatched.slice(0, 8).join(', ')}{bulkUploadResult.unmatched.length > 8 ? '…' : ''}</p>
                  )}
                </div>
              )}

              {savedAudiences.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                    <Bookmark className="w-3.5 h-3.5" /> Saved Audiences
                  </p>
                  {savedAudiences.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                      <button type="button" onClick={() => handleLoadAudience(a)} className="text-left text-gray-700 hover:text-primary flex-1">
                        {a.name} <span className="text-gray-500">({a.neighborhoodIds.length})</span>
                      </button>
                      <button type="button" onClick={() => handleDeleteAudience(a.id)} className="text-gray-500 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isSavingAudience ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={audienceNameDraft}
                    onChange={(e) => setAudienceNameDraft(e.target.value)}
                    placeholder="Audience name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveAudience} disabled={!audienceNameDraft.trim()}>Save</Button>
                  <button type="button" onClick={() => { setIsSavingAudience(false); setAudienceNameDraft(''); }} className="text-gray-500 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                selectedNeighborhoods.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsSavingAudience(true)}
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Save current selection as audience
                  </button>
                )
              )}

              {isDrawMode && (
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-100 space-y-3">
                  {!drawCenter ? (
                    <p className="text-sm text-primary-800">Click anywhere on the map to drop a service-area center point.</p>
                  ) : (
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <label className="font-medium text-gray-700">Radius</label>
                          <span className="text-gray-600">{drawRadiusMiles} mi</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={15}
                          step={1}
                          value={drawRadiusMiles}
                          onChange={(e) => setDrawRadiusMiles(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                      <p className="text-sm text-gray-700">
                        <strong>{neighborhoodsInDrawArea.length}</strong> neighborhood{neighborhoodsInDrawArea.length === 1 ? '' : 's'} within this area.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleApplyDrawArea} disabled={neighborhoodsInDrawArea.length === 0}>
                          Add to Selection
                        </Button>
                        <button
                          type="button"
                          onClick={handleClearDrawArea}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" /> Clear point
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2">
                {visibleNeighborhoods.length > 0 ? (
                  visibleNeighborhoods.map(n => (
                    <div
                      key={n.id}
                      onClick={() => toggleNeighborhood(n.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedNeighborhoods.includes(n.id) ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
                    >
                      <div>
                        <div className="font-bold text-gray-900">{n.name}</div>
                        {n.homeStats ? (
                          <div className="text-xs text-gray-500">
                            {n.city} &middot; {n.homeStats.homeCount.toLocaleString()} homes &middot; avg ${Math.round(n.homeStats.avgAssessedValue / 1000)}k
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">{n.city} &middot; ~{n.estimatedHomes ?? estimateHomeCount(n.id)} homes (est.)</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold text-gray-700">${estimateNeighborhoodPrice(n)}</span>
                        {selectedNeighborhoods.includes(n.id) && <CheckCircle className="w-5 h-5 text-primary" />}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 text-center py-6">No neighborhoods match your search.</div>
                )}
              </div>
              {hiddenSelectedCount > 0 && (
                <p className="text-xs text-gray-500">
                  +{hiddenSelectedCount} more selected neighborhood{hiddenSelectedCount === 1 ? '' : 's'} not shown — refine your search to view them.
                </p>
              )}

              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Selected:</span>
                  <span className="font-bold text-gray-900">{selectedNeighborhoods.length}</span>
                </div>
                <div className="flex justify-between items-center text-lg mb-2">
                  <span className="font-bold text-gray-900">Total Cost:</span>
                  <span className="font-black text-primary">${totalCost}</span>
                </div>
                {selectedNeighborhoods.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-xs text-gray-500 hover:text-red-500 hover:underline"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>

            <div className="w-full md:w-2/3 h-[500px] rounded-2xl overflow-hidden border border-gray-200 z-0 relative">
              <MapContainer center={[centerLat, centerLng]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                <MapUpdater lat={centerLat} lng={centerLng} />
                <DrawAreaClickHandler active={isDrawMode} onPick={(lat, lng) => setDrawCenter({ lat, lng })} />
                {visibleNeighborhoods.map(n => {
                  if (!n.lat || !n.lng) return null;
                  const isSelected = selectedNeighborhoods.includes(n.id);
                  return (
                    <React.Fragment key={n.id}>
                      <Marker position={[n.lat, n.lng]} opacity={isSelected ? 1 : 0.5} />
                      {isSelected && (
                        <Circle
                          center={[n.lat, n.lng]}
                          radius={1500}
                          pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.2 }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
                {drawCenter && (
                  <>
                    <Marker position={[drawCenter.lat, drawCenter.lng]} />
                    <Circle
                      center={[drawCenter.lat, drawCenter.lng]}
                      radius={drawRadiusMiles * 1609.34}
                      pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.1, dashArray: '6 6' }}
                    />
                  </>
                )}
              </MapContainer>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Review Your Deal</h2>
            
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                  <p className="text-sm text-primary-600 font-medium">{category}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-green-600">{discountPercentage}% OFF</div>
                  <div className="text-sm text-gray-500 line-through">${standardPrice} standard</div>
                </div>
              </div>
              {imageUrl && (
                <img src={imageUrl} alt={title} className="w-full h-48 object-cover rounded-xl mb-4" />
              )}
              <p className="text-gray-700 mb-4">{description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100 mb-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Requires <strong>{requiredSignups}</strong> neighbors to unlock this deal.</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                <CheckCircle className="w-5 h-5 text-primary" />
                <span>{closeAfterThreshold ? 'Signups close automatically once the goal is met.' : 'Neighbors can keep joining after the goal is met.'}</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8">
              <h4 className="font-bold text-gray-900 mb-4 border-b pb-2">{isEditing ? 'Targeting' : 'Targeting & Cost'}</h4>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
                {selectedNeighborhoodObjs.slice(0, 50).map(n => {
                  const isNew = isEditing && !originalNeighborhoodIds.has(n.id);
                  return (
                    <div key={n.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3"/> {n.name}, {n.city}
                        {isNew && <span className="text-primary-600 font-semibold">(new)</span>}
                      </span>
                      {!isEditing && <span className="text-gray-900 font-medium">${getNeighborhoodCost(n.id)}.00</span>}
                      {isEditing && isNew && <span className="text-gray-900 font-medium">${getNeighborhoodCost(n.id)}.00</span>}
                    </div>
                  );
                })}
                {selectedNeighborhoodObjs.length > 50 && (
                  <p className="text-xs text-gray-500 pt-2">
                    + {selectedNeighborhoodObjs.length - 50} more neighborhood{selectedNeighborhoodObjs.length - 50 === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              {(!isEditing || newNeighborhoodIds.length > 0) && (
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 text-lg">
                  <span className="font-bold text-gray-900">{isEditing ? 'Additional Cost for New Neighborhoods' : 'Total Due Today'}</span>
                  <span className="font-black text-primary">${totalCost}.00</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-600">Current Balance</span>
                <span data-testid="review-balance" className={`font-bold ${currentBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>${currentBalance.toFixed(2)}</span>
              </div>
              {totalCost > 0 && (
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">{isEditing ? 'Additional Cost' : 'Deal Cost'}</span>
                  <span data-testid="review-cost" className="font-bold text-gray-900">-${totalCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-900">Balance After</span>
                <span data-testid="review-balance-after" className={`font-bold ${balanceAfter < 0 ? 'text-red-600' : 'text-gray-900'}`}>${balanceAfter.toFixed(2)}</span>
              </div>
              {insufficientFunds && (
                <p className="flex items-start gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Your balance is too low to {isEditing ? 'save these changes' : 'publish this deal'} — you need{' '}
                    <strong>${shortfall.toFixed(2)}</strong> more to cover this cost.
                  </span>
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Add Funds</p>
                <AddFundsControl onAddFunds={onAddFunds} />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100 max-w-2xl mx-auto">
          <Button variant="outline" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={
              (step === 1 && (!title || !category || !standardPrice || !discountPercentage || !requiredSignups || !!imageError)) ||
              (step === 2 && selectedNeighborhoods.length === 0) ||
              (step === 3 && insufficientFunds)
            }
          >
            {step === 3
              ? (isEditing ? (totalCost > 0 ? `Pay $${totalCost} & Save Changes` : 'Save Changes') : `Pay $${totalCost} & Publish Deal`)
              : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BusinessCreateDeal;
