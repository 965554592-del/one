/**
 * Reusable schema.org structured data builders for B2B SEO.
 *
 * Includes:
 *  - Organization (with credentials/awards)
 *  - Offer (B2B wholesale - "RFQ" instead of fixed price)
 *  - BreadcrumbList
 *  - Vehicle fitment (YMM) for product compatibility
 */

const SITE_URL = 'https://autoparts.fit';

/**
 * Vehicle fitment item — Year/Make/Model triple used for auto-parts compatibility.
 * Either pass a structured triple OR a free-text `displayName` (legacy compatibility string).
 */
export interface VehicleFitment {
  year?: number | string;
  make?: string;
  model?: string;
  displayName?: string; // e.g. "2018-2023 Toyota Camry"
}

/**
 * Build a schema.org Vehicle node from a YMM triple.
 * Returns null if the input is empty.
 */
// Authoritative Wikidata/Wikipedia URLs for major vehicle manufacturers (GEO signal)
const MANUFACTURER_URLS: Record<string, string> = {
  'Toyota': 'https://www.wikidata.org/wiki/Q53268',
  'Honda': 'https://www.wikidata.org/wiki/Q9584',
  'Nissan': 'https://www.wikidata.org/wiki/Q20165',
  'Hyundai': 'https://www.wikidata.org/wiki/Q55931',
  'Kia': 'https://www.wikidata.org/wiki/Q35349',
  'BMW': 'https://www.wikidata.org/wiki/Q26678',
  'Mercedes-Benz': 'https://www.wikidata.org/wiki/Q36594',
  'Volkswagen': 'https://www.wikidata.org/wiki/Q246',
  'Ford': 'https://www.wikidata.org/wiki/Q44294',
  'Chevrolet': 'https://www.wikidata.org/wiki/Q29570',
  'Mazda': 'https://www.wikidata.org/wiki/Q35996',
  'Suzuki': 'https://www.wikidata.org/wiki/Q181642',
  'Mitsubishi': 'https://www.wikidata.org/wiki/Q36033',
  'Subaru': 'https://www.wikidata.org/wiki/Q172741',
  'Audi': 'https://www.wikidata.org/wiki/Q23317',
  'Porsche': 'https://www.wikidata.org/wiki/Q40993',
  'Peugeot': 'https://www.wikidata.org/wiki/Q6742',
  'Renault': 'https://www.wikidata.org/wiki/Q6686',
  'Citroen': 'https://www.wikidata.org/wiki/Q23827',
  'Fiat': 'https://www.wikidata.org/wiki/Q27597',
  'Land Rover': 'https://www.wikidata.org/wiki/Q26777',
  'Jaguar': 'https://www.wikidata.org/wiki/Q26921',
  'BYD': 'https://www.wikidata.org/wiki/Q27723',
  'Geely': 'https://www.wikidata.org/wiki/Q199822',
  'Dodge': 'https://www.wikidata.org/wiki/Q27564',
  'Jeep': 'https://www.wikidata.org/wiki/Q30736',
};

export function vehicleNode(v: VehicleFitment) {
  if (!v) return null;
  const name = v.displayName || [v.year, v.make, v.model].filter(Boolean).join(' ').trim();
  if (!name) return null;
  const node: Record<string, unknown> = {
    '@type': 'Vehicle',
    name,
  };
  if (v.year) node.vehicleModelDate = String(v.year);
  if (v.make) {
    const mfgUrl = MANUFACTURER_URLS[v.make];
    node.manufacturer = {
      '@type': 'Organization',
      name: v.make,
      ...(mfgUrl ? { sameAs: mfgUrl } : {}),
    };
  }
  if (v.model) node.model = v.model;
  return node;
}

export interface BreadcrumbItem {
  name: string;
  url?: string; // relative or absolute; if relative, will be prefixed with SITE_URL
}

/**
 * Build a BreadcrumbList JSON-LD object.
 * Pass items in order from root → current page.
 */
