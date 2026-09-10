import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Search, Download, LogOut, RefreshCw, Mail, Phone } from 'lucide-react';
import { Business } from '../types';
import Button from './Button';
import { toCsv, downloadCsv } from '../services/csv';

const TOKEN_STORAGE_KEY = 'nn_admin_token';

interface AdminLead {
  date: string;
  businessId: string | null;
  dealTitle: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: 'joined' | 'requested';
}

interface AdminDashboardProps {
  businesses: Business[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ businesses }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [authedToken, setAuthedToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'joined' | 'requested'>('all');
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const businessNameById = useMemo(() => {
    const map = new Map<string, string>();
    businesses.forEach(b => map.set(b.id, b.name));
    return map;
  }, [businesses]);

  const fetchLeads = async (token: string) => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [signupsRes, requestsRes] = await Promise.all([
        fetch(`/api/deal-signup?token=${encodeURIComponent(token)}`),
        fetch(`/api/deal-request?token=${encodeURIComponent(token)}`),
      ]);

      if (signupsRes.status === 401 || requestsRes.status === 401) {
        setAuthError('Incorrect token.');
        setAuthedToken(null);
        try { sessionStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
        return;
      }
      if (!signupsRes.ok || !requestsRes.ok) throw new Error('Request failed');

      const signupsData = await signupsRes.json();
      const requestsData = await requestsRes.json();

      const fromSignups: AdminLead[] = (signupsData.items || []).map((item: any) => ({
        date: item.capturedAt,
        businessId: item.businessId || null,
        dealTitle: item.serviceName || 'Deal',
        name: item.userName || 'Neighbor',
        email: item.userEmail || null,
        phone: item.userPhone || null,
        city: item.city || null,
        source: 'joined' as const,
      }));
      const fromRequests: AdminLead[] = (requestsData.items || []).map((item: any) => ({
        date: item.capturedAt,
        businessId: item.businessId || null,
        dealTitle: item.serviceName || 'Deal',
        name: item.userName || 'Neighbor',
        email: null,
        phone: null,
        city: item.city || null,
        source: 'requested' as const,
      }));

      setLeads([...fromSignups, ...fromRequests].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setFetchedAt(new Date());
      setAuthError('');
      setAuthedToken(token);
      try { sessionStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
    } catch (err) {
      console.error('Admin leads fetch failed', err);
      setLoadError("Couldn't load data — try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch once on mount if a token is already saved from a prior visit
  // this session.
  useEffect(() => {
    if (authedToken) fetchLeads(authedToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmitToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    fetchLeads(tokenInput.trim());
  };

  const handleLogOut = () => {
    setAuthedToken(null);
    setLeads([]);
    setTokenInput('');
    try { sessionStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
  };

  const businessLabel = (lead: AdminLead) => (lead.businessId && businessNameById.get(lead.businessId)) || lead.businessId || 'Unknown business';

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(lead => {
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        lead.dealTitle.toLowerCase().includes(q) ||
        businessLabel(lead).toLowerCase().includes(q)
      );
    });
  }, [leads, search, sourceFilter, businessNameById]);

  const uniqueBusinesses = useMemo(() => new Set(leads.map(l => l.businessId).filter(Boolean)).size, [leads]);
  const uniqueDeals = useMemo(() => new Set(leads.map(l => l.dealTitle)).size, [leads]);

  const handleExportCsv = () => {
    const rows = filteredLeads.map(lead => [
      new Date(lead.date).toISOString().slice(0, 10),
      businessLabel(lead),
      lead.dealTitle,
      lead.name,
      lead.email || '',
      lead.phone || '',
      lead.city || '',
      lead.source === 'joined' ? 'Joined deal' : 'Requested deal',
    ]);
    const csv = toCsv(['Date', 'Business', 'Deal', 'Name', 'Email', 'Phone', 'City', 'Type'], rows);
    downloadCsv(`all-leads-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  if (!authedToken) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <form onSubmit={handleSubmitToken} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Admin</h1>
          <p className="text-sm text-gray-500 mb-5">Enter the admin token to view leads across every business.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-3"
            placeholder="Admin token"
            autoFocus
          />
          {(authError || loadError) && <p className="text-sm text-red-600 mb-3">{authError || loadError}</p>}
          <Button type="submit" fullWidth disabled={isLoading}>
            {isLoading ? 'Checking...' : 'Enter'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Admin — All Leads</h1>
          <p className="text-gray-500 text-sm">
            Every real deal join and request across every business.
            {fetchedAt && <> Updated {fetchedAt.toLocaleTimeString()}.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchLeads(authedToken)} disabled={isLoading} className="flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogOut} className="flex items-center gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Log out
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Total Leads</div>
          <div className="text-3xl font-bold text-gray-900">{leads.length}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Businesses With Leads</div>
          <div className="text-3xl font-bold text-gray-900">{uniqueBusinesses}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Distinct Deals</div>
          <div className="text-3xl font-bold text-gray-900">{uniqueDeals}</div>
        </div>
      </div>

      {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="Search by name, email, business, or deal..."
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as any)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        >
          <option value="all">All types</option>
          <option value="joined">Joined deal</option>
          <option value="requested">Requested deal</option>
        </select>
        <Button variant="outline" onClick={handleExportCsv} disabled={filteredLeads.length === 0} className="flex items-center gap-1.5 shrink-0">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading && leads.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-sm">Loading...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-sm">No leads match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Business</th>
                  <th className="px-6 py-3 font-medium">Deal</th>
                  <th className="px-6 py-3 font-medium">City</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLeads.map((lead, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {lead.name}
                      <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${lead.source === 'joined' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {lead.source === 'joined' ? 'Joined' : 'Requested'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {lead.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" /> {lead.email}</div>}
                      {lead.phone && <div className="flex items-center gap-1.5 mt-0.5"><Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" /> {lead.phone}</div>}
                      {!lead.email && !lead.phone && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{businessLabel(lead)}</td>
                    <td className="px-6 py-3 text-gray-600">{lead.dealTitle}</td>
                    <td className="px-6 py-3 text-gray-600">{lead.city || '—'}</td>
                    <td className="px-6 py-3 text-gray-500">{new Date(lead.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
