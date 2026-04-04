'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';
import { units } from '@/lib/data';
import { getStudios } from '@/lib/data-init';

export default function UnitsListingPage() {
  const { t, isRTL, language } = useLanguage();
  
  const [counts, setCounts] = useState({ branch1: 12, branch2: 12, apts: 3 });

  useEffect(() => {
    const loadCounts = async () => {
      const studios = await getStudios();
      
      const availableBranch1 = units.filter(u => u.branch === 1 && u.type === 'studio' && studios.find((s:any) => s.id === u.id)?.status === 'متاح').length;
      const availableBranch2 = units.filter(u => u.branch === 2 && u.type === 'studio' && studios.find((s:any) => s.id === u.id)?.status === 'متاح').length;
      const availableApts = units.filter(u => u.type === 'apartment' && studios.find((s:any) => s.id === u.id)?.status === 'متاح').length;
      
      setCounts({ branch1: availableBranch1, branch2: availableBranch2, apts: availableApts });
    };
    loadCounts();
  }, []);

  const categories = [
    {
      id: 'branch-1',
      title: t.unitsPage.branch1,
      subtitle: isRTL ? '١٢ استوديو فاخر' : '12 Premium Studios',
      image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
      link: '/mazar/units/branch/1',
      count: counts.branch1
    },
    {
      id: 'branch-2',
      title: t.unitsPage.branch2,
      subtitle: isRTL ? '١٢ استوديو فاخر' : '12 Premium Studios',
      image: 'https://images.unsplash.com/photo-1554995207-c18c20360a59',
      link: '/mazar/units/branch/2',
      count: counts.branch2
    },
    {
      id: 'apartments',
      title: t.unitsPage.apartments,
      subtitle: isRTL ? '٣ شقق فندقية واسعة' : '3 Spacious Apartments',
      image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb',
      link: '/mazar/units/apartments',
      count: counts.apts
    }
  ];

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] selection:bg-[#C1A68D] selection:text-white">
      
      {/* Navigation */}
      <nav className="w-full px-6 py-4 flex justify-between items-center max-w-screen-2xl mx-auto z-50 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-[#EAE4D9]">
        <Link href="/">
           <Logo size={42} />
        </Link>
        <div className="flex items-center gap-6">
          <LanguageSwitcher />
          <Link href="/" className="text-xs font-bold text-[#7A7061] hover:text-[#2A2723]">
            {isRTL ? 'الرئيسية' : 'Home'}
          </Link>
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto px-6 py-20">
        
        {/* Header */}
        <header className="max-w-3xl mb-16">
           <h1 className="text-5xl md:text-6xl font-black text-[#2A2723] mb-6 leading-tight">
             {t.unitsPage.title}
           </h1>
           <p className="text-xl text-[#5C554B] leading-relaxed opacity-80">
             {t.unitsPage.subtitle}
           </p>
        </header>

        {/* Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {categories.map((cat) => (
              <Link 
                key={cat.id} 
                href={cat.link}
                className="group relative h-[500px] rounded-[40px] overflow-hidden border border-[#EAE4D9] shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 block"
              >
                {/* Background Image */}
                <img 
                  src={cat.image} 
                  alt={cat.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                
                {/* Overlay (Glassmorphism) */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#2A2723]/90 via-[#2A2723]/40 to-transparent" />
                
                {/* Content */}
                <div className={`absolute bottom-0 left-0 right-0 p-10 ${isRTL ? 'text-right' : 'text-left'}`}>
                   <div className="mb-4 inline-block bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full text-white text-[10px] font-bold uppercase tracking-widest">
                      {cat.count} {t.unitsPage.availableUnits}
                   </div>
                   <h2 className="text-3xl font-black text-white mb-2">{cat.title}</h2>
                   <p className="text-[#EAE4D9] text-base opacity-80 mb-6 font-medium">{cat.subtitle}</p>
                   
                   <div className="flex items-center gap-3 text-white text-sm font-bold group-hover:gap-5 transition-all">
                      {isRTL ? 'استكشف الوحدات' : 'Explore Units'}
                      <span className={`text-xl transform transition-transform ${isRTL ? 'group-hover:-translate-x-2' : 'group-hover:translate-x-2'}`}>
                        {isRTL ? '←' : '→'}
                      </span>
                   </div>
                </div>
              </Link>
           ))}
        </div>

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
