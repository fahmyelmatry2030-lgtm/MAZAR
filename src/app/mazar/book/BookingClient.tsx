'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LuxuryDateInput from '@/components/LuxuryDateInput';
import Calendar from '@/components/Calendar';
import { useLanguage } from '@/lib/LanguageContext';
import { processAndUploadReceipt, processAndUploadDocument } from '@/lib/uploadHelper';
import { formatDateDMY } from '@/lib/utils';
import {
  Building2,
  Calendar as CalendarIcon,
  User,
  Phone,
  Users,
  CreditCard,
  ShieldCheck,
  Check,
  Copy,
  UploadCloud,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  AlertCircle,
  RefreshCw,
  X,
  Bed,
  Wifi,
  Tv,
  ExternalLink,
  ChevronDown,
  Bath,
  Wind
} from 'lucide-react';

// ─── Real Photos Fallback Mapping ───
export const getUnitPhotos = (unit: any): string[] => {
  if (unit?.images && Array.isArray(unit.images) && unit.images.length > 0) {
    return unit.images;
  }
  const id = String(unit?.id || '').toLowerCase();
  if (id.startsWith('b1-s')) {
    return [
      '/images/mazar1/2026-1.jpeg',
      '/images/mazar1/2026.jpeg',
      '/images/mazar1/mazar1-hero.jpg',
      '/images/mazar1/WhatsApp-Image-2025-12-15-at-12.39.24_989640c4.jpg',
    ];
  }
  if (id.startsWith('b2-s')) {
    return [
      '/images/mazar2/20260218_015423.jpg',
      '/images/mazar2/20260218_015425.jpg',
      '/images/mazar2/20260218_023924.jpg',
      '/images/mazar2/20260218_171702.jpg',
    ];
  }
  if (id.startsWith('apt-')) {
    const num = id.replace('apt-', '');
    return [`/apartments/apt${num}.png`, '/apartments/apt1.png'];
  }
  return ['/images/mazar2/20260218_015423.jpg', '/images/mazar1/mazar1-hero.jpg'];
};

// ─── Unit Specifications Helper ───
export const getUnitSpecs = (unit: any, isRTL: boolean) => {
  const id = String(unit?.id || '').toLowerCase();
  const title = String(unit?.title?.ar || unit?.title?.en || id).toLowerCase();

  if (id.startsWith('apt-')) {
    return {
      capacity: isRTL ? 'حتى 6 أفراد' : 'Up to 6 Guests',
      beds: isRTL ? '3 غرف نوم ماستر • صالة ومطبخ' : '3 Bedrooms • Living & Kitchen',
      badge: isRTL ? 'شقة فندقية ملكية' : 'Royal Apartment',
      branch: isRTL ? 'الفرع الأول - الحي السابع' : 'Branch 1 - 7th District'
    };
  }

  if (title.includes('تريبل') || id.includes('triple') || ['b1-s4', 'b2-s2', 'b2-s3', 'b2-s4', 'b2-s7', 'b2-s9', 'b2-s10', 'b2-s11'].includes(id)) {
    return {
      capacity: isRTL ? 'حتى 3 نزلاء' : 'Up to 3 Guests',
      beds: isRTL ? '1 سرير كينج ماستر + 1 سرير فردي' : '1 King Bed + 1 Single Bed',
      badge: isRTL ? 'استوديو تريبل بريميوم' : 'Premium Triple Studio',
      branch: unit?.branch === 1 ? (isRTL ? 'الفرع الأول - الحي السابع' : 'Branch 1') : (isRTL ? 'الفرع الثاني - النزهة' : 'Branch 2')
    };
  }

  if (title.includes('دبل') || id.includes('double') || ['b1-s1', 'b1-s5', 'b1-s9', 'b1-s10', 'b1-s11', 'b1-s12', 'b2-s1', 'b2-s6', 'b2-s8', 'b2-s12'].includes(id)) {
    return {
      capacity: isRTL ? 'شخصين (زوجي)' : '2 Guests (Couple)',
      beds: isRTL ? '1 سرير كينج ماستر كبير' : '1 Grand King Master Bed',
      badge: isRTL ? 'استوديو دبل كينج' : 'King Double Studio',
      branch: unit?.branch === 1 ? (isRTL ? 'الفرع الأول - الحي السابع' : 'Branch 1') : (isRTL ? 'الفرع الثاني - النزهة' : 'Branch 2')
    };
  }

  return {
    capacity: isRTL ? 'فرد أو فردين' : '1 - 2 Guests',
    beds: isRTL ? '1 سرير فندقي كينج مريح' : '1 Comfortable Hotel Bed',
    badge: isRTL ? 'استوديو سنجل تنفيذي' : 'Executive Studio',
    branch: unit?.branch === 1 ? (isRTL ? 'الفرع الأول - الحي السابع' : 'Branch 1') : (isRTL ? 'الفرع الثاني - النزهة' : 'Branch 2')
  };
};

