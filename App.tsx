
import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Mail, MapPin, Heart, Grid as GridIcon, Star, Search, Users, BadgePercent,
  Brush, Sparkles, DoorOpen, Zap, Fence, Droplets, Wrench, Shield, Home, Fan,
  Sofa, Trees, Leaf, Truck, Paintbrush, Bug, Droplet, Waves, Wind, Warehouse,
  Sun, TreePine, AppWindow, LucideIcon, SlidersHorizontal, CheckCircle
} from 'lucide-react';
import { User, Service, Business, UserType, DealRequest, Review, Notification, NotificationType, BillingTransaction } from './types';
import { DEFAULT_CATEGORY_IMAGE } from './services/categoryImages';
import { USERS, REVIEWS, CATEGORY_GROUPS, WAKE_COUNTY_CITIES, STARTING_BUSINESS_BALANCE } from './constants';
import { buildCategorySlugMap, buildCitySlugMap, slugify } from './services/seo/slugify.js';
import {
  businessPath,
  servicePath,
  neighborhoodPath,
  categoryPath,
  categoryCityPath,
  parseBusinessSlugFromPath,
  parseServiceSlugFromPath,
  getBusinessPageContent,
  getServicePageContent,
  getNeighborhoodPageContent,
  getCategoryPageContent,
  buildBreadcrumbJsonLd,
} from './services/seo/pageContent.js';
import Link from './components/Link';
import { loadSeedData } from './services/seedData';
import Header from './components/Header';
import ServiceCard from './components/ServiceCard';
import AIDealFinder from './components/AIDealFinder';
import BusinessProfile from './components/BusinessProfile';
import BusinessDirectory from './components/BusinessDirectory';
import ServiceProfile from './components/ServiceProfile';
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
import { findNearestNeighborhood, searchNeighborhoods } from './services/neighborhoods';
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
    blurb: 'Occasional freezes and ice storms put a strain on heating systems and pipes - these are the services Wake County neighbors need most right now.',
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
    blurb: "Triple-digit heat index days keep AC units running nonstop and bring out mosquitoes - here's what neighbors are booking right now.",
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

