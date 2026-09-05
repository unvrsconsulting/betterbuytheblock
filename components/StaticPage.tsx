import React from 'react';

interface StaticPageProps {
  title: string;
  content: React.ReactNode;
  onBack: () => void;
}

const StaticPage: React.FC<StaticPageProps> = ({ title, content, onBack }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <button 
        onClick={onBack} 
        className="text-primary hover:underline mb-8 inline-flex items-center font-medium"
      >
        &larr; Back to Home
      </button>
      
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden p-8 md:p-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8">{title}</h1>
        <div className="prose prose-lg text-gray-600 max-w-none">
          {content}
        </div>
      </div>
    </div>
  );
};

export default StaticPage;
