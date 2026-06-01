import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Twitter, Facebook, Linkedin, Instagram, Share2, MapPin, Phone, Mail, MessageSquare, Activity, ShieldCheck } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store/useStore';

export default function Footer() {
  const { t, i18n } = useTranslation();
  const { siteSettings } = useStore();
  const [contacts, setContacts] = useState<any[]>([]);

  const rawPhone = siteSettings?.phone || "861234567890";
  const whatsappNumber = rawPhone.replace(/[^\d+]/g, '');
  const whatsappUrl = siteSettings?.whatsappLink || `https://wa.me/${whatsappNumber}`;

  useEffect(() => {
    const q = query(collection(db, 'contacts'), orderBy('order'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Firestore Error in Footer:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleShare = async () => {
    const shareData = {
      title: t('footer.share_title'),
      text: t('footer.share_text'),
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert(t('footer.share_success'));
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    }
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'MapPin': return <MapPin className="w-4 h-4 mr-2 text-[#FFB300] shrink-0 mt-0.5" />;
      case 'Phone': return <Phone className="w-4 h-4 mr-2 text-[#FFB300] shrink-0" />;
      case 'Mail': return <Mail className="w-4 h-4 mr-2 text-[#FFB300] shrink-0" />;
      case 'MessageSquare': return <MessageSquare className="w-4 h-4 mr-2 text-[#FFB300] shrink-0" />;
      case 'Activity': return <Activity className="w-4 h-4 mr-2 text-[#FFB300] shrink-0" />;
      case 'ShieldCheck': return <ShieldCheck className="w-4 h-4 mr-2 text-[#FFB300] shrink-0" />;
      default: return <Mail className="w-4 h-4 mr-2 text-[#FFB300] shrink-0" />;
    }
  };
  
  return (
    <footer className="bg-[#0A192F] text-[#8892B0] py-12 border-t border-[#FFB300]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand & Address */}
          <div className="flex flex-col items-center md:items-start">
            <span className="text-2xl font-bold text-[#FFB300] tracking-tight mb-4">VIDA AUTO</span>
            <p className="text-sm mb-4 text-center md:text-left">{t('footer.tagline')}</p>
            
            <div className="space-y-3 text-sm w-full">
              {contacts.length > 0 ? (
                contacts.map(c => (
                  <div key={c.id} className="flex items-start">
                    {getIcon(c.icon)}
                    <div className="flex flex-col">
                      {(c.label_zh || c.label_en) && (
                        <span className="text-[10px] text-[#E6F1FF] font-bold uppercase tracking-widest opacity-60">
                          {i18n.language === 'zh' ? c.label_zh || c.label_en : c.label_en || c.label_zh}
                        </span>
                      )}
                      <span>{i18n.language === 'zh' ? c.value_zh || c.value_en : c.value_en || c.value_zh}</span>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-start">
                    <MapPin className="w-4 h-4 mr-2 text-[#FFB300] shrink-0 mt-0.5" />
                    <span className="footer-address-text">{siteSettings?.address || t('footer.address')}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-[#FFB300] shrink-0" />
                    <span>{siteSettings?.phone || '+86 123 4567 8901'}</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-[#FFB300] shrink-0" />
                    <a href={`mailto:${siteSettings?.email || 'info@vidaauto.com'}`} className="hover:text-[#FFB300] transition-colors truncate">
                      {siteSettings?.email || 'info@vidaauto.com'}
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* QR Code Section */}
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-[#E6F1FF] uppercase tracking-wider mb-4">{t('footer.whatsapp_title')}</span>
            {siteSettings?.whatsappQrUrl ? (
              <a 
                href={whatsappUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                title="Click to Chat on WhatsApp"
                className="p-2 bg-white rounded-lg hover:scale-105 transition-transform"
              >
                <img 
                  src={siteSettings.whatsappQrUrl} 
                  alt="WhatsApp QR" 
                  className="w-24 h-24 object-contain" 
                  referrerPolicy="no-referrer"
                />
              </a>
            ) : (
              <div className="w-24 h-24 bg-[#112240] rounded-lg flex items-center justify-center border border-white/5">
                <span className="text-[10px] text-center px-2">{t('footer.qr_not_set')}</span>
              </div>
            )}
            <p className="mt-2 text-[10px] text-center">{t('footer.whatsapp_scan', 'Scan or Click to Chat')}</p>
            
            <a 
              href={whatsappUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="mt-3 md:hidden inline-flex items-center px-4 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-bold rounded-lg transition-colors shadow-md"
            >
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Chat on WhatsApp
            </a>
          </div>

          {/* Social & Share */}
          <div className="flex flex-col items-center md:items-end">
            <span className="text-sm font-bold text-[#E6F1FF] uppercase tracking-wider mb-4">{t('footer.follow_us')}</span>
            <div className="flex space-x-4 mb-6">
              <a href={siteSettings?.twitter || "#"} target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-[#8892B0] hover:text-[#FFB300] transition-colors">
                <Twitter className="w-5 h-5" aria-hidden="true" />
              </a>
              <a href={siteSettings?.facebook || "#"} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-[#8892B0] hover:text-[#FFB300] transition-colors">
                <Facebook className="w-5 h-5" aria-hidden="true" />
              </a>
              <a href={siteSettings?.instagram || "#"} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-[#8892B0] hover:text-[#FFB300] transition-colors">
                <Instagram className="w-5 h-5" aria-hidden="true" />
              </a>
              <a href={siteSettings?.linkedin || "#"} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-[#8892B0] hover:text-[#FFB300] transition-colors">
                <Linkedin className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
            
            <button 
              onClick={handleShare}
              className="flex items-center px-4 py-2 bg-[#112240] border border-[#FFB300]/30 text-[#FFB300] rounded-full text-sm hover:bg-[#FFB300] hover:text-[#0A192F] transition-all group"
            >
              <Share2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              {t('footer.share_btn')}
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <Link to="/products" className="hover:text-[#FFB300] transition-colors">{t('nav.products')}</Link>
            <Link to="/blog" className="hover:text-[#FFB300] transition-colors">{t('nav.blog', 'Blog')}</Link>
            <Link to="/sourcing-guides" className="hover:text-[#FFB300] transition-colors">{t('nav.resources', 'Resources')}</Link>
            <Link to="/about" className="hover:text-[#FFB300] transition-colors">{t('nav.about')}</Link>
            <Link to="/privacy" className="hover:text-[#FFB300] transition-colors">{t('common.privacy')}</Link>
            <Link to="/terms" className="hover:text-[#FFB300] transition-colors">{t('common.terms')}</Link>
          </div>
          <span>&copy; {new Date().getFullYear()} VIDA AUTO. {t('footer.rights', 'All rights reserved.')}</span>
        </div>
      </div>
    </footer>
  );
}