// Real, fresh Pexels photos (see scripts/data/fetch-images.mjs for the
// pattern) chosen so no article image repeats a deal/business card image
// elsewhere on the site. Titles target real search phrasing homeowners
// actually use ("how much does X cost in [city], NC") for the categories
// this site actually lists, instead of generic seasonal filler.
// Real ranges pulled from current industry pricing data (Angi, HomeGuide,
// LawnStarter, HouseCallPro, and Raleigh-specific sources - see the research
// behind this rewrite), not invented numbers. Framed as a 2027 outlook since
// that's the planning horizon homeowners are actually budgeting against
// right now, with the underlying data grounded in 2026 pricing trends.
const COST_GUIDES = [
  {
    slug: 'hvac-costs-wake-county-2027',
    title: 'HVAC Costs in Wake County for 2027: Repairs, Tune-Ups, and Full Replacements',
    description: 'A full breakdown of what heating and cooling work actually costs in Raleigh, Cary, and the rest of Wake County heading into 2027, from a basic tune-up to a full system swap.',
    author: 'BetterBuyTheBlock Team',
    date: 'SEP 5, 2026',
    image: 'https://images.pexels.com/photos/8092387/pexels-photo-8092387.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    type: 'Cost Guide',
    category: 'HVAC Maintenance',
    intro: [
      "If you own a home in Wake County, your HVAC system is one of the hardest working pieces of equipment you own. Long, humid summers and short, mild winters mean the compressor rarely gets a real break, and that adds up over the life of the system. Heading into 2027, homeowners here are budgeting for everything from a routine spring tune-up to a full replacement, and the price range between those two ends is enormous. This guide breaks down what you should actually expect to pay, service by service, based on current industry pricing data and local Raleigh area numbers.",
      "We're going to walk through diagnostic and service call fees, common repairs, full system replacement, and what specifically pushes Wake County pricing above or below the national average. None of these numbers are exact quotes for your home. Your final price depends on your specific equipment, ductwork condition, and how easy your unit is to access. Think of this as a realistic planning range so you're not caught off guard when a contractor calls back with an estimate.",
    ],
    sections: [
      {
        heading: 'Service Calls and Diagnostics',
        paragraphs: [
          "Before any repair happens, most companies charge a service call or diagnostic fee just to send a technician out and figure out what's wrong. Nationally, that runs about $70 to $200, and it climbs toward the higher end for nights, weekends, or true emergency response. Some companies waive this fee if you move forward with the repair, so it's worth asking upfront.",
          "This fee covers the technician's time to inspect your system, check refrigerant levels, test electrical connections, and identify the actual problem. It's a small number compared to what comes next, but it's the gatekeeper cost that determines whether you're looking at a $200 fix or a $3,000 one.",
        ],
        bullets: [
          'Standard service call: $70 to $200',
          'Nights, weekends, or emergency response: higher end of that range',
          'Some companies waive the fee if you book the repair',
        ],
      },
      {
        heading: 'Common HVAC Repairs',
        paragraphs: [
          "Once a technician identifies the issue, repair costs vary wildly depending on what actually broke. Most homeowners end up paying somewhere between $250 and $900 for a single repair visit, with an average around $450 to $650. On the lower end, things like fixing a refrigerant leak, adding insulation to exposed lines, or replacing a damaged vent typically run $200 to $700.",
          "On the higher end, if a technician finds a failing compressor, a damaged coil, or a cracked heat exchanger, you're looking at $1,000 to $3,000 or more, since those are core components that require significant labor and parts cost to replace. A simple drain line cleaning or minor electrical fix can sometimes come in under $250, which is the best case scenario for a repair call.",
        ],
        bullets: [
          'Typical single repair visit: $250 to $900 (average $450 to $650)',
          'Minor fix (leak, insulation, vent): $200 to $700',
          'Major component (compressor, coil, heat exchanger): $1,000 to $3,000+',
          'Simple drain line or electrical fix: under $250',
        ],
        linkLabel: 'See real HVAC deals in your neighborhood',
        linkCategory: 'HVAC Maintenance',
      },
      {
        heading: 'Full System Replacement',
        paragraphs: [
          "When a system is old enough or damaged enough that repair no longer makes sense, full replacement is the next step. Nationally, a complete HVAC replacement, including central air conditioning, furnace, or heat pump plus labor, runs $11,590 to $14,100 on average as of recent 2026 data, with installations more broadly ranging from $5,000 to $12,500 depending on equipment tier and job complexity.",
          "Broken down by component, a central AC unit alone typically costs $3,500 to $7,500 installed, a gas furnace runs $3,000 to $6,500, and a heat pump system (increasingly popular in this climate since it handles both heating and cooling) lands around $4,000 to $8,000.",
          "Locally, Raleigh homeowners tend to land a bit below the national average. Recent data puts average HVAC replacement in Raleigh at around $7,365, with most projects falling between $4,910 and $12,275. Installer labor in the Raleigh-Durham area averages roughly $27 to $28 per hour, which is moderate compared to Northeast or West Coast markets, and permit costs through the county typically run $90 to $150.",
        ],
        bullets: [
          'Full replacement, national average: $11,590 to $14,100',
          'Central AC unit installed: $3,500 to $7,500',
          'Gas furnace installed: $3,000 to $6,500',
          'Heat pump system installed: $4,000 to $8,000',
          'Raleigh area average: about $7,365 ($4,910 to $12,275 typical range)',
        ],
      },
      {
        heading: 'What Actually Drives Your Price',
        paragraphs: [
          "A few factors matter more than anything else. Ductwork condition is the big one. If your existing ducts are in good shape and the new system can drop into the same footprint, you'll pay far less than a job that requires new ducting, electrical upgrades, or ventilation changes. System size relative to your square footage matters too. An undersized or oversized unit will cost you in comfort and efficiency even if the upfront price looks good.",
          "Efficiency rating (SEER for cooling, AFUE for heating) is worth asking about directly. A higher efficiency unit costs more upfront but uses less energy over its lifespan, and in a climate that runs the AC as hard as Wake County does, that payback period is usually faster here than in milder regions. Always get two or three written quotes before committing to a full replacement. The spread between contractors on the exact same job can be surprisingly wide.",
        ],
        bullets: [
          'Ductwork condition (existing vs. new ducting needed)',
          'System size relative to your square footage',
          'Efficiency rating (SEER for cooling, AFUE for heating)',
          'Number of quotes you actually get before committing',
        ],
      },
    ],
    closing: [
      "The biggest lever homeowners actually have control over is timing and bundling. HVAC companies routing a technician through a subdivision for one tune-up can often add several more homes on the same visit for a fraction of the cost of a standalone appointment. If you know a few neighbors are also overdue for service, coordinating a shared request is one of the more effective ways to bring your real cost down without cutting corners on the work itself.",
    ],
  },
  {
    slug: 'roofing-costs-wake-county-2027',
    title: 'Roofing Costs in Wake County for 2027: Repair vs. Replacement Pricing',
    description: 'What roof repair and full replacement actually cost heading into 2027, broken down by material, and what makes Raleigh area pricing different from the national average.',
    author: 'BetterBuyTheBlock Team',
    date: 'SEP 5, 2026',
    image: 'https://images.pexels.com/photos/12700530/pexels-photo-12700530.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    type: 'Cost Guide',
    category: 'Roofing',
    intro: [
      "A roof is one of the largest single expenses most homeowners will ever face, and it's also one of the hardest to budget for accurately, since pricing swings so much based on material, roof size, pitch, and where you live. Heading into 2027, we pulled together current national and Wake County specific pricing data to give homeowners in Raleigh, Cary, Apex, and the surrounding area a realistic sense of what to expect, whether you're dealing with a small leak or planning a full tear off and replacement.",
      "This guide covers repair costs, full replacement costs, and how pricing changes by roofing material, plus what's actually different about the Wake County market compared to national averages.",
    ],
    sections: [
      {
        heading: 'Roof Repair Costs',
        paragraphs: [
          "For a targeted repair rather than a full replacement, the national average cost lands around $1,150, with most homeowners paying somewhere between $400 and $1,900 depending on how extensive the damage is. On a per square foot basis, asphalt shingle repairs typically run $4 to $8 installed, which covers things like replacing damaged shingles, patching flashing around a chimney or vent, or sealing a small leak before it spreads.",
          "The final number depends heavily on how accessible the damaged area is and whether the underlying decking needs to be repaired as well. A leak that's caught early and only affects the shingle layer is a much smaller job than one that's been dripping into the attic for months.",
        ],
        bullets: [
          'National average repair: about $1,150',
          'Typical repair range: $400 to $1,900',
          'Asphalt shingle repair: $4 to $8 per square foot installed',
        ],
      },
      {
        heading: 'Full Roof Replacement',
        paragraphs: [
          "For a complete replacement, national pricing generally falls in the $4 to $11 per square foot range, and total project costs typically land between $9,000 and $18,000 for a standard asphalt shingle roof on an average sized home, with an overall national average around $9,608. Larger homes, steep pitches, or premium materials can push that number toward $30,000 or more.",
          "In Wake County specifically, a new roof typically costs $9,000 to $15,000 for most homes, which lines up closely with the national range but tends to land on the more affordable end. Local per square foot pricing runs about $3.40 to $5.90, and labor specifically falls in the $200 to $350 range per roofing square (a 100 square foot unit), or roughly $45 to $75 per hour for a crew. Contractor labor overall in the Raleigh area runs about 8% below the national average, which is one reason Wake County pricing tends to sit favorably compared to Northeast or West Coast markets.",
        ],
        bullets: [
          'National price per square foot: $4 to $11',
          'Typical total project: $9,000 to $18,000 (national average $9,608)',
          'Wake County typical total: $9,000 to $15,000',
          'Wake County price per square foot: $3.40 to $5.90',
          'Local labor: $200 to $350 per roofing square, or $45 to $75 per hour',
        ],
        linkLabel: 'See real roofing deals in your neighborhood',
        linkCategory: 'Roofing',
      },
      {
        heading: 'Pricing by Roofing Material',
        paragraphs: [
          "Material choice is the single biggest factor in your final number. Asphalt shingles remain the most common and most affordable option at roughly $3.50 to $5.50 per square foot installed, and they're the default choice for most Wake County homes. Metal roofing, whether standing seam or ribbed panels, runs $8 to $14 per square foot and has grown more popular for homeowners planning to stay in their home long term, since it typically lasts far longer than shingles.",
          "Concrete or clay tile lands at $10 to $18 per square foot and is less common in this region but shows up on some architectural styles. Flat or TPO membrane roofing, typically used on additions or specific home styles, runs $4 to $7 per square foot. Slate is the premium option at $15 to $30 or more per square foot, and it's rare to see on a standard residential home in this area given the cost.",
        ],
        bullets: [
          'Asphalt shingles: $3.50 to $5.50 per sq ft',
          'Metal (standing seam or ribbed): $8 to $14 per sq ft',
          'Concrete or clay tile: $10 to $18 per sq ft',
          'Flat or TPO membrane: $4 to $7 per sq ft',
          'Slate: $15 to $30+ per sq ft',
        ],
      },
    ],
    closing: [
      "If you're planning roof work for 2027, the best move is to get a written quote before storm season rather than after, when demand and pricing both spike. Roofing crews already scheduled to work on one home in a neighborhood can frequently extend a better rate to nearby homes needing similar work in the same visit, so it's worth checking whether neighbors are facing the same aging roof or storm damage before booking separately.",
    ],
  },
  {
    slug: 'lawn-care-landscaping-costs-wake-county-2027',
    title: 'Lawn Care and Landscaping Costs in Wake County for 2027',
    description: 'Real 2027 pricing for weekly mowing, mulching, aeration, and larger landscape projects across Raleigh and Wake County, and how to budget for the full growing season.',
    author: 'BetterBuyTheBlock Team',
    date: 'SEP 5, 2026',
    image: 'https://images.pexels.com/photos/8288954/pexels-photo-8288954.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    type: 'Cost Guide',
    category: 'Lawn Service',
    intro: [
      "Wake County's long growing season means lawn care isn't a one-time expense, it's a recurring line item that runs from early spring through late fall. Heading into 2027, homeowners are budgeting for everything from a simple weekly mow to full landscape design projects, and the price range across those services is wide. This guide walks through what each piece typically costs based on current pricing data, so you can build a realistic annual budget instead of guessing.",
      "We'll cover mowing, mulching and bed work, aeration and overseeding, and larger landscape design projects, plus what a full season of maintenance tends to add up to for a typical Wake County yard.",
    ],
    sections: [
      {
        heading: 'Weekly Mowing',
        paragraphs: [
          "Professional mowing typically runs $29 to $65 per hour, or more commonly $43 to $69 per visit for a standard residential lot, including trimming and blowing off walkways. Total per-visit costs can range from $42 to $454 depending heavily on lawn size, with most Wake County homes falling toward the lower to middle end of that range on a standard suburban lot.",
          "A standing weekly or biweekly plan through the growing season is almost always cheaper per visit than calling for one-off mows, since the crew can route your home into an existing schedule rather than making a special trip.",
        ],
        bullets: [
          'Typical rate: $29 to $65 per hour, or $43 to $69 per visit',
          'Total per-visit range: $42 to $454 depending on lot size',
        ],
      },
      {
        heading: 'Mulching and Bed Work',
        paragraphs: [
          "If you're buying mulch yourself, expect to pay roughly $2 to $5.50 per bag, or $17 to $68 per cubic yard for bulk material. Hiring it out professionally runs about $43 to $98 per hour, or $20 to $45 per cubic yard for labor alone, with full installed pricing (material, delivery, and labor together) sometimes landing meaningfully higher depending on the mulch type and how many beds need refreshing.",
          "Spring is the most common time to refresh mulch beds in this region, both for curb appeal and to help beds retain moisture heading into the hot summer months.",
        ],
        bullets: [
          'DIY mulch: $2 to $5.50 per bag, or $17 to $68 per cubic yard',
          'Professional labor: $43 to $98 per hour, or $20 to $45 per cubic yard',
        ],
      },
      {
        heading: 'Aeration and Overseeding',
        paragraphs: [
          "Core aeration typically costs between $43 and $496 depending on lawn size and equipment used, with a national average closer to $154, and a more typical range of $107 to $202 for a standard residential lot. This is usually a once or twice a year service, and in this region it's best timed for early fall, when cooler soil temperatures give grass the best chance to recover and thicken up before winter.",
          "Overseeding is frequently bundled with aeration, since freshly aerated soil gives new seed the best chance to take root. Doing both together in the same visit is typically more cost effective than scheduling them separately.",
        ],
        bullets: [
          'Typical range: $43 to $496',
          'National average: about $154 ($107 to $202 typical)',
        ],
        linkLabel: 'See real lawn care deals in your neighborhood',
        linkCategory: 'Lawn Service',
      },
      {
        heading: 'Larger Landscape Design Projects',
        paragraphs: [
          "For homeowners planning bigger changes, like a full yard redesign, new planting beds, or hardscape additions, pricing shifts significantly. In Wake County specifically, working with a landscape designer on a project typically runs $1,197 to $10,144, depending heavily on the scope, from a single bed redesign to a full front and back yard overhaul.",
          "These larger projects are worth getting multiple quotes for, since the range between contractors on the same scope of work can be substantial, and design fees are sometimes handled separately from installation cost.",
        ],
        bullets: [
          'Wake County landscape design projects: $1,197 to $10,144',
        ],
        linkLabel: 'See real landscaping deals in your neighborhood',
        linkCategory: 'Landscaping',
      },
    ],
    closing: [
      "Adding it all up, many Wake County homeowners spend somewhere between $1,000 and $2,400 or more per year on recurring lawn maintenance alone, before factoring in mulch refreshes or larger projects. Because most homes on a given street need roughly the same seasonal work, lawn and landscaping is one of the easiest categories to bundle with neighbors. A crew already routed through your subdivision can usually add nearby yards to the same trip for a noticeably better group rate than everyone booking separately.",
    ],
  },
  {
    slug: 'house-cleaning-costs-wake-county-2027',
    title: 'House Cleaning Costs in Wake County for 2027: Standard, Deep, and Move-Out Pricing',
    description: 'What a standard clean, a first-time deep clean, and a move-out cleaning actually cost in Raleigh and Wake County heading into 2027, and how recurring service changes the math.',
    author: 'BetterBuyTheBlock Team',
    date: 'SEP 8, 2026',
    image: 'https://images.pexels.com/photos/28542161/pexels-photo-28542161.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    type: 'Cost Guide',
    category: 'House Cleaning',
    intro: [
      "House cleaning is one of those services almost every homeowner budgets for eventually, but the pricing is a lot less standardized than people expect. A one-time deep clean before a holiday, a recurring biweekly visit, and a move-out clean for a lease turnover are three completely different jobs with three different price tags, and Wake County pricing has its own local range on top of that. Heading into 2027, this guide breaks down what you should actually expect to pay for each type of cleaning in Raleigh, Cary, and the surrounding area.",
      "We'll walk through standard cleaning, deep cleaning, move-in and move-out cleaning, and the factors that push your specific price up or down, based on current national pricing data and Raleigh area numbers.",
    ],
    sections: [
      {
        heading: 'Standard Cleaning',
        paragraphs: [
          "A standard cleaning, dusting, vacuuming, mopping, kitchen and bathroom wipe-downs, typically costs $120 to $280 per visit nationally, with an average around $176. In the Raleigh-Durham-Cary area specifically, a one-time standard clean of an average 2,000 square foot home tends to run $180 to $336, while hiring a professional cleaner more broadly in Raleigh averages about $153, with most homeowners paying between $120 and $213.",
          "Hourly rates in Raleigh run on the lower end of the national range, averaging around $20.63 per hour for independent cleaners, though agency-booked cleaners typically charge $25 to $50 per hour depending on team size and included services. Most companies price per visit rather than strictly by the hour once they've seen your home.",
        ],
        bullets: [
          'National average per visit: $120 to $280 (average $176)',
          'Raleigh-Durham-Cary, 2,000 sq ft home: $180 to $336',
          'Raleigh professional cleaner average: $153 ($120 to $213 typical)',
          'Raleigh hourly rate: about $20.63/hr independent, $25 to $50/hr through an agency',
        ],
        linkLabel: 'See real house cleaning deals in your neighborhood',
        linkCategory: 'House Cleaning',
      },
      {
        heading: 'Deep Cleaning',
        paragraphs: [
          "A deep clean goes well beyond the standard checklist, covering baseboards, inside appliances, window sills, grout, and other spots that don't get touched on a routine visit. Nationally, deep cleaning runs 50% to 100% more than a standard clean, typically landing between $180 and $400 per visit, though some heavily built-up homes report $500 or more.",
          "Locally, an intensive first-time deep clean in the Raleigh area typically scales between $300 and $540. This is the service most homeowners book once before switching to a recurring standard cleaning schedule, since it resets the home to a baseline that's much easier and cheaper to maintain going forward.",
        ],
        bullets: [
          'National deep clean range: $180 to $400 (50% to 100% more than standard)',
          'Heavy buildup or first-time deep clean: $500+',
          'Raleigh area first-time deep clean: $300 to $540',
        ],
      },
      {
        heading: 'Move-In and Move-Out Cleaning',
        paragraphs: [
          "Move-out cleaning is priced closer to a deep clean, since an empty home gets a full top-to-bottom treatment, inside cabinets, closets, appliances, and every surface, ahead of a new tenant or buyer walkthrough. Nationally, this runs $250 to $600, with an average around $360, though a studio or one-bedroom apartment can come in as low as $75 to $150 while a 3,000+ square foot house can run $350 to $600 or more.",
          "In the Raleigh area, professional move-out cleaning for a standard family-sized property typically falls between $300 and $500. Expect add-on pricing of roughly $30 to $70 per bedroom and $10 to $40 per bathroom on top of a base rate if your cleaner prices by room count rather than flat rate.",
        ],
        bullets: [
          'National average: $360 ($250 to $600 typical range)',
          'Studio or 1BR apartment: $75 to $150',
          '3,000+ sq ft house: $350 to $600+',
          'Raleigh area, standard family home: $300 to $500',
          'Per-room add-ons: $30 to $70 per bedroom, $10 to $40 per bathroom',
        ],
      },
      {
        heading: 'What Actually Drives Your Price',
        paragraphs: [
          "Home size and bedroom or bathroom count are the biggest factors, since most companies scale pricing off square footage or room count once past a base rate. How long it's been since the last real cleaning matters just as much. A home on a strict biweekly schedule needs far less time per visit than one being cleaned for the first time in months, which is why standard and deep cleaning are priced so differently.",
          "Recurring service is the other lever worth knowing about. Weekly and biweekly cleaning plans are consistently cheaper per visit than booking one-off appointments, since the cleaner can route your home into a fixed schedule instead of treating every visit as a new estimate. Add-ons like inside the fridge, inside the oven, interior windows, or laundry are usually priced separately, so it's worth confirming exactly what's included before comparing quotes.",
        ],
        bullets: [
          'Home size and bedroom/bathroom count set the base price',
          'Time since last real cleaning (recurring vs. first-time)',
          'Recurring weekly or biweekly plans price lower per visit',
          'Add-ons (fridge, oven, interior windows, laundry) usually cost extra',
        ],
      },
    ],
    closing: [
      "Because most homes on a street need the exact same recurring service, cleaning is one of the easiest categories to bundle with neighbors for a better rate. A team already scheduled to clean one home on your street can typically add a few more houses to the same day at a meaningfully lower per-visit price than everyone booking separately, especially for standing weekly or biweekly plans.",
    ],
  },
  {
    slug: 'pest-control-costs-wake-county-2027',
    title: 'Pest Control Costs in Wake County for 2027: Quarterly Plans, Termite Treatment, and Mosquito Control',
    description: "What quarterly pest prevention, termite treatment, and mosquito control actually cost in Raleigh and Wake County heading into 2027, and why this region's climate makes pest pressure higher than most.",
    author: 'BetterBuyTheBlock Team',
    date: 'SEP 8, 2026',
    image: 'https://images.pexels.com/photos/20296321/pexels-photo-20296321.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    type: 'Cost Guide',
    category: 'Pest Control',
    intro: [
      "Wake County's warm, humid climate and clay-heavy soil make it one of the higher pest-pressure regions in the country, especially for termites. Heading into 2027, homeowners here are budgeting for everything from a standard quarterly pest plan to a full termite treatment, and the price range across those services is enormous, from under $50 a month to several thousand dollars for termite work. This guide breaks down what each type of pest service actually costs in the Raleigh area, based on current local and national pricing data.",
      "We'll cover standard pest control plans, termite inspection and treatment, mosquito control, and what specifically drives your price up or down in this climate.",
    ],
    sections: [
      {
        heading: 'Standard Pest Control',
        paragraphs: [
          "A one-time general pest control visit in the Raleigh area typically runs $95 to $575, with most homeowners paying around $170 for a standard interior and exterior treatment. Most companies push customers toward an ongoing plan instead of a single visit, since recurring service keeps pest pressure from building back up between treatments.",
          "Quarterly plans, the most common option, run about $99 to $200 per visit in the Raleigh market, while monthly plans (more common for homes with heavier pest pressure, like properties backing up to woods or water) run $40 to $65 per visit. Most quarterly plans include unlimited free re-treatments between visits if pests show up again.",
        ],
        bullets: [
          'One-time visit: $95 to $575 (typical $170 for interior + exterior)',
          'Quarterly plan: $99 to $200 per visit',
          'Monthly plan: $40 to $65 per visit',
        ],
        linkLabel: 'See real pest control deals in your neighborhood',
        linkCategory: 'Pest Control',
      },
      {
        heading: 'Termite Inspection and Treatment',
        paragraphs: [
          "A standalone termite inspection with a written report, commonly requested before closing on a home, typically costs $75 to $325 in the Raleigh area, with most homeowners paying closer to $100 to $135. Many pest companies will do this for free or a nominal fee if you sign up for ongoing service, so it's worth asking before you pay full price for an inspection alone.",
          "Actual termite treatment is a much bigger expense. In the Raleigh area, treatment for an active infestation runs $1,080 to $3,150, averaging around $1,800. Liquid barrier treatments (trenching and treating the soil around your foundation) run $270 to $810, while bait station systems, which use monitoring stations placed around the property, cost $720 to $1,350 to install plus ongoing annual monitoring. After initial treatment, an annual termite bond, covering yearly inspections and re-treatment if termites come back, typically costs $225 to $450 per year.",
        ],
        bullets: [
          'Termite inspection alone: $75 to $325 (typical $100 to $135)',
          'Full termite treatment: $1,080 to $3,150 (average $1,800)',
          'Liquid barrier treatment: $270 to $810',
          'Bait station system: $720 to $1,350 installed, plus annual monitoring',
          'Annual termite bond: $225 to $450 per year',
        ],
      },
      {
        heading: 'Mosquito and Seasonal Pest Control',
        paragraphs: [
          "Mosquito barrier spray treatments, which target standing water and vegetation where mosquitoes breed, typically run $100 to $165 per visit, with Southeast regional pricing (accounting for our longer mosquito season) landing around $70 to $150. Most companies recommend treatment every 3 to 4 weeks through the warm months for it to stay effective, since the barrier breaks down with rain and new growth.",
          "Other seasonal pests worth planning for in this region include fire ants, which are common in Wake County lawns, and stink bugs and lady beetles, which tend to move indoors as the weather cools each fall. Most quarterly pest plans already cover general seasonal pests like these as part of the standard service.",
        ],
        bullets: [
          'Mosquito barrier spray: $100 to $165 per visit ($70 to $150 typical Southeast pricing)',
          'Recommended frequency: every 3 to 4 weeks through mosquito season',
          'Seasonal pests (fire ants, stink bugs, lady beetles) typically covered under a standard quarterly plan',
        ],
      },
      {
        heading: 'What Actually Drives Your Price',
        paragraphs: [
          "Home size is the most obvious factor, since larger homes take longer to treat and use more product both inside and around the foundation. Pest type and severity matter just as much: a routine quarterly visit for ants and spiders costs a fraction of what an active termite or bed bug infestation costs to resolve, since infestations require specialized treatment methods and often follow-up visits.",
          "Proximity to woods, water, or crawl spaces also pushes pricing up in this region, since those conditions create more consistent pest pressure and sometimes require additional treatment points. Finally, whether you're booking a one-time visit or signing up for a recurring plan makes a real difference. Ongoing plans typically cost less per visit than one-off treatments, since the company is maintaining a relationship with your home instead of starting from scratch each time.",
        ],
        bullets: [
          'Home size (larger homes take longer and use more product)',
          'Pest type and severity (routine visit vs. active infestation)',
          'Proximity to woods, water, or crawl spaces',
          'One-time visit vs. recurring plan',
        ],
      },
    ],
    closing: [
      "Because termite pressure and general pest issues tend to affect entire neighborhoods rather than isolated homes, especially in older subdivisions or areas near wooded lots, pest control is a strong category for bundling with neighbors. A technician already treating one home on your street can often add several more at a meaningfully better group rate than everyone booking separately, particularly for standing quarterly plans.",
    ],
  },
  {
    slug: 'gutter-cleaning-costs-wake-county-2027',
    title: 'Gutter Cleaning Costs in Wake County for 2027: Cleaning, Repairs, and Gutter Guards',
    description: "What twice-a-year gutter cleaning, common repairs, and gutter guard installation actually cost in Raleigh and Wake County heading into 2027, and why the region's tree coverage changes the math.",
    author: 'BetterBuyTheBlock Team',
    date: 'SEP 10, 2026',
    image: 'https://images.pexels.com/photos/35153375/pexels-photo-35153375.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    type: 'Cost Guide',
    category: 'Gutter Cleaning',
    intro: [
      "Wake County's tree canopy, heavy spring pollen, and summer storms mean gutters fill up faster here than in a lot of the country, and letting them sit clogged is one of the more expensive things a homeowner can put off. Backed-up water is what causes fascia rot, foundation cracking near the drip line, and crawl space or basement moisture down the road. Heading into 2027, homeowners here are budgeting for the twice-a-year cleaning most local contractors recommend, repairs when something actually breaks, and increasingly, gutter guards to cut down on how often the whole thing needs doing at all.",
      "This guide covers standard cleaning costs, common repairs, gutter guard installation, and what pushes your specific price up or down in this climate.",
    ],
    sections: [
      {
        heading: 'Standard Gutter Cleaning',
        paragraphs: [
          "National pricing for a standard cleaning runs $0.95 to $2.25 per linear foot, with most homeowners paying between $119 and $234 total, averaging around $168 for a typical 125 to 200 foot system. Price scales directly with story height: single-story homes run $1.25 to $1.75 per foot, two-story homes run $1.75 to $2.50 per foot, and anything three stories or taller climbs to $2.50 to $3.75 per foot, since ladder work and safety equipment both add time.",
          "Locally, Wake County actually runs a bit cheaper than the national picture. Raleigh homeowners average around $117 per cleaning, with most paying between $89 and $151, and per-foot pricing landing at $0.67 to $1.58. That's the upside of lower regional labor costs, but it comes with a catch: with the amount of mature tree canopy across Raleigh, Cary, and the rest of Wake County, most contractors recommend cleaning twice a year rather than once, typically in late spring after pollen season and again in late fall after leaf drop, so budget for two visits rather than one.",
        ],
        bullets: [
          'National average: $168 per visit ($119 to $234 typical)',
          'Per linear foot, national: $0.95 to $2.25, climbing with story height',
          'Raleigh area average: $117 per visit ($89 to $151 typical)',
          'Raleigh per linear foot: $0.67 to $1.58',
          'Recommended frequency here: twice a year, late spring and late fall',
        ],
        linkLabel: 'See real gutter cleaning deals in your neighborhood',
        linkCategory: 'Gutter Cleaning',
      },
      {
        heading: 'Repairs: Resealing, Reattaching, and Downspouts',
        paragraphs: [
          "Not every gutter problem needs a full replacement. Nationally, gutter repair averages $395, with most jobs falling between $194 and $636 depending on what's actually wrong. The cheapest fixes, resealing a leaky seam or reattaching a section that's pulled away from the fascia, typically run $75 to $150, and are often billed at a handyman's hourly rate of $40 to $80 plus materials rather than a flat project fee.",
          "Downspout issues are their own line item. Repairing a clogged or disconnected downspout usually costs $75 to $180, while a full downspout replacement runs about $8 per linear foot, more on a two-story home where the run is longer and harder to access. Catching a small leak or a loose section early is almost always cheaper than waiting, since standing water at the fascia line is what eventually turns a $100 repair into a full gutter replacement.",
        ],
        bullets: [
          'National average repair: $395 ($194 to $636 typical)',
          'Resealing or reattaching a section: $75 to $150',
          'Downspout repair: $75 to $180',
          'Downspout replacement: about $8 per linear foot, more for two-story homes',
        ],
      },
      {
        heading: 'Gutter Guards',
        paragraphs: [
          "For homeowners tired of paying for cleanings twice a year, gutter guards are the most common upgrade, and Wake County's tree coverage makes them a genuinely reasonable investment rather than an upsell. Installation in the Raleigh area averages $1,048, with most homeowners spending between $863 and $1,973 depending on gutter length and guard type. Per linear foot, pricing runs $8 to $15 for most materials, with premium micro-mesh systems landing at $11 to $13 or more per foot.",
          "Most Raleigh area homes need 150 to 200 linear feet of guards to cover the full system, which is where that total project cost comes from. Guards don't eliminate cleaning entirely, since fine debris and shingle grit still build up over time, but they stretch the interval between professional cleanings significantly and cut down on how much accumulates between visits.",
        ],
        bullets: [
          'Raleigh area installation average: $1,048 ($863 to $1,973 typical)',
          'Per linear foot: $8 to $15, premium micro-mesh $11 to $13+',
          'Typical Raleigh home needs: 150 to 200 linear feet of coverage',
        ],
      },
      {
        heading: 'What Actually Drives Your Price',
        paragraphs: [
          "Story height is the single biggest factor, since two- and three-story homes require more time, more safety equipment, and more careful ladder placement than a one-story ranch. Tree coverage matters almost as much in this region specifically. A home shaded by mature oaks or pines needs more frequent cleanings and heavier debris removal than one on a more open lot, regardless of square footage.",
          "How long it's been since the last cleaning changes the job too. A system that's gone two or three years without attention often has compacted debris, standing water, or even small plants taking root, which takes meaningfully longer to clear than one on a regular six-month schedule. Accessibility, a steep roof pitch, landscaping that blocks ladder placement, a second story over a pool or deck, can also push a quote higher than the base per-foot rate would suggest.",
        ],
        bullets: [
          'Story height (1-story vs. 2-story vs. 3-story)',
          'Tree coverage over the home',
          'Time since last cleaning (compacted debris takes longer to clear)',
          'Accessibility: roof pitch, landscaping, obstacles like a pool or deck below',
        ],
      },
    ],
    closing: [
      "Because tree coverage and storm debris tend to hit an entire street at once rather than a single house, gutter cleaning is one of the easier categories to bundle with neighbors, especially heading into fall cleaning season. A crew already on a ladder at one house can often add two or three more on the same block for a meaningfully better rate than everyone scheduling separately once demand peaks later in the season.",
    ],
  },
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

// Built once at module load (both lists are static, not fetched) — used to
// resolve /category/<slug>[/<city-slug>] URLs synchronously on first render,
// before any data fetch resolves. See services/seo/slugify.js.
const CATEGORY_SLUG_MAP = buildCategorySlugMap(CATEGORY_GROUPS);
const CITY_SLUG_MAP = buildCitySlugMap(WAKE_COUNTY_CITIES);

// Shared by both the legacy `category` view's categoryPageServices and the
// real /category/<slug> pages' categoryPageFilteredServices below, so the
// sort options behave identically in both places.
function sortServicesByMode(list: Service[], sortBy: string): Service[] {
  const results = [...list];
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
    case 'closest_to_unlocking':
      results.sort((a, b) => (b.currentSignups / b.requiredSignups) - (a.currentSignups / a.requiredSignups));
      break;
    default:
      break;
  }
  return results;
}

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>(() => loadState<User[]>('users', USERS));
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => loadState<string | null>('currentUserId', null));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [postLoginIntent, setPostLoginIntent] = useState<'business' | null>(null);
  // A signed-out visitor clicking the wishlist heart gets prompted to sign
  // in/up first (see handleToggleWishlist below); this remembers which
  // service they were trying to wishlist so it applies automatically once
  // they finish, instead of silently discarding the click's intent.
  const [pendingWishlistServiceId, setPendingWishlistServiceId] = useState<string | null>(null);
  // Same pattern as pendingWishlistServiceId, for joining/requesting a
  // specific deal (real or prospective — both go through the same one-click
  // join, see performDealJoin). See handleSignUp below for where the sign-in
  // gate lives, and the AuthModal onSignUp/onSignIn callbacks for where this
  // resumes afterward.
  const [pendingSignUpServiceId, setPendingSignUpServiceId] = useState<string | null>(null);
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
  const [view, setView] = useState<'home' | 'results' | 'business' | 'businesses' | 'serviceProfile' | 'category' | 'categoryPage' | 'categoryCityPage' | 'blog' | 'profile' | 'wishlist' | 'articles' | 'how-it-works' | 'pro-signup' | 'pro-resources' | 'success-stories' | 'help' | 'contact' | 'terms' | 'privacy' | 'not-found' | 'settings' | 'connections' | 'my-deals' | 'business-onboarding' | 'business-hub' | 'business-create-deal' | 'business-edit-profile' | 'neighborhood'>(() => {
    const path = window.location.pathname;
    if (path === '/privacy') return 'privacy';
    if (path === '/terms') return 'terms';
    if (path.startsWith('/guides/')) {
      const slug = path.slice('/guides/'.length);
      return COST_GUIDES.some(g => g.slug === slug) ? 'blog' : 'not-found';
    }
    // Business/neighborhood existence isn't verifiable yet (the data fetch
    // hasn't resolved on first render) — accept any well-formed path here and
    // let the render guards below show a brief loading state, then fall back
    // to a real "not found" only once the catalog has actually loaded.
    if (path.startsWith('/business/')) {
      if (!parseBusinessSlugFromPath(path)) return 'not-found';
      return parseServiceSlugFromPath(path) ? 'serviceProfile' : 'business';
    }
    if (path.startsWith('/neighborhood/')) {
      const id = path.slice('/neighborhood/'.length).split('/').filter(Boolean)[0];
      return id ? 'neighborhood' : 'not-found';
    }
    if (path.startsWith('/category/')) {
      const parts = path.slice('/category/'.length).split('/').filter(Boolean);
      if (parts.length === 1 && CATEGORY_SLUG_MAP.has(parts[0])) return 'categoryPage';
      if (parts.length === 2 && CATEGORY_SLUG_MAP.has(parts[0]) && CITY_SLUG_MAP.has(parts[1])) return 'categoryCityPage';
      return 'not-found';
    }
    if (path !== '/') return 'not-found';
    return 'home';
  });
  const [searchResults, setSearchResults] = useState<Service[]>([]);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  // The URL only carries the business's name-slug now (no id), so it can't be
  // resolved to a real id until the business catalog has loaded — see the
  // pendingBusinessSlug effect below, which resolves this once `businesses` arrives.
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [pendingBusinessSlug, setPendingBusinessSlug] = useState<string | null>(() => {
    const path = window.location.pathname;
    return path.startsWith('/business/') ? parseBusinessSlugFromPath(path) : null;
  });
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [pendingServiceSlug, setPendingServiceSlug] = useState<string | null>(() => {
    const path = window.location.pathname;
    return path.startsWith('/business/') ? parseServiceSlugFromPath(path) : null;
  });

  // Resolves a /business/<name-slug>[/<service-slug>] URL to real ids once the
  // catalog has loaded (the URL carries no ids — see services/seo/pageContent.js
  // businessPath/servicePath). Only genuinely 404s once the catalog has
  // actually loaded and nothing matches, so a fresh visit doesn't flash "not
  // found" first. businesses and services always load together (see the
  // loadSeedData effect above), so gating on businesses.length is enough.
  useEffect(() => {
    if (!pendingBusinessSlug || businesses.length === 0) return;
    // Business URLs briefly carried a "--<id>" suffix before being dropped
    // (see services/seo/pageContent.js businessPath history) — anything
    // already indexed/bookmarked under that shape still resolves here, and
    // the pushState effect below then corrects the address bar to the
    // current canonical URL automatically once selectedBusinessId is set.
    const business = businesses.find(b => slugify(b.name) === pendingBusinessSlug)
      || businesses.find(b => pendingBusinessSlug.endsWith(`--${b.id}`));
    if (!business) {
      setView('not-found');
    } else {
      setSelectedBusinessId(business.id);
      if (pendingServiceSlug) {
        const service = services.find(s => s.businessId === business.id && slugify(s.title) === pendingServiceSlug);
        if (service) {
          setSelectedServiceId(service.id);
        } else {
          setView('not-found');
        }
      }
    }
    setPendingBusinessSlug(null);
    setPendingServiceSlug(null);
  }, [pendingBusinessSlug, pendingServiceSlug, businesses, services]);

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryPageCategory, setSelectedCategoryPageCategory] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (!path.startsWith('/category/')) return null;
    const [slug] = path.slice('/category/'.length).split('/').filter(Boolean);
    return (slug && CATEGORY_SLUG_MAP.get(slug)) || null;
  });
  const [selectedCategoryPageCity, setSelectedCategoryPageCity] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (!path.startsWith('/category/')) return null;
    const parts = path.slice('/category/'.length).split('/').filter(Boolean);
    return (parts[1] && CITY_SLUG_MAP.get(parts[1])) || null;
  });
  const [selectedBlog, setSelectedBlog] = useState<typeof COST_GUIDES[0] | null>(() => {
    const path = window.location.pathname;
    if (!path.startsWith('/guides/')) return null;
    const slug = path.slice('/guides/'.length);
    return COST_GUIDES.find(g => g.slug === slug) || null;
  });
  const [selectedNeighborhoodPageId, setSelectedNeighborhoodPageId] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (!path.startsWith('/neighborhood/')) return null;
    return path.slice('/neighborhood/'.length).split('/').filter(Boolean)[0] || null;
  });
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterZip, setNewsletterZip] = useState('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);
  const [sortBy, setSortBy] = useState<string>('recommended');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [categorySortBy, setCategorySortBy] = useState<string>('recommended');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState<boolean>(false);
  const [categoryMinPrice, setCategoryMinPrice] = useState<string>('');
  const [categoryMaxPrice, setCategoryMaxPrice] = useState<string>('');
  // Neighborhood narrowing + sort/price filters on the real /category/<slug>
  // pages (session-independent, unlike the older `category` view above —
  // these just narrow the already-loaded county/city list client-side).
  const [categoryPageNeighborhoodId, setCategoryPageNeighborhoodId] = useState<string | null>(null);
  const [categoryPageNeighborhoodSearch, setCategoryPageNeighborhoodSearch] = useState('');
  const [showCategoryPageNeighborhoodDropdown, setShowCategoryPageNeighborhoodDropdown] = useState(false);
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
    // Show location prompt on first visit. Waits for `neighborhoods` to
    // actually be loaded first — it starts as [] and loads async, and
    // handleShareLocation's success callback closes over whatever value was
    // current when this effect ran. Firing before the fetch resolves meant
    // findNearestNeighborhood always searched an empty list and silently
    // matched nothing, so granting location permission looked like it did
    // nothing.
    if (neighborhoods.length === 0) return;
    // Key is versioned (not the older "hasVisitedBefore") because that older
    // flag got set for visitors who hit a bug where the prompt silently
    // never actually asked — bumping the key lets everyone genuinely get
    // asked once under the fixed logic.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighborhoods.length]);

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

  // Same effect as handleShareLocation, but for a neighborhood picked
  // directly from the inline search/autofill in the hero search bar,
  // instead of one resolved from geolocation coordinates.
  const handleSelectNeighborhood = (neighborhoodId: string) => {
    if (currentUser.type === UserType.BUSINESS) return;
    updateCurrentUser({ ...currentUser, neighborhoodId });
    if (!currentUserId) {
      setCurrentUserId(currentUser.id);
      saveState('currentUserId', currentUser.id);
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
    // For 'business', the canonical path needs the business's name (for the
    // slug), which may not have loaded yet on a fresh visit — fall back to
    // the current pathname (a no-op below) rather than incorrectly bounce to
    // '/' while the catalog fetch is still in flight.
    const businessForPath = view === 'business' && selectedBusinessId ? businesses.find(b => b.id === selectedBusinessId) : null;
    const serviceForPath = view === 'serviceProfile' && selectedServiceId ? services.find(s => s.id === selectedServiceId) : null;
    const serviceBusinessForPath = serviceForPath ? businesses.find(b => b.id === serviceForPath.businessId) : null;
    const path = view === 'privacy' ? '/privacy'
      : view === 'terms' ? '/terms'
      : view === 'blog' && selectedBlog ? `/guides/${selectedBlog.slug}`
      : view === 'business' && selectedBusinessId ? (businessForPath ? businessPath(businessForPath) : window.location.pathname)
      : view === 'serviceProfile' && selectedServiceId ? (serviceForPath && serviceBusinessForPath ? servicePath(serviceBusinessForPath, serviceForPath) : window.location.pathname)
      : view === 'neighborhood' && selectedNeighborhoodPageId ? neighborhoodPath({ id: selectedNeighborhoodPageId })
      : view === 'categoryCityPage' && selectedCategoryPageCategory && selectedCategoryPageCity ? categoryCityPath(selectedCategoryPageCategory, selectedCategoryPageCity)
      : view === 'categoryPage' && selectedCategoryPageCategory ? categoryPath(selectedCategoryPageCategory)
      : '/';
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }, [view, selectedBlog, selectedBusinessId, selectedServiceId, selectedNeighborhoodPageId, selectedCategoryPageCategory, selectedCategoryPageCity, businesses, services]);

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path === '/privacy') setView('privacy');
      else if (path === '/terms') setView('terms');
      else if (path.startsWith('/guides/')) {
        const slug = path.slice('/guides/'.length);
        const guide = COST_GUIDES.find(g => g.slug === slug);
        if (guide) {
          setSelectedBlog(guide);
          setView('blog');
        } else {
          setView('not-found');
        }
      }
      else if (path.startsWith('/business/')) {
        const slug = parseBusinessSlugFromPath(path);
        if (slug) {
          const serviceSlug = parseServiceSlugFromPath(path);
          setSelectedBusinessId(null);
          setSelectedServiceId(null);
          setPendingBusinessSlug(slug);
          setPendingServiceSlug(serviceSlug);
          setView(serviceSlug ? 'serviceProfile' : 'business');
        } else {
          setView('not-found');
        }
      }
      else if (path.startsWith('/neighborhood/')) {
        const id = path.slice('/neighborhood/'.length).split('/').filter(Boolean)[0];
        if (id) {
          setSelectedNeighborhoodPageId(id);
          setView('neighborhood');
        } else {
          setView('not-found');
        }
      }
      else if (path.startsWith('/category/')) {
        const parts = path.slice('/category/'.length).split('/').filter(Boolean);
        const categoryName = parts[0] ? CATEGORY_SLUG_MAP.get(parts[0]) : undefined;
        if (!categoryName) {
          setView('not-found');
        } else if (parts.length === 1) {
          setSelectedCategoryPageCategory(categoryName);
          setSelectedCategoryPageCity(null);
          setView('categoryPage');
        } else {
          const cityName = CITY_SLUG_MAP.get(parts[1]);
          if (!cityName) {
            setView('not-found');
          } else {
            setSelectedCategoryPageCategory(categoryName);
            setSelectedCategoryPageCity(cityName);
            setView('categoryCityPage');
          }
        }
      }
      else if (path === '/') setView('home');
      else setView('not-found');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // SEO: keep <title> and the meta description in sync with what's actually
  // on screen, instead of every view sharing index.html's static tags.
  useEffect(() => {
    const DEFAULT_TITLE = 'BetterBuyTheBlock | Wake County Home Services at Discounted Rates';
    const DEFAULT_DESCRIPTION = 'Get bulk-pricing deals on home services across Wake County, NC. Join with your neighbors to unlock group discounts on cleaning, lawn care, HVAC, and more - free for local businesses to list.';
    const DEFAULT_IMAGE = 'https://betterbuytheblock.com/og-image.jpg';

    let title = DEFAULT_TITLE;
    let description = DEFAULT_DESCRIPTION;
    let image = DEFAULT_IMAGE;
    let canonicalPath = '/';
    let robots = 'index, follow';
    /** @type {Record<string, unknown>[]} */
    let extraJsonLd: Record<string, unknown>[] = [];

    if (view === 'blog' && selectedBlog) {
      title = `${selectedBlog.title} | BetterBuyTheBlock`;
      description = selectedBlog.description;
      image = selectedBlog.image;
      canonicalPath = `/guides/${selectedBlog.slug}`;
    } else if (view === 'privacy') {
      title = `Privacy Policy | BetterBuyTheBlock`;
      description = 'How BetterBuyTheBlock collects, stores, and uses your information.';
      canonicalPath = '/privacy';
    } else if (view === 'terms') {
      title = `Terms & Conditions | BetterBuyTheBlock`;
      description = 'The terms that apply to using BetterBuyTheBlock.';
      canonicalPath = '/terms';
    } else if (view === 'not-found') {
      title = `Page Not Found | BetterBuyTheBlock`;
      description = 'The page you were looking for doesn\'t exist.';
      robots = 'noindex, follow';
    } else if (view === 'results') {
      title = lastSearchQuery ? `${lastSearchQuery} deals in Wake County | BetterBuyTheBlock` : `Search Results | BetterBuyTheBlock`;
      description = `Bulk-pricing home service deals ${lastSearchQuery ? `for ${lastSearchQuery} ` : ''}in your Wake County neighborhood.`;
      robots = 'noindex, follow';
    } else if (view === 'business' && selectedBusinessId) {
      const business = businesses.find(b => b.id === selectedBusinessId);
      if (business) {
        const content = getBusinessPageContent(business, services.filter(s => s.businessId === business.id));
        title = content.title;
        description = content.description;
        canonicalPath = content.path;
        robots = content.robots;
        extraJsonLd = content.jsonLd;
      }
    } else if (view === 'serviceProfile' && selectedServiceId) {
      const service = services.find(s => s.id === selectedServiceId) || searchResults.find(s => s.id === selectedServiceId);
      const business = service ? businesses.find(b => b.id === service.businessId) : null;
      if (service && business) {
        const content = getServicePageContent(business, service);
        title = content.title;
        description = content.description;
        canonicalPath = content.path;
        robots = content.robots;
        extraJsonLd = content.jsonLd;
      } else {
        robots = 'noindex, follow';
      }
    } else if (view === 'neighborhood' && selectedNeighborhoodPageId) {
      const n = neighborhoods.find(nb => nb.id === selectedNeighborhoodPageId);
      if (n) {
        const content = getNeighborhoodPageContent(n, services.filter(s => (s.neighborhoodIds || []).includes(n.id) || (s.servedCities || []).includes(n.city)));
        title = content.title;
        description = content.description;
        canonicalPath = content.path;
        robots = content.robots;
        extraJsonLd = content.jsonLd;
      }
    } else if (view === 'categoryPage' && selectedCategoryPageCategory) {
      const content = getCategoryPageContent(selectedCategoryPageCategory, null, services);
      title = content.title;
      description = content.description;
      canonicalPath = content.path;
      robots = content.robots;
      extraJsonLd = content.jsonLd;
    } else if (view === 'categoryCityPage' && selectedCategoryPageCategory && selectedCategoryPageCity) {
      const content = getCategoryPageContent(selectedCategoryPageCategory, selectedCategoryPageCity, services);
      title = content.title;
      description = content.description;
      canonicalPath = content.path;
      robots = content.robots;
      extraJsonLd = content.jsonLd;
    } else if (view === 'businesses') {
      title = `Local Businesses | BetterBuyTheBlock`;
      description = 'Browse real Wake County home service businesses on BetterBuyTheBlock.';
      robots = 'noindex, follow';
    } else if (view === 'how-it-works') {
      title = `How It Works | BetterBuyTheBlock`;
    } else if (view === 'help') {
      title = `Help Center | BetterBuyTheBlock`;
    } else if (view === 'contact') {
      title = `Contact Us | BetterBuyTheBlock`;
    } else if (view === 'articles') {
      title = `Cost Guides | BetterBuyTheBlock`;
    }

    const canonicalUrl = `https://betterbuytheblock.com${canonicalPath}`;

    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonicalUrl);
    document.querySelector('meta[name="robots"]')?.setAttribute('content', robots);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonicalUrl);
    document.querySelector('meta[property="og:type"]')?.setAttribute('content', view === 'blog' ? 'article' : 'website');
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
    document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', image);

    // Article structured data (schema.org) for cost guides, so search
    // engines can render rich results — only present while a guide is open.
    const existingLd = document.getElementById('article-ld-json');
    if (existingLd) existingLd.remove();
    if (view === 'blog' && selectedBlog) {
      const script = document.createElement('script');
      script.id = 'article-ld-json';
      script.type = 'application/ld+json';
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: selectedBlog.title,
        description: selectedBlog.description,
        image: selectedBlog.image,
        author: { '@type': 'Organization', name: selectedBlog.author },
        publisher: { '@type': 'Organization', name: 'BetterBuyTheBlock' },
        datePublished: (() => {
          const parsed = new Date(selectedBlog.date);
          return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
        })(),
        mainEntityOfPage: canonicalUrl,
      });
      document.head.appendChild(script);
    }

    // Same idea, generalized: business/neighborhood/category(+city) pages can
    // carry more than one JSON-LD block (e.g. LocalBusiness + BreadcrumbList),
    // built by services/seo/pageContent.js — the same functions the build-time
    // prerender script uses, so the crawled and hydrated pages never drift.
    document.querySelectorAll('script[data-seo-jsonld]').forEach(el => el.remove());
    extraJsonLd.forEach((jsonLd, i) => {
      const script = document.createElement('script');
      script.dataset.seoJsonld = String(i);
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedBusinessId, selectedServiceId, selectedNeighborhoodPageId, selectedCategoryPageCategory, selectedCategoryPageCity, lastSearchQuery, selectedBlog, businesses, services, neighborhoods]);

  useEffect(() => {
    if (currentUser.type === UserType.BUSINESS && CONSUMER_ONLY_VIEWS.has(view)) {
      setView('business-hub');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.type, view]);

  // The actual join/request mutation, unconditional on auth state — called
  // once we already know `user` is a real signed-in account, either directly
  // from handleSignUp or resumed from the AuthModal callbacks below once a
  // signed-out visitor finishes signing up/in.
  const performDealJoin = (serviceId: string, user: User) => {
    const service = services.find(s => s.id === serviceId) || searchResults.find(s => s.id === serviceId);
    if (!service || (service.signedUpUserIds || []).includes(user.id)) return;

    // Prospective deals (business hasn't joined the platform yet) use this
    // exact same join — "requesting" one is just a join against a service
    // that happens to be proposed rather than confirmed. No separate
    // free-text request form: the fixed, real service/business/price shown
    // on the page IS the request, so there's nothing for the resident to
    // change or add.
    if (service.closeAfterThreshold && service.currentSignups >= service.requiredSignups) return;

    const newSignedUpUserIds = [...service.signedUpUserIds, user.id];
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

    // Best-effort copy to the server, keyed to this specific deal, so the
    // business can be handed a full lead list (name, email, neighborhood) for
    // everyone who joined — not just an anonymous signup count trapped in
    // each visitor's own browser.
    fetch('/api/deal-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: service.id,
        serviceName: service.title,
        businessId: service.businessId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        neighborhoodId: user.neighborhoodId,
        city: neighborhoods.find(n => n.id === user.neighborhoodId)?.city,
      }),
    }).catch(() => {});

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

  const handleSignUp = (serviceId: string) => {
    // currentUser always falls back to a demo USERS[0] even when signed out
    // (see its definition above), so joining/requesting a deal must gate on
    // real auth state directly — otherwise a signed-out visitor's click
    // silently lands on that shared demo account instead of requiring them
    // to actually sign up, and the "lead" saved for the business would be
    // fake. See the AuthModal's onSignUp/onSignIn below for where
    // pendingSignUpServiceId resumes this once they finish.
    if (!isAuthenticated) {
      setPendingSignUpServiceId(serviceId);
      setPostLoginIntent(null);
      setIsAuthModalOpen(true);
      return;
    }
    performDealJoin(serviceId, currentUser);
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
    // currentUser always falls back to a demo USERS[0] even when signed out,
    // so this must check real auth state directly — otherwise the click
    // silently no-ops onto that shared demo user instead of the visitor's
    // own account. See the AuthModal's onSignUp/onSignIn below for where
    // pendingWishlistServiceId gets applied once they finish signing in.
    if (!isAuthenticated) {
      setPendingWishlistServiceId(serviceId);
      setPostLoginIntent(null);
      setIsAuthModalOpen(true);
      return;
    }
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

  const handleUpdateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    updateCurrentUser({ ...currentUser, ...updates });
  };

  // Business-side accept/decline for any deal requests submitted before the
  // free-text "request a custom deal" flow was removed — kept so older,
  // already-saved requests in a business's local storage still work, even
  // though nothing creates new ones anymore (see performDealJoin, which
  // handles both real and prospective deals through the same one-click join).
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

  const handleNewsletterSignup = () => {
    const email = newsletterEmail.trim();
    if (!email || isRateLimited('newsletterSignup', 5000)) return;
    fetch('/api/newsletter-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, zip: newsletterZip.trim() }),
    }).catch(() => {});
    setNewsletterSubmitted(true);
    setNewsletterEmail('');
    setNewsletterZip('');
  };

  const handleAddReview = (businessId: string, rating: number, text: string) => {
    if (!currentUser) return;
    if (isRateLimited(`review_${currentUser.id}_${businessId}`, 30000)) {
      alert("You're posting too quickly - please wait a moment before submitting another review.");
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

  // Real, indexable /category/<slug>[/<city-slug>] pages — deliberately
  // independent of session state (selectedNeighborhoodId etc.), unlike the
  // `category` view above, so the same URL always shows the same content for
  // every visitor and for a crawler with no session at all. See
  // services/seo/pageContent.js#getCategoryPageContent.
  const handleCategoryPageClick = (categoryName: string, cityName?: string | null) => {
    setSelectedCategoryPageCategory(categoryName);
    setSelectedCategoryPageCity(cityName || null);
    setCategoryPageNeighborhoodId(null);
    setCategoryPageNeighborhoodSearch('');
    setCategorySortBy('recommended');
    setCategoryMinPrice('');
    setCategoryMaxPrice('');
    setView(cityName ? 'categoryCityPage' : 'categoryPage');
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
      setPostLoginIntent(null);
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
    setSearchResults(services.filter(s => ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId || (selectedNeighborhoodCity && (s.servedCities || []).includes(selectedNeighborhoodCity)))));
    setFilterCategories([]);
    setFilterStatus('all');
    setSortBy('recommended');
    setLastSearchQuery('');
    setView('results');
  };

  const currentNeighborhood = neighborhoods.find(n => n.id === selectedNeighborhoodId);
  const selectedNeighborhoodCity = currentNeighborhood?.city;

  const filteredServices = useMemo(() => {
    return services.filter(s =>
      (s.neighborhoodIds || []).includes(selectedNeighborhoodId) ||
      (s as any).neighborhoodId === selectedNeighborhoodId ||
      (selectedNeighborhoodCity && (s.servedCities || []).includes(selectedNeighborhoodCity))
    );
  }, [services, selectedNeighborhoodId, selectedNeighborhoodCity]);

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

  // The real, session-independent /category/<slug>[/<city-slug>] pages: base
  // list comes from getCategoryPageContent (same function the prerender
  // script uses), then optionally narrowed to one neighborhood, then the
  // same price/sort filters as the legacy category view above.
  const categoryPageBaseServices = useMemo(() => {
    if (!selectedCategoryPageCategory) return [];
    const cityScope = view === 'categoryCityPage' ? selectedCategoryPageCity : null;
    return getCategoryPageContent(selectedCategoryPageCategory, cityScope, services).services;
  }, [selectedCategoryPageCategory, selectedCategoryPageCity, view, services]);

  const categoryPageNeighborhood = categoryPageNeighborhoodId
    ? neighborhoods.find(n => n.id === categoryPageNeighborhoodId)
    : null;

  const categoryPageFilteredServices = useMemo(() => {
    let results = categoryPageBaseServices;
    if (categoryPageNeighborhood) {
      results = results.filter(s =>
        (s.neighborhoodIds || []).includes(categoryPageNeighborhood.id) ||
        (s.servedCities || []).includes(categoryPageNeighborhood.city)
      );
    }
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
    return sortServicesByMode(results, categorySortBy);
  }, [categoryPageBaseServices, categoryPageNeighborhood, categoryMinPrice, categoryMaxPrice, categorySortBy]);

  const categoryPageNeighborhoodResults = useMemo(
    () => searchNeighborhoods(neighborhoods, categoryPageNeighborhoodSearch, 8),
    [neighborhoods, categoryPageNeighborhoodSearch]
  );

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
        onLoginClick={() => { setPostLoginIntent(null); setIsAuthModalOpen(true); }}
        notifications={isAuthenticated ? notifications.filter(n => n.userId === currentUserId) : []}
        onNotificationClick={handleNotificationClick}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      />
      
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        users={users}
        defaultAccountType={postLoginIntent === 'business' ? 'business' : 'resident'}
        lockAccountType
        onSignUp={(newUser, accountType) => {
          const userToSave = pendingWishlistServiceId
            ? { ...newUser, wishlist: [...(newUser.wishlist || []), pendingWishlistServiceId] }
            : newUser;
          updateCurrentUser(userToSave);
          setCurrentUserId(newUser.id);
          saveState('currentUserId', newUser.id);
          setPendingWishlistServiceId(null);
          if (pendingSignUpServiceId) {
            performDealJoin(pendingSignUpServiceId, userToSave);
            setPendingSignUpServiceId(null);
          }
          const n = neighborhoods.find(nb => nb.id === newUser.neighborhoodId);
          fetch('/api/signup-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: newUser.name,
              email: newUser.email,
              accountType,
              neighborhoodName: n?.name,
              city: n?.city,
            }),
          }).catch(() => {});
          if (accountType === 'business' || postLoginIntent === 'business') {
            setView('business-onboarding');
          }
          setPostLoginIntent(null);
        }}
        onSignIn={(userId) => {
          setCurrentUserId(userId);
          saveState('currentUserId', userId);
          const signedInUser = users.find(u => u.id === userId);
          if (pendingWishlistServiceId) {
            if (signedInUser && !(signedInUser.wishlist || []).includes(pendingWishlistServiceId)) {
              updateCurrentUser({ ...signedInUser, wishlist: [...(signedInUser.wishlist || []), pendingWishlistServiceId] });
            }
            setPendingWishlistServiceId(null);
          }
          if (pendingSignUpServiceId && signedInUser) {
            performDealJoin(pendingSignUpServiceId, signedInUser);
            setPendingSignUpServiceId(null);
          }
          if (postLoginIntent === 'business') {
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
              onSelectNeighborhood={handleSelectNeighborhood}
              onLocalSearch={(query) => {
                const queryLower = (query || '').toLowerCase();
                const matches = services.filter(s =>
                  ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId || (selectedNeighborhoodCity && (s.servedCities || []).includes(selectedNeighborhoodCity))) &&
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
                      Check back soon, or browse another category — new deals are added regularly.
                    </p>
                 </motion.div>
              )}

              {/* How it works + trust stats */}
              <section className="bg-white rounded-3xl p-8 sm:p-10 border border-gray-100 shadow-[0_2px_4px_rgba(15,23,42,0.04),0_16px_40px_-8px_rgba(15,23,42,0.18)]">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How BetterBuyTheBlock Works</h2>
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
                    <p className="text-gray-500 text-sm">Every deal unlocks once enough neighbors join - the more, the cheaper.</p>
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
                    <p className="text-gray-700 font-semibold mb-3">We're just launching in Wake County - be one of the first businesses listed, free.</p>
                    <Button onClick={handleListBusinessClick}>List Your Business Free</Button>
                  </div>
                )}
              </section>

              {renderServiceCarousel(
                `Biggest Discounts in ${currentNeighborhood?.name || 'Your Neighborhood'}`,
                "The steepest bulk-pricing savings available right now.",
                [...filteredServices].sort((a, b) => b.discountPercentage - a.discountPercentage),
                'all',
                BadgePercent,
                'emerald'
              )}

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
                      const city = (b.address || '').split(',').map(p => p.trim())[1];
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
                              {(b.category || city) && (
                                <p className="text-xs text-gray-500 line-clamp-1">
                                  {b.category}{b.category && city ? ' - ' : ''}{city}
                                </p>
                              )}
                              <div className="flex items-center gap-1 text-sm text-gray-600 mt-0.5">
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
                              <p className="text-xs text-gray-500 mt-2 font-medium"> - {testimonial.userName}{testimonial.isVerifiedNeighbor ? ', Verified Neighbor' : ''}</p>
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
                  {newsletterSubmitted ? (
                    <p className="flex items-center gap-2 text-green-700 font-semibold">
                      <CheckCircle className="w-5 h-5" /> You're on the list!
                    </p>
                  ) : (
                    <form
                      onSubmit={(e) => { e.preventDefault(); handleNewsletterSignup(); }}
                      className="flex flex-col sm:flex-row gap-3 w-full md:w-auto"
                    >
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="email"
                          required
                          value={newsletterEmail}
                          onChange={(e) => setNewsletterEmail(e.target.value)}
                          placeholder="Email address"
                          className="pl-10 pr-4 py-3 rounded-lg border border-gray-300 w-full sm:w-64 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="text"
                          value={newsletterZip}
                          onChange={(e) => setNewsletterZip(e.target.value)}
                          placeholder="Zip code"
                          className="pl-10 pr-4 py-3 rounded-lg border border-gray-300 w-full sm:w-32 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <Button type="submit" className="py-3 px-6 rounded-lg font-bold whitespace-nowrap">Sign me up</Button>
                    </form>
                  )}
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
                    onSelectNeighborhood={handleSelectNeighborhood}
                    onLocalSearch={(query) => {
                      const queryLower = (query || '').toLowerCase();
                      const matches = services.filter(s => 
                        ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId || (selectedNeighborhoodCity && (s.servedCities || []).includes(selectedNeighborhoodCity))) &&
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
                        Try adjusting your filters to see more deals.
                      </p>
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
          ) : view === 'business' && selectedBusinessId && businesses.some(b => b.id === selectedBusinessId) ? (
            <BusinessProfile
              business={businesses.find(b => b.id === selectedBusinessId)!}
              services={services.filter(s => s.businessId === selectedBusinessId && ((s.neighborhoodIds || []).includes(selectedNeighborhoodId) || (s as any).neighborhoodId === selectedNeighborhoodId || (selectedNeighborhoodCity && (s.servedCities || []).includes(selectedNeighborhoodCity))))}
              allServices={services}
              neighborhoods={neighborhoods}
              reviews={reviews.filter(r => r.businessId === selectedBusinessId)}
              allBusinesses={businesses}
              onSignUp={handleSignUp}
              currentUserSignedUpIds={services.filter(s => (s.signedUpUserIds || []).includes(currentUser?.id || '')).map(s => s.id)}
              currentUser={currentUser}
              users={users}
              isAuthenticated={isAuthenticated}
              onAddReview={(rating, text) => handleAddReview(selectedBusinessId, rating, text)}
              onBack={() => setView(searchResults.length > 0 ? 'results' : 'home')}
              onServiceClick={handleServiceClick}
              onBusinessClick={handleBusinessClick}
              onCategoryCityClick={(category, city) => handleCategoryPageClick(category, city)}
            />
          ) : view === 'business' ? (
            // A direct visit to /business/<slug> lands here before the catalog
            // fetch resolves and the slug is matched to a real id (businesses
            // starts empty) — the static prerendered page already showed real
            // content, this is just the brief gap until the SPA's own data
            // loads and re-renders above.
            <div className="text-center py-24 text-gray-400">Loading…</div>
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
                  </div>
                )}
              </div>
            </section>
          ) : (view === 'categoryPage' || view === 'categoryCityPage') && selectedCategoryPageCategory ? (
            (() => {
              const cityScope = view === 'categoryCityPage' ? selectedCategoryPageCity : null;
              const scopeLabel = categoryPageNeighborhood
                ? `${categoryPageNeighborhood.name}, ${categoryPageNeighborhood.city}`
                : (cityScope || 'Wake County');
              const breadcrumbItems: BreadcrumbItem[] = [
                { label: 'Home', onClick: () => setView('home') },
                ...(cityScope
                  ? [{ label: selectedCategoryPageCategory, onClick: () => handleCategoryPageClick(selectedCategoryPageCategory) }]
                  : []),
                { label: cityScope ? `${selectedCategoryPageCategory} in ${cityScope}` : selectedCategoryPageCategory },
              ];
              return (
                <section className="pt-12">
                  <Breadcrumbs items={breadcrumbItems} />
                  <h1 className="text-4xl font-extrabold text-gray-900 mb-2 mt-4">
                    {cityScope ? `${selectedCategoryPageCategory} in ${cityScope}, NC` : `${selectedCategoryPageCategory} in Wake County, NC`}
                  </h1>
                  <p className="text-gray-500 mb-8 max-w-2xl">
                    {categoryPageFilteredServices.length > 0
                      ? `${categoryPageFilteredServices.length} real ${selectedCategoryPageCategory.toLowerCase()} deal${categoryPageFilteredServices.length === 1 ? '' : 's'} in ${scopeLabel}. Join with your neighbors to unlock bulk pricing.`
                      : `No ${selectedCategoryPageCategory.toLowerCase()} deals in ${scopeLabel} yet. Request one and we'll let local businesses know there's interest.`}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="relative flex-1 min-w-[220px]">
                      <label className="text-sm font-medium text-gray-600 whitespace-nowrap block mb-1">Neighborhood</label>
                      <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
                        <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
                        <input
                          type="text"
                          value={categoryPageNeighborhood ? `${categoryPageNeighborhood.name}, ${categoryPageNeighborhood.city}` : categoryPageNeighborhoodSearch}
                          onChange={(e) => {
                            setCategoryPageNeighborhoodId(null);
                            setCategoryPageNeighborhoodSearch(e.target.value);
                            setShowCategoryPageNeighborhoodDropdown(true);
                          }}
                          onFocus={() => setShowCategoryPageNeighborhoodDropdown(true)}
                          onBlur={() => setTimeout(() => setShowCategoryPageNeighborhoodDropdown(false), 150)}
                          placeholder={`Search a neighborhood in ${cityScope || 'Wake County'}...`}
                          className="w-full bg-transparent border-none focus:ring-0 text-sm outline-none p-0"
                        />
                        {categoryPageNeighborhood && (
                          <button
                            type="button"
                            onClick={() => { setCategoryPageNeighborhoodId(null); setCategoryPageNeighborhoodSearch(''); }}
                            className="text-gray-400 hover:text-gray-600 text-xs font-bold shrink-0"
                            aria-label="Clear neighborhood filter"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                      {showCategoryPageNeighborhoodDropdown && !categoryPageNeighborhood && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto text-left">
                          {categoryPageNeighborhoodResults.length > 0 ? (
                            categoryPageNeighborhoodResults.map(n => (
                              <div
                                key={n.id}
                                className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                                onMouseDown={() => {
                                  setCategoryPageNeighborhoodId(n.id);
                                  setCategoryPageNeighborhoodSearch('');
                                  setShowCategoryPageNeighborhoodDropdown(false);
                                }}
                              >
                                <div className="font-medium text-gray-900 text-sm">{n.name}</div>
                                <div className="text-xs text-gray-500">{n.city}, NC</div>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-2.5 text-sm text-gray-500">No neighborhoods found</div>
                          )}
                        </div>
                      )}
                    </div>
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
                    {(categoryMinPrice || categoryMaxPrice || categorySortBy !== 'recommended' || categoryPageNeighborhoodId) && (
                      <button
                        onClick={() => {
                          setCategorySortBy('recommended');
                          setCategoryMinPrice('');
                          setCategoryMaxPrice('');
                          setCategoryPageNeighborhoodId(null);
                          setCategoryPageNeighborhoodSearch('');
                        }}
                        className="text-sm font-medium text-primary-600 hover:underline sm:ml-auto"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {categoryPageFilteredServices.length > 0 ? (
                      categoryPageFilteredServices.map(service => {
                        const svcBusiness = businesses.find(b => b.id === service.businessId);
                        return (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          business={svcBusiness}
                          businessHref={svcBusiness ? businessPath(svcBusiness) : undefined}
                          serviceHref={svcBusiness ? servicePath(svcBusiness, service) : undefined}
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
                        );
                      })
                    ) : (
                      <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl">
                        <p className="text-gray-500 mb-4">No {selectedCategoryPageCategory.toLowerCase()} deals in {scopeLabel} right now.</p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })()
          ) : view === 'blog' && selectedBlog ? (
            <section className="pt-12 max-w-3xl mx-auto">
              <button
                onClick={() => setView('home')}
                className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
              >
                &larr; Back to Home
              </button>
              <img
                src={selectedBlog.image}
                alt={selectedBlog.title}
                className="w-full h-72 sm:h-96 object-cover rounded-2xl mb-8"
                referrerPolicy="no-referrer"
              />
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">{selectedBlog.title}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-500 font-medium mb-8 uppercase tracking-wider">
                <span>By {selectedBlog.author}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>{selectedBlog.date}</span>
              </div>
              <div className="text-gray-700">
                <p className="text-xl text-gray-600 leading-relaxed mb-10 pb-8 border-b border-gray-100">{selectedBlog.description}</p>
                {(selectedBlog as any).intro?.map((paragraph: string, idx: number) => (
                  <p key={`intro-${idx}`} className="text-base leading-relaxed mb-5">{paragraph}</p>
                ))}
                {(selectedBlog as any).sections?.map((section: any, sIdx: number) => (
                  <div key={`section-${sIdx}`} className="mt-12">
                    <h2 className="text-2xl font-extrabold text-gray-900 mb-4 pl-4 border-l-4 border-primary">
                      {section.heading}
                    </h2>
                    {section.paragraphs.map((paragraph: string, pIdx: number) => (
                      <p key={`section-${sIdx}-p-${pIdx}`} className="text-base leading-relaxed mb-5">{paragraph}</p>
                    ))}
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-3 mb-5">
                        {section.bullets.map((bullet: string, bIdx: number) => (
                          <li key={`section-${sIdx}-b-${bIdx}`} className="flex items-start gap-3 text-sm sm:text-base text-gray-800 font-medium">
                            <BadgePercent className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {section.linkCategory && (
                      <button
                        onClick={() => handleCategoryClick(section.linkCategory)}
                        className="w-full sm:w-auto flex items-center justify-between gap-3 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl px-5 py-3.5 text-primary-700 font-bold transition-colors"
                      >
                        {section.linkLabel || `See real ${section.linkCategory} deals`}
                        <span aria-hidden="true">&rarr;</span>
                      </button>
                    )}
                  </div>
                ))}
                {(selectedBlog as any).closing?.length > 0 && (
                  <div className="mt-12 bg-primary-50 border border-primary-100 rounded-2xl p-6">
                    {(selectedBlog as any).closing.map((paragraph: string, idx: number) => (
                      <p key={`closing-${idx}`} className="text-base leading-relaxed text-gray-800 last:mb-0 mb-3">{paragraph}</p>
                    ))}
                  </div>
                )}
                {(selectedBlog as any).category && (
                  <div className="mt-10 pt-8 border-t border-gray-100">
                    <Button onClick={() => handleCategoryClick((selectedBlog as any).category)} className="inline-flex items-center gap-2">
                      Browse all {(selectedBlog as any).category} deals in Wake County
                      <span aria-hidden="true">&rarr;</span>
                    </Button>
                  </div>
                )}
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
                    alert("You're creating deals too quickly - please wait a moment and try again.");
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
              content={<p>BetterBuyTheBlock connects you with local professionals offering group discounts. When more neighbors join a deal, everyone saves.</p>} 
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
              content={<p>Access guides, templates, and best practices to maximize your success on BetterBuyTheBlock.</p>} 
              onBack={() => setView('home')} 
            />
          ) : view === 'success-stories' ? (
            <StaticPage 
              title="Success stories" 
              content={<p>Read how local professionals and neighbors have benefited from group buying on BetterBuyTheBlock.</p>} 
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
                  <p>You're not charged anything by joining - this demo doesn't process payments. Joining signals real interest and helps unlock the group discount; you'd coordinate scheduling and payment directly with the business once a deal is confirmed.</p>

                  <h3>What if the exact service I need isn't listed?</h3>
                  <p>Use "Request a Deal" from your neighborhood's results page, or the request button on a specific business's profile. That sends your request straight to the business (or, for a general request, broadcasts it) so they know there's local demand.</p>

                  <h3>How do neighborhoods work?</h3>
                  <p>Every neighborhood in the search is a real, named subdivision in Wake County, NC - not a made-up region. Businesses choose which neighborhoods they want to offer a deal in, and deals only show up for residents of those neighborhoods.</p>

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
                  <p>Reach us anytime at <a href="mailto:support@betterbuytheblock.com" className="text-primary hover:underline font-medium">support@betterbuytheblock.com</a>. We're a small team working through Wake County, so it may take a bit to get back to you, but every message reaches a real person.</p>
                  <p>Account issues can usually be resolved on your own: since your profile lives only in this browser's local storage, clearing your browser data and signing up again resets things.</p>
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

                  <h3>What BetterBuyTheBlock is</h3>
                  <p>BetterBuyTheBlock is a Wake County, NC platform that shows neighborhood bulk-pricing deals from local home service businesses and lets residents request deals from businesses. By using this site, you agree to these terms.</p>

                  <h3>No payments happen on this site</h3>
                  <p>BetterBuyTheBlock does not process payments. "Joining" a deal or "requesting" a deal does not charge you anything and is not a contract with the business. Any actual service, scheduling, and payment happens directly between you and the business, entirely off this platform.</p>

                  <h3>Deals from businesses not yet on the platform</h3>
                  <p>Many businesses shown on this site are real, independently-operated Wake County businesses we've identified as likely to offer the listed category of service - they have not yet joined BetterBuyTheBlock or agreed to any specific deal shown. These are marked "Not yet a confirmed partner," and the pricing shown for them is a proposal, not a rate the business has committed to. Requesting one of these deals sends the business a signal of real neighborhood demand; it does not create any obligation on their part.</p>

                  <h3>Accounts</h3>
                  <p>A BetterBuyTheBlock profile is stored only in your browser's local storage - there is no password and no server-side account. Clearing your browser data, or switching browsers or devices, will lose your profile and history with no way to recover it.</p>

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
                  <p>Your BetterBuyTheBlock profile (name, email, neighborhood, and activity like joined or wishlisted deals) is stored only in your own browser's local storage. It is never sent to our servers just by browsing the site, and we can't see it. Clearing your browser data deletes it permanently - we have no copy and no way to recover it.</p>

                  <h3>What actually gets sent to us</h3>
                  <p>When you submit a "Request a Deal" form (a general request or one aimed at a specific business), sign up for a profile, or subscribe to our cost-guide emails, the information you enter (service details, your display name, your email, and your neighborhood/city where relevant) is sent to our server, stored so we can see real demand, and used to send an internal email notification to our team at support@betterbuytheblock.com through Resend, our email delivery provider. This is the only visitor data that leaves your browser during normal use.</p>
                  <p>If you use the AI deal-request assistant, the text you type and the business's name are sent to Google's Gemini API to generate a draft message. That's a direct request to Google's API from our server - we don't separately store what you typed for this feature.</p>

                  <h3>Business data</h3>
                  <p>Business names, categories, addresses, phone numbers, descriptions, and ratings shown on this site come from each business's own public listing information (via a third-party business-data API), not from anything a visitor submits. Photos shown are real stock photography, not photos of the specific business's actual work.</p>

                  <h3>Cookies and tracking</h3>
                  <p>Your profile and preferences use local storage, not cookies, and that always happens (it's how the site remembers you between visits). Separately, we use Google Tag Manager to understand how the site's being used - that only loads if you accept it in the notice shown on your first visit; declining keeps it off for that browser. We don't run advertising trackers. Our hosting provider may also log standard technical request information (like IP address and browser type) as part of normal web server operation.</p>

                  <h3>No payment data</h3>
                  <p>We don't process payments and never collect card or bank information.</p>

                  <h3>Your choices</h3>
                  <p>Clear your browser's local storage at any time to remove your profile. To have a submitted deal request, signup, or newsletter subscription removed from our records, email us at <a href="mailto:support@betterbuytheblock.com" className="text-primary hover:underline font-medium">support@betterbuytheblock.com</a>.</p>

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
      <Footer onNavigate={(page) => setView(page as any)} onCategoryClick={(category) => handleCategoryPageClick(category)} />
      <CookieConsentBanner onViewPrivacyPolicy={() => setView('privacy')} />
    </div>
  );
};

export default App;
