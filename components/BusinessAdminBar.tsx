import React, { useEffect, useState } from 'react';
import { Eye, Users as UsersIcon, MessageSquare, Pencil, ShieldCheck } from 'lucide-react';
import { Business } from '../types';

const TOKEN_STORAGE_KEY = 'nn_admin_token';

interface BusinessAdminBarProps {
  business: Business;
  onGoToAdmin: () => void;
}

// WordPress-style admin bar: the visitor sees exactly the same public page
// (real header, real layout, real data) - this just overlays a thin strip
// with this business's live stats when an admin is the one looking at it.
// Only renders for an admin actually viewing the site (a cached token that
// the server confirms is still valid) - a real visitor's sessionStorage has
// no such key, so this returns null before ever making a request for them.
const BusinessAdminBar: React.FC<BusinessAdminBarProps> = ({ business, onGoToAdmin }) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pageViews, setPageViews] = useState<number | null>(null);
  const [joined, setJoined] = useState<number | null>(null);
  const [requested, setRequested] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = (() => {
      try { return sessionStorage.getItem(TOKEN_STORAGE_KEY); } catch { return null; }
    })();
    if (!token) {
      setIsAdmin(false);
      return;
    }

    (async () => {
      try {
        const [analyticsRes, signupsRes, requestsRes] = await Promise.all([
          fetch(`/api/analytics?token=${encodeURIComponent(token)}`),
          fetch(`/api/deal-signup?token=${encodeURIComponent(token)}`),
          fetch(`/api/deal-request?token=${encodeURIComponent(token)}`),
        ]);
        if (analyticsRes.status === 401 || signupsRes.status === 401 || requestsRes.status === 401) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const [analyticsData, signupsData, requestsData] = await Promise.all([
          analyticsRes.json(),
          signupsRes.json(),
          requestsRes.json(),
        ]);
        if (cancelled) return;
        setIsAdmin(true);
        setPageViews(analyticsData.businessViews?.[business.id] ?? 0);
        setJoined((signupsData.items || []).filter((i: any) => i.businessId === business.id).length);
        setRequested((requestsData.items || []).filter((i: any) => i.businessId === business.id).length);
      } catch (err) {
        console.error('Admin bar fetch failed', err);
        if (!cancelled) setIsAdmin(false);
      }
    })();

    return () => { cancelled = true; };
  }, [business.id]);

  if (!isAdmin) return null;

  return (
    <div className="sticky top-0 z-50 bg-gray-900 text-white text-sm">
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 h-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-bold shrink-0">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Admin view
        </div>
        <div className="flex items-center gap-5 overflow-x-auto">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Eye className="w-3.5 h-3.5 text-gray-400" /> {pageViews ?? '…'} views
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <UsersIcon className="w-3.5 h-3.5 text-gray-400" /> {joined ?? '…'} joined
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <MessageSquare className="w-3.5 h-3.5 text-gray-400" /> {requested ?? '…'} requested
          </span>
        </div>
        <button
          onClick={onGoToAdmin}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 px-3 py-1.5 rounded-lg font-bold shrink-0 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit in Admin
        </button>
      </div>
    </div>
  );
};

export default BusinessAdminBar;
