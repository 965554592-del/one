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
      {section.title && <h3 className="text-2xl font-bold text-charcoal mb-4">{section.title}</h3>}
      {section.text && (
        <div className="text-charcoal/60 leading-relaxed whitespace-pre-line">{section.text}</div>
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
      <div className="bg-white rounded-2xl border border-stone-100 p-8 md:p-12">
        <SectionText section={section} />
      </div>
    );
  }
  if (section.layout === 'image-only' || !hasText) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="aspect-video bg-cream">
          <SectionMedia section={section} />
        </div>
      </div>
    );
  }

  // Side-by-side (text-left-image-right, image-left-text-right)
  if (section.layout === 'text-left-image-right' || section.layout === 'image-left-text-right') {
    const imageFirst = section.layout === 'image-left-text-right';
    return (
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {imageFirst ? (
            <>
              <div className="aspect-video md:aspect-auto md:min-h-[320px] bg-cream">
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
              <div className="aspect-video md:aspect-auto md:min-h-[320px] bg-cream order-1 md:order-2">
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
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      {textFirst ? (
        <>
          <div className="p-8 md:p-12">
            <SectionText section={section} />
          </div>
          <div className="aspect-video bg-cream border-t border-stone-100">
            <SectionMedia section={section} />
          </div>
        </>
      ) : (
        <>
          <div className="aspect-video bg-cream">
            <SectionMedia section={section} />
          </div>
          <div className="p-8 md:p-12 border-t border-stone-100">
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
    <div>
      {/* Hero Banner */}
      <div className="relative w-full h-[360px] md:h-[460px] overflow-hidden">
        <img
          src={siteSettings?.storyBgUrl || "https://picsum.photos/seed/vida-about-hero/1920/700"}
          alt="About Us"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t('nav.about', 'About Us')}</h1>
          <p className="text-white/80 max-w-2xl text-sm md:text-base">{t('about.hero_desc', 'Your trusted partner in OEM & aftermarket auto parts manufacturing.')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <SEO
          title="About Vida Auto - Your Trusted Auto Parts Supplier"
          description="Learn about Vida Auto, an experienced wholesale auto parts supplier from China serving global B2B buyers with OEM-grade quality and reliable logistics."
          path="/about"
        />

      {/* Configurable sections from admin */}
      {sections.length > 0 ? (
        <div className="space-y-8">
          {sections.map(s => <AboutSectionBlock key={s.id} section={s} />)}
        </div>
      ) : (
        /* Fallback to legacy i18n description if no sections configured */
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          <div className="p-8 md:p-12">
            <h2 className="text-2xl font-bold text-charcoal mb-4">{t('about.company_name')}</h2>
            <p className="text-charcoal/60 mb-6 leading-relaxed">{t('about.desc1')}</p>
            <p className="text-charcoal/60 leading-relaxed">{t('about.desc2')}</p>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
