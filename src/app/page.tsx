'use client';

import React from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';

export default function MazarHybridLanding() {
  const { t, isRTL } = useLanguage();

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] selection:bg-[#C1A68D] selection:text-white overflow-x-hidden relative">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-[#EAE4D9]/40 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#D5C5B3]/20 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Navigation (Matching Image Literally - Correct RTL Order) */}
      <nav className="w-full px-6 py-4 flex justify-between items-center max-w-screen-2xl mx-auto z-50 sticky top-0 bg-white/50 backdrop-blur-md">
        
        {/* Logo (First in JSX -> Right in RTL) */}
        <Link href="/">
           <Logo size={42} />
        </Link>
        
        {/* Center: Language Switcher */}
        <div className="flex-1 flex justify-center px-4">
           <LanguageSwitcher />
        </div>

        {/* Book Now (Last in JSX -> Left in RTL) */}
        <Link href="/mazar/book" className="bg-[#2A2723] text-white text-xs font-black min-w-[70px] px-4 py-2.5 rounded-full hover:bg-black transition-all text-center leading-tight">
          {isRTL ? 'احجز\nالآن' : 'BOOK\nNOW'}
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6 flex flex-col items-center text-center relative z-10">

        {/* Main Title (Headline) */}
        <h1 className="text-4xl md:text-6xl font-extrabold text-[#2A2723] mb-2 tracking-tight leading-tight">
          {t.common.luxuryStay}
        </h1>
        <h2 className="text-2xl md:text-4xl font-bold text-[#5C554B] mb-8">
          {t.common.differentExperience}
        </h2>

        {/* Services Badges Row (Highlighted style from image) */}
        <div className="flex flex-wrap justify-center gap-3 mb-8 bg-[#C1A68D]/10 p-4 rounded-3xl border border-[#C1A68D]/20">
          {(t.common.heroServices as { icon: string; label: string }[]).map((service, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-white border border-[#EAE4D9] px-4 py-2 rounded-full shadow-sm"
            >
              <span className="text-base">{service.icon}</span>
              <span className="text-xs md:text-sm font-bold text-[#4A3F2F]">
                {service.label}
              </span>
            </div>
          ))}
        </div>

        {/* Marketing Subtitle (Blue-ish text in image context) */}
        <p className="max-w-2xl text-lg md:text-2xl text-[#2A2723] leading-relaxed mb-12 px-4 font-bold">
          {t.common.heroSubtitle}
        </p>

        {/* CTA Buttons Row */}
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Big Red CTA Button (Literal from image) */}
          <Link
            href="/mazar/book"
            className="group relative inline-flex items-center justify-center bg-[#E63946] text-white text-3xl md:text-4xl font-black px-16 py-6 rounded-3xl shadow-2xl shadow-red-500/40 hover:bg-[#c1121f] hover:scale-105 active:scale-95 transition-all duration-300 border-4 border-white/20"
          >
            {t.common.bookNow}
          </Link>

          {/* Secondary Explore Units Button */}
          <Link
            href="/mazar/units"
            className="group relative inline-flex items-center justify-center bg-white text-[#2A2723] text-xl md:text-2xl font-bold px-12 py-5 rounded-3xl border-2 border-[#EAE4D9] hover:border-[#C1A68D] hover:bg-[#F7F5F0] transition-all duration-300"
          >
            {t.common.explore}
          </Link>
        </div>

        {/* Units Stats / Branches Info */}
        <div className="mt-12 mb-4 bg-white/40 backdrop-blur-sm border border-[#EAE4D9] rounded-2xl px-8 py-4 flex flex-col md:flex-row gap-8 items-center">
           <div className="text-center md:text-right">
              <span className="block text-2xl font-black text-[#2A2723]">24</span>
              <span className="text-[10px] font-bold text-[#7A7061] uppercase tracking-wider">{t.unitsPage.branch1} & {t.unitsPage.branch2}</span>
           </div>
           <div className="hidden md:block w-px h-8 bg-[#EAE4D9]" />
           <div className="text-center md:text-right">
              <span className="block text-2xl font-black text-[#2A2723]">3</span>
              <span className="text-[10px] font-bold text-[#7A7061] uppercase tracking-wider">{t.unitsPage.apartments}</span>
           </div>
        </div>

        {/* Trust indicators (Simplified as per image focus) */}
        <div className="flex items-center gap-6 mt-4 text-[10px] font-bold text-[#9A8F82] uppercase tracking-widest">
          <div className="flex items-center gap-1.5 line-through decoration-red-500/20">
             <span>✓</span>
             <span>تأكيد فوري</span>
          </div>
          <div className="flex items-center gap-1.5">
             <span>🔒</span>
             <span>أمان ذكي</span>
          </div>
          <div className="flex items-center gap-1.5">
             <span>⭐</span>
             <span>جودة فندقية</span>
          </div>
        </div>

        {/* Overlapping Images */}
        <div className="relative w-full max-w-5xl h-[450px] md:h-[550px] mt-16 rounded-3xl z-10">
           {/* Left Image */}
           <div className={`absolute ${isRTL ? 'right-0 md:right-10' : 'left-0 md:left-10'} bottom-0 md:-bottom-16 w-[85%] md:w-[55%] h-[320px] md:h-[420px] rounded-3xl overflow-hidden shadow-2xl border-4 border-white z-20 group`}>
              <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors z-10 duration-500" />
              <img src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=2070&auto=format&fit=crop" alt="Studio Bedroom" className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700" />
              
              <div className={`absolute bottom-6 ${isRTL ? 'right-6 left-6 text-right' : 'left-6 right-6 text-left'} bg-white/90 backdrop-blur-md p-5 rounded-2xl z-20 shadow-sm border border-gray-100`}>
                 <h3 className="font-bold text-[#2A2723] text-xl mb-1">{t.common.features.quiet}</h3>
                 <p className="text-sm text-[#7A7061]">{t.common.features.quietDesc}</p>
              </div>
           </div>

           {/* Right Image */}
           <div className={`absolute ${isRTL ? 'left-0 md:left-10' : 'right-0 md:right-10'} top-0 w-[85%] md:w-[65%] h-[350px] md:h-[450px] rounded-3xl overflow-hidden shadow-xl border border-[#EAE4D9] z-10`}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 z-10" />
              <img src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=2070&auto=format&fit=crop" alt="Luxury Living Room" className="w-full h-full object-cover" />
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-[#5C554B] border-t border-[#EAE4D9] bg-white mt-20">
         <div className="mb-6 flex items-center justify-center">
           <Logo size={32} />
         </div>
         <div className="flex justify-center gap-6 mb-8 text-sm font-bold">
            <Link href="/mazar/how-to-book" className="hover:text-[#C1A68D]">{t.common.rules}</Link>
            <Link href="/mazar/how-to-book" className="hover:text-[#C1A68D]">{t.common.howToBook}</Link>
            <Link href="/mazar/rules" className="hover:text-[#C1A68D]">{t.common.about}</Link>
         </div>
         <p className="text-sm opacity-80">{t.common.footerRights}</p>
      </footer>

    </main>
  );
}
