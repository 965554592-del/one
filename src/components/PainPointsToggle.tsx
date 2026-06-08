import { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, BadgeCheck, ThumbsDown, Gem, Ban, Boxes,
  Frown, ClipboardCheck, XCircle, Truck, Layers, Headphones
} from 'lucide-react';
import { useStore } from '../store/useStore';

const iconMap: Record<string, React.ComponentType<any>> = {
  ShieldAlert, BadgeCheck, ThumbsDown, Gem, Ban, Boxes,
  Frown, ClipboardCheck, XCircle, Truck, Layers, Headphones,
};

const defaultPainPoints = [
  { id: '1', iconName: 'ShieldAlert', title: 'Safety', desc: 'Quality control fragmentation and safety hazards. Risks of metal fragments or harmful chemical residues lead to costly recalls.' },
  { id: '2', iconName: 'ThumbsDown', title: 'Quality', desc: 'Uneven stitching, fitting deformation. Manual machines cause uneven tension, loose thread ends and "itchy" seams that frustrate end users.' },
  { id: '3', iconName: 'Ban', title: 'MOQ', desc: 'Strict high minimum orders. Forced to order 500–1,000+ pcs, straining cash flow and risking unsold inventory.' },
  { id: '4', iconName: 'Frown', title: 'Sampling', desc: 'Slow and inaccurate sampling. Due to poor design comprehension, you go back and forth for 3–4 weeks, missing critical market windows.' },
  { id: '5', iconName: 'Layers', title: 'Materials', desc: 'Mystery blends and yarn substitutions. Using cheap acrylic blended yarns or "original yarn" that feels coarse and lacks proper fiber certification.' },
  { id: '6', iconName: 'Headphones', title: 'Support', desc: '"Communication black holes." Language barriers and slow email replies leave you guessing about your production status.' },
];

const defaultSolutions = [
  { id: '1', iconName: 'BadgeCheck', title: 'Safety', desc: '100% needle detection and Class-A safety. All garments pass automatic needle inspection and meet GOTS / OEKO-TEX infant skin standards.' },
  { id: '2', iconName: 'Gem', title: 'Quality', desc: 'Precision Shima Seiki technology. Even stitch density, zero pilling, hand-linked seams that retain shape after 100+ washes.' },
  { id: '3', iconName: 'Boxes', title: 'MOQ', desc: 'Growth-friendly low minimums. Start at 300 pcs per style. We support your brand expansion without dead-stock burden.' },
  { id: '4', iconName: 'ClipboardCheck', title: 'Sampling', desc: 'Fast 7–14 day prototype turnaround. Our tech pack specialists convert your flat sketches into physical samples within one week.' },
  { id: '5', iconName: 'Truck', title: 'Materials', desc: 'Certified sustainable yarns. Organic cotton, Merino wool and recycled fibers with fully traceable, transparent sourcing.' },
  { id: '6', iconName: 'Headphones', title: 'Support', desc: 'Proactive communication. English-speaking account managers available around the clock who understand your tech packs and business goals.' },
];

export default function PainPointsToggle({ id }: { id?: string }) {
  const { siteSettings } = useStore();
  const painPoints = siteSettings?.painPoints && siteSettings.painPoints.length > 0
    ? siteSettings.painPoints.map(p => ({ ...p, icon: iconMap[p.iconName || ''] || ShieldAlert }))
    : defaultPainPoints.map(p => ({ ...p, icon: iconMap[p.iconName] || ShieldAlert }));
  const solutions = siteSettings?.solutions && siteSettings.solutions.length > 0
    ? siteSettings.solutions.map(s => ({ ...s, icon: iconMap[s.iconName || ''] || BadgeCheck }))
    : defaultSolutions.map(s => ({ ...s, icon: iconMap[s.iconName] || BadgeCheck }));

  const [isOn, setIsOn] = useState(false);
  const cards = isOn ? solutions : painPoints;
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const greenBgOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 1]);

  return (
    <section ref={sectionRef} id={id} className="relative py-24 md:py-32 bg-white border-t border-stone-100">
      {/* Light green scroll-driven overlay */}
      <motion.div
        style={{ opacity: greenBgOpacity }}
        className="absolute inset-0 bg-[#1f6b4a] z-0 pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-6 z-10">
        {/* Header row */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12 gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-charcoal mb-2">
              When you{' '}
              <span className="inline-flex items-center align-middle mx-2">
                <button
                  onClick={() => setIsOn(!isOn)}
                  className={`relative w-16 h-9 rounded-full transition-colors duration-300 focus:outline-none ${isOn ? 'bg-brand' : 'bg-stone-300'}`}
                  aria-label="Toggle partner mode"
                >
                  <motion.div
                    className="absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow-md"
                    animate={{ x: isOn ? 28 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </span>{' '}
              partner with us.
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <p className="text-sm text-charcoal/60 max-w-xs">
              Don't let bad suppliers ruin your next season. Chat with our experts.
            </p>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 px-6 py-3 bg-charcoal text-white text-sm font-semibold rounded-full hover:bg-brand transition-colors shrink-0"
            >
              Get Latest Catalog
            </Link>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {cards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={`${isOn ? 'sol' : 'pain'}-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className={`rounded-2xl p-6 transition-colors duration-300 ${isOn ? 'bg-white border border-stone-100' : 'bg-white/60 border border-stone-100/50'}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors duration-300 ${isOn ? 'bg-sage text-brand' : 'bg-red-50 text-red-500'}`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-charcoal mb-2">{card.title}</h3>
                  <p className="text-sm text-charcoal/60 leading-relaxed">{card.desc}</p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
