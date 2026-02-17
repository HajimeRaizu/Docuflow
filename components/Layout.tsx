
import React, { useState, useRef, useEffect } from 'react';
import { User, UserRole } from '../types';
import {
  Shield,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Home,
  Layout as LayoutIcon,
  Menu,
  X,
  Settings,
  Archive
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentView, onNavigate, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  const getHomeRoute = () => 'dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200 font-sans">

      {/* Top Navigation Bar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 px-4 md:px-8 flex items-center justify-between sticky top-0 z-50 shadow-sm shrink-0">

        {/* Brand */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-600 dark:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <h1
            onClick={() => handleNavigate(getHomeRoute())}
            className="text-xl md:text-2xl lg:text-3xl font-serif italic text-blue-950 dark:text-white cursor-pointer select-none truncate"
          >
            SmartDraft
          </h1>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-8 ml-auto px-8">
          <button
            onClick={() => handleNavigate(getHomeRoute())}
            className={`flex items-center gap-2 text-[15px] font-medium transition-colors ${(currentView === 'dashboard' || currentView === 'admin-dashboard')
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
              }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
          <button
            onClick={() => handleNavigate('documents')}
            className={`flex items-center gap-2 text-[15px] font-medium transition-colors ${currentView === 'documents'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
              }`}
          >
            <LayoutIcon className="w-4 h-4" />
            <span>Documents</span>
          </button>
          <button
            onClick={() => handleNavigate('archives')}
            className={`flex items-center gap-2 text-[15px] font-medium transition-colors ${currentView === 'archives'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
              }`}
          >
            <Archive className="w-4 h-4" />
            <span>Archives</span>
          </button>
        </div>

        {/* User Profile Section */}
        <div className="flex items-center gap-4 relative" ref={dropdownRef}>
          <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2"></div>

          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 outline-none group"
          >
            <span className="text-[15px] font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600 transition truncate max-w-[150px]">
              {user.full_name}
            </span>
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800 shadow-sm overflow-hidden transition-transform group-hover:scale-105">
              <img
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=0D8ABC&color=fff&size=80`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          </button>

          {/* Dropdown Card */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 md:mt-4 w-72 md:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 animate-in fade-in zoom-in-95 duration-200 z-50">

              {/* User Header in Dropdown */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-3 relative">
                  <img
                    src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=0D8ABC&color=fff&size=128`}
                    alt="Profile"
                    onError={(e) => {
                      e.currentTarget.onerror = null; // prevent loop
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=0D8ABC&color=fff&size=128`;
                    }}
                    className="w-full h-full rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md"
                  />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-center">
                  {user.full_name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center break-all">{user.email}</p>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 mb-4"></div>

              {/* Role Based Menu Items */}
              <div className="space-y-2">
                {(user.user_type === UserRole.SUPER_ADMIN || (user.user_type === UserRole.ADMIN && user.specific_role !== 'University Staff' && user.specific_role !== 'University Official')) && (
                  <button
                    onClick={() => handleNavigate('admin-dashboard')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 rounded-xl transition group"
                  >
                    <Shield className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                    Admin Dashboard
                  </button>
                )}

                <button
                  onClick={() => handleNavigate('settings')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 rounded-xl transition group"
                >
                  <Settings className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors group-hover:scale-110 transition-transform" />
                  Settings
                </button>

                <div className="border-t border-gray-100 dark:border-gray-700 my-2 pt-2">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navigation Menu (Overlay) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white dark:bg-gray-800 pt-20 px-6 animate-in slide-in-from-top-10 duration-200">
          <nav className="flex flex-col gap-4">
            <button
              onClick={() => handleNavigate(getHomeRoute())}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-lg font-medium text-gray-800 dark:text-white active:bg-blue-50"
            >
              <Home className="w-6 h-6 text-blue-600" />
              Home
            </button>
            <button
              onClick={() => handleNavigate('documents')}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-lg font-medium text-gray-800 dark:text-white active:bg-blue-50"
            >
              <LayoutIcon className="w-6 h-6 text-blue-600" />
              Documents
            </button>
            <button
              onClick={() => handleNavigate('archives')}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-lg font-medium text-gray-800 dark:text-white active:bg-blue-50"
            >
              <Archive className="w-6 h-6 text-blue-600" />
              Archives
            </button>
            <button
              onClick={() => handleNavigate('settings')}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-lg font-medium text-gray-800 dark:text-white active:bg-blue-50"
            >
              <Settings className="w-6 h-6 text-blue-600" />
              Settings
            </button>
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};
