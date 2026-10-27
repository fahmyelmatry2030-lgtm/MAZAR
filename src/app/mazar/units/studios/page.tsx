'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';

import UnitCard from '@/components/UnitCard';
import LuxuryDateInput from '@/components/LuxuryDateInput';

const getStudioTypeCategory = (unitId: string) => {
  if (unitId.startsWith('p-s') || unitId.startsWith('apt-')) return 'tworoom';
  const mapping: { [key: string]: string } = {
    'b1-s1': 'double', 'b1-s2': 'single', 'b1-s3': 'single', 'b1-s4': 'triple', 'b1-s5': 'double',
    'b1-s6': 'single', 'b1-s7': 'single', 'b1-s8': 'single', 'b1-s9': 'double', 'b1-s10': 'double',
    'b1-s11': 'double', 'b1-s12': 'double',
    'b2-s1': 'double', 'b2-s2': 'triple', 'b2-s3': 'triple', 'b2-s4': 'triple', 'b2-s5': 'single',
    'b2-s6': 'double', 'b2-s7': 'triple', 'b2-s8': 'double', 'b2-s9': 'triple', 'b2-s10': 'triple',
    'b2-s11': 'triple', 'b2-s12': 'double',
  };
  return mapping[unitId] || 'single';
};

export default function StudiosPage() {
  const { t, isRTL } = useLanguage();
  const router = useRouter();

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [allStudios, setAllStudios] = useState<any[]>([]);
  const [displayedStudios, setDisplayedStudios] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  const getCountForType = (type: string) => {
    if (type === 'all') return allStudios.length;
    return allStudios.filter((u) => getStudioTypeCategory(u.id) === type).length;
  };

  useEffect(() => {
    const loadUnits = async () => {
      try {
        const res = await fetch('/api/units');
        if (!res.ok) return;
        const allUnits = await res.json();
        
        const urlParams = new URLSearchParams(window.location.search);
        const branchParam = urlParams.get('branch');
        
        const filtered = allUnits.filter((u: any) => {
          if (u.id.startsWith('apt-')) return false;
          if (branchParam) {
            const b = parseInt(branchParam);
            if (u.branch !== b && !(b === 2 && u.branch === 3)) return false;
          }
          return true;
        });
        
        setAllStudios(filtered);
        setDisplayedStudios(filtered);

        // Fetch bookings for date filtering
        const bookingsRes = await fetch('/api/bookings');
        if (bookingsRes.ok) {
          const allB = await bookingsRes.json();
          setBookings(allB);
        }
      } catch {
        // silently fail
      }
    };
    loadUnits();
  }, []);

  useEffect(() => {
    let filtered = allStudios;

    // 1. Date overlap filtering
    if (checkIn && checkOut && new Date(checkOut) > new Date(checkIn)) {
      filtered = filtered.filter((unit) => {
        const hasOverlap = bookings.some((b: any) => {
          if (b.apartmentId !== unit.id) return false;
          if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
          return (checkIn < b.checkOut && checkOut > b.checkIn);
        });
        return !hasOverlap;
      });
    }

    // 2. Type category filtering
    if (selectedType !== 'all') {
      filtered = filtered.filter((unit) => getStudioTypeCategory(unit.id) === selectedType);
    }

    setDisplayedStudios(filtered);
  }, [checkIn, checkOut, selectedType, allStudios, bookings]);

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] selection:bg-[#C1A68D] selection:text-white">
      
      {/* Navigation */}
      <nav className="w-full px-6 py-4 hidden md:flex justify-between items-center max-w-screen-2xl mx-auto z-50 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-[#EAE4D9]">
        <Link href="/">
           <Logo size={42} mdSize={48} />
        </Link>
        <div className="flex items-center gap-6">
          <LanguageSwitcher />
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto px-6 py-12 md:py-20">
        
        {/* Header */}
        <header className="mb-12 md:mb-16">

           <h1 className="text-4xl md:text-6xl font-black text-[#2A2723] mb-4 md:mb-6 leading-tight">
             {isRTL ? 'الاستوديوهات الفندقية' : 'Hotel Studios'}
             {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('branch') === '1' && ' (الفرع الأول)'}
             {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('branch') === '2' && ' (الفرع الثاني)'}
           </h1>
           <p className="text-base md:text-xl text-[#5C554B] opacity-70 max-w-3xl leading-relaxed">
              {isRTL 
                ? `استعرض مجموعة متنوعة من الاستوديوهات الفندقية الفاخرة التي تناسب احتياجاتك.` 
                : `Explore a diverse selection of premium hotel studios tailored to your needs.`}
           </p>
        </header>

        {/* Date Filter Bar */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#EAE4D9] shadow-sm mb-12 flex flex-col md:flex-row gap-6 items-start max-w-4xl" dir={isRTL ? "rtl" : "ltr"}>
          <div className="flex-1 w-full">
            <LuxuryDateInput
              label={isRTL ? "تاريخ الدخول (البحث عن المتاح)" : "Check-In Date (Search Availability)"}
              value={checkIn}
              onChange={(val) => {
                setCheckIn(val);
                if (val && checkOut && new Date(checkOut) <= new Date(val)) {
                  const next = new Date(val);
                  next.setDate(next.getDate() + 1);
                  setCheckOut(next.toISOString().split("T")[0]);
                }
              }}
              isRTL={isRTL}
            />
          </div>
          <div className="flex-1 w-full">
            <LuxuryDateInput
              label={isRTL ? "تاريخ الخروج" : "Check-Out Date"}
              value={checkOut}
              min={checkIn}
              onChange={(val) => setCheckOut(val)}
              isRTL={isRTL}
            />
          </div>
          {(checkIn || checkOut) && (
            <div className="pt-6 w-full md:w-auto">
              <button
                onClick={() => { setCheckIn(""); setCheckOut(""); }}
                className="px-6 py-2.5 bg-[#2A2723] text-white rounded-xl text-xs font-black hover:bg-black transition-all shrink-0 w-full md:w-auto cursor-pointer"
              >
                {isRTL ? "إعادة تعيين" : "Reset"}
              </button>
            </div>
          )}
        </div>

        {/* Type Filter Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-8 scrollbar-hide text-xs md:text-sm font-black" dir={isRTL ? 'rtl' : 'ltr'}>
          {[
            { id: 'all', ar: 'الكل', en: 'All' },
            { id: 'single', ar: 'استوديو سنجل (فردي)', en: 'Single Studio' },
            { id: 'double', ar: 'استوديو دبل (زوجي)', en: 'Double Studio' },
            { id: 'triple', ar: 'استوديو تريبل (ثلاثي)', en: 'Triple Studio' },
            { id: 'tworoom', ar: 'استوديو غرفتين', en: 'Two Rooms' },
          ].map((tab) => {
            const count = getCountForType(tab.id);
            if (count === 0 && tab.id !== 'all') return null;

            const isActive = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedType(tab.id)}
                className={`whitespace-nowrap px-6 py-3.5 rounded-full border transition-all duration-300 ${
                  isActive
                    ? 'bg-[#2A2723] text-white border-[#2A2723] shadow-md scale-105'
                    : 'bg-white text-[#5C554B] border-[#EAE4D9] hover:border-[#C1A68D] hover:text-[#C1A68D]'
                }`}
              >
                {isRTL ? tab.ar : tab.en} ({count})
              </button>
            );
          })}
        </div>

        {/* Available Count Badge */}
        {checkIn && checkOut && new Date(checkOut) > new Date(checkIn) && (
          <div className={`mb-8 p-4 bg-[#C1A68D]/10 text-[#C1A68D] border border-[#C1A68D]/20 rounded-2xl inline-flex items-center gap-3 font-bold text-sm ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
            <span>✨</span>
            <span>
              {isRTL 
                ? `وجدنا ${displayedStudios.length} استوديو متاح لهذه التواريخ` 
                : `Found ${displayedStudios.length} available studios for these dates`}
            </span>
          </div>
        )}

        {/* Units Grid */}
        {(() => {
          const getStudioRealNumber = (id: string) => {
            if (id.startsWith('b1-s')) {
              return parseInt(id.replace('b1-s', ''), 10) || 0;
            }
            if (id.startsWith('b2-s')) {
              return (parseInt(id.replace('b2-s', ''), 10) || 0) + 12;
            }
            return 999;
          };

          const sortedStudios = [...displayedStudios].sort((a, b) => {
            return getStudioRealNumber(a.id) - getStudioRealNumber(b.id);
          });

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
              {sortedStudios.map((unit: any) => (
                <UnitCard key={unit.id} unit={unit} checkIn={checkIn} checkOut={checkOut} />
              ))}
            </div>
          );
        })()}

        {displayedStudios.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-[#EAE4D9]/50 shadow-sm mt-8">
            <span className="text-4xl block mb-4">📭</span>
            <h3 className="text-xl font-bold text-[#2A2723]">
              {isRTL ? 'عذراً، لا توجد استوديوهات متاحة في هذه التواريخ.' : 'Sorry, no studios available for these dates.'}
            </h3>
            <p className="text-sm text-[#7A7061] mt-2">
              {isRTL ? 'جرب البحث بتواريخ أخرى.' : 'Try searching with different dates.'}
            </p>
          </div>
        )}

      </div>

      <Footer />
    </main>
  );
}
