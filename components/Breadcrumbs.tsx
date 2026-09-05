import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1.5 text-sm text-gray-500 pt-6 mb-2">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
            {isLast || !item.onClick ? (
              <span className={isLast ? 'text-gray-700 font-medium truncate max-w-[240px]' : 'truncate max-w-[240px]'}>
                {item.label}
              </span>
            ) : (
              <button
                onClick={item.onClick}
                className="hover:text-primary-600 hover:underline truncate max-w-[240px]"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
