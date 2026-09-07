import React from 'react';

interface FooterProps {
  onNavigate?: (page: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate = (_page: string) => {} }) => {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 border-t border-gray-800 mt-auto">
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-white text-xl font-extrabold mb-4 tracking-tight">BetterByTheBlock</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            Connecting neighbors with top-rated local professionals through the power of group buying.
          </p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Homeowners</h4>
          <ul className="space-y-3 text-sm">
            <li><button onClick={() => onNavigate('how-it-works')} className="hover:text-white transition-colors">How it works</button></li>
            <li><button onClick={() => onNavigate('results')} className="hover:text-white transition-colors">Find a pro</button></li>
            <li><button onClick={() => onNavigate('articles')} className="hover:text-white transition-colors">Cost guides</button></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Professionals</h4>
          <ul className="space-y-3 text-sm">
            <li><button onClick={() => onNavigate('pro-signup')} className="hover:text-white transition-colors">Join our network</button></li>
            <li><button onClick={() => onNavigate('pro-resources')} className="hover:text-white transition-colors">Pro resources</button></li>
            <li><button onClick={() => onNavigate('success-stories')} className="hover:text-white transition-colors">Success stories</button></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Support</h4>
          <ul className="space-y-3 text-sm">
            <li><button onClick={() => onNavigate('help')} className="hover:text-white transition-colors">Help center</button></li>
            <li><button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">Contact us</button></li>
            <li><button onClick={() => onNavigate('terms')} className="hover:text-white transition-colors">Terms & Conditions</button></li>
            <li><button onClick={() => onNavigate('privacy')} className="hover:text-white transition-colors">Privacy Policy</button></li>
          </ul>
        </div>
      </div>
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 mt-12 pt-8 border-t border-gray-800 text-sm text-gray-500 flex flex-col md:flex-row justify-between items-center">
        <p>© {new Date().getFullYear()} BetterByTheBlock. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
