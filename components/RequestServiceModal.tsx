import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import Button from './Button';
import { checkContent } from '../services/contentModeration';

interface RequestServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName?: string;
  initialServiceName?: string;
  onSubmit: (details: { serviceName: string; description: string; website?: string }) => void;
}

const RequestServiceModal: React.FC<RequestServiceModalProps> = ({ isOpen, onClose, businessName, initialServiceName, onSubmit }) => {
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — real users never see or fill this
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setServiceName(initialServiceName || '');
  }, [isOpen, initialServiceName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !description.trim()) return;

    const nameCheck = checkContent(serviceName, { minLength: 2, maxLength: 80, fieldName: 'Service name' });
    if (!nameCheck.allowed) {
      setError(nameCheck.reason || 'That service name could not be submitted.');
      return;
    }
    const descCheck = checkContent(description, { minLength: 10, maxLength: 1000, fieldName: 'Details' });
    if (!descCheck.allowed) {
      setError(descCheck.reason || 'That description could not be submitted.');
      return;
    }

    setError(null);
    onSubmit({ serviceName, description, website });
    setServiceName('');
    setDescription('');
    setWebsite('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">
                {businessName ? `Request Service from ${businessName}` : 'Request a Custom Service'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {!businessName && (
                <p className="text-gray-600 text-sm mb-6">
                  Can't find what you're looking for? Describe the service you need, and we'll broadcast it to local professionals in your area.
                </p>
              )}
              {businessName && (
                <p className="text-gray-600 text-sm mb-6">
                  Don't see the exact service you need from {businessName}? Request it here, and we'll let them know!
                </p>
              )}

              <div className="space-y-4">
                {/* Honeypot: hidden from real users via CSS (not type="hidden",
                    which some bots skip), left blank by anyone who can't see it. */}
                <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    type="text"
                    id="website"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="serviceName" className="block text-sm font-medium text-gray-700 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    id="serviceName"
                    value={serviceName}
                    onChange={(e) => { setServiceName(e.target.value); if (error) setError(null); }}
                    placeholder="e.g., Pool Opening Cleaning"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Details & Requirements
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); if (error) setError(null); }}
                    placeholder="Describe what you need done in detail..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="mt-4 flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </p>
              )}

              <div className="mt-8 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Submit Request
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RequestServiceModal;
