import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { Business, User } from '../types';
import Button from './Button';
import { GoogleGenAI } from '@google/genai';
import { checkContent } from '../services/contentModeration';

interface AIRequestDealPanelProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business;
  currentUser?: User | null;
  onSubmitRequest: (serviceName: string, description: string) => void;
}

const AIRequestDealPanel: React.FC<AIRequestDealPanelProps> = ({ isOpen, onClose, business, currentUser, onSubmitRequest }) => {
  const [requestText, setRequestText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDeal, setGeneratedDeal] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!requestText.trim()) return;

    const result = checkContent(requestText, { minLength: 5, maxLength: 500, fieldName: 'Your request' });
    if (!result.allowed) {
      setError(result.reason || 'That request could not be submitted.');
      return;
    }
    setError(null);

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `You are an AI assistant helping a user request a custom deal from a local business named "${business.name}".
      The user's request is: "${requestText}".
      Generate a professional, compelling deal request that is competitive to other similar companies and offers available in the area.
      Format the response as a short, persuasive message to the business owner, suggesting a fair group discount if multiple neighbors sign up.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      setGeneratedDeal(response.text || 'Failed to generate deal request.');
      setIsSent(false);
    } catch (error) {
      console.error('Error generating deal:', error);
      setGeneratedDeal('An error occurred while generating the deal request. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
    if (!generatedDeal) return;
    if (!currentUser) {
      alert('Please sign in to send this request.');
      return;
    }

    onSubmitRequest(requestText.slice(0, 80) || `Custom request for ${business.name}`, generatedDeal);

    setIsSending(true);
    setIsSent(true);
    setIsSending(false);
    setTimeout(() => {
      onClose();
      setIsSent(false);
      setGeneratedDeal(null);
      setRequestText('');
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-primary-50 to-white">
              <div className="flex items-center gap-2">
                <div className="bg-primary p-2 rounded-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">AI Deal Request</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <p className="text-gray-600 mb-4 text-sm">
                Describe the service you need from <strong>{business.name}</strong>. Our AI will craft a competitive group deal request based on local market rates.
              </p>

              <textarea
                value={requestText}
                onChange={(e) => { setRequestText(e.target.value); if (error) setError(null); }}
                placeholder="e.g., I need my driveway pressure washed and think 5 of my neighbors would want it too..."
                className="w-full h-32 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none mb-2 text-sm"
              />
              {error && (
                <p className="mb-4 flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </p>
              )}

              <Button
                onClick={handleGenerate} 
                disabled={isGenerating || !requestText.trim()}
                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Request
                  </>
                )}
              </Button>

              {generatedDeal && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Generated Request:</h3>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                    {generatedDeal}
                  </div>
                  <Button 
                    onClick={handleSend}
                    disabled={isSending || isSent}
                    className={`w-full mt-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${isSent ? 'bg-green-500 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : isSent ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Sent Successfully!
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send to Business
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AIRequestDealPanel;