export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      ...(item.url
        ? { item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url.startsWith('/') ? '' : '/'}${item.url}` }
        : {}),
    })),
  };
}

/**
 * Full Organization schema - covers company info, contact, certifications, awards.
 */
export function organizationSchema(opts?: { phone?: string; email?: string; logoUrl?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: 'Guangzhou Vida Auto Parts Co., Ltd.',
    alternateName: 'Vida Auto',
    url: SITE_URL,
    logo: opts?.logoUrl || `${SITE_URL}/favicon.png`,
    description: 'OEM-quality headlight lens cover and automotive bulb manufacturer in Guangzhou, China. ISO 9001 & IATF 16949 certified factory exporting to 50+ countries.',
    foundingDate: '2014',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Guangzhou',
      addressRegion: 'Guangdong',
      addressCountry: 'CN',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: opts?.phone || '',
      email: opts?.email || '',
      contactType: 'sales',
      availableLanguage: ['English', 'Chinese'],
      areaServed: 'Worldwide',
    },
    hasCredential: [
      {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'certification',
        name: 'ISO 9001:2015 Quality Management System',
      },
      {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'certification',
        name: 'IATF 16949 Automotive Quality Standard',
      },
    ],
    award: [
      'Verified Manufacturer Status',
      '10+ Years OEM Production Experience',
    ],
    knowsAbout: [
      'Automotive Headlight Lens Cover',
      'Auto Bulb Manufacturing',
      'OEM Auto Parts Production',
      'Private Label Auto Parts',
    ],
    areaServed: [
      { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: 25, longitude: 55 }, description: 'Middle East' },
      { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: 10, longitude: 106 }, description: 'Southeast Asia' },
      { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: 0, longitude: 25 }, description: 'Africa' },
      { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: -15, longitude: -60 }, description: 'Latin America' },
      { '@type': 'GeoCircle', geoMidpoint: { '@type': 'GeoCoordinates', latitude: 50, longitude: 10 }, description: 'Europe' },
    ],
    numberOfEmployees: { '@type': 'QuantitativeValue', minValue: 50, maxValue: 200 },
    sameAs: [
      'https://www.facebook.com/vidaauto',
    ],
  };
}

/**
 * FAQ schema for technical Q&A pages.
 * Pass an array of {question, answer} pairs.
 */
export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * Shipping/export details schema for region pages.
 */
export function shippingSchema(opts: { region: string; deliveryDays: number; shippingOrigin?: string }) {
  return {
    '@type': 'OfferShippingDetails',
    shippingDestination: {
      '@type': 'DefinedRegion',
      name: opts.region,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 7, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 7, maxValue: opts.deliveryDays, unitCode: 'DAY' },
    },
    shippingOrigin: {
      '@type': 'DefinedRegion',
      name: opts.shippingOrigin || 'Guangzhou, China',
    },
  };
}

/**
 * B2B wholesale Offer schema. Instead of a fixed price, mark as "request for quote".
 * Uses PriceSpecification with priceType=ListPrice + a businessFunction of "Sell".
 * The availability is set to "InStock" by default; use "PreOrder" for made-to-order items.
 */
export function wholesaleOfferSchema(opts: {
  productUrl: string;
  sku: string;
  availability?: 'InStock' | 'PreOrder' | 'OutOfStock';
  minOrder?: number;
  price?: number;
}) {
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    sku: opts.sku,
    url: opts.productUrl.startsWith('http') ? opts.productUrl : `${SITE_URL}${opts.productUrl}`,
    availability: `https://schema.org/${opts.availability || 'InStock'}`,
    businessFunction: 'https://purl.org/goodrelations/v1#Sell',
    seller: { '@type': 'Organization', name: 'Vida Auto', '@id': `${SITE_URL}#organization` },
    eligibleCustomerType: 'https://schema.org/BusinessEntity',
    eligibleQuantity: {
      '@type': 'QuantitativeValue',
      minValue: opts.minOrder || 50,
      unitCode: 'C62', // ISO unit code for "piece"
    },
    priceCurrency: 'USD',
    priceSpecification: {
      '@type': 'PriceSpecification',
      priceCurrency: 'USD',
      // No fixed price for B2B wholesale - encourage RFQ
      ...(opts.price && opts.price > 0
        ? { price: opts.price }
        : { description: 'Request for quote (RFQ) - wholesale pricing available' }),
    },
  };
  return offer;
}

/**
 * Build a Product JSON-LD with optional vehicle fitment (YMM) data.
 *
 * Vehicle compatibility is attached three ways for maximum search-engine coverage:
 *  1. `isRelatedTo` — array of Vehicle nodes (Google's recommended path for parts)
 *  2. `additionalProperty` — flat name/value pairs (always parsed by crawlers)
 *  3. Inline in `description` — guaranteed text indexing
 *
 * Pass `compatibilityText` for legacy free-text data, OR `fitments` for structured YMM,
 * or both (they will be merged).
 */
export function productWithFitmentSchema(opts: {
  name: string;
  sku: string;
  productUrl: string;
  category?: string;
  description?: string;
  images?: string[];
  price?: number;
  minOrder?: number;
  availability?: 'InStock' | 'PreOrder' | 'OutOfStock';
  oemNumber?: string;
  fitments?: VehicleFitment[];
  compatibilityText?: string;
}) {
  const vehicleNodes = (opts.fitments || [])
    .map(vehicleNode)
    .filter((n): n is Record<string, unknown> => n !== null);

  const fitmentNames = vehicleNodes
    .map((n) => n.name as string)
    .filter(Boolean);

  // Merge legacy free-text compatibility into the description
  const descParts = [
    opts.description ||
      `${opts.name} (SKU: ${opts.sku})${opts.category ? ' - ' + opts.category : ''}. OEM-quality wholesale auto parts. MOQ ${opts.minOrder || 50}pcs. Request for quote (RFQ) for bulk pricing.`,
  ];
  if (opts.compatibilityText) {
    descParts.push(`Vehicle compatibility: ${opts.compatibilityText}.`);
  }
  if (fitmentNames.length) {
    descParts.push(`Fits: ${fitmentNames.join('; ')}.`);
  }

  const additionalProperty: Record<string, unknown>[] = [];
  if (opts.oemNumber) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'OEM Number',
      value: opts.oemNumber,
    });
  }
  if (opts.compatibilityText) {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Vehicle Compatibility',
      value: opts.compatibilityText,
    });
  }
  fitmentNames.forEach((fname) => {
    additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Fits Vehicle',
      value: fname,
    });
  });

  const product: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    sku: opts.sku,
    mpn: opts.sku,
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.images && opts.images.length ? { image: opts.images } : {}),
    brand: { '@type': 'Brand', name: 'Vida Auto' },
    manufacturer: {
      '@type': 'Organization',
      name: 'Guangzhou Vida Auto Parts Co., Ltd.',
      url: SITE_URL,
    },
    description: descParts.join(' '),
    offers: wholesaleOfferSchema({
      productUrl: opts.productUrl,
      sku: opts.sku,
      availability: opts.availability,
      minOrder: opts.minOrder,
      price: opts.price,
    }),
  };

  if (vehicleNodes.length) {
    product.isRelatedTo = vehicleNodes;
  }
  if (additionalProperty.length) {
    product.additionalProperty = additionalProperty;
  }

  return product;
}
