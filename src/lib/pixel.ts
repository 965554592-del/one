// Meta (Facebook) Pixel helper.
// Pixel ID is injected at build time via VITE_META_PIXEL_ID, but can also be
// overridden at runtime by setting window.__META_PIXEL_ID__ before app boots
// (useful for staging/testing without rebuilding).

declare global {
  interface Window {
    fbq?: ((...args: any[]) => void) & { callMethod?: any; queue?: any[]; loaded?: boolean; version?: string; push?: any };
    _fbq?: any;
    __META_PIXEL_ID__?: string;
  }
}

let initialized = false;
let currentPixelId: string | undefined;

export function getPixelId(): string | undefined {
  if (typeof window !== 'undefined' && window.__META_PIXEL_ID__) {
    return window.__META_PIXEL_ID__;
  }
  return import.meta.env.VITE_META_PIXEL_ID as string | undefined;
}

/** Allow runtime override (called from components that have access to siteSettings). */
export function setPixelIdOverride(id: string | undefined) {
  if (typeof window !== 'undefined' && id) {
    window.__META_PIXEL_ID__ = id;
    if (!initialized) initPixel(id);
  }
}

/**
 * Inject the Meta Pixel base script (idempotent) and call fbq('init', PIXEL_ID).
 * Safe to call multiple times.
 */
export function initPixel(pixelId?: string) {
  if (typeof window === 'undefined') return;
  // Skip during Puppeteer prerender to avoid inflating stats / loading 3rd-party scripts into static HTML.
  if (typeof navigator !== 'undefined' && (navigator as any).webdriver) return;
  const id = pixelId || getPixelId();
  if (!id) return;
  if (initialized && currentPixelId === id) return;

  // Inject base code if not already present.
  if (!window.fbq) {
    /* eslint-disable */
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
  }

  window.fbq?.('init', id);
  initialized = true;
  currentPixelId = id;
}

export function trackPageView() {
  if (typeof window === 'undefined') return;
  if (!initialized) initPixel();
  window.fbq?.('track', 'PageView');
}

export function trackEvent(event: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  if (!initialized) initPixel();
  const eventID = params?.eventID;
  const cleanParams = params ? { ...params } : undefined;
  if (cleanParams) delete cleanParams.eventID;

  if (eventID) {
    window.fbq?.('track', event, cleanParams || {}, { eventID });
  } else if (cleanParams) {
    window.fbq?.('track', event, cleanParams);
  } else {
    window.fbq?.('track', event);
  }
}

export function trackLead(params?: Record<string, any>) {
  trackEvent('Lead', params);
}
