import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Search, Download, LogOut, RefreshCw, Mail, Phone, Users as UsersIcon, Briefcase, BarChart3, ListChecks, Trash2, X as CloseIcon } from 'lucide-react';
import { Business, User } from '../types';
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

type Tab = 'leads' | 'users' | 'businesses' | 'analytics';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'leads', label: 'Leads', icon: <ListChecks className="w-4 h-4" /> },
  { id: 'users', label: 'Users', icon: <UsersIcon className="w-4 h-4" /> },
  { id: 'businesses', label: 'Businesses', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
];

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
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [tab, setTab] = useState<Tab>('leads');

  // A trivial admin-only GET proves the token is real before landing on the
  // dashboard, without duplicating the leads tab's own fetch just to check.
  const verifyToken = async (token: string) => {
    setIsCheckingAuth(true);
    setAuthError('');
    try {
      const res = await fetch(`/api/admin?resource=businesses&token=${encodeURIComponent(token)}`);
      if (res.status === 401) {
        setAuthError('Incorrect token.');
        setAuthedToken(null);
        try { sessionStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
        return;
      }
      if (!res.ok) throw new Error('Request failed');
      setAuthedToken(token);
      try { sessionStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
    } catch (err) {
      console.error('Admin token check failed', err);
      setAuthError("Couldn't reach the server — try again.");
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleSubmitToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    verifyToken(tokenInput.trim());
  };

  const handleLogOut = () => {
    setAuthedToken(null);
    setTokenInput('');
    setTab('leads');
    try { sessionStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
  };

  if (!authedToken) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <form onSubmit={handleSubmitToken} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Admin</h1>
          <p className="text-sm text-gray-500 mb-5">Enter the admin token to manage the site.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none mb-3"
            placeholder="Admin token"
            autoFocus
          />
          {authError && <p className="text-sm text-red-600 mb-3">{authError}</p>}
          <Button type="submit" fullWidth disabled={isCheckingAuth}>
            {isCheckingAuth ? 'Checking...' : 'Enter'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">Admin</h1>
        <Button variant="outline" size="sm" onClick={handleLogOut} className="flex items-center gap-1.5 w-fit">
          <LogOut className="w-3.5 h-3.5" /> Log out
        </Button>
      </div>

      <div className="flex gap-2 border-b border-gray-200 mb-8 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'leads' && <LeadsTab token={authedToken} businesses={businesses} onAuthFailed={handleLogOut} />}
      {tab === 'users' && <UsersTab token={authedToken} onAuthFailed={handleLogOut} />}
      {tab === 'businesses' && <BusinessesTab token={authedToken} onAuthFailed={handleLogOut} />}
      {tab === 'analytics' && <AnalyticsTab token={authedToken} businesses={businesses} onAuthFailed={handleLogOut} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Leads (unchanged from the original single-page dashboard)
// ---------------------------------------------------------------------------

const LeadsTab: React.FC<{ token: string; businesses: Business[]; onAuthFailed: () => void }> = ({ token, businesses, onAuthFailed }) => {
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

  const fetchLeads = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [signupsRes, requestsRes] = await Promise.all([
        fetch(`/api/deal-signup?token=${encodeURIComponent(token)}`),
        fetch(`/api/deal-request?token=${encodeURIComponent(token)}`),
      ]);
      if (signupsRes.status === 401 || requestsRes.status === 401) {
        onAuthFailed();
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
    } catch (err) {
      console.error('Admin leads fetch failed', err);
      setLoadError("Couldn't load data — try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <p className="text-gray-500 text-sm">
          Every real deal join and request across every business.
          {fetchedAt && <> Updated {fetchedAt.toLocaleTimeString()}.</>}
        </p>
        <Button variant="outline" size="sm" onClick={fetchLeads} disabled={isLoading} className="flex items-center gap-1.5 w-fit">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Leads" value={leads.length} />
        <StatCard label="Businesses With Leads" value={uniqueBusinesses} />
        <StatCard label="Distinct Deals" value={uniqueDeals} />
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

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const StatCard: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
    <div className="text-sm text-gray-500 mb-1">{label}</div>
    <div className="text-3xl font-bold text-gray-900">{value}</div>
  </div>
);

const FieldInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <label className="block">
    <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
    />
  </label>
);

const EditOverlay: React.FC<{ title: string; onClose: () => void; onDelete: () => void; onSave: () => void; isSaving: boolean; children: React.ReactNode }> = ({
  title, onClose, onDelete, onSave, isSaving, children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 max-h-[90vh] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 py-4 space-y-3 overflow-y-auto">{children}</div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
        <button onClick={onDelete} className="flex items-center gap-1.5 text-sm font-bold text-red-600 hover:text-red-700">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
        <Button onClick={onSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save changes'}</Button>
      </div>
    </div>
  </div>
);

// A destructive admin action gets a real confirm, not a silent click — this
// stays a plain window.confirm (not a styled modal) since it's the one place
// in this dashboard where "are you sure" needs to interrupt, not blend in.
function confirmDelete(label: string): boolean {
  return window.confirm(`Delete ${label}? This can't be undone.`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const UsersTab: React.FC<{ token: string; onAuthFailed: () => void }> = ({ token, onAuthFailed }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<Partial<User>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/admin?resource=users&token=${encodeURIComponent(token)}`);
      if (res.status === 401) return onAuthFailed();
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Admin users fetch failed', err);
      setLoadError("Couldn't load users — try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const openEdit = (user: User) => {
    setEditingUser(user);
    setDraft({ name: user.name, email: user.email, phone: user.phone, address: user.address });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateUser', token, id: editingUser.id, updates: draft }),
      });
      if (res.status === 401) return onAuthFailed();
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setUsers(prev => prev.map(u => u.id === editingUser.id ? data.user : u));
      setEditingUser(null);
    } catch (err) {
      console.error('Admin user save failed', err);
      alert("Couldn't save — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingUser) return;
    if (!confirmDelete(editingUser.name || 'this user')) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteUser', token, id: editingUser.id }),
      });
      if (res.status === 401) return onAuthFailed();
      if (!res.ok) throw new Error('Delete failed');
      setUsers(prev => prev.filter(u => u.id !== editingUser.id));
      setEditingUser(null);
    } catch (err) {
      console.error('Admin user delete failed', err);
      alert("Couldn't delete — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCsv = () => {
    const rows = filtered.map(u => [u.name || '', u.email || '', u.type, u.phone || '', u.neighborhoodId || '', u.address || '']);
    downloadCsv(`users-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['Name', 'Email', 'Type', 'Phone', 'Neighborhood ID', 'Address'], rows));
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <p className="text-gray-500 text-sm">Every real (server-backed) resident and business account.</p>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={isLoading} className="flex items-center gap-1.5 w-fit">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Total Accounts" value={users.length} />
        <StatCard label="Residents / Business" value={`${users.filter(u => u.type !== 'BUSINESS' as any).length} / ${users.filter(u => u.type === 'BUSINESS' as any).length}`} />
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
            placeholder="Search by name, email, or phone..."
          />
        </div>
        <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0} className="flex items-center gap-1.5 shrink-0">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading && users.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-sm">No users match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Address</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{u.name || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {u.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-500 shrink-0" /> {u.email}</div>}
                      {u.phone && <div className="flex items-center gap-1.5 mt-0.5"><Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" /> {u.phone}</div>}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${u.type === 'BUSINESS' as any ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                        {u.type === 'BUSINESS' as any ? 'Business' : 'Resident'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{u.address || '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => openEdit(u)} className="text-primary font-bold hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingUser && (
        <EditOverlay title={`Edit ${editingUser.name || 'user'}`} onClose={() => setEditingUser(null)} onDelete={handleDelete} onSave={handleSave} isSaving={isSaving}>
          <FieldInput label="Name" value={draft.name || ''} onChange={v => setDraft(d => ({ ...d, name: v }))} />
          <FieldInput label="Email" value={draft.email || ''} onChange={v => setDraft(d => ({ ...d, email: v }))} type="email" />
          <FieldInput label="Phone" value={draft.phone || ''} onChange={v => setDraft(d => ({ ...d, phone: v }))} />
          <FieldInput label="Address" value={draft.address || ''} onChange={v => setDraft(d => ({ ...d, address: v }))} />
        </EditOverlay>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------

const BusinessesTab: React.FC<{ token: string; onAuthFailed: () => void }> = ({ token, onAuthFailed }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [draft, setDraft] = useState<Partial<Business>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchBusinesses = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/admin?resource=businesses&token=${encodeURIComponent(token)}`);
      if (res.status === 401) return onAuthFailed();
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch (err) {
      console.error('Admin businesses fetch failed', err);
      setLoadError("Couldn't load businesses — try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(b =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.category || '').toLowerCase().includes(q) ||
      (b.city || '').toLowerCase().includes(q)
    );
  }, [businesses, search]);

  const openEdit = (business: Business) => {
    setEditingBusiness(business);
    setDraft({ name: business.name, category: business.category, city: business.city, state: business.state, zip: business.zip, email: business.email, description: business.description });
  };

  const handleSave = async () => {
    if (!editingBusiness) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateBusiness', token, id: editingBusiness.id, updates: draft }),
      });
      if (res.status === 401) return onAuthFailed();
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setBusinesses(prev => prev.map(b => b.id === editingBusiness.id ? data.business : b));
      setEditingBusiness(null);
    } catch (err) {
      console.error('Admin business save failed', err);
      alert("Couldn't save — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingBusiness) return;
    if (!confirmDelete(editingBusiness.name || 'this business')) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteBusiness', token, id: editingBusiness.id }),
      });
      if (res.status === 401) return onAuthFailed();
      if (!res.ok) throw new Error('Delete failed');
      setBusinesses(prev => prev.filter(b => b.id !== editingBusiness.id));
      setEditingBusiness(null);
    } catch (err) {
      console.error('Admin business delete failed', err);
      alert("Couldn't delete — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCsv = () => {
    const rows = filtered.map(b => [b.name || '', b.category || '', b.city || '', b.state || '', b.email || '', String(b.rating ?? ''), String(b.reviewCount ?? '')]);
    downloadCsv(`businesses-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['Name', 'Category', 'City', 'State', 'Email', 'Rating', 'Reviews'], rows));
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <p className="text-gray-500 text-sm">Every real (server-backed) business — registered listings, not the static seed directory.</p>
        <Button variant="outline" size="sm" onClick={fetchBusinesses} disabled={isLoading} className="flex items-center gap-1.5 w-fit">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Total Businesses" value={businesses.length} />
        <StatCard label="Distinct Categories" value={new Set(businesses.map(b => b.category).filter(Boolean)).size} />
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
            placeholder="Search by name, category, or city..."
          />
        </div>
        <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0} className="flex items-center gap-1.5 shrink-0">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading && businesses.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-gray-500 text-sm">No businesses match.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">City</th>
                  <th className="px-6 py-3 font-medium">Rating</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{b.name}</td>
                    <td className="px-6 py-3 text-gray-600">{b.category || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">{b.city || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">{b.rating ? `${b.rating} (${b.reviewCount || 0})` : '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => openEdit(b)} className="text-primary font-bold hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingBusiness && (
        <EditOverlay title={`Edit ${editingBusiness.name}`} onClose={() => setEditingBusiness(null)} onDelete={handleDelete} onSave={handleSave} isSaving={isSaving}>
          <FieldInput label="Name" value={draft.name || ''} onChange={v => setDraft(d => ({ ...d, name: v }))} />
          <FieldInput label="Category" value={draft.category || ''} onChange={v => setDraft(d => ({ ...d, category: v }))} />
          <FieldInput label="City" value={draft.city || ''} onChange={v => setDraft(d => ({ ...d, city: v }))} />
          <FieldInput label="State" value={draft.state || ''} onChange={v => setDraft(d => ({ ...d, state: v }))} />
          <FieldInput label="Email" value={draft.email || ''} onChange={v => setDraft(d => ({ ...d, email: v }))} type="email" />
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Description</span>
            <textarea
              value={draft.description || ''}
              onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
          </label>
        </EditOverlay>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

interface AnalyticsData {
  businessViews: Record<string, number>;
  searchTerms: Record<string, number>;
  searchCities: Record<string, number>;
}

const RankedTable: React.FC<{ title: string; rows: [string, number][]; labelHeader: string; onExport: () => void }> = ({ title, rows, labelHeader, onExport }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
      <h3 className="font-bold text-gray-900">{title}</h3>
      <Button variant="outline" size="sm" onClick={onExport} disabled={rows.length === 0} className="flex items-center gap-1.5">
        <Download className="w-3.5 h-3.5" /> CSV
      </Button>
    </div>
    {rows.length === 0 ? (
      <div className="p-10 text-center text-gray-400 text-sm">No data yet.</div>
    ) : (
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100 sticky top-0 bg-white">
              <th className="px-6 py-3 font-medium">{labelHeader}</th>
              <th className="px-6 py-3 font-medium text-right">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(([label, count]) => (
              <tr key={label} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-800">{label}</td>
                <td className="px-6 py-3 text-right font-bold text-gray-900">{count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const AnalyticsTab: React.FC<{ token: string; businesses: Business[]; onAuthFailed: () => void }> = ({ token, businesses, onAuthFailed }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const businessNameById = useMemo(() => {
    const map = new Map<string, string>();
    businesses.forEach(b => map.set(b.id, b.name));
    return map;
  }, [businesses]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/analytics?token=${encodeURIComponent(token)}`);
      if (res.status === 401) return onAuthFailed();
      if (!res.ok) throw new Error('Request failed');
      setData(await res.json());
    } catch (err) {
      console.error('Admin analytics fetch failed', err);
      setLoadError("Couldn't load analytics — try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedEntries = (obj: Record<string, number> | undefined): [string, number][] =>
    Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);

  const businessViewRows = useMemo(
    () => sortedEntries(data?.businessViews).map(([id, count]) => [businessNameById.get(id) || id, count] as [string, number]),
    [data, businessNameById]
  );
  const searchTermRows = useMemo(() => sortedEntries(data?.searchTerms), [data]);
  const searchCityRows = useMemo(() => sortedEntries(data?.searchCities), [data]);

  const totalViews = businessViewRows.reduce((sum, [, c]) => sum + c, 0);
  const totalSearches = searchTermRows.reduce((sum, [, c]) => sum + c, 0) + searchCityRows.reduce((sum, [, c]) => sum + c, 0);

  const exportRows = (rows: [string, number][], labelHeader: string, filename: string) => {
    downloadCsv(filename, toCsv([labelHeader, 'Count'], rows.map(([label, count]) => [label, String(count)])));
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <p className="text-gray-500 text-sm">Page visits per business and search activity by city and search term. Counts only visitors who accepted analytics.</p>
        <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={isLoading} className="flex items-center gap-1.5 w-fit">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Total Business Page Views" value={totalViews} />
        <StatCard label="Total Searches Logged" value={totalSearches} />
      </div>

      {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}

      {isLoading && !data ? (
        <div className="p-16 text-center text-gray-500 text-sm bg-white rounded-2xl border border-gray-200">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RankedTable
            title="Page Visits by Business"
            rows={businessViewRows}
            labelHeader="Business"
            onExport={() => exportRows(businessViewRows, 'Business', `business-page-views-${new Date().toISOString().slice(0, 10)}.csv`)}
          />
          <RankedTable
            title="Searches by Term"
            rows={searchTermRows}
            labelHeader="Search Term"
            onExport={() => exportRows(searchTermRows, 'Search Term', `search-terms-${new Date().toISOString().slice(0, 10)}.csv`)}
          />
          <RankedTable
            title="Searches by City"
            rows={searchCityRows}
            labelHeader="City"
            onExport={() => exportRows(searchCityRows, 'City', `search-cities-${new Date().toISOString().slice(0, 10)}.csv`)}
          />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
