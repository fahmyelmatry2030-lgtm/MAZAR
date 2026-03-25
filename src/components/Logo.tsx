'use client';

import React from 'react';
import Image from 'next/image';
import { useLanguage } from '@/lib/LanguageContext';

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = "", size = 40 }: LogoProps) {
  const { language } = useLanguage();
  const logoSrc = language === 'en' ? '/images/logo-en.jpg' : '/images/logo-ar.jpg';

  return (
    <div className={`flex items-center justify-center h-14 w-32 md:w-36 rounded-xl bg-[#EAE4D9] overflow-hidden shadow-sm border border-black/5 ${className}`}>
      <div className="relative w-full h-full scale-[1.3]">
        <Image 
          src={logoSrc}
          alt="Mazar Logo"
          fill
          className="object-contain mix-blend-multiply"
          priority
        />
      </div>
    </div>
  );
}
