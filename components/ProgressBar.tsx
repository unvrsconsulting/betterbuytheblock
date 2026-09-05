
import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const isComplete = current >= total;

  return (
    <div>
      <div className="flex flex-wrap justify-center items-center mb-2 gap-2">
        <p className="text-sm font-medium text-gray-700 text-center">
          <span className={isComplete ? 'text-primary font-bold' : 'text-secondary-600 font-bold'}>{current}</span> of <span className="font-bold">{total}</span> interested neighbors
        </p>
        {isComplete && <span className="text-xs font-semibold text-primary bg-primary-100 px-2 py-0.5 rounded-full">Goal Met!</span>}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${isComplete ? 'bg-primary' : 'bg-secondary'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
