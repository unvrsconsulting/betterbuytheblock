
import React, { useState, useRef, useEffect } from 'react';
import { User, Notification, UserType } from '../types';
import { HomeIcon } from './Icon';
import { LogOut, Settings, User as UserIcon, Bell, Sparkles, Users, Clock, MessageSquare, Menu, X as CloseIcon, ArrowLeftRight, CheckCircle } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  isAuthenticated?: boolean;
  onLogoClick?: () => void;
  onProfileClick?: () => void;
  onConnectionsClick?: () => void;
  onMyDealsClick?: () => void;
  onBusinessHubClick?: () => void;
  onMyNeighborhoodClick?: () => void;
  onWishlistClick?: () => void;
  onListBusinessClick?: () => void;
  onSettingsClick?: () => void;
  onSwitchAccountClick?: () => void;
  onLogoutClick?: () => void;
  onLoginClick?: () => void;
  notifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkAllNotificationsRead?: () => void;
}

const NOTIFICATION_ICONS: Record<Notification['type'], React.ReactNode> = {
  unlocked: <Sparkles className="w-4 h-4 text-green-600" />,
  close_to_unlocking: <Users className="w-4 h-4 text-primary" />,
  expiring_soon: <Clock className="w-4 h-4 text-orange-500" />,
  deal_request_received: <MessageSquare className="w-4 h-4 text-primary" />,
  deal_request_status: <MessageSquare className="w-4 h-4 text-primary" />,
  deal_completed: <CheckCircle className="w-4 h-4 text-green-600" />,
};

const timeAgo = (dateStr: string) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const Header: React.FC<HeaderProps> = ({ currentUser, isAuthenticated = false, onLogoClick, onProfileClick, onConnectionsClick, onMyDealsClick, onBusinessHubClick, onMyNeighborhoodClick, onWishlistClick, onListBusinessClick, onSettingsClick, onSwitchAccountClick, onLogoutClick, onLoginClick, notifications = [], onNotificationClick, onMarkAllNotificationsRead }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const isBusiness = currentUser?.type === UserType.BUSINESS;
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer shrink-0" onClick={onLogoClick}>
          <div className="bg-primary p-1.5 sm:p-2 rounded-lg shrink-0">
            <HomeIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <h1 className="text-base sm:text-2xl font-extrabold text-gray-900 tracking-tight whitespace-nowrap">
            BetterByTheBlock
          </h1>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-6">
          <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-600 items-center">
            {isAuthenticated && !isBusiness && (
              <button onClick={onMyNeighborhoodClick} className="hover:text-primary transition font-medium">My Neighborhood</button>
            )}
            {isAuthenticated && !isBusiness && (
              <button onClick={onWishlistClick} className="hover:text-primary transition font-medium">Wishlist</button>
            )}
            {!isAuthenticated && (
              <button
                onClick={onListBusinessClick}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-primary-600 transition-colors whitespace-nowrap"
              >
                List Services
              </button>
            )}
          </nav>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-500 hover:text-primary hover:bg-gray-50 rounded-full transition-colors shrink-0"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {isAuthenticated && (
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-gray-500 hover:text-primary hover:bg-gray-50 rounded-full transition-colors"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
                    <span className="font-bold text-gray-900 text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => onMarkAllNotificationsRead?.()}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8 px-4">No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 15).map(n => (
                      <button
                        key={n.id}
                        onClick={() => { onNotificationClick?.(n); setIsNotificationsOpen(false); }}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${!n.read ? 'bg-primary-50/40' : ''}`}
                      >
                        <div className="mt-0.5 shrink-0">{NOTIFICATION_ICONS[n.type]}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'} line-clamp-2`}>{n.message}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{timeAgo(n.date)}</p>
                        </div>
                        {!n.read && <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative border-l pl-2 sm:pl-6 shrink-0" ref={dropdownRef}>
            {isAuthenticated ? (
              <div
                className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                role="button"
                tabIndex={0}
                aria-label="Open account menu"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDropdownOpen(!isDropdownOpen); } }}
              >
                <div className="hidden md:block text-right">
                  <p className="text-sm font-semibold text-gray-800">{currentUser?.name || 'User'}</p>
                  <p className="text-xs text-gray-500">{currentUser?.type === 'BUSINESS' ? 'Business' : 'Resident'}</p>
                </div>
                <img
                  src={currentUser?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random`}
                  alt={currentUser?.name || 'User'}
                  className="w-10 h-10 rounded-full border-2 border-gray-100"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <button
                onClick={onLoginClick}
                className="text-sm font-bold text-gray-700 hover:text-primary-600 transition whitespace-nowrap"
              >
                Sign In
              </button>
            )}

            {isDropdownOpen && isAuthenticated && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                {!isBusiness && (
                  <button
                    onClick={() => { setIsDropdownOpen(false); onProfileClick?.(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <UserIcon className="w-4 h-4" /> Profile
                  </button>
                )}
                {!isBusiness && (
                  <button
                    onClick={() => { setIsDropdownOpen(false); onConnectionsClick?.(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Connections
                  </button>
                )}
                {!isBusiness && (
                  <button
                    onClick={() => { setIsDropdownOpen(false); onMyDealsClick?.(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    My Deals
                  </button>
                )}
                <button
                  onClick={() => { setIsDropdownOpen(false); onBusinessHubClick?.(); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {currentUser.type === 'BUSINESS' ? 'Business Hub' : 'Register Business'}
                </button>
                {onSwitchAccountClick && (
                  <button
                    onClick={() => { setIsDropdownOpen(false); onSwitchAccountClick(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ArrowLeftRight className="w-4 h-4" /> {isBusiness ? 'Switch to Personal Account' : 'Switch to Business Account'}
                  </button>
                )}
                <button
                  onClick={() => { setIsDropdownOpen(false); onSettingsClick?.(); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={() => { setIsDropdownOpen(false); onLogoutClick?.(); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <nav className="md:hidden border-t border-gray-100 px-4 py-3 space-y-1 bg-white">
          {isAuthenticated && !isBusiness && (
            <button
              onClick={() => { setIsMobileMenuOpen(false); onMyNeighborhoodClick?.(); }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              My Neighborhood
            </button>
          )}
          {isAuthenticated && !isBusiness && (
            <button
              onClick={() => { setIsMobileMenuOpen(false); onWishlistClick?.(); }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Wishlist
            </button>
          )}
          {!isAuthenticated && (
            <button
              onClick={() => { setIsMobileMenuOpen(false); onListBusinessClick?.(); }}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-primary text-white font-bold shadow-sm hover:bg-primary-600 transition-colors mt-2"
            >
              List Services
            </button>
          )}
        </nav>
      )}
    </header>
  );
};

export default Header;
