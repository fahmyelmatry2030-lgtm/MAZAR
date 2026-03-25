'use client';

import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EAE4D9]/40 hover:bg-[#EAE4D9]/80 border border-[#C1A68D]/20 backdrop-blur-md transition-all duration-300 group"
    >
      <span className="text-xs font-bold text-[#5C554B] uppercase tracking-widest group-hover:text-[#2A2723]">
        {language === 'ar' ? 'English' : 'العربية'}
      </span>
      <div className="w-6 h-6 rounded-full bg-[#C1A68D]/20 flex items-center justify-center group-hover:bg-[#C1A68D]/40 transition-colors">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5C554B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
    </button>
  );
}
