import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { DocumentGenerator } from './components/DocumentGenerator';
import { BudgetCalculator } from './components/BudgetCalculator';
import { MealPlanner } from './components/MealPlanner';
import { DocumentList } from './components/DocumentList';
import { Layout } from './components/Layout';
import { User, DocumentType, UserRole } from './types';
import { Settings, Moon, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewParams, setViewParams] = useState<any>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Apply theme class to document root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleNavigate = (view: string, params?: any) => {
    setCurrentView(view);
    if (params) setViewParams(params);
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    if (newUser.role === UserRole.ADMIN) {
        setCurrentView('admin-dashboard');
    } else {
        setCurrentView('dashboard');
    }
  };

  const getBackRoute = () => {
      if (user?.role === UserRole.ADMIN) {
          return 'admin-dashboard';
      }
      return 'dashboard';
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  let content;
  switch (currentView) {
    case 'dashboard':
      content = <Dashboard user={user} onNavigate={handleNavigate} />;
      break;
    case 'admin-dashboard':
      content = <AdminDashboard onNavigate={handleNavigate} />;
      break;
    case 'generate':
      content = (
        <DocumentGenerator 
          initialType={viewParams.type || DocumentType.ACTIVITY_PROPOSAL}
          onBack={() => handleNavigate(getBackRoute())} 
        />
      );
      break;
    case 'budget':
      content = <BudgetCalculator onBack={() => handleNavigate(getBackRoute())} />;
      break;
    case 'documents':
      content = <DocumentList />;
      break;
    case 'meal-planner':
      content = <MealPlanner onBack={() => handleNavigate(getBackRoute())} />;
      break;
    case 'settings':
      content = (
        <div className="flex items-center justify-center h-full p-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Settings className="w-6 h-6 text-blue-600" />
                    Appearance
                </h2>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-amber-100 text-amber-600'}`}>
                            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Adjust the interface theme
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={toggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>
        </div>
      );
      break;
    default:
      content = (
        <div className="flex items-center justify-center h-full text-gray-500">
          Page not found.
        </div>
      );
  }

  return (
    <Layout 
      user={user} 
      currentView={currentView} 
      onNavigate={handleNavigate}
      onLogout={() => setUser(null)}
    >
      {content}
    </Layout>
  );
};

export default App;