import React, { useState } from 'react';
import { User, Business, Service, DealRequest } from '../types';
import { Plus, TrendingUp, Users, Eye, Heart, Clock, Mail, MessageSquare, Check, X, Pencil, Settings, CheckCircle, MapPin, ChevronDown, ChevronUp, Wallet, Receipt, DollarSign, Download } from 'lucide-react';
import Button from './Button';
import ServiceCard from './ServiceCard';
import { DEFAULT_CATEGORY_IMAGE } from '../services/categoryImages';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { STARTING_BUSINESS_BALANCE } from '../constants';
import AddFundsControl from './AddFundsControl';
import { toCsv, downloadCsv } from '../services/csv';
import { BillingTransaction } from '../types';

interface BusinessHubProps {
  currentUser: User | null;
  business: Business | null;
  services: Service[];
  users: User[];
  dealRequests: DealRequest[];
  onUpdateDealRequestStatus: (requestId: string, status: 'accepted' | 'declined') => void;
  onCreateDeal: () => void;
  onEditDeal: (serviceId: string) => void;
  onServiceClick: (serviceId: string) => void;
  onUpdateUser: (user: User) => void;
  onEditProfile: () => void;
  onCompleteDeal: (serviceId: string) => void;
  onAddFunds: (amount: number) => void;
}

