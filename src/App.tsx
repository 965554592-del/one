import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { useStore } from './store/useStore';
import i18n from './i18n';
import './i18n';

// Layouts
import MainLayout from './components/layout/MainLayout';

// Pages
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import UserCenter from './pages/UserCenter';
import AdminDashboard from './pages/AdminDashboard';
import About from './pages/About';

export default function App() {
  const { setUser, setUserRole, setAuthReady, setSiteSettings } = useStore();

  useEffect(() => {
    // 1. Fetch static settings once (or use onSnapshot for settings too)
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSiteSettings(docSnap.data() as any);
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
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="about" element={<About />} />
          <Route path="user" element={<UserCenter />} />
          <Route path="admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </Router>
  );
}
