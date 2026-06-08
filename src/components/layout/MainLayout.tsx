import { Outlet } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import Navbar from './Navbar';

const Footer = lazy(() => import('./Footer'));

const WhatsAppAssistant = lazy(() => import('../WhatsAppAssistant'));
const IdleInquiryPopup = lazy(() => import('../IdleInquiryPopup'));

export default function MainLayout() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-charcoal font-sans">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Suspense fallback={<div className="h-64 bg-cream" />}>
        <Footer />
      </Suspense>
      <Suspense fallback={null}>
        <WhatsAppAssistant />
        <IdleInquiryPopup />
      </Suspense>

      {/* Back to top button */}
      <button
        onClick={scrollToTop}
        className={`fixed top-24 right-6 z-50 w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:bg-brand-dark transition-all duration-300 ${showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
        aria-label="Back to top"
      >
        <ArrowUp size={20} />
      </button>
    </div>
  );
}
