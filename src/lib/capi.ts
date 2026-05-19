/**
 * Facebook Conversions API (CAPI) — client-side helper.
 *
 * Sends server-side events through the backend proxy (/api/fb-capi)
 * to complement the browser-based Meta Pixel. This combats ad-blocker
 * and iOS ATT data loss (estimated 40-60% recovery).
 *
 * Deduplication: Uses a shared eventId between fbq (client) and CAPI (server)
 * so Facebook does not double-count.
 */

import { apiUrl } from './api';

/** Generate a unique event ID for deduplication. */
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Read the _fbp cookie (set by the Meta Pixel). */
function getFbp(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/);
  return match ? match[1] : undefined;
}

/** Read the _fbc cookie (click ID from ad URL param). */
function getFbc(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/);
  if (match) return match[1];
  // Fallback: build from fbclid URL param
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get('fbclid');
  if (fbclid) return `fb.1.${Date.now()}.${fbclid}`;
  return undefined;
}

export interface CapiEventParams {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  eventName: string;
  eventId?: string;
  userData?: {
    email?: string;
    phone?: string;
    fn?: string;       // first name
    ln?: string;       // last name
    country?: string;
    city?: string;
    external_id?: string;
  };
  customData?: Record<string, any>;
}

/**
 * Fire a server-side CAPI event via the backend proxy.
 * Fire-and-forget — never blocks UI.
 */
export async function sendCapiEvent(params: CapiEventParams): Promise<boolean> {
  try {
    const { pixelId, accessToken, testEventCode, eventName, eventId, userData, customData } = params;

    const payload = {
      pixelId,
      accessToken,
      testEventCode: testEventCode || undefined,
      eventName,
      eventTime: Math.floor(Date.now() / 1000),
      eventSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
      eventId,
      userData: {
        ...userData,
        client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        fbp: getFbp(),
        fbc: getFbc(),
      },
      customData,
    };

    const res = await fetch(`${apiUrl}/api/fb-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[CAPI] Server returned error:', err);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[CAPI] Network error:', err);
    return false;
  }
}

/**
 * Convenience: Send a Lead event via CAPI.
 * Call after form submission alongside fbq('track', 'Lead').
 */
export function sendCapiLead(
  pixelId: string,
  accessToken: string,
  userData: CapiEventParams['userData'],
  customData?: Record<string, any>,
  eventId?: string,
  testEventCode?: string,
): void {
  sendCapiEvent({
    pixelId,
    accessToken,
    testEventCode,
    eventName: 'Lead',
    eventId,
    userData,
    customData,
  }).catch(() => {});
}
