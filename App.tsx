import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { GovernorDashboard } from './components/admin/GovernorDashboard';
import { RoleSelection } from './components/auth/RoleSelection';
import { DocumentGenerator } from './components/DocumentGenerator';
import { DocumentList } from './components/DocumentList';
import { ArchiveView } from './components/dashboard/ArchiveView';
import { Layout } from './components/Layout';
import { User, DocumentType, UserRole } from './types';
import { Settings, Moon, Sun, Sparkles, CheckCircle, Save, X, Loader, Clock, AlertTriangle } from 'lucide-react';

// ... Keep SettingsModal (omitted for brevity, assume it's there or I should include it. The user has "Settings" in the Layout. I'll include it to be safe.)
// Actually I'll include the SettingsModal code from the previous file to ensure no regression.
interface SettingsModalProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ theme, toggleTheme, onClose }) => {
  const [aiSettings, setAiSettings] = useState({ tone: 'Formal', length: 'Standard' });
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('nemsu_ai_settings');
    if (saved) {
      try {
        setAiSettings(JSON.parse(saved));
      } catch (e) { }
    }
  }, []);

  const saveAISettings = () => {
    localStorage.setItem('nemsu_ai_settings', JSON.stringify(aiSettings));
    setSaveStatus('Preferences Saved!');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl relative animate-scale-in border border-gray-100 dark:border-gray-700 max-h-[90vh] flex flex-col overflow-hidden">

        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="overflow-y-auto p-6 custom-scrollbar">
          <div className="text-center pt-4 pb-2">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-blue-50 dark:ring-blue-900/20">
              <Settings className="w-10 h-10 animate-spin-slow" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Settings</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 px-8 mb-8 leading-relaxed">
              Customize your interface appearance and AI generation preferences.
            </p>
          </div>

          <div className="space-y-6 text-left">
            {/* Appearance Section */}
            <section>
              <h3 className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider flex items-center gap-2">
                <Sun className="w-3 h-3" /> Appearance
              </h3>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 transition hover:border-gray-200 dark:hover:border-gray-500">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-amber-100 text-amber-600'}`}>
                    {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
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
            </section>

            {/* AI Configuration Section */}
            <section>
              <h3 className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 mb-3 tracking-wider flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> AI Preferences
              </h3>

              <div className="p-5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 space-y-5">
                {/* Tone Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Tone of Voice</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Formal', 'Academic', 'Professional', 'Direct'].map((tone) => (
                      <button
                        key={tone}
                        onClick={() => setAiSettings({ ...aiSettings, tone })}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${aiSettings.tone === tone
                          ? 'bg-white dark:bg-gray-600 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500 shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Length Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Response Length</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Concise', 'Standard', 'Detailed'].map((len) => (
                      <button
                        key={len}
                        onClick={() => setAiSettings({ ...aiSettings, length: len })}
                        className={`px-2 py-2 rounded-lg border text-xs font-medium transition-all ${aiSettings.length === len
                          ? 'bg-white dark:bg-gray-600 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500 shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={saveAISettings}
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold text-sm transition shadow-md shadow-blue-200 dark:shadow-blue-900/30 flex items-center justify-center gap-2 active:scale-95"
                >
                  {saveStatus ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saveStatus || 'Save Preferences'}
                </button>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700 text-center">
            <button
              onClick={onClose}
              className="text-sm font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewParams, setViewParams] = useState<any>({});
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('nemsu_theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Apply theme class to document root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('nemsu_theme', newTheme);
      return newTheme;
    });
  };

  const handleNavigate = (view: string, params?: any) => {
    if (view === 'settings') {
      setIsSettingsOpen(true);
      return;
    }
    setCurrentView(view);
    if (params) setViewParams(params);
  };

  const reloadUser = async () => {
    // Re-fetch user session to update state (e.g. after approving self or role change)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) handleSession(session);
  };

  const handleSession = async (session: any) => {
    try {
      if (!session?.user) {
        setUser(null);
      } else {
        // 2. Fetch Active/Pending Role
        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', session.user.id)
          .neq('status', 'disabled') // Fetch latest non-disabled role
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // 3. Fetch Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setUser({
          id: session.user.id,
          email: session.user.email!,
          full_name: profileData?.full_name || session.user.user_metadata?.full_name || 'User',
          avatar_url: profileData?.avatar_url || session.user.user_metadata?.avatar_url,
          role_id: roleData?.id,
          user_type: roleData?.role as UserRole,
          specific_role: roleData?.specific_role,
          department: roleData?.department,
          status: roleData?.status,
          permissions: roleData?.permissions
        });
      }
    } catch (err) {
      console.error('Auth handler error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-900 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-serif italic text-blue-900 dark:text-blue-400 animate-pulse">SmartDraft</h2>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={(u) => setUser(u)} theme={theme} toggleTheme={toggleTheme} />;
  }

  // 1. Role Selection (No Role ID)
  if (!user.role_id && user.user_type !== UserRole.SUPER_ADMIN) {
    return <RoleSelection user={user} onRequestSubmitted={reloadUser} />;
  }

  // 2. Pending Approval
  if (user.status === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Approval Pending</h2>
          <p className="text-gray-600 mb-6">
            Your request to join as <strong>{user?.specific_role?.replace('Staff', 'Official') || 'University Official'}</strong>
            <br /> in <strong>NEMSU</strong> is currently under review.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-gray-500 hover:text-gray-800 underline"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // 3. Rejected
  if (user.status === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Rejected</h2>
          <p className="text-gray-600 mb-6">
            Your request was rejected. Please contact the administrator.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="bg-blue-900 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // 4. Unified Routing
  // University Staff and Regular Officers -> Standard Dashboard
  // Governors/Presidents -> Governor Dashboard (only for default view)
  const isGovernor = user.user_type === UserRole.ADMIN && user.specific_role !== 'University Staff';

  let content;
  switch (currentView) {
    case 'dashboard':
      // Everyone sees the standard dashboard by default
      content = <Dashboard user={user} onNavigate={handleNavigate} />;
      break;

    case 'admin-dashboard':
      if (user.user_type === UserRole.SUPER_ADMIN) {
        return <SuperAdminDashboard user={user} onNavigate={handleNavigate} onLogout={() => supabase.auth.signOut()} />;
      }
      if (isGovernor) {
        return <GovernorDashboard user={user} onNavigate={handleNavigate} onLogout={() => supabase.auth.signOut()} />;
      }
      // Fallback
      content = <Dashboard user={user} onNavigate={handleNavigate} />;
      break;

    case 'generate':
      content = (
        <DocumentGenerator
          user={user}
          initialType={viewParams.type || DocumentType.ACTIVITY_PROPOSAL}
          initialDoc={viewParams.doc}
          onBack={() => handleNavigate('dashboard')}
        />
      );
      break;

    case 'documents':
      content = <DocumentList user={user} onNavigate={handleNavigate} />;
      break;

    case 'archives':
      content = (
        <ArchiveView
          user={user}
          onUseReference={(doc) => handleNavigate('generate', {
            doc: { ...doc, id: '', title: `Copy of ${doc.title}` },
            type: doc.type
          })}
        />
      );
      break;

    default:
      content = <Dashboard user={user} onNavigate={handleNavigate} />;
  }

  return (
    <Layout
      user={user}
      currentView={currentView}
      onNavigate={handleNavigate}
      onLogout={() => {
        supabase.auth.signOut();
        setUser(null);
      }}
    >
      {content}
      {isSettingsOpen && (
        <SettingsModal
          theme={theme}
          toggleTheme={toggleTheme}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </Layout>
  );
};

export default App;
