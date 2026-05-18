import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useStore } from '../store/useStore';
import { LogIn, LogOut, User as UserIcon, FileText, Mail } from 'lucide-react';

export default function UserCenter() {
  const { t } = useTranslation();
  const { user, userRole } = useStore();
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // Sync is handled in App.tsx onAuthStateChanged
    } catch (error: any) {
      console.error("Login error:", error);
      setErrorMsg(error.message || t('auth.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setMessage('');

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        
        // Sync is handled in App.tsx onAuthStateChanged
        setMessage(t('auth.register_success'));
        await signOut(auth); // Sign out until they verify
      } else {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          // Skip verification for the predefined admin account or if already verified
          const isAdminEmail = userCredential.user.email === '965554592@qq.com' || userCredential.user.email === 'admin@vida.com';
          
          if (!userCredential.user.emailVerified && !isAdminEmail) {
            setErrorMsg(t('auth.verify_email'));
            await signOut(auth);
          }
        } catch (error: any) {
          // Auto-registration for the predefined admin account if it hasn't been created yet
          if (email === '965554592@qq.com' && error.code === 'auth/user-not-found') {
            await createUserWithEmailAndPassword(auth, email, password);
            // Registration success - App.tsx will handle syncing the user doc as admin
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        setErrorMsg(t('auth.operation_not_allowed'));
      } else {
        setErrorMsg(error.message || t('auth.auth_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#112240] rounded-2xl shadow-sm border border-white/5 p-8 text-center">
          <div className="w-16 h-16 bg-[#0A192F] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#FFB300]/20">
            <UserIcon className="w-8 h-8 text-[#FFB300]" />
          </div>
          <h2 className="text-2xl font-bold text-[#E6F1FF] mb-2">
            {isRegistering ? t('auth.register_title') : t('auth.welcome_title')}
          </h2>
          <p className="text-[#8892B0] mb-6">
            {isRegistering ? t('auth.register_desc') : t('auth.login_desc')}
          </p>
          
          {message && <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-md text-sm">{message}</div>}
          {errorMsg && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-md text-sm">{errorMsg}</div>}
          
          <div className="flex gap-2 mb-4">
             <button 
               onClick={() => { setEmail('965554592@qq.com'); setPassword('46023234'); }}
               className="text-[10px] uppercase tracking-widest px-2 py-1 bg-[#FFB300]/10 text-[#FFB300] border border-[#FFB300]/20 rounded hover:bg-[#FFB300]/20 transition-colors"
             >
               Quick Admin Fill
             </button>
             <div className="text-[10px] text-[#8892B0] self-center">
               Pro-Tip: Use Google Login with this account if Email/Auth is disabled.
             </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('auth.email')}</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892B0] mb-1">{t('auth.password')}</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md focus:outline-none focus:border-[#FFB300]/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-[#FFB300] text-[#0A192F] rounded-md hover:bg-[#FFCA28] text-sm font-bold transition-colors disabled:opacity-50"
            >
              {loading ? t('auth.processing') : (isRegistering ? t('auth.register_btn') : t('auth.login_btn'))}
            </button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#112240] text-[#8892B0]">{t('auth.or')}</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 border border-white/10 rounded-lg shadow-sm bg-[#0A192F] text-[#E6F1FF] hover:bg-black/50 font-medium transition-colors disabled:opacity-50 mb-4"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t('auth.google_login')}
          </button>

          <p className="text-sm text-[#8892B0]">
            {isRegistering ? t('auth.have_account') : t('auth.no_account')}
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(''); setMessage(''); }}
              className="ml-1 text-[#FFB300] hover:underline focus:outline-none"
            >
              {isRegistering ? t('auth.login_now') : t('auth.register_now')}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-[#112240] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
        <div className="p-8 border-b border-white/5 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full mr-4 border border-[#FFB300]/20" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 bg-[#0A192F] rounded-full flex items-center justify-center mr-4 border border-[#FFB300]/20">
                <UserIcon className="w-8 h-8 text-[#FFB300]" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-[#E6F1FF]">{user.displayName || t('user.default_name')}</h2>
              <p className="text-[#8892B0]">{user.email}</p>
              <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#0A192F] text-[#FFB300] capitalize border border-[#FFB300]/20">
                {userRole === 'admin' ? t('user.role_admin') : t('user.role_user')}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 border border-white/10 rounded-md text-sm font-medium text-[#E6F1FF] hover:bg-[#0A192F] transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('auth.logout')}
          </button>
        </div>
        
        <div className="p-8">
          <h3 className="text-lg font-bold text-[#E6F1FF] mb-6 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-[#FFB300]" />
            {t('user.downloaded_docs')}
          </h3>
          
          <div className="bg-[#0A192F] rounded-xl border border-white/5 p-8 text-center text-[#8892B0]">
            {t('user.no_downloads')}
          </div>
        </div>
      </div>
    </div>
  );
}
