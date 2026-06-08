import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

// Keywords to map blog post categories → sourcing guide category IDs
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  sourcing:  ['sourcing', 'negotiation', 'moq', 'procurement', 'buying'],
  quality:   ['quality', 'certification', 'iatf', 'iso', 'audit', 'testing', 'inspection'],
  tech:      ['technology', 'technical', 'brake', 'headlight', 'bulb', 'suspension', 'product', 'lighting', 'roi'],
  logistics: ['logistics', 'shipping', 'payment', 'fob', 'cif', 'freight', 'delivery'],
  supplier:  ['supplier', 'factory', 'manufacturer', 'vendor', 'producer'],
  trends:    ['trend', 'industry', 'market', 'ev', 'electric', 'compliance', 'news'],
};

const CACHE_KEY_POST_COUNTS = 'vida_sourcing_post_counts';

const SourcingGuides: React.FC = () => {
  const { t } = useTranslation();
  const { siteSettings } = useStore();
  const [postCounts, setPostCounts] = useState<Record<string, number>>(() => {
    const buildTimeCounts = (typeof window !== 'undefined' && (window as any).__POST_COUNTS__);
    if (buildTimeCounts) return buildTimeCounts;
    try {
      const cached = localStorage.getItem(CACHE_KEY_POST_COUNTS);
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'blogPosts'), orderBy('publishedAt', 'desc')));
        const counts: Record<string, number> = {};
        snap.docs.forEach(d => {
          const cat = ((d.data().category as string) || '').toLowerCase();
          Object.entries(CATEGORY_KEYWORDS).forEach(([id, keywords]) => {
            if (keywords.some(kw => cat.includes(kw))) {
              counts[id] = (counts[id] || 0) + 1;
            }
          });
        });
        setPostCounts(counts);
        try { localStorage.setItem(CACHE_KEY_POST_COUNTS, JSON.stringify(counts)); } catch {}
      } catch (e) {
        console.error('[SourcingGuides] failed to fetch post counts', e);
      }
    };
    fetchCounts();
  }, []);

  const defaultCategories = [
    { id: 'sourcing',  title: t('sourcing_guides.cat_sourcing_title',  'Sourcing & Negotiation'),  icon: '🤝', desc: t('sourcing_guides.cat_sourcing_desc',  'MOQ, pricing strategies, contracts, and more.'),              articleCount: postCounts['sourcing']  || 0 },
    { id: 'quality',   title: t('sourcing_guides.cat_quality_title',   'Quality & Certifications'), icon: '✅', desc: t('sourcing_guides.cat_quality_desc',   'IATF 16949, ISO, factory audit, testing.'),                  articleCount: postCounts['quality']   || 0 },
    { id: 'tech',      title: t('sourcing_guides.cat_tech_title',      'Product Technology'),       icon: '🔧', desc: t('sourcing_guides.cat_tech_desc',      'Brake pads, headlights, suspension – technical deep dives.'), articleCount: postCounts['tech']      || 0 },
    { id: 'logistics', title: t('sourcing_guides.cat_logistics_title', 'Logistics & Payment'),      icon: '🚢', desc: t('sourcing_guides.cat_logistics_desc', 'FOB, CIF, payment terms, shipping insurance.'),              articleCount: postCounts['logistics'] || 0 },
    { id: 'supplier',  title: t('sourcing_guides.cat_supplier_title',  'Supplier Management'),      icon: '🏭', desc: t('sourcing_guides.cat_supplier_desc',  'How to vet Chinese factories, performance tracking.'),       articleCount: postCounts['supplier']  || 0 },
    { id: 'trends',    title: t('sourcing_guides.cat_trends_title',    'Industry Trends'),          icon: '📈', desc: t('sourcing_guides.cat_trends_desc',    'EV parts, market shifts, compliance updates.'),              articleCount: postCounts['trends']    || 0 },
  ];

  const defaultFeatured = {
    title: t('sourcing_guides.feat_title', 'Minimum Order Quantity (MOQ) in Auto Parts'),
    description: t('sourcing_guides.feat_desc', 'Learn what MOQ means, why suppliers set it, and how to negotiate better terms for your business.'),
    readTime: t('sourcing_guides.feat_read_time', '10 min read'),
    comingSoon: true,
    slug: '',
  };

  const categories = (siteSettings?.sourcingCategories && siteSettings.sourcingCategories.length > 0)
    ? siteSettings.sourcingCategories
    : defaultCategories;

  const featuredGuide = siteSettings?.sourcingFeatured?.title
    ? siteSettings.sourcingFeatured
    : defaultFeatured;

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative w-full h-[320px] md:h-[400px] overflow-hidden">
        <img
          src="https://picsum.photos/seed/vida-resources-hero/1920/600"
          alt="Resources"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t('sourcing_guides.hub_title', 'Auto Parts Sourcing Knowledge Hub')}</h1>
          <p className="text-white/80 max-w-2xl text-sm md:text-base">{t('sourcing_guides.hub_desc', 'Everything you need to know to import from China – guides, tips, and industry insights.')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SEO
          title={t('sourcing_guides.seo_title', 'Auto Parts Sourcing Guides | Vida Auto')}
          description={t('sourcing_guides.seo_desc', 'Free resources and expert guides to help you source auto parts from China efficiently. Learn about MOQ, quality control, logistics, and more.')}
          path="/sourcing-guides"
          breadcrumbs={[
            { name: t('nav.home', 'Home'), url: '/' },
            { name: t('nav.resources', 'Resources'), url: '/sourcing-guides' },
          ]}
        />

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white rounded-xl p-6 border border-brand/20 hover:border-brand/40 transition shadow-lg"
          >
            <div className="text-4xl mb-3">{cat.icon}</div>
            <h2 className="text-xl font-semibold text-charcoal mb-2">{cat.title}</h2>
            <p className="text-charcoal/60 mb-4">{cat.desc}</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-charcoal/60">
                {cat.articleCount} {t('sourcing_guides.articles_suffix', 'articles')}
              </span>
              <Link
                to={cat.articleCount > 0 ? `/blog?category=${cat.id}` : '/blog'}
                className="text-brand hover:underline text-sm font-medium"
              >
                {t('sourcing_guides.browse', 'Browse →')}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Featured Guide */}
      <div className="bg-white rounded-xl p-8 border border-brand/20 mb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-block bg-brand/20 text-brand text-xs font-semibold px-2 py-1 rounded-full mb-2">
              {t('sourcing_guides.featured', 'Featured Guide')}
            </div>
            <h3 className="text-2xl font-bold text-charcoal mb-2">{featuredGuide.title}</h3>
            <p className="text-charcoal/60 max-w-2xl">{featuredGuide.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm text-charcoal/60">📘 {featuredGuide.readTime}</span>
              {featuredGuide.comingSoon && (
                <span className="text-xs bg-brand/10 text-brand px-2 py-1 rounded-full">
                  {t('sourcing_guides.coming_soon', 'Coming Soon')}
                </span>
              )}
            </div>
          </div>
          {!featuredGuide.comingSoon && featuredGuide.slug && (
            <Link
              to={`/blog/${featuredGuide.slug}`}
              className="bg-brand text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#FFC107] transition whitespace-nowrap"
            >
              {t('sourcing_guides.read_online', 'Read Guide')}
            </Link>
          )}
        </div>
      </div>

      {/* Internal Links - SEO Pillar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
        <Link to="/products" className="bg-white rounded-xl p-5 border border-stone-100 hover:border-brand/40 transition group">
          <h3 className="text-sm font-semibold text-charcoal group-hover:text-brand transition-colors">
            {t('sourcing_guides.pillar_products', 'Browse All Products')}
          </h3>
          <p className="text-xs text-charcoal/60 mt-1">
            {t('sourcing_guides.pillar_products_desc', '12,500+ SKUs across 45+ countries')}
          </p>
        </Link>
        <Link to="/blog" className="bg-white rounded-xl p-5 border border-stone-100 hover:border-brand/40 transition group">
          <h3 className="text-sm font-semibold text-charcoal group-hover:text-brand transition-colors">
            {t('sourcing_guides.pillar_blog', 'Industry Blog')}
          </h3>
          <p className="text-xs text-charcoal/60 mt-1">
            {t('sourcing_guides.pillar_blog_desc', 'Latest news, trends, and technical articles')}
          </p>
        </Link>
        <Link to="/factory" className="bg-white rounded-xl p-5 border border-stone-100 hover:border-brand/40 transition group">
          <h3 className="text-sm font-semibold text-charcoal group-hover:text-brand transition-colors">
            {t('sourcing_guides.pillar_factory', 'Our Factory')}
          </h3>
          <p className="text-xs text-charcoal/60 mt-1">
            {t('sourcing_guides.pillar_factory_desc', 'See our production lines and quality control')}
          </p>
        </Link>
        <Link to="/about" className="bg-white rounded-xl p-5 border border-stone-100 hover:border-brand/40 transition group">
          <h3 className="text-sm font-semibold text-charcoal group-hover:text-brand transition-colors">
            {t('sourcing_guides.pillar_about', 'About Vida Auto')}
          </h3>
          <p className="text-xs text-charcoal/60 mt-1">
            {t('sourcing_guides.pillar_about_desc', 'Our story, certifications, and global reach')}
          </p>
        </Link>
      </div>

      {/* Newsletter Signup */}
      <div className="bg-gradient-to-r from-cream to-white rounded-xl p-8 border border-brand/20 text-center">
        <h3 className="text-2xl font-bold text-charcoal mb-2">
          {t('sourcing_guides.newsletter_title', 'Get new sourcing guides directly in your inbox')}
        </h3>
        <p className="text-charcoal/60 mb-6">
          {t('sourcing_guides.newsletter_desc', 'No spam. Unsubscribe anytime.')}
        </p>
        <form className="flex flex-col sm:flex-row justify-center gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder={t('sourcing_guides.newsletter_placeholder', 'Your email address')}
            className="flex-1 px-4 py-2 rounded-lg bg-cream border border-brand/30 text-charcoal focus:outline-none focus:border-brand"
            required
          />
          <button
            type="submit"
            className="bg-brand text-white font-semibold px-6 py-2 rounded-lg hover:bg-[#FFC107] transition"
          >
            {t('sourcing_guides.newsletter_btn', 'Subscribe')}
          </button>
        </form>
      </div>
    </div>
    </div>
  );
};

export default SourcingGuides;
