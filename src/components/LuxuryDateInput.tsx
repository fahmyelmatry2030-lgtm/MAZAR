'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, X, Check } from 'lucide-react';

interface LuxuryDateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  isRTL?: boolean;
  required?: boolean;
  className?: string;
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const ARABIC_DAYS = [
  'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
];

export default function LuxuryDateInput({
  value,
  onChange,
  label,
  min,
  max,
  placeholder,
  isRTL = true,
  required = false,
  className = '',
}: LuxuryDateInputProps) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Convert YYYY-MM-DD -> DD / MM / YYYY for display
  const toDisplay = (val: string) => {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d} / ${m} / ${y}`;
    }
    return '';
  };

  const [rawText, setRawText] = useState(toDisplay(value));
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setRawText(toDisplay(value));
  }, [value]);

  // Handle user manual typing: DD / MM / YYYY
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const digits = inputVal.replace(/\D/g, '').slice(0, 8);

    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)} / ${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)} / ${digits.slice(2, 4)} / ${digits.slice(4)}`;
    }

    setRawText(formatted);

    if (digits.length === 8) {
      const d = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2, 4), 10);
      const y = parseInt(digits.slice(4, 8), 10);

      const daysInMonth = new Date(y, m, 0).getDate();
      if (m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth && y >= 2024 && y <= 2035) {
        setIsValid(true);
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        onChange(iso);
      } else {
        setIsValid(false);
      }
    } else if (digits.length === 0) {
      setIsValid(true);
      onChange('');
    }
  };

  const handleOpenPicker = () => {
    try {
      hiddenInputRef.current?.showPicker();
    } catch {
      hiddenInputRef.current?.focus();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRawText('');
    setIsValid(true);
    onChange('');
  };

  // Friendly date label preview
  let friendlyLabel = '';
  if (value && value.includes('-')) {
    const [y, m, d] = value.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      const dayName = ARABIC_DAYS[dateObj.getDay()];
      const monthName = ARABIC_MONTHS[m - 1];
      friendlyLabel = `${dayName}، ${d} ${monthName} ${y}`;
    }
  }

  const defaultPlaceholder = isRTL ? 'يوم / شهر / سنة' : 'DD / MM / YYYY';

  return (
    <div className={`space-y-1.5 ${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {label && (
        <label className={`block text-[11px] font-bold text-[#7A7061] uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
          {label}
        </label>
      )}

      <div className="relative group">
        <div className={`flex items-center bg-[#F7F5F0] border rounded-xl px-3.5 py-2.5 transition-all focus-within:bg-white focus-within:border-[#C1A68D] focus-within:ring-2 focus-within:ring-[#C1A68D]/20 ${
          !isValid ? 'border-red-400 bg-red-50/40' : 'border-[#EAE4D9]/80 hover:border-[#C1A68D]'
        }`}>
          {/* Calendar Picker Trigger Button */}
          <button
            type="button"
            onClick={handleOpenPicker}
            className="p-1.5 -ms-1 text-[#9E7A4A] hover:text-[#1A1816] hover:bg-stone-200/50 rounded-lg transition-all shrink-0 cursor-pointer"
            title={isRTL ? 'افتح التقويم لاختيار التاريخ' : 'Open calendar picker'}
          >
            <Calendar className="w-4 h-4" />
          </button>

          {/* Formatted Text Input (Day / Month / Year) */}
          <input
            type="text"
            inputMode="numeric"
            value={rawText}
            onChange={handleTextChange}
            placeholder={placeholder || defaultPlaceholder}
            className="w-full bg-transparent px-2 text-sm font-bold text-[#1A1816] placeholder:text-stone-400/80 outline-none text-center font-mono tracking-wider"
            dir="ltr"
            required={required}
          />

          {/* Clear or Valid Indicator */}
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-stone-400 hover:text-red-500 rounded-md transition-all shrink-0 cursor-pointer"
              title={isRTL ? 'مسح' : 'Clear'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
        </div>

        {/* Hidden Native Date Input for Picker Dialog */}
        <input
          ref={hiddenInputRef}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            onChange(e.target.value);
            setIsValid(true);
          }}
          className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      {/* Friendly Date Confirmation Badge */}
      {friendlyLabel ? (
        <div className={`flex items-center gap-1.5 text-[11px] font-semibold text-[#8C6B3E] ${isRTL ? 'text-right' : 'text-left'} px-1 animate-fadeIn`}>
          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>{friendlyLabel}</span>
        </div>
      ) : !isValid ? (
        <div className={`text-[10px] font-bold text-red-600 ${isRTL ? 'text-right' : 'text-left'} px-1`}>
          {isRTL ? 'يرجى كتابة التاريخ بتنسيق: يوم / شهر / سنة' : 'Please enter date as DD / MM / YYYY'}
        </div>
      ) : (
        <div className={`text-[10px] text-stone-400 font-medium ${isRTL ? 'text-right' : 'text-left'} px-1`}>
          {isRTL ? 'التنسيق: يوم / شهر / سنة' : 'Format: Day / Month / Year'}
        </div>
      )}
    </div>
  );
}
