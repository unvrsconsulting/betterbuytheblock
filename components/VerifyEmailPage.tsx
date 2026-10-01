import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { User } from '../types';
import Button from './Button';

interface VerifyEmailPageProps {
  // The signed-in user, if any, whose local cache gets its emailVerified
  // flag flipped on success - this page works whether or not the browser
  // visiting the link is the one the account was created on.
  currentUser: User | null;
  onVerified: (user: User) => void;
  onContinue: () => void;
}

type Status = 'verifying' | 'success' | 'error';

const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ currentUser, onVerified, onContinue }) => {
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('This link is missing its verification token.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ action: 'verifyEmail', token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus('error');
          setErrorMessage(data.error || 'This link is invalid or has expired.');
          return;
        }
        setStatus('success');
        // Only update the local cache if this is the same account that's
        // signed in on this browser - verifying someone else's link (a
        // different device) shouldn't touch this browser's own user state.
        if (currentUser && data.user && data.user.id === currentUser.id) {
          onVerified(data.user);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Email verification failed', err);
        setStatus('error');
        setErrorMessage("Couldn't reach the server - please try again.");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold text-gray-900 mb-1">Verifying your email&hellip;</h1>
            <p className="text-sm text-gray-500">This'll just take a second.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-1">Email verified</h1>
            <p className="text-sm text-gray-500 mb-5">Your email is confirmed. You're all set.</p>
            <Button onClick={onContinue} fullWidth>Continue to BetterBuyTheBlock</Button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-1">Couldn't verify that link</h1>
            <p className="text-sm text-gray-500 mb-5">{errorMessage}</p>
            <Button onClick={onContinue} fullWidth variant="outline">Back to Home</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
