import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, orderBy, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useStore } from '../store/useStore';
import { LogOut, User as UserIcon, FileText, Heart, Package, Clock, Eye, Trash2 } from 'lucide-react';

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
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Skip verification for the predefined admin account or if already verified
        const isAdminEmail = userCredential.user.email === '965554592@qq.com' || userCredential.user.email === 'admin@vida.com';
        
        if (!userCredential.user.emailVerified && !isAdminEmail) {
          setErrorMsg(t('auth.verify_email'));
          await signOut(auth);
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

  // ─── Tabs ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'inquiries' | 'favorites' | 'tracking'>('inquiries');

  // ─── Inquiry History ──────────────────────────────────────
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [expandedInquiry, setExpandedInquiry] = useState<string | null>(null);

  // ─── Favorites ────────────────────────────────────────────
  const [favorites, setFavorites] = useState<any[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // Fetch inquiries for this user
  useEffect(() => {
    if (!user) return;
    const fetchInquiries = async () => {
      setInquiriesLoading(true);
      try {
        // Query by userId first, fallback to email match
        const q = query(
          collection(db, 'messages'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
        );
        const snap = await getDocs(q);
        let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // If no results by userId, try email match (for old inquiries before userId was added)
        if (results.length === 0 && user.email) {
          const qEmail = query(
            collection(db, 'messages'),
            where('email', '==', user.email),
            orderBy('createdAt', 'desc'),
          );
          const snapEmail = await getDocs(qEmail);
          results = snapEmail.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        setInquiries(results);
      } catch (err) {
        console.error('[UserCenter] Failed to load inquiries:', err);
      } finally {
        setInquiriesLoading(false);
      }
    };
    fetchInquiries();
  }, [user]);

  // Fetch favorites
  useEffect(() => {
    if (!user) return;
    const fetchFavorites = async () => {
      setFavoritesLoading(true);
      try {
        const q = query(collection(db, 'users', user.uid, 'favorites'), orderBy('addedAt', 'desc'));
        const snap = await getDocs(q);
        const favIds = snap.docs.map(d => ({ favDocId: d.id, ...d.data() }));
        // Fetch product details
        const products: any[] = [];
        for (const fav of favIds) {
          const pid = (fav as any).productId;
          if (!pid) continue;
          const pDoc = await getDoc(doc(db, 'products', pid));
          if (pDoc.exists()) {
            products.push({ favDocId: fav.favDocId, id: pDoc.id, ...pDoc.data(), addedAt: (fav as any).addedAt });
          }
        }
        setFavorites(products);
      } catch (err) {
        console.error('[UserCenter] Failed to load favorites:', err);
      } finally {
        setFavoritesLoading(false);
      }
    };
    fetchFavorites();
  }, [user]);

  const removeFavorite = async (favDocId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'favorites', favDocId));
      setFavorites(prev => prev.filter(f => f.favDocId !== favDocId));
    } catch (err) {
      console.error('[UserCenter] Failed to remove favorite:', err);
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      new: { label: t('user.status_new', 'Submitted'), color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
      processing: { label: t('user.status_processing', 'In Progress'), color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
      processed: { label: t('user.status_processed', 'Replied'), color: 'text-green-400 bg-green-500/10 border-green-500/20' },
      closed: { label: t('user.status_closed', 'Closed'), color: 'text-[#8892B0] bg-white/5 border-white/10' },
    };
    return map[status] || map.new;
  };

  const tabs = [
    { key: 'inquiries' as const, label: t('user.tab_inquiries', 'My Inquiries'), icon: FileText, count: inquiries.length },
    { key: 'favorites' as const, label: t('user.tab_favorites', 'Favorites'), icon: Heart, count: favorites.length },
    { key: 'tracking' as const, label: t('user.tab_tracking', 'Order Tracking'), icon: Package },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      {/* Profile Header */}
      <div className="bg-[#112240] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
        <div className="p-8 flex flex-col md:flex-row items-center justify-between">
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
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? 'bg-[#FFB300] text-[#0A192F]' : 'bg-[#112240] text-[#8892B0] border border-white/5 hover:text-[#E6F1FF]'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-[#0A192F]/20 text-[#0A192F]' : 'bg-[#FFB300]/10 text-[#FFB300]'}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[#112240] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
        {/* ─── Inquiries Tab ─── */}
        {activeTab === 'inquiries' && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-[#E6F1FF] mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-[#FFB300]" />
              {t('user.inquiry_history', 'Inquiry History')}
            </h3>
            {inquiriesLoading ? (
              <div className="text-center py-12 text-[#8892B0]">{t('common.loading', 'Loading...')}</div>
            ) : inquiries.length === 0 ? (
              <div className="bg-[#0A192F] rounded-xl border border-white/5 p-12 text-center">
                <FileText className="w-10 h-10 text-[#8892B0]/30 mx-auto mb-3" />
                <p className="text-[#8892B0]">{t('user.no_inquiries', 'No inquiries yet. Submit one from the homepage!')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inquiries.map((inq: any) => {
                  const st = statusLabel(inq.status);
                  const isExpanded = expandedInquiry === inq.id;
                  return (
                    <div key={inq.id} className="bg-[#0A192F] rounded-lg border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedInquiry(isExpanded ? null : inq.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#E6F1FF] truncate">{inq.partNeed || inq.vehicleModel || t('user.general_inquiry', 'General Inquiry')}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-[#8892B0] mt-1">
                            {inq.company && `${inq.company} · `}
                            {new Date(inq.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Eye className={`w-4 h-4 text-[#8892B0] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            {inq.name && <div><span className="text-[#8892B0]">{t('form.name', 'Name')}:</span> <span className="text-[#E6F1FF]">{inq.name}</span></div>}
                            {inq.email && <div><span className="text-[#8892B0]">{t('form.email', 'Email')}:</span> <span className="text-[#E6F1FF]">{inq.email}</span></div>}
                            {inq.phone && <div><span className="text-[#8892B0]">{t('form.phone', 'Phone')}:</span> <span className="text-[#E6F1FF]">{inq.phone}</span></div>}
                            {inq.vehicleModel && <div><span className="text-[#8892B0]">{t('form.vehicle', 'Vehicle')}:</span> <span className="text-[#E6F1FF]">{inq.vehicleModel}</span></div>}
                            {inq.quantity && <div><span className="text-[#8892B0]">{t('form.quantity', 'Qty')}:</span> <span className="text-[#E6F1FF]">{inq.quantity}</span></div>}
                          </div>
                          {inq.message && (
                            <div className="mt-2 p-3 bg-[#112240] rounded-md text-[#8892B0] whitespace-pre-wrap text-xs">{inq.message}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Favorites Tab ─── */}
        {activeTab === 'favorites' && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-[#E6F1FF] mb-4 flex items-center">
              <Heart className="w-5 h-5 mr-2 text-[#FFB300]" />
              {t('user.my_favorites', 'Favorite Products')}
            </h3>
            {favoritesLoading ? (
              <div className="text-center py-12 text-[#8892B0]">{t('common.loading', 'Loading...')}</div>
            ) : favorites.length === 0 ? (
              <div className="bg-[#0A192F] rounded-xl border border-white/5 p-12 text-center">
                <Heart className="w-10 h-10 text-[#8892B0]/30 mx-auto mb-3" />
                <p className="text-[#8892B0]">{t('user.no_favorites', 'No favorites yet. Browse products and tap the heart icon!')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {favorites.map((prod: any) => (
                  <div key={prod.favDocId} className="bg-[#0A192F] rounded-lg border border-white/5 overflow-hidden flex">
                    {prod.images?.[0] && (
                      <img src={prod.images[0]} alt={prod.title} className="w-24 h-24 object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-[#E6F1FF] truncate">{prod.title}</h4>
                        <p className="text-xs text-[#8892B0] mt-0.5">{prod.category}</p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <a href={`/products/${prod.id}`} className="text-xs text-[#FFB300] hover:underline">{t('user.view_product', 'View')}</a>
                        <button onClick={() => removeFavorite(prod.favDocId)} className="text-[#8892B0] hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Order Tracking Tab ─── */}
        {activeTab === 'tracking' && (
          <div className="p-6">
            <h3 className="text-lg font-bold text-[#E6F1FF] mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-[#FFB300]" />
              {t('user.order_tracking', 'Order Tracking')}
            </h3>
            {inquiries.filter(i => i.status === 'processing' || i.status === 'processed').length === 0 ? (
              <div className="bg-[#0A192F] rounded-xl border border-white/5 p-12 text-center">
                <Package className="w-10 h-10 text-[#8892B0]/30 mx-auto mb-3" />
                <p className="text-[#8892B0]">{t('user.no_orders', 'No active orders. Your inquiries will appear here once they are being processed.')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inquiries.filter(i => i.status !== 'new').map((inq: any) => {
                  const steps = ['new', 'processing', 'processed', 'closed'];
                  const stepLabels = [
                    t('user.step_submitted', 'Submitted'),
                    t('user.step_reviewing', 'Reviewing'),
                    t('user.step_replied', 'Replied'),
                    t('user.step_closed', 'Closed'),
                  ];
                  const currentStep = steps.indexOf(inq.status);
                  return (
                    <div key={inq.id} className="bg-[#0A192F] rounded-lg border border-white/5 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-[#E6F1FF]">{inq.partNeed || inq.vehicleModel || t('user.general_inquiry', 'General Inquiry')}</h4>
                        <span className="text-xs text-[#8892B0]">{new Date(inq.createdAt).toLocaleDateString()}</span>
                      </div>
                      {/* Progress Steps */}
                      <div className="flex items-center">
                        {steps.map((step, i) => (
                          <div key={step} className="flex-1 flex items-center">
                            <div className={`flex flex-col items-center flex-1`}>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${i <= currentStep ? 'bg-[#FFB300] border-[#FFB300] text-[#0A192F]' : 'bg-[#112240] border-white/10 text-[#8892B0]'}`}>
                                {i < currentStep ? '✓' : i + 1}
                              </div>
                              <span className={`text-[10px] mt-1 text-center ${i <= currentStep ? 'text-[#FFB300]' : 'text-[#8892B0]'}`}>{stepLabels[i]}</span>
                            </div>
                            {i < steps.length - 1 && (
                              <div className={`h-0.5 flex-1 mx-1 ${i < currentStep ? 'bg-[#FFB300]' : 'bg-white/10'}`} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
