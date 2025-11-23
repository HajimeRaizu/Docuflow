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
  Settings
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

  const getHomeRoute = () => user.role === UserRole.ADMIN ? 'admin-dashboard' : 'dashboard';

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

        {/* Desktop Navigation Links (Moved to Right) */}
        <div className="hidden md:flex items-center gap-4 lg:gap-8 ml-auto mr-6">
            <button 
              onClick={() => handleNavigate(getHomeRoute())}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                (currentView === 'dashboard' || currentView === 'admin-dashboard')
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
              }`}
            >
               <Home className="w-4 h-4" />
               <span className="hidden lg:inline">Home</span>
            </button>
            <button 
              onClick={() => handleNavigate('documents')}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                currentView === 'documents'
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
              }`}
            >
               <LayoutIcon className="w-4 h-4" />
               <span className="hidden lg:inline">My Documents</span>
            </button>
            {user.role === UserRole.ADMIN && (
              <button 
                onClick={() => handleNavigate('settings')}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  currentView === 'settings'
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden lg:inline">Settings</span>
              </button>
            )}
        </div>

        {/* User Profile Section */}
        <div className="flex items-center gap-2 md:gap-4 relative" ref={dropdownRef}>
            <div className="hidden md:block h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>
            
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 md:gap-3 outline-none group"
            >
               <div className="hidden md:flex flex-col items-end mr-1">
                   <span className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-blue-600 transition max-w-[100px] truncate">{user.name}</span>
               </div>
               <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <UserIcon className="w-4 h-4 md:w-5 md:h-5" />
               </div>
               <ChevronDown className={`hidden sm:block w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Card */}
            {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 md:mt-4 w-72 md:w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 animate-in fade-in zoom-in-95 duration-200 z-50">
                    
                    {/* User Header in Dropdown */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-3 relative">
                            <img 
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=128`} 
                                alt="Profile"
                                className="w-full h-full rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md"
                            />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-center">
                            {user.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center break-all">{user.email}</p>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700 mb-4"></div>

                    {/* Role Based Menu Items */}
                    <div className="space-y-2">
                        {user.role === UserRole.ADMIN && (
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
                  My Documents
              </button>
              {user.role === UserRole.ADMIN && (
                <button 
                  onClick={() => handleNavigate('settings')}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700 text-lg font-medium text-gray-800 dark:text-white active:bg-blue-50"
                >
                    <Settings className="w-6 h-6 text-blue-600" />
                    Settings
                </button>
              )}
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