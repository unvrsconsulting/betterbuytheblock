import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, AlertCircle } from 'lucide-react';
import Button from './Button';
import { checkContent } from '../services/contentModeration';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  onSubmit: (rating: number, text: string) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, businessName, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || !text.trim()) return;

    const result = checkContent(text, { minLength: 10, maxLength: 1000, fieldName: 'Your review' });
    if (!result.allowed) {
      setError(result.reason || 'That review could not be submitted.');
      return;
    }

    setError(null);
    onSubmit(rating, text.trim());
    setRating(0);
    setText('');
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
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Review {businessName}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Your rating</label>
              <div className="flex gap-1 mb-6">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${star <= (hoverRating || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                    />
                  </button>
                ))}
              </div>

              <label htmlFor="reviewText" className="block text-sm font-medium text-gray-700 mb-1">Your review</label>
              <textarea
                id="reviewText"
                value={text}
                onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
                placeholder="How was your experience?"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
                required
              />
              {error && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={rating === 0 || !text.trim()}>Submit Review</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReviewModal;
