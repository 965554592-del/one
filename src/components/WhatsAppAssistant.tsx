import { useState, useEffect, useMemo } from 'react';
import { MessageCircle, X, Send, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getWorkingHoursStatus, setWorkingHoursOverride } from '../lib/workingHours';
import { trackEvent } from '../lib/pixel';

export default function WhatsAppAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [status, setStatus] = useState(() => getWorkingHoursStatus());
  const { siteSettings } = useStore();

  // Clean phone number for WhatsApp link (remove non-digits except +)
  const rawPhone = siteSettings?.phone || "861234567890";
  const whatsappNumber = rawPhone.replace(/[^\d+]/g, '');

  useEffect(() => {
    const stored = localStorage.getItem('recent_inquiries');
    if (stored) {
      try { setRecentProducts(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // Sync Firestore-stored working hours into runtime override.
  useEffect(() => {
    if (siteSettings?.workingHours || siteSettings?.workingHoursTz) {
      setWorkingHoursOverride(siteSettings.workingHours, siteSettings.workingHoursTz);
      setStatus(getWorkingHoursStatus());
    }
  }, [siteSettings?.workingHours, siteSettings?.workingHoursTz]);

  // Re-evaluate working hours every minute.
  useEffect(() => {
    const id = setInterval(() => setStatus(getWorkingHoursStatus()), 60_000);
    return () => clearInterval(id);
  }, []);

  const autoReply = useMemo(() => {
    if (status.isOpen) {
      return 'Hi! Our team is online now and will reply within minutes. How can we help you?';
    }
    return `Thanks for reaching out! We are currently offline. Working hours: ${status.schedule} (${status.timezone}). Leave your message and we will get back to you ASAP.`;
  }, [status]);

  const handleInquiry = (product?: any) => {
    let message = status.isOpen
      ? '你好，我想咨询一下产品。'
      : `你好，我现在留言（当前为非工作时间，工作时间：${status.schedule}）。`;
    if (product) {
      message = `你好，我对 ${product.name} (SKU: ${product.sku}) 很感兴趣，请发送更多详情。`;
    }
    const encodedMessage = encodeURIComponent(message);

    trackEvent('Contact', {
      content_category: product ? 'product_inquiry' : 'general_inquiry',
      content_name: product?.name || 'WhatsApp Assistant',
    });

    if (siteSettings?.whatsappLink) {
      const link = siteSettings.whatsappLink.includes('?') 
        ? `${siteSettings.whatsappLink}&text=${encodedMessage}`
        : `${siteSettings.whatsappLink}?text=${encodedMessage}`;
      window.open(link, '_blank');
    } else {
      window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 bg-[#112240] rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#FFB300] p-4 flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-[#0A192F] rounded-full flex items-center justify-center mr-2">
                <MessageCircle className="w-4 h-4 text-[#FFB300]" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[#0A192F] text-sm leading-tight">WhatsApp 助手</span>
                <span className="text-[10px] text-[#0A192F]/80 flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${status.isOpen ? 'bg-green-600' : 'bg-gray-500'}`} />
                  {status.isOpen ? '在线' : '离线 · 自动回复'}
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-[#0A192F]/60 hover:text-[#0A192F]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="mb-3 p-3 bg-[#0A192F] rounded-lg border border-white/5 text-[12px] text-[#E6F1FF] leading-relaxed">
              {autoReply}
            </div>

            {!status.isOpen && (
              <div className="mb-3 flex items-start text-[11px] text-[#8892B0]">
                <Clock className="w-3.5 h-3.5 mr-1 mt-0.5 flex-shrink-0" />
                <span>工作时间：{status.schedule}（{status.timezone}）</span>
              </div>
            )}

            {recentProducts.length > 0 && (
              <div className="mb-4">
                <span className="text-[10px] text-[#FFB300] uppercase tracking-wider font-bold mb-2 block">最近关注</span>
                <div className="space-y-2">
                  {recentProducts.slice(0, 3).map((p, i) => (
                    <button 
                      key={i}
                      onClick={() => handleInquiry(p)}
                      className="w-full text-left p-2 bg-[#0A192F] rounded-lg border border-white/5 hover:border-[#FFB300]/30 transition-colors group"
                    >
                      <div className="text-[11px] font-medium text-[#E6F1FF] truncate group-hover:text-[#FFB300]">{p.name}</div>
                      <div className="text-[9px] text-[#8892B0]">SKU: {p.sku}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <button 
              onClick={() => handleInquiry()}
              className="w-full py-2 bg-[#FFB300] text-[#0A192F] rounded-lg text-sm font-bold flex items-center justify-center hover:bg-[#FFCA28] transition-colors"
            >
              <Send className="w-4 h-4 mr-2" />
              立即咨询
            </button>
          </div>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-14 h-14 bg-[#FFB300] rounded-full shadow-lg flex items-center justify-center text-[#0A192F] hover:scale-110 transition-transform active:scale-95"
        aria-label="Open WhatsApp assistant"
      >
        <MessageCircle className="w-7 h-7" />
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.isOpen ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-4 w-4 ${status.isOpen ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          </span>
        )}
      </button>
    </div>
  );
}
