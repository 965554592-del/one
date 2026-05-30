import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';

interface SiteSettings {
  logoUrl: string;
  statsBgUrl: string;
  heroVideoUrl?: string;
  heroBgUrl?: string;
  heroBgUrlMobile?: string;
  address?: string;
  phone?: string;
  email?: string;
  whatsappQrUrl?: string;
  whatsappLink?: string;
  statsVideoUrl?: string;
  statsOverlayText?: string;
  storyVideoUrl?: string;
  storyBgUrl?: string;
  factoryVideoUrl?: string;
  factoryBgUrl?: string;
  starProductId?: string;
  starProductTitle?: string;
  globeTitle?: string;
  globeSubtitle?: string;
  globeBottomTitle?: string;
  globeBottomSubtitle?: string;
  catalogUrl?: string;
  catalogTitle?: string;
  certificates?: { id: string; title: string; imageUrl: string }[];
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  heroStyles?: {
    headline?: string;
    subtitle?: string;
  };
  featuresLayout?: 'classic' | 'modern' | 'split';
  statsRegions?: string;
  statsSkus?: string;
  salesRegions?: { name: string; lat: number; lon: number }[];
  metaPixelId?: string;
  fbCapiAccessToken?: string;
  fbCapiTestCode?: string;
  workingHours?: string;
  workingHoursTz?: string;
  crmWebhookUrl?: string;
  crmWebhookHeaders?: string;
  crmWebhookEnabled?: boolean;
  discordWebhookUrl?: string;
  discordWebhookEnabled?: boolean;
  resendApiKey?: string;
  emailProvider?: 'resend' | 'smtp';
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  notifyEmails?: string;
  emailAutoReplyEnabled?: boolean;
  emailNotifyEnabled?: boolean;
  ga4MeasurementId?: string;
  gadsConversionId?: string;
  gadsConversionLabel?: string;
  brandLogos?: { imageUrl: string; categoryId: string; label: string }[];
  aboutSections?: AboutSection[];
  catalogs?: CatalogItem[];
  sourcingCategories?: SourcingGuideCategory[];
  sourcingFeatured?: SourcingGuideFeatured;
}

export interface CatalogItem {
  id: string;
  title: string;
  fileUrl: string;
}

export interface AboutSection {
  id: string;
  layout: 'text-left-image-right' | 'image-left-text-right' | 'image-top-text-bottom' | 'text-top-image-bottom' | 'text-only' | 'image-only';
  title?: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface SourcingGuideCategory {
  id: string;
  title: string;
  icon: string;
  desc: string;
  articleCount: number;
}

export interface SourcingGuideFeatured {
  title: string;
  description: string;
  readTime: string;
  comingSoon: boolean;
  slug?: string;
}

interface AppState {
  user: FirebaseUser | null;
  userRole: 'admin' | 'user' | null;
  isAuthReady: boolean;
  siteSettings: SiteSettings;
  setUser: (user: FirebaseUser | null) => void;
  setUserRole: (role: 'admin' | 'user' | null) => void;
  setAuthReady: (ready: boolean) => void;
  setSiteSettings: (settings: SiteSettings) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  userRole: null,
  isAuthReady: false,
  siteSettings: { 
    logoUrl: '', 
    statsBgUrl: '', 
    heroVideoUrl: '', 
    heroBgUrl: '',
    address: '中国广东省广州市',
    phone: '+86 123 4567 8901',
    email: 'info@vidaauto.com',
    whatsappQrUrl: '',
    whatsappLink: '',
    statsVideoUrl: '',
    storyVideoUrl: '',
    storyBgUrl: '',
    starProductId: '',
    starProductTitle: '',
    globeTitle: '',
    globeSubtitle: '',
    globeBottomTitle: '',
    globeBottomSubtitle: '',
    catalogUrl: '',
    catalogTitle: '',
    certificates: [],
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    featuresLayout: 'classic',
    statsRegions: '45+',
    statsSkus: '12.5k',
    ga4MeasurementId: '',
    gadsConversionId: '',
    gadsConversionLabel: '',
    salesRegions: [
      { name: '广州 (总部)', lat: 23.1291, lon: 113.2644 },
      { name: '迪拜', lat: 25.2048, lon: 55.2708 },
      { name: '法兰克福', lat: 50.1109, lon: 8.6821 },
      { name: '洛杉矶', lat: 34.0522, lon: -118.2437 },
      { name: '圣保罗', lat: -23.5505, lon: -46.6333 },
      { name: '约翰内斯堡', lat: -26.2041, lon: 28.0473 },
      { name: '悉尼', lat: -33.8688, lon: 151.2093 },
      { name: '莫斯科', lat: 55.7558, lon: 37.6173 },
      { name: '孟买', lat: 19.0760, lon: 72.8777 },
    ]
  },
  setUser: (user) => set({ user }),
  setUserRole: (role) => set({ userRole: role }),
  setAuthReady: (ready) => set({ isAuthReady: ready }),
  setSiteSettings: (settings) => set({ siteSettings: settings }),
}));
