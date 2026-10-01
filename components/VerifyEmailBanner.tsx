import React, { useState } from 'react';
import { Mail, X as CloseIcon } from 'lucide-react';

interface VerifyEmailBannerProps {
  email?: string;
}

// Non-blocking, like the phoneVerified flag — the account already works
// fully without this; it's just a nudge. Dismissing only lasts the session
// (resets on reload), which is fine for something this low-stakes.
const VerifyEmailBanner: React.FC<VerifyEmailBannerProps> = ({ email }) => {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (dismissed) return null;

  const handleResend = async () => {
    setStatus('sending');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'resendVerification' }),
      });
      if (!res.ok) throw new Error('resend failed');
      setStatus('sent');
    } catch (err) {
      console.error('Resend verification failed', err);
      setStatus('error');
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-[97%] mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-center sm:justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-amber-800">
          <Mail className="w-4 h-4 shrink-0" />
          <span>
            Verify your email{email ? ` (${email})` : ''} to make sure you don't miss updates on your deals.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {status === 'sent' ? (
            <span className="font-semibold text-amber-800">Sent — check your inbox.</span>
          ) : status === 'error' ? (
            <span className="font-semibold text-red-700">Couldn't send — try again.</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={status === 'sending'}
              className="font-bold text-amber-900 hover:underline disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending…' : 'Resend email'}
            </button>
          )}
          <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-amber-700 hover:text-amber-900">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailBanner;
