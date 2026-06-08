import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Truck, ShieldCheck, Clock, Package } from 'lucide-react';
import SEO from '../components/SEO';

interface RegionData {
  slug: string;
  title: string;
  description: string;
  seoTitle: string;
  seoDesc: string;
  shipping: string;
  delivery: string;
  highlights: string[];
  popular: string[];
}

const REGIONS: Record<string, RegionData> = {
  usa: {
    slug: 'usa',
    title: 'Ship to United States',
    description: 'Vida Auto supplies OEM-quality headlight lens covers and auto bulbs to wholesalers across the United States. We offer competitive FOB pricing, consolidated container shipping to major US ports, and full export documentation.',
    seoTitle: 'Wholesale Auto Parts to USA | Vida Auto – OEM Headlight Covers & Bulbs',
    seoDesc: 'Vida Auto ships OEM-quality headlight lens covers and auto bulbs to the USA. FOB Guangzhou pricing, container shipping to LA/NY/Houston ports, and export-ready documentation.',
    shipping: 'Sea freight to Los Angeles, Long Beach, New York, Houston, Savannah. Transit 15–25 days.',
    delivery: '15–25 days by sea, 5–7 days by air',
    highlights: [
      'DOT / SAE compliance documentation available',
      'Palletized packaging for US warehouse receiving',
      'USD wire transfer or L/C payment terms',
      'Full container load (FCL) or LCL options',
    ],
    popular: ['Toyota', 'Honda', 'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen'],
  },
  europe: {
    slug: 'europe',
    title: 'Ship to Europe',
    description: 'Vida Auto exports headlight lens covers and automotive bulbs to European distributors. We serve markets including Germany, UK, France, Poland, Netherlands, and Spain with competitive CIF pricing and CE-ready products.',
    seoTitle: 'Wholesale Auto Parts to Europe | Vida Auto – Headlight Covers & Bulbs Exporter',
    seoDesc: 'Vida Auto exports OEM-quality headlight lens covers and auto bulbs to Europe. CIF pricing to Hamburg, Rotterdam, Felixstowe. CE documentation available.',
    shipping: 'Sea freight to Hamburg, Rotterdam, Felixstowe, Piraeus, Gdańsk. Transit 25–35 days.',
    delivery: '25–35 days by sea, 7–10 days by air',
    highlights: [
      'ECE / E-mark certification support',
      'Euro-pallet compatible packaging',
      'EUR/USD payment, T/T or L/C accepted',
      'Experience with EU customs clearance documentation',
    ],
    popular: ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Volvo', 'Skoda'],
  },
  'middle-east': {
    slug: 'middle-east',
    title: 'Ship to Middle East',
    description: 'Vida Auto serves automotive parts distributors across the Middle East, including UAE, Saudi Arabia, Iraq, and Iran. We offer FOB/CIF pricing with fast transit times from Guangzhou to Jebel Ali, Dammam, and other regional ports.',
    seoTitle: 'Wholesale Auto Parts to Middle East | Vida Auto – Headlight Covers & Bulbs',
    seoDesc: 'Vida Auto ships OEM headlight lens covers and auto bulbs to UAE, Saudi Arabia, Iraq. FOB/CIF Guangzhou, fast transit to Jebel Ali and Dammam ports.',
    shipping: 'Sea freight to Jebel Ali (Dubai), Dammam, Umm Qasr, Bandar Abbas. Transit 12–20 days.',
    delivery: '12–20 days by sea, 3–5 days by air',
    highlights: [
      'GCC standards documentation available',
      'High-temperature resistant packaging',
      'USD payment, T/T or Western Union accepted',
      'Arabic-language packing lists available',
    ],
    popular: ['Toyota', 'Hyundai', 'Kia', 'Lexus', 'BMW', 'Mercedes-Benz'],
  },
  'southeast-asia': {
    slug: 'southeast-asia',
    title: 'Ship to Southeast Asia',
    description: 'Vida Auto exports headlight lens covers and automotive bulbs to Southeast Asian markets including Thailand, Indonesia, Vietnam, Philippines, and Malaysia. Short transit times and competitive pricing from our Guangzhou facility.',
    seoTitle: 'Wholesale Auto Parts to Southeast Asia | Vida Auto – Headlight Covers & Bulbs',
    seoDesc: 'Vida Auto ships OEM headlight covers and auto bulbs to Thailand, Indonesia, Vietnam, Philippines. Short transit from Guangzhou, competitive FOB pricing.',
    shipping: 'Sea freight to Bangkok, Jakarta, Ho Chi Minh, Manila, Port Klang. Transit 5–12 days.',
    delivery: '5–12 days by sea, 2–4 days by air',
    highlights: [
      'Short transit from Guangzhou — as fast as 5 days',
      'Small MOQ for market testing',
      'USD or RMB payment accepted',
      'Form E (ACFTA) certificate of origin available',
    ],
    popular: ['Toyota', 'Honda', 'Hyundai', 'Mazda', 'Kia', 'Volkswagen'],
  },
  africa: {
    slug: 'africa',
    title: 'Ship to Africa',
    description: 'Vida Auto supplies headlight lens covers and auto bulbs to African markets including Nigeria, South Africa, Kenya, Ghana, and Tanzania. We offer competitive pricing with flexible payment and shipping options.',
    seoTitle: 'Wholesale Auto Parts to Africa | Vida Auto – Headlight Covers & Bulbs Exporter',
    seoDesc: 'Vida Auto exports OEM headlight covers and auto bulbs to Nigeria, South Africa, Kenya. Competitive FOB pricing, flexible MOQ, and container shipping.',
    shipping: 'Sea freight to Lagos, Durban, Mombasa, Tema, Dar es Salaam. Transit 20–35 days.',
    delivery: '20–35 days by sea, 5–8 days by air',
    highlights: [
      'Flexible minimum order quantities',
      'Strong packaging for long-haul transit',
      'USD or RMB payment, T/T or Western Union',
      'Certificate of origin and commercial invoice included',
    ],
    popular: ['Toyota', 'Honda', 'Hyundai', 'Kia', 'Mercedes-Benz', 'Volkswagen'],
  },
};

