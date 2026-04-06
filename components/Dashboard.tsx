import React from 'react';
import { User, DocumentType, DocumentTypeIcon, DocumentTypeColor } from '../types';
import { ArrowRight } from 'lucide-react';

interface DashboardProps {
  user: User;
  onNavigate: (page: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {

  const tiles = [
    {
      title: 'New Activity Proposal',
      icon: DocumentTypeIcon[DocumentType.ACTIVITY_PROPOSAL],
      color: DocumentTypeColor[DocumentType.ACTIVITY_PROPOSAL],
      docType: DocumentType.ACTIVITY_PROPOSAL,
      action: () => onNavigate('generate', { type: DocumentType.ACTIVITY_PROPOSAL }),
      enabled: user.permissions?.activity_proposal === 'edit'
    },
    {
      title: 'Official Letter',
      icon: DocumentTypeIcon[DocumentType.OFFICIAL_LETTER],
      color: DocumentTypeColor[DocumentType.OFFICIAL_LETTER],
      docType: DocumentType.OFFICIAL_LETTER,
      action: () => onNavigate('generate', { type: DocumentType.OFFICIAL_LETTER }),
      enabled: user.permissions?.official_letter === 'edit'
    },
    {
      title: 'Constitution & By-Laws',
      icon: DocumentTypeIcon[DocumentType.CONSTITUTION],
      color: DocumentTypeColor[DocumentType.CONSTITUTION],
      docType: DocumentType.CONSTITUTION,
      action: () => onNavigate('generate', { type: DocumentType.CONSTITUTION }),
      enabled: user.permissions?.constitution === 'edit'
    }
  ];

  return (
    <div className="p-4 md:p-8 lg:p-12 max-w-[1400px] mx-auto space-y-8 md:space-y-12">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-950 dark:text-white tracking-tight">
          Welcome, {user.full_name}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium text-base md:text-lg">
          {user.specific_role || user.user_type} • {user.department}
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {tiles.map((tile, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl transition-all duration-500 p-6 md:p-8 flex flex-col items-center text-center group relative overflow-hidden h-[320px] md:h-[400px]"
          >
            {/* Top Section with Dot Pattern or Dotted Circle */}
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <div className="relative mb-6 md:mb-8">
                {/* Dotted Outer Circle */}
                <div className="absolute inset-[-10px] md:inset-[-12px] rounded-full border-2 border-dashed border-blue-200 dark:border-blue-800/50 group-hover:rotate-45 transition-transform duration-1000"></div>

                {/* Icon Container */}
                <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${tile.color} flex items-center justify-center text-white shadow-2xl relative z-10 transform group-hover:scale-110 transition-transform duration-500`}>
                  <tile.icon className="w-10 h-10 md:w-12 md:h-12" />
                </div>
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {tile.title}
              </h3>
              <p className="hidden md:block text-gray-500 dark:text-gray-400 text-base">
                {tile.title === 'New Activity Proposal' && 'Start drafting a new proposal.'}
                {tile.title === 'Official Letter' && 'Create an official letter.'}
                {tile.title === 'Constitution & By-Laws' && 'Draft or revise by-laws.'}
              </p>
            </div>

            {/* Bottom Button */}
            <button
              onClick={tile.enabled ? tile.action : () => onNavigate('documents', { initialTab: 'shared', initialType: tile.docType })}
              className={`
                w-full py-3 md:py-4 px-6 rounded-full font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group/btn mt-auto
              `}
            >
              {tile.enabled ? 'Start draft' : 'View Documents'}
              <ArrowRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};