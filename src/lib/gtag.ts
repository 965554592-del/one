// Google Analytics 4 (GA4) + Google Ads conversion tracking helper.
// GA4 Measurement ID and Google Ads Conversion ID/Label are injected
// from Firestore siteSettings at runtime via the Admin Dashboard.

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
    __GA4_ID__?: string;
    __GADS_CONVERSION_ID__?: string;
    __GADS_CONVERSION_LABEL__?: string;
  }
}

let initialized = false;
let currentGa4Id: string | undefined;

export function getGa4Id(): string | undefined {
  if (typeof window !== 'undefined' && window.__GA4_ID__) {
    return window.__GA4_ID__;
  }
  return undefined;
}

/** Allow runtime override (called from components that have access to siteSettings). */
export function setGa4IdOverride(id: string | undefined) {
  if (typeof window !== 'undefined' && id) {
    window.__GA4_ID__ = id;
    if (!initialized) initGtag(id);
  }
}

export function setGadsConfig(conversionId?: string, conversionLabel?: string) {
  if (typeof window !== 'undefined') {
    if (conversionId) window.__GADS_CONVERSION_ID__ = conversionId;
    if (conversionLabel) window.__GADS_CONVERSION_LABEL__ = conversionLabel;
  }
}

/**
 * Inject the gtag.js script and initialize GA4 + optional Google Ads.
 * Safe to call multiple times (idempotent).
 */
export function initGtag(ga4Id?: string) {
  if (typeof window === 'undefined') return;
  // Skip during Puppeteer prerender
  if (typeof navigator !== 'undefined' && (navigator as any).webdriver) return;
  const id = ga4Id || getGa4Id();
  if (!id) return;
  if (initialized && currentGa4Id === id) return;

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());

  // Inject gtag.js script if not already present
  if (!document.querySelector(`script[src*="googletagmanager.com/gtag"]`)) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script);
  }

  // Configure GA4
  window.gtag('config', id, {
    send_page_view: false, // We manually track page views on route change
  });

  // Configure Google Ads if set
  const gadsId = window.__GADS_CONVERSION_ID__;
  if (gadsId) {
    window.gtag('config', gadsId);
  }

  initialized = true;
  currentGa4Id = id;
}

/** Track a page view (called on route change). */
export function gtagPageView(path?: string) {
  if (typeof window === 'undefined' || !initialized) return;
  window.gtag('event', 'page_view', {
    page_path: path || window.location.pathname + window.location.search,
  });
}

/** Track a custom event. */
export function gtagEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined' || !initialized) return;
  window.gtag('event', eventName, params || {});
}

/**
 * Track a Lead/inquiry conversion event for both GA4 and Google Ads.
 */
export function gtagTrackLead(params?: Record<string, any>) {
  if (typeof window === 'undefined' || !initialized) return;

  // GA4 custom event
  window.gtag('event', 'generate_lead', {
    event_category: 'inquiry',
    event_label: params?.content_name || 'Home Inquiry Form',
    value: 1,
    ...params,
  });

  // Google Ads conversion (if configured)
  const gadsId = window.__GADS_CONVERSION_ID__;
  const gadsLabel = window.__GADS_CONVERSION_LABEL__;
  if (gadsId && gadsLabel) {
    window.gtag('event', 'conversion', {
      send_to: `${gadsId}/${gadsLabel}`,
      value: 1.0,
      currency: 'USD',
      ...params,
    });
  }
}
