import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { X, Send, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';

const IDLE_TIMEOUT_MS = 10_000; // 10 seconds of no interaction
const SESSION_KEY = 'idle_inquiry_dismissed';

export default function IdleInquiryPopup() {
  const { t } = useTranslation();
  const { siteSettings } = useStore();
  const [show, setShow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    company: '',
    email: '',
    phone: '',
    partNeed: '',
    message: '',
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setShow(false);
    sessionStorage.setItem(SESSION_KEY, '1');
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Don't restart if already dismissed or shown
    if (sessionStorage.getItem(SESSION_KEY)) return;
    timerRef.current = setTimeout(() => {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        setShow(true);
      }
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    // If already dismissed this session, do nothing
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handler = () => resetTimer();

    events.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
    // Start initial timer
    resetTimer();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'messages'), {
        name: '',
        company: form.company,
        email: form.email,
        phone: form.phone,
        vehicleModel: '',
        partNeed: form.partNeed,
        quantity: '',
        message: form.message,
        status: 'new',
        source: 'idle_popup',
        createdAt: new Date().toISOString(),
        ...(auth.currentUser ? { userId: auth.currentUser.uid, userEmail: auth.currentUser.email } : {}),
      });
      setSubmitted(true);
      setTimeout(() => {
        dismiss();
        setSubmitted(false);
      }, 3000);
    } catch (err) {
      console.error('[IdlePopup] submit error:', err);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-fadeIn">
      <div className="bg-[#112240] rounded-2xl border border-white/10 shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-4 right-4 text-[#8892B0] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#FFB300]/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-[#FFB300]" />
            </div>
            <p className="text-[#E6F1FF] font-semibold text-base">{t('idle_popup.success', 'Thank you! We\'ll get back to you shortly.')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-5 h-5 text-[#FFB300]" />
              <h3 className="text-lg font-bold text-[#E6F1FF]">
                {t('idle_popup.title', 'Need Help Finding Parts?')}
              </h3>
            </div>
            <p className="text-sm text-[#8892B0] mb-4">
              {t('idle_popup.desc', 'Tell us what you need — our team responds within 2 hours.')}
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                required
                placeholder={t('contact.company', 'Company Name *')}
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md text-sm focus:outline-none focus:border-[#FFB300]/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  required
                  placeholder={t('contact.email', 'Email *')}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
                <input
                  type="tel"
                  placeholder={t('contact.phone', 'Phone / WhatsApp')}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md text-sm focus:outline-none focus:border-[#FFB300]/50"
                />
              </div>
              <input
                type="text"
                required
                placeholder={t('contact.part_need', 'What parts do you need? *')}
                value={form.partNeed}
                onChange={(e) => setForm({ ...form, partNeed: e.target.value })}
                className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md text-sm focus:outline-none focus:border-[#FFB300]/50"
              />
              <textarea
                placeholder={t('contact.message', 'Additional details (optional)')}
                rows={2}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3 py-2 border border-white/10 bg-[#0A192F] text-white rounded-md text-sm focus:outline-none focus:border-[#FFB300]/50 resize-none"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-[#FFB300] text-[#0A192F] font-bold rounded-lg hover:bg-[#FFCA28] transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {t('idle_popup.submit', 'Send Inquiry')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
