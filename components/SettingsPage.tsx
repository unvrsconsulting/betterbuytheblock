import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { NotificationType, User } from '../types';

interface SettingsPageProps {
  currentUser: User;
  onUpdateNotificationPreference: (type: NotificationType, enabled: boolean) => void;
  onClearLocalData: () => void;
  onBack: () => void;
}

const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] = [
  {
    type: 'unlocked',
    label: 'Deal unlocked',
    description: 'A deal you joined reached its neighbor goal and is confirmed.',
  },
  {
    type: 'close_to_unlocking',
    label: 'One signup away',
    description: 'A deal you joined only needs one more neighbor to unlock.',
  },
  {
    type: 'expiring_soon',
    label: 'Expiring soon',
    description: 'A deal you joined is about to expire without enough signups.',
  },
  {
    type: 'deal_request_received',
    label: 'New deal request received',
    description: 'A neighbor requested a custom deal from your business.',
  },
  {
    type: 'deal_request_status',
    label: 'Deal request status updates',
    description: 'A business accepted or declined a custom deal you requested.',
  },
];

const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 ${
      checked ? 'bg-primary' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const SettingsPage: React.FC<SettingsPageProps> = ({
  currentUser,
  onUpdateNotificationPreference,
  onClearLocalData,
  onBack,
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const isEnabled = (type: NotificationType) => currentUser.notificationPreferences?.[type] !== false;

  const handleConfirmClear = () => {
    setIsConfirmingClear(false);
    onClearLocalData();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <button
        onClick={onBack}
        className="text-primary hover:underline mb-8 inline-flex items-center font-medium"
      >
        &larr; Back to Home
      </button>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-8 md:p-12 mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-500 mb-8">Manage your account settings, notifications, and privacy preferences.</p>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Notifications</h2>
          <p className="text-sm text-gray-500 mb-6">Choose which kinds of updates you want to hear about.</p>
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
            {NOTIFICATION_TYPES.map(({ type, label, description }) => (
              <div key={type} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="font-semibold text-gray-900">{label}</p>
                  <p className="text-sm text-gray-500">{description}</p>
                </div>
                <Toggle
                  checked={isEnabled(type)}
                  onChange={(checked) => onUpdateNotificationPreference(type, checked)}
                  label={label}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-red-200 overflow-hidden p-8 md:p-12">
        <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Danger Zone
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Permanently remove your account from this browser's local storage. This cannot be undone.
        </p>

        {!isConfirmingClear ? (
          <button
            onClick={() => setIsConfirmingClear(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-300 text-red-600 font-semibold hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear my local data
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <p className="text-red-800 font-medium mb-4">
              Are you sure? This will permanently delete your account, "{currentUser.name}", from this browser.
              Other neighbors' and businesses' data will not be affected.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
              >
                Yes, clear my data
              </button>
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
