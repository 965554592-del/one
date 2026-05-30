import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useStore } from './store/useStore';
import i18n, { loadLanguage } from './i18n';

// Layouts
import MainLayout from './components/layout/MainLayout';

// Tracking — lazy loaded (they render null, just inject scripts)
const MetaPixel = lazy(() => import('./components/MetaPixel'));
const GoogleAnalytics = lazy(() => import('./components/GoogleAnalytics'));

// Home is eager (first paint route), the rest are lazy-loaded route chunks
import Home from './pages/Home';

const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const UserCenter = lazy(() => import('./pages/UserCenter'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const About = lazy(() => import('./pages/About'));
const Debug = lazy(() => import('./pages/Debug'));
const ShipTo = lazy(() => import('./pages/ShipTo'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Factory = lazy(() => import('./pages/Factory'));
const SourcingGuides = lazy(() => import('./pages/SourcingGuides'));

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-[#FFB300] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { setUser, setUserRole, setAuthReady, setSiteSettings } = useStore();

  useEffect(() => {
    // Load saved non-English language bundle on startup.
    const savedLng = localStorage.getItem('i18nextLng') || 'en';
    if (savedLng !== 'en') loadLanguage(savedLng);
  }, []);

  useEffect(() => {
    // 1. Fetch static settings once (or use onSnapshot for settings too)
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setSiteSettings(data);
        // Cache hero image URL so subsequent visits can preload it via the
        // bootstrap script in index.html (massive LCP improvement on repeat visits).
        try {
          if (data.heroBgUrl) localStorage.setItem('heroBgUrl', data.heroBgUrl);
          if (data.heroVideoUrl) localStorage.setItem('heroVideoUrl', data.heroVideoUrl);
          else localStorage.removeItem('heroVideoUrl');
        } catch {}
      }
    }, (error) => {
      console.error("Error listening to settings:", error);
    });

    // 2. Fetch and listen to translations
    const unsubscribeTrans = onSnapshot(collection(db, 'translations'), (snapshot) => {
      snapshot.forEach((doc) => {
        const data = doc.data();
        const { key, ...langs } = data;
        Object.keys(langs).forEach((lang) => {
          if (typeof langs[lang] === 'string') {
            i18n.addResource(lang, 'translation', key, langs[lang]);
          }
        });
      });
      // Optionally trigger a language change to refresh UI
      const currentLng = i18n.language;
      i18n.changeLanguage(currentLng);
    }, (error) => {
      console.error("Error listening to translations:", error);
    });

    return () => {
      unsubscribeSettings();
      unsubscribeTrans();
    };
  }, [setSiteSettings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          const isDefaultAdmin = currentUser.email === 'admin@vida.com' || currentUser.email === '965554592@qq.com';

          if (userDoc.exists()) {
            const currentRole = userDoc.data().role;
            if (isDefaultAdmin && currentRole !== 'admin') {
              // Upgrade to admin if they are on the allowlist
              await setDoc(userRef, { role: 'admin' }, { merge: true });
              setUserRole('admin');
            } else {
              setUserRole(currentRole);
            }
          } else {
            // First login sync
            const role = isDefaultAdmin ? 'admin' : 'user';
            
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              role: role,
              createdAt: new Date().toISOString()
            });
            setUserRole(role);
          }
        } catch (error) {
          console.error("Error fetching or syncing user:", error);
          setUserRole('user');
        }
      } else {
        setUserRole(null);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [setUser, setUserRole, setAuthReady]);

  return (
    <Router>
      <Suspense fallback={null}>
        <MetaPixel />
        <GoogleAnalytics />
      </Suspense>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="about" element={<About />} />
            <Route path="factory" element={<Factory />} />
            <Route path="user" element={<UserCenter />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="ship-to" element={<ShipTo />} />
            <Route path="sourcing-guides" element={<SourcingGuides />} />
            <Route path="ship-to/:region" element={<ShipTo />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="debug" element={<Debug />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}
