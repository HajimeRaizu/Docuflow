import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Eye, EyeOff, Mail, Lock, Moon, Sun, Sparkles, Shield } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface AuthProps {
  onLogin: (user: User) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin, theme, toggleTheme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred during Google login.');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // 2. Supabase Auth Login
      const { data: { user: authUser }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authUser) {
        // 3. Fetch Active Role
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('status', 'active')
          .maybeSingle();

        if (roleError && roleError.code !== 'PGRST116') { // PGRST116 is "Row not found" which is fine here
          console.error('Error fetching role:', roleError);
        }

        // 4. Fetch Profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profileError && !profileData) {
          // If profile doesn't exist yet (trigger failed?), we might need to create it or show error
          // ideally trigger handles it.
          console.error('Profile not found:', profileError);
          throw new Error('User profile not found.');
        }

        const constructedUser: User = {
          id: authUser.id,
          email: authUser.email!,
          full_name: profileData?.full_name || authUser.user_metadata?.full_name || 'User',
          avatar_url: profileData?.avatar_url || authUser.user_metadata?.avatar_url,
          // Role Data
          role_id: roleData?.id,
          user_type: roleData?.role as UserRole,
          specific_role: roleData?.specific_role,
          department: roleData?.department,
          status: roleData?.status || 'pending',
          permissions: roleData?.permissions
        };

        onLogin(constructedUser);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid login credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col lg:flex-row transition-colors duration-500 overflow-hidden">
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 p-2.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-lg border border-gray-100 dark:border-gray-700 transition-all active:scale-95"
        title="Toggle Theme"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* LEFT SIDE: PRODUCT SHOWCASE */}
      <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100/50 dark:from-gray-900 dark:to-indigo-950/30 p-6 lg:p-12 flex flex-col justify-center relative">
        {/* Subtle Decorative Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400/10 dark:bg-blue-600/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-400/10 dark:bg-indigo-600/5 rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-2xl">
          {/* Logo Section */}
          <div className="flex items-center gap-4 mb-8 group">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white uppercase">
              NEMSify
            </h1>
          </div>

          <div className="space-y-2 mb-6">
            <span className="text-sm font-black tracking-[0.2em] text-blue-600 dark:text-blue-400 uppercase">
              AI Document Automation
            </span>
            <h2 className="text-5xl lg:text-7xl font-bold text-gray-900 dark:text-white leading-[1.1]">
              Documents that <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
                write themselves.
              </span>
            </h2>
          </div>

          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md leading-relaxed mb-10">
            Automate your entire document workflow — from first draft to final output — powered by AI.
          </p>

          {/* Feature Cards */}
          <div className="space-y-3">
            {[
              {
                icon: <Sparkles className="w-5 h-5" />,
                title: "AI generation",
                desc: "Documents in seconds",
                color: "bg-blue-600"
              },
              {
                icon: <div className="grid grid-cols-2 gap-0.5"><div className="w-2 h-2 bg-current opacity-40" /><div className="w-2 h-2 bg-current" /><div className="w-2 h-2 bg-current" /><div className="w-2 h-2 bg-current opacity-40" /></div>,
                title: "Smart templates",
                desc: "For every use case",
                color: "bg-indigo-600"
              },
              {
                icon: <Lock className="w-5 h-5" />,
                title: "Secure",
                desc: "Allows NEMSU emails only for security",
                color: "bg-blue-500"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-white/60 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-2xl transition hover:translate-x-2 shadow-sm"
              >
                <div className={`w-12 h-12 ${feature.color} text-white rounded-xl flex items-center justify-center`}>
                  {feature.icon}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">{feature.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: AUTH CARD */}
      <div className="flex-1 bg-white dark:bg-gray-900 flex items-center justify-center p-8 relative">
        <div className="max-w-md w-full animate-fade-up">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col items-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              Welcome back
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center text-sm">
              Sign in with your university account.
            </p>

            {error && (
              <div className="w-full text-red-500 text-sm text-center bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/20 mb-6 animate-shake">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              className="group w-full bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-100 text-gray-900 dark:text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 mb-6"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.2662 9.76453C6.19903 6.93863 8.85469 4.90909 12 4.90909C13.6909 4.90909 15.2182 5.50909 16.4182 6.49091L19.9091 3C17.7818 1.14545 15.0545 0 12 0C7.27273 0 3.19091 2.69091 1.24091 6.65455L5.2662 9.76453Z" />
                <path fill="#34A853" d="M16.0409 18.0136C14.8708 18.7115 13.486 19.0909 12 19.0909C8.85469 19.0909 6.19903 17.0614 5.2662 14.2355L1.24091 17.3455C3.19091 21.3091 7.27273 24 12 24C14.9395 24 17.6146 22.9568 19.6713 21.2189L16.0409 18.0136Z" />
                <path fill="#4285F4" d="M11.9999 43.6364C17.6363 43.6364 22.3635 39.8182 23.6363 34.5455H12V39.0909H19.2272C18.4545 43.2727 15.3181 46.3636 12 46.3636" className="hidden" />
                <path fill="#4285F4" d="M23.64 12.2182C23.64 11.4 23.57 10.6 23.44 9.81818H12V14.4545H18.5273C18.2455 15.9682 17.3955 17.2545 16.1182 18.1091L19.7486 21.3146C22.0494 19.2848 23.64 16.1518 23.64 12.2182Z" />
                <path fill="#FBBC05" d="M5.2664 14.2355C5.0264 13.5155 4.8864 12.7555 4.8864 11.9636C4.8864 11.1717 5.0264 10.4117 5.2664 9.69176L1.24111 6.58179C0.43 8.20361 0 10.0363 0 11.9636C0 13.8909 0.43 15.7236 1.24111 17.3454L5.2664 14.2355Z" />
              </svg>
              Continue with Google
              <span className="hidden lg:inline group-hover:translate-x-1 transition-transform">→</span>
            </button>

            <div className="mb-4">
              <span className="text-[10px] font-black tracking-[0.2em] text-gray-400 dark:text-gray-500 uppercase">
                NEMSU EMAILS ONLY
              </span>
            </div>

            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-[10px] font-black tracking-wider bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full uppercase">
              <Shield className="w-3 h-3" /> Secure OAuth 2.0 Identity Verification
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