const BusinessHub: React.FC<BusinessHubProps> = ({ currentUser, business, services, users, dealRequests, onUpdateDealRequestStatus, onCreateDeal, onEditDeal, onServiceClick, onUpdateUser, onEditProfile, onCompleteDeal, onAddFunds }) => {
  const { neighborhoods } = useNeighborhoods();
  const [expandedBreakdownIds, setExpandedBreakdownIds] = useState<Set<string>>(new Set());
  // 'YYYY-MM-DD' strings from the date inputs below, or '' when unset.
  const [billingFromDate, setBillingFromDate] = useState('');
  const [billingToDate, setBillingToDate] = useState('');

  if (!business) return null;

  const now = new Date();

  const myDeals = services.filter(s => s.businessId === business.id);
  const activeDeals = myDeals.filter(s => s.status !== 'completed' && (!s.expiresAt || new Date(s.expiresAt) > now));
  const expiredDeals = myDeals.filter(s => s.status !== 'completed' && s.expiresAt && new Date(s.expiresAt) <= now);

  const wishlistCountFor = (serviceId: string) => users.filter(u => (u.wishlist || []).includes(serviceId)).length;

  // Sum of only this deal's own billing transactions (its initial publish cost plus
  // any later neighborhood-expansion charges). A deal seeded before billing history
  // existed simply has no matching transactions and correctly totals to $0, rather
  // than falling back to a guessed figure.
  const spentFor = (serviceId: string) =>
    (business.billingHistory || [])
      .filter(txn => txn.dealId === serviceId)
      .reduce((sum, txn) => sum + txn.amount, 0);

  const toggleBreakdown = (serviceId: string) => {
    setExpandedBreakdownIds(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  // Cross-references each signed-up resident's neighborhoodId against the deal's
  // targeted neighborhoodIds, so a business can see where its signups actually came
  // from. Every neighborhood the deal targets is listed even at zero signups.
  const getNeighborhoodBreakdown = (service: Service) => {
    const signedUpUserIds = service.signedUpUserIds || [];
    return service.neighborhoodIds.map(neighborhoodId => {
      const neighborhood = neighborhoods.find(n => n.id === neighborhoodId);
      const count = signedUpUserIds.filter(userId => {
        const user = users.find(u => u.id === userId);
        return user?.neighborhoodId === neighborhoodId;
      }).length;
      return { id: neighborhoodId, name: neighborhood?.name || neighborhoodId, count };
    });
  };

  const totalViews = myDeals.reduce((sum, s) => sum + (s.views || 0), 0);
  const totalInterested = myDeals.reduce((sum, s) => sum + (s.signedUpUserIds?.length || 0), 0);
  const totalWishlists = myDeals.reduce((sum, s) => sum + wishlistCountFor(s.id), 0);
  const pendingRequests = dealRequests.filter(r => r.status === 'pending');

  const balance = business.balance ?? STARTING_BUSINESS_BALANCE;
  const billingHistory = [...(business.billingHistory || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const isBillingFilterActive = billingFromDate !== '' || billingToDate !== '';
  // Inclusive range: 'From' at start of day, 'To' at end of day, so a filter of
  // the same day on both ends still catches every transaction that day.
  const fromBound = billingFromDate ? new Date(`${billingFromDate}T00:00:00`) : null;
  const toBound = billingToDate ? new Date(`${billingToDate}T23:59:59.999`) : null;
  const filteredBillingHistory = billingHistory.filter(txn => {
    const txnDate = new Date(txn.date);
    if (fromBound && txnDate < fromBound) return false;
    if (toBound && txnDate > toBound) return false;
    return true;
  });

  // Same label shown in the table row's title, reused for the CSV export so the
  // two stay in lockstep.
  const getTransactionDescription = (txn: BillingTransaction): string =>
    txn.type === 'add_funds' ? 'Funds Added' : (txn.dealTitle || 'Deal');

  const handleClearBillingFilter = () => {
    setBillingFromDate('');
    setBillingToDate('');
  };

  const handleExportCsv = () => {
    const rows = filteredBillingHistory.map(txn => {
      const signedAmount = txn.type === 'add_funds' ? txn.amount : -txn.amount;
      return [
        new Date(txn.date).toISOString().slice(0, 10),
        getTransactionDescription(txn),
        signedAmount.toFixed(2),
      ];
    });
    const csv = toCsv(['Date', 'Description', 'Amount'], rows);
    const todayStamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`billing-history-${business.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${todayStamp}.csv`, csv);
  };

  return (
    <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <img
            src={business.logoUrl}
            alt={business.name}
            className="w-16 h-16 rounded-xl shadow-sm"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
          />
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">{business.name} Dashboard</h1>
            <p className="text-gray-500">Manage your deals and track performance.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onEditProfile} className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Edit Business Profile
          </Button>
          <Button onClick={onCreateDeal} className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create New Deal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Total Views</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalViews}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-medium">New Requests</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{pendingRequests.length}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Interested Neighbors</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalInterested}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Heart className="w-4 h-4" />
            <span className="text-sm font-medium">Wishlists</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{totalWishlists}</div>
        </div>
      </div>

      {/* Billing */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Account Balance</p>
              <p className={`text-2xl font-black ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>${balance.toFixed(2)}</p>
            </div>
          </div>
          <AddFundsControl onAddFunds={onAddFunds} />
        </div>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 shrink-0">
              <Receipt className="w-3.5 h-3.5" /> Billing History
            </h3>
            {billingHistory.length > 0 && (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col text-xs font-medium text-gray-500">
                  From
                  <input
                    type="date"
                    value={billingFromDate}
                    onChange={e => setBillingFromDate(e.target.value)}
                    max={billingToDate || undefined}
                    className="mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900"
                    aria-label="Filter from date"
                  />
                </label>
                <label className="flex flex-col text-xs font-medium text-gray-500">
                  To
                  <input
                    type="date"
                    value={billingToDate}
                    onChange={e => setBillingToDate(e.target.value)}
                    min={billingFromDate || undefined}
                    className="mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900"
                    aria-label="Filter to date"
                  />
                </label>
                {isBillingFilterActive && (
                  <button
                    onClick={handleClearBillingFilter}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 pb-1.5"
                  >
                    Clear
                  </button>
                )}
                <Button
                  variant="outline"
                  onClick={handleExportCsv}
                  disabled={filteredBillingHistory.length === 0}
                  className="flex items-center gap-2 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </div>
            )}
          </div>
          {billingHistory.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No billing activity yet.</p>
          ) : filteredBillingHistory.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No transactions in this range.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredBillingHistory.map(txn => {
                const neighborhoodCount = txn.neighborhoodIds?.length ?? 0;
                return (
                  <div key={txn.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {getTransactionDescription(txn)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(txn.date).toLocaleDateString()} &middot;{' '}
                        {txn.type === 'publish' && 'Deal published'}
                        {txn.type === 'add_neighborhoods' && 'Neighborhoods added'}
                        {txn.type === 'add_funds' && 'Manual balance top-up'}
                        {txn.type !== 'add_funds' && (
                          <> &middot; {neighborhoodCount} neighborhood{neighborhoodCount === 1 ? '' : 's'} targeted</>
                        )}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${txn.type === 'add_funds' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'add_funds' ? '+' : '-'}${txn.amount.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Deal Requests */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Deal Requests</h2>
      {dealRequests.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
          <div className="divide-y divide-gray-100">
            {[...dealRequests].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(request => (
              <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <img
                      src={request.userAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.userName)}&background=random`}
                      alt={request.userName}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <h3 className="font-bold text-gray-900">{request.userName}</h3>
                      <p className="text-sm font-medium text-primary-600">{request.serviceName}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-3">{request.description}</p>
                      <p className="text-xs text-gray-400 mt-2">{new Date(request.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {request.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onUpdateDealRequestStatus(request.id, 'accepted')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                        >
                          <Check className="w-4 h-4" /> Accept
                        </button>
                        <button
                          onClick={() => onUpdateDealRequestStatus(request.id, 'declined')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                        >
                          <X className="w-4 h-4" /> Decline
                        </button>
                      </div>
                    ) : (
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${request.status === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {request.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200 border-dashed mb-12">
          <p className="text-gray-500">No deal requests yet.</p>
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Active Deals</h2>
      {activeDeals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-12">
          {activeDeals.map((service) => (
            <div key={service.id} className="flex flex-col gap-4">
              <ServiceCard
                service={service}
                business={business}
                onSignUp={() => {}}
                isSignedUp={false}
                onBusinessClick={() => {}}
                onServiceClick={() => onServiceClick(service.id)}
                isWishlisted={false}
                onToggleWishlist={() => {}}
                currentUser={currentUser}
                users={users}
                onUpdateUser={onUpdateUser}
              />
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex justify-between items-center text-sm">
                <div className="flex items-center gap-1 text-gray-600" title="Views">
                  <Eye className="w-4 h-4" /> {service.views || 0}
                </div>
                <div className="flex items-center gap-1 text-gray-600" title="Wishlists">
                  <Heart className="w-4 h-4" /> {wishlistCountFor(service.id)}
                </div>
                <div className="flex items-center gap-1 text-primary-600 font-medium bg-primary-50 px-2 py-1 rounded-md">
                  <Users className="w-4 h-4" /> {service.signedUpUserIds?.length || 0} / {service.requiredSignups}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-2 flex items-center justify-center gap-1.5 text-sm text-gray-600" title="Total simulated spend on this deal">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900">Spent: ${spentFor(service.id)}</span>
              </div>
              {service.neighborhoodIds.length >= 2 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleBreakdown(service.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Signups by Neighborhood
                    </span>
                    {expandedBreakdownIds.has(service.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {expandedBreakdownIds.has(service.id) && (
                    <div className="px-4 pb-3 pt-1 border-t border-gray-100 space-y-1.5">
                      {getNeighborhoodBreakdown(service).map(row => (
                        <div key={row.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate pr-2">{row.name}</span>
                          <span className="font-semibold text-gray-900 bg-gray-100 rounded-full px-2 py-0.5 shrink-0">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => onEditDeal(service.id)}
                className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Deal
              </button>
              {(service.currentSignups || 0) >= service.requiredSignups && (
                <button
                  onClick={() => {
                    if (window.confirm(`Mark "${service.title}" as completed? This will notify everyone who signed up and move it to Completed Deals on your public profile.`)) {
                      onCompleteDeal(service.id);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl py-2 hover:bg-green-100 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Mark as Completed
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-3xl border border-gray-200 border-dashed mb-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No active deals</h3>
          <p className="text-gray-500 mb-6">Create your first deal to start reaching local customers.</p>
          <Button onClick={onCreateDeal}>Create New Deal</Button>
        </div>
      )}

      {expiredDeals.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Expired Deals & Leads</h2>
          <div className="space-y-6">
            {expiredDeals.map(service => (
              <div key={service.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{service.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Expired {new Date(service.expiresAt!).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {service.signedUpUserIds?.length || 0} Interested</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> Spent: ${spentFor(service.id)}</span>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => onServiceClick(service.id)}>View Deal Details</Button>
                </div>

                {service.neighborhoodIds.length >= 2 && (
                  <div className="border-b border-gray-100">
                    <button
                      onClick={() => toggleBreakdown(service.id)}
                      className="w-full flex items-center justify-between px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> Signups by Neighborhood
                      </span>
                      {expandedBreakdownIds.has(service.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {expandedBreakdownIds.has(service.id) && (
                      <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {getNeighborhoodBreakdown(service).map(row => (
                          <div key={row.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                            <span className="text-gray-600 truncate pr-2">{row.name}</span>
                            <span className="font-semibold text-gray-900 bg-white border border-gray-200 rounded-full px-2 py-0.5 shrink-0">{row.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="p-6">
                  <h4 className="font-bold text-gray-900 mb-4">Interested Neighbors</h4>
                  {service.signedUpUserIds && service.signedUpUserIds.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {service.signedUpUserIds.map(userId => {
                        const user = users.find(u => u.id === userId);
                        if (!user) return null;
                        return (
                          <div key={userId} className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl bg-white">
                            <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{user.name}</p>
                              {user.email && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                  <Mail className="w-3 h-3" />
                                  {user.email}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">No neighbors signed up for this deal.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BusinessHub;
