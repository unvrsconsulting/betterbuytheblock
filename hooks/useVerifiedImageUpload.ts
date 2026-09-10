import { useState, ChangeEvent } from 'react';
import { verifyDealImage } from '../services/scraperService';

const MIN_WIDTH = 400;
const MIN_HEIGHT = 200;

// Shared upload-and-moderate flow for any business-supplied image (banner,
// offering photos) — same real-photo-verification pipeline BusinessCreateDeal
// already uses for deal images (see runImageVerification there), factored out
// so a new image surface can't accidentally skip either the dimension check
// or the Gemini content check the way deal images originally did for uploads.
export function useVerifiedImageUpload(initialUrl = '') {
  const [imageUrl, setImageUrl] = useState(initialUrl);
  const [imageError, setImageError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const runVerification = async (urlOrDataUrl: string) => {
    setIsVerifying(true);
    setImageError('');
    const result = await verifyDealImage(urlOrDataUrl);
    if (!result.isAppropriate) {
      setImageError(result.reason || 'That image could not be used.');
    }
    setIsVerifying(false);
  };

  const handleUrlBlur = async () => {
    if (!imageUrl || imageUrl.startsWith('data:')) {
      if (!imageUrl) setImageError('');
      return;
    }
    await runVerification(imageUrl);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.');
      return;
    }

    setIsUploading(true);
    setImageError('');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = async () => {
        if (img.naturalWidth < MIN_WIDTH || img.naturalHeight < MIN_HEIGHT) {
          setImageError(`Image is ${img.naturalWidth}×${img.naturalHeight}px - minimum required is ${MIN_WIDTH}×${MIN_HEIGHT}px.`);
          setIsUploading(false);
          return;
        }
        setImageUrl(dataUrl);
        setIsUploading(false);
        await runVerification(dataUrl);
      };
      img.onerror = () => {
        setImageError('Could not read that image file.');
        setIsUploading(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setImageError('Could not read that image file.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const reset = (url = '') => {
    setImageUrl(url);
    setImageError('');
    setIsVerifying(false);
    setIsUploading(false);
  };

  return { imageUrl, setImageUrl, imageError, isVerifying, isUploading, handleUrlBlur, handleFileChange, reset };
}
