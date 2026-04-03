'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';
import { units } from '@/lib/data';

export default function UnitDetailsPage() {
  const { t, isRTL, language } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const unit = units.find(u => u.id === id);
  const [activeImage, setActiveImage] = useState(unit ? unit.images[0] : '');

  if (!unit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="mb-8">{isRTL ? 'الوحدة غير موجودة' : 'Unit not found'}</p>
          <button onClick={() => router.push('/mazar/units')} className="bg-[#2A2723] text-white px-8 py-2 rounded-full">
            {t.unitsPage.backToList}
          </button>
        </div>
      </div>
    );
  }

  const whatsappMessage = encodeURIComponent(
    isRTL 
      ? `مرحباً مزار، أريد الاستفسار عن حجز ${unit.title.ar} (معرف: ${unit.id})`
      : `Hello Mazar, I would like to inquire about booking ${unit.title.en} (ID: ${unit.id})`
  );

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] selection:bg-[#C1A68D] selection:text-white">
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex justify-between items-center max-w-screen-2xl mx-auto z-50 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-[#EAE4D9]">
        <Link href="/">
           <Logo size={42} />
        </Link>
        <div className="flex items-center gap-6">
          <LanguageSwitcher />
          <Link href="/mazar/units" className="text-xs font-bold text-[#7A7061] hover:text-[#2A2723]">
            {t.unitsPage.backToList}
          </Link>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-6 py-12 md:py-20">
        
        {/* Breadcrumb / Back Link */}
        <div className="mb-8">
           <button onClick={() => router.back()} className={`text-sm font-bold text-[#C1A68D] flex items-center gap-2 hover:opacity-80`}>
              {isRTL ? '← العودة' : '← Back'}
           </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          
          {/* Left: Gallery Section */}
          <div className="space-y-6">
             <div className="relative aspect-[4/3] rounded-[40px] overflow-hidden border border-[#EAE4D9] shadow-xl group">
                <img 
                  src={activeImage} 
                  alt={unit.title[language]} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
             </div>
             
             {/* Thumbnail Grid (5 images) */}
             <div className="grid grid-cols-5 gap-3">
                {unit.images.map((img, i) => (
                   <button 
                     key={i} 
                     onClick={() => setActiveImage(img)}
                     className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${activeImage === img ? 'border-[#C1A68D] scale-95 shadow-lg' : 'border-[#EAE4D9] hover:border-[#C1A68D]/40'}`}
                   >
                      <img src={img} className="w-full h-full object-cover" alt={`Gallery ${i}`} />
                   </button>
                ))}
             </div>
          </div>

          {/* Right: Info Section */}
          <div className={`flex flex-col ${isRTL ? 'text-right' : 'text-left'}`}>
             <div className="inline-block bg-[#F7F5F0] border border-[#C1A68D]/30 px-3 py-1 rounded-lg text-[10px] font-bold text-[#C1A68D] mb-4 uppercase tracking-widest">
                {unit.type}
             </div>
             
             <h1 className="text-4xl md:text-5xl font-black text-[#2A2723] mb-6 leading-tight">
                {unit.title[language]}
             </h1>

             <p className="text-lg text-[#5C554B] leading-loose mb-10 opacity-90">
                {unit.description[language]}
             </p>

             <div className="bg-white p-8 rounded-[40px] border border-[#EAE4D9] shadow-sm mb-10">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#E63946]"></span>
                   {t.unitsPage.unitFeatures}
                </h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                   {unit.features[language].map((feat, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-[#4A3F2F] font-bold">
                         <span className="text-green-500">✓</span>
                         {feat}
                      </div>
                   ))}
                </div>
             </div>

             <a 
               href={`https://wa.me/201234567890?text=${whatsappMessage}`} 
               target="_blank"
               rel="noopener noreferrer"
               className="w-full bg-[#E63946] text-white text-lg font-black py-5 rounded-3xl text-center hover:bg-[#c1121f] transition-all shadow-2xl shadow-red-500/30 active:scale-95 transform flex items-center justify-center gap-4"
             >
                <span className="text-2xl">📱</span>
                {t.unitsPage.bookThisUnit}
             </a>

             <div className="mt-8 flex items-center gap-4 justify-center">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#9A8F82] uppercase tracking-[0.2em]">
                   <span>🔒</span>
                   <span>Smart Access</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-[#EAE4D9]" />
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#9A8F82] uppercase tracking-[0.2em]">
                   <span>❄️</span>
                   <span>Full AC</span>
                </div>
             </div>
          </div>

        </div>

        {/* Gallery Grid (The "5 Images" again but in a more detailed view if needed) */}
        <section className="mt-24 pt-20 border-t border-[#EAE4D9]">
           <h2 className="text-2xl font-black text-[#2A2723] mb-10">{t.unitsPage.gallery}</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unit.images.slice(1).map((img, i) => (
                 <div key={i} className={`rounded-3xl overflow-hidden border border-[#EAE4D9] ${i === 0 ? 'md:col-span-2' : ''}`}>
                    <img src={img} alt={`Detail ${i}`} className="w-full h-80 object-cover" />
                 </div>
              ))}
           </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="py-20 border-t border-[#EAE4D9] bg-white mt-20 text-center">
         <div className="mb-8">
           <Logo size={40} />
         </div>
         <p className="text-sm text-[#7A7061] font-bold">{t.common.footerRights}</p>
      </footer>
    </main>
  );
}
