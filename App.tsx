
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Mail, MapPin, Heart, Grid as GridIcon, Star, Search, Users, BadgePercent,
  Brush, Sparkles, DoorOpen, Zap, Fence, Droplets, Wrench, Shield, Home, Fan,
  Sofa, Trees, Leaf, Truck, Paintbrush, Bug, Droplet, Waves, Wind, Warehouse,
  Sun, TreePine, AppWindow, LucideIcon, SlidersHorizontal
} from 'lucide-react';
import { User, Service, Business, UserType, DealRequest, Review, Notification, NotificationType, BillingTransaction } from './types';
import { DEFAULT_CATEGORY_IMAGE } from './services/categoryImages';
import { USERS, REVIEWS, CATEGORY_GROUPS, STARTING_BUSINESS_BALANCE, EXAMPLE_DEALS, getExampleDealImage } from './constants';
import { loadSeedData } from './services/seedData';
import Header from './components/Header';
import ServiceCard from './components/ServiceCard';
import AIDealFinder from './components/AIDealFinder';
import BusinessProfile from './components/BusinessProfile';
import BusinessDirectory from './components/BusinessDirectory';
import ServiceProfile from './components/ServiceProfile';
import RequestServiceModal from './components/RequestServiceModal';
import LocationPromptModal from './components/LocationPromptModal';
import Button from './components/Button';
import { TagIcon } from './components/Icon';
import AuthModal from './components/AuthModal';
import { loadState, saveState, resetIfStaleSeed } from './services/localStore';

// Runs once when the module loads, before any component state initializes,
// so a stale cached catalog from a previous seed version never shadows fresh
// demo data (see SEED_VERSION comment in services/localStore.ts).
resetIfStaleSeed();
import { useNeighborhoods } from './hooks/useNeighborhoods';
import { findNearestNeighborhood } from './services/neighborhoods';
import { isRateLimited } from './services/contentModeration';
import NeighborhoodPage from './components/NeighborhoodPage';

import ConnectionsFeed from './components/ConnectionsFeed';
import StaticPage from './components/StaticPage';
import Footer from './components/Footer';
import CookieConsentBanner from './components/CookieConsentBanner';
import Breadcrumbs, { BreadcrumbItem } from './components/Breadcrumbs';

// Code-split views that only ever load for a business owner or a settings/
// connections visit — a resident just browsing deals never needs this code,
// so it shouldn't be in their initial bundle.
const ConnectionsPanel = React.lazy(() => import('./components/ConnectionsPanel'));
const ArticlesPage = React.lazy(() => import('./components/ArticlesPage'));
const UserProfile = React.lazy(() => import('./components/UserProfile'));
const BusinessOnboarding = React.lazy(() => import('./components/BusinessOnboarding'));
const BusinessHub = React.lazy(() => import('./components/BusinessHub'));
const BusinessCreateDeal = React.lazy(() => import('./components/BusinessCreateDeal'));
const BusinessEditProfile = React.lazy(() => import('./components/BusinessEditProfile'));
const SettingsPage = React.lazy(() => import('./components/SettingsPage'));

const ALL_CATEGORIES = [
  'Carpet Cleaning',
  'Cleaning & Maid Services',
  'Deck or Porch',
  'Electrical',
  'Fencing Service',
  'Gutter Cleaning',
  'Handyman Service',
  'Home Security',
  'House Cleaning',
  'HVAC Maintenance',
  'Interior Design',
  'Landscaping',
  'Lawn Service',
  'Moving Services',
  'Painting',
  'Pest Control',
  'Plumbing',
  'Pool Maintenance',
  'Power Washing',
  'Roofing',
  'Solar Panel Installation',
  'Tree Service',
  'Window Washing'
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Carpet Cleaning': Brush,
  'Cleaning & Maid Services': Sparkles,
  'Deck or Porch': DoorOpen,
  'Electrical': Zap,
  'Fencing Service': Fence,
  'Gutter Cleaning': Droplets,
  'Handyman Service': Wrench,
  'Home Security': Shield,
  'House Cleaning': Home,
  'HVAC Maintenance': Fan,
  'Interior Design': Sofa,
  'Landscaping': Trees,
  'Lawn Service': Leaf,
  'Moving Services': Truck,
  'Painting': Paintbrush,
  'Pest Control': Bug,
  'Plumbing': Droplet,
  'Pool Maintenance': Waves,
  'Power Washing': Wind,
  'Roofing': Warehouse,
  'Solar Panel Installation': Sun,
  'Tree Service': TreePine,
  'Window Washing': AppWindow,
};

// Raleigh, NC seasonal service demand — hot/humid summers, mild winters, heavy spring
// pollen, and a fall hurricane-remnant/storm season shape which categories spike when.
const SEASONS = [
  {
    label: 'Winter',
    months: [11, 0, 1],
    headline: 'Get Ready for a Raleigh Winter',
    blurb: 'Occasional freezes and ice storms put a strain on heating systems and pipes — these are the services Wake County neighbors need most right now.',
    categories: ['HVAC Maintenance', 'Plumbing', 'Gutter Cleaning', 'Home Security'],
  },
  {
    label: 'Spring',
    months: [2, 3, 4],
    headline: "Beat Raleigh's Pollen Season",
    blurb: 'Heavy spring pollen and blooming yards mean it\'s prime time for power washing, lawn care, and fresh landscaping.',
    categories: ['Power Washing', 'Landscaping', 'Lawn Service', 'Window Washing', 'Painting'],
  },
  {
    label: 'Summer',
    months: [5, 6, 7],
    headline: 'Beat the Raleigh Heat',
    blurb: "Triple-digit heat index days keep AC units running nonstop and bring out mosquitoes — here's what neighbors are booking right now.",
    categories: ['HVAC Maintenance', 'Pool Maintenance', 'Pest Control', 'Lawn Service', 'Power Washing'],
  },
  {
    label: 'Fall',
    months: [8, 9, 10],
    headline: 'Storm Season & Fall Prep in Raleigh',
    blurb: 'Falling leaves and the tail end of hurricane season make this the season for gutter cleaning, roof checks, and tree care.',
    categories: ['Gutter Cleaning', 'Tree Service', 'Roofing', 'Fencing Service', 'HVAC Maintenance'],
  },
];

const COST_GUIDES = [
  {
    title: 'How Much Does a New Furnace Cost? [2026 Data]',
    description: 'When it’s time to replace the furnace, review this guide for new furnace costs based on type, size, and efficiency, plus furnace installation costs.',
    author: 'LAUREN BONGARD',
    date: 'NOV 17, 2025',
    image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=500&auto=format&fit=crop',
    type: 'Cost Guide',
    body: [
      "Furnace pricing varies widely based on a handful of factors: fuel type (gas, electric, or oil), the unit's efficiency rating (AFUE), the square footage it needs to heat, and your home's existing ductwork. A straight swap into an existing setup is almost always cheaper than a job that requires new ducting, electrical work, or venting changes.",
      "High-efficiency units cost more upfront but use less fuel over the life of the system — in colder climates that difference adds up faster than in milder ones, so it's worth asking an installer to estimate the payback period for your specific home rather than assuming a higher efficiency rating is always worth the premium.",
      "Because pricing depends so much on your specific home, get at least two or three written quotes before committing. This is exactly the kind of project where a neighborhood bulk deal helps — when several neighbors need similar work at the same time, contractors can often offer a better rate than they would for a single one-off job.",
    ],
  },
  {
    title: 'How Much Does Pest Control Cost? [2026 Data]',
    description: 'Wake County\'s humid climate keeps ants, roaches, and termites active nearly year-round. Here\'s what pest control typically costs and what drives the price.',
    author: 'ANGI',
    date: 'MAR 5, 2026',
    image: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?q=80&w=500&auto=format&fit=crop',
    type: 'Cost Guide',
    body: [
      "Pest control pricing depends mainly on the type of pest, the size of your home, and whether you need a one-time treatment or an ongoing quarterly plan — termite and wildlife issues typically cost more to address than routine ant or roach treatments.",
      "In Wake County's warm, humid climate, pests stay active almost year-round rather than dying off in winter, which is why many neighbors opt for a standing quarterly plan instead of paying for one-off visits every time something turns up.",
      "Because nearby homes often share the same pest pressure — a termite colony or ant trail rarely respects property lines — this is a great fit for group pricing — a technician already treating one house can frequently service several homes on the same street for less than the cost of separate visits.",
    ],
  },
  {
    title: 'How Much Does Insulation Installation Cost? [2026 Data]',
    description: 'New insulation can make your home more comfortable and boost energy efficiency. Use this insulation cost guide to get an accurate estimate for the installation.',
    author: 'RACHEL HOFFMAN',
    date: 'DEC 16, 2025',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=500&auto=format&fit=crop',
    type: 'Cost Guide',
    body: [
      "Insulation cost is driven mostly by material type (fiberglass batts, blown-in cellulose, or spray foam), the area being insulated (attic, walls, or crawl space), and how easy that area is to access. Spray foam typically costs more per square foot than batts or blown-in insulation but seals gaps that the others can't.",
      "Attics are usually the most cost-effective place to start, since heat loss through an under-insulated attic tends to have an outsized effect on comfort and energy bills compared to other parts of the house.",
      "Ask any contractor you're considering for the R-value they're proposing and why — the right R-value depends on your climate zone, and a reputable installer should be able to explain the recommendation rather than just quoting a flat price.",
    ],
  },
  {
    title: 'Top 10 Home Maintenance Tasks for Spring',
    description: 'Get your home ready for the warmer months with this comprehensive spring maintenance checklist.',
    author: 'HOME EXPERTS',
    date: 'FEB 20, 2026',
    image: 'https://images.unsplash.com/photo-1584820927498-cafe2c1c8680?q=80&w=500&auto=format&fit=crop',
    type: 'Checklist',
    body: [
      "Spring is the natural checkpoint after a winter of freeze-thaw cycles, so it's worth walking the outside of your home for cracked caulking, loose gutters, and any shingles that shifted during storms.",
      "A short seasonal checklist: clean gutters and downspouts, inspect the roof for damage, check exterior faucets for leaks after the last freeze, service your HVAC system before the cooling season starts, and look over your deck or fence for wood that needs resealing.",
      "Many of these are quick jobs for a professional but tedious to schedule one at a time — if a few neighbors need the same gutter cleaning or HVAC tune-up, bundling those requests into a single neighborhood deal usually gets everyone a better rate than booking separately.",
    ],
  },
  {
    title: 'Wake County Real Estate Market Update',
    description: 'See the latest trends in home values and what it means for your home improvement ROI.',
    author: 'WAKE COUNTY NEWS',
    date: 'MAR 1, 2026',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=500&auto=format&fit=crop',
    type: 'News',
    body: [
      "Home improvement return-on-investment varies a lot by project type and local market conditions, so it's worth treating any specific ROI percentage you read online as a rough starting point rather than a guarantee for your particular home.",
      "In general, projects that address deferred maintenance (roofing, HVAC, gutters) tend to protect value rather than add it, while curb-appeal projects (landscaping, exterior painting, driveway work) tend to have an outsized effect on a buyer's first impression relative to their cost.",
      "If you're planning improvements with resale in mind, a local real estate agent can usually give a more useful read on what buyers in your specific neighborhood are actually responding to than a generic national average.",
    ],
  }
];

