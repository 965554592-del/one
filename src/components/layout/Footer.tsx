import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X, MapPin, Phone, Mail, MessageCircle, Instagram, Twitter, Facebook, Linkedin } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store/useStore';

export default function Footer() {
  const { t, i18n } = useTranslation();
  const { siteSettings } = useStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [showQR, setShowQR] = useState(false);

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

  return (
    <footer className="bg-charcoal text-white/70 py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          {/* Brand & Description */}
          <div className="md:col-span-2">
            <div className="text-2xl font-serif font-bold text-white mb-4">VIDA AUTO</div>
            <p className="text-sm leading-relaxed max-w-md mb-6">
              {t('footer.tagline', 'Wholesale Auto Parts Supplier — OEM & Aftermarket solutions for global B2B buyers. 12.5k+ SKUs, 45+ countries served.')}
            </p>
            <div className="space-y-3 text-sm">
              {contacts.length > 0 ? (
                contacts.map(c => (
                  <div key={c.id} className="flex items-start">
                    <div className="w-5 h-5 mr-2 text-terracotta shrink-0 mt-0.5">
                      {c.icon === 'MapPin' && <MapPin className="w-4 h-4" />}
                      {c.icon === 'Phone' && <Phone className="w-4 h-4" />}
                      {c.icon === 'Mail' && <Mail className="w-4 h-4" />}
                      {c.icon === 'MessageSquare' && <MessageCircle className="w-4 h-4" />}
                      {!['MapPin','Phone','Mail','MessageSquare'].includes(c.icon) && <Mail className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col">
                      {(c.label_zh || c.label_en) && (
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                          {i18n.language === 'zh' ? c.label_zh || c.label_en : c.label_en || c.label_zh}
                        </span>
                      )}
                      <span>{i18n.language === 'zh' ? c.value_zh || c.value_en : c.value_en || c.value_zh}</span>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-terracotta" />
                    <span>{siteSettings?.address || t('footer.address', 'Guangzhou, China')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-terracotta" />
                    <span>{siteSettings?.phone || '+86 123 4567 8901'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-terracotta" />
                    <a href={`mailto:${siteSettings?.email || 'info@vidaauto.com'}`} className="hover:text-white transition-colors">
                      {siteSettings?.email || 'info@vidaauto.com'}
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('footer.navigation', 'Navigation')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/products" className="hover:text-terracotta transition-colors">{t('nav.products')}</Link></li>
              <li><Link to="/factory" className="hover:text-terracotta transition-colors">{t('nav.factory', 'Factory')}</Link></li>
              <li><Link to="/blog" className="hover:text-terracotta transition-colors">{t('nav.blog', 'Blog')}</Link></li>
              <li><Link to="/sourcing-guides" className="hover:text-terracotta transition-colors">{t('nav.resources', 'Resources')}</Link></li>
              <li><Link to="/about" className="hover:text-terracotta transition-colors">{t('nav.about')}</Link></li>
              <li><Link to="/privacy" className="hover:text-terracotta transition-colors">{t('common.privacy')}</Link></li>
              <li><Link to="/terms" className="hover:text-terracotta transition-colors">{t('common.terms')}</Link></li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('footer.follow_us', 'Follow Us')}</h4>
            <div className="flex gap-4 mb-6">
              <a href={siteSettings?.twitter || "#"} target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-terracotta transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href={siteSettings?.facebook || "#"} target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-terracotta transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href={siteSettings?.instagram || "#"} target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-terracotta transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href={siteSettings?.linkedin || "#"} target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-terracotta transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
            <button
              onClick={() => setShowQR(true)}
              className="inline-flex items-center gap-2 text-sm hover:text-terracotta transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">{t('common.privacy')}</Link>
            <Link to="/terms" className="hover:text-white transition-colors">{t('common.terms')}</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} VIDA AUTO. {t('footer.rights', 'All rights reserved.')}</p>
        </div>
      </div>

      {/* WhatsApp QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-charcoal hover:bg-stone-200 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle size={32} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-charcoal mb-1">{t('footer.whatsapp_title', 'WhatsApp')}</h3>
              <p className="text-sm text-charcoal/60 mb-4">{t('footer.whatsapp_scan', 'Scan QR or click to chat')}</p>
              {siteSettings?.whatsappQrUrl ? (
                <img src={siteSettings.whatsappQrUrl} alt="WhatsApp QR" className="w-48 h-48 object-contain mx-auto mb-4 rounded-xl border border-stone-200" />
              ) : (
                <div className="w-48 h-48 bg-stone-100 rounded-xl mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-stone-300">
                  <span className="text-sm text-charcoal/40">QR Code</span>
                </div>
              )}
              <p className="text-sm font-semibold text-charcoal mb-1">{rawPhone}</p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-6 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-full hover:bg-green-600 transition-colors"
              >
                <MessageCircle size={16} />
                {t('common.open_whatsapp', 'Open WhatsApp')}
              </a>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
