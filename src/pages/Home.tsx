import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  Search, CheckCircle, Send, Lightbulb, Disc, Filter, Car, LayoutGrid, ArrowRight,
  ShieldCheck, FileText, Download, Lock, ChevronDown, Share2, Twitter, Facebook,
  Instagram, Linkedin, Eye, MessageCircle, Phone, Mail, MapPin, Minus, Plus, List, X
} from 'lucide-react';
import YMMSelect from '../components/YMMSelect';
import { useStore } from '../store/useStore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { addDoc, collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import SEO from '../components/SEO';
import { GlobeErrorBoundary } from '../components/GlobeErrorBoundary';
const ProfileGateModal = lazy(() => import('../components/ProfileGateModal'));
import AboutAccordion from '../components/AboutAccordion';
import ManufacturingProcess from '../components/ManufacturingProcess';
import ProcessVideoCarousel from '../components/ProcessVideoCarousel';
import PainPointsToggle from '../components/PainPointsToggle';

/* 3D Globe — heavy, lazy-loaded */
function GlobeSection({ siteSettings, t }: { siteSettings: any; t: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [skip3D, setSkip3D] = useState(false);
  const [GlobeComp, setGlobeComp] = useState<React.ComponentType | null>(null);
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const conn = (navigator as any).connection;
    const slow = conn && (conn.saveData || /2g|slow/.test(conn.effectiveType || ''));
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (isMobile || slow || reduced) { setSkip3D(true); return; }
    const el = ref.current; if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const trigger = () => setVisible(true);
        if ('requestIdleCallback' in window) { (window as any).requestIdleCallback(trigger, { timeout: 200 }); }
        else { setTimeout(trigger, 100); }
        observer.disconnect();
      }
    }, { rootMargin: '0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!visible || skip3D) return; import('../components/Globe').then(mod => setGlobeComp(() => mod.default)); }, [visible, skip3D]);
  return (
    <div ref={ref} className="md:col-span-2 md:row-span-2 bg-white rounded-2xl border border-stone-100 p-5 flex flex-col relative overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 50%, #1d3557 0%, #0A192F 100%)' }}>
      <div className="text-[11px] text-white/60 uppercase tracking-[1px] mb-1 z-10">{siteSettings?.globeTitle || t('home.globe_title')}</div>
      <h2 className="text-[18px] font-semibold uppercase tracking-[1px] text-white mb-3 z-10">{siteSettings?.globeSubtitle || t('home.globe_subtitle')}</h2>
      <div className="absolute inset-0 top-16">
        {skip3D ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-2 border-brand/30 bg-gradient-to-br from-[#1d3557] to-cream shadow-[inset_0_0_60px_rgba(255,179,0,0.2)]" />
          </div>
        ) : GlobeComp ? (
          <GlobeErrorBoundary><GlobeComp /></GlobeErrorBoundary>
        ) : (
          <div className="flex items-center justify-center h-full text-white/60">{t('home.globe_loading')}</div>
        )}
      </div>
      <div className="absolute bottom-5 left-5 z-10 pointer-events-none">
        <div className="text-[11px] text-white/60 uppercase tracking-[1px]">{siteSettings?.globeBottomTitle || t('home.current_region')}</div>
        <div className="text-[18px] text-white">{siteSettings?.globeBottomSubtitle || t('home.global_network')}</div>
      </div>
    </div>
  );
}