const CollapsibleCategoryGroup: React.FC<{ group: any, filterCategories: string[], setFilterCategories: (cats: string[]) => void }> = ({ group, filterCategories, setFilterCategories }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = group.categories.some((cat: string) => filterCategories.includes(cat));

  return (
    <div className="space-y-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <h4 className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-gray-500'}`}>
          {group.name}
        </h4>
        <svg 
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="space-y-2 pl-2 overflow-hidden"
        >
          {group.categories.map((cat: string) => (
            <label key={cat} className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center">
                <input 
                  type="checkbox" 
                  checked={filterCategories.includes(cat)} 
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFilterCategories([...filterCategories, cat]);
                    } else {
                      setFilterCategories(filterCategories.filter(c => c !== cat));
                    }
                  }}
                  className="peer appearance-none w-4 h-4 border border-gray-300 rounded checked:bg-primary checked:border-primary transition-all"
                />
                <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <span className="text-gray-700 text-sm group-hover:text-gray-900 transition-colors">{cat}</span>
            </label>
          ))}
        </motion.div>
      )}
    </div>
  );
};

// Business accounts have no neighborhood/connections/wishlist — keep them confined
// to business-oriented views; these consumer-facing ones assume a resident account.
const CONSUMER_ONLY_VIEWS = new Set(['home', 'profile', 'wishlist', 'connections', 'my-deals']);

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>(() => loadState<User[]>('users', USERS));
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => loadState<string | null>('currentUserId', null));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [postLoginIntent, setPostLoginIntent] = useState<'business' | null>(null);
  // Seed catalog (523 businesses, 886 offerings) is fetched as static JSON
  // rather than bundled as a JS literal — see services/seedData.ts. A
  // returning visitor's own localStorage copy (their joined/wishlisted
  // state included) still loads instantly and synchronously; only a
  // genuinely fresh browser waits on the fetch below.
  const [services, setServices] = useState<Service[]>(() => loadState<Service[]>('services', []));
  const [businesses, setBusinesses] = useState<Business[]>(() => loadState<Business[]>('businesses', []));

  useEffect(() => {
    if (loadState<Service[]>('services', []).length > 0 || loadState<Business[]>('businesses', []).length > 0) return;
    loadSeedData().then(({ businesses: seedBusinesses, services: seedServices }) => {
      setBusinesses(seedBusinesses);
      setServices(seedServices);
      saveState('businesses', seedBusinesses);
      saveState('services', seedServices);
    });
  }, []);
  const { neighborhoods } = useNeighborhoods();

  const isAuthenticated = currentUserId !== null && users.some(u => u.id === currentUserId);
  const currentUser = users.find(u => u.id === currentUserId) || USERS[0];

  const updateCurrentUser = (updatedUser: User) => {
    setUsers(prev => {
      const exists = prev.some(u => u.id === updatedUser.id);
      const next = exists
        ? prev.map(u => (u.id === updatedUser.id ? updatedUser : u))
        : [...prev, updatedUser];
      saveState('users', next);
      return next;
    });
  };

  const selectedNeighborhoodId = currentUser.neighborhoodId ?? '';
  const [view, setView] = useState<'home' | 'results' | 'business' | 'businesses' | 'serviceProfile' | 'category' | 'blog' | 'profile' | 'wishlist' | 'articles' | 'how-it-works' | 'pro-signup' | 'pro-resources' | 'success-stories' | 'help' | 'contact' | 'terms' | 'privacy' | 'not-found' | 'settings' | 'connections' | 'my-deals' | 'business-onboarding' | 'business-hub' | 'business-create-deal' | 'business-edit-profile' | 'neighborhood'>(() => {
    const path = window.location.pathname;
    if (path === '/privacy') return 'privacy';
    if (path === '/terms') return 'terms';
    if (path !== '/') return 'not-found';
    return 'home';
  });
  const [searchResults, setSearchResults] = useState<Service[]>([]);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBlog, setSelectedBlog] = useState<typeof COST_GUIDES[0] | null>(null);
  const [selectedNeighborhoodPageId, setSelectedNeighborhoodPageId] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestModalBusinessId, setRequestModalBusinessId] = useState<string | undefined>(undefined);
  const [requestModalPrefill, setRequestModalPrefill] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('recommended');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [categorySortBy, setCategorySortBy] = useState<string>('recommended');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState<boolean>(false);
  const [categoryMinPrice, setCategoryMinPrice] = useState<string>('');
  const [categoryMaxPrice, setCategoryMaxPrice] = useState<string>('');
  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(() => loadState<Review[]>('reviews', REVIEWS));
  const [dealRequests, setDealRequests] = useState<DealRequest[]>(() => loadState<DealRequest[]>('dealRequests', []));
  const [notifications, setNotifications] = useState<Notification[]>(() => loadState<Notification[]>('notifications', []));

  const addNotification = (n: Omit<Notification, 'id' | 'date' | 'read'>) => {
    // A type missing from the recipient's preference map is on by default —
    // only an explicit `false` suppresses it.
    const recipient = users.find(u => u.id === n.userId);
    if (recipient?.notificationPreferences?.[n.type] === false) return;
    setNotifications(prev => {
      const next: Notification[] = [
        { ...n, id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, date: new Date().toISOString(), read: false },
        ...prev,
      ];
      saveState('notifications', next);
      return next;
    });
  };

  const handleUpdateNotificationPreference = (type: NotificationType, enabled: boolean) => {
    if (!currentUser) return;
    updateCurrentUser({
      ...currentUser,
      notificationPreferences: { ...currentUser.notificationPreferences, [type]: enabled },
    });
  };

  const handleClearLocalData = () => {
    if (!currentUserId) return;
    setUsers(prev => {
      const next = prev.filter(u => u.id !== currentUserId);
      saveState('users', next);
      return next;
    });
    setCurrentUserId(null);
    saveState('currentUserId', null);
    setView('home');
  };

  useEffect(() => {
    // Show location prompt on first visit. Key is versioned (not the older
    // "hasVisitedBefore") because that older flag got set for visitors who
    // hit a bug where the prompt silently never actually asked — bumping the
    // key lets everyone genuinely get asked once under the fixed logic.
    try {
      const hasVisited = localStorage.getItem('locationPromptShownV2');
      if (!hasVisited) {
        handleShareLocation();
        localStorage.setItem('locationPromptShownV2', 'true');
      }
    } catch (e) {
      console.warn('localStorage not available', e);
      // Fallback if localStorage is not available
      handleShareLocation();
    }
  }, []);

  useEffect(() => {
    // Deep-link into a shared deal, e.g. /?service=srv_123
    const params = new URLSearchParams(window.location.search);
    const sharedServiceId = params.get('service');
    if (sharedServiceId && services.some(s => s.id === sharedServiceId)) {
      setSelectedServiceId(sharedServiceId);
      setView('serviceProfile');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Notify the current user if any of their joined deals are expiring soon
    if (!currentUserId) return;
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    services.forEach(s => {
      if (!(s.signedUpUserIds || []).includes(currentUserId)) return;
      if (!s.expiresAt) return;
      if (s.currentSignups >= s.requiredSignups) return;
      const msLeft = new Date(s.expiresAt).getTime() - now;
      if (msLeft <= 0 || msLeft > fortyEightHours) return;
      const alreadyNotified = notifications.some(n => n.type === 'expiring_soon' && n.serviceId === s.id && n.userId === currentUserId);
      if (!alreadyNotified) {
        addNotification({
          userId: currentUserId,
          type: 'expiring_soon',
          message: `"${s.title}" expires soon and still needs ${s.requiredSignups - s.currentSignups} more neighbor${s.requiredSignups - s.currentSignups === 1 ? '' : 's'} to unlock.`,
          serviceId: s.id,
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const handleShareLocation = () => {
    // Business accounts have no neighborhood of their own.
    if (currentUser.type === UserType.BUSINESS) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nearest = findNearestNeighborhood(neighborhoods, position.coords.latitude, position.coords.longitude);
          if (nearest) {
            updateCurrentUser({ ...currentUser, neighborhoodId: nearest.id });
            // Not signed in yet (guest browsing pre-auth) — make this the
            // active profile so the located neighborhood actually sticks,
            // instead of updating an orphaned record nothing points to.
            if (!currentUserId) {
              setCurrentUserId(currentUser.id);
              saveState('currentUserId', currentUser.id);
            }
          }
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Real, bookmarkable URLs for the handful of views worth indexing (see
  // sitemap.xml) — everything else in this app is client-side view state
  // living at "/", same as before. A truly bad URL is left alone so a reload
  // keeps showing the 404 rather than silently bouncing to home.
  useEffect(() => {
    if (view === 'not-found') return;
    const path = view === 'privacy' ? '/privacy' : view === 'terms' ? '/terms' : '/';
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }, [view]);

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path === '/privacy') setView('privacy');
      else if (path === '/terms') setView('terms');
      else if (path === '/') setView('home');
      else setView('not-found');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // SEO: keep <title> and the meta description in sync with what's actually
  // on screen, instead of every view sharing index.html's static tags.
  useEffect(() => {
    const DEFAULT_TITLE = 'BetterByTheBlock | Wake County Home Services at Discounted Rates';
    const DEFAULT_DESCRIPTION = 'Get bulk-pricing deals on home services across Wake County, NC. Join with your neighbors to unlock group discounts on cleaning, lawn care, HVAC, and more — free for local businesses to list.';

    let title = DEFAULT_TITLE;
    let description = DEFAULT_DESCRIPTION;

    if (view === 'privacy') {
      title = `Privacy Policy | BetterByTheBlock`;
      description = 'How BetterByTheBlock collects, stores, and uses your information.';
    } else if (view === 'terms') {
      title = `Terms & Conditions | BetterByTheBlock`;
      description = 'The terms that apply to using BetterByTheBlock.';
    } else if (view === 'not-found') {
      title = `Page Not Found | BetterByTheBlock`;
      description = 'The page you were looking for doesn\'t exist.';
    } else if (view === 'results') {
      title = lastSearchQuery ? `${lastSearchQuery} deals in Wake County | BetterByTheBlock` : `Search Results | BetterByTheBlock`;
      description = `Bulk-pricing home service deals ${lastSearchQuery ? `for ${lastSearchQuery} ` : ''}in your Wake County neighborhood.`;
    } else if (view === 'business' && selectedBusinessId) {
      const business = businesses.find(b => b.id === selectedBusinessId);
      if (business) {
        title = `${business.name} | BetterByTheBlock`;
        description = (business.description || `${business.name} on BetterByTheBlock — ${business.category || 'home services'} in Wake County, NC.`).slice(0, 160);
      }
    } else if (view === 'serviceProfile' && selectedServiceId) {
      const service = services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId);
      if (service) {
        title = `${service.title} | BetterByTheBlock`;
        description = (service.description || `${service.title} — a neighborhood bulk-pricing deal on BetterByTheBlock.`).slice(0, 160);
      }
    } else if (view === 'neighborhood' && selectedNeighborhoodPageId) {
      const n = neighborhoods.find(nb => nb.id === selectedNeighborhoodPageId);
      if (n) {
        title = `Home Service Deals in ${n.name}, ${n.city} | BetterByTheBlock`;
        description = `Bulk-pricing home service deals available to residents of ${n.name} in ${n.city}, NC.`;
      }
    } else if (view === 'businesses') {
      title = `Local Businesses | BetterByTheBlock`;
      description = 'Browse real Wake County home service businesses on BetterByTheBlock.';
    } else if (view === 'how-it-works') {
      title = `How It Works | BetterByTheBlock`;
    } else if (view === 'help') {
      title = `Help Center | BetterByTheBlock`;
    } else if (view === 'contact') {
      title = `Contact Us | BetterByTheBlock`;
    } else if (view === 'articles') {
      title = `Cost Guides | BetterByTheBlock`;
    }

    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedBusinessId, selectedServiceId, selectedNeighborhoodPageId, lastSearchQuery]);

  useEffect(() => {
    if (currentUser.type === UserType.BUSINESS && CONSUMER_ONLY_VIEWS.has(view)) {
      setView('business-hub');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.type, view]);

  const handleSignUp = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId) || searchResults.find(s => s.id === serviceId);
    if (!service || !currentUser || (service.signedUpUserIds || []).includes(currentUser.id)) return;

    // Proposed deals aren't real yet — the business hasn't actually turned them
    // on. "Joining" would be fake, so redirect into the real request flow
    // instead, tied to this specific business (stronger outreach evidence than
    // a generic request).
    if (service.isProspective) {
      handleOpenRequestModal(service.businessId, service.title);
      return;
    }

    if (service.closeAfterThreshold && service.currentSignups >= service.requiredSignups) return;

    const newSignedUpUserIds = [...service.signedUpUserIds, currentUser.id];
    const newCurrentSignups = service.currentSignups + 1;

    const applyUpdate = (s: Service) =>
      s.id === serviceId
        ? { ...s, currentSignups: newCurrentSignups, signedUpUserIds: newSignedUpUserIds }
        : s;

    setServices(prevServices => {
      const next = prevServices.map(applyUpdate);
      saveState('services', next);
      return next;
    });

    setSearchResults(prevResults => prevResults.map(applyUpdate));

    const justUnlocked = newCurrentSignups === service.requiredSignups;
    const almostUnlocked = !justUnlocked && (service.requiredSignups - newCurrentSignups === 1);
    if (justUnlocked || almostUnlocked) {
      newSignedUpUserIds.forEach(uid => {
        addNotification({
          userId: uid,
          type: justUnlocked ? 'unlocked' : 'close_to_unlocking',
          message: justUnlocked
            ? `"${service.title}" just unlocked! Your deal is confirmed.`
            : `"${service.title}" only needs 1 more neighbor to unlock!`,
          serviceId: service.id,
        });
      });
    }
  };

  const handleOptOut = (serviceId: string) => {
    if (!currentUser) return;
    const service = services.find(s => s.id === serviceId);
    if (!service || !(service.signedUpUserIds || []).includes(currentUser.id)) return;
    if (service.status === 'completed') return;

    const newSignedUpUserIds = service.signedUpUserIds.filter(id => id !== currentUser.id);
    const newCurrentSignups = Math.max(0, service.currentSignups - 1);

    const applyUpdate = (s: Service) =>
      s.id === serviceId
        ? { ...s, currentSignups: newCurrentSignups, signedUpUserIds: newSignedUpUserIds }
        : s;

    setServices(prev => {
      const next = prev.map(applyUpdate);
      saveState('services', next);
      return next;
    });
    setSearchResults(prev => prev.map(applyUpdate));
  };

  const handleCompleteDeal = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service || service.status === 'completed') return;
    if ((service.currentSignups || 0) < service.requiredSignups) return;

    setServices(prev => {
      const next = prev.map(s => s.id === serviceId ? { ...s, status: 'completed' as const } : s);
      saveState('services', next);
      return next;
    });

    (service.signedUpUserIds || []).forEach(uid => {
      addNotification({
        userId: uid,
        type: 'deal_completed',
        message: `"${service.title}" has been marked completed by ${businesses.find(b => b.id === service.businessId)?.name || 'the business'}.`,
        serviceId: service.id,
        businessId: service.businessId,
      });
    });
  };

  // Deducts a neighborhood-targeting charge from a business's simulated balance and
  // appends one billing transaction. A no-op for a zero-amount charge (e.g. editing
  // a deal without adding any new neighborhoods), so balance/history stay untouched.
  const chargeBusiness = (
    businessId: string,
    amount: number,
    dealId: string,
    dealTitle: string,
    neighborhoodIds: string[],
    type: BillingTransaction['type']
  ) => {
    if (amount <= 0) return;
    setBusinesses(prev => {
      const next = prev.map(b => {
        if (b.id !== businessId) return b;
        const currentBalance = b.balance ?? STARTING_BUSINESS_BALANCE;
        const transaction: BillingTransaction = {
          id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          date: new Date().toISOString(),
          dealId,
          dealTitle,
          neighborhoodIds,
          amount,
          type,
        };
        return {
          ...b,
          balance: currentBalance - amount,
          billingHistory: [...(b.billingHistory || []), transaction],
        };
      });
      saveState('businesses', next);
      return next;
    });
  };

  // Simulates a business topping up its balance. Defensive amount guard mirrors
  // the validation already done in AddFundsControl — this never silently clamps
  // a bad value, it just refuses to touch balance/history.
  const handleAddFunds = (businessId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setBusinesses(prev => {
      const next = prev.map(b => {
        if (b.id !== businessId) return b;
        const currentBalance = b.balance ?? STARTING_BUSINESS_BALANCE;
        const transaction: BillingTransaction = {
          id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          date: new Date().toISOString(),
          amount,
          type: 'add_funds',
        };
        return {
          ...b,
          balance: currentBalance + amount,
          billingHistory: [...(b.billingHistory || []), transaction],
        };
      });
      saveState('businesses', next);
      return next;
    });
  };

  const handleToggleWishlist = (serviceId: string) => {
    if (!currentUser) return;
    const newWishlist = currentUser.wishlist?.includes(serviceId)
      ? currentUser.wishlist.filter(id => id !== serviceId)
      : [...(currentUser.wishlist || []), serviceId];

    updateCurrentUser({ ...currentUser, wishlist: newWishlist });
  };

  const handleBusinessClick = (businessId: string) => {
    setSelectedBusinessId(businessId);
    setView('business');
  };

  const handleServiceClick = (serviceId: string) => {
    setServices(prev => {
      const next = prev.map(s => s.id === serviceId ? { ...s, views: (s.views || 0) + 1 } : s);
      saveState('services', next);
      return next;
    });
    setSelectedServiceId(serviceId);
    setView('serviceProfile');
  };

  const handleNeighborhoodPageClick = (neighborhoodId: string) => {
    setSelectedNeighborhoodPageId(neighborhoodId);
    setView('neighborhood');
  };

  const handleOpenRequestModal = (businessId?: string, prefillServiceName?: string) => {
    setRequestModalBusinessId(businessId);
    setRequestModalPrefill(prefillServiceName);
    setIsRequestModalOpen(true);
  };

  const handleUpdateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    updateCurrentUser({ ...currentUser, ...updates });
  };

  const submitDealRequest = (serviceName: string, description: string, businessId?: string, honeypot?: string) => {
    if (!currentUser) return;
    if (honeypot) return; // bot filled the hidden field — silently drop
    if (isRateLimited(`dealRequest_${currentUser.id}`, 15000)) {
      alert("You're submitting requests too quickly — please wait a moment and try again.");
      return;
    }
    const newRequest: DealRequest = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatarUrl: currentUser.avatarUrl,
      serviceName,
      description,
      businessId,
      status: 'pending',
      date: new Date().toISOString(),
    };

    setDealRequests(prev => {
      const next = [newRequest, ...prev];
      saveState('dealRequests', next);
      return next;
    });

    // Best-effort copy to the server so real demand is visible across visitors,
    // not trapped in this one browser's localStorage. Never blocks or surfaces
    // an error to the resident — their local request already succeeded above.
    fetch('/api/deal-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceName,
        description,
        businessId,
        userId: currentUser.id,
        userName: currentUser.name,
        neighborhoodId: currentUser.neighborhoodId,
        city: neighborhoods.find(n => n.id === currentUser.neighborhoodId)?.city,
        website: '',
      }),
    }).catch(() => {});

    if (businessId) {
      const owner = users.find(u => u.businessId === businessId && u.type === UserType.BUSINESS);
      if (owner) {
        addNotification({
          userId: owner.id,
          type: 'deal_request_received',
          message: `${currentUser.name} requested "${serviceName}"`,
          businessId,
          dealRequestId: newRequest.id,
        });
      }
    }
  };

  const handleRequestSubmit = async (details: { serviceName: string; description: string; website?: string }) => {
    if (!currentUser || !isAuthenticated) {
      alert("Please sign in to request a deal.");
      return;
    }

    submitDealRequest(details.serviceName, details.description, requestModalBusinessId, details.website);
    alert(`Your request for "${details.serviceName}" has been submitted!`);
  };

  const handleUpdateDealRequestStatus = (requestId: string, status: 'accepted' | 'declined') => {
    const request = dealRequests.find(r => r.id === requestId);
    setDealRequests(prev => {
      const next = prev.map(r => r.id === requestId ? { ...r, status } : r);
      saveState('dealRequests', next);
      return next;
    });
    if (request) {
      addNotification({
        userId: request.userId,
        type: 'deal_request_status',
        message: `Your request for "${request.serviceName}" was ${status}.`,
        businessId: request.businessId,
        dealRequestId: request.id,
      });
    }
  };

  const handleAddReview = (businessId: string, rating: number, text: string) => {
    if (!currentUser) return;
    if (isRateLimited(`review_${currentUser.id}_${businessId}`, 30000)) {
      alert("You're posting too quickly — please wait a moment before submitting another review.");
      return;
    }
    // "Verified Neighbor" means the reviewer actually lives in one of the
    // neighborhoods this business has served a deal to — not just anyone.
    const servedNeighborhoodIds = new Set(
      services.filter(s => s.businessId === businessId).flatMap(s => s.neighborhoodIds || [])
    );
    const isVerifiedNeighbor = !!currentUser.neighborhoodId && servedNeighborhoodIds.has(currentUser.neighborhoodId);

    const newReview: Review = {
      id: `rev-${Date.now()}`,
      businessId,
      userId: currentUser.id,
      userName: currentUser.name,
      rating,
      text,
      date: new Date().toISOString(),
      isVerifiedNeighbor,
    };
    setReviews(prev => {
      const next = [newReview, ...prev];
      saveState('reviews', next);
      return next;
    });
    setBusinesses(prev => {
      const next = prev.map(b => {
        if (b.id !== businessId) return b;
        const oldCount = b.reviewCount || 0;
        const oldRating = b.rating || 0;
        const newCount = oldCount + 1;
        const newRating = (oldRating * oldCount + rating) / newCount;
        return { ...b, rating: Math.round(newRating * 10) / 10, reviewCount: newCount };
      });
      saveState('businesses', next);
      return next;
    });
  };

  const handleNotificationClick = (notification: Notification) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === notification.id ? { ...n, read: true } : n);
      saveState('notifications', next);
      return next;
    });
    if (notification.serviceId) {
      handleServiceClick(notification.serviceId);
    } else if (notification.businessId) {
      handleBusinessClick(notification.businessId);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => {
      const next = prev.map(n => n.userId === currentUserId ? { ...n, read: true } : n);
      saveState('notifications', next);
      return next;
    });
  };

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setCategorySortBy('recommended');
    setCategoryMinPrice('');
    setCategoryMaxPrice('');
    setView('category');
  };

  const handleBlogClick = (blog: typeof COST_GUIDES[0]) => {
    setSelectedBlog(blog);
    setView('blog');
  };

  const handleProfileClick = () => {
    setView(currentUser.type === UserType.BUSINESS ? 'business-hub' : 'profile');
  };

  const handleWishlistClick = () => {
    if (isAuthenticated) {
      setView('wishlist');
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleListBusinessClick = () => {
    if (isAuthenticated) {
      setView(currentUser?.type === UserType.BUSINESS ? 'business-hub' : 'business-onboarding');
    } else {
      setPostLoginIntent('business');
      setIsAuthModalOpen(true);
    }
  };

  const handleSwitchAccount = () => {
    if (!currentUser.linkedUserId) return;
    const linked = users.find(u => u.id === currentUser.linkedUserId);
    if (!linked) return;
    setCurrentUserId(linked.id);
    saveState('currentUserId', linked.id);
    setView(linked.type === UserType.BUSINESS ? 'business-hub' : 'home');
  };

  const handleLogoClick = () => {
    setView(currentUser.type === UserType.BUSINESS ? 'business-hub' : 'home');
  };

  const handleMyNeighborhoodClick = () => {
    setSearchResults(services.filter(s => ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId)));
    setFilterCategories([]);
    setFilterStatus('all');
    setSortBy('recommended');
    setLastSearchQuery('');
    setView('results');
  };

  const filteredServices = useMemo(() => {
    return services.filter(s => ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId));
  }, [services, selectedNeighborhoodId]);

  const currentNeighborhood = neighborhoods.find(n => n.id === selectedNeighborhoodId);

  const currentSeason = useMemo(() => {
    const month = new Date().getMonth();
    return SEASONS.find(s => s.months.includes(month)) || SEASONS[0];
  }, []);

  const seasonalServices = useMemo(() => {
    return filteredServices.filter(s => currentSeason.categories.includes(s.category));
  }, [filteredServices, currentSeason]);

  const categoryPageServices = useMemo(() => {
    if (!selectedCategory) return [];
    let results = filteredServices.filter(s => s.category === selectedCategory);

    if (categoryMinPrice.trim()) {
      const min = Number(categoryMinPrice);
      if (!Number.isNaN(min)) {
        results = results.filter(s => (s.standardPrice * (1 - s.discountPercentage / 100)) >= min);
      }
    }
    if (categoryMaxPrice.trim()) {
      const max = Number(categoryMaxPrice);
      if (!Number.isNaN(max)) {
        results = results.filter(s => (s.standardPrice * (1 - s.discountPercentage / 100)) <= max);
      }
    }

    results = [...results];
    switch (categorySortBy) {
      case 'price_low':
        results.sort((a, b) => (a.standardPrice * (1 - a.discountPercentage / 100)) - (b.standardPrice * (1 - b.discountPercentage / 100)));
        break;
      case 'price_high':
        results.sort((a, b) => (b.standardPrice * (1 - b.discountPercentage / 100)) - (a.standardPrice * (1 - a.discountPercentage / 100)));
        break;
      case 'discount_high':
        results.sort((a, b) => b.discountPercentage - a.discountPercentage);
        break;
      case 'closest_to_unlocking':
        results.sort((a, b) => (b.currentSignups / b.requiredSignups) - (a.currentSignups / a.requiredSignups));
        break;
      default:
        break;
    }
    return results;
  }, [filteredServices, selectedCategory, categoryMinPrice, categoryMaxPrice, categorySortBy]);

  const activeDealsCount = useMemo(() => {
    const now = Date.now();
    return services.filter(s => !s.expiresAt || new Date(s.expiresAt).getTime() > now).length;
  }, [services]);

  const neighborhoodsCoveredCount = useMemo(() => {
    const set = new Set<string>();
    services.forEach(s => (s.neighborhoodIds || []).forEach(id => set.add(id)));
    return set.size;
  }, [services]);

  const topRatedBusinesses = useMemo(() => {
    return [...businesses].filter(b => b.rating).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 8);
  }, [businesses]);

  const getBusinessTestimonial = (businessId: string) => {
    return reviews.find(r => r.businessId === businessId && r.rating === 5);
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    saveState('currentUserId', null);
    setView('home');
  };

  const CAROUSEL_ACCENTS = {
    primary: 'bg-primary-50 text-primary-600',
    amber: 'bg-amber-50 text-amber-600',
    pink: 'bg-pink-50 text-pink-600',
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    gray: 'bg-gray-100 text-gray-600',
  } as const;

  const renderServiceCarousel = (
    title: string,
    subtitle: string,
    carouselServices: Service[],
    seeAllStatus: string = 'all',
    icon: LucideIcon = Sparkles,
    accent: keyof typeof CAROUSEL_ACCENTS = 'gray'
  ) => {
    if (carouselServices.length === 0) return null;
    const displayServices = carouselServices.slice(0, 8);
    const Icon = icon;
    return (
      <section>
        <div className="flex items-end justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${CAROUSEL_ACCENTS[accent]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1 text-gray-900">{title}</h2>
              <p className="text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="hidden sm:flex items-center px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300 transition-colors"
            onClick={() => {
              setSearchResults(seeAllStatus === 'all' ? carouselServices : filteredServices);
              setView('results');
              setSortBy('recommended');
              setFilterCategories([]);
              setFilterStatus(seeAllStatus);
              setLastSearchQuery('');
            }}
          >
            See all
          </button>
        </div>
        <div className="relative -mx-6 sm:-mx-8">
          <div className="pointer-events-none absolute top-0 bottom-6 left-0 w-10 sm:w-16 bg-gradient-to-r from-gray-50 to-transparent z-20" />
          <div className="pointer-events-none absolute top-0 bottom-6 right-0 w-10 sm:w-16 bg-gradient-to-l from-gray-50 to-transparent z-20" />
          <div className="flex overflow-x-auto pb-6 gap-6 snap-x no-scrollbar px-8 sm:px-10 scroll-pl-8 scroll-pr-8 sm:scroll-pl-10 sm:scroll-pr-10">
          {displayServices.map(service => (
            <div key={service.id} className="snap-start shrink-0 w-[85vw] sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)] xl:w-[calc(20%-19.2px)]">
              <ServiceCard
                service={service}
                business={businesses.find(b => b.id === service.businessId)}
                onSignUp={() => handleSignUp(service.id)}
                isSignedUp={(service.signedUpUserIds || []).includes(currentUser?.id)}
                onBusinessClick={() => handleBusinessClick(service.businessId)}
                onServiceClick={() => handleServiceClick(service.id)}
                isWishlisted={(currentUser?.wishlist || []).includes(service.id)}
                onToggleWishlist={() => handleToggleWishlist(service.id)}
                currentUser={currentUser}
                users={users}
                onUpdateUser={updateCurrentUser}
              />
            </div>
          ))}
          </div>
        </div>
      </section>
    );
  };

  const getFilteredAndSortedResults = () => {
    let results = [...searchResults];

    if (filterCategories.length > 0) {
      results = results.filter(s => filterCategories.includes(s.category));
    }

    if (minPrice.trim()) {
      const min = Number(minPrice);
      if (!Number.isNaN(min)) {
        results = results.filter(s => (s.standardPrice * (1 - s.discountPercentage / 100)) >= min);
      }
    }
    if (maxPrice.trim()) {
      const max = Number(maxPrice);
      if (!Number.isNaN(max)) {
        results = results.filter(s => (s.standardPrice * (1 - s.discountPercentage / 100)) <= max);
      }
    }

    if (filterStatus !== 'all') {
      const now = new Date().getTime();
      results = results.filter(s => {
        const isExpired = s.expiresAt ? new Date(s.expiresAt).getTime() < now : false;
        const isGoalMet = s.currentSignups >= s.requiredSignups;
        const isCloseToUnlocking = s.currentSignups > 0 && s.currentSignups < s.requiredSignups && (s.currentSignups / s.requiredSignups) >= 0.5;

        if (filterStatus === 'active') return !isExpired;
        if (filterStatus === 'expired') return isExpired;
        if (filterStatus === 'goal_met') return isGoalMet;
        if (filterStatus === 'close_to_unlocking') return isCloseToUnlocking;
        return true;
      });
    }
    
    switch (sortBy) {
      case 'price_low':
        results.sort((a, b) => (a.standardPrice * (1 - a.discountPercentage / 100)) - (b.standardPrice * (1 - b.discountPercentage / 100)));
        break;
      case 'price_high':
        results.sort((a, b) => (b.standardPrice * (1 - b.discountPercentage / 100)) - (a.standardPrice * (1 - a.discountPercentage / 100)));
        break;
      case 'discount_high':
        results.sort((a, b) => b.discountPercentage - a.discountPercentage);
        break;
      case 'recommended':
      default:
        // Keep original order
        break;
    }
    
    return results;
  };

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    if (view === 'home') return [];
    const home: BreadcrumbItem = { label: 'Home', onClick: () => setView('home') };

    switch (view) {
      case 'results':
        return [home, { label: lastSearchQuery ? `Search Results for ${lastSearchQuery}` : 'Search Results' }];
      case 'category':
        return [home, { label: selectedCategory || 'Category' }];
      case 'business': {
        const business = businesses.find(b => b.id === selectedBusinessId);
        return [home, { label: 'Businesses', onClick: () => setView('businesses') }, { label: business?.name || 'Business' }];
      }
      case 'businesses':
        return [home, { label: 'Businesses' }];
      case 'serviceProfile': {
        const service = services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId);
        if (!service) return [home];
        return [
          home,
          { label: service.category, onClick: () => handleCategoryClick(service.category) },
          { label: service.title },
        ];
      }
      case 'neighborhood': {
        const n = neighborhoods.find(nb => nb.id === selectedNeighborhoodPageId);
        return [home, { label: n?.name || 'Neighborhood' }];
      }
      case 'blog':
        return [
          home,
          { label: 'Cost Guides', onClick: () => setView('articles') },
          { label: selectedBlog?.title || 'Article' },
        ];
      case 'articles':
        return [home, { label: 'Cost Guides' }];
      case 'profile':
        return [home, { label: 'Profile' }];
      case 'wishlist':
        return [home, { label: 'Wishlist' }];
      case 'how-it-works':
        return [home, { label: 'How It Works' }];
      case 'pro-signup':
        return [home, { label: 'List Your Business' }];
      case 'pro-resources':
        return [home, { label: 'Pro Resources' }];
      case 'success-stories':
        return [home, { label: 'Success Stories' }];
      case 'help':
        return [home, { label: 'Help Center' }];
      case 'contact':
        return [home, { label: 'Contact Us' }];
      case 'terms':
        return [home, { label: 'Terms & Conditions' }];
      case 'privacy':
        return [home, { label: 'Privacy Policy' }];
      case 'not-found':
        return [home, { label: 'Not Found' }];
      case 'settings':
        return [home, { label: 'Settings' }];
      case 'connections':
        return [home, { label: 'Connections' }];
      case 'my-deals':
        return [home, { label: 'My Deals' }];
      case 'business-onboarding':
        return [home, { label: 'Register Business' }];
      case 'business-hub':
        return [home, { label: 'Business Dashboard' }];
      case 'business-create-deal':
        return [
          home,
          { label: 'Business Dashboard', onClick: () => setView('business-hub') },
          { label: 'Create Deal' },
        ];
      case 'business-edit-profile':
        return [
          home,
          { label: 'Business Dashboard', onClick: () => setView('business-hub') },
          { label: 'Edit Profile' },
        ];
      default:
        return [home];
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans antialiased">
      <Header
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        onLogoClick={handleLogoClick}
        onProfileClick={handleProfileClick}
        onConnectionsClick={() => setView('connections')}
        onMyDealsClick={() => setView('my-deals')}
        onBusinessHubClick={() => {
          if (currentUser.type === 'BUSINESS') {
            setView('business-hub');
          } else {
            setView('business-onboarding');
          }
        }}
        onMyNeighborhoodClick={handleMyNeighborhoodClick}
        onListBusinessClick={handleListBusinessClick}
        onWishlistClick={handleWishlistClick}
        onSettingsClick={() => setView('settings')}
        onSwitchAccountClick={currentUser.linkedUserId ? handleSwitchAccount : undefined}
        onLogoutClick={handleLogout}
        onLoginClick={() => setIsAuthModalOpen(true)}
        notifications={isAuthenticated ? notifications.filter(n => n.userId === currentUserId) : []}
        onNotificationClick={handleNotificationClick}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      />
      
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        users={users}
        defaultAccountType={postLoginIntent === 'business' ? 'business' : 'resident'}
        onSignUp={(newUser, accountType) => {
          updateCurrentUser(newUser);
          setCurrentUserId(newUser.id);
          saveState('currentUserId', newUser.id);
          if (accountType === 'business' || postLoginIntent === 'business') {
            setView('business-onboarding');
          }
          setPostLoginIntent(null);
        }}
        onSignIn={(userId) => {
          setCurrentUserId(userId);
          saveState('currentUserId', userId);
          if (postLoginIntent === 'business') {
            const signedInUser = users.find(u => u.id === userId);
            setView(signedInUser?.type === UserType.BUSINESS ? 'business-hub' : 'business-onboarding');
            setPostLoginIntent(null);
          }
        }}
      />
      
      <LocationPromptModal 
        isOpen={isLocationPromptOpen} 
        onClose={() => setIsLocationPromptOpen(false)} 
        onShareLocation={handleShareLocation} 
      />

      <main>
        <React.Suspense fallback={<div className="py-24 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
        {view === 'home' && (
          <div className="bg-gray-900 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-gray-900"></div>
            <AIDealFinder
              currentNeighborhood={neighborhoods.find(n => n.id === selectedNeighborhoodId)}
              onChangeNeighborhoodClick={() => setView('profile')}
              onLocalSearch={(query) => {
                const queryLower = (query || '').toLowerCase();
                const matches = services.filter(s =>
                  ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId) &&
                  ((s.title || '').toLowerCase().includes(queryLower) ||
                  (s.category || '').toLowerCase().includes(queryLower) ||
                  (s.description || '').toLowerCase().includes(queryLower))
                );
                setSearchResults(matches);
                setView('results');
                setSortBy('recommended');
                setFilterCategories([]);
                setFilterStatus('all');
                setLastSearchQuery(query.trim());
              }}
            />
          </div>
        )}

        {(view === 'home' || view === 'results') && (
          <div className="bg-white border-b border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 py-3 animate-marquee w-max">
              {[...ALL_CATEGORIES, ...ALL_CATEGORIES].map((cat, idx) => {
                const Icon = CATEGORY_ICONS[cat] || GridIcon;
                return (
                  <button
                    key={`${cat}-${idx}`}
                    onClick={() => handleCategoryClick(cat)}
                    className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-primary-700 hover:bg-primary-50 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                  >
                    <Icon className="w-4 h-4" />
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 pb-8">
          {view !== 'home' && <Breadcrumbs items={getBreadcrumbs()} />}
          {view === 'home' ? (
            <div className="pt-8 space-y-16">
              {/* Carousels */}
              {filteredServices.length > 0 ? (
                <>
                  {renderServiceCarousel(
                    `New Deals in ${currentNeighborhood?.name || 'Your Neighborhood'}`,
                    "Fresh opportunities to save in your neighborhood.",
                    [...filteredServices].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
                    'all',
                    Sparkles,
                    'primary'
                  )}
                  {renderServiceCarousel(
                    `Deals Almost Unlocked in ${currentNeighborhood?.name || 'Your Neighborhood'}`,
                    "These deals just need a few more neighbors to unlock.",
                    filteredServices.filter(s => s.currentSignups > 0 && s.currentSignups < s.requiredSignups && (s.currentSignups / s.requiredSignups) >= 0.5).sort((a, b) => (b.currentSignups / b.requiredSignups) - (a.currentSignups / a.requiredSignups)),
                    'close_to_unlocking',
                    Zap,
                    'amber'
                  )}
                </>
              ) : (
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="col-span-full text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100"
                 >
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TagIcon className="w-8 h-8 text-gray-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No deals found here yet</h3>
                    <p className="text-gray-500 max-w-md mx-auto mb-6">
                      Don't see what you need? Request a deal and we'll let local businesses know your neighborhood is interested.
                    </p>
                    <Button onClick={() => handleOpenRequestModal()}>Request a Deal</Button>
                 </motion.div>
              )}

              {/* How it works + trust stats */}
              <section className="bg-white rounded-3xl p-8 sm:p-10 border border-gray-100 shadow-[0_2px_4px_rgba(15,23,42,0.04),0_16px_40px_-8px_rgba(15,23,42,0.18)]">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How BetterByTheBlock Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">Browse your neighborhood</h3>
                    <p className="text-gray-500 text-sm">See deals real businesses are offering to your specific neighborhood.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">Join with your neighbors</h3>
                    <p className="text-gray-500 text-sm">Every deal unlocks once enough neighbors join — the more, the cheaper.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center mx-auto mb-3">
                      <BadgePercent className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">Save when it unlocks</h3>
                    <p className="text-gray-500 text-sm">Once unlocked, the business reaches out to schedule at the bulk rate.</p>
                  </div>
                </div>
                {businesses.length > 0 ? (
                  <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200 pt-6">
                    <div className="text-center px-2">
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{activeDealsCount}</p>
                      <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">Active Deals</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{neighborhoodsCoveredCount}</p>
                      <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">Neighborhoods Covered</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{businesses.length}</p>
                      <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">Local Businesses</p>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 pt-6 text-center">
                    <p className="text-gray-700 font-semibold mb-3">We're just launching in Wake County — be one of the first businesses listed, free.</p>
                    <Button onClick={handleListBusinessClick}>List Your Business Free</Button>
                  </div>
                )}
              </section>

              {/* Example deals — pre-launch, no real business attached yet */}
              <section>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">See What a Deal Could Look Like</h2>
                  <p className="text-gray-500 text-sm mt-1">No businesses in your neighborhood yet — here's the kind of bulk-pricing deal you could unlock once one joins. Want one for real? Request it below.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {EXAMPLE_DEALS.map((deal) => {
                    const discounted = deal.standardPrice * (1 - deal.discountPercentage / 100);
                    return (
                      <div key={deal.title} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="relative h-32 w-full bg-gray-200 overflow-hidden shrink-0">
                          <img src={getExampleDealImage(deal.category)} alt={deal.category} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <span className="absolute top-3 left-3 bg-gray-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Example</span>
                        </div>
                        <div className="p-4 flex-grow flex flex-col">
                          <p className="text-[10px] font-semibold text-primary-600 uppercase tracking-wider mb-1">{deal.category}</p>
                          <h3 className="text-lg font-extrabold text-gray-900 leading-tight mb-1">{deal.title}</h3>
                          <p className="text-gray-600 text-xs mb-3 flex-grow">{deal.description}</p>
                          <div className="flex items-baseline gap-1.5 mb-1">
                            <p className="text-green-700 font-black text-2xl leading-none">${discounted.toFixed(0)}</p>
                            <p className="text-gray-500 text-xs line-through leading-none">${deal.standardPrice}</p>
                            <span className="ml-auto bg-green-600 text-white text-[10px] font-black px-2 py-1 rounded-full">{deal.discountPercentage}% OFF</span>
                          </div>
                          <p className="text-gray-500 text-[11px] mb-3">Unlocks once {deal.requiredSignups} neighbors join</p>
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => handleOpenRequestModal(undefined, deal.title)}
                          >
                            Request This For My Neighborhood
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {filteredServices.length > 0 && (
                <>
                  {renderServiceCarousel(
                    `Neighborhood Favorites in ${currentNeighborhood?.name || 'Your Neighborhood'}`,
                    "The deals your neighbors are joining the most.",
                    [...filteredServices].sort((a, b) => (b.currentSignups || 0) - (a.currentSignups || 0)),
                    'all',
                    Heart,
                    'pink'
                  )}
                  {renderServiceCarousel(
                    currentSeason.headline,
                    currentSeason.blurb,
                    [...seasonalServices].sort((a, b) => (b.currentSignups / b.requiredSignups) - (a.currentSignups / a.requiredSignups)),
                    'all',
                    Sun,
                    'orange'
                  )}
                </>
              )}

              {/* Top rated businesses */}
              {topRatedBusinesses.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Top Rated Local Businesses</h2>
                  <div className="flex overflow-x-auto pb-2 gap-4 snap-x no-scrollbar">
                    {topRatedBusinesses.map(b => {
                      const testimonial = getBusinessTestimonial(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => handleBusinessClick(b.id)}
                          className="snap-start shrink-0 w-72 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all text-left flex flex-col"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <img
                              src={b.logoUrl}
                              alt={b.name}
                              className="w-12 h-12 rounded-xl object-cover shrink-0"
                              referrerPolicy="no-referrer"
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_CATEGORY_IMAGE; }}
                            />
                            <div className="min-w-0">
                              <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{b.name}</h4>
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                {Number(b.rating).toFixed(1)} <span className="text-gray-500">({b.reviewCount || 0})</span>
                              </div>
                            </div>
                          </div>
                          {testimonial && (
                            <div className="border-t border-gray-100 pt-3 mt-1">
                              <div className="flex gap-0.5 mb-1.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                ))}
                              </div>
                              <p className="text-sm text-gray-600 italic line-clamp-3">"{testimonial.text}"</p>
                              <p className="text-xs text-gray-500 mt-2 font-medium">— {testimonial.userName}{testimonial.isVerifiedNeighbor ? ', Verified Neighbor' : ''}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {filteredServices.length > 0 && (
                <>
                  {renderServiceCarousel(
                    "Cleaning & Maintenance",
                    "Keep your home sparkling clean.",
                    filteredServices.filter(s => s.category === 'Cleaning & Maid Services' || s.category === 'Pressure Washing' || s.category === 'Window Cleaning'),
                    'all',
                    Droplets,
                    'blue'
                  )}
                  {renderServiceCarousel(
                    "Outdoor & Yard",
                    "Boost your curb appeal.",
                    filteredServices.filter(s => s.category === 'Landscaping' || s.category === 'Pest Control' || s.category === 'Roofing'),
                    'all',
                    TreePine,
                    'emerald'
                  )}
                </>
              )}

              <section className="mb-8">
                <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Knowledge is priceless - so our cost guides are free.</h3>
                    <p className="text-gray-500">Sign up to get free project cost info in your inbox.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input type="email" placeholder="Email address" className="pl-10 pr-4 py-3 rounded-lg border border-gray-300 w-full sm:w-64 focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                    </div>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input type="text" placeholder="Zip code" className="pl-10 pr-4 py-3 rounded-lg border border-gray-300 w-full sm:w-32 focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                    </div>
                    <Button className="py-3 px-6 rounded-lg font-bold whitespace-nowrap">Sign me up</Button>
                  </div>
                </div>
              </section>
            </div>
          ) : view === 'results' ? (
            <section className="pt-12">
              <div className="mb-8">
                <button 
                  onClick={() => setView('home')} 
                  className="text-primary hover:underline mb-4 inline-flex items-center font-medium"
                >
                  &larr; Back to Home
                </button>
                <div className="mb-8">
                  <AIDealFinder
                    currentNeighborhood={neighborhoods.find(n => n.id === selectedNeighborhoodId)}
                    onChangeNeighborhoodClick={() => setView('profile')}
                    onLocalSearch={(query) => {
                      const queryLower = (query || '').toLowerCase();
                      const matches = services.filter(s => 
                        ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId) &&
                        ((s.title || '').toLowerCase().includes(queryLower) || 
                        (s.category || '').toLowerCase().includes(queryLower) ||
                        (s.description || '').toLowerCase().includes(queryLower))
                      );
                      setSearchResults(matches);
                      setView('results');
                      setSortBy('recommended');
                      setFilterCategories([]);
                      setFilterStatus('all');
                      setLastSearchQuery(query.trim());
                    }}
                    compact={true}
                  />
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      {lastSearchQuery ? `Search Results for ${lastSearchQuery}` : 'Search Results'}
                    </h2>
                    <p className="text-gray-600">We found these pros and deals for your neighborhood.</p>
                  </div>
                  <button
                    onClick={() => setIsMobileFiltersOpen(prev => !prev)}
                    className="md:hidden inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm bg-white shrink-0"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {isMobileFiltersOpen ? 'Hide Filters' : 'Filters & Sort'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Filters — collapsed behind a toggle on mobile so
                    results aren't pushed below a full page of filter controls */}
                <div className={`${isMobileFiltersOpen ? 'block' : 'hidden'} md:block w-full md:w-64 shrink-0 space-y-8`}>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Categories</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            checked={filterCategories.length === 0} 
                            onChange={() => setFilterCategories([])}
                            className="peer appearance-none w-4 h-4 border border-gray-300 rounded checked:bg-primary checked:border-primary transition-all"
                          />
                          <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                        <span className="text-gray-700 text-sm font-medium group-hover:text-gray-900 transition-colors">All Categories</span>
                      </label>
                      
                      <div className="space-y-4 mt-4">
                        {CATEGORY_GROUPS.map(group => (
                          <CollapsibleCategoryGroup 
                            key={group.name} 
                            group={group} 
                            filterCategories={filterCategories} 
                            setFilterCategories={setFilterCategories} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Status</h3>
                    <div className="space-y-3">
                      {[
                        { value: 'all', label: 'All Deals' },
                        { value: 'active', label: 'Active Only' },
                        { value: 'close_to_unlocking', label: 'Close to Unlocking' },
                        { value: 'expired', label: 'Expired Only' },
                        { value: 'goal_met', label: 'Goal Met Only' },
                      ].map(option => (
                        <label key={option.value} className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="radio" 
                              name="status" 
                              value={option.value} 
                              checked={filterStatus === option.value} 
                              onChange={(e) => setFilterStatus(e.target.value)}
                              className="peer appearance-none w-4 h-4 border border-gray-300 rounded-full checked:border-primary checked:border-[5px] transition-all"
                            />
                          </div>
                          <span className="text-gray-700 text-sm group-hover:text-gray-900 transition-colors">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Price Range</h3>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="Min"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                      <span className="text-gray-500 text-sm">–</span>
                      <input
                        type="number"
                        min="0"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="Max"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Sort By</h3>
                    <div className="space-y-3">
                      {[
                        { value: 'recommended', label: 'Recommended' },
                        { value: 'price_low', label: 'Price: Low to High' },
                        { value: 'price_high', label: 'Price: High to Low' },
                        { value: 'discount_high', label: 'Highest Discount' },
                      ].map(option => (
                        <label key={option.value} className="flex items-center gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="radio" 
                              name="sort" 
                              value={option.value} 
                              checked={sortBy === option.value} 
                              onChange={(e) => setSortBy(e.target.value)}
                              className="peer appearance-none w-4 h-4 border border-gray-300 rounded-full checked:border-primary checked:border-[5px] transition-all"
                            />
                          </div>
                          <span className="text-gray-700 text-sm group-hover:text-gray-900 transition-colors">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                  {getFilteredAndSortedResults().length === 0 && (
                    <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TagIcon className="w-8 h-8 text-gray-500" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No deals match your filters</h3>
                      <p className="text-gray-500 max-w-md mx-auto mb-6">
                        Try adjusting your filters, or request this deal and we'll let local businesses know.
                      </p>
                      <Button onClick={() => handleOpenRequestModal()}>Request a Deal</Button>
                    </div>
                  )}

                  <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {getFilteredAndSortedResults().map(service => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        business={businesses.find(b => b.id === service.businessId)}
                        onSignUp={() => handleSignUp(service.id)}
                        isSignedUp={(service.signedUpUserIds || []).includes(currentUser?.id)}
                        onBusinessClick={() => handleBusinessClick(service.businessId)}
                        onServiceClick={() => handleServiceClick(service.id)}
                        isWishlisted={(currentUser?.wishlist || []).includes(service.id)}
                        onToggleWishlist={() => handleToggleWishlist(service.id)}
                        currentUser={currentUser}
                        users={users}
                        onUpdateUser={updateCurrentUser}
                      />
                    ))}
                  </motion.div>
                </div>
              </div>
            </section>
          ) : view === 'business' && selectedBusinessId ? (
            <BusinessProfile
              business={businesses.find(b => b.id === selectedBusinessId)!}
              services={services.filter(s => s.businessId === selectedBusinessId && ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId))}
              allServices={services}
              neighborhoods={neighborhoods}
              reviews={reviews.filter(r => r.businessId === selectedBusinessId)}
              allBusinesses={businesses}
              onSignUp={handleSignUp}
              currentUserSignedUpIds={services.filter(s => (s.signedUpUserIds || []).includes(currentUser?.id || '')).map(s => s.id)}
              currentUser={currentUser}
              users={users}
              isAuthenticated={isAuthenticated}
              onSubmitDealRequest={(serviceName, description) => submitDealRequest(serviceName, description, selectedBusinessId)}
              onAddReview={(rating, text) => handleAddReview(selectedBusinessId, rating, text)}
              onBack={() => setView(searchResults.length > 0 ? 'results' : 'home')}
              onServiceClick={handleServiceClick}
              onRequestService={() => handleOpenRequestModal(selectedBusinessId)}
              onBusinessClick={handleBusinessClick}
            />
          ) : view === 'businesses' ? (
            <BusinessDirectory
              businesses={businesses}
              services={services}
              neighborhoods={neighborhoods}
              onBusinessClick={handleBusinessClick}
            />
          ) : view === 'serviceProfile' && selectedServiceId && (services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId)) ? (
            <ServiceProfile
              service={(services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))!}
              business={businesses.find(b => b.id === (services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))?.businessId)!}
              reviews={reviews.filter(r => r.businessId === (services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))?.businessId)}
              similarServices={services.filter(s => s.category === (services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))?.category && s.id !== selectedServiceId).slice(0, 3)}
              providerServices={services.filter(s => s.businessId === (services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))?.businessId && s.id !== selectedServiceId).slice(0, 3)}
              signedUpUsers={users.filter(u => ((services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))?.signedUpUserIds || []).includes(u.id))}
              users={users}
              onSignUp={() => handleSignUp(selectedServiceId)}
              isSignedUp={((services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))?.signedUpUserIds || []).includes(currentUser?.id) || false}
              onBusinessClick={() => handleBusinessClick((services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))?.businessId!)}
              onServiceClick={handleServiceClick}
              onBack={() => setView(searchResults.length > 0 ? 'results' : 'home')}
              currentUser={currentUser}
              onUpdateUser={updateCurrentUser}
              neighborhoods={((services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId))?.neighborhoodIds || [])
                .map(id => neighborhoods.find(n => n.id === id))
                .filter((n): n is typeof neighborhoods[number] => !!n)}
              onNeighborhoodClick={handleNeighborhoodPageClick}
              onToggleWishlist={handleToggleWishlist}
            />
          ) : view === 'category' && selectedCategory ? (
            <section className="pt-12">
              <button
                onClick={() => setView('home')}
                className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
              >
                &larr; Back to Home
              </button>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-2">{selectedCategory} Deals</h2>
              <p className="text-gray-500 mb-8 max-w-2xl">
                {categoryPageServices.length > 0
                  ? `${categoryPageServices.length} ${selectedCategory.toLowerCase()} deal${categoryPageServices.length === 1 ? '' : 's'} available in ${currentNeighborhood?.name || 'your neighborhood'}. Join with your neighbors to unlock bulk pricing.`
                  : `No ${selectedCategory.toLowerCase()} deals in ${currentNeighborhood?.name || 'your neighborhood'} right now. Request one and we'll let local businesses know your neighborhood is interested.`}
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Sort by</label>
                  <select
                    value={categorySortBy}
                    onChange={(e) => setCategorySortBy(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="closest_to_unlocking">Closest to Unlocking</option>
                    <option value="discount_high">Highest Discount</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Price</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Min"
                    value={categoryMinPrice}
                    onChange={(e) => setCategoryMinPrice(e.target.value)}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                  <span className="text-gray-500">&ndash;</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="Max"
                    value={categoryMaxPrice}
                    onChange={(e) => setCategoryMaxPrice(e.target.value)}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                {(categoryMinPrice || categoryMaxPrice || categorySortBy !== 'recommended') && (
                  <button
                    onClick={() => { setCategorySortBy('recommended'); setCategoryMinPrice(''); setCategoryMaxPrice(''); }}
                    className="text-sm font-medium text-primary-600 hover:underline sm:ml-auto"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {categoryPageServices.length > 0 ? (
                  categoryPageServices.map(service => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      business={businesses.find(b => b.id === service.businessId)}
                      onSignUp={() => handleSignUp(service.id)}
                      isSignedUp={(service.signedUpUserIds || []).includes(currentUser?.id)}
                      onBusinessClick={() => handleBusinessClick(service.businessId)}
                      onServiceClick={() => handleServiceClick(service.id)}
                      isWishlisted={(currentUser?.wishlist || []).includes(service.id)}
                      onToggleWishlist={() => handleToggleWishlist(service.id)}
                      currentUser={currentUser}
                      users={users}
                      onUpdateUser={updateCurrentUser}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl">
                    <p className="text-gray-500 mb-4">No deals found for {selectedCategory} in {currentNeighborhood?.name || 'your neighborhood'} right now.</p>
                    <Button onClick={() => handleOpenRequestModal()}>Request a Deal</Button>
                  </div>
                )}
              </div>
            </section>
          ) : view === 'blog' && selectedBlog ? (
            <section className="pt-12 max-w-3xl mx-auto">
              <button 
                onClick={() => setView('home')} 
                className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
              >
                &larr; Back to Home
              </button>
              <img src={selectedBlog.image} alt={selectedBlog.title} className="w-full h-64 object-cover rounded-2xl mb-8" />
              <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{selectedBlog.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500 font-medium mb-8 uppercase tracking-wider">
                <span>By {selectedBlog.author}</span>
                <span>•</span>
                <span>{selectedBlog.date}</span>
              </div>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p className="lead text-xl text-gray-600 mb-8">{selectedBlog.description}</p>
                {(selectedBlog as any).body?.map((paragraph: string, idx: number) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : view === 'wishlist' ? (
            <section className="pt-12 max-w-[95%] mx-auto">
              <button 
                onClick={() => setView('home')} 
                className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
              >
                &larr; Back to Home
              </button>
              <h2 className="text-4xl font-extrabold text-gray-900 mb-8">Your Wishlist</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {services.filter(s => currentUser?.wishlist?.includes(s.id)).length > 0 ? (
                  services.filter(s => currentUser?.wishlist?.includes(s.id)).map(service => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      business={businesses.find(b => b.id === service.businessId)}
                      onSignUp={() => handleSignUp(service.id)}
                      isSignedUp={(service.signedUpUserIds || []).includes(currentUser?.id)}
                      onBusinessClick={() => handleBusinessClick(service.businessId)}
                      onServiceClick={() => handleServiceClick(service.id)}
                      isWishlisted={(currentUser?.wishlist || []).includes(service.id)}
                      onToggleWishlist={() => handleToggleWishlist(service.id)}
                      currentUser={currentUser}
                      users={users}
                      onUpdateUser={updateCurrentUser}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-8 h-8 text-gray-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Your wishlist is empty</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Save deals you're interested in by clicking the heart icon on any service card.
                    </p>
                  </div>
                )}
              </div>
            </section>
          ) : view === 'profile' ? (
            <section className="pt-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <button 
                onClick={() => setView('home')} 
                className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
              >
                &larr; Back to Home
              </button>
              <UserProfile
                currentUser={currentUser}
                setCurrentUser={updateCurrentUser}
                services={services}
                businesses={businesses}
                users={users}
                dealRequests={dealRequests.filter(r => r.userId === currentUser?.id)}
                onSignUp={handleSignUp}
                onBusinessClick={handleBusinessClick}
                onServiceClick={handleServiceClick}
                onToggleWishlist={handleToggleWishlist}
                onUpdateProfile={handleUpdateProfile}
                onOptOut={handleOptOut}
              />
            </section>
          ) : view === 'business-onboarding' ? (
            <section className="pt-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <BusinessOnboarding
                currentUser={currentUser}
                onComplete={(businessData) => {
                  const newBusiness: Business = {
                    id: `biz_${Date.now()}`,
                    name: businessData.name || '',
                    logoUrl: businessData.logoUrl || '',
                    category: businessData.category,
                    address: businessData.address,
                    description: businessData.description,
                    website: businessData.website,
                    phone: businessData.phone,
                    googleBusinessUrl: businessData.googleBusinessUrl,
                    balance: STARTING_BUSINESS_BALANCE,
                    billingHistory: [],
                  };
                  setBusinesses(prev => {
                    const next = [...prev, newBusiness];
                    saveState('businesses', next);
                    return next;
                  });

                  // A business gets its own account, separate from the resident
                  // account that created it, linked both ways so the owner can
                  // switch between their personal and business identities.
                  const businessUserId = `biz-user-${Date.now()}`;
                  const businessUser: User = {
                    id: businessUserId,
                    name: newBusiness.name,
                    type: UserType.BUSINESS,
                    avatarUrl: newBusiness.logoUrl,
                    email: currentUser.email,
                    businessId: newBusiness.id,
                    linkedUserId: currentUser.id,
                  };
                  updateCurrentUser(businessUser);
                  updateCurrentUser({ ...currentUser, linkedUserId: businessUserId });
                  setCurrentUserId(businessUserId);
                  saveState('currentUserId', businessUserId);
                  setView('business-hub');
                }}
                onCancel={() => setView('home')}
              />
            </section>
          ) : view === 'business-hub' ? (
            <section className="pt-12">
              <BusinessHub
                currentUser={currentUser}
                business={businesses.find(b => b.id === currentUser.businessId) || null}
                services={services}
                users={users}
                dealRequests={dealRequests.filter(r => r.businessId === currentUser.businessId)}
                onUpdateDealRequestStatus={handleUpdateDealRequestStatus}
                onCreateDeal={() => { setEditingServiceId(null); setView('business-create-deal'); }}
                onEditDeal={(serviceId) => { setEditingServiceId(serviceId); setView('business-create-deal'); }}
                onServiceClick={handleServiceClick}
                onUpdateUser={updateCurrentUser}
                onEditProfile={() => setView('business-edit-profile')}
                onCompleteDeal={handleCompleteDeal}
                onAddFunds={(amount) => currentUser.businessId && handleAddFunds(currentUser.businessId, amount)}
              />
            </section>
          ) : view === 'business-edit-profile' ? (
            <section className="pt-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <BusinessEditProfile
                business={businesses.find(b => b.id === currentUser.businessId)!}
                onSave={(updates) => {
                  setBusinesses(prev => {
                    const next = prev.map(b => b.id === currentUser.businessId ? { ...b, ...updates } : b);
                    saveState('businesses', next);
                    return next;
                  });
                  setView('business-hub');
                }}
                onCancel={() => setView('business-hub')}
              />
            </section>
          ) : view === 'business-create-deal' ? (
            <section className="pt-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <BusinessCreateDeal
                business={businesses.find(b => b.id === currentUser.businessId)!}
                initialService={editingServiceId ? services.find(s => s.id === editingServiceId) : undefined}
                onComplete={(serviceData, selectedNeighborhoods, billing) => {
                  if (editingServiceId) {
                    setServices(prev => {
                      const next = prev.map(s => s.id === editingServiceId
                        ? { ...s, ...serviceData, id: s.id, neighborhoodIds: selectedNeighborhoods } as Service
                        : s);
                      saveState('services', next);
                      return next;
                    });
                    if (currentUser.businessId && billing.amount > 0) {
                      chargeBusiness(
                        currentUser.businessId,
                        billing.amount,
                        editingServiceId,
                        serviceData.title || '',
                        billing.chargedNeighborhoodIds,
                        'add_neighborhoods'
                      );
                    }
                    setEditingServiceId(null);
                    setView('business-hub');
                    return;
                  }

                  if (isRateLimited(`createDeal_${currentUser.businessId}`, 5000)) {
                    alert("You're creating deals too quickly — please wait a moment and try again.");
                    return;
                  }
                  const newService: Service = {
                    ...serviceData,
                    id: `srv_${Date.now()}`,
                    neighborhoodIds: selectedNeighborhoods,
                  } as Service;
                  setServices(prev => {
                    const next = [...prev, newService];
                    saveState('services', next);
                    return next;
                  });
                  if (currentUser.businessId && billing.amount > 0) {
                    chargeBusiness(
                      currentUser.businessId,
                      billing.amount,
                      newService.id,
                      newService.title,
                      billing.chargedNeighborhoodIds,
                      'publish'
                    );
                  }
                  setView('business-hub');
                }}
                onCancel={() => { setEditingServiceId(null); setView('business-hub'); }}
                onAddFunds={(amount) => currentUser.businessId && handleAddFunds(currentUser.businessId, amount)}
              />
            </section>
          ) : view === 'connections' ? (
            <section className="pt-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <button 
                onClick={() => setView('home')} 
                className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
              >
                &larr; Back to Home
              </button>
              <ConnectionsPanel currentUser={currentUser} users={users} onUpdateUser={updateCurrentUser} />
              <ConnectionsFeed currentUser={currentUser} users={users} services={services} />
            </section>
          ) : view === 'my-deals' ? (
            <section className="pt-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <button 
                onClick={() => setView('home')} 
                className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
              >
                &larr; Back to Home
              </button>
              {/* Active Deals */}
              <h2 className="text-2xl font-bold text-gray-900 mb-6 mt-4">Your Active Deals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {services.filter(s => (s.signedUpUserIds || []).includes(currentUser?.id || '')).length > 0 ? (
                  services.filter(s => (s.signedUpUserIds || []).includes(currentUser?.id || '')).map((service, index) => (
                    <ServiceCard
                      key={`active-${service.id}-${index}`}
                      service={service}
                      business={businesses.find(b => b.id === service.businessId)}
                      onSignUp={() => handleSignUp(service.id)}
                      isSignedUp={true}
                      onBusinessClick={() => handleBusinessClick(service.businessId)}
                      onServiceClick={() => handleServiceClick(service.id)}
                      isWishlisted={(currentUser?.wishlist || []).includes(service.id)}
                      onToggleWishlist={() => handleToggleWishlist(service.id)}
                      currentUser={currentUser}
                      users={users}
                      onUpdateUser={updateCurrentUser}
                      onOptOut={() => handleOptOut(service.id)}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl">
                    <p className="text-gray-500">You haven't joined any deals yet.</p>
                  </div>
                )}
              </div>

              {/* Wishlist */}
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Heart className="w-6 h-6 text-red-500" fill="currentColor" />
                Wishlist & Favorites
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {services.filter(s => (currentUser?.wishlist || []).includes(s.id)).length > 0 ? (
                  services.filter(s => (currentUser?.wishlist || []).includes(s.id)).map((service, index) => (
                    <ServiceCard
                      key={`wishlist-${service.id}-${index}`}
                      service={service}
                      business={businesses.find(b => b.id === service.businessId)}
                      onSignUp={() => handleSignUp(service.id)}
                      isSignedUp={(service.signedUpUserIds || []).includes(currentUser?.id || '')}
                      onBusinessClick={() => handleBusinessClick(service.businessId)}
                      onServiceClick={() => handleServiceClick(service.id)}
                      isWishlisted={true}
                      onToggleWishlist={() => handleToggleWishlist(service.id)}
                      currentUser={currentUser}
                      users={users}
                      onUpdateUser={updateCurrentUser}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl">
                    <p className="text-gray-500">Your wishlist is empty.</p>
                  </div>
                )}
              </div>

              {/* Deal Requests History */}
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Deal Requests</h2>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
                {dealRequests.filter(r => r.userId === currentUser?.id).length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {[...dealRequests.filter(r => r.userId === currentUser?.id)].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((request) => (
                      <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{request.serviceName}</h3>
                            {request.businessId && (
                              <p className="text-sm text-gray-500 mt-1">
                                Requested from: <span className="font-medium text-gray-700">{businesses.find(b => b.id === request.businessId)?.name || 'Unknown Business'}</span>
                              </p>
                            )}
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{request.description}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              Requested on {new Date(request.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border shrink-0 ${
                            request.status === 'accepted' ? 'bg-green-50 border-green-100 text-green-700' :
                            request.status === 'declined' ? 'bg-red-50 border-red-100 text-red-700' :
                            'bg-gray-50 border-gray-100 text-gray-700'
                          }`}>
                            <span className="font-medium text-sm capitalize">{request.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <p className="text-gray-500 mb-4">You haven't requested any custom deals yet.</p>
                  </div>
                )}
              </div>
            </section>
          ) : view === 'articles' ? (
            <ArticlesPage 
              articles={COST_GUIDES} 
              onArticleClick={handleBlogClick} 
              onBack={() => setView('home')} 
            />
          ) : view === 'settings' ? (
            <SettingsPage
              currentUser={currentUser}
              onUpdateNotificationPreference={handleUpdateNotificationPreference}
              onClearLocalData={handleClearLocalData}
              onBack={() => setView('home')}
            />
          ) : view === 'how-it-works' ? (
            <StaticPage 
              title="How it works" 
              content={<p>BetterByTheBlock connects you with local professionals offering group discounts. When more neighbors join a deal, everyone saves.</p>} 
              onBack={() => setView('home')} 
            />
          ) : view === 'pro-signup' ? (
            <StaticPage 
              title="Join our network" 
              content={<p>Grow your business by offering group discounts to neighborhoods. Reach more customers with less marketing effort.</p>} 
              onBack={() => setView('home')} 
            />
          ) : view === 'pro-resources' ? (
            <StaticPage 
              title="Pro resources" 
              content={<p>Access guides, templates, and best practices to maximize your success on BetterByTheBlock.</p>} 
              onBack={() => setView('home')} 
            />
          ) : view === 'success-stories' ? (
            <StaticPage 
              title="Success stories" 
              content={<p>Read how local professionals and neighbors have benefited from group buying on BetterByTheBlock.</p>} 
              onBack={() => setView('home')} 
            />
          ) : view === 'help' ? (
            <StaticPage
              title="Help center"
              content={
                <>
                  <h3>How bulk pricing works</h3>
                  <p>Every deal lists a "required signups" number. Once that many neighbors join, the deal unlocks and the discounted price is confirmed with the business. You can usually still join a deal after it unlocks, right up until it expires.</p>

                  <h3>What happens after I join a deal?</h3>
                  <p>You're not charged anything by joining — this demo doesn't process payments. Joining signals real interest and helps unlock the group discount; you'd coordinate scheduling and payment directly with the business once a deal is confirmed.</p>

                  <h3>What if the exact service I need isn't listed?</h3>
                  <p>Use "Request a Deal" from your neighborhood's results page, or the request button on a specific business's profile. That sends your request straight to the business (or, for a general request, broadcasts it) so they know there's local demand.</p>

                  <h3>How do neighborhoods work?</h3>
                  <p>Every neighborhood in the search is a real, named subdivision in Wake County, NC — not a made-up region. Businesses choose which neighborhoods they want to offer a deal in, and deals only show up for residents of those neighborhoods.</p>

                  <h3>What are Connections?</h3>
                  <p>Share your connection code with actual neighbors so you can see each other's names (instead of "Neighbor") when you both join the same deal, and see who among your connections has already signed up.</p>
                </>
              }
              onBack={() => setView('home')}
            />
          ) : view === 'contact' ? (
            <StaticPage
              title="Contact us"
              content={
                <>
                  <p>This is a local demo build of BetterByTheBlock — there's no live support team behind it yet. If this were a production product, this page would list a real support email and response-time expectations.</p>
                  <p>For now, any account issues can be resolved by clearing this browser's local storage and signing up again, since all data lives only in this browser.</p>
                </>
              }
              onBack={() => setView('home')}
            />
          ) : view === 'terms' ? (
            <StaticPage
              title="Terms & Conditions"
              content={
                <>
                  <p><em>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</em></p>

                  <h3>What BetterByTheBlock is</h3>
                  <p>BetterByTheBlock is a Wake County, NC platform that shows neighborhood bulk-pricing deals from local home service businesses and lets residents request deals from businesses. By using this site, you agree to these terms.</p>

                  <h3>No payments happen on this site</h3>
                  <p>BetterByTheBlock does not process payments. "Joining" a deal or "requesting" a deal does not charge you anything and is not a contract with the business. Any actual service, scheduling, and payment happens directly between you and the business, entirely off this platform.</p>

                  <h3>Deals from businesses not yet on the platform</h3>
                  <p>Many businesses shown on this site are real, independently-operated Wake County businesses we've identified as likely to offer the listed category of service — they have not yet joined BetterByTheBlock or agreed to any specific deal shown. These are marked "Not yet a confirmed partner," and the pricing shown for them is a proposal, not a rate the business has committed to. Requesting one of these deals sends the business a signal of real neighborhood demand; it does not create any obligation on their part.</p>

                  <h3>Accounts</h3>
                  <p>A BetterByTheBlock profile is stored only in your browser's local storage — there is no password and no server-side account. Clearing your browser data, or switching browsers or devices, will lose your profile and history with no way to recover it.</p>

                  <h3>Acceptable use</h3>
                  <p>Don't submit false, abusive, or spam requests; don't attempt to interfere with the site's operation or scrape it at scale; don't misrepresent who you are when contacting a business through this site.</p>

                  <h3>No warranty</h3>
                  <p>This site is provided "as is." We don't guarantee that any listed business will respond to a request, that pricing shown will be honored, or that the service is uninterrupted or error-free. We aren't a party to, and aren't responsible for, any agreement you reach with a business.</p>

                  <h3>Changes</h3>
                  <p>We may update these terms as the site evolves. Continuing to use the site after a change means you accept the updated terms.</p>

                  <h3>Contact</h3>
                  <p>Questions about these terms can be sent through the <button type="button" onClick={() => setView('contact')} className="text-primary hover:underline font-medium">Contact us</button> page.</p>
                </>
              }
              onBack={() => setView('home')}
            />
          ) : view === 'privacy' ? (
            <StaticPage
              title="Privacy Policy"
              content={
                <>
                  <p><em>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</em></p>

                  <h3>What we store, and where</h3>
                  <p>Your BetterByTheBlock profile (name, email, neighborhood, and activity like joined or wishlisted deals) is stored only in your own browser's local storage. It is never sent to our servers just by browsing the site, and we can't see it. Clearing your browser data deletes it permanently — we have no copy and no way to recover it.</p>

                  <h3>What actually gets sent to us</h3>
                  <p>When you submit a "Request a Deal" form (a general request or one aimed at a specific business), the service name, your description, your display name, and your neighborhood/city are sent to our server and stored so we can see real demand and reach out to businesses. This is the only visitor data that leaves your browser during normal use.</p>
                  <p>If you use the AI deal-request assistant, the text you type and the business's name are sent to Google's Gemini API to generate a draft message. That's a direct request to Google's API from our server — we don't separately store what you typed for this feature.</p>

                  <h3>Business data</h3>
                  <p>Business names, categories, addresses, phone numbers, descriptions, and ratings shown on this site come from each business's own public listing information (via a third-party business-data API), not from anything a visitor submits. Photos shown are real stock photography, not photos of the specific business's actual work.</p>

                  <h3>Cookies and tracking</h3>
                  <p>Your profile and preferences use local storage, not cookies, and that always happens (it's how the site remembers you between visits). Separately, we use Google Tag Manager to understand how the site's being used — that only loads if you accept it in the notice shown on your first visit; declining keeps it off for that browser. We don't run advertising trackers. Our hosting provider may also log standard technical request information (like IP address and browser type) as part of normal web server operation.</p>

                  <h3>No payment data</h3>
                  <p>We don't process payments and never collect card or bank information.</p>

                  <h3>Your choices</h3>
                  <p>Clear your browser's local storage at any time to remove your profile. To have a submitted deal request removed from our records, reach out via the <button type="button" onClick={() => setView('contact')} className="text-primary hover:underline font-medium">Contact us</button> page.</p>

                  <h3>Changes</h3>
                  <p>We may update this policy as the site evolves; the date above reflects the most recent change.</p>
                </>
              }
              onBack={() => setView('home')}
            />
          ) : view === 'not-found' ? (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center">
              <p className="text-primary font-bold text-lg mb-2">404</p>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Page not found</h1>
              <p className="text-gray-600 mb-8">The page you're looking for doesn't exist or may have moved.</p>
              <Button onClick={() => setView('home')}>Back to Home</Button>
            </div>
          ) : view === 'neighborhood' && selectedNeighborhoodPageId ? (
            <NeighborhoodPage
              neighborhoodId={selectedNeighborhoodPageId}
              neighborhoods={neighborhoods}
              services={services}
              businesses={businesses}
              currentUser={currentUser}
              users={users}
              onSignUp={handleSignUp}
              onBusinessClick={handleBusinessClick}
              onServiceClick={handleServiceClick}
              onToggleWishlist={handleToggleWishlist}
              onUpdateUser={updateCurrentUser}
              onBack={() => setView('home')}
            />
          ) : null}
        </div>

        {/* Popular cost guides (full width background) */}
        {view === 'home' && (
          <section className="bg-green-50/50 px-4 sm:px-6 py-16 border-t border-green-100">
            <div className="max-w-[95%] mx-auto">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Popular cost guides</h2>
                  <p className="text-gray-600">From average costs to expert advice, get all the answers you need to get your job done.</p>
                </div>
                <Button onClick={() => setView('articles')} variant="outline" className="hidden sm:block bg-white border-gray-300 text-gray-800 hover:bg-gray-50">See all articles</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {COST_GUIDES.slice(0, 3).map(guide => (
                  <div 
                    key={guide.title} 
                    onClick={() => handleBlogClick(guide)}
                    className="group cursor-pointer"
                  >
                    <div className="rounded-xl overflow-hidden mb-4 aspect-[3/2]">
                      <img src={guide.image} alt={guide.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                    </div>
                    <div className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-2">
                      {guide.author} • {guide.date}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-2">{guide.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-3">{guide.description}</p>
                  </div>
                ))}
              </div>
              <Button onClick={() => setView('articles')} variant="outline" className="w-full mt-8 sm:hidden bg-white border-gray-300 text-gray-800 hover:bg-gray-50">See all articles</Button>
            </div>
          </section>
        )}
        </React.Suspense>
      </main>
      <Footer onNavigate={(page) => setView(page as any)} />
      <CookieConsentBanner onViewPrivacyPolicy={() => setView('privacy')} />
      <RequestServiceModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        businessName={requestModalBusinessId ? businesses.find(b => b.id === requestModalBusinessId)?.name : undefined}
        initialServiceName={requestModalPrefill}
        onSubmit={handleRequestSubmit}
      />
    </div>
  );
};

export default App;
