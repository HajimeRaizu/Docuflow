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
      docType: DocumentType.ACTIVITY_PROPOSAL,
      action: () => onNavigate('generate', { type: DocumentType.ACTIVITY_PROPOSAL }),
      enabled: user.permissions?.activity_proposal === 'edit'
    },
    {
      title: 'Official Letter',
      icon: Mail,
      color: 'bg-purple-600',
      docType: DocumentType.OFFICIAL_LETTER,
      action: () => onNavigate('generate', { type: DocumentType.OFFICIAL_LETTER }),
      enabled: user.permissions?.official_letter === 'edit'
    },
    {
      title: 'Constitution & By-Laws',
      icon: Scale,
      color: 'bg-amber-500',
      docType: DocumentType.CONSTITUTION,
      action: () => onNavigate('generate', { type: DocumentType.CONSTITUTION }),
      enabled: user.permissions?.constitution === 'edit'
    }
  ];

  return (
    <div className="p-8 md:p-12 max-w-[1400px] mx-auto space-y-12">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-950 dark:text-white tracking-tight">
          Welcome, {user.full_name}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">
          {user.specific_role || user.user_type} • {user.department}
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiles.map((tile, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-500 p-8 flex flex-col items-center text-center group relative overflow-hidden h-[400px]"
          >
            {/* Top Section with Dot Pattern or Dotted Circle */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative mb-8">
                {/* Dotted Outer Circle */}
                <div className="absolute inset-[-12px] rounded-full border-2 border-dashed border-blue-200 dark:border-blue-800/50 group-hover:rotate-45 transition-transform duration-1000"></div>

                {/* Icon Container */}
                <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-2xl relative z-10 transform group-hover:scale-110 transition-transform duration-500">
                  <tile.icon className="w-12 h-12" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {tile.title}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-base">
                {tile.title === 'New Activity Proposal' && 'Start drafting a new proposal.'}
                {tile.title === 'Official Letter' && 'Create an official letter.'}
                {tile.title === 'Constitution & By-Laws' && 'Draft or revise by-laws.'}
              </p>
            </div>

            {/* Bottom Button */}
            <button
              onClick={tile.enabled ? tile.action : () => onNavigate('documents', { initialTab: 'shared', initialType: tile.docType })}
              className={`
                w-full py-4 px-6 rounded-full font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group/btn
              `}
            >
              Start drafting
              <ArrowRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};