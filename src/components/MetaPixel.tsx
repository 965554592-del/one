import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initPixel, trackPageView, getPixelId, setPixelIdOverride } from '../lib/pixel';
import { useStore } from '../store/useStore';

/**
 * Mounts the Meta Pixel and fires PageView on every route change.
 * Must be rendered INSIDE <BrowserRouter>.
 *
 * Pixel ID source priority:
 *  1. window.__META_PIXEL_ID__ (runtime JS override)
 *  2. Firestore siteSettings.metaPixelId (via Admin Dashboard)
 *  3. VITE_META_PIXEL_ID (build-time env var)
 */
export default function MetaPixel() {
  const location = useLocation();
  const { siteSettings } = useStore();

  // Sync Firestore-stored Pixel ID into the runtime override.
  useEffect(() => {
    if (siteSettings?.metaPixelId) {
      setPixelIdOverride(siteSettings.metaPixelId);
    }
  }, [siteSettings?.metaPixelId]);

  useEffect(() => {
    if (!getPixelId()) return;
    initPixel();
  }, []);

  useEffect(() => {
    if (!getPixelId()) return;
    trackPageView();
  }, [location.pathname, location.search]);

  return null;
}
