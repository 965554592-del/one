import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useStore } from '../store/useStore';

const defaultCards = [
  { id: '1', title: 'Headlight Lens', desc: 'High-definition vision', img: 'https://picsum.photos/seed/vida-headlight/300/200' },
  { id: '2', title: 'LED Bulbs', desc: 'Energy-saving & bright', img: 'https://picsum.photos/seed/vida-led/300/200' },
  { id: '3', title: 'Brake Pads', desc: 'Safe braking', img: 'https://picsum.photos/seed/vida-brake/300/200' },
  { id: '4', title: 'Mirror System', desc: 'Wide-angle view', img: 'https://picsum.photos/seed/vida-mirror/300/200' },
];

const AboutAccordion = ({ id }: { id?: string }) => {
  const { siteSettings } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const topLeftX = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const topLeftY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const topLeftScale = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const topLeftRotate = useTransform(scrollYProgress, [0, 1], [0, -12]);

  const topRightX = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const topRightY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const topRightScale = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const topRightRotate = useTransform(scrollYProgress, [0, 1], [0, 12]);

  const bottomLeftX = useTransform(scrollYProgress, [0, 1], [0, -180]);
  const bottomLeftY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const bottomLeftScale = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const bottomLeftRotate = useTransform(scrollYProgress, [0, 1], [0, -8]);

  const bottomRightX = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const bottomRightY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const bottomRightScale = useTransform(scrollYProgress, [0, 1], [1, 0.85]);
  const bottomRightRotate = useTransform(scrollYProgress, [0, 1], [0, 8]);

  const textOpacity = useTransform(scrollYProgress, (v) => {
    if (v < 0.2) return 0;
    if (v > 0.6) return 1;
    return (v - 0.2) / 0.4;
  });
  const textY = useTransform(scrollYProgress, (v) => {
    if (v < 0.2) return 40;
    if (v > 0.6) return 0;
    return 40 - (v - 0.2) / 0.4 * 40;
  });

  // Soft terracotta background overlay: full-range transition no buffer
  const orangeBgOpacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const cards = siteSettings?.aboutAccordionCards && siteSettings.aboutAccordionCards.length > 0
    ? siteSettings.aboutAccordionCards
    : defaultCards;

  const transforms = [
    { x: topLeftX, y: topLeftY, scale: topLeftScale, rotate: topLeftRotate },
    { x: topRightX, y: topRightY, scale: topRightScale, rotate: topRightRotate },
    { x: bottomLeftX, y: bottomLeftY, scale: bottomLeftScale, rotate: bottomLeftRotate },
    { x: bottomRightX, y: bottomRightY, scale: bottomRightScale, rotate: bottomRightRotate },
  ];

  return (
    <section ref={containerRef} id={id} style={{ height: '200vh' }} className="relative py-20 md:py-28">
      <div className="sticky top-0 h-screen flex items-center justify-center bg-cream overflow-hidden">
        {/* Orange scroll-driven overlay */}
        <motion.div
          style={{ opacity: orangeBgOpacity }}
          className="absolute inset-0 bg-[#D4A574] z-0"
        />

        <div className="relative w-full max-w-5xl mx-auto grid grid-cols-2 gap-6 p-6 z-10">
          {cards.map((card, idx) => (
            <motion.div
              key={card.id}
              style={{
                x: transforms[idx].x,
                y: transforms[idx].y,
                scale: transforms[idx].scale,
                rotate: transforms[idx].rotate,
              }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden"
            >
              <img src={card.img} alt={card.title} className="w-full h-48 object-cover" />
              <div className="p-4 text-center">
                <h3 className="text-xl font-bold text-charcoal">{card.title}</h3>
                <p className="text-charcoal/60 text-sm mt-1">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
          <motion.div
            style={{ opacity: textOpacity, y: textY }}
            className="text-center max-w-md"
          >
            <h2 className="text-3xl font-bold text-charcoal mb-4">9 Years of Excellence</h2>
            <p className="text-charcoal/70 mb-6">
              Vida Auto is your trusted partner in OEM & aftermarket auto parts.
              With a robust R&D team and integrated manufacturing facility, we provide seamless OEM/ODM services ensuring compliance with international standards.
            </p>
            <a href="/about" className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded-full hover:bg-brand-dark transition-colors font-semibold text-sm">
              About Us <span>→</span>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutAccordion;
