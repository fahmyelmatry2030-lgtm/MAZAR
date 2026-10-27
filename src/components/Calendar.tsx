'use client';
import React, { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface CalendarProps {
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  activeTab: 'checkIn' | 'checkOut';
  onSelect: (checkIn: string, checkOut: string) => void;
  bookedDates?: string[];
}

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Week starts on Saturday for Egypt/Middle East
const AR_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const EN_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function Calendar({
  checkIn,
  checkOut,
  activeTab,
  onSelect,
  bookedDates = []
}: CalendarProps) {
  const { isRTL, language } = useLanguage();
  
  // Initialize to check-in month if present, else today
  const [currentDate, setCurrentDate] = useState(() => {
    if (checkIn) {
      const parts = checkIn.split('-').map(Number);
      if (parts.length === 3) return new Date(parts[0], parts[1] - 1, 1);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month offset (Saturday = 0)
  // JS getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
  // For Sat = 0: (getDay() + 1) % 7
  const jsDay = new Date(year, month, 1).getDay();
  const firstDayOffset = (jsDay + 1) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const toIso = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleDateClick = (day: number) => {
    const clickedIso = toIso(day);

    if (activeTab === 'checkIn') {
      if (checkOut && clickedIso >= checkOut) {
        onSelect(clickedIso, '');
      } else {
        onSelect(clickedIso, checkOut);
      }
    } else {
      // Selecting Check-Out
      if (!checkIn || clickedIso <= checkIn) {
        // If clicking before or without checkIn, treat as new checkIn
        onSelect(clickedIso, '');
      } else {
        onSelect(checkIn, clickedIso);
      }
    }
  };

  const isCheckInDay = (day: number) => toIso(day) === checkIn;
  const isCheckOutDay = (day: number) => toIso(day) === checkOut;

  const isInRange = (day: number) => {
    if (!checkIn || !checkOut) return false;
    const iso = toIso(day);
    return iso > checkIn && iso < checkOut;
  };

  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isBooked = (day: number) => {
    return bookedDates.includes(toIso(day));
  };

  const daysLabels = isRTL ? AR_DAYS : EN_DAYS;
  const monthTitle = isRTL ? `${AR_MONTHS[month]} ${year}` : `${EN_MONTHS[month]} ${year}`;

  return (
    <div className="w-full bg-[#FAF8F5] p-5 sm:p-7 rounded-2xl border border-[#EAE5DC] select-none" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Month Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          type="button"
          onClick={isRTL ? nextMonth : prevMonth}
          className="w-9 h-9 rounded-xl border border-[#EAE5DC] bg-white hover:bg-stone-100 flex items-center justify-center transition-all cursor-pointer shadow-xs text-[#1A1816]"
          title={isRTL ? 'الشهر السابق' : 'Previous Month'}
        >
          {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <h3 className="text-base sm:text-lg font-black text-[#1A1816] tracking-wide">
          {monthTitle}
        </h3>

        <button
          type="button"
          onClick={isRTL ? prevMonth : nextMonth}
          className="w-9 h-9 rounded-xl border border-[#EAE5DC] bg-white hover:bg-stone-100 flex items-center justify-center transition-all cursor-pointer shadow-xs text-[#1A1816]"
          title={isRTL ? 'الشهر التالي' : 'Next Month'}
        >
          {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 mb-3 text-center">
        {daysLabels.map((lbl, i) => (
          <div key={i} className="text-[11px] font-bold text-[#8C6B3E] uppercase tracking-wider py-1">
            {lbl}
          </div>
        ))}
      </div>

      {/* Day Cells Grid */}
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {/* Leading empty spaces */}
        {Array.from({ length: firstDayOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-11 sm:h-12" />
        ))}

        {/* Days of current month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const checkInActive = isCheckInDay(day);
          const checkOutActive = isCheckOutDay(day);
          const rangeActive = isInRange(day);
          const past = isPast(day);
          const booked = isBooked(day);
          const disabled = past || booked;

          let cellStyle = 'bg-transparent text-[#1A1816] hover:bg-white hover:shadow-xs';
          if (checkInActive || checkOutActive) {
            cellStyle = 'bg-[#1A1816] text-white font-black shadow-md scale-105 z-10';
          } else if (rangeActive) {
            cellStyle = 'bg-[#9E7A4A]/20 text-[#1A1816] font-bold rounded-none';
          } else if (disabled) {
            cellStyle = 'text-stone-300 opacity-40 cursor-not-allowed line-through';
          }

          return (
            <div
              key={day}
              onClick={() => !disabled && handleDateClick(day)}
              className={`relative h-11 sm:h-12 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${cellStyle} ${
                !disabled ? 'cursor-pointer' : ''
              }`}
            >
              <span>{day}</span>

              {/* Check-In / Check-Out Small Tag */}
              {checkInActive && (
                <span className="absolute -bottom-1 text-[8px] font-bold text-[#9E7A4A] bg-white px-1 rounded-sm shadow-xs border border-[#EAE5DC]">
                  {isRTL ? 'وصول' : 'In'}
                </span>
              )}
              {checkOutActive && (
                <span className="absolute -bottom-1 text-[8px] font-bold text-rose-600 bg-white px-1 rounded-sm shadow-xs border border-[#EAE5DC]">
                  {isRTL ? 'مغادرة' : 'Out'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
