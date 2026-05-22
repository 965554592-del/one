import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldCheck, Package, Truck, Clock, Settings, FileText, Globe, CheckCircle, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import LazyVideo from '../components/LazyVideo';
import { useStore } from '../store/useStore';
import { organizationSchema, faqSchema } from '../lib/schema';

export default function Factory() {
  const { t } = useTranslation();
  const { siteSettings } = useStore();

  const orgJsonLd = organizationSchema();

  const faqJsonLd = faqSchema([
    {
      question: 'What certifications does Vida Auto hold?',
      answer: 'Vida Auto holds ISO 9001:2015 Quality Management System and IATF 16949 Automotive Quality Standard certifications. All products undergo strict quality control with full batch traceability.',
    },
    {
      question: 'What is the minimum order quantity (MOQ)?',
      answer: 'MOQ varies by product category, typically starting from 50 to 500 pieces. Contact us for specific product MOQ details and volume discount pricing.',
    },
    {
      question: 'Which countries do you export to?',
      answer: 'We export to over 60 countries across the Middle East, Southeast Asia, Africa, Latin America, Europe, and CIS regions. Shipping is available FOB Guangzhou, CIF, or DDP.',
    },
    {
      question: 'What is the typical lead time for orders?',
      answer: 'Standard lead time is 7-15 days for in-stock items and 15-30 days for custom or made-to-order products. Rush orders can be arranged upon request.',
    },
    {
      question: 'Do you offer OEM and private label services?',
      answer: 'Yes, we offer full OEM and private label manufacturing. We can customize packaging, branding, and product specifications to meet your requirements. Minimum quantities apply for custom orders.',
    },
    {
      question: 'How do you ensure product quality?',
      answer: 'Every batch undergoes multi-stage quality inspection including raw material testing, in-process checks, and final inspection before shipment. We provide COC (Certificate of Conformity) and factory inspection reports upon request.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept T/T (telegraphic transfer), L/C (letter of credit), and Trade Assurance. Typical terms are 30% deposit with 70% balance before shipment.',
    },
  ]);

  const jsonLd = [orgJsonLd, faqJsonLd];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO
        title="OEM Auto Parts Factory in China | Vida Auto - ISO Certified Manufacturer"
        description="Vida Auto: OEM-quality headlight lens cover & auto bulb factory in Guangzhou, China. ISO 9001 & IATF 16949 certified. MOQ 50pcs, 15-day lead time, custom packaging, export to 50+ countries."
        path="/factory"
        jsonLd={jsonLd}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'Factory', url: '/factory' },
        ]}
        omitOrganization
      />

      {/* HERO */}
      <div className="relative bg-[#112240] rounded-2xl border border-white/5 overflow-hidden mb-12">
        <div className="relative min-h-[300px] md:min-h-[400px] flex items-center">
          {siteSettings?.factoryVideoUrl ? (
            <LazyVideo src={siteSettings.factoryVideoUrl} poster={siteSettings?.factoryBgUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" />
          ) : siteSettings?.factoryBgUrl ? (
            <div className="absolute inset-0 w-full h-full bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${siteSettings.factoryBgUrl})` }} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-[#0A192F] via-[#112240] to-[#0A192F]" />
          )}
          <div className="relative z-10 p-8 md:p-12 max-w-3xl">
            <h1 className="text-3xl md:text-4xl font-bold text-[#E6F1FF] mb-4">
              {t('factory.hero_title')}<br />
              <span className="text-[#FFB300]">{t('factory.hero_highlight')}</span>
            </h1>
            <p className="text-lg text-[#8892B0] mb-6">
              {t('factory.hero_desc')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/#contact" className="px-6 py-3 bg-[#FFB300] text-[#0A192F] rounded-lg font-semibold hover:bg-[#FFCA28] transition-colors">
                {t('factory.request_quote')}
              </Link>
              <Link to="/products" className="px-6 py-3 border border-[#FFB300] text-[#FFB300] rounded-lg font-semibold hover:bg-[#FFB300]/10 transition-colors">
                {t('factory.browse_catalog')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* KEY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { value: '10+', label: t('factory.years_exp') },
          { value: '50+', label: t('factory.export_countries') },
          { value: '5,000+', label: t('factory.skus_available') },
          { value: '50 pcs', label: t('factory.min_moq') },
        ].map((m, i) => (
          <div key={i} className="bg-[#112240] rounded-xl border border-white/5 p-5 text-center">
            <div className="text-2xl md:text-3xl font-bold text-[#FFB300]">{m.value}</div>
            <div className="text-sm text-[#8892B0] mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* CERTIFICATIONS */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#E6F1FF] mb-6 flex items-center">
          <ShieldCheck className="w-6 h-6 text-[#FFB300] mr-2" />
          {t('factory.cert_title')}
        </h2>
        <div className="bg-[#112240] rounded-xl border border-white/5 p-6">
          <p className="text-[#8892B0] mb-6">
            {t('factory.cert_desc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { cert: 'ISO 9001:2015', desc: t('factory.cert_iso') },
              { cert: 'IATF 16949', desc: t('factory.cert_iatf') },
              { cert: 'SGS / TÜV Testing', desc: t('factory.cert_sgs') },
            ].map((c, i) => (
              <div key={i} className="bg-[#0A192F] rounded-lg p-4 border border-white/5">
                <div className="flex items-center mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                  <span className="font-semibold text-[#E6F1FF]">{c.cert}</span>
                </div>
                <p className="text-sm text-[#8892B0]">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OEM CAPABILITIES */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#E6F1FF] mb-6 flex items-center">
          <Settings className="w-6 h-6 text-[#FFB300] mr-2" />
          {t('factory.oem_title')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#112240] rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-semibold text-[#E6F1FF] mb-3">{t('factory.oem_xref_title')}</h3>
            <p className="text-sm text-[#8892B0] mb-4">{t('factory.oem_xref_desc')}</p>
            <ul className="space-y-2 text-sm text-[#8892B0]">
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.oem_xref_1')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.oem_xref_2')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.oem_xref_3')}</li>
            </ul>
          </div>
          <div className="bg-[#112240] rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-semibold text-[#E6F1FF] mb-3">{t('factory.custom_title')}</h3>
            <p className="text-sm text-[#8892B0] mb-4">{t('factory.custom_desc')}</p>
            <ul className="space-y-2 text-sm text-[#8892B0]">
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.custom_1')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.custom_2')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.custom_3')}</li>
            </ul>
          </div>
          <div className="bg-[#112240] rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-semibold text-[#E6F1FF] mb-3">{t('factory.prod_title')}</h3>
            <p className="text-sm text-[#8892B0] mb-4">{t('factory.prod_desc')}</p>
            <ul className="space-y-2 text-sm text-[#8892B0]">
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.prod_1')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.prod_2')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.prod_3')}</li>
            </ul>
          </div>
          <div className="bg-[#112240] rounded-xl border border-white/5 p-6">
            <h3 className="text-lg font-semibold text-[#E6F1FF] mb-3">{t('factory.qc_title')}</h3>
            <p className="text-sm text-[#8892B0] mb-4">{t('factory.qc_desc')}</p>
            <ul className="space-y-2 text-sm text-[#8892B0]">
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.qc_1')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.qc_2')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.qc_3')}</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.qc_4')}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* EXPORT EXPERIENCE */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#E6F1FF] mb-6 flex items-center">
          <Globe className="w-6 h-6 text-[#FFB300] mr-2" />
          {t('factory.export_title')}
        </h2>
        <div className="bg-[#112240] rounded-xl border border-white/5 p-6">
          <p className="text-[#8892B0] mb-6">
            {t('factory.export_desc')}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-md font-semibold text-[#E6F1FF] mb-3">{t('factory.export_markets')}</h3>
              <div className="flex flex-wrap gap-2">
                {['USA', 'Germany', 'UK', 'Russia', 'UAE', 'Saudi Arabia', 'Japan', 'South Korea', 'Thailand', 'Indonesia', 'Nigeria', 'South Africa', 'Brazil', 'Mexico', 'Australia'].map(country => (
                  <span key={country} className="px-3 py-1 bg-[#0A192F] border border-white/10 rounded-full text-xs text-[#8892B0]">{country}</span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-md font-semibold text-[#E6F1FF] mb-3">{t('factory.export_docs')}</h3>
              <ul className="space-y-2 text-sm text-[#8892B0]">
                <li className="flex items-start"><FileText className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.doc_1')}</li>
                <li className="flex items-start"><FileText className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.doc_2')}</li>
                <li className="flex items-start"><FileText className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.doc_3')}</li>
                <li className="flex items-start"><FileText className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.doc_4')}</li>
                <li className="flex items-start"><FileText className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.doc_5')}</li>
                <li className="flex items-start"><FileText className="w-4 h-4 text-[#FFB300] mr-2 mt-0.5 shrink-0" />{t('factory.doc_6')}</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0A192F] rounded-lg p-4 border border-white/5 text-center">
              <Truck className="w-6 h-6 text-[#FFB300] mx-auto mb-2" />
              <div className="text-sm font-semibold text-[#E6F1FF]">{t('factory.shipping_terms')}</div>
              <div className="text-xs text-[#8892B0] mt-1">FOB, CIF, DDP, EXW</div>
            </div>
            <div className="bg-[#0A192F] rounded-lg p-4 border border-white/5 text-center">
              <Package className="w-6 h-6 text-[#FFB300] mx-auto mb-2" />
              <div className="text-sm font-semibold text-[#E6F1FF]">{t('factory.payment_terms')}</div>
              <div className="text-xs text-[#8892B0] mt-1">T/T, L/C, PayPal, Trade Assurance</div>
            </div>
            <div className="bg-[#0A192F] rounded-lg p-4 border border-white/5 text-center">
              <Clock className="w-6 h-6 text-[#FFB300] mx-auto mb-2" />
              <div className="text-sm font-semibold text-[#E6F1FF]">{t('factory.delivery_port')}</div>
              <div className="text-xs text-[#8892B0] mt-1">Guangzhou / Shenzhen / Ningbo</div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-[#E6F1FF] mb-6">{t('factory.why_title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: t('factory.why_1_title'), desc: t('factory.why_1_desc') },
            { title: t('factory.why_2_title'), desc: t('factory.why_2_desc') },
            { title: t('factory.why_3_title'), desc: t('factory.why_3_desc') },
            { title: t('factory.why_4_title'), desc: t('factory.why_4_desc') },
            { title: t('factory.why_5_title'), desc: t('factory.why_5_desc') },
            { title: t('factory.why_6_title'), desc: t('factory.why_6_desc') },
          ].map((item, i) => (
            <div key={i} className="bg-[#112240] rounded-xl border border-white/5 p-5">
              <h3 className="text-md font-semibold text-[#E6F1FF] mb-2">{item.title}</h3>
              <p className="text-sm text-[#8892B0]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="bg-gradient-to-r from-[#FFB300]/10 to-transparent rounded-xl border border-[#FFB300]/20 p-8 text-center">
        <h2 className="text-2xl font-bold text-[#E6F1FF] mb-3">{t('factory.cta_title')}</h2>
        <p className="text-[#8892B0] mb-6 max-w-2xl mx-auto">
          {t('factory.cta_desc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/#contact" className="px-8 py-3 bg-[#FFB300] text-[#0A192F] rounded-lg font-semibold hover:bg-[#FFCA28] transition-colors flex items-center justify-center">
            {t('factory.request_quote')} <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
          <Link to="/products" className="px-8 py-3 border border-[#FFB300] text-[#FFB300] rounded-lg font-semibold hover:bg-[#FFB300]/10 transition-colors">
            {t('factory.cta_catalog')}
          </Link>
        </div>
      </div>
    </div>
  );
}
