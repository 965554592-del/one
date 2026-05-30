import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Globe, Menu, X, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
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

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, userRole, siteSettings } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const changeLanguage = async (lng: string) => {
    await loadLanguage(lng);
    i18n.changeLanguage(lng);
    setIsLangOpen(false);
  };

  return (
    <nav className="bg-[#0A192F]/90 backdrop-blur-sm text-white sticky top-0 z-50 border-b border-[#FFB300]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 font-bold text-2xl tracking-tight text-[#FFB300] flex items-center">
              {siteSettings?.logoUrl ? (
                <img src={siteSettings.logoUrl} alt="VIDA AUTO Logo" width="240" height="64" decoding="async" className="h-16 w-auto object-contain brightness-125" />
              ) : (
                "VIDA AUTO"
              )}
            </Link>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <NavLink to="/" className={({ isActive }) => `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-[#FFB300] border border-[#FFB300]/30 bg-[#FFB300]/5' : 'text-white hover:text-[#FFB300] hover:bg-[#112240]'}`}>{t('nav.home')}</NavLink>
                <NavLink to="/products" className={({ isActive }) => `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-[#FFB300] border border-[#FFB300]/30 bg-[#FFB300]/5' : 'text-white hover:text-[#FFB300] hover:bg-[#112240]'}`}>{t('nav.products')}</NavLink>
                <NavLink to="/factory" className={({ isActive }) => `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-[#FFB300] border border-[#FFB300]/30 bg-[#FFB300]/5' : 'text-white hover:text-[#FFB300] hover:bg-[#112240]'}`}>{t('nav.factory', 'Factory')}</NavLink>
                <NavLink to="/blog" className={({ isActive }) => `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-[#FFB300] border border-[#FFB300]/30 bg-[#FFB300]/5' : 'text-white hover:text-[#FFB300] hover:bg-[#112240]'}`}>{t('nav.blog', 'Blog')}</NavLink>
                <NavLink to="/sourcing-guides" className={({ isActive }) => `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-[#FFB300] border border-[#FFB300]/30 bg-[#FFB300]/5' : 'text-white hover:text-[#FFB300] hover:bg-[#112240]'}`}>{t('nav.resources', 'Resources')}</NavLink>
                <NavLink to="/about" className={({ isActive }) => `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-[#FFB300] border border-[#FFB300]/30 bg-[#FFB300]/5' : 'text-white hover:text-[#FFB300] hover:bg-[#112240]'}`}>{t('nav.about')}</NavLink>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <div className="relative">
              <button 
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center space-x-1 hover:text-[#FFB300] transition-colors"
              >
                <Globe className="w-5 h-5" />
                <span className="uppercase text-sm font-medium">{i18n.language}</span>
              </button>
              {isLangOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#112240] rounded-md shadow-lg py-1 text-[#E6F1FF] ring-1 ring-black ring-opacity-5 border border-[#FFB300]/20">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-[#0A192F] hover:text-[#FFB300]"
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {user ? (
              <div className="flex items-center space-x-4">
                {userRole === 'admin' && (
                  <NavLink to="/admin" className={({ isActive }) => `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-[#FFB300] border border-[#FFB300]/30 bg-[#FFB300]/5' : 'text-white hover:text-[#FFB300] hover:bg-[#112240]'}`}>
                    {t('nav.admin')}
                  </NavLink>
                )}
                <NavLink to="/user" className={({ isActive }) => `flex items-center p-2 rounded-md transition-colors ${isActive ? 'text-[#FFB300] border border-[#FFB300]/30 bg-[#FFB300]/5' : 'text-white hover:text-[#FFB300] hover:bg-[#112240]'}`}>
                  <UserIcon className="w-5 h-5" />
                </NavLink>
              </div>
            ) : (
              <Link to="/user" className="bg-[#FFB300] hover:bg-[#FFCA28] text-[#0A192F] px-4 py-2 rounded-md text-sm font-bold transition-colors">
                {t('nav.login')}
              </Link>
            )}
          </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-[#112240] focus:outline-none"
            >
              {isMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[#112240] border-b border-[#FFB300]/20">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <NavLink to="/" className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive ? 'bg-[#FFB300]/10 text-[#FFB300]' : 'text-white hover:bg-[#0A192F]'}`}>{t('nav.home')}</NavLink>
            <NavLink to="/products" className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive ? 'bg-[#FFB300]/10 text-[#FFB300]' : 'text-white hover:bg-[#0A192F]'}`}>{t('nav.products')}</NavLink>
            <NavLink to="/factory" className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive ? 'bg-[#FFB300]/10 text-[#FFB300]' : 'text-white hover:bg-[#0A192F]'}`}>{t('nav.factory', 'Factory')}</NavLink>
            <NavLink to="/blog" className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive ? 'bg-[#FFB300]/10 text-[#FFB300]' : 'text-white hover:bg-[#0A192F]'}`}>{t('nav.blog', 'Blog')}</NavLink>
            <NavLink to="/sourcing-guides" className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive ? 'bg-[#FFB300]/10 text-[#FFB300]' : 'text-white hover:bg-[#0A192F]'}`}>{t('nav.resources', 'Resources')}</NavLink>
            <NavLink to="/about" className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive ? 'bg-[#FFB300]/10 text-[#FFB300]' : 'text-white hover:bg-[#0A192F]'}`}>{t('nav.about')}</NavLink>
            <div className="border-t border-[#FFB300]/20 pt-4 pb-2">
              <div className="flex items-center px-3 space-x-2">
                <Globe className="w-5 h-5 text-[#FFB300]" />
                <select 
                  className="bg-transparent text-white border-none focus:ring-0"
                  value={i18n.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code} className="text-slate-900">{lang.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {user ? (
              <>
                {userRole === 'admin' && (
                  <NavLink to="/admin" className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive ? 'bg-[#FFB300]/10 text-[#FFB300]' : 'text-white hover:bg-[#0A192F]'}`}>
                    {t('nav.admin')}
                  </NavLink>
                )}
                <NavLink to="/user" className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors ${isActive ? 'bg-[#FFB300]/10 text-[#FFB300]' : 'text-white hover:bg-[#0A192F]'}`}>
                  {t('nav.profile')}
                </NavLink>
              </>
            ) : (
              <Link to="/user" className="block px-3 py-2 rounded-md text-base font-medium text-[#FFB300] hover:bg-[#0A192F]">
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
