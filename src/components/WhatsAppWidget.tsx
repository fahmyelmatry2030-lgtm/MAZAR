'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';

export default function WhatsAppWidget() {
  const pathname = usePathname();
  const { t, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Do not render on admin or employee pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/employee')) {
    return null;
  }
  
  // Use the phone number from translations or a default one
  const phoneNumber = '201108109969'; 

  const whatsappT = (t.common as any).whatsapp;

  return (
    <div className={`fixed bottom-24 sm:bottom-8 ${isRTL ? 'left-6 md:left-10' : 'right-6 md:right-10'} z-[110]`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`absolute bottom-20 ${isRTL ? 'left-0' : 'right-0'} w-72 bg-white border border-[#EAE4D9] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden`}
          >
            {/* Header */}
            <div className="bg-[#25D366] p-5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="text-white w-7 h-7" />
              </div>
              <div>
                <p className="text-white font-black text-sm">{whatsappT?.support || 'WhatsApp Support'}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <p className="text-white/90 text-[10px] font-bold uppercase tracking-wider">{whatsappT?.online || 'Online Now'}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className={`ml-auto ${isRTL ? 'mr-auto ml-0' : ''} text-white/70 hover:text-white transition-colors`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 bg-gradient-to-b from-white to-[#FDFBF7]">
              <div className="bg-[#F3F0E9] p-4 rounded-2xl rounded-tl-none border border-[#EAE4D9] text-xs text-[#5C554B] font-bold leading-relaxed mb-6">
                {whatsappT?.welcome || 'Hello! How can we help you today?'}
              </div>
              <a
                href={`https://wa.me/${phoneNumber}?text=${encodeURIComponent(whatsappT?.defaultMsg || 'Hi Mazar, I would like to inquire about booking.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-[#25D366] text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs hover:bg-[#128C7E] transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-[#25D366]/20"
              >
                <Send className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                {whatsappT?.startChat || 'Start Chat'}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 md:w-20 md:h-20 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(37,211,102,0.3)] relative z-[120] border-4 border-white"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }}>
              <X className="w-8 h-8 md:w-10 md:h-10" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}>
              <MessageCircle className="w-8 h-8 md:w-10 md:h-10" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="absolute top-1 right-1 w-4 h-4 md:w-5 md:h-5 bg-red-500 border-2 border-white rounded-full animate-bounce"></span>
      </motion.button>
    </div>
  );
}
