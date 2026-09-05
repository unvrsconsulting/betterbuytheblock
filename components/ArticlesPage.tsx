import React, { useState } from 'react';
import Button from './Button';

interface Article {
  title: string;
  description: string;
  author: string;
  date: string;
  image: string;
  type: string;
}

interface ArticlesPageProps {
  articles: Article[];
  onArticleClick: (article: Article) => void;
  onBack: () => void;
}

const ArticlesPage: React.FC<ArticlesPageProps> = ({ articles, onArticleClick, onBack }) => {
  const [activeFilter, setActiveFilter] = useState<string>('All');
  
  // Extract unique types from articles
  const types = ['All', ...Array.from(new Set(articles.map(a => a.type || 'Guide')))];
  
  const filteredArticles = activeFilter === 'All' 
    ? articles 
    : articles.filter(a => (a.type || 'Guide') === activeFilter);

  return (
    <div className="max-w-[95%] mx-auto px-4 sm:px-6 py-8">
      <button 
        onClick={onBack} 
        className="text-primary hover:underline mb-6 inline-flex items-center font-medium"
      >
        &larr; Back to Home
      </button>
      
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Articles & Guides</h1>
        <p className="text-xl text-gray-600 max-w-3xl">
          Expert advice, cost guides, and news to help you make informed decisions for your home.
        </p>
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-10">
        {types.map(type => (
          <button
            key={type}
            onClick={() => setActiveFilter(type)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              activeFilter === type 
                ? 'bg-primary text-white shadow-md' 
                : 'bg-white text-gray-700 border border-gray-200 hover:border-primary hover:text-primary'
            }`}
          >
            {type}
          </button>
        ))}
      </div>
      
      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredArticles.map(article => (
          <div 
            key={article.title} 
            onClick={() => onArticleClick(article)}
            className="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col h-full"
          >
            <div className="relative aspect-[3/2] overflow-hidden">
              <img 
                src={article.image} 
                alt={article.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                referrerPolicy="no-referrer" 
              />
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-800">
                {article.type || 'Guide'}
              </div>
            </div>
            <div className="p-6 flex flex-col flex-1">
              <div className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-3">
                {article.author} • {article.date}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors line-clamp-2">
                {article.title}
              </h3>
              <p className="text-gray-600 text-sm line-clamp-3 mb-4 flex-1">
                {article.description}
              </p>
              <div className="mt-auto pt-4 border-t border-gray-100">
                <span className="text-primary font-bold text-sm group-hover:underline">Read article &rarr;</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {filteredArticles.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100">
          <p className="text-gray-500 text-lg">No articles found for this category.</p>
          <button 
            onClick={() => setActiveFilter('All')}
            className="mt-4 text-primary font-bold hover:underline"
          >
            View all articles
          </button>
        </div>
      )}
    </div>
  );
};

export default ArticlesPage;
