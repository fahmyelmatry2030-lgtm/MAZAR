import React from 'react';
import Link from 'next/link';
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

      {/* Header */}
      <section className="pt-24 pb-16 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-[#2A2723] mb-4">{t.aboutPage.title}</h1>
        <p className="text-lg text-[#7A7061] max-w-2xl mx-auto">{t.aboutPage.subtitle}</p>
      </section>

      {/* About Section */}
      <section className="py-16 relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-xl text-[#5C554B] leading-loose">
               {t.aboutPage.description1}
            </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 max-w-screen-xl mx-auto px-6">
         <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-[#2A2723] mb-4 flex items-center justify-center gap-4">
               <span className="w-12 h-px bg-[#C1A68D]/50"></span>
               {t.aboutPage.whatWeOffer}
               <span className="w-12 h-px bg-[#C1A68D]/50"></span>
            </h2>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
               <div key={i} className={`bg-white p-8 rounded-2xl border border-[#EAE4D9] shadow-sm hover:shadow-md hover:border-[#C1A68D]/50 transition-all ${isRTL ? 'text-right' : 'text-left'} group`}>
                  <div className={`text-3xl mb-4 group-hover:scale-110 transition-transform ${isRTL ? 'origin-right' : 'origin-left'}`}>{feature.icon}</div>
                  <h3 className="text-lg font-bold text-[#2A2723] mb-2">{feature.title}</h3>
                  <p className="text-sm text-[#5C554B] leading-relaxed">{feature.desc}</p>
               </div>
            ))}
         </div>
      </section>

      {/* Goal Section */}
      <section className="py-24 relative overflow-hidden bg-[#2A2723] text-white">
         <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-8">🎯 {t.aboutPage.ourGoal}</h2>
            <p className="text-2xl leading-relaxed text-[#EAE4D9] font-light">
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
