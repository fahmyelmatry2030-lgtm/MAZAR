'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';
import { getSystemUnits } from '@/lib/data-init';
import UnitCard from '@/components/UnitCard';

export default function BranchUnitsPage() {
  const { t, isRTL } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const branchId = parseInt(params.id as string);

  const [branchUnits, setBranchUnits] = useState<any[]>([]);

  useEffect(() => {
    const allUnits = getSystemUnits();
    setBranchUnits(allUnits.filter((u:any) => u.branch === branchId && u.type === 'studio'));
  }, [branchId]);

  const branchName = branchId === 1 ? t.unitsPage.branch1 : t.unitsPage.branch2;

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
            {t.unitsPage.backToCategories}
          </Link>
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto px-6 py-20">
        
        {/* Header */}
        <header className="mb-16">
           <div className="mb-6">
              <button 
                onClick={() => router.push('/mazar/units')}
                className={`text-sm font-bold text-[#C1A68D] hover:opacity-80 flex items-center gap-2`}
              >
                 {isRTL ? `← ${t.unitsPage.backToCategories}` : `← ${t.unitsPage.backToCategories}`}
              </button>
           </div>
           <h1 className="text-5xl md:text-6xl font-black text-[#2A2723] mb-4 leading-tight">
             {branchName}
           </h1>
           <p className="text-xl text-[#5C554B] opacity-70">
              {isRTL ? `استعرض ١٢ استوديو فندقي متاح الآن في ${branchName}` : `Explore 12 studios available now in ${branchName}`}
           </p>
        </header>

        {/* Units Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {branchUnits.map((unit: any) => (
            <UnitCard key={unit.id} unit={unit} />
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
