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
    <div className={`flex items-center justify-center ${className}`}>
      <Image
        src="/images/logo-en.jpg"
        alt="Mazar Studio Logo"
        width={size * 3}
        height={size * 2}
        className="object-contain max-h-[80px] w-auto mix-blend-multiply"
        priority
      />
    </div>
  );
}
