'use client';
import React from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';

export default function HowToBookPage() {
  const { t, isRTL } = useLanguage();

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] selection:bg-[#C1A68D] selection:text-white overflow-x-hidden relative">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-[#EAE4D9]/40 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#D5C5B3]/20 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Navigation */}
      <nav className="w-full px-8 py-5 flex justify-between items-center max-w-screen-2xl mx-auto z-50 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-[#EAE4D9]">
        <Link href="/">
           <Logo size={40} />
        </Link>
        
        <div className="hidden md:flex gap-10 text-sm font-bold text-[#5C554B]">
          <Link href="/mazar/about" className="hover:text-[#2A2723] transition-colors">{t.common.about}</Link>
          <Link href="/mazar/rules" className="hover:text-[#2A2723] transition-colors">{t.common.rules}</Link>
          <Link href="/mazar/how-to-book" className="text-[#C1A68D] transition-colors">{t.common.howToBook}</Link>
        </div>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/mazar/book" className="bg-[#2A2723] text-white text-sm font-bold px-8 py-2.5 rounded-full hover:bg-[#3E3A35] hover:shadow-lg transition-all">
            {t.common.bookNow}
          </Link>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-24 pb-16 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-[#2A2723] mb-4">{t.howToBookPage.title}</h1>
        <p className="text-lg text-[#7A7061] max-w-2xl mx-auto">{t.howToBookPage.subtitle}</p>
      </section>

      {/* Steps Content */}
      <section className="py-16 max-w-4xl mx-auto px-6 relative z-10">
         <div className="space-y-6">
            {t.howToBookPage.steps.map((step, i) => (
              <div key={i} className={`bg-white p-8 rounded-2xl border border-[#EAE4D9] shadow-sm flex items-start gap-6 relative ${isRTL ? 'flex-row' : 'flex-row-reverse text-left'}`}>
                  <div className="w-16 h-16 shrink-0 rounded-full bg-[#F7F5F0] border border-[#EAE4D9] flex items-center justify-center text-2xl font-bold text-[#C1A68D]">{i + 1}</div>
                  <div className="flex-1">
                      <h3 className="text-2xl font-bold text-[#2A2723] mb-2">{step.title}</h3>
                      <p className="text-[#5C554B] leading-relaxed">{step.desc}</p>
                  </div>
              </div>
            ))}
         </div>

         <div className="mt-16 text-center">
            <Link href="/mazar/book" className="inline-block bg-[#2A2723] text-white text-lg font-bold px-12 py-4 rounded-full hover:bg-[#3E3A35] hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                {t.howToBookPage.cta}
            </Link>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-12 mt-20 text-center text-[#5C554B] border-t border-[#EAE4D9] bg-white">
         <div className="mb-6 flex items-center justify-center">
            <Logo size={32} />
         </div>
         <p className="text-sm opacity-80">{t.common.footerRights}</p>
      </footer>
    </main>
  );
}
