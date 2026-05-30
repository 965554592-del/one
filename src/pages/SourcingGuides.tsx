import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';

const defaultCategories = [
  { id: 'sourcing', title: 'Sourcing & Negotiation', icon: '🤝', desc: 'MOQ, pricing strategies, contracts, and more.', articleCount: 0 },
  { id: 'quality', title: 'Quality & Certifications', icon: '✅', desc: 'IATF 16949, ISO, factory audit, testing.', articleCount: 0 },
  { id: 'tech', title: 'Product Technology', icon: '🔧', desc: 'Brake pads, headlights, suspension – technical deep dives.', articleCount: 0 },
  { id: 'logistics', title: 'Logistics & Payment', icon: '🚢', desc: 'FOB, CIF, payment terms, shipping insurance.', articleCount: 0 },
  { id: 'supplier', title: 'Supplier Management', icon: '🏭', desc: 'How to vet Chinese factories, performance tracking.', articleCount: 0 },
  { id: 'trends', title: 'Industry Trends', icon: '📈', desc: 'EV parts, market shifts, compliance updates.', articleCount: 0 },
];

const defaultFeatured = {
  title: 'Minimum Order Quantity (MOQ) in Auto Parts',
  description: 'Learn what MOQ means, why suppliers set it, and how to negotiate better terms for your business.',
  readTime: '10 min read',
  comingSoon: true,
  slug: '',
};

