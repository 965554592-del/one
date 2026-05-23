import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, collection, addDoc, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useStore } from '../store/useStore';
import { ArrowLeft, MessageCircle, FileText, Lock, Loader2, Video } from 'lucide-react';
import SEO from '../components/SEO';
import ProfileGateModal from '../components/ProfileGateModal';
import { pushToCRM } from '../lib/webhook';
import { productWithFitmentSchema, type VehicleFitment } from '../lib/schema';
import { trackEvent } from '../lib/pixel';
import { gtagEvent } from '../lib/gtag';

interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  techSpecs?: {
    material?: string;
    weight?: string;
    compatibility?: string;
  };
  imageUrls?: string[];
  videoUrl?: string;
  catalogUrl?: string;
  oemNumber?: string;
  /** Structured Year/Make/Model fitment data (preferred over free-text compatibility). */
  fitments?: VehicleFitment[];
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, siteSettings } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [showProfileGate, setShowProfileGate] = useState(false);
  const [pendingDownloadQual, setPendingDownloadQual] = useState<any>(null);

  useEffect(() => {
    const fetchProductAndQuals = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const productData = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(productData);

          // Track product view (Meta Pixel + GA4)
          trackEvent('ViewContent', {
            content_ids: [productData.id],
            content_name: productData.name,
            content_category: productData.categoryName,
            content_type: 'product',
            value: productData.price || 0,
            currency: 'USD',
          });
          gtagEvent('view_item', {
            items: [{
              item_id: productData.id,
              item_name: productData.name,
              item_category: productData.categoryName,
              price: productData.price || 0,
            }],
            currency: 'USD',
          });

          // Fetch qualifications for this category
          const qRef = collection(db, 'qualifications');
          const qSnap = await getDocs(qRef);
          
          const currentCategory = productData.categoryId;
          
          const categoryQuals = qSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((q: any) => q.categoryId === currentCategory || q.category === productData.categoryName);
          setQualifications(categoryQuals);
        }
      } catch (error) {
        console.error("Error fetching product or qualifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProductAndQuals();
  }, [id]);

  const handleWhatsAppInquiry = () => {
    if (!product) return;
    
    // Save to recent inquiries
    const stored = localStorage.getItem('recent_inquiries');
    let recent = stored ? JSON.parse(stored) : [];
    // Remove if already exists and add to front
    recent = recent.filter((p: any) => p.id !== product.id);
    recent.unshift({ id: product.id, name: product.name, sku: product.sku });
    localStorage.setItem('recent_inquiries', JSON.stringify(recent.slice(0, 5)));

    const message = t('product.inquiry_msg', { name: product.name, sku: product.sku });
    const encodedMessage = encodeURIComponent(message);
    
    if (siteSettings?.whatsappLink) {
      const link = siteSettings.whatsappLink.includes('?') 
        ? `${siteSettings.whatsappLink}&text=${encodedMessage}`
        : `${siteSettings.whatsappLink}?text=${encodedMessage}`;
      window.open(link, '_blank');
    } else {
      const rawPhone = siteSettings?.phone || "861234567890";
      const whatsappNumber = rawPhone.replace(/[^\d+]/g, '');
      window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    }
  };

  const handleDownload = async (qual: any) => {
    if (!auth.currentUser) return;

    // Check if profile is complete
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const data = userDoc.data();
      if (!data?.company || !data?.phone) {
        setPendingDownloadQual(qual);
        setShowProfileGate(true);
        return;
      }
    } catch (err) {
      console.error('[ProductDetail] Profile check failed:', err);
    }

    await executeDownload(qual);
  };

  const executeDownload = async (qual: any) => {
    if (!auth.currentUser) return;
    setDownloading(qual.id);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'userDownloads'), {
        userId: auth.currentUser.uid,
        email: auth.currentUser.email || '',
        pdfId: qual.id,
        timestamp: now,
      });

      // Track PDF download event (Meta Pixel + GA4)
      trackEvent('Download', {
        content_name: qual.title || qual.fileName || qual.id,
        content_category: product?.categoryName || 'pdf',
        content_ids: product ? [product.id] : undefined,
      });
      gtagEvent('file_download', {
        file_name: qual.title || qual.fileName || qual.id,
        item_id: product?.id,
        item_name: product?.name,
      });

      // Push download event to CRM with user profile info
      if (siteSettings?.crmWebhookEnabled && siteSettings?.crmWebhookUrl) {
        const userDocSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const profile = userDocSnap.data() || {};
        pushToCRM(
          {
            name: profile.displayName || auth.currentUser.displayName || '',
            email: auth.currentUser.email || '',
            phone: profile.phone || '',
            company: profile.company || '',
            country: profile.country || '',
            message: `Downloaded: ${qual.title || qual.fileName || qual.id}${product ? ` (Product: ${product.name})` : ''}`,
            source: 'pdf_download',
            createdAt: now,
          },
          siteSettings.crmWebhookUrl,
          siteSettings.crmWebhookHeaders,
        ).catch(() => {});
      }

      const link = document.createElement('a');
      link.href = qual.fileUrl;
      link.download = qual.fileName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDownloading(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'userDownloads');
      setDownloading(null);
      alert(t('common.download_failed'));
    }
  };

  const handleProfileGateComplete = () => {
    setShowProfileGate(false);
    if (pendingDownloadQual) {
      executeDownload(pendingDownloadQual);
      setPendingDownloadQual(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFB300]"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-[#E6F1FF] mb-4">{t('product.not_found')}</h2>
        <Link to="/products" className="text-[#FFB300] hover:text-[#FFCA28] flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('product.back_to_list')}
        </Link>
      </div>
    );
  }

  const productImage = product?.imageUrls?.[0];
  const productCategory = product?.categoryName || 'Auto Parts';
  const productJsonLd = product
    ? productWithFitmentSchema({
        name: product.name,
        sku: product.sku,
        productUrl: `/products/${product.id}`,
        category: productCategory,
        images: product.imageUrls,
        price: product.price,
        minOrder: 50,
        availability: 'InStock',
        oemNumber: product.oemNumber,
        fitments: product.fitments,
        compatibilityText: product.techSpecs?.compatibility,
      })
    : undefined;

  const breadcrumbs = product
    ? [
        { name: 'Home', url: '/' },
        { name: 'Products', url: '/products' },
        ...(product.categoryName
          ? [{ name: product.categoryName, url: `/products?category=${product.categoryId}` }]
          : []),
        { name: product.name, url: `/products/${product.id}` },
      ]
    : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {showProfileGate && (
        <ProfileGateModal
          onComplete={handleProfileGateComplete}
          onClose={() => { setShowProfileGate(false); setPendingDownloadQual(null); }}
        />
      )}
      {product && (
        <SEO
          title={`${product.name} (${product.sku}) | Vida Auto`}
          description={`${product.name} - ${productCategory}. SKU ${product.sku}. Bulk wholesale auto parts from Vida Auto with global shipping.`}
          path={`/products/${product.id}`}
          image={productImage}
          type="product"
          jsonLd={productJsonLd}
          breadcrumbs={breadcrumbs}
        />
      )}
      <Link to="/products" className="inline-flex items-center text-sm text-[#8892B0] hover:text-[#FFB300] mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> {t('product.back_to_catalog')}
      </Link>

      <div className="bg-[#112240] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Image Gallery & Video */}
          <div className="p-8 bg-[#0A192F] border-r border-white/5">
            <div className="bg-[#112240] rounded-xl overflow-hidden border border-white/5 mb-4 relative flex items-center justify-center">
              {product.videoUrl && activeImage === -1 ? (
                <video
                  src={product.videoUrl}
                  controls
                  className="w-full max-h-[70vh] object-contain"
                  poster={product.imageUrls?.[0]}
                  onError={() => { console.warn('[ProductDetail] Video decode error, switching to image'); setActiveImage(0); }}
                />
              ) : product.imageUrls && product.imageUrls.length > 0 ? (
                <a
                  href={product.imageUrls[activeImage === -1 ? 0 : activeImage]}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full group relative"
                  title={t('products.view_original', 'Click to view original')}
                >
                  <img
                    src={product.imageUrls[activeImage === -1 ? 0 : activeImage]}
                    alt={product.name}
                    decoding="async"
                    className="w-full max-h-[70vh] object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('products.view_original', 'View original')}
                  </span>
                </a>
              ) : (
                <img
                  src={`https://picsum.photos/seed/nanabuana-${product.id}/800/600`}
                  alt={product.name}
                  loading="lazy"
                  className="w-full max-h-[70vh] object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="flex space-x-4 overflow-x-auto pb-2">
              {product.videoUrl && (
                <button
                  onClick={() => setActiveImage(-1)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors relative bg-black flex items-center justify-center ${
                    activeImage === -1 ? 'border-[#FFB300]' : 'border-transparent hover:border-[#FFB300]/50'
                  }`}
                >
                  <Video className="w-8 h-8 text-[#FFB300]" />
                  <span className="absolute bottom-1 right-1 text-[8px] bg-[#FFB300] text-[#0A192F] px-1 rounded font-bold uppercase">Video</span>
                </button>
              )}
              {product.imageUrls && product.imageUrls.map((url, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(index)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors bg-[#0A192F] ${
                    activeImage === index ? 'border-[#FFB300]' : 'border-transparent hover:border-[#FFB300]/50'
                  }`}
                >
                  <img src={url} alt={`${product.name} ${index + 1}`} loading="lazy" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="p-8 md:p-12 flex flex-col">
            <div className="text-sm text-[#FFB300] font-semibold mb-2 uppercase tracking-wider">{product.categoryName}</div>
            <h1 className="text-3xl font-bold text-white mb-2">{product.name}</h1>
            <p className="text-[#8892B0] mb-1">SKU: <span className="font-mono text-white">{product.sku}</span></p>
            {product.oemNumber && <p className="text-[#8892B0] mb-1">OEM: <span className="font-mono text-white">{product.oemNumber}</span></p>}
            <div className="mb-5"></div>

            {/* Tech Specs */}
            {product.techSpecs && (
              <div className="mb-8">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-white/5 pb-2">{t('product.tech_specs')}</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                  {product.techSpecs.material && (
                    <div>
                      <dt className="text-sm font-medium text-[#8892B0]">{t('product.material')}</dt>
                      <dd className="mt-1 text-sm text-white">{product.techSpecs.material}</dd>
                    </div>
                  )}
                  {product.techSpecs.weight && (
                    <div>
                      <dt className="text-sm font-medium text-[#8892B0]">{t('product.weight')}</dt>
                      <dd className="mt-1 text-sm text-white">{product.techSpecs.weight}</dd>
                    </div>
                  )}
                  {product.techSpecs.compatibility && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-[#8892B0]">{t('product.compatibility')}</dt>
                      <dd className="mt-1 text-sm text-white">{product.techSpecs.compatibility}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <div className="mt-auto space-y-4">
              <button 
                onClick={handleWhatsAppInquiry}
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                {t('products.inquiry')} (WhatsApp)
              </button>
              
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#8892B0] uppercase tracking-wider">{t('product.downloads', 'Related Downloads')}</h3>
                
                <div className="grid grid-cols-1 gap-2">
                  {/* Product Specific Catalog */}
                  {product.catalogUrl && (
                    <div className="flex items-center justify-between p-3 bg-[#0A192F] rounded-lg border border-[#FFB300]/20 group">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <FileText className="w-4 h-4 text-[#FFB300] shrink-0" />
                        <span className="text-sm text-white truncate font-medium">{t('product.manual_catalog', 'Product Manual/Catalog')}</span>
                      </div>
                      {user ? (
                        <button 
                          onClick={() => handleDownload({ id: 'product-manual', title: product.name + ' Manual', url: product.catalogUrl })}
                          disabled={!!downloading}
                          className="text-[#FFB300] hover:text-[#FFCA28] transition-colors disabled:opacity-50"
                        >
                          {downloading === 'product-manual' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <Lock className="w-4 h-4 text-[#8892B0]" />
                      )}
                    </div>
                  )}

                  {qualifications.map((qual) => (
                    <div key={qual.id} className="flex items-center justify-between p-3 bg-[#0A192F] rounded-lg border border-white/5 group">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <FileText className="w-4 h-4 text-[#FFB300] shrink-0" />
                        <span className="text-sm text-white truncate">{qual.title}</span>
                      </div>
                      {user ? (
                        <button 
                          onClick={() => handleDownload(qual)}
                          disabled={!!downloading}
                          className="text-[#FFB300] hover:text-[#FFCA28] transition-colors disabled:opacity-50"
                        >
                          {downloading === qual.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <Lock className="w-4 h-4 text-[#8892B0]" />
                      )}
                    </div>
                  ))}

                  {qualifications.length === 0 && !product.catalogUrl && (
                    <div className="text-xs text-[#8892B0] italic">{t('product.no_downloads', 'No related downloads available')}</div>
                  )}
                </div>
                {!user && (
                  <Link to="/user" className="block text-center text-xs text-[#FFB300] hover:underline">
                    {t('products.loginToDownload')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
