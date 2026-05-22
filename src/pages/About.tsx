import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import LazyVideo from '../components/LazyVideo';
import { useStore } from '../store/useStore';

export default function About() {
  const { t } = useTranslation();
  const { siteSettings } = useStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO
        title="About Vida Auto - Your Trusted Auto Parts Supplier"
        description="Learn about Vida Auto, an experienced wholesale auto parts supplier from China serving global B2B buyers with OEM-grade quality and reliable logistics."
        path="/about"
      />
      <h1 className="text-3xl font-bold text-[#E6F1FF] mb-8">{t('nav.about')}</h1>
      
      <div className="bg-[#112240] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
        <div className="aspect-w-16 aspect-h-9 bg-[#0A192F] relative border-b border-white/5 overflow-hidden min-h-[300px]">
          {siteSettings?.storyVideoUrl ? (
            <LazyVideo src={siteSettings.storyVideoUrl} poster={siteSettings?.storyBgUrl} className="w-full h-full object-cover object-center" lazy={false} preload="auto" />
          ) : siteSettings?.storyBgUrl ? (
            <img src={siteSettings.storyBgUrl} alt="About" className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
          ) : (
            <img src="https://picsum.photos/seed/nanabuana-corporate/1920/1080" alt="Corporate Video" className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
          )}
        </div>
        
        <div className="p-8 md:p-12">
          <h2 className="text-2xl font-bold text-[#E6F1FF] mb-4">{t('about.company_name')}</h2>
          <p className="text-[#8892B0] mb-6 leading-relaxed">
            {t('about.desc1')}
          </p>
          <p className="text-[#8892B0] leading-relaxed">
            {t('about.desc2')}
          </p>
        </div>
      </div>
    </div>
  );
}