export default function BookingPage() {
  const { t, isRTL, language } = useLanguage();

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [checkIn, setCheckIn] = useState(getTodayStr());
  const [checkOut, setCheckOut] = useState(getTomorrowStr());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guestsCount, setGuestsCount] = useState(1);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [showUnitSelectorModal, setShowUnitSelectorModal] = useState(false);
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [bookedDates, setBookedDates] = useState<string[]>([]);

  // Payment & Receipts
  const [paymentMethod, setPaymentMethod] = useState<'instapay_bank' | 'visa' | 'whatsapp'>('instapay_bank');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [idDocUrl, setIdDocUrl] = useState('');
  const [isUploadingIdDoc, setIsUploadingIdDoc] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ADMIN_WHATSAPP = '201108109969';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const getSafeUnitPrice = (unit: any): number => {
    if (!unit) return 3000;
    const num = parseInt(String(unit.price || '').replace(/[^0-9]/g, ''), 10) || 0;
    if (num >= 1000) return num;
    const idStr = String(unit.id || '').toLowerCase();
    if (idStr.startsWith('apt-') || idStr.startsWith('ext-')) return 4000;
    return 3000;
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const unitParam = params.get('unit');
        const checkInParam = params.get('checkIn');
        const checkOutParam = params.get('checkOut');

        if (checkInParam) setCheckIn(checkInParam);
        if (checkOutParam) setCheckOut(checkOutParam);

        const res = await fetch('/api/units');
        const unitsData = res.ok ? await res.json() : [];
        const activeUnits = unitsData.filter((u: any) => u.status === 'متاح' || !u.status);
        setAllUnits(activeUnits);

        if (unitParam) {
          setSelectedUnitId(unitParam);
        } else if (activeUnits.length > 0) {
          setSelectedUnitId(activeUnits[0].id);
        }
      } catch (err) {
        console.error('Failed to load units:', err);
      }
    };
    init();
  }, []);

  // Fetch booked dates for current unit
  useEffect(() => {
    if (selectedUnitId) {
      const fetchBooked = async () => {
        try {
          const res = await fetch('/api/bookings', { cache: 'no-store' });
          if (!res.ok) return;
          const allBookings = await res.json();
          const unitBooked = allBookings
            .filter((b: any) => {
              if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
              const bApt = String(b.apartmentId || b.apartment_id || '').trim().toLowerCase();
              const bStudio = String(b.studio || '').trim().toLowerCase();
              const target = String(selectedUnitId).trim().toLowerCase();
              const titleAr = String(selectedUnit?.title?.ar || '').trim().toLowerCase();
              return bApt === target || bStudio === target || (titleAr && (bApt === titleAr || bStudio === titleAr));
            })
            .flatMap((b: any) => {
              const dates: string[] = [];
              let current = new Date(b.checkIn);
              const end = new Date(b.checkOut);
              while (current < end) {
                dates.push(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
              }
              return dates;
            });
          setBookedDates(unitBooked);
        } catch {
          setBookedDates([]);
        }
      };
      fetchBooked();
    }
  }, [selectedUnitId]);

  // Financial calculations
  const selectedUnit = allUnits.find((u: any) => u.id === selectedUnitId);
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  const pricePerNight = getSafeUnitPrice(selectedUnit);
  const totalAmount = nights * pricePerNight;
  const depositRequired = pricePerNight; // Strict rule: 1-night deposit to confirm
  const remainingOnArrival = Math.max(0, totalAmount - depositRequired);

  const selectedUnitPhotos = getUnitPhotos(selectedUnit);
  const selectedUnitSpecs = getUnitSpecs(selectedUnit, isRTL);

  const setDurationNights = (n: number) => {
    if (!checkIn) {
      const today = getTodayStr();
      setCheckIn(today);
      const out = new Date(today);
      out.setDate(out.getDate() + n);
      setCheckOut(out.toISOString().split('T')[0]);
    } else {
      const out = new Date(checkIn);
      out.setDate(out.getDate() + n);
      setCheckOut(out.toISOString().split('T')[0]);
    }
  };

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUnitId) {
      alert(isRTL ? 'يرجى اختيار الجناح الفندقي أولاً' : 'Please select a unit');
      return;
    }
    if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
      alert(isRTL ? 'يرجى التأكد من تاريخي الوصول والمغادرة' : 'Please select valid arrival and departure dates');
      return;
    }
    if (!name.trim()) {
      alert(isRTL ? 'يرجى كتابة اسم النزيل بالكامل' : 'Please enter full name');
      return;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      alert(isRTL ? 'يرجى إدخال رقم هاتف صحيح للتواصل' : 'Please enter a valid phone number');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const unitTitleAr = selectedUnit?.title?.[language] || selectedUnit?.title?.ar || selectedUnitId;

    const bookingPayload = {
      name,
      phone,
      checkIn,
      checkOut,
      numberOfDays: nights,
      pricePerNight,
      totalAmount,
      depositAmount: depositRequired,
      remainingAmount: remainingOnArrival,
      idNumber: idDocUrl || null,
      apartmentId: selectedUnitId,
      studio: unitTitleAr,
      branch: selectedUnit?.branch || 1,
      paymentMethod,
      receiptUrl: receiptUrl || null,
      dates: `${checkIn} - ${checkOut}`,
      guest: name,
      guestsCount,
      notes: `حجز مباشر سهل وسريع. عربون ليلة واحدة مطلوب: ${depositRequired} ج.م`
    };

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        throw new Error('فشل إرسال طلب الحجز، يرجى المحاولة مرة أخرى.');
      }

      setIsSuccess(true);

      const textMsg =
        `*طلب حجز فندقي مؤكد — مجمع مزار*\n\n` +
        `👤 *الاسم:* ${name}\n` +
        `📱 *الهاتف:* ${phone}\n` +
        `👥 *عدد الضيوف:* ${guestsCount}\n` +
        `🏨 *الجناح:* ${selectedUnit ? (selectedUnit.title?.[language] || selectedUnitId) : selectedUnitId}\n` +
        `📅 *المواعيد:* من ${formatDateDMY(checkIn)} إلى ${formatDateDMY(checkOut)} (${nights} ليالي)\n` +
        `💵 *إجمالي الاستضافة:* ${totalAmount.toLocaleString()} ج.م (${nights} ليالي × ${pricePerNight.toLocaleString()} ج.م)\n` +
        `💳 *عربون التأكيد (ليلة واحدة):* ${depositRequired.toLocaleString()} ج.م\n` +
        `🏨 *المتبقي عند الوصول:* ${remainingOnArrival.toLocaleString()} ج.م\n` +
        `📝 *طريقة السداد:* ${paymentMethod === 'instapay_bank' ? 'إنستاباي / تحويل بنكي' : paymentMethod === 'visa' ? 'بطاقة بنكية' : 'عند الوصول'}\n` +
        (receiptUrl ? `📎 *إشعار التحويل:* ${receiptUrl}\n` : '') +
        (idDocUrl ? `🪪 *إثبات الهوية:* ${idDocUrl}\n` : '');

      window.open(`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}&text=${encodeURIComponent(textMsg)}`, '_blank');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تأكيد الحجز');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen
  if (isSuccess) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] text-[#1A1816] flex flex-col justify-center items-center p-6 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-white p-8 md:p-12 rounded-3xl border border-[#EAE5DC] shadow-xl text-center max-w-lg w-full">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 border border-emerald-100">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-[#1A1816] mb-2 tracking-tight">
            {isRTL ? 'تم تأكيد طلب حجزك بنجاح!' : 'Booking Requested Successfully!'}
          </h2>
          <p className="text-xs sm:text-sm text-[#7A7265] mb-6">
            {isRTL ? 'شكراً لاختيارك مجمع مزار. تم تجهيز تفاصيل الحجز وتم إرسالها لقسم الاستقبال.' : 'Thank you for choosing Mazar. Your stay details have been sent to concierge.'}
          </p>

          <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EAE5DC] text-right space-y-3 mb-6 text-xs">
            <div className="flex justify-between items-center font-bold">
              <span className="text-stone-500">الجناح:</span>
              <span className="text-[#1A1816] font-black">{selectedUnit?.title?.[language] || selectedUnitId}</span>
            </div>
            <div className="flex justify-between items-center font-bold">
              <span className="text-stone-500">مواعيد الإقامة:</span>
              <span className="font-mono text-[#1A1816]">{formatDateDMY(checkIn)} ➔ {formatDateDMY(checkOut)} ({nights} ليالٍ)</span>
            </div>
            <div className="flex justify-between items-center font-bold pt-2 border-t border-[#EAE5DC]">
              <span className="text-stone-500">عربون التأكيد (ليلة واحدة):</span>
              <span className="text-sm font-black text-[#9E7A4A]">{depositRequired.toLocaleString()} ج.م</span>
            </div>
            <div className="flex justify-between items-center font-bold">
              <span className="text-stone-500">المتبقي عند تسجيل الوصول:</span>
              <span className="text-[#1A1816]">{remainingOnArrival.toLocaleString()} ج.م</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isRTL ? 'متابعة الحجز على واتساب' : 'Open WhatsApp'}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <Link
              href="/"
              className="bg-[#FAF8F5] hover:bg-stone-100 text-[#1A1816] font-bold py-3.5 px-6 rounded-xl text-xs transition-all border border-[#EAE5DC]"
            >
              {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-[#1A1816] selection:bg-[#9E7A4A] selection:text-white font-sans antialiased" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-50 w-full bg-[#FAF8F5]/95 backdrop-blur-xl border-b border-[#EAE5DC]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-18 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={42} mdSize={48} />
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black text-[#1A1816] tracking-tight">
                مجمع مزار
              </span>
              <span className="text-[10px] text-[#9E7A4A] font-bold uppercase tracking-wider">
                Hotel Suites & Apartments
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <a
              href={`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1816] text-[#FAF8F5] text-xs font-bold hover:bg-black transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-mono text-[11px]" dir="ltr">01108109969</span>
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* ─── ONE-PAGE EXPRESS FORM CONTAINER ─── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Page Title */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-1.5 bg-white border border-[#EAE5DC] px-3 py-1 rounded-full text-[11px] font-bold text-[#9E7A4A] shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRTL ? 'حجز فوري ومباشر في دقيقة واحدة' : 'Instant 1-Minute Booking'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#1A1816] tracking-tight">
            {isRTL ? 'إتمام حجز الجناح الفندقي' : 'Complete Your Reservation'}
          </h1>
          <p className="text-xs sm:text-sm text-[#7A7265] max-w-lg mx-auto">
            {isRTL 
              ? 'نموذج حجز فندقي موحد وسهل يضم كافة التفاصيل في صفحة واحدة، مع تأكيد الحجز بعربون ليلة واحدة فقط.'
              : 'Unified easy booking form in one place with 1-night deposit to secure.'}
          </p>
        </div>

        <form onSubmit={handleConfirmReservation} className="space-y-6">

          {/* ══════════════════════════════════════════════════════════════
              PART 1: الجناح الفندقي المختار (مع زر سريع للتغيير)
          ══════════════════════════════════════════════════════════════ */}
          <div className="bg-white p-5 sm:p-7 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE5DC] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#1A1816] text-white flex items-center justify-center text-xs font-bold">1</span>
                <h2 className="font-black text-base text-[#1A1816]">
                  {isRTL ? 'الجناح الفندقي المختار' : 'Selected Suite'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowUnitSelectorModal(true)}
                className="text-xs font-bold text-[#9E7A4A] hover:text-[#1A1816] bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#EAE5DC] flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>{isRTL ? 'تغيير الجناح' : 'Change Suite'}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {selectedUnit ? (
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center bg-[#FAF8F5] p-4 rounded-xl border border-[#EAE5DC]">
                <div className="w-full sm:w-36 h-28 sm:h-24 rounded-lg overflow-hidden shrink-0 border border-[#EAE5DC]">
                  <img
                    src={selectedUnitPhotos[0]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-[#1A1816]">
                      {selectedUnit.title?.[language] || selectedUnit.id}
                    </span>
                    <span className="text-[10px] font-bold bg-white text-[#9E7A4A] px-2 py-0.5 rounded border border-[#EAE5DC]">
                      {selectedUnitSpecs.badge}
                    </span>
                  </div>

                  <div className="text-xs text-[#5C554B] flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#9E7A4A]" /> {selectedUnitSpecs.capacity}
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="flex items-center gap-1">
                      <Bed className="w-3.5 h-3.5 text-[#9E7A4A]" /> {selectedUnitSpecs.beds}
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#9E7A4A]" /> {selectedUnitSpecs.branch}
                    </span>
                  </div>

                  <div className="text-xs text-stone-500 pt-1">
                    {isRTL ? 'سعر الليلة:' : 'Nightly rate:'}{' '}
                    <strong className="text-sm font-black text-[#1A1816]">{pricePerNight.toLocaleString()} ج.م</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-stone-400 text-xs">
                {isRTL ? 'جارٍ تحميل الأجنحة المتاحة...' : 'Loading suites...'}
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              PART 2: مواعيد الإقامة (تنسيق يوم/شهر/سنة وحساب الليالي)
          ══════════════════════════════════════════════════════════════ */}
          <div className="bg-white p-5 sm:p-7 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex items-center justify-between border-b border-[#EAE5DC] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#1A1816] text-white flex items-center justify-center text-xs font-bold">2</span>
                <h2 className="font-black text-base text-[#1A1816]">
                  {isRTL ? 'مواعيد الإقامة (يوم / شهر / سنة)' : 'Stay Dates (DD / MM / YYYY)'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowCalendarView(!showCalendarView)}
                className="text-xs font-bold text-[#5C554B] hover:text-[#1A1816] flex items-center gap-1 cursor-pointer"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-[#9E7A4A]" />
                <span>{showCalendarView ? (isRTL ? 'إخفاء التقويم' : 'Hide Calendar') : (isRTL ? 'عرض التقويم' : 'Show Calendar')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <LuxuryDateInput
                label={isRTL ? 'تاريخ الوصول (تسجيل الدخول من 14:00)' : 'Check-In Date (from 14:00)'}
                value={checkIn}
                min={getTodayStr()}
                onChange={(val) => {
                  setCheckIn(val);
                  if (val && checkOut && new Date(checkOut) <= new Date(val)) {
                    const next = new Date(val);
                    next.setDate(next.getDate() + 1);
                    setCheckOut(next.toISOString().split('T')[0]);
                  }
                }}
                isRTL={isRTL}
              />

              <LuxuryDateInput
                label={isRTL ? 'تاريخ المغادرة (تسجيل الخروج حتى 12:00)' : 'Check-Out Date (until 12:00)'}
                value={checkOut}
                min={checkIn || getTodayStr()}
                onChange={(val) => setCheckOut(val)}
                isRTL={isRTL}
              />
            </div>

            {/* Stay Duration Bar & Quick Chips */}
            <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#EAE5DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1A1816]">
                <Clock className="w-4 h-4 text-[#9E7A4A]" />
                <span>{isRTL ? 'مدة الإقامة المحسوبة:' : 'Stay Duration:'}</span>
                <span className="bg-white px-2.5 py-0.5 rounded-md border border-[#EAE5DC] text-[#9E7A4A] font-black font-mono">
                  {nights} {nights === 1 ? (isRTL ? 'ليلة واحدة' : 'Night') : (isRTL ? 'ليالٍ' : 'Nights')}
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[10px] text-stone-400 font-semibold">{isRTL ? 'اختيار سريع:' : 'Quick:'}</span>
                {[
                  { label: isRTL ? 'ليلة' : '1N', n: 1 },
                  { label: isRTL ? 'ليلتين' : '2N', n: 2 },
                  { label: isRTL ? '3 ليالٍ' : '3N', n: 3 },
                  { label: isRTL ? 'أسبوع' : '7N', n: 7 },
                ].map((item) => (
                  <button
                    key={item.n}
                    type="button"
                    onClick={() => setDurationNights(item.n)}
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition-all cursor-pointer ${
                      nights === item.n
                        ? 'bg-[#1A1816] text-white border-[#1A1816]'
                        : 'bg-white text-[#5C554B] border-[#EAE5DC] hover:border-stone-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Embedded Calendar */}
            {showCalendarView && (
              <div className="pt-2 animate-fade-in">
                <Calendar
                  checkIn={checkIn}
                  checkOut={checkOut}
                  activeTab="checkIn"
                  bookedDates={bookedDates}
                  onSelect={(inDate, outDate) => {
                    setCheckIn(inDate);
                    setCheckOut(outDate);
                  }}
                />
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              PART 3: بيانات الضيف (الاسم والهاتف وعدد النزلاء)
          ══════════════════════════════════════════════════════════════ */}
          <div className="bg-white p-5 sm:p-7 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EAE5DC] pb-3">
              <span className="w-6 h-6 rounded-lg bg-[#1A1816] text-white flex items-center justify-center text-xs font-bold">3</span>
              <h2 className="font-black text-base text-[#1A1816]">
                {isRTL ? 'بيانات النزيل الأساسية' : 'Guest Information'}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#1A1816]">
                  {isRTL ? 'الاسم بالكامل (كما في الهوية)' : 'Full Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRTL ? 'مثال: أحمد محمد' : 'e.g. John Doe'}
                  className="w-full bg-[#FAF8F5] border border-[#EAE5DC] rounded-xl px-3.5 py-3 text-sm font-semibold outline-none focus:border-[#1A1816] focus:bg-white transition-all text-[#1A1816]"
                />
              </div>

              {/* Phone / WhatsApp */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#1A1816]">
                  {isRTL ? 'رقم الهاتف / واتساب لتأكيد الحجز' : 'Phone / WhatsApp'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full bg-[#FAF8F5] border border-[#EAE5DC] rounded-xl px-3.5 py-3 text-sm font-semibold outline-none focus:border-[#1A1816] focus:bg-white transition-all text-[#1A1816] font-mono text-right"
                />
              </div>
            </div>

            {/* Guests Count Pills */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-[#1A1816]">
                {isRTL ? 'عدد النزلاء:' : 'Number of Guests:'}
              </label>
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGuestsCount(num)}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      guestsCount === num
                        ? 'bg-[#1A1816] text-white border-[#1A1816]'
                        : 'bg-[#FAF8F5] text-[#5C554B] border-[#EAE5DC] hover:border-stone-400'
                    }`}
                  >
                    {num} {num === 1 ? (isRTL ? 'فرد' : '') : (isRTL ? 'أفراد' : '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional ID Upload */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#1A1816]">
                  {isRTL ? 'إثبات الشخصية (بطاقة أو جواز)' : 'ID / Passport'}
                </label>
                <span className="text-[10px] text-stone-400">
                  {isRTL ? '(اختياري — يمكن تقديمه عند الوصول)' : '(Optional)'}
                </span>
              </div>

              {idDocUrl ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {isRTL ? 'تم رفع صورة الإثبات بنجاح' : 'ID Uploaded'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIdDocUrl('')}
                    className="text-rose-600 text-[10px] hover:underline cursor-pointer"
                  >
                    {isRTL ? 'حذف' : 'Remove'}
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#EAE5DC] hover:border-[#9E7A4A] bg-[#FAF8F5] cursor-pointer text-xs font-bold text-[#5C554B] hover:text-[#1A1816] transition-all">
                  <UploadCloud className="w-4 h-4 text-[#9E7A4A]" />
                  <span>{isUploadingIdDoc ? (isRTL ? 'جارٍ الرفع...' : 'Uploading...') : (isRTL ? 'انقر لرفع صورة البطاقة / الجواز' : 'Click to attach ID')}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingIdDoc(true);
                      try {
                        const url = await processAndUploadDocument(file);
                        setIdDocUrl(url);
                      } catch {
                        alert('فشل رفع الملف');
                      } finally {
                        setIsUploadingIdDoc(false);
                      }
                    }}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              PART 4: تأكيد الحجز والعربون (ليلة واحدة) وحسابات الشركة
          ══════════════════════════════════════════════════════════════ */}
          <div className="bg-white p-5 sm:p-7 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex items-center gap-2 border-b border-[#EAE5DC] pb-3">
              <span className="w-6 h-6 rounded-lg bg-[#1A1816] text-white flex items-center justify-center text-xs font-bold">4</span>
              <h2 className="font-black text-base text-[#1A1816]">
                {isRTL ? 'تأكيد الحجز وعربون الإقامة (ليلة واحدة)' : 'Deposit & Payment'}
              </h2>
            </div>

            {/* Financial Summary Banner */}
            <div className="bg-[#1A1816] text-white p-5 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <span className="text-[11px] text-[#C1A68D] font-bold block">
                    {isRTL ? 'عربون تأكيد الحجز المطلوب الآن:' : 'Confirmation Deposit (Due Now):'}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-0.5">
                    {depositRequired.toLocaleString()} <span className="text-xs font-normal text-stone-300">ج.م (قيمة ليلة واحدة)</span>
                  </div>
                </div>

                <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 text-right sm:text-left text-xs font-semibold">
                  <div className="text-stone-400 text-[10px]">{isRTL ? 'إجمالي الإقامة:' : 'Total Stay:'}</div>
                  <div className="font-mono text-white">{totalAmount.toLocaleString()} ج.م ({nights} ليالٍ)</div>
                  <div className="text-emerald-400 text-[10px] mt-0.5">{isRTL ? `المتبقي عند الوصول: ${remainingOnArrival.toLocaleString()} ج.م` : `Due at check-in: ${remainingOnArrival} EGP`}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-stone-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{isRTL ? 'الحجز مؤكد وفوري من إدارة مجمع مزار مباشرة بدون أي وسيط أو عمولات.' : 'Direct booking with zero intermediary commissions.'}</span>
              </div>
            </div>

            {/* Bank Accounts & InstaPay with 1-click copy */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#1A1816] flex justify-between items-center">
                <span>{isRTL ? 'الحسابات الرسمية المعتمدة لتحويل العربون:' : 'Official Payment Accounts:'}</span>
                <span className="text-[10px] text-stone-400">{isRTL ? 'انقر على الرقم لنسخه' : 'Click to copy'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* NBE Bank */}
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC] space-y-1.5">
                  <span className="text-[10px] font-black text-[#9E7A4A] block">البنك الأهلي المصري (NBE)</span>
                  <div className="text-xs font-bold text-[#1A1816] truncate">مدحت عز الدين</div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('1683071192994900010', 'nbe')}
                    className="w-full flex items-center justify-between text-xs font-mono font-bold bg-white px-2 py-1.5 rounded-md border border-[#EAE5DC] text-[#1A1816] hover:text-[#9E7A4A] transition-all cursor-pointer"
                  >
                    <span className="truncate">1683071192994900010</span>
                    {copiedKey === 'nbe' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                  </button>
                </div>

                {/* InstaPay */}
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC] space-y-1.5">
                  <span className="text-[10px] font-black text-[#9E7A4A] block">إنستاباي (InstaPay)</span>
                  <div className="text-xs font-bold text-[#1A1816]">تحويل فوري</div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('01005318003', 'instapay')}
                    className="w-full flex items-center justify-between text-xs font-mono font-bold bg-white px-2 py-1.5 rounded-md border border-[#EAE5DC] text-[#1A1816] hover:text-[#9E7A4A] transition-all cursor-pointer"
                  >
                    <span>01005318003</span>
                    {copiedKey === 'instapay' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                  </button>
                </div>

                {/* Vodafone Cash */}
                <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC] space-y-1.5">
                  <span className="text-[10px] font-black text-[#9E7A4A] block">فودافون كاش (Vodafone)</span>
                  <div className="text-xs font-bold text-[#1A1816]">محفظة إلكترونية</div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('01021691745', 'vodafone')}
                    className="w-full flex items-center justify-between text-xs font-mono font-bold bg-white px-2 py-1.5 rounded-md border border-[#EAE5DC] text-[#1A1816] hover:text-[#9E7A4A] transition-all cursor-pointer"
                  >
                    <span>01021691745</span>
                    {copiedKey === 'vodafone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Transfer Receipt Upload */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#1A1816]">
                  {isRTL ? 'إيصال أو سكرين شوت التحويل' : 'Transfer Receipt'}
                </label>
                <span className="text-[10px] text-stone-400">
                  {isRTL ? '(اختياري ويمكن إرساله على واتساب)' : '(Optional via WhatsApp)'}
                </span>
              </div>

              {receiptUrl ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {isRTL ? 'تم إرفاق إيصال التحويل' : 'Receipt attached'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReceiptUrl('')}
                    className="text-rose-600 text-[10px] hover:underline cursor-pointer"
                  >
                    {isRTL ? 'حذف' : 'Remove'}
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-[#EAE5DC] hover:border-[#9E7A4A] bg-[#FAF8F5] cursor-pointer text-xs font-bold text-[#5C554B] hover:text-[#1A1816] transition-all">
                  <UploadCloud className="w-4 h-4 text-[#9E7A4A]" />
                  <span>{isUploadingReceipt ? (isRTL ? 'جارٍ الرفع...' : 'Uploading...') : (isRTL ? 'انقر لرفع صورة إشعار التحويل' : 'Upload Receipt')}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploadingReceipt(true);
                      try {
                        const url = await processAndUploadReceipt(file);
                        setReceiptUrl(url);
                      } catch {
                        alert('فشل رفع الإيصال');
                      } finally {
                        setIsUploadingReceipt(false);
                      }
                    }}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {/* House Rules Agreement */}
            <div className="pt-2 border-t border-[#EAE5DC]">
              <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-[#5C554B]">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-[#EAE5DC] text-[#1A1816] accent-[#1A1816]"
                />
                <span>
                  {isRTL ? 'أوافق على ' : 'I accept the '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }}
                    className="font-bold text-[#1A1816] underline hover:text-[#9E7A4A] cursor-pointer"
                  >
                    {isRTL ? 'شروط وقوانين الإقامة بمجمع مزار' : 'House Rules'}
                  </button>
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PRIMARY ACTION BUTTON (BIG & CLEAR)
          ══════════════════════════════════════════════════════════════ */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !rulesAccepted}
              className={`w-full bg-[#1A1816] hover:bg-black text-white font-black py-4.5 px-8 rounded-2xl text-base transition-all shadow-xl flex items-center justify-center gap-3 cursor-pointer ${
                isSubmitting || !rulesAccepted ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>{isRTL ? 'جارٍ تسجيل الحجز...' : 'Confirming...'}</span>
                </>
              ) : (
                <>
                  <span>{isRTL ? 'تأكيد الحجز فوراً ومتابعة السداد على واتساب ➔' : 'Confirm Reservation on WhatsApp ➔'}</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-stone-400 mt-2 font-medium">
              {isRTL ? 'بمجرد النقر، يُسجل طلبك رسمياً في النظام ويُفتح الواتساب للتأكيد مع الاستقبال' : 'Instant booking & direct WhatsApp confirmation'}
            </p>
          </div>
        </form>
      </div>

      {/* ─── MODAL: CHANGE SUITE SELECTOR ─── */}
      {showUnitSelectorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto border border-[#EAE5DC] shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#EAE5DC] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#9E7A4A]" />
                <h3 className="font-black text-base text-[#1A1816]">
                  {isRTL ? 'اختر الجناح الفندقي المطلوب' : 'Select Suite'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUnitSelectorModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {allUnits.map((u: any) => {
                const photos = getUnitPhotos(u);
                const specs = getUnitSpecs(u, isRTL);
                const price = getSafeUnitPrice(u);
                const isSelected = selectedUnitId === u.id;

                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setSelectedUnitId(u.id);
                      setShowUnitSelectorModal(false);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex gap-3 items-center ${
                      isSelected
                        ? 'border-[#1A1816] bg-[#FAF8F5] ring-2 ring-[#1A1816]/10'
                        : 'border-[#EAE5DC] hover:border-[#9E7A4A] bg-white'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-[#EAE5DC]">
                      <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-xs text-[#1A1816] truncate">
                        {u.title?.[language] || u.id}
                      </div>
                      <div className="text-[10px] text-[#9E7A4A] font-semibold">
                        {specs.badge}
                      </div>
                      <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                        {price.toLocaleString()} ج.م / ليلة
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#9E7A4A] shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: HOUSE RULES ─── */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto border border-[#EAE5DC] shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#EAE5DC] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#9E7A4A]" />
                <h3 className="font-black text-base text-[#1A1816]">{isRTL ? 'قوانين وشروط الإقامة بمزار' : 'House Rules'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#5C554B] leading-relaxed">
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC]">
                <strong className="text-[#1A1816] block mb-0.5">1. إثبات الهوية:</strong>
                تقديم بطاقة الرقم القومي أو جواز السفر الساري للنزلاء عند تسجيل الوصول طبقاً للتعليمات الرسمية.
              </div>
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC]">
                <strong className="text-[#1A1816] block mb-0.5">2. المواعيد:</strong>
                الدخول من 14:00 ظهراً، والمغادرة وتسليم الكارت الذكي حتى 12:00 ظهراً.
              </div>
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC]">
                <strong className="text-[#1A1816] block mb-0.5">3. سياسة العربون:</strong>
                تأكيد الحجز بعربون ليلة واحدة فقط، والمتبقي يُسدد عند الاستلام.
              </div>
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC]">
                <strong className="text-[#1A1816] block mb-0.5">4. الهدوء والآداب:</strong>
                ممنوع اصطحاب الحيوانات، والحفاظ على الهدوء التام لراحة جميع النزلاء.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRulesAccepted(true);
                setShowRulesModal(false);
              }}
              className="w-full bg-[#1A1816] hover:bg-black text-white font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
            >
              {isRTL ? 'قرأت الشروط وأوافق عليها' : 'I Understand & Accept'}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
