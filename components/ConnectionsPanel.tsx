import React, { useState } from 'react';
import { User } from '../types';
import { Users, Link as LinkIcon, Plus, CheckCircle, Copy, X, UserMinus, UserPlus } from 'lucide-react';
import Button from './Button';

interface ConnectionsPanelProps {
  currentUser: User;
  users: User[];
  onUpdateUser: (user: User) => void;
}

const ConnectionsPanel: React.FC<ConnectionsPanelProps> = ({ currentUser, users, onUpdateUser }) => {
  const [connectionCode, setConnectionCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleCopyCode = () => {
    if (currentUser?.connectionCode) {
      navigator.clipboard.writeText(currentUser.connectionCode);
      setMessage({ text: 'Connection code copied to clipboard!', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleConnect = async (codeToConnect?: string) => {
    const code = codeToConnect || connectionCode.trim();
    if (!code) return;
    
    setIsConnecting(true);
    setMessage(null);

    try {
      const userToConnect = users.find(u => u.connectionCode === code && u.id !== currentUser.id);
      
      if (!userToConnect) {
        throw new Error('Invalid connection code or neighbor not found.');
      }

      if (currentUser.connections?.includes(userToConnect.id)) {
        throw new Error('You are already connected with this neighbor.');
      }

      const updatedUser = {
        ...currentUser,
        connections: [...(currentUser?.connections || []), userToConnect.id]
      };
      
      onUpdateUser(updatedUser);
      setMessage({ text: `Successfully connected with ${userToConnect.name}!`, type: 'success' });
      setConnectionCode('');
    } catch (error: any) {
      setMessage({ text: error.message || 'Failed to connect. Please try again.', type: 'error' });
    } finally {
      setIsConnecting(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleRemoveConnection = async (connectionId: string) => {
    try {
      const updatedUser = {
        ...currentUser,
        connections: (currentUser?.connections || []).filter(id => id !== connectionId)
      };
      
      onUpdateUser(updatedUser);
      setMessage({ text: 'Connection removed.', type: 'success' });
    } catch (error: any) {
      setMessage({ text: 'Failed to remove connection.', type: 'error' });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const connectedUsers = users.filter(u => currentUser?.connections?.includes(u.id));
  const suggestedUsers = users.filter(u =>
    u.neighborhoodId === currentUser.neighborhoodId && 
    u.id !== currentUser.id && 
    !currentUser?.connections?.includes(u.id) &&
    !u.isAnonymous
  ).slice(0, 6); // Show up to 6 suggestions

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary-100 p-3 rounded-xl text-primary-600">
          <Users className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Your Connections</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Connection Code Section */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Invite Neighbors</h3>
          <p className="text-sm text-gray-600 mb-4">
            Share your unique code with neighbors to connect and share deals.
          </p>
          
          <div className="flex items-center gap-2">
            <div className="bg-white border border-gray-200 px-4 py-3 rounded-xl flex-1 font-mono text-center font-bold text-primary-700 tracking-wider">
              {currentUser?.connectionCode || 'GEN-CODE-123'}
            </div>
            <button 
              onClick={handleCopyCode}
              className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-600"
              title="Copy Code"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add Connection Section */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Connect with Someone</h3>
          <p className="text-sm text-gray-600 mb-4">
            Enter a neighbor's connection code to add them to your network.
          </p>
          
          <div className="flex items-center gap-2">
            <input 
              type="text"
              value={connectionCode}
              onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              className="bg-white border border-gray-200 px-4 py-3 rounded-xl flex-1 font-mono uppercase focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            <Button 
              onClick={() => handleConnect()}
              disabled={isConnecting || !connectionCode.trim()}
              className="px-6 py-3 rounded-xl font-bold"
            >
              {isConnecting ? '...' : 'Connect'}
            </Button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mt-6 p-4 rounded-xl flex items-center gap-2 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Connected Neighbors ({connectedUsers.length})
        </h3>
        {connectedUsers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {connectedUsers.map((user, index) => (
              <div key={`connected-${user.id}-${index}`} className="flex items-center justify-between bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <img 
                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                    alt={user.name} 
                    className="w-10 h-10 rounded-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  <span className="font-medium text-gray-900">{user.name}</span>
                </div>
                <button 
                  onClick={() => handleRemoveConnection(user.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Remove Connection"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">You haven't connected with any neighbors yet.</p>
        )}
      </div>

      {suggestedUsers.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            People in your neighborhood
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {suggestedUsers.map((user, index) => (
              <div key={`suggested-${user.id}-${index}`} className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  <img 
                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                    alt={user.name} 
                    className="w-10 h-10 rounded-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  <span className="font-medium text-gray-900">{user.name}</span>
                </div>
                <button 
                  onClick={() => handleConnect(user.connectionCode)}
                  disabled={isConnecting}
                  className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-full transition-colors"
                  title="Connect"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionsPanel;
