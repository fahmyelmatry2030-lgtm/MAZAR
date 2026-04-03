'use client';
import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { Unit } from '@/lib/data';

interface UnitCardProps {
  unit: Unit;
}

const UnitCard: React.FC<UnitCardProps> = ({ unit }) => {
  const { t, isRTL, language } = useLanguage();

  return (
    <div className={`bg-white rounded-3xl border border-[#EAE4D9] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group`}>
      <div className="relative h-64 overflow-hidden">
        <img 
          src={unit.images[0]} 
          alt={unit.title[language]} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} bg-[#2A2723]/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/10`}>
          {unit.type === 'studio' ? (isRTL ? 'استوديو' : 'STUDIO') : (isRTL ? 'شقة' : 'APARTMENT')}
        </div>
      </div>
      <div className={`p-6 flex flex-col flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
        <h3 className="text-xl font-bold text-[#2A2723] mb-2">{unit.title[language]}</h3>
        <p className="text-sm text-[#7A7061] mb-6 line-clamp-2 leading-relaxed">
          {unit.description[language]}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-8">
          {unit.features[language].slice(0, 3).map((feat, i) => (
            <span key={i} className="text-[10px] font-bold text-[#5C554B] bg-[#F7F5F0] px-2.5 py-1 rounded-lg border border-[#EAE4D9]">
              {feat}
            </span>
          ))}
        </div>

        <Link 
          href={`/mazar/units/${unit.id}`}
          className="mt-auto w-full bg-[#E63946] text-white text-sm font-bold py-3.5 rounded-xl text-center hover:bg-[#c1121f] transition-colors shadow-lg shadow-red-100"
        >
          {t.unitsPage.viewDetails}
        </Link>
      </div>
    </div>
  );
};

export default UnitCard;
