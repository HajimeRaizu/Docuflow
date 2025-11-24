import React from 'react';
import { User, DocumentType } from '../types';
import { FileText, ArrowRight, Scale, Mail } from 'lucide-react';

interface DashboardProps {
  user: User;
  onNavigate: (page: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  
  const tiles = [
    {
      title: 'New Activity Proposal',
      icon: FileText,
      color: 'bg-blue-600',
      action: () => onNavigate('generate', { type: DocumentType.ACTIVITY_PROPOSAL })
    },
    {
      title: 'Official Letter',
      icon: Mail,
      color: 'bg-purple-600',
      action: () => onNavigate('generate', { type: DocumentType.OFFICIAL_LETTER })
    },
    {
      title: 'Constitution & By-Laws',
      icon: Scale,
      color: 'bg-amber-500',
      action: () => onNavigate('generate', { type: DocumentType.CONSTITUTION })
    }
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Welcome, {user.name}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {user.role} • {user.organization}
          </p>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiles.map((tile, idx) => (
          <button
            key={idx}
            onClick={tile.action}
            className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left group border border-gray-200 dark:border-gray-700 h-72 flex flex-col justify-between relative overflow-hidden"
          >
            {/* Decorative Background Blob */}
            <div className={`absolute -right-8 -top-8 w-40 h-40 ${tile.color} opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-opacity`}></div>
            
            <div className="flex justify-between items-start w-full z-10">
              <div className={`w-20 h-20 ${tile.color} rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <tile.icon className="w-10 h-10" />
              </div>
            </div>
            
            <div className="z-10 mt-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-3">
                {tile.title}
              </h3>
              <p className="text-lg text-gray-500 dark:text-gray-400 flex items-center group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Start drafting <ArrowRight className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" />
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};