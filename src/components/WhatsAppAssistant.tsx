import { useState, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function WhatsAppAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const { siteSettings } = useStore();
  
  // Clean phone number for WhatsApp link (remove non-digits except +)
  const rawPhone = siteSettings?.phone || "861234567890";
  const whatsappNumber = rawPhone.replace(/[^\d+]/g, '');

  useEffect(() => {
    const stored = localStorage.getItem('recent_inquiries');
    if (stored) {
      setRecentProducts(JSON.parse(stored));
    }
  }, []);

  const handleInquiry = (product?: any) => {
    let message = "你好，我想咨询一下。";
    if (product) {
      message = `你好，我对 ${product.name} (SKU: ${product.sku}) 很感兴趣，请发送更多详情。`;
    }
    const encodedMessage = encodeURIComponent(message);
    
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
        <div className="mb-4 w-72 bg-[#112240] rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#FFB300] p-4 flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-[#0A192F] rounded-full flex items-center justify-center mr-2">
                <MessageCircle className="w-4 h-4 text-[#FFB300]" />
              </div>
              <span className="font-bold text-[#0A192F] text-sm">WhatsApp 助手</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-[#0A192F]/60 hover:text-[#0A192F]">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-4">
            <p className="text-[12px] text-[#8892B0] mb-4">欢迎咨询！您可以直接发送消息，或者查看您最近关注的产品。</p>
            
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
        className="w-14 h-14 bg-[#FFB300] rounded-full shadow-lg flex items-center justify-center text-[#0A192F] hover:scale-110 transition-transform active:scale-95"
      >
        <MessageCircle className="w-7 h-7" />
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFB300] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-[#FFB300]"></span>
          </span>
        )}
      </button>
    </div>
  );
}
