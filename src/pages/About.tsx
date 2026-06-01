import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import LazyVideo from '../components/LazyVideo';
import { useStore, AboutSection } from '../store/useStore';

function SectionMedia({ section }: { section: AboutSection }) {
  if (section.videoUrl) {
    return (
      <LazyVideo
        src={section.videoUrl}
        poster={section.imageUrl}
        className="w-full h-full object-cover rounded-xl"
        lazy
        preload="metadata"
      />
    );
  }
  if (section.imageUrl) {
    return (
      <img
        src={section.imageUrl}
        alt={section.title || 'About'}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover rounded-xl"
        referrerPolicy="no-referrer"
      />
    );
  }
  return null;
}

function SectionText({ section }: { section: AboutSection }) {
  if (!section.title && !section.text) return null;
  return (
    <div className="flex flex-col justify-center">
      {section.title && <h3 className="text-2xl font-bold text-[#E6F1FF] mb-4">{section.title}</h3>}
      {section.text && (
        <div className="text-[#8892B0] leading-relaxed whitespace-pre-line">{section.text}</div>
      )}
    </div>
  );
}

function AboutSectionBlock({ section }: { section: AboutSection }) {
  const hasMedia = !!(section.imageUrl || section.videoUrl);
  const hasText = !!(section.title || section.text);

  // Single-content layouts
  if (section.layout === 'text-only' || !hasMedia) {
    return (
      <div className="bg-[#112240] rounded-2xl border border-white/5 p-8 md:p-12">
        <SectionText section={section} />
      </div>
    );
  }
  if (section.layout === 'image-only' || !hasText) {
    return (
      <div className="bg-[#112240] rounded-2xl border border-white/5 overflow-hidden">
        <div className="aspect-video bg-[#0A192F]">
          <SectionMedia section={section} />
        </div>
      </div>
    );
  }

  // Side-by-side (text-left-image-right, image-left-text-right)
  if (section.layout === 'text-left-image-right' || section.layout === 'image-left-text-right') {
    const imageFirst = section.layout === 'image-left-text-right';
    return (
      <div className="bg-[#112240] rounded-2xl border border-white/5 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {imageFirst ? (
            <>
              <div className="aspect-video md:aspect-auto md:min-h-[320px] bg-[#0A192F]">
                <SectionMedia section={section} />
              </div>
              <div className="p-8 md:p-10">
                <SectionText section={section} />
              </div>
            </>
          ) : (
            <>
              <div className="p-8 md:p-10 order-2 md:order-1">
                <SectionText section={section} />
              </div>
              <div className="aspect-video md:aspect-auto md:min-h-[320px] bg-[#0A192F] order-1 md:order-2">
                <SectionMedia section={section} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Stacked (image-top-text-bottom, text-top-image-bottom)
  const textFirst = section.layout === 'text-top-image-bottom';
  return (
    <div className="bg-[#112240] rounded-2xl border border-white/5 overflow-hidden">
      {textFirst ? (
        <>
          <div className="p-8 md:p-12">
            <SectionText section={section} />
          </div>
          <div className="aspect-video bg-[#0A192F] border-t border-white/5">
            <SectionMedia section={section} />
          </div>
        </>
      ) : (
        <>
          <div className="aspect-video bg-[#0A192F]">
            <SectionMedia section={section} />
          </div>
          <div className="p-8 md:p-12 border-t border-white/5">
            <SectionText section={section} />
          </div>
        </>
      )}
    </div>
  );
}

export default function About() {
  const { t } = useTranslation();
  const { siteSettings } = useStore();
  const sections = siteSettings?.aboutSections || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO
        title="About Vida Auto - Your Trusted Auto Parts Supplier"
        description="Learn about Vida Auto, an experienced wholesale auto parts supplier from China serving global B2B buyers with OEM-grade quality and reliable logistics."
        path="/about"
      />
      <h1 className="text-3xl font-bold text-[#E6F1FF] mb-8">{t('nav.about')}</h1>

      {/* Top hero (story video / image) — kept for backwards compatibility */}
      {(siteSettings?.storyVideoUrl || siteSettings?.storyBgUrl) && (
        <div className="bg-[#112240] rounded-2xl shadow-sm border border-white/5 overflow-hidden mb-8">
          <div className="aspect-video bg-[#0A192F] relative overflow-hidden">
            {siteSettings?.storyVideoUrl ? (
              <LazyVideo src={siteSettings.storyVideoUrl} poster={siteSettings?.storyBgUrl} className="w-full h-full object-cover object-center" preload="metadata" />
            ) : (
              <img src={siteSettings.storyBgUrl} alt="About" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            )}
          </div>
        </div>
      )}

      {/* Configurable sections from admin */}
      {sections.length > 0 ? (
        <div className="space-y-8">
          {sections.map(s => <AboutSectionBlock key={s.id} section={s} />)}
        </div>
      ) : (
        /* Fallback to legacy i18n description if no sections configured */
        <div className="bg-[#112240] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
          <div className="p-8 md:p-12">
            <h2 className="text-2xl font-bold text-[#E6F1FF] mb-4">{t('about.company_name')}</h2>
            <p className="text-[#8892B0] mb-6 leading-relaxed">{t('about.desc1')}</p>
            <p className="text-[#8892B0] leading-relaxed">{t('about.desc2')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