const SourcingGuides: React.FC = () => {
  const { t } = useTranslation();
  const { siteSettings } = useStore();

  const categories = (siteSettings?.sourcingCategories && siteSettings.sourcingCategories.length > 0)
    ? siteSettings.sourcingCategories
    : defaultCategories;

  const featuredGuide = siteSettings?.sourcingFeatured?.title
    ? siteSettings.sourcingFeatured
    : defaultFeatured;

  return (
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

      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-[#E6F1FF] mb-4">
          {t('sourcing_guides.hub_title', 'Auto Parts Sourcing Knowledge Hub')}
        </h1>
        <p className="text-lg text-[#8892B0] max-w-2xl mx-auto">
          {t('sourcing_guides.hub_desc', 'Everything you need to know to import from China – guides, tips, and industry insights.')}
        </p>
        <div className="mt-6">
          <Link
            to="/#contact"
            className="inline-block bg-[#FFB300] text-[#0A192F] font-semibold px-6 py-3 rounded-lg hover:bg-[#FFC107] transition"
          >
            {t('sourcing_guides.contact_experts', 'Contact Our Experts')}
          </Link>
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-[#112240] rounded-xl p-6 border border-[#FFB300]/20 hover:border-[#FFB300]/40 transition shadow-lg"
          >
            <div className="text-4xl mb-3">{cat.icon}</div>
            <h2 className="text-xl font-semibold text-[#E6F1FF] mb-2">{cat.title}</h2>
            <p className="text-[#8892B0] mb-4">{cat.desc}</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#8892B0]">
                {cat.articleCount} {t('sourcing_guides.articles_suffix', 'articles')}
              </span>
              <Link
                to={`/sourcing-guides?category=${cat.id}`}
                className="text-[#FFB300] hover:underline text-sm font-medium"
              >
                {t('sourcing_guides.browse', 'Browse →')}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Featured Guide */}
      <div className="bg-[#112240] rounded-xl p-8 border border-[#FFB300]/20 mb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-block bg-[#FFB300]/20 text-[#FFB300] text-xs font-semibold px-2 py-1 rounded-full mb-2">
              {t('sourcing_guides.featured', 'Featured Guide')}
            </div>
            <h3 className="text-2xl font-bold text-[#E6F1FF] mb-2">{featuredGuide.title}</h3>
            <p className="text-[#8892B0] max-w-2xl">{featuredGuide.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm text-[#8892B0]">📘 {featuredGuide.readTime}</span>
              {featuredGuide.comingSoon && (
                <span className="text-xs bg-[#FFB300]/10 text-[#FFB300] px-2 py-1 rounded-full">
                  {t('sourcing_guides.coming_soon', 'Coming Soon')}
                </span>
              )}
            </div>
          </div>
          {!featuredGuide.comingSoon && featuredGuide.slug && (
            <Link
              to={`/blog/${featuredGuide.slug}`}
              className="bg-[#FFB300] text-[#0A192F] px-5 py-2 rounded-lg font-semibold hover:bg-[#FFC107] transition whitespace-nowrap"
            >
              {t('sourcing_guides.read_online', 'Read Guide')}
            </Link>
          )}
        </div>
      </div>

      {/* Internal Links - SEO Pillar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
        <Link to="/products" className="bg-[#112240] rounded-xl p-5 border border-white/5 hover:border-[#FFB300]/40 transition group">
          <h3 className="text-sm font-semibold text-[#E6F1FF] group-hover:text-[#FFB300] transition-colors">
            {t('sourcing_guides.pillar_products', 'Browse All Products')}
          </h3>
          <p className="text-xs text-[#8892B0] mt-1">
            {t('sourcing_guides.pillar_products_desc', '12,500+ SKUs across 45+ countries')}
          </p>
        </Link>
        <Link to="/blog" className="bg-[#112240] rounded-xl p-5 border border-white/5 hover:border-[#FFB300]/40 transition group">
          <h3 className="text-sm font-semibold text-[#E6F1FF] group-hover:text-[#FFB300] transition-colors">
            {t('sourcing_guides.pillar_blog', 'Industry Blog')}
          </h3>
          <p className="text-xs text-[#8892B0] mt-1">
            {t('sourcing_guides.pillar_blog_desc', 'Latest news, trends, and technical articles')}
          </p>
        </Link>
        <Link to="/factory" className="bg-[#112240] rounded-xl p-5 border border-white/5 hover:border-[#FFB300]/40 transition group">
          <h3 className="text-sm font-semibold text-[#E6F1FF] group-hover:text-[#FFB300] transition-colors">
            {t('sourcing_guides.pillar_factory', 'Our Factory')}
          </h3>
          <p className="text-xs text-[#8892B0] mt-1">
            {t('sourcing_guides.pillar_factory_desc', 'See our production lines and quality control')}
          </p>
        </Link>
        <Link to="/about" className="bg-[#112240] rounded-xl p-5 border border-white/5 hover:border-[#FFB300]/40 transition group">
          <h3 className="text-sm font-semibold text-[#E6F1FF] group-hover:text-[#FFB300] transition-colors">
            {t('sourcing_guides.pillar_about', 'About Vida Auto')}
          </h3>
          <p className="text-xs text-[#8892B0] mt-1">
            {t('sourcing_guides.pillar_about_desc', 'Our story, certifications, and global reach')}
          </p>
        </Link>
      </div>

      {/* Newsletter Signup */}
      <div className="bg-gradient-to-r from-[#0A192F] to-[#112240] rounded-xl p-8 border border-[#FFB300]/20 text-center">
        <h3 className="text-2xl font-bold text-[#E6F1FF] mb-2">
          {t('sourcing_guides.newsletter_title', 'Get new sourcing guides directly in your inbox')}
        </h3>
        <p className="text-[#8892B0] mb-6">
          {t('sourcing_guides.newsletter_desc', 'No spam. Unsubscribe anytime.')}
        </p>
        <form className="flex flex-col sm:flex-row justify-center gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder={t('sourcing_guides.newsletter_placeholder', 'Your email address')}
            className="flex-1 px-4 py-2 rounded-lg bg-[#0A192F] border border-[#FFB300]/30 text-[#E6F1FF] focus:outline-none focus:border-[#FFB300]"
            required
          />
          <button
            type="submit"
            className="bg-[#FFB300] text-[#0A192F] font-semibold px-6 py-2 rounded-lg hover:bg-[#FFC107] transition"
          >
            {t('sourcing_guides.newsletter_btn', 'Subscribe')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SourcingGuides;
