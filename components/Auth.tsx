import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Eye, EyeOff, Mail, Lock, Moon, Sun } from 'lucide-react';
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
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-6 transition-colors duration-200">
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        title="Toggle Theme"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* Branding (First on Mobile, Last on Desktop) */}
        <div className="text-center lg:text-left flex flex-col items-center lg:items-center justify-center p-4 lg:order-last">
          <h1 className="text-6xl md:text-7xl font-serif italic text-blue-900 dark:text-blue-400 mb-6 drop-shadow-sm transition-colors">
            SmartDraft
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 font-serif max-w-lg leading-relaxed text-center transition-colors">
            AI-Powered Document Automation System — simplify your workflow, boost productivity, and automate your document generation efficiently.
          </p>
        </div>

        {/* Login Form (Second on Mobile, First on Desktop) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 md:p-10 max-w-md w-full mx-auto transition-colors flex flex-col items-center justify-center">
          <h2 className="text-3xl font-serif italic text-center text-blue-900 dark:text-white mb-8 transition-colors">
            Welcome!
          </h2>

          <div className="w-full space-y-6">
            <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-4">
              Sign in with your university account to continue.
            </p>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg border border-red-100 animate-shake">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-lg transform active:scale-95 shadow-md"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  className="text-blue-600 dark:text-blue-400"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  className="text-green-600"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-.19-.58z"
                  className="text-yellow-500"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  className="text-red-500"
                />
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-[10px] text-gray-400 mt-8 uppercase tracking-widest font-bold">
              Secure OAuth 2.0 Identity Verification
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};