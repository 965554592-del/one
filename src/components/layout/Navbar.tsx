import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Globe, Menu, X, User as UserIcon, ArrowRight, Headphones, Package, BookOpen, Users, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { loadLanguage } from '../../i18n';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'ru', name: 'Русский' },
  { code: 'es', name: 'Español' },
];

const navPreviews = [
  {
    label: 'nav.products',
    href: '/products',
    icon: Package,
    items: [
      { title: 'OEM Auto Parts', desc: 'OEM & Aftermarket Solutions' },
      { title: 'Mirror & Lens', desc: 'Headlight, Taillight, Mirror' },
      { title: 'Body Parts', desc: 'Bumper, Fender, Hood, Door' },
    ],
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=400&auto=format&fit=crop',
  },
  {
    label: 'nav.factory',
    href: '/factory',
    icon: Users,
    items: [
      { title: 'BSCI Certified', desc: 'Ethical manufacturing standards' },
      { title: '45+ Countries', desc: 'Global export network' },
      { title: '12.5k+ SKUs', desc: 'Comprehensive catalog coverage' },
    ],
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=400&auto=format&fit=crop',
  },
  {
    label: 'nav.resources',
    href: '/sourcing-guides',
    icon: BookOpen,
    items: [
      { title: 'Sourcing Guides', desc: 'How to import from China' },
      { title: 'Shipping Info', desc: 'Global logistics & Incoterms' },
      { title: 'Quality Standards', desc: 'ISO 9001 & CE Certification' },
    ],
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=400&auto=format&fit=crop',
  },
  {
    label: 'nav.about',
    href: '/about',
    icon: Users,
    items: [
      { title: '9+ Years Experience', desc: 'Auto parts manufacturing' },
      { title: 'OEM/ODM Ready', desc: 'Custom branding & packaging' },
      { title: '24h Response', desc: 'Professional inquiry support' },
    ],
    image: 'https://images.unsplash.com/photo-1604465006757-719d550b54bd?q=80&w=400&auto=format&fit=crop',
  },
];

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, userRole, siteSettings } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const changeLanguage = async (lng: string) => {
    await loadLanguage(lng);
    i18n.changeLanguage(lng);
    setIsLangOpen(false);
  };

  const handleWhatsAppClick = () => {
    const message = t('common.whatsapp_message', 'Hello, I am interested in your auto parts. Please send me more information.');
    const encodedMessage = encodeURIComponent(message);
    if (siteSettings?.whatsappLink) {
      const link = siteSettings.whatsappLink.includes('?')
        ? `${siteSettings.whatsappLink}&text=${encodedMessage}`
        : `${siteSettings.whatsappLink}?text=${encodedMessage}`;
      window.open(link, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className={`text-2xl font-serif font-bold tracking-tight drop-shadow-md transition-colors ${scrolled ? 'text-brand' : 'text-white'}`}>
          {siteSettings?.logoUrl ? (
            <img src={siteSettings.logoUrl} alt="VIDA AUTO Logo" width="240" height="64" decoding="async" className="h-14 w-auto object-contain" />
          ) : (
            'VIDA AUTO'
          )}
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <NavLink
            to="/"
            className={({ isActive }) => `px-4 py-2 text-sm font-medium rounded-full transition-colors ${
              isActive
                ? 'bg-brand text-white'
                : scrolled ? 'text-charcoal/80 hover:text-charcoal hover:bg-stone-100' : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
          >
            {t('nav.home')}
          </NavLink>

          {navPreviews.map((l, i) => (
            <div
              key={l.label}
              className="relative"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <NavLink
                to={l.href}
                className={({ isActive }) => `px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : scrolled ? 'text-charcoal/80 hover:text-charcoal hover:bg-stone-100' : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                {t(l.label, l.label)}
              </NavLink>

              {hoveredIdx === i && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3">
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-5 w-80 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-4 mb-4">
                      <img src={l.image} alt={t(l.label)} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                      <div>
                        <h4 className="font-bold text-white text-base mb-1">{t(l.label)}</h4>
                        <p className="text-xs text-white/70">{t('common.click_to_explore', 'Click to explore')}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {l.items.map((item, j) => (
                        <Link
                          key={j}
                          to={l.href}
                          className="flex items-start gap-3 group p-2 -mx-2 rounded-xl hover:bg-white/10 transition-colors"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-white mt-2 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-white group-hover:text-white/80 transition-colors">{item.title}</p>
                            <p className="text-xs text-white/60">{item.desc}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <Link to={l.href} className="mt-4 flex items-center justify-center gap-1 text-xs font-semibold text-white hover:text-white/80">
                      {t('common.view_all', 'View All')} <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}

          <NavLink
            to="/blog"
            className={({ isActive }) => `px-4 py-2 text-sm font-medium rounded-full transition-colors ${
              isActive
                ? 'bg-brand text-white'
                : scrolled ? 'text-charcoal/80 hover:text-charcoal hover:bg-stone-100' : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
          >
            {t('nav.blog', 'Blog')}
          </NavLink>

          {/* Language toggle */}
          <div className="relative ml-3">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors ${
                scrolled ? 'border-charcoal/30 text-charcoal hover:bg-stone-100' : 'border-white/40 text-white hover:bg-white/10'
              }`}
            >
              {i18n.language.toUpperCase()}
            </button>
            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 py-1 z-50">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-stone-50 transition-colors ${
                      i18n.language === lang.code ? 'text-brand font-semibold' : 'text-charcoal'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <button onClick={handleWhatsAppClick} className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-full hover:bg-brand-light transition-colors shadow-sm ml-2">
            {t('nav.cta', "Let's Talk Business")} <ArrowRight size={16} />
          </button>

          {/* User */}
          {user ? (
            <div className="flex items-center gap-1 ml-2">
              {userRole === 'admin' && (
                <NavLink to="/admin" className={({ isActive }) => `px-3 py-2 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-brand text-white' : scrolled ? 'text-charcoal/80 hover:bg-stone-100' : 'text-white/90 hover:bg-white/10'}`}>
                  {t('nav.admin')}
                </NavLink>
              )}
              <NavLink to="/user" className={({ isActive }) => `flex items-center p-2 rounded-full transition-colors ${isActive ? 'bg-brand text-white' : scrolled ? 'text-charcoal/80 hover:bg-stone-100' : 'text-white/90 hover:bg-white/10'}`}>
                <UserIcon className="w-5 h-5" />
              </NavLink>
            </div>
          ) : (
            <Link to="/user" className={`ml-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${scrolled ? 'bg-charcoal text-white hover:bg-brand' : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}`}>
              {t('nav.login')}
            </Link>
          )}
        </div>

        <button className={`md:hidden ${scrolled ? 'text-charcoal' : 'text-white'}`} onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur border-t border-stone-200 px-6 py-4 flex flex-col gap-4">
          <NavLink to="/" onClick={() => setIsMenuOpen(false)} className="text-charcoal/70 font-medium">{t('nav.home')}</NavLink>
          <NavLink to="/products" onClick={() => setIsMenuOpen(false)} className="text-charcoal/70 font-medium">{t('nav.products')}</NavLink>
          <NavLink to="/factory" onClick={() => setIsMenuOpen(false)} className="text-charcoal/70 font-medium">{t('nav.factory', 'Factory')}</NavLink>
          <NavLink to="/blog" onClick={() => setIsMenuOpen(false)} className="text-charcoal/70 font-medium">{t('nav.blog', 'Blog')}</NavLink>
          <NavLink to="/sourcing-guides" onClick={() => setIsMenuOpen(false)} className="text-charcoal/70 font-medium">{t('nav.resources', 'Resources')}</NavLink>
          <NavLink to="/about" onClick={() => setIsMenuOpen(false)} className="text-charcoal/70 font-medium">{t('nav.about')}</NavLink>
          <button onClick={() => { setIsMenuOpen(false); handleWhatsAppClick(); }} className="px-5 py-2.5 bg-brand text-white text-center font-semibold rounded-full text-sm shadow-sm">
            {t('nav.cta', "Let's Talk Business")} <ArrowRight size={16} className="inline ml-1" />
          </button>
          <div className="border-t border-stone-200 pt-4 flex flex-col gap-3">
            <select
              className="bg-transparent text-charcoal border border-stone-200 rounded-lg px-3 py-2 focus:ring-0"
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value)}
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
            {user ? (
              <>
                {userRole === 'admin' && (
                  <NavLink to="/admin" onClick={() => setIsMenuOpen(false)} className="text-charcoal/70 font-medium">{t('nav.admin')}</NavLink>
                )}
                <NavLink to="/user" onClick={() => setIsMenuOpen(false)} className="text-charcoal/70 font-medium">{t('nav.profile')}</NavLink>
              </>
            ) : (
              <Link to="/user" onClick={() => setIsMenuOpen(false)} className="px-5 py-2.5 bg-brand text-white text-center font-medium rounded-full">{t('nav.login')}</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
