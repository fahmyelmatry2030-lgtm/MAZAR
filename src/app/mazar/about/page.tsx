'use client';
import React from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';

export default function AboutPage() {
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
               <Link href="/mazar/about" className="text-[#C1A68D] transition-colors">{t.common.about}</Link>
               <Link href="/mazar/rules" className="hover:text-[#2A2723] transition-colors">{t.common.rules}</Link>
               <Link href="/mazar/how-to-book" className="hover:text-[#2A2723] transition-colors">{t.common.howToBook}</Link>
            </div>

            <div className="flex items-center gap-4">
               <LanguageSwitcher />
               <Link href="/mazar/book" className="bg-[#2A2723] text-white text-sm font-bold px-8 py-2.5 rounded-full hover:bg-[#3E3A35] hover:shadow-lg transition-all">
                  {t.common.bookNow}
               </Link>
            </div>
         </nav>

         {/* Professional Minimalist Header */}
         <section className="pt-24 pb-16 px-6 text-center flex flex-col items-center">
            <div className="mb-12">
               <NextImage 
                  src="/images/logo-en.jpg" 
                  alt="Mazar Logo" 
                  width={180} 
                  height={120} 
                  className="object-contain" 
                  priority
               />
            </div>
            <h1 className="text-4xl md:text-7xl font-bold text-[#2A2723] mb-6 tracking-tight max-w-4xl">
               {t.aboutPage.title}
            </h1>
            <p className="text-lg md:text-xl text-[#7A7061] max-w-2xl mx-auto font-medium">
               {t.aboutPage.subtitle}
            </p>
         </section>

         {/* Premium Split Story Section */}
         <section className="py-24 bg-white border-y border-[#EAE4D9]">
            <div className="max-w-screen-2xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
               {/* Column 1: Text Content */}
               <div className={`${isRTL ? 'lg:order-2' : 'lg:order-1'} space-y-8`}>
                  <div className="w-16 h-1.5 bg-[#C1A68D] rounded-full" />
                  <p className="text-3xl md:text-5xl text-[#2A2723] leading-snug font-black">
                     {t.aboutPage.description1}
                  </p>
                  <p className="text-xl md:text-2xl text-[#5C554B] leading-relaxed font-medium italic">
                     بنسعى في مزار لتقديم تجربة إقامة حقيقية تجمع بين الفخامة والخصوصية، حيث نولي اهتماماً فائقاً لكل التفاصيل لضمان راحتكم وسعادتكم طوال فترة إقامتكم.
                  </p>
               </div>

               {/* Column 2: Featured Image Box */}
               <div className={`${isRTL ? 'lg:order-1' : 'lg:order-2'} relative h-[400px] md:h-[650px] rounded-[2.5rem] overflow-hidden shadow-2xl group`}>
                  <NextImage 
                     src="/images/Mazar 1 Pictures/WhatsApp Image 2025-12-15 at 12.39.16_ff8ccd08.jpg" 
                     alt="Luxury Studio Interior" 
                     fill 
                     className="object-cover group-hover:scale-105 transition-transform duration-[2s]"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/60 to-transparent">
                     <p className="text-white font-bold text-lg">أناقة التفاصيل في قلب مدينة نصر</p>
                  </div>
               </div>
            </div>
         </section>

         {/* Refined Features Section */}
         <section className="py-32 max-w-screen-2xl mx-auto px-6">
            <div className="flex flex-col items-center mb-20">
               <h2 className="text-sm font-black uppercase tracking-[0.3em] text-[#C1A68D] mb-4">
                  {t.aboutPage.whatWeOffer}
               </h2>
               <div className="w-12 h-1 bg-[#2A2723]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
               {[
                  { icon: '❄️', title: t.aboutPage.features.ac, desc: t.aboutPage.features.acDesc },
                  { icon: '🍳', title: t.aboutPage.features.kitchen, desc: t.aboutPage.features.kitchenDesc },
                  { icon: '📶', title: t.aboutPage.features.wifi, desc: t.aboutPage.features.wifiDesc },
                  { icon: '🧹', title: t.aboutPage.features.clean, desc: t.aboutPage.features.cleanDesc },
                  { icon: '🔐', title: t.aboutPage.features.smart, desc: t.aboutPage.features.smartDesc },
                  { icon: '🎥', title: t.aboutPage.features.security, desc: t.aboutPage.features.securityDesc },
                  { icon: '☕', title: t.aboutPage.features.coffee, desc: t.aboutPage.features.coffeeDesc },
                  { icon: '✨', title: t.aboutPage.features.hotel, desc: t.aboutPage.features.hotelDesc },
               ].map((feature, i) => (
                  <div key={i} className={`bg-white p-10 rounded-3xl border border-[#EAE4D9]/60 hover:border-[#C1A68D] hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ${isRTL ? 'text-right' : 'text-left'} group`}>
                     <div className="w-14 h-14 bg-[#FDFBF7] rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:bg-[#C1A68D]/10 transition-colors">
                        {feature.icon}
                     </div>
                     <h3 className="text-xl font-bold text-[#2A2723] mb-3">{feature.title}</h3>
                     <p className="text-sm text-[#7A7061] leading-relaxed font-medium">{feature.desc}</p>
                  </div>
               ))}
            </div>
         </section>

         {/* Minimalist Goal Section */}
         <section className="py-32 relative overflow-hidden bg-[#1A1816] text-white">
            <div className="max-w-4xl mx-auto px-6 text-center">
               <span className="inline-block text-[#C1A68D] text-4xl mb-8">🎯</span>
               <h2 className="text-3xl md:text-5xl font-black mb-10 tracking-tight leading-tight">
                  {t.aboutPage.ourGoal}
               </h2>
               <p className="text-xl md:text-3xl leading-relaxed text-white/70 font-light italic">
                  {t.aboutPage.goalDesc}
               </p>
            </div>
         </section>

         {/* Footer */}
         <footer className="py-12 text-center text-[#5C554B] border-t border-[#EAE4D9] bg-white">
            <div className="mb-6 flex items-center justify-center">
               <Logo size={32} />
            </div>
            <p className="text-sm opacity-80">{t.common.footerRights}</p>
         </footer>
      </main>
   );
}