function AboutAccordionItems() {
  const [openIndex, setOpenIndex] = useState<number>(0);
  const items = [
    {
      title: '9 Years of Expertise',
      content: 'Since 2016, we have mastered the complexities of auto parts production, from raw material selection to final precision machining and QC inspection. Our engineering team ensures every component meets or exceeds OEM specifications.',
    },
    {
      title: 'Material Obsession',
      content: 'We source only premium-grade materials — from high-carbon brake pads to aerospace-grade aluminum alloys. Every batch is traceable, tested, and certified before entering our production lines.',
    },
    {
      title: 'Ethical Supply Chain',
      content: 'Our suppliers are audited against ISO 14001 and SA8000 standards. We prioritize sustainable manufacturing, fair labor practices, and transparent pricing across our entire partner network.',
    },
  ];

  return (
    <div className="divide-y divide-stone-200">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="py-4">
            <button
              onClick={() => setOpenIndex(isOpen ? -1 : idx)}
              className="w-full flex items-center justify-between text-left group"
            >
              <span className={`text-base font-semibold transition-colors ${isOpen ? 'text-charcoal' : 'text-charcoal/70 group-hover:text-charcoal'}`}>
                {item.title}
              </span>
              <span className={`ml-4 flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-all ${isOpen ? 'border-charcoal bg-charcoal text-white' : 'border-stone-300 text-charcoal/50 group-hover:border-charcoal group-hover:text-charcoal'}`}>
                {isOpen ? <Minus size={14} /> : <Plus size={14} />}
              </span>
            </button>
            <motion.div
              initial={false}
              animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <p className="pt-3 text-sm text-charcoal/60 leading-relaxed pr-10">
                {item.content}
              </p>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function FeaturedProductSection({ starProduct, siteSettings, t, id }: { starProduct: any; siteSettings: any; t: any; id?: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const greenOpacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section ref={sectionRef} id={id} className="relative py-20 md:py-28 bg-white">
      {/* Softer dark green scroll-driven overlay */}
      <motion.div
        style={{ opacity: greenOpacity }}
        className="absolute inset-0 bg-[#2D6A4F] z-0 pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-6 z-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-brand text-xs font-semibold tracking-widest uppercase mb-2">{siteSettings?.starProductTitle || t('home.featured_title', 'Featured Product')}</p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-charcoal">{t('home.featured_name', 'Product of the Month')}</h2>
          </div>
          <Link to={`/products/${starProduct.id}`} className="hidden md:inline-flex items-center gap-2 px-6 py-2.5 bg-charcoal text-white text-sm font-semibold rounded-full hover:bg-brand transition-colors">{t('home.view_details', 'View Details')} <ArrowRight size={16} /></Link>
        </div>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="rounded-2xl overflow-hidden bg-cream border border-stone-100 flex items-center justify-center p-6">
            <img src={starProduct.imageUrls?.[0] || starProduct.imageUrl} alt={starProduct.name} className="max-h-80 object-contain" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-charcoal mb-3">{starProduct.name}</h3>
            <p className="text-charcoal/60 mb-4">SKU: {starProduct.sku}</p>
            <p className="text-charcoal/70 leading-relaxed mb-6">{starProduct.description || t('home.featured_desc', 'High-quality OEM replacement part.')}</p>
            <Link to={`/products/${starProduct.id}`} className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand text-white text-sm font-semibold rounded-full hover:bg-brand-dark transition-colors">{t('home.view_details', 'View Details')} <ArrowRight size={16} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionNavigator() {
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const sections = [
    { id: 'hero', name: 'Home' },
    { id: 'featured', name: 'Featured' },
    { id: 'collection', name: 'Categories' },
    { id: 'about', name: 'About' },
    { id: 'manufacturing', name: 'Manufacturing' },
    { id: 'showcase', name: 'Showcase' },
    { id: 'pain-points', name: 'Pain Points' },
    { id: 'brands', name: 'Brands' },
    { id: 'documents', name: 'Resources' },
    { id: 'contact', name: 'Contact' },
  ];

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('section[id]');
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter(e => e.isIntersecting);
        if (visibleEntries.length > 0) {
          const topEntry = visibleEntries.reduce((prev, curr) =>
            curr.boundingClientRect.top < prev.boundingClientRect.top ? curr : prev
          );
          setActiveSection(topEntry.target.id);
        }
      },
      { threshold: 0, rootMargin: '-20% 0px -60% 0px' }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const scrollTo = (id: string) => {
    setOpen(false);
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const navHeight = 96;
        const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 50);
  };

  if (!visible) return null;

  return (
    <div className="fixed top-24 right-6 z-40" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-full shadow-lg hover:bg-brand-dark transition-colors flex items-center gap-2"
      >
        {open ? <X size={16} /> : <List size={16} />}
        {sections.find(s => s.id === activeSection)?.name || activeSection}
      </button>

      {open && (
        <div className="mt-2 w-44 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-stone-200 overflow-hidden">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                activeSection === s.id
                  ? 'bg-brand text-white font-medium'
                  : 'text-charcoal hover:bg-stone-100'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { siteSettings, user } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [starProduct, setStarProduct] = useState<any>(null);
  const [homeCategories, setHomeCategories] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [searchYear, setSearchYear] = useState('');
  const [searchMake, setSearchMake] = useState('');
  const [searchModel, setSearchModel] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', company: '', email: '', phone: '', vehicleModel: '', partNeed: '', quantity: '', message: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasGuestProfile, setHasGuestProfile] = useState(() => { try { return !!localStorage.getItem('vida_guest_profile'); } catch { return false; } });
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [pendingDownloadId, setPendingDownloadId] = useState<string | null>(null);
  const brandLogosRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: brandLogosScrollProgress } = useScroll({
    target: brandLogosRef,
    offset: ['start end', 'end start'],
  });
  const brandLogosOrangeOpacity = useTransform(brandLogosScrollProgress, [0.3, 0.7], [0, 1]);

  const documentsRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: documentsScrollProgress } = useScroll({
    target: documentsRef,
    offset: ['start end', 'end start'],
  });
  const documentsBrownOpacity = useTransform(documentsScrollProgress, [0.3, 0.7], [0, 1]);

  const categoriesRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: categoriesScrollProgress } = useScroll({
    target: categoriesRef,
    offset: ['start end', 'end start'],
  });
  const categoriesGrayOpacity = useTransform(categoriesScrollProgress, [0, 1], [0, 1]);

  useEffect(() => { const unsub = auth.onAuthStateChanged((u) => setIsLoggedIn(!!u)); return () => unsub(); }, []);
  useEffect(() => {
    (async () => { try { const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc'))); setHomeCategories(snap.docs.map(d => ({ id: d.id, ...d.data() }))); } catch (e) { console.error('Error fetching categories:', e); } })();
  }, []);
  useEffect(() => {
    (async () => { try { const snap = await getDocs(collection(db, 'vehicles')); const list = snap.docs.map(d => d.data()); if (list.length > 0) { setVehicles(list); return; } const pSnap = await getDocs(collection(db, 'products')); const fromProducts: any[] = []; pSnap.docs.forEach(d => { const fits = (d.data() as any).fitments || []; fits.forEach((f: any) => { if (f && (f.year || f.make || f.model)) fromProducts.push(f); }); }); setVehicles(fromProducts); } catch (e) { console.warn('vehicles unavailable:', e); } })();
  }, []);
  useEffect(() => {
    (async () => { if (!siteSettings?.starProductId) return; try { const docSnap = await getDoc(doc(db, 'products', siteSettings.starProductId)); if (docSnap.exists()) setStarProduct({ id: docSnap.id, ...docSnap.data() }); } catch (e) { console.error("Error fetching star product:", e); } })();
  }, [siteSettings?.starProductId]);

  const extraCatalogs = (siteSettings?.catalogs || []).filter((c: any) => c?.fileUrl);
  const documents = [
    ...(siteSettings?.catalogUrl ? [{ id: 'doc-full', title: siteSettings?.catalogTitle || t('home.catalog_2026', 'Product Catalog 2026'), type: 'PDF', size: 'Full', url: siteSettings?.catalogUrl }] : []),
    ...extraCatalogs.map((c: any) => ({ id: `cat-extra-${c.id}`, title: c.title || 'Catalog', type: 'PDF', size: 'PDF', url: c.fileUrl })),
    ...homeCategories.filter((c: any) => c.catalogUrl).map((c: any) => ({ id: `cat-${c.id}`, title: c.name, type: 'PDF', size: c.name, url: c.catalogUrl })),
    ...(!siteSettings?.catalogUrl && extraCatalogs.length === 0 && homeCategories.filter((c: any) => c.catalogUrl).length === 0 ? [{ id: 'doc-default', title: t('home.catalog_2026', 'Product Catalog 2026'), type: 'PDF', size: 'Full', url: '' }] : []),
  ];

  const handleDownload = async (docId: string) => {
    const docData = documents.find(d => d.id === docId);
    if (!docData?.url) { alert(t('common.no_catalog', 'No catalog file uploaded yet.')); return; }
    if (auth.currentUser) { try { const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid)); const data = userDoc.data(); if (!data?.company || !data?.phone) { setPendingDownloadId(docId); setShowProfileGate(true); return; } } catch (err) { console.error('[Home] Profile check failed:', err); } }
    else { const cached = localStorage.getItem('vida_guest_profile'); if (!cached) { setPendingDownloadId(docId); setShowProfileGate(true); return; } }
    await executeDownload(docId, docData);
  };

  const executeDownload = async (docId: string, docData: { url?: string; title?: string }) => {
    if (!docData?.url) return;
    setDownloadingId(docId);
    try {
      const now = new Date().toISOString();
      let profile: any = {}; let email = ''; let userId = '';
      if (auth.currentUser) {
        userId = auth.currentUser.uid; email = auth.currentUser.email || '';
        try { const snap = await getDoc(doc(db, 'users', userId)); profile = snap.data() || {}; } catch {}
        await addDoc(collection(db, 'userDownloads'), { userId, email, pdfId: docId, pdfTitle: docData.title, timestamp: now });
      } else {
        try { const cached = localStorage.getItem('vida_guest_profile'); if (cached) { profile = JSON.parse(cached); email = profile.email || ''; userId = 'guest_' + email.replace(/[^a-zA-Z0-9]/g, '_'); setHasGuestProfile(true); } } catch {}
        await addDoc(collection(db, 'messages'), { name: profile.name || email.split('@')[0] || 'Guest Reader', email: email || 'guest@example.com', message: `[PDF Download] User downloaded document: ${docData.title || docId}`, status: 'new', createdAt: now, company: profile.company || '', phone: profile.phone || '', country: profile.country || '', partNeed: 'Home Page Catalog PDF Download' });
      }
      import('../lib/pixel').then(({ trackEvent }) => trackEvent('Download', { content_name: docData.title || docId, content_category: 'home_catalog' })).catch(() => {});
      import('../lib/gtag').then(({ gtagEvent }) => gtagEvent('file_download', { file_name: docData.title || docId })).catch(() => {});
      if (siteSettings?.crmWebhookEnabled && siteSettings?.crmWebhookUrl) { const pName = profile.displayName || profile.name || auth.currentUser?.displayName || email.split('@')[0] || ''; import('../lib/webhook').then(({ pushToCRM }) => pushToCRM({ name: pName, email, phone: profile.phone || '', company: profile.company || '', country: profile.country || '', message: `Downloaded: ${docData.title || docId}`, source: 'pdf_download', createdAt: now }, siteSettings.crmWebhookUrl, siteSettings.crmWebhookHeaders)).catch(() => {}); }
      setDownloadingId(null); window.open(docData.url, '_blank');
    } catch (error) { console.error('[executeDownload] Error:', error); setDownloadingId(null); alert(t('common.download_failed')); }
  };

  const handleProfileGateComplete = () => { setShowProfileGate(false); if (pendingDownloadId) { const docData = documents.find(d => d.id === pendingDownloadId); if (docData) executeDownload(pendingDownloadId, docData); setPendingDownloadId(null); } };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (searchYear) params.set('year', searchYear);
    if (searchMake) params.set('make', searchMake);
    if (searchModel) params.set('model', searchModel);
    if (params.toString()) navigate(`/products?${params.toString()}`); else navigate('/products');
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'messages'), { ...contactForm, status: 'new', source: 'home_inquiry_form', createdAt: new Date().toISOString(), ...(user ? { userId: user.uid, userEmail: user.email } : {}) });
      const { generateEventId } = await import('../lib/capi'); const leadEventId = generateEventId();
      import('../lib/pixel').then(({ trackLead }) => trackLead({ content_name: 'Home Inquiry Form', content_category: contactForm.partNeed || 'general', company: contactForm.company, eventID: leadEventId })).catch(() => {});
      if (siteSettings?.metaPixelId && siteSettings?.fbCapiAccessToken) { const { sendCapiLead } = await import('../lib/capi'); sendCapiLead(siteSettings.metaPixelId, siteSettings.fbCapiAccessToken, { email: contactForm.email, phone: contactForm.phone, fn: contactForm.name, external_id: contactForm.email }, { content_name: 'Home Inquiry Form', content_category: contactForm.partNeed || 'general' }, leadEventId, siteSettings.fbCapiTestCode || undefined); }
      import('../lib/gtag').then(({ gtagTrackLead }) => gtagTrackLead({ content_name: 'Home Inquiry Form', content_category: contactForm.partNeed || 'general', company: contactForm.company })).catch(() => {});
      if (siteSettings?.crmWebhookEnabled && siteSettings?.crmWebhookUrl) { import('../lib/webhook').then(({ pushToCRM }) => pushToCRM({ ...contactForm, source: 'home_inquiry_form', createdAt: new Date().toISOString() }, siteSettings.crmWebhookUrl, siteSettings.crmWebhookHeaders)).catch(() => {}); }
      import('../lib/email').then(({ buildSmtp, sendAdminNotification, sendCustomerAutoReply }) => { const smtp = buildSmtp(siteSettings || {}); if (smtp) { if (siteSettings?.emailNotifyEnabled && siteSettings?.notifyEmails) sendAdminNotification(smtp, siteSettings.notifyEmails, contactForm).catch(() => {}); if (siteSettings?.emailAutoReplyEnabled && contactForm.email) sendCustomerAutoReply(smtp, contactForm.email, contactForm.name).catch(() => {}); } }).catch(() => {});
      setIsSubmitted(true); setContactForm({ name: '', company: '', email: '', phone: '', vehicleModel: '', partNeed: '', quantity: '', message: '' });
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (error) { console.error("Error submitting contact form:", error); handleFirestoreError(error, OperationType.CREATE, 'messages'); alert(t('common.submit_failed', 'Submission failed. Please try again later.')); }
  };

  const handleWhatsAppInquiry = () => {
    const message = t('common.whatsapp_message');
    const encodedMessage = encodeURIComponent(message);
    if (siteSettings?.whatsappLink) { const link = siteSettings.whatsappLink.includes('?') ? `${siteSettings.whatsappLink}&text=${encodedMessage}` : `${siteSettings.whatsappLink}?text=${encodedMessage}`; window.open(link, '_blank'); }
    else { const whatsappNumber = siteSettings?.phone?.replace(/[^\d+]/g, '') || "861234567890"; window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank'); }
  };

  return (
    <div className="flex-1 flex flex-col w-full">
      <SectionNavigator />
      {showProfileGate && (
        <Suspense fallback={null}>
          <ProfileGateModal onComplete={handleProfileGateComplete} onClose={() => { setShowProfileGate(false); setPendingDownloadId(null); }} />
        </Suspense>
      )}
      <SEO title="Vida Auto - Wholesale Auto Parts Supplier from China" description="Vida Auto supplies high-quality OEM and aftermarket auto parts to global B2B buyers. 12.5k+ SKUs, 45+ countries served, fast bulk shipping." path="/" image={siteSettings?.logoUrl || '/favicon.png'} jsonLd={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Vida Auto', url: 'https://autoparts.fit', potentialAction: { '@type': 'SearchAction', target: 'https://autoparts.fit/products?search={search_term_string}', 'query-input': 'required name=search_term_string' }, publisher: { '@id': 'https://autoparts.fit#organization' } }} />
      {/* ========== HERO ========== */}
      <section id="hero" className="relative h-screen min-h-[600px] flex items-end overflow-hidden">
        {siteSettings?.heroVideoUrl || true ? (
          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" src={siteSettings?.heroVideoUrl || '/uploads/watermarked_preview.mp4'} poster={siteSettings?.heroBgUrl} />
        ) : siteSettings?.heroBgUrl ? (
          <img src={siteSettings.heroBgUrl} alt="" className="absolute inset-0 w-full h-full object-cover" fetchPriority="high" />
        ) : (
          <div className="absolute inset-0 bg-white" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-16 md:pb-24 w-full">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <h1 className="text-5xl md:text-7xl font-serif font-bold text-white leading-[1.1] mb-4 drop-shadow-lg">{t('hero_title', 'VIDA AUTO')}</h1>
              <p className="text-lg md:text-xl text-white/90 leading-relaxed mb-8 max-w-lg drop-shadow">{t('hero_subtitle', 'Wholesale Auto Parts Supplier — OEM & Aftermarket solutions for global B2B buyers. 12.5k+ SKUs, 45+ countries served.')}</p>
              <div className="flex flex-wrap gap-3">
                <Link to="/products" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-brand font-semibold rounded-full hover:bg-brand hover:text-white transition-colors shadow-lg">{t('hero_cta', 'Explore Products')} <ArrowRight size={18} /></Link>
                <button onClick={handleWhatsAppInquiry} className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold rounded-full hover:bg-white/20 transition-colors"><MessageCircle size={18} /> WhatsApp</button>
              </div>
            </motion.div>
            <motion.a href="#search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="mt-10 inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-colors">
              <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}><ChevronDown size={24} /></motion.div>
            </motion.a>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.6 }} className="absolute bottom-24 right-6 z-20 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <a href={siteSettings?.twitter || '#'} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors"><Twitter size={20} /></a>
            <a href={siteSettings?.facebook || '#'} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors"><Facebook size={20} /></a>
            <a href={siteSettings?.instagram || '#'} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors"><Instagram size={20} /></a>
            <a href={siteSettings?.linkedin || '#'} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors"><Linkedin size={20} /></a>
          </div>
          <button onClick={() => navigator.share?.({ title: 'Vida Auto', url: window.location.href }).catch(() => {})} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/30 text-white text-sm font-medium hover:bg-white/10 transition-colors"><Share2 size={16} /> {t('hero_share', 'Share')}</button>
        </motion.div>
        <div className="absolute bottom-0 left-0 right-0 z-20 py-3 overflow-hidden">
          <div className="mx-4 md:mx-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 py-3 overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap">
              {[...Array(2)].flatMap(() => [
                t('hero.marquee_1', '12.5k+ SKUs in stock'),
                t('hero.marquee_2', '45+ Export Countries'),
                t('hero.marquee_3', 'OEM & Aftermarket Ready'),
                t('hero.marquee_4', 'ISO 9001 Certified'),
                t('hero.marquee_5', '7-14 Days Prototype'),
                t('hero.marquee_6', 'Fast Global Shipping'),
              ]).map((text, i) => (
                <span key={i} className="flex items-center mx-6 text-sm md:text-base font-semibold text-white/90">{text} <span className="mx-6 text-white/30 font-light">|</span></span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== FEATURED PRODUCT ========== */}
      {starProduct && (
        <FeaturedProductSection
          id="featured"
          starProduct={starProduct}
          siteSettings={siteSettings}
          t={t}
        />
      )}

      {/* ========== CATEGORIES ========== */}
      <section ref={categoriesRef} id="collection" className="relative py-24 md:py-32 animate-gradient-flow">
        {/* Soft gray scroll-driven overlay */}
        <motion.div
          style={{ opacity: categoriesGrayOpacity }}
          className="absolute inset-0 bg-[#A0A0A0] z-0 pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto px-6 z-10">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-charcoal mb-2">{t('home.categories_title', 'Product Collections')}</h2>
              <p className="text-charcoal/60 text-lg">{t('home.categories_subtitle', 'OEM & Aftermarket Auto Parts')}</p>
            </div>
            <Link to="/products" className="hidden md:inline-flex items-center gap-2 px-6 py-2.5 bg-charcoal text-white text-sm font-semibold rounded-full hover:bg-brand transition-colors">{t('home.view_more', 'View More')} <ArrowRight size={16} /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {homeCategories.map((cat, idx) => (
              <motion.div key={cat.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.08, duration: 0.5 }}>
                <Link to={`/products?category=${cat.id}`} className="group relative rounded-2xl overflow-hidden cursor-pointer bg-white shadow-sm hover:shadow-md transition-shadow block aspect-[4/3]">
                  <img src={cat.imageUrl || `https://picsum.photos/seed/vida-${cat.id}/600/450`} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <span className="text-white font-semibold text-lg drop-shadow truncate pr-3">{cat.name}</span>
                    <div className="flex items-center gap-1.5 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-charcoal group-hover:bg-brand group-hover:text-white transition-colors shrink-0">
                      <Eye size={14} /> {t('home.view_details', 'View More')}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          <div className="mt-10 flex justify-center md:hidden">
            <Link to="/products" className="inline-flex items-center gap-2 px-6 py-2.5 bg-charcoal text-white text-sm font-semibold rounded-full hover:bg-brand transition-colors">{t('home.view_more', 'View More')} <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      {/* ========== ABOUT ACCORDION ========== */}
      <AboutAccordion id="about" />

      {/* ========== MANUFACTURING PROCESS ========== */}
      <ManufacturingProcess id="manufacturing" />

      {/* ========== PROCESS VIDEO CAROUSEL ========== */}
      <ProcessVideoCarousel id="showcase" />

      {/* ========== PAIN POINTS TOGGLE ========== */}
      <PainPointsToggle id="pain-points" />

      {/* ========== BRAND LOGOS ========== */}
      {siteSettings?.brandLogos && siteSettings.brandLogos.length > 0 && (
        <section ref={brandLogosRef} id="brands" className="relative py-20 md:py-28 bg-cream border-t border-stone-100">
          {/* Light orange scroll-driven overlay */}
          <motion.div
            style={{ opacity: brandLogosOrangeOpacity }}
            className="absolute inset-0 bg-[#E8C9A8] z-0 pointer-events-none"
          />

          <div className="relative max-w-7xl mx-auto px-6 z-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif font-bold text-charcoal">{t('home.our_brands', 'Our Brands')}</h2>
              <Link to="/products" className="text-sm text-brand hover:text-brand-dark flex items-center">{t('home.view_all', 'View All')} <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {siteSettings.brandLogos.map((brand: any, i: number) => (
                <Link key={i} to={brand.categoryId ? `/products?category=${brand.categoryId}` : '/products'} className="bg-white rounded-xl border border-stone-100 p-4 flex flex-col items-center justify-center hover:border-brand/30 transition-all hover:-translate-y-1 duration-300 w-[120px] min-w-[120px] h-[120px] shadow-sm">
                  {brand.imageUrl ? (
                    <div className="w-14 h-14 bg-cream rounded-lg flex items-center justify-center mb-2 p-1"><img src={brand.imageUrl} alt="" className="max-w-full max-h-full object-contain" /></div>
                  ) : (
                    <div className="w-14 h-14 bg-cream rounded-full flex items-center justify-center mb-2 text-xl font-bold text-brand">{brand.label?.[0]}</div>
                  )}
                  <span className="text-xs font-medium text-charcoal text-center truncate w-full">{brand.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== DOCUMENTS ========== */}
      <section ref={documentsRef} id="documents" className="relative py-24 md:py-32 bg-white border-t border-stone-100">
        {/* Brown scroll-driven overlay */}
        <motion.div
          style={{ opacity: documentsBrownOpacity }}
          className="absolute inset-0 bg-[#8B7355] z-0 pointer-events-none"
        />

        <div className="relative max-w-7xl mx-auto px-6 z-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-brand text-xs font-semibold tracking-widest uppercase mb-2">{t('home.resources_desc', 'Downloadable resources')}</p>
              <h2 className="text-2xl font-serif font-bold text-charcoal">{t('home.resources', 'Resources')}</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-cream rounded-xl border border-stone-100 p-5 flex flex-col hover:border-brand/30 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-brand shadow-sm"><FileText className="w-5 h-5" /></div>
                  <span className="text-[10px] px-2 py-1 bg-white rounded text-charcoal/60 font-mono border border-stone-100">{doc.type} &bull; {doc.size}</span>
                </div>
                <h3 className="text-[15px] font-semibold text-charcoal mb-4 flex-1">{doc.title}</h3>
                <button onClick={() => handleDownload(doc.id)} disabled={downloadingId === doc.id} className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${(isLoggedIn || hasGuestProfile) ? 'bg-brand/10 text-brand hover:bg-brand/20' : 'bg-stone-100 text-charcoal hover:bg-stone-200'}`}>
                  {downloadingId === doc.id ? (
                    <span className="animate-pulse">{t('home.processing', 'Processing...')}</span>
                  ) : (
                    <>
                      {(!isLoggedIn && !hasGuestProfile) ? <Lock className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                      {(isLoggedIn || hasGuestProfile) ? t('home.download_now', 'Download') : t('home.login_to_download', 'Login to Download')}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CONTACT ========== */}
      <section id="contact" className="py-24 md:py-32 bg-[#111111]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8 items-stretch">
            {/* LEFT — image card with overlay info */}
            <div className="relative rounded-2xl overflow-hidden min-h-[560px]">
              <img
                src={siteSettings?.aboutDetailImage || "https://picsum.photos/seed/vida-factory/1200/800"}
                alt="Factory"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/80" />

              {/* Top text */}
              <div className="absolute top-8 left-8 right-8">
                <h2 className="text-3xl md:text-[42px] font-bold text-white leading-tight">
                  {t('home.contact_left_title', 'Please fill out the form,')}<br />
                  {t('home.contact_left_sub', 'we will get back to you soon.')}
                </h2>
              </div>

              {/* Bottom contact info */}
              <div className="absolute bottom-8 left-8 right-8">
                <p className="text-white/70 text-sm mb-3">{t('home.contact_or', 'Or contact us directly:')}</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 text-white">
                    <Phone size={18} />
                    <span className="font-semibold text-lg">{siteSettings?.phone || '+86 13418153418'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/90">
                    <Mail size={18} />
                    <span>{siteSettings?.email || 'info@vidaauto.com'}</span>
                  </div>
                </div>
                <div className="mt-4 text-white/50 text-xs space-y-0.5">
                  <p>{t('home.contact_company', 'Company')}：{siteSettings?.companyName || 'Guangzhou Vida Auto Parts Co., Ltd.'}</p>
                  <p>{t('footer.address', 'Address')}：{siteSettings?.address || 'Guangzhou, Guangdong, China'}</p>
                </div>
              </div>
            </div>

            {/* RIGHT — form */}
            <div className="flex flex-col justify-center">
              {isSubmitted ? (
                <div className="flex flex-col items-center justify-center text-center py-12">
                  <CheckCircle className="w-12 h-12 text-brand mb-4" />
                  <p className="text-white font-medium text-lg">{t('home.contact_success', 'Thank you! We will get back to you within 24 hours.')}</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">{siteSettings?.contactFormLabels?.name || t('contact.name', 'Name')} <span className="text-red-400">*</span></label>
                    <input type="text" required value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors" placeholder={t('contact.name_placeholder', 'Your name')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">{siteSettings?.contactFormLabels?.phone || t('contact.phone', 'Phone')} <span className="text-red-400">*</span></label>
                    <input type="tel" required value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors" placeholder={t('contact.phone_placeholder', '+86 123 4567 8901')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">{siteSettings?.contactFormLabels?.email || t('contact.email', 'Email')} <span className="text-red-400">*</span></label>
                    <input type="email" required value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors" placeholder={t('contact.email_placeholder', 'you@company.com')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">{siteSettings?.contactFormLabels?.message || t('contact.message', 'Message')} <span className="text-red-400">*</span></label>
                    <textarea rows={4} required value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors resize-none" placeholder={t('contact.message_placeholder', 'Tell us more about your project...')} />
                  </div>
                  <button type="submit" className="w-full py-3.5 bg-white/20 text-white font-medium rounded-lg hover:bg-white/30 transition-colors">{siteSettings?.contactFormLabels?.send || t('contact.send', 'Send')}</button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 border-t border-white/10 pt-6">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex gap-6 text-sm text-white/50">
              <Link to="/" className="hover:text-white transition-colors">{t('nav.home', 'Home')}</Link>
              <Link to="/products" className="hover:text-white transition-colors">{t('nav.products', 'Products')}</Link>
              <Link to="/about" className="hover:text-white transition-colors">{t('nav.about', 'About Us')}</Link>
              <Link to="/#contact" className="hover:text-white transition-colors">{t('nav.contact', 'Contact')}</Link>
            </div>
            <p className="text-xs text-white/30">© 2026 VidaAuto.com</p>
          </div>
        </div>
      </section>
    </div>
  );
}
