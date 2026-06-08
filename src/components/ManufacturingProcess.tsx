import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Palette, Shirt, Printer, Tag, Settings, Wrench, Shield, Award } from 'lucide-react';
import { useStore } from '../store/useStore';

const iconMap: Record<string, React.ComponentType<any>> = {
  Palette, Shirt, Printer, Tag, Settings, Wrench, Shield, Award,
};

const defaultSteps = [
  {
    id: '1',
    iconName: 'Palette',
    title: 'Step1: Strategic Market Alignment & Color Curation',
    subtitle: 'Harmonizing brand identity with target market seasonal palettes.',
    desc: 'We go beyond design by discussing specific color swatches and trend palettes to define your brand\'s visual story. By aligning your concept with global standards, we curate a cohesive collection that resonates with high-end consumers in your target market.',
    img: 'https://picsum.photos/seed/vida-step1/600/350',
  },
  {
    id: '2',
    iconName: 'Shirt',
    title: 'Step2: Fabric Engineering & Texture Calibration',
    subtitle: 'Defining the sensory experience through premium fiber selection.',
    desc: 'Our experts perform precise Yarn & GSM calibration to ensure the perfect weight and breathability for every season. We focus on fabric texture, using GOTS-certified organic materials to create a luxurious hand-feel.',
    img: 'https://picsum.photos/seed/vida-step2/600/350',
  },
  {
    id: '3',
    iconName: 'Printer',
    title: 'Step3: Print & Color ABC Strike-Off Testing',
    subtitle: 'Precision color matching to achieve 1:1 brand identity restoration.',
    desc: 'We perform rigorous ABC color and print strike-off tests, offering multiple physical swatches for you to select the closest match to your brand\'s theme. This proactive stage eliminates the risk of color deviation during mass production, ensuring your collection mirrors your brand\'s aesthetic DNA with 100% accuracy.',
    img: 'https://picsum.photos/seed/vida-step3/600/350',
  },
  {
    id: '4',
    iconName: 'Tag',
    title: 'Step4: Trim Sheets & Labeling Strategy',
    subtitle: 'Merging safety compliance with sophisticated brand identity.',
    desc: 'We develop comprehensive Trim Sheets, selecting nickel-free snaps and YKK zippers that meet strict safety compliance. Labeling Strategy integrates FSC-certified tags and custom woven labels to elevate brand recognition.',
    img: 'https://picsum.photos/seed/vida-step4/600/350',
  },
];

const defaultCerts = [
  'https://picsum.photos/seed/cert1/220/300',
  'https://picsum.photos/seed/cert2/220/300',
  'https://picsum.photos/seed/cert3/220/300',
];

export default function ManufacturingProcess({ id }: { id?: string }) {
  const { siteSettings } = useStore();
  const steps = siteSettings?.manufacturingSteps && siteSettings.manufacturingSteps.length > 0
    ? siteSettings.manufacturingSteps.map(s => ({ ...s, icon: iconMap[s.iconName || ''] || Palette }))
    : defaultSteps.map(s => ({ ...s, icon: iconMap[s.iconName] || Palette }));
  const certs = siteSettings?.manufacturingCerts && siteSettings.manufacturingCerts.length > 0
    ? siteSettings.manufacturingCerts
    : defaultCerts;

  const [activeStep, setActiveStep] = useState<number>(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const greenBgOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    stepRefs.current.forEach((el, idx) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveStep(idx);
          }
        },
        { threshold: 0.5, rootMargin: '-20% 0px -20% 0px' }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <section ref={containerRef} id={id} className="relative bg-white border-t border-stone-100">
      {/* Dark green scroll-driven overlay */}
      <motion.div
        style={{ opacity: greenBgOpacity }}
        className="absolute inset-0 bg-[#123d2b] z-0 pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 z-10">
        {/* Top eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-right text-charcoal font-medium mb-12"
        >
          How do we <span className="text-brand font-semibold">Accelerate</span> your brand success?
        </motion.p>

        <div className="grid lg:grid-cols-2 gap-16">
          {/* LEFT — sticky info */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-charcoal mb-4 leading-tight">
                Full-Service Custom<br />Manufacturing
              </h2>
              <p className="text-charcoal font-semibold mb-4">
                Our Strategic Roadmap: <span className="text-brand">11 Critical Stages</span> to Launching Your Premium Auto Parts Label
              </p>
              <p className="text-charcoal/60 leading-relaxed mb-6">
                From custom mold development to rapid prototyping, we offer a full-service manufacturing suite designed for conscious brands. Our <strong className="text-charcoal">ISO-audited facility</strong> combines 9 years of technical expertise with <strong className="text-charcoal">low-MOQ flexibility</strong>, helping you navigate global safety standards with ease. We don't just manufacture; we deliver market-ready, safe-for-road collections that meet the most stringent US and EU retail requirements.
              </p>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 px-6 py-3 bg-charcoal text-white text-sm font-semibold rounded-full hover:bg-brand transition-colors mb-10"
              >
                Contact us <ArrowRight size={16} />
              </Link>
            </motion.div>

            {/* Certificates */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
            >
              {certs.map((src, i) => (
                <div key={i} className="flex-shrink-0 rounded-xl overflow-hidden shadow-sm border border-stone-100 w-[140px] h-[190px]">
                  <img src={src} alt={`Certificate ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </motion.div>
          </div>

          {/* RIGHT — scroll-driven accordion step cards */}
          <div className="flex flex-col divide-y divide-stone-100">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isOpen = activeStep === idx;
              return (
                <div
                  key={step.id}
                  ref={(el) => { stepRefs.current[idx] = el; }}
                  className="bg-white rounded-2xl border border-stone-100 shadow-sm mb-3 overflow-hidden"
                >
                  <div className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-full border border-stone-200 flex items-center justify-center flex-shrink-0">
                      <Icon size={18} className="text-charcoal" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-charcoal">{step.title}</h3>
                      <p className="text-xs text-charcoal/60 mt-1">{step.subtitle}</p>
                    </div>
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 pl-20">
                      <p className="text-sm text-charcoal/70 leading-relaxed mb-4">
                        {step.desc}
                      </p>
                      <div className="rounded-xl overflow-hidden">
                        <img src={step.img} alt={step.title} className="w-full h-48 object-cover rounded-xl" />
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
