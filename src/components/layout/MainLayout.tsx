import { Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Navbar from './Navbar';

const Footer = lazy(() => import('./Footer'));

const WhatsAppAssistant = lazy(() => import('../WhatsAppAssistant'));
const IdleInquiryPopup = lazy(() => import('../IdleInquiryPopup'));

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0A192F] text-[#E6F1FF] font-sans">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Suspense fallback={<div className="h-64 bg-[#060D19]" />}>
        <Footer />
      </Suspense>
      <Suspense fallback={null}>
        <WhatsAppAssistant />
        <IdleInquiryPopup />
      </Suspense>
    </div>
  );
}
