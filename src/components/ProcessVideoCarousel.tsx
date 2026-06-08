import { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';

const defaultCertifications = [
  'BSCI Compliant Kids Wear Factory',
  'Certified Safety: OEKO-TEX Standard 100',
  'GOTS Certified Organic Production',
];

const defaultSlides = [
  { id: '1', type: 'image' as const, src: 'https://picsum.photos/seed/factory1/600/900', alt: 'Sewing process' },
  { id: '2', type: 'image' as const, src: 'https://picsum.photos/seed/factory2/600/900', alt: 'Cutting fabric' },
  { id: '3', type: 'image' as const, src: 'https://picsum.photos/seed/factory3/600/900', alt: 'Pattern printing' },
  { id: '4', type: 'video' as const, source: 'upload' as const, src: '/uploads/watermarked_preview.mp4', poster: 'https://picsum.photos/seed/factory4/600/900', alt: 'Assembly line' },
  { id: '5', type: 'video' as const, source: 'upload' as const, src: '', poster: 'https://picsum.photos/seed/factory5/600/900', alt: 'Quality check' },
  { id: '6', type: 'image' as const, src: 'https://picsum.photos/seed/factory6/600/900', alt: 'Packaging' },
];

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function ProcessVideoCarousel({ id }: { id?: string }) {
  const { siteSettings } = useStore();
  const certifications = siteSettings?.processCarouselCertifications && siteSettings.processCarouselCertifications.length > 0
    ? siteSettings.processCarouselCertifications
    : defaultCertifications;
  const slides = siteSettings?.processCarouselItems && siteSettings.processCarouselItems.length > 0
    ? siteSettings.processCarouselItems
    : defaultSlides;

  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const slideWidth = 340; // 300px card + 40px gap

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const brownBgOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);

  const scrollTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, slides.length - 1));
    setCurrent(clamped);
    if (containerRef.current) {
      containerRef.current.scrollTo({ left: clamped * slideWidth, behavior: 'smooth' });
    }
  };

  const prev = () => scrollTo(current - 1);
  const next = () => scrollTo(current + 1);

  return (
    <section ref={sectionRef} id={id} className="relative py-24 md:py-32 bg-cream overflow-hidden border-t border-stone-100">
      {/* Light brown scroll-driven overlay */}
      <motion.div
        style={{ opacity: brownBgOpacity }}
        className="absolute inset-0 bg-[#C8A882] z-0 pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-6 z-10">
        {/* Section header */}
        <div className="mb-10">
          <p className="text-brand text-xs font-semibold tracking-widest uppercase mb-2">Quality Assurance</p>
          <h2 className="text-2xl font-serif font-bold text-charcoal">Factory Showcase</h2>
        </div>

        {/* Certifications row */}
        <div className="flex flex-wrap gap-6 mb-10">
          {certifications.map((cert, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sage flex items-center justify-center text-brand font-bold text-xs">✓</div>
              <span className="text-sm font-semibold text-charcoal">{cert}</span>
            </div>
          ))}
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Left arrow */}
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/90 backdrop-blur-sm shadow-lg rounded-full flex items-center justify-center hover:bg-white transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={24} className="text-charcoal" />
          </button>

          {/* Right arrow */}
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white/90 backdrop-blur-sm shadow-lg rounded-full flex items-center justify-center hover:bg-white transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={24} className="text-charcoal" />
          </button>

          {/* Slides container */}
          <div
            ref={containerRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide px-16 scroll-smooth"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {slides.map((slide, idx) => (
              <motion.div
                key={idx}
                className="flex-shrink-0 w-[300px] rounded-2xl overflow-hidden shadow-md bg-stone-100"
                style={{ scrollSnapAlign: 'start' }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
              >
                {slide.type === 'video' && slide.src ? (
                  slide.source === 'youtube' ? (
                    (() => {
                      const videoId = extractYouTubeId(slide.src);
                      return videoId ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&rel=0&playsinline=1`}
                          title={slide.alt}
                          allow="autoplay; encrypted-media; fullscreen"
                          allowFullScreen
                          className="w-full h-[450px] object-cover border-0"
                        />
                      ) : (
                        <div className="w-full h-[450px] flex items-center justify-center bg-stone-200 text-stone-500 text-sm">Invalid YouTube URL</div>
                      );
                    })()
                  ) : (
                    <video
                      src={slide.src}
                      poster={slide.poster}
                      controls
                      className="w-full h-[450px] object-cover"
                    />
                  )
                ) : (
                  <img
                    src={slide.poster || slide.src}
                    alt={slide.alt}
                    className="w-full h-[450px] object-cover"
                  />
                )}
              </motion.div>
            ))}
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => scrollTo(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${idx === current ? 'bg-charcoal' : 'bg-stone-300 hover:bg-stone-400'}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
