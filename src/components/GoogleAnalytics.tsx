import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGtag, gtagPageView, getGa4Id, setGa4IdOverride, setGadsConfig } from '../lib/gtag';
import { useStore } from '../store/useStore';

/**
 * Mounts Google Analytics 4 and fires page_view on every route change.
 * Also configures Google Ads conversion tracking if ID/Label are set.
 * Must be rendered INSIDE <BrowserRouter>.
 *
 * Configuration source: Firestore siteSettings via Admin Dashboard.
 */
export default function GoogleAnalytics() {
  const location = useLocation();
  const { siteSettings } = useStore();

  // Sync Firestore-stored GA4 ID + Google Ads config into runtime.
  useEffect(() => {
    if (siteSettings?.ga4MeasurementId) {
      setGa4IdOverride(siteSettings.ga4MeasurementId);
    }
    if (siteSettings?.gadsConversionId || siteSettings?.gadsConversionLabel) {
      setGadsConfig(siteSettings.gadsConversionId, siteSettings.gadsConversionLabel);
    }
  }, [siteSettings?.ga4MeasurementId, siteSettings?.gadsConversionId, siteSettings?.gadsConversionLabel]);

  useEffect(() => {
    if (!getGa4Id()) return;
    initGtag();
  }, []);

  useEffect(() => {
    if (!getGa4Id()) return;
    gtagPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
