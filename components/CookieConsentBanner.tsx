import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import Button from './Button';
import { loadGoogleTagManager } from '../services/gtm';

const STORAGE_KEY = 'analyticsConsent'; // 'accepted' | 'declined'

interface CookieConsentBannerProps {
  onViewPrivacyPolicy: () => void;
}

// Your profile/preferences live in localStorage regardless (required for the
// site to function, not a choice). Analytics (Google Tag Manager) only loads
// after you accept here — declining keeps it off for this browser.
const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onViewPrivacyPolicy }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (consent === 'accepted') {
        loadGoogleTagManager();
      } else if (consent !== 'declined') {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable — leave analytics off rather than guess
    }
  }, []);

  const respond = (accepted: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, accepted ? 'accepted' : 'declined');
    } catch {
      // ignore
    }
    if (accepted) loadGoogleTagManager();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-gray-900 text-gray-200 px-4 py-4 sm:px-6 shadow-[0_-4px_16px_rgba(0,0,0,0.2)]">
      <div className="max-w-[95%] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm flex items-start sm:items-center gap-2">
          <Cookie className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-gray-400" />
          <span>
            We use analytics to improve your experience.{' '}
            <button onClick={onViewPrivacyPolicy} className="underline hover:text-white transition-colors">
              Privacy Policy
            </button>
          </span>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => respond(false)}
            className="py-2 px-4 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Decline
          </button>
          <Button onClick={() => respond(true)} className="py-2 px-5 text-sm">
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
