import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import Button from './Button';

const STORAGE_KEY = 'storageNoticeAcknowledged';

interface CookieConsentBannerProps {
  onViewPrivacyPolicy: () => void;
}

// This site doesn't set cookies or run trackers — everything client-side
// lives in localStorage (see services/localStore.ts). Framed honestly as a
// storage notice rather than claiming cookie usage that doesn't exist.
const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onViewPrivacyPolicy }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable — nothing to acknowledge either way
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-gray-900 text-gray-200 px-4 py-4 sm:px-6 shadow-[0_-4px_16px_rgba(0,0,0,0.2)]">
      <div className="max-w-[95%] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm flex items-start sm:items-center gap-2">
          <Cookie className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-gray-400" />
          <span>
            We don't use cookies or trackers. Your profile and preferences are saved only in this browser's local storage.{' '}
            <button onClick={onViewPrivacyPolicy} className="underline hover:text-white transition-colors">
              Privacy Policy
            </button>
          </span>
        </p>
        <Button onClick={dismiss} className="shrink-0 py-2 px-5 text-sm">
          Got it
        </Button>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
