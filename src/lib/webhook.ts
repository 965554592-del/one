/**
 * CRM Webhook – push inquiry form data to an external CRM endpoint.
 *
 * Configuration is read from Firestore siteSettings at runtime:
 *   - crmWebhookUrl      : POST endpoint (e.g. https://crm.example.com/api/leads)
 *   - crmWebhookHeaders  : JSON string of extra headers (e.g. {"X-API-Key":"abc123"})
 *   - crmWebhookEnabled  : boolean toggle
 *
 * The push is fire-and-forget — failures are logged but never block the
 * main form submission flow.
 */

export interface InquiryPayload {
  name: string;
  company: string;
  email: string;
  phone: string;
  vehicleModel: string;
  partNeed: string;
  quantity: string;
  message: string;
  source: string;
  createdAt: string;
}

/**
 * Parse the JSON header string stored in Firestore into a plain object.
 * Returns {} on any error.
 */
function parseHeaders(raw?: string): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return {};
}

/**
 * Push an inquiry payload to the configured CRM webhook.
 *
 * @param payload  The inquiry data
 * @param url      Webhook URL
 * @param headers  Raw JSON string of additional headers
 * @param retries  Number of retries on failure (default 2)
 */
export async function pushToCRM(
  payload: InquiryPayload,
  url: string,
  headers?: string,
  retries = 2,
): Promise<boolean> {
  if (!url) return false;

  const extraHeaders = parseHeaders(headers);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log('[CRM Webhook] Push succeeded', res.status);
        return true;
      }

      console.warn(`[CRM Webhook] HTTP ${res.status} (attempt ${attempt + 1})`);
    } catch (err) {
      console.warn(`[CRM Webhook] Network error (attempt ${attempt + 1})`, err);
    }

    // Exponential backoff: 1s, 2s
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  console.error('[CRM Webhook] All attempts failed for', url);
  return false;
}
