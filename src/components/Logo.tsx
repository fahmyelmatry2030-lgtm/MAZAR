'use client';

import React from 'react';
import Image from 'next/image';
import { useLanguage } from '@/lib/LanguageContext';

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = "", size = 40 }: LogoProps) {
  const { language, isRTL } = useLanguage();

  return (
    <div className={`flex flex-col items-center justify-center bg-[#EAE4D9]/80 backdrop-blur-sm px-4 py-1.5 rounded-xl border border-black/10 shadow-sm ${className}`}>
      <span className="text-[#2A2723] font-black text-lg leading-tight tracking-tight">
        {language === 'ar' ? 'مزار' : 'MAZAR'}
      </span>
      <span className="text-[#7A7061] font-bold text-[10px] uppercase tracking-[0.2em] -mt-1">
        {language === 'ar' ? 'ستوديو' : 'STUDIO'}
      </span>
    </div>
  );
}