export default function ShipTo() {
  const { region } = useParams<{ region: string }>();
  const { t } = useTranslation();
  const data = region ? REGIONS[region] : null;

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <SEO title="Ship Worldwide | Vida Auto" description="Vida Auto ships OEM-quality headlight covers and auto bulbs worldwide. Select your region." path="/ship-to" breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Ship Worldwide', url: '/ship-to' }]} />
        <h1 className="text-3xl font-bold text-charcoal mb-8">{t('ship.select_region', 'Select Your Region')}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.values(REGIONS).map(r => (
            <Link key={r.slug} to={`/ship-to/${r.slug}`} className="bg-white rounded-xl border border-stone-100 p-6 hover:border-brand/50 transition-all hover:-translate-y-1 duration-300 group">
              <Truck className="w-8 h-8 text-brand mb-4" />
              <h2 className="text-lg font-semibold text-charcoal mb-2">{r.title}</h2>
              <p className="text-sm text-charcoal/60 mb-4 line-clamp-2">{r.description}</p>
              <span className="text-sm text-brand flex items-center">{t('home.view_details', 'View Details')} <ArrowRight className="w-4 h-4 ml-1" /></span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: data.seoTitle,
    description: data.seoDesc,
    url: `https://autoparts.fit/ship-to/${data.slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'Guangzhou Vida Auto Parts Co., Ltd.',
      url: 'https://autoparts.fit',
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO title={data.seoTitle} description={data.seoDesc} path={`/ship-to/${data.slug}`} jsonLd={jsonLd} breadcrumbs={[{ name: 'Home', url: '/' }, { name: 'Ship Worldwide', url: '/ship-to' }, { name: data.title, url: `/ship-to/${data.slug}` }]} />

      <nav className="text-sm text-charcoal/60 mb-6">
        <Link to="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/ship-to" className="hover:text-brand">Ship Worldwide</Link>
        <span className="mx-2">/</span>
        <span className="text-charcoal">{data.title}</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-charcoal mb-6">{data.title}</h1>
      <p className="text-lg text-charcoal/60 mb-10 max-w-3xl">{data.description}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white rounded-xl border border-stone-100 p-5">
          <Truck className="w-6 h-6 text-brand mb-3" />
          <h3 className="text-sm font-semibold text-charcoal mb-1">Shipping Routes</h3>
          <p className="text-xs text-charcoal/60">{data.shipping}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-100 p-5">
          <Clock className="w-6 h-6 text-brand mb-3" />
          <h3 className="text-sm font-semibold text-charcoal mb-1">Delivery Time</h3>
          <p className="text-xs text-charcoal/60">{data.delivery}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-100 p-5">
          <ShieldCheck className="w-6 h-6 text-brand mb-3" />
          <h3 className="text-sm font-semibold text-charcoal mb-1">Quality Assurance</h3>
          <p className="text-xs text-charcoal/60">OEM-equivalent quality with full QC inspection before shipment</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-100 p-5">
          <Package className="w-6 h-6 text-brand mb-3" />
          <h3 className="text-sm font-semibold text-charcoal mb-1">Packaging</h3>
          <p className="text-xs text-charcoal/60">Individual box + carton + pallet, export-grade protection</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-100 p-6 mb-12">
        <h2 className="text-xl font-bold text-charcoal mb-4">Why Choose Vida Auto</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.highlights.map((h, i) => (
            <li key={i} className="flex items-start text-sm text-charcoal/60">
              <span className="text-brand mr-2 mt-0.5">✓</span>
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-bold text-charcoal mb-4">Popular Brands for This Region</h2>
        <div className="flex flex-wrap gap-3">
          {data.popular.map(brand => (
            <Link key={brand} to={`/products?search=${encodeURIComponent(brand)}`} className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm text-charcoal hover:border-brand/50 transition-colors">
              {brand}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-brand/10 to-transparent rounded-xl border border-brand/20 p-8 text-center">
        <h2 className="text-2xl font-bold text-charcoal mb-3">Ready to Order?</h2>
        <p className="text-charcoal/60 mb-6">Contact us for a wholesale quote with FOB/CIF pricing tailored to your region.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/products" className="px-6 py-3 bg-brand text-white rounded-lg font-semibold hover:bg-brand-light transition-colors">
            Browse Catalog
          </Link>
          <Link to="/#contact" className="px-6 py-3 border border-brand text-brand rounded-lg font-semibold hover:bg-brand/10 transition-colors">
            Get a Quote
          </Link>
        </div>
      </div>
    </div>
  );
}
