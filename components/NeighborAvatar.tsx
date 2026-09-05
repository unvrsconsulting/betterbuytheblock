import React, { useState } from 'react';
import { User } from '../types';
import { useNeighborhoods } from '../hooks/useNeighborhoods';

interface NeighborAvatarProps {
  user: User;
  currentUser: User | null;
  onUpdateUser?: (user: User) => void;
  showName?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const NeighborAvatar: React.FC<NeighborAvatarProps> = ({ user, currentUser, showName = false, size = 'md' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const { neighborhoods } = useNeighborhoods();

  const isConnected = currentUser?.connections?.includes(user.id);
  const isSelf = currentUser?.id === user.id;
  const displayName = isConnected || isSelf ? user.name : "Neighbor";
  const neighborhoodName = neighborhoods.find(n => n.id === user.neighborhoodId)?.name;

  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  if (user.isAnonymous) {
    return (
      <div 
        className={`flex ${sizeClasses[size]} rounded-full ring-2 ring-white bg-gray-200 items-center justify-center text-gray-500 text-xs font-bold relative group`}
        title="Anonymous Neighbor"
      >
        ?
      </div>
    );
  }

  const avatarSrc = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;

  return (
    <div 
      className="relative flex group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-2">
        <img
          className={`${sizeClasses[size]} rounded-full ring-2 ring-white object-cover cursor-pointer`}
          src={avatarSrc}
          alt={displayName}
          referrerPolicy="no-referrer"
        />
        {showName && <span className="text-sm font-medium text-gray-700">{displayName}</span>}
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50">
          <div className="flex items-center gap-3">
            <img src={avatarSrc} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{displayName}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {neighborhoodName ? `Neighbor in ${neighborhoodName}` : 'Neighbor'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NeighborAvatar;
