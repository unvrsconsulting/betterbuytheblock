import React, { useMemo } from 'react';
import { User, Service } from '../types';
import { Activity, Tag } from 'lucide-react';

interface ConnectionsFeedProps {
  currentUser: User;
  users: User[];
  services: Service[];
}

const ConnectionsFeed: React.FC<ConnectionsFeedProps> = ({ currentUser, users, services }) => {
  const feedItems = useMemo(() => {
    if (!currentUser?.connections || currentUser.connections.length === 0) return [];

    const items: any[] = [];
    let idCounter = 1;

    // Find signups from connections
    services.forEach(service => {
      if (!service.signedUpUserIds) return;

      service.signedUpUserIds.forEach(userId => {
        if (currentUser.connections?.includes(userId)) {
          const user = users.find(u => u.id === userId);
          if (user) {
            items.push({
              id: idCounter++,
              type: 'signup',
              user: user.name,
              userAvatar: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
              action: 'joined a deal for',
              target: service.title,
              time: 'Recently',
              icon: <Tag className="w-4 h-4" />
            });
          }
        }
      });
    });

    // Sort by id descending just to have some order
    return items.sort((a, b) => b.id - a.id);
  }, [currentUser.connections, services, users]);

  if (!currentUser?.connections || currentUser.connections.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-12 p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Connections Feed</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Connect with neighbors to see what deals they are joining and services they recommend.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-12 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
          <Activity className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Connections Feed</h2>
      </div>
      
      <div className="space-y-6">
        {feedItems.length > 0 ? feedItems.map((item, index) => (
          <div key={`feed-${item.id}-${index}`} className="flex items-start gap-4 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 shrink-0 overflow-hidden">
              {item.userAvatar ? (
                <img src={item.userAvatar} alt={item.user} className="w-full h-full object-cover" />
              ) : (
                item.icon
              )}
            </div>
            <div>
              <p className="text-gray-900 font-medium">
                <span className="font-bold">{item.user}</span> {item.action} <span className="font-bold text-primary-600">{item.target}</span>
              </p>
              <p className="text-sm text-gray-500 mt-1">{item.time}</p>
            </div>
          </div>
        )) : (
          <p className="text-gray-500 italic">No recent activity from your connections.</p>
        )}
      </div>
    </div>
  );
};

export default ConnectionsFeed;
