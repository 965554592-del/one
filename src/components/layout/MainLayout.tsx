import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppAssistant from '../WhatsAppAssistant';

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0A192F] text-[#E6F1FF] font-sans">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppAssistant />
    </div>
  );
}
