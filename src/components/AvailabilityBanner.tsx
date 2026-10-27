'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LuxuryDateInput from '@/components/LuxuryDateInput';
import { 
  MagnifyingGlassIcon, 
  ArrowRightEndOnRectangleIcon, 
  ArrowLeftStartOnRectangleIcon, 
  HomeIcon, 
  InboxIcon 
} from '@heroicons/react/24/solid';

interface Unit {
  id: string;
  branch: number;
  type: string;
  title: { ar: string; en: string };
  status: string;
}

interface Booking {
  apartmentId: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

function getDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isUnitAvailableOnDate(unit: Unit, dateStr: string, bookings: Booking[]): boolean {
  if (unit.status !== 'متاح') return false;
  const nextDay = new Date(dateStr);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDayStr = nextDay.toISOString().split('T')[0];

  return !bookings.some((b) => {
    if (b.apartmentId !== unit.id) return false;
    if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
    return dateStr < b.checkOut && nextDayStr > b.checkIn;
  });
}

export default function AvailabilityBanner() {
  const router = useRouter();
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [checkIn, setCheckIn] = useState(getDateStr());
  const [checkOut, setCheckOut] = useState(getDateStr(1));
  const [unitType, setUnitType] = useState<'all' | 'studio' | 'apartment' | 'external'>('all');
  const [suggestedUnits, setSuggestedUnits] = useState<Unit[]>([]);
  const [searched, setSearched] = useState(false);

  const todayStr = getDateStr(0);
  const tomorrowStr = getDateStr(1);

  useEffect(() => {
    const load = async () => {
      try {
        const [unitsRes, bookingsRes] = await Promise.all([
          fetch('/api/units', { cache: 'no-store' }),
          fetch('/api/bookings', { cache: 'no-store' }),
        ]);
        const units = unitsRes.ok ? await unitsRes.json() : [];
        const bkgs = bookingsRes.ok ? await bookingsRes.json() : [];
        setAllUnits(units);
        setBookings(bkgs);
      } catch {/* silent */} finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const countAvailableOnDate = (dateStr: string, type?: string) => {
    return allUnits.filter((u) => {
      const typeMatch = !type || type === 'all'
        ? true
        : type === 'external'
          ? u.branch === 3
          : type === 'apartment'
            ? u.type === 'apartment'
            : u.type === 'studio' && u.branch !== 3;
      return typeMatch && isUnitAvailableOnDate(u, dateStr, bookings);
    }).length;
  };

  const handleSearch = () => {
    if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
      alert('يرجى إدخال تواريخ صحيحة (تاريخ الخروج بعد تاريخ الدخول)');
      return;
    }
    const filtered = allUnits.filter((u) => {
      const typeMatch = unitType === 'all'
        ? true
        : unitType === 'external'
          ? u.branch === 3
          : unitType === 'apartment'
            ? u.type === 'apartment'
            : u.type === 'studio' && u.branch !== 3;
      if (!typeMatch) return false;
      if (u.status !== 'متاح') return false;
      return !bookings.some((b) => {
        if (b.apartmentId !== u.id) return false;
        if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
        return checkIn < b.checkOut && checkOut > b.checkIn;
      });
    });
    setSuggestedUnits(filtered);
    setSearched(true);
  };

  const handleBookUnit = (unitId: string) => {
    router.push(`/mazar/book?unit=${unitId}&checkIn=${checkIn}&checkOut=${checkOut}`);
  };

  const todayCount = loaded ? countAvailableOnDate(todayStr) : null;
  const tomorrowCount = loaded ? countAvailableOnDate(tomorrowStr) : null;

  return (
    <section className="w-full max-w-7xl mx-auto px-4 md:px-6 py-12" dir="rtl">
      {/* Section Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-[#C1A68D]/10 border border-[#C1A68D]/30 px-5 py-2 rounded-full mb-4">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs font-black text-[#C1A68D] uppercase tracking-widest">متاح الآن</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-black text-[#2A2723] tracking-tight mb-3">
          احجز وحدتك الآن
        </h2>
        <p className="text-[#7A7061] font-bold text-sm md:text-base">
          اختر التاريخ ونوع الوحدة ونقترح عليك المتاح فوراً
        </p>
      </div>

      {/* Today / Tomorrow Availability Badges */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => {
            const today = todayStr;
            const tomorrow = tomorrowStr;
            setCheckIn(today);
            setCheckOut(tomorrow);
            // Search immediately
            const filtered = allUnits.filter((u) => {
              if (u.status !== 'متاح') return false;
              return !bookings.some((b) => {
                if (b.apartmentId !== u.id) return false;
                if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
                return today < b.checkOut && tomorrow > b.checkIn;
              });
            });
            setSuggestedUnits(filtered);
            setSearched(true);
          }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-2 border-green-300 rounded-2xl p-5 text-center shadow-sm transition-all active:scale-95 cursor-pointer group"
        >
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-black text-green-800 uppercase tracking-wider">متاح اليوم</span>
          </div>
          <div className="text-xs text-green-700 font-bold mb-3">{formatDisplayDate(todayStr)}</div>
          <div className="inline-flex items-center justify-center gap-1.5 bg-green-600 group-hover:bg-green-700 text-white font-black text-xs md:text-sm px-4 py-2.5 rounded-xl shadow-md transition-all">
            <span>تصفح المتاح اليوم</span>
            <span>➔</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            const tomorrow = tomorrowStr;
            const nextDay = getDateStr(2);
            setCheckIn(tomorrow);
            setCheckOut(nextDay);
            // Search immediately
            const filtered = allUnits.filter((u) => {
              if (u.status !== 'متاح') return false;
              return !bookings.some((b) => {
                if (b.apartmentId !== u.id) return false;
                if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
                return tomorrow < b.checkOut && nextDay > b.checkIn;
              });
            });
            setSuggestedUnits(filtered);
            setSearched(true);
          }}
          className="bg-gradient-to-br from-blue-50 to-sky-50 hover:from-blue-100 hover:to-sky-100 border-2 border-blue-300 rounded-2xl p-5 text-center shadow-sm transition-all active:scale-95 cursor-pointer group"
        >
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-black text-blue-800 uppercase tracking-wider">متاح غداً</span>
          </div>
          <div className="text-xs text-blue-700 font-bold mb-3">{formatDisplayDate(tomorrowStr)}</div>
          <div className="inline-flex items-center justify-center gap-1.5 bg-blue-600 group-hover:bg-blue-700 text-white font-black text-xs md:text-sm px-4 py-2.5 rounded-xl shadow-md transition-all">
            <span>تصفح المتاح غداً</span>
            <span>➔</span>
          </div>
        </button>
      </div>

      {/* Search Form */}
      <div className="bg-white border border-[#EAE4D9] rounded-3xl p-6 md:p-8 shadow-lg max-w-4xl mx-auto space-y-6">
        <h3 className="text-xl font-black text-[#2A2723] text-right flex items-center justify-end gap-2">
          اختر تاريخ الحجز ونوع الوحدة
          <MagnifyingGlassIcon className="w-5 h-5 text-[#C1A68D]" />
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Check In */}
          <div className="w-full">
            <LuxuryDateInput
              label="تاريخ الدخول"
              value={checkIn}
              min={todayStr}
              onChange={(val) => {
                setCheckIn(val);
                setSearched(false);
                if (val) {
                  const next = new Date(val);
                  next.setDate(next.getDate() + 1);
                  setCheckOut(next.toISOString().split('T')[0]);
                }
              }}
              isRTL={true}
            />
          </div>
          {/* Check Out */}
          <div className="w-full">
            <LuxuryDateInput
              label="تاريخ الخروج"
              value={checkOut}
              min={checkIn || todayStr}
              onChange={(val) => {
                setCheckOut(val);
                setSearched(false);
              }}
              isRTL={true}
            />
          </div>
          {/* Unit Type */}
          <div className="space-y-2">
            <label className="flex items-center justify-end gap-1.5 text-right text-[11px] font-black text-[#7A7061] uppercase tracking-wider">
              نوع الوحدة
              <HomeIcon className="w-4 h-4" />
            </label>
            <select
              value={unitType}
              onChange={(e) => { setUnitType(e.target.value as any); setSearched(false); }}
              className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#C1A68D] transition-all text-right text-[#2A2723]"
            >
              <option value="all">جميع الوحدات</option>
              <option value="studio">استوديو فندقي</option>
              <option value="apartment">شقة فندقية</option>
              <option value="external">شقة خارجية</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSearch}
          className="w-full bg-[#2A2723] text-white font-black py-4 rounded-2xl text-base hover:bg-black transition-all active:scale-95 shadow-md hover:shadow-xl flex items-center justify-center gap-2"
        >
          <MagnifyingGlassIcon className="w-5 h-5" />
          ابحث عن الوحدات المتاحة
        </button>

        {/* Search Results */}
        {searched && (
          <div className="pt-4 border-t border-[#F0EBE3] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-[#7A7061]">
                {suggestedUnits.length} وحدة متاحة في هذه التواريخ
              </span>
              <div className="flex items-center gap-2 text-xs font-bold text-[#2A2723]">
                <span className="bg-[#EAE4D9] px-3 py-1 rounded-full">{formatDisplayDate(checkIn)}</span>
                <span>←</span>
                <span className="bg-[#EAE4D9] px-3 py-1 rounded-full">{formatDisplayDate(checkOut)}</span>
              </div>
            </div>

            {suggestedUnits.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {suggestedUnits.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => handleBookUnit(unit.id)}
                    className="group flex flex-col items-end bg-[#FDFBF7] border border-[#EAE4D9] hover:border-[#C1A68D] rounded-2xl p-4 text-right transition-all hover:shadow-md active:scale-95"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      <span className="text-[10px] font-black text-green-600">متاح</span>
                    </div>
                    <span className="text-sm font-black text-[#2A2723] group-hover:text-[#C1A68D] transition-colors leading-tight">
                      {unit.title.ar}
                    </span>
                    <span className="mt-2 text-[10px] font-bold text-white bg-[#2A2723] group-hover:bg-[#C1A68D] px-3 py-1 rounded-full transition-colors">
                      احجز هذه الوحدة →
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#F7F5F0] rounded-2xl border border-dashed border-[#EAE4D9] flex flex-col items-center">
                <InboxIcon className="w-10 h-10 text-[#C1A68D] mb-3 opacity-50" />
                <p className="text-sm font-bold text-[#7A7061]">
                  لا توجد وحدات متاحة في هذه التواريخ. جرب تواريخ مختلفة.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
