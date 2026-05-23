import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { Search, CheckCircle, Send, Lightbulb, Disc, Filter, Car, LayoutGrid, ArrowRight, ShieldCheck, FileText, Download } from 'lucide-react';

import { useStore } from '../store/useStore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { addDoc, collection, doc, getDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import SEO from '../components/SEO';
import LazyVideo from '../components/LazyVideo';
import { trackLead, trackEvent } from '../lib/pixel';
import { gtagTrackLead, gtagEvent } from '../lib/gtag';
import { pushToCRM } from '../lib/webhook';
import { buildSmtp, sendAdminNotification, sendCustomerAutoReply } from '../lib/email';
import { sendCapiLead, generateEventId } from '../lib/capi';
import { GlobeErrorBoundary } from '../components/GlobeErrorBoundary';
import ProfileGateModal from '../components/ProfileGateModal';

const Globe = lazy(() => import('../components/Globe'));

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { siteSettings, user } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [starProduct, setStarProduct] = useState<any>(null);
  const [homeCategories, setHomeCategories] = useState<any[]>([]);
  // YMM filter state for the home search box
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [searchYear, setSearchYear] = useState('');
  const [searchMake, setSearchMake] = useState('');
  const [searchModel, setSearchModel] = useState('');
  
  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    vehicleModel: '',
    partNeed: '',
    quantity: '',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [pendingDownloadId, setPendingDownloadId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
        setHomeCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('Error fetching categories:', e); }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const snap = await getDocs(collection(db, 'vehicles'));
        setVehicles(snap.docs.map(d => d.data()));
      } catch (e) { console.warn('vehicles unavailable:', e); }
    };
    fetchVehicles();
  }, []);

  useEffect(() => {
    const fetchStarProduct = async () => {
      if (siteSettings?.starProductId) {
        try {
          const docRef = doc(db, 'products', siteSettings.starProductId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setStarProduct({ id: docSnap.id, ...docSnap.data() });
          }
        } catch (error) {
          console.error("Error fetching star product:", error);
        }
      }
    };
    fetchStarProduct();
  }, [siteSettings?.starProductId]);

  const documents = [
    ...(siteSettings?.catalogUrl ? [{ id: 'doc-full', title: siteSettings?.catalogTitle || t('home.catalog_2026', 'Product Catalog 2026'), type: 'PDF', size: 'Full', url: siteSettings?.catalogUrl }] : []),
    ...homeCategories
      .filter((c: any) => c.catalogUrl)
      .map((c: any) => ({ id: `cat-${c.id}`, title: c.name, type: 'PDF', size: c.name, url: c.catalogUrl })),
    ...(!siteSettings?.catalogUrl && homeCategories.filter((c: any) => c.catalogUrl).length === 0
      ? [{ id: 'doc-default', title: t('home.catalog_2026', 'Product Catalog 2026'), type: 'PDF', size: 'Full', url: '' }]
      : []),
  ];

  const handleDownload = async (docId: string) => {
    const docData = documents.find(d => d.id === docId);
    if (!docData?.url) {
      alert(t('common.no_catalog', 'No catalog file uploaded yet.'));
      return;
    }

    if (!auth.currentUser) {
      alert(t('common.login_required'));
      navigate('/user');
      return;
    }

    // Check if profile is complete (has company + phone)
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const data = userDoc.data();
      if (!data?.company || !data?.phone) {
        setPendingDownloadId(docId);
        setShowProfileGate(true);
        return;
      }
    } catch (err) {
      console.error('[Home] Profile check failed:', err);
    }

    await executeDownload(docId, docData);
  };

  const executeDownload = async (docId: string, docData: { url?: string; title?: string }) => {
    if (!auth.currentUser || !docData?.url) return;
    setDownloadingId(docId);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'userDownloads'), {
        userId: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        pdfId: docId,
        pdfTitle: docData.title,
        timestamp: now,
      });

      // Track PDF download event (Meta Pixel + GA4)
      trackEvent('Download', {
        content_name: docData.title || docId,
        content_category: 'home_catalog',
      });
      gtagEvent('file_download', {
        file_name: docData.title || docId,
      });

      // Push download event to CRM with user profile info
      if (siteSettings?.crmWebhookEnabled && siteSettings?.crmWebhookUrl) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const profile = userDoc.data() || {};
        pushToCRM(
          {
            name: profile.displayName || auth.currentUser.displayName || '',
            email: auth.currentUser.email || '',
            phone: profile.phone || '',
            company: profile.company || '',
            country: profile.country || '',
            message: `Downloaded: ${docData.title || docId}`,
            source: 'pdf_download',
            createdAt: now,
          },
          siteSettings.crmWebhookUrl,
          siteSettings.crmWebhookHeaders,
        ).catch(() => {});
      }

      setDownloadingId(null);
      window.open(docData.url, '_blank');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'userDownloads');
      setDownloadingId(null);
      alert(t('common.download_failed'));
    }
  };

  const handleProfileGateComplete = () => {
    setShowProfileGate(false);
    if (pendingDownloadId) {
      const docData = documents.find(d => d.id === pendingDownloadId);
      if (docData) executeDownload(pendingDownloadId, docData);
      setPendingDownloadId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (searchYear) params.set('year', searchYear);
    if (searchMake) params.set('make', searchMake);
    if (searchModel) params.set('model', searchModel);
    if (params.toString()) {
      navigate(`/products?${params.toString()}`);
    } else {
      navigate('/products');
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'messages'), {
        name: contactForm.name,
        company: contactForm.company,
        email: contactForm.email,
        phone: contactForm.phone,
        vehicleModel: contactForm.vehicleModel,
        partNeed: contactForm.partNeed,
        quantity: contactForm.quantity,
        message: contactForm.message,
        status: 'new',
        source: 'home_inquiry_form',
        createdAt: new Date().toISOString(),
        ...(user ? { userId: user.uid, userEmail: user.email } : {}),
      });
      // Shared event ID for pixel + CAPI deduplication
      const leadEventId = generateEventId();
      trackLead({
        content_name: 'Home Inquiry Form',
        content_category: contactForm.partNeed || 'general',
        company: contactForm.company,
        eventID: leadEventId,
      });
      // Server-side CAPI (fire-and-forget)
      if (siteSettings?.metaPixelId && siteSettings?.fbCapiAccessToken) {
        sendCapiLead(
          siteSettings.metaPixelId,
          siteSettings.fbCapiAccessToken,
          { email: contactForm.email, phone: contactForm.phone, fn: contactForm.name, external_id: contactForm.email },
          { content_name: 'Home Inquiry Form', content_category: contactForm.partNeed || 'general' },
          leadEventId,
          siteSettings.fbCapiTestCode || undefined,
        );
      }
      // Google Analytics 4 + Google Ads conversion tracking
      gtagTrackLead({
        content_name: 'Home Inquiry Form',
        content_category: contactForm.partNeed || 'general',
        company: contactForm.company,
      });
      // Fire-and-forget CRM webhook push (never blocks UI).
      if (siteSettings?.crmWebhookEnabled && siteSettings?.crmWebhookUrl) {
        pushToCRM(
          { ...contactForm, source: 'home_inquiry_form', createdAt: new Date().toISOString() },
          siteSettings.crmWebhookUrl,
          siteSettings.crmWebhookHeaders,
        ).catch(() => {/* logged inside pushToCRM */});
      }
      // Fire-and-forget email notifications.
      const smtp = buildSmtp(siteSettings || {});
      if (smtp) {
        if (siteSettings?.emailNotifyEnabled && siteSettings?.notifyEmails) {
          sendAdminNotification(smtp, siteSettings.notifyEmails, contactForm).catch(() => {});
        }
        if (siteSettings?.emailAutoReplyEnabled && contactForm.email) {
          sendCustomerAutoReply(smtp, contactForm.email, contactForm.name).catch(() => {});
        }
      }
      setIsSubmitted(true);
      setContactForm({
        name: '',
        company: '',
        email: '',
        phone: '',
        vehicleModel: '',
        partNeed: '',
        quantity: '',
        message: '',
      });
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (error) {
      console.error("Error submitting contact form:", error);
      handleFirestoreError(error, OperationType.CREATE, 'messages');
      alert(t('common.submit_failed', 'Submission failed. Please try again later.'));
    }
  };

  const handleWhatsAppInquiry = () => {
    const message = t('common.whatsapp_message');
    const encodedMessage = encodeURIComponent(message);
    
    if (siteSettings?.whatsappLink) {
      const link = siteSettings.whatsappLink.includes('?') 
        ? `${siteSettings.whatsappLink}&text=${encodedMessage}`
        : `${siteSettings.whatsappLink}?text=${encodedMessage}`;
      window.open(link, '_blank');
    } else {
      const whatsappNumber = siteSettings?.phone?.replace(/[^\d+]/g, '') || "861234567890";
      window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    }
  };

  const getHeroStyle = (key: string, defaultClasses: string) => {
    const style = siteSettings?.heroStyles?.[key];
    if (!style) return defaultClasses;
    return `${style.presetClasses || ''} ${style.sizeClasses || ''} ${style.customClasses || ''}`.trim() || defaultClasses;
  };

  const BenefitCard = ({ titleKey, descKey, modern }: { titleKey: string, descKey: string, modern?: boolean }) => {
    if (!t(titleKey)) return null;
    return (
      <div className={`${modern ? 'bg-white/5 border-white/5' : 'bg-black/20 border-white/10'} backdrop-blur-[2px] border p-6 rounded-xl text-center hover:border-[#FFB300]/50 hover:bg-black/40 transition-all hover:-translate-y-1 duration-300`}>
        <h4 className={getHeroStyle(titleKey, 'text-lg font-bold text-[#E6F1FF] mb-2')}>{t(titleKey)}</h4>
        <p className="text-sm text-[#8892B0] leading-relaxed">{t(descKey)}</p>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full">
      {showProfileGate && (
        <ProfileGateModal
          onComplete={handleProfileGateComplete}
          onClose={() => { setShowProfileGate(false); setPendingDownloadId(null); }}
        />
      )}
      <SEO
        title="Vida Auto - Wholesale Auto Parts Supplier from China"
        description="Vida Auto supplies high-quality OEM and aftermarket auto parts to global B2B buyers. 12.5k+ SKUs, 45+ countries served, fast bulk shipping."
        path="/"
        image={siteSettings?.logoUrl || '/favicon.png'}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Vida Auto',
          url: 'https://autoparts.fit',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://autoparts.fit/products?search={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
          publisher: {
            '@id': 'https://autoparts.fit#organization',
          },
        }}
      />
      {/* HERO SECTION - FULL WIDTH */}
      <div className="relative w-full overflow-hidden mb-8 bg-[#0A192F]">
        {/* Background Video/Image - displayed at natural aspect ratio */}
        {siteSettings?.heroVideoUrl ? (
          <LazyVideo
            src={siteSettings.heroVideoUrl}
            poster={siteSettings.heroBgUrl}
            className="block w-full h-auto"
            lazy={false}
            preload="metadata"
          />
        ) : siteSettings?.heroBgUrl ? (
          <img
            src={siteSettings.heroBgUrl}
            alt=""
            className="block w-full h-auto"
          />
        ) : (
          <div className="w-full aspect-[16/9] bg-[#112240]"></div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-b pointer-events-none ${siteSettings?.heroVideoUrl ? 'from-black/0 to-black/20' : 'from-[#0A192F]/15 to-[#0A192F]/45'}`}></div>

        {/* Content - overlaid on top of image */}
        <div className="absolute inset-0 z-10 flex flex-col justify-center items-center py-8 px-4 max-w-7xl mx-auto w-full overflow-y-auto" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          {/* Key Indicators & Benefits Section */}
          <div className="w-full">
            {(!siteSettings?.featuresLayout || siteSettings.featuresLayout === 'classic') && (
              <>
                {/* Key Indicators - Classic */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16 w-full text-center items-center">
                  {t('hero.partners') && (
                    <div>
                      <div className={getHeroStyle('hero.partners', 'text-2xl md:text-3xl font-extrabold text-[#FFB300] mb-3 tracking-tight')}>{t('hero.partners')}</div>
                      <div className={getHeroStyle('hero.partners_desc', 'text-sm text-[#8892B0] font-medium')}>{t('hero.partners_desc')}</div>
                    </div>
                  )}
                  {t('hero.oem') && (
                    <div>
                      <div className={getHeroStyle('hero.oem', 'text-6xl font-extrabold text-[#FFB300] mb-3 tracking-tight')}>{t('hero.oem')}</div>
                      <div className={getHeroStyle('hero.support', 'text-lg text-[#8892B0] uppercase tracking-widest font-medium')}>{t('hero.support')}</div>
                    </div>
                  )}
                  {t('hero.global') && (
                    <div>
                      <div className={getHeroStyle('hero.global', 'text-6xl font-extrabold text-[#FFB300] mb-3 tracking-tight')}>{t('hero.global')}</div>
                      <div className={getHeroStyle('hero.delivery', 'text-lg text-[#8892B0] uppercase tracking-widest font-medium')}>{t('hero.delivery')}</div>
                    </div>
                  )}
                </div>

                {/* Benefits - Classic */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                  <BenefitCard titleKey="hero.benefit1_title" descKey="hero.benefit1_desc" />
                  <BenefitCard titleKey="hero.benefit2_title" descKey="hero.benefit2_desc" />
                  <BenefitCard titleKey="hero.benefit3_title" descKey="hero.benefit3_desc" />
                  <BenefitCard titleKey="hero.benefit4_title" descKey="hero.benefit4_desc" />
                </div>
              </>
            )}

            {siteSettings.featuresLayout === 'modern' && (
              <div className="flex flex-col gap-12 w-full">
                <div className="flex flex-col md:flex-row justify-between items-center bg-black/15 backdrop-blur-[2px] rounded-3xl p-8 border border-white/5 shadow-2xl">
                   <div className="flex flex-wrap justify-center gap-12 flex-1">
                      <div className="text-center group">
                        <div className={getHeroStyle('hero.partners', 'text-4xl md:text-5xl font-black text-[#FFB300] group-hover:scale-110 transition-transform')}>{t('hero.partners')}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[#8892B0] mt-1">{t('hero.partners_desc')}</div>
                      </div>
                      <div className="text-center group">
                        <div className={getHeroStyle('hero.oem', 'text-4xl md:text-5xl font-black text-[#FFB300] group-hover:scale-110 transition-transform')}>{t('hero.oem')}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[#8892B0] mt-1">{t('hero.support')}</div>
                      </div>
                      <div className="text-center group">
                        <div className={getHeroStyle('hero.global', 'text-4xl md:text-5xl font-black text-[#FFB300] group-hover:scale-110 transition-transform')}>{t('hero.global')}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[#8892B0] mt-1">{t('hero.delivery')}</div>
                      </div>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <BenefitCard titleKey="hero.benefit1_title" descKey="hero.benefit1_desc" modern />
                  <BenefitCard titleKey="hero.benefit2_title" descKey="hero.benefit2_desc" modern />
                  <BenefitCard titleKey="hero.benefit3_title" descKey="hero.benefit3_desc" modern />
                  <BenefitCard titleKey="hero.benefit4_title" descKey="hero.benefit4_desc" modern />
                </div>
              </div>
            )}

            {siteSettings.featuresLayout === 'split' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full">
                <div className="lg:col-span-4 bg-black/10 backdrop-blur-[2px] border border-white/10 rounded-2xl p-8 flex flex-col justify-center space-y-12">
                   <div className="group">
                      <div className="text-3xl font-bold text-[#FFB300]">{t('hero.partners')}</div>
                      <div className="text-xs text-[#8892B0]">{t('hero.partners_desc')}</div>
                   </div>
                   <div className="group">
                      <div className="text-5xl font-black text-[#FFB300]">{t('hero.oem')}</div>
                      <div className="text-xs text-[#8892B0] tracking-[3px] uppercase">{t('hero.support')}</div>
                   </div>
                   <div className="group">
                      <div className="text-5xl font-black text-[#FFB300]">{t('hero.global')}</div>
                      <div className="text-xs text-[#8892B0] tracking-[3px] uppercase">{t('hero.delivery')}</div>
                   </div>
                </div>
                <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <BenefitCard titleKey="hero.benefit1_title" descKey="hero.benefit1_desc" />
                  <BenefitCard titleKey="hero.benefit2_title" descKey="hero.benefit2_desc" />
                  <BenefitCard titleKey="hero.benefit3_title" descKey="hero.benefit3_desc" />
                  <BenefitCard titleKey="hero.benefit4_title" descKey="hero.benefit4_desc" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col flex-1">
        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-4 auto-rows-[minmax(200px,auto)] flex-1">
        {/* 3D GLOBE AREA */}
        <div className="md:col-span-2 md:row-span-2 bg-[#112240] rounded-2xl border border-white/5 p-5 flex flex-col relative overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 50%, #1d3557 0%, #0A192F 100%)' }}>
          <div className="text-[11px] text-[#8892B0] uppercase tracking-[1px] mb-1 z-10">{siteSettings?.globeTitle || t('home.globe_title')}</div>
          <h2 className="text-[18px] font-semibold uppercase tracking-[1px] text-[#E6F1FF] mb-3 z-10">{siteSettings?.globeSubtitle || t('home.globe_subtitle')}</h2>
          <div className="absolute inset-0 top-16">
            <GlobeErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center h-full text-[#8892B0]">{t('home.globe_loading')}</div>}>
                <Globe />
              </Suspense>
            </GlobeErrorBoundary>
          </div>
          <div className="absolute bottom-5 left-5 z-10 pointer-events-none">
            <div className="text-[11px] text-[#8892B0] uppercase tracking-[1px]">{siteSettings?.globeBottomTitle || t('home.current_region')}</div>
            <div className="text-[18px] text-[#E6F1FF]">{siteSettings?.globeBottomSubtitle || t('home.global_network')}</div>
          </div>
        </div>

        {/* PRODUCT FEATURE */}
        <Link to={starProduct ? `/products/${starProduct.id}` : "/products"} className="md:col-span-1 md:row-span-1 bg-[#112240] rounded-2xl border border-white/5 p-5 flex flex-col group hover:border-[#FFB300]/50 transition-colors">
          <div className="text-[11px] text-[#8892B0] uppercase tracking-[1px] mb-1">
            {siteSettings?.starProductTitle || t('home.featured_title')}
          </div>
          <h3 className="text-[14px] font-semibold text-[#E6F1FF] group-hover:text-[#FFB300] transition-colors line-clamp-1">
            {starProduct ? starProduct.name : t('home.featured_name')}
          </h3>
          <img 
            src={starProduct?.imageUrls?.[0] || "https://picsum.photos/seed/nanabuana-part/400/300"} 
            alt={starProduct?.name || "Featured Product"} 
            loading="lazy" 
            className="flex-1 min-h-[100px] mt-2 rounded-lg object-contain w-full bg-[#0A192F] p-2 group-hover:scale-[1.03] transition-transform duration-300" 
            referrerPolicy="no-referrer" 
          />
          <div className="text-[12px] mt-2 opacity-70 text-[#E6F1FF]">
            {starProduct ? `SKU: ${starProduct.sku}` : "SKU: WD-7742-LX"}
          </div>
        </Link>

        {/* STATS */}
        <div 
          className="md:col-span-1 md:row-span-1 bg-[#112240] rounded-2xl border border-white/5 p-5 flex flex-col justify-center items-center text-center relative overflow-hidden"
        >
          {siteSettings?.statsBgUrl ? (
            <div className="absolute inset-0 w-full h-full bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${siteSettings.statsBgUrl})` }}></div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-[#112240]/80 to-[#112240]/90"></div>
          
          <div className="relative z-10">
            <div className="text-[11px] text-[#8892B0] uppercase tracking-[1px] mb-1">{t('home.export_regions')}</div>
            <div className="text-[32px] font-extrabold text-[#FFB300]">{siteSettings?.statsRegions || '45+'}</div>
            <div className="h-2"></div>
            <div className="text-[11px] text-[#8892B0] uppercase tracking-[1px] mb-1">{t('home.active_skus')}</div>
            <div className="text-[32px] font-extrabold text-[#FFB300]">{siteSettings?.statsSkus || '12.5k'}</div>
          </div>
        </div>

        {/* VIDEO STORY */}
        <div className="md:col-span-2 md:row-span-1 bg-black rounded-2xl border border-white/5 flex flex-col justify-center items-center relative overflow-hidden">
          {siteSettings?.statsVideoUrl ? (
            <LazyVideo
              src={siteSettings.statsVideoUrl}
              poster={siteSettings.statsBgUrl}
              className="absolute inset-0 w-full h-full object-cover object-center"
              preload="metadata"
              rootMargin="400px"
            />
          ) : (
            <img 
              src={siteSettings?.statsBgUrl || "https://picsum.photos/seed/nanabuana-factory/800/400"} 
              alt="Factory" 
              loading="lazy" 
              className="absolute inset-0 w-full h-full object-cover opacity-40" 
              referrerPolicy="no-referrer" 
            />
          )}
          {siteSettings?.statsOverlayText && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-black/50 backdrop-blur-sm px-4 py-3">
              <p className="text-sm text-white/90 text-center font-medium">{siteSettings.statsOverlayText}</p>
            </div>
          )}
        </div>

        {/* SEARCH BOX */}
        <div className="md:col-span-2 md:row-span-1 bg-[#112240] rounded-2xl border border-white/5 p-5 flex flex-col">
          <div className="text-[11px] text-[#8892B0] uppercase tracking-[1px] mb-1">{t('home.search_title')}</div>
          <h2 className="text-[18px] font-semibold uppercase tracking-[1px] text-[#E6F1FF] mb-3">{t('home.search_subtitle')}</h2>
          <form onSubmit={handleSearch} className="space-y-2">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('home.search_placeholder')}
                className="bg-black/20 border border-[#FFB300]/20 p-3 pr-12 rounded-lg text-white text-sm w-full focus:outline-none focus:border-[#FFB300]/50"
              />
              <button type="submit" className="absolute right-2 p-2 text-[#FFB300] hover:text-[#FFCA28] transition-colors">
                <Search className="w-5 h-5" />
              </button>
            </div>
            {vehicles.length > 0 && (() => {
              const yearOpts = [...new Set(vehicles.map(v => v.year != null ? String(v.year) : '').filter(Boolean))].sort((a, b) => Number(b) - Number(a));
              const makeOpts = [...new Set(vehicles.filter(v => !searchYear || String(v.year) === searchYear).map(v => v.make || '').filter(Boolean))].sort();
              const modelOpts = [...new Set(vehicles.filter(v => (!searchYear || String(v.year) === searchYear) && (!searchMake || v.make === searchMake)).map(v => v.model || '').filter(Boolean))].sort();
              return (
                <div className="flex flex-wrap gap-2">
                  <select
                    value={searchYear}
                    onChange={(e) => { setSearchYear(e.target.value); setSearchMake(''); setSearchModel(''); }}
                    className="flex-1 min-w-[100px] bg-black/20 border border-[#FFB300]/20 px-2 py-2 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFB300]/50"
                  >
                    <option value="">{t('products.year', 'Year')}</option>
                    {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select
                    value={searchMake}
                    onChange={(e) => { setSearchMake(e.target.value); setSearchModel(''); }}
                    className="flex-1 min-w-[110px] bg-black/20 border border-[#FFB300]/20 px-2 py-2 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFB300]/50"
                  >
                    <option value="">{t('products.make', 'Make')}</option>
                    {makeOpts.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select
                    value={searchModel}
                    onChange={(e) => setSearchModel(e.target.value)}
                    className="flex-1 min-w-[110px] bg-black/20 border border-[#FFB300]/20 px-2 py-2 rounded-lg text-white text-xs focus:outline-none focus:border-[#FFB300]/50"
                  >
                    <option value="">{t('products.model', 'Model')}</option>
                    {modelOpts.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {(searchYear || searchMake || searchModel) && (
                    <button type="button" onClick={() => { setSearchYear(''); setSearchMake(''); setSearchModel(''); }} className="text-[11px] text-[#FFB300] hover:underline px-2">
                      {t('products.clear_filter', 'Clear')}
                    </button>
                  )}
                </div>
              );
            })()}
          </form>
          <div className="mt-3 text-[11px] text-[#E6F1FF]/60 flex gap-2">
            <span>{t('home.search_trending')}</span>
          </div>
        </div>

        {/* QUALITY ASSURANCE (Replaced old Categories) */}
        <div className="md:col-span-1 md:row-span-1 bg-[#112240] rounded-2xl border border-white/5 p-5 flex flex-col justify-center items-center text-center">
          <div className="text-[11px] text-[#8892B0] uppercase tracking-[1px] mb-3">{t('home.quality_title')}</div>
          <ShieldCheck className="w-8 h-8 text-[#FFB300] mb-3" />
          <div className="flex flex-wrap justify-center gap-2">
            {siteSettings?.certificates && siteSettings.certificates.length > 0 ? (
              siteSettings.certificates.map(cert => (
                <div key={cert.id} className="flex flex-col items-center gap-1">
                  {cert.imageUrl ? (
                    <div className="flex flex-col items-center gap-1 group/cert">
                      <img 
                        src={cert.imageUrl} 
                        alt={cert.title} 
                        className="w-10 h-10 object-contain transition-transform group-hover/cert:scale-110" 
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[9px] text-[#8892B0] font-medium whitespace-nowrap">{cert.title}</span>
                    </div>
                  ) : (
                    <span className="px-2 py-1 bg-black/20 border border-white/10 rounded text-[11px] text-[#E6F1FF] font-medium">
                      {cert.title}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <>
                <span className="px-2 py-1 bg-black/20 border border-white/10 rounded text-[11px] text-[#E6F1FF] font-medium">ISO 9001</span>
                <span className="px-2 py-1 bg-black/20 border border-white/10 rounded text-[11px] text-[#E6F1FF] font-medium">CE Certification</span>
                <span className="px-2 py-1 bg-black/20 border border-white/10 rounded text-[11px] text-[#E6F1FF] font-medium">RoHS</span>
              </>
            )}
          </div>
        </div>

        {/* WHATSAPP CTA */}
        <div className="md:col-span-1 md:row-span-1 bg-[#FFB300] rounded-2xl border border-white/5 p-5 flex flex-col">
          <div className="text-[11px] text-[#0A192F]/60 uppercase tracking-[1px] mb-1">{t('home.order_title')}</div>
          <h2 className="text-[18px] font-semibold uppercase tracking-[1px] text-[#0A192F] mb-2">{t('home.order_subtitle')}</h2>
          <p className="text-[12px] text-[#0A192F]/80 mb-4">{t('home.order_desc')}</p>
          <button onClick={handleWhatsAppInquiry} className="mt-auto bg-[#0A192F] text-white p-3 text-center rounded-lg font-semibold text-sm hover:bg-[#112240] transition-colors">{t('home.whatsapp_btn')}</button>
        </div>

        {/* CONTACT FORM */}
        <div className="md:col-span-4 md:row-span-1 bg-[#112240] rounded-2xl border border-white/5 p-5 flex flex-col">
          <div className="text-[11px] text-[#8892B0] uppercase tracking-[1px] mb-1">{t('home.contact_title')}</div>
          <h2 className="text-[18px] font-semibold uppercase tracking-[1px] text-[#E6F1FF] mb-4">{t('home.contact_subtitle')}</h2>
          
          {isSubmitted ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-[#0A192F] rounded-lg border border-[#FFB300]/20">
              <CheckCircle className="w-8 h-8 text-[#FFB300] mb-2" />
              <p className="text-[#E6F1FF] font-medium text-sm">{t('home.contact_success')}</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="flex flex-col space-y-2 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder={t('contact.company', 'Company Name *')}
                  value={contactForm.company}
                  onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                  className="bg-black/20 border border-white/10 p-2 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
                <input
                  type="email"
                  required
                  placeholder={t('contact.email', 'Email *')}
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="bg-black/20 border border-white/10 p-2 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t('contact.name', 'Contact Name')}
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="bg-black/20 border border-white/10 p-2 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
                <input
                  type="tel"
                  placeholder={t('contact.phone', 'Phone (with country code)')}
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="bg-black/20 border border-white/10 p-2 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder={t('contact.vehicle_model', 'Vehicle Model')}
                  value={contactForm.vehicleModel}
                  onChange={(e) => setContactForm({ ...contactForm, vehicleModel: e.target.value })}
                  className="bg-black/20 border border-white/10 p-2 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
                <input
                  type="text"
                  required
                  placeholder={t('contact.part_need', 'Part Needed *')}
                  value={contactForm.partNeed}
                  onChange={(e) => setContactForm({ ...contactForm, partNeed: e.target.value })}
                  className="bg-black/20 border border-white/10 p-2 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
                <input
                  type="text"
                  placeholder={t('contact.quantity', 'Quantity')}
                  value={contactForm.quantity}
                  onChange={(e) => setContactForm({ ...contactForm, quantity: e.target.value })}
                  className="bg-black/20 border border-white/10 p-2 rounded-lg text-white text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
              </div>
              <textarea
                placeholder={t('contact.message', 'Additional notes (optional)')}
                rows={2}
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="bg-black/20 border border-white/10 p-2 rounded-lg text-white text-sm flex-1 focus:outline-none focus:border-[#FFB300]/50 resize-none"
              ></textarea>
              <button type="submit" className="bg-[#FFB300] text-[#0A192F] p-2.5 rounded-lg font-semibold text-sm hover:bg-[#FFCA28] transition-colors flex items-center justify-center">
                <Send className="w-4 h-4 mr-2" />
                {t('contact.send')}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* NEW CATEGORY SECTION */}
      <div className="mt-12 mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[#E6F1FF] mb-8 text-center">{t('home.must_have')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {homeCategories.map((cat, idx) => {
            const icons = [Lightbulb, Disc, Filter, Car];
            const Icon = icons[idx % icons.length];
            return (
              <Link key={cat.id} to={`/products?category=${cat.id}`} className="bg-[#112240] rounded-2xl border border-white/5 p-6 flex flex-col items-center text-center hover:border-[#FFB300]/50 transition-colors group">
                <div className="w-16 h-16 bg-[#0A192F] rounded-full flex items-center justify-center mb-4 text-[#FFB300] group-hover:scale-110 transition-transform">
                  <Icon className="w-8 h-8" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#E6F1FF] mb-2">{cat.name}</h3>
                <p className="text-[12px] text-[#8892B0] mb-4 flex-1">{cat.description || ''}</p>
                <span className="text-[13px] text-[#FFB300] font-medium flex items-center">{t('home.view_details')} <ArrowRight className="w-4 h-4 ml-1" /></span>
              </Link>
            );
          })}

          {/* Card - All Categories */}
          <Link to="/products" className="bg-[#FFB300] rounded-2xl border border-white/5 p-6 flex flex-col items-center text-center hover:bg-[#FFCA28] transition-colors group">
            <div className="w-16 h-16 bg-[#0A192F] rounded-full flex items-center justify-center mb-4 text-[#FFB300] group-hover:scale-110 transition-transform">
              <LayoutGrid className="w-8 h-8" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#0A192F] mb-2">{t('home.explore_more')}</h3>
            <p className="text-[12px] text-[#0A192F]/80 mb-4 flex-1">{t('home.plus_categories')}</p>
            <span className="text-[13px] text-[#0A192F] font-bold flex items-center">{t('home.view_all')} <ArrowRight className="w-4 h-4 ml-1" /></span>
          </Link>

        </div>
      </div>

      {/* BRAND LOGOS SECTION */}
      {siteSettings?.brandLogos && siteSettings.brandLogos.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#E6F1FF]">{t('home.our_brands', 'Our Brands')}</h2>
            <Link to="/products" className="text-sm text-[#FFB300] hover:text-[#FFCA28] flex items-center">
              {t('home.view_all', 'View All')} <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {siteSettings.brandLogos.map((brand: any, i: number) => (
              <Link
                key={i}
                to={brand.categoryId ? `/products?category=${brand.categoryId}` : '/products'}
                className="bg-[#112240] rounded-xl border border-white/5 p-3 flex flex-col items-center justify-center hover:border-[#FFB300]/50 transition-all hover:-translate-y-1 duration-300 w-[120px] min-w-[120px] h-[120px]"
              >
                {brand.imageUrl ? (
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mb-2 p-1.5">
                    <img src={brand.imageUrl} alt={brand.label} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2 text-2xl font-bold text-[#FFB300]">{brand.label?.[0]}</div>
                )}
                <span className="text-xs font-medium text-[#E6F1FF] text-center truncate w-full">{brand.label}</span>
              </Link>
            ))}
            <Link
              to="/products"
              className="bg-[#FFB300]/10 rounded-xl border border-[#FFB300]/20 p-5 flex flex-col items-center justify-center hover:bg-[#FFB300]/20 transition-colors w-[120px] min-w-[120px] h-[120px]"
            >
              <ArrowRight className="w-8 h-8 text-[#FFB300] mb-2" />
              <span className="text-xs font-medium text-[#FFB300]">{t('home.more_brands', 'More')}</span>
            </Link>
          </div>
        </div>
      )}

      {/* DOCUMENT DOWNLOAD SECTION */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#E6F1FF]">{t('home.resources')}</h2>
          <span className="text-sm text-[#8892B0]">{t('home.resources_desc')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-[#112240] rounded-xl border border-white/5 p-5 flex flex-col hover:border-[#FFB300]/30 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-[#0A192F] rounded-lg flex items-center justify-center text-[#FFB300]">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] px-2 py-1 bg-black/30 rounded text-[#8892B0] font-mono">{doc.type} • {doc.size}</span>
              </div>
              <h3 className="text-[15px] font-semibold text-[#E6F1FF] mb-4 flex-1">{doc.title}</h3>
              <button 
                onClick={() => handleDownload(doc.id)}
                disabled={downloadingId === doc.id}
                className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${
                  isLoggedIn 
                    ? 'bg-[#FFB300]/10 text-[#FFB300] hover:bg-[#FFB300]/20' 
                    : 'bg-white/5 text-[#8892B0] hover:bg-white/10 hover:text-white'
                }`}
              >
                {downloadingId === doc.id ? (
                  <span className="animate-pulse">{t('home.processing')}</span>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    {isLoggedIn ? t('home.download_now') : t('home.login_to_download')}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  </div>
  );
}
