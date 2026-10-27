'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Calendar from '@/components/Calendar';
import LuxuryDateInput from '@/components/LuxuryDateInput';
import { useLanguage } from '@/lib/LanguageContext';
import { processAndUploadReceipt, processAndUploadDocument } from '@/lib/uploadHelper';
import { resolveUnitVideo, formatDateDMY } from '@/lib/utils';
import { PAYMENT_DETAILS } from '@/data/paymentInfo';
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
  FileText,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Clock,
  Sparkles,
  MapPin,
  AlertCircle,
  Eye,
  RefreshCw,
  X,
  Bed,
  Wifi,
  Tv,
  Coffee,
  CheckCheck,
  ExternalLink,
  ChevronDown,
  Bath,
  Wind
} from 'lucide-react';

// ─── Real Photo Fallback Mapping ───
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

  const [activeStep, setActiveStep] = useState<number>(1);

  // Dates handling (strictly DD/MM/YYYY visually, YYYY-MM-DD in state)
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [unitFilter, setUnitFilter] = useState<'all' | 'studio' | 'apartment'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [step1Focus, setStep1Focus] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [error, setError] = useState<string | null>(null);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [idDocUrl, setIdDocUrl] = useState('');
  const [isUploadingIdDoc, setIsUploadingIdDoc] = useState(false);
  const [idDocError, setIdDocError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'instapay_bank' | 'visa' | 'whatsapp'>('instapay_bank');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const stepContainerRef = useRef<HTMLDivElement>(null);
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

  // ─── Initial Data Load ───
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(window.location.search);
        const unitParam = params.get('unit');
        const checkInParam = params.get('checkIn');
        const checkOutParam = params.get('checkOut');

        if (checkInParam && checkOutParam) {
          setCheckIn(checkInParam);
          setCheckOut(checkOutParam);
        }

        const res = await fetch('/api/units');
        const unitsData = res.ok ? await res.json() : [];
        const activeUnits = unitsData.filter((u: any) => u.status === 'متاح' || !u.status);
        setAllUnits(activeUnits);
        setAvailableUnits(activeUnits);

        if (unitParam) {
          setSelectedUnitId(unitParam);
          if (checkInParam && checkOutParam) {
            setActiveStep(3);
          } else {
            setActiveStep(2);
          }
        } else if (activeUnits.length > 0) {
          setSelectedUnitId(activeUnits[0].id);
        }
      } catch (err) {
        console.error('Initialization failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [isRTL]);

  // Update booked dates when a specific unit is selected
  useEffect(() => {
    if (selectedUnitId) {
      const fetchBooked = async () => {
        try {
          const res = await fetch('/api/bookings', { cache: 'no-store' });
          if (!res.ok) return;
          const allBookings = await res.json();
          const unitBooked = allBookings
            .filter((b: any) => b.apartmentId === selectedUnitId && !['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status))
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
    } else {
      setBookedDates([]);
    }
  }, [selectedUnitId]);

  const scrollToStepContainer = () => {
    if (stepContainerRef.current) {
      stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleProceedFromUnit = (unitId?: string) => {
    const idToUse = unitId || selectedUnitId;
    if (!idToUse) {
      alert(isRTL ? 'يرجى اختيار الجناح الفندقي أولاً' : 'Please select a unit first');
      return;
    }
    setSelectedUnitId(idToUse);
    setActiveStep(2);
    scrollToStepContainer();
  };

  const handleProceedFromDates = () => {
    if (!checkIn || !checkOut) {
      alert(isRTL ? 'يرجى تحديد تاريخي الوصول والمغادرة' : 'Please select arrival and departure dates');
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      alert(isRTL ? 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول' : 'Departure date must be after arrival date');
      return;
    }
    setActiveStep(3);
    scrollToStepContainer();
  };

  const handleProceedFromGuestInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert(isRTL ? 'يرجى كتابة الاسم بالكامل' : 'Please enter your full name');
      return;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      alert(isRTL ? 'يرجى إدخال رقم هاتف صحيح للتواصل' : 'Please enter a valid phone number');
      return;
    }
    setActiveStep(4);
    scrollToStepContainer();
  };

  // Quick duration chips helper
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

  // ─── Financial Calculations ───
  const selectedUnit = allUnits.find((u: any) => u.id === selectedUnitId) || availableUnits.find((u: any) => u.id === selectedUnitId);
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  const pricePerNight = getSafeUnitPrice(selectedUnit);
  const totalAmount = nights * pricePerNight;
  const depositRequired = pricePerNight; // Strict rule: 1-night deposit to confirm
  const remainingOnArrival = Math.max(0, totalAmount - depositRequired);

  const selectedUnitPhotos = getUnitPhotos(selectedUnit);
  const selectedUnitSpecs = getUnitSpecs(selectedUnit, isRTL);

  // Filter units by tab
  const filteredUnits = availableUnits.filter((u: any) => {
    if (unitFilter === 'studio') return u.type === 'studio' || String(u.id).startsWith('b');
    if (unitFilter === 'apartment') return u.type === 'apartment' || String(u.id).startsWith('apt-');
    return true;
  });

  // ─── Submit Reservation ───
  const handleSubmitBooking = async () => {
    if (!rulesAccepted) {
      alert(isRTL ? 'يرجى الموافقة على شروط وقوانين الإقامة لمتابعة الحجز' : 'Please accept the house rules to confirm');
      return;
    }

    setIsSubmitting(true);
    setError(null);

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
      branch: selectedUnit?.branch || 1,
      paymentMethod,
      receiptUrl: receiptUrl || null,
      dates: `${checkIn} - ${checkOut}`,
      guest: name,
      guestsCount: guestsCount,
      notes: `حجز مباشر من الموقع الفندقي. طريقة السداد: ${paymentMethod}. العربون المطلوب: ${depositRequired} ج.م`
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

      // WhatsApp Concierge message
      const textMsg =
        `*طلب حجز فندقي جديد — مجمع مزار*\n\n` +
        `👤 *الاسم:* ${name}\n` +
        `📱 *الهاتف:* ${phone}\n` +
        `👥 *عدد الضيوف:* ${guestsCount}\n` +
        `🏨 *الجناح:* ${selectedUnit ? (selectedUnit.title?.[language] || selectedUnitId) : selectedUnitId}\n` +
        `📅 *المواعيد:* من ${formatDateDMY(checkIn)} إلى ${formatDateDMY(checkOut)} (${nights} ليالي)\n` +
        `💵 *إجمالي الاستضافة:* ${totalAmount.toLocaleString()} ج.م (${nights} ليالي × ${pricePerNight.toLocaleString()} ج.م)\n` +
        `💳 *عربون التأكيد (ليلة واحدة):* ${depositRequired.toLocaleString()} ج.م\n` +
        `🏨 *المتبقي عند الوصول:* ${remainingOnArrival.toLocaleString()} ج.م\n` +
        `📝 *طريقة الدفع:* ${paymentMethod === 'instapay_bank' ? 'تحويل بنكي / إنستاباي' : paymentMethod === 'visa' ? 'بطاقة فيزا' : 'الدفع عند الوصول'}\n` +
        (receiptUrl ? `📎 *إشعار التحويل:* ${receiptUrl}\n` : '') +
        (idDocUrl ? `🪪 *إثبات الهوية:* ${idDocUrl}\n` : '');

      window.open(`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}&text=${encodeURIComponent(textMsg)}`, '_blank');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success Confirmation Screen ───
  if (isSuccess) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] text-[#1A1816] flex flex-col justify-center items-center p-6 animate-fade-in font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-white p-8 md:p-14 rounded-3xl border border-[#EAE5DC] shadow-xl text-center max-w-xl w-full relative">
          <div className="w-16 h-16 bg-[#F4EFEA] text-[#9E7A4A] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-xs border border-[#EAE5DC]">
            <Check className="w-8 h-8 stroke-[2.5]" />
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-[#1A1816] mb-3 tracking-tight">
            {isRTL ? 'تم تسجيل طلب حجزك بنجاح' : 'Reservation Successfully Placed'}
          </h2>
          <p className="text-xs md:text-sm text-[#7A7265] mb-8 font-medium">
            {isRTL ? 'شكراً لاختيارك مجمع مزار الفندقي. تم إرسال تفاصيل الإقامة لقسم الحجوزات.' : 'Thank you for choosing Mazar. Your reservation details have been sent to concierge.'}
          </p>

          <div className="bg-[#FAF8F5] p-6 rounded-2xl border border-[#EAE5DC] text-center space-y-4 mb-8">
            <div className="text-base font-black text-[#1A1816]">{selectedUnit?.title?.[language] || selectedUnitId}</div>
            
            <div className="flex justify-between items-center text-xs font-semibold text-[#7A7265] border-t border-b border-[#EAE5DC] py-3">
              <div>
                <span className="block text-[10px] text-stone-400 font-bold mb-0.5">{isRTL ? 'الوصول' : 'Check-in'}</span>
                <span className="font-mono text-[#1A1816] font-bold" dir="ltr">{formatDateDMY(checkIn)}</span>
              </div>
              <div className="text-stone-300">➔</div>
              <div>
                <span className="block text-[10px] text-stone-400 font-bold mb-0.5">{isRTL ? 'المغادرة' : 'Check-out'}</span>
                <span className="font-mono text-[#1A1816] font-bold" dir="ltr">{formatDateDMY(checkOut)}</span>
              </div>
              <div className="text-stone-300">|</div>
              <div>
                <span className="block text-[10px] text-stone-400 font-bold mb-0.5">{isRTL ? 'المدة' : 'Duration'}</span>
                <span className="font-bold text-[#9E7A4A]">{nights} {isRTL ? 'ليالي' : 'nights'}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-[#7A7265] font-medium">{isRTL ? 'عربون تأكيد الحجز (ليلة واحدة):' : '1-Night Confirmation Deposit:'}</span>
              <span className="text-base font-black text-[#1A1816]">{depositRequired.toLocaleString()} ج.م</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#1A1816] hover:bg-black text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isRTL ? 'متابعة الحجز على واتساب' : 'Continue on WhatsApp'}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <Link
              href="/"
              className="bg-[#FAF8F5] hover:bg-stone-100 text-[#1A1816] font-bold py-3.5 px-6 rounded-xl text-sm transition-all border border-[#EAE5DC]"
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

      {/* ══════════════════════════════════════════════════════════════
          STICKY LUXURY HEADER (ثابت وراقي دائماً أعلى الشاشة)
      ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 w-full bg-[#FAF8F5]/95 backdrop-blur-xl border-b border-[#EAE5DC] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
          
          {/* Brand Logo & Title */}
          <Link href="/" className="flex items-center gap-3.5 group shrink-0">
            <div className="transition-transform duration-300 group-hover:scale-105">
              <Logo size={46} mdSize={54} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-[#1A1816] tracking-tight group-hover:text-[#9E7A4A] transition-colors">
                  مجمع مزار
                </span>
                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#9E7A4A]" />
                <span className="hidden sm:inline-block text-[11px] font-bold text-[#9E7A4A] tracking-wider uppercase">
                  Hotel Suites
                </span>
              </div>
              <span className="text-[11px] text-[#7A7265] font-medium hidden sm:block">
                أجنحة وشقق فندقية فاخرة • مدينة نصر
              </span>
            </div>
          </Link>

          {/* Quick Nav & WhatsApp Concierge */}
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-[#5C554B]">
              <Link href="/" className="hover:text-[#1A1816] transition-colors">{isRTL ? 'الرئيسية' : 'Home'}</Link>
              <Link href="/mazar/units/studios" className="hover:text-[#1A1816] transition-colors">الأجنحة الفندقية</Link>
              <Link href="/mazar/about" className="hover:text-[#1A1816] transition-colors">عن المكان</Link>
              <Link href="/mazar/rules" className="hover:text-[#1A1816] transition-colors">قوانين المكان</Link>
              <Link href="/mazar/how-to-book" className="hover:text-[#1A1816] transition-colors">طريقة الحجز</Link>
            </nav>

            <a
              href={`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1A1816] text-[#FAF8F5] text-xs font-bold hover:bg-black transition-all shadow-xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-mono text-[11px]" dir="ltr">01108109969</span>
            </a>

            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          MAIN BOOKING FLOW CONTAINER
      ══════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12" ref={stepContainerRef}>

        {/* ─── Minimalist Stepper Track ─── */}
        <section className="mb-8 sm:mb-12">
          <div className="bg-white p-2.5 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_10px_rgba(0,0,0,0.02)] max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {[
                { step: 1, title: isRTL ? 'الوحدة الفندقية' : 'Suite', icon: Building2 },
                { step: 2, title: isRTL ? 'مواعيد الإقامة' : 'Dates', icon: CalendarIcon },
                { step: 3, title: isRTL ? 'بيانات الضيف' : 'Guest', icon: User },
                { step: 4, title: isRTL ? 'تأكيد الحجز والعربون' : 'Deposit', icon: CreditCard },
              ].map((item) => {
                const isActive = activeStep === item.step;
                const isPassed = activeStep > item.step;

                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => {
                      if (item.step < activeStep || (item.step === 2 && selectedUnitId)) {
                        setActiveStep(item.step);
                      }
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-right ${
                      isActive
                        ? 'bg-[#1A1816] text-white shadow-sm'
                        : isPassed
                        ? 'bg-[#FAF8F5] text-[#1A1816] hover:bg-stone-100 cursor-pointer'
                        : 'text-stone-400'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      isActive 
                        ? 'bg-[#9E7A4A] text-white' 
                        : isPassed 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : item.step}
                    </div>
                    <span className="text-xs font-bold truncate">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── 2-Column Split Layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ══════════════════════════════════════════════════════════════
              MAIN ACTIVE STEP COLUMN (8 of 12 cols)
          ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">

            {/* ─── STEP 1: اختيار الجناح الفندقي ─── */}
            {activeStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                {/* Header & Filter Bar */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[#9E7A4A] uppercase tracking-wider mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'الخطوة الأولى • اختيار الجناح' : 'Step 1 • Suite Selection'}</span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-[#1A1816] tracking-tight">
                        {isRTL ? 'اختر الجناح الفندقي المناسب' : 'Select Your Preferred Suite'}
                      </h2>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-[#FAF8F5] p-1 rounded-xl border border-[#EAE5DC] text-xs font-bold shrink-0">
                      <button
                        type="button"
                        onClick={() => setUnitFilter('all')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${unitFilter === 'all' ? 'bg-white text-[#1A1816] shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                      >
                        {isRTL ? 'الكل' : 'All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnitFilter('studio')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${unitFilter === 'studio' ? 'bg-white text-[#1A1816] shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                      >
                        {isRTL ? 'استوديوهات' : 'Studios'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnitFilter('apartment')}
                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${unitFilter === 'apartment' ? 'bg-white text-[#1A1816] shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                      >
                        {isRTL ? 'شقق فاخرة' : 'Apartments'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#7A7265] leading-relaxed">
                    {isRTL ? 'أجنحة فندقية مفروشة بأرقى الديكورات العصرية ومجهزة بتكييفات مركزية، شاشات سمارت 55 بوصة، ومطابخ خاصة في قلب مدينة نصر.' : 'Premium hotel suites with climate control, 55" smart TVs, and kitchenettes in prime Nasr City.'}
                  </p>
                </div>

                {/* Suites Grid (High-End Boutique Hotel Cards) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredUnits.map((u: any) => {
                    const isSelected = selectedUnitId === u.id;
                    const price = getSafeUnitPrice(u);
                    const photos = getUnitPhotos(u);
                    const specs = getUnitSpecs(u, isRTL);

                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUnitId(u.id)}
                        className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group ${
                          isSelected
                            ? 'border-[#1A1816] ring-2 ring-[#1A1816]/10 shadow-lg'
                            : 'border-[#EAE5DC] hover:border-[#9E7A4A] hover:shadow-md'
                        }`}
                      >
                        {/* Real Photo with subtle zoom */}
                        <div className="relative aspect-[16/10] bg-stone-100 overflow-hidden">
                          <img
                            src={photos[0]}
                            alt={u.title?.[language] || u.id}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />

                          {/* Category Badge */}
                          <div className="absolute top-3 right-3 bg-[#1A1816]/85 backdrop-blur-md text-[#FAF8F5] px-3 py-1 rounded-lg text-[11px] font-bold shadow-xs">
                            {specs.badge}
                          </div>

                          {/* Selected Checkmark */}
                          {isSelected && (
                            <div className="absolute top-3 left-3 bg-[#9E7A4A] text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>{isRTL ? 'الجناح المختار' : 'Selected'}</span>
                            </div>
                          )}

                          {/* Branch Location Badge */}
                          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md text-[#1A1816] px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-xs">
                            <MapPin className="w-3 h-3 text-[#9E7A4A]" />
                            <span>{specs.branch}</span>
                          </div>
                        </div>

                        {/* Card Info Body */}
                        <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex items-center justify-between">
                              <h3 className="font-black text-lg text-[#1A1816] group-hover:text-[#9E7A4A] transition-colors">
                                {u.title?.[language] || u.id}
                              </h3>
                            </div>
                            
                            {/* Capacity & Bed Info */}
                            <div className="mt-2 space-y-1.5 text-xs text-[#5C554B]">
                              <div className="flex items-center gap-2 font-semibold">
                                <Users className="w-3.5 h-3.5 text-[#9E7A4A] shrink-0" />
                                <span>{specs.capacity}</span>
                                <span className="text-stone-300">•</span>
                                <Bed className="w-3.5 h-3.5 text-[#9E7A4A] shrink-0" />
                                <span>{specs.beds}</span>
                              </div>
                            </div>
                          </div>

                          {/* Amenities Badges */}
                          <div className="flex flex-wrap gap-1.5 text-[10px] text-stone-600 font-medium">
                            <span className="inline-flex items-center gap-1 bg-[#FAF8F5] px-2 py-1 rounded-md border border-[#EAE5DC]">
                              <Bath className="w-3 h-3 text-[#9E7A4A]" /> {isRTL ? 'حمام رخامي خاص' : 'Private Bath'}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#FAF8F5] px-2 py-1 rounded-md border border-[#EAE5DC]">
                              <Wind className="w-3 h-3 text-[#9E7A4A]" /> {isRTL ? 'تكييف مركزي' : 'AC'}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#FAF8F5] px-2 py-1 rounded-md border border-[#EAE5DC]">
                              <Tv className="w-3 h-3 text-[#9E7A4A]" /> {isRTL ? 'شاشة سمارت' : 'Smart TV'}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#FAF8F5] px-2 py-1 rounded-md border border-[#EAE5DC]">
                              <Wifi className="w-3 h-3 text-[#9E7A4A]" /> {isRTL ? 'واي فاي مجاني' : 'WiFi'}
                            </span>
                          </div>

                          {/* Price & Primary CTA */}
                          <div className="pt-3 border-t border-[#EAE5DC] flex items-center justify-between">
                            <div>
                              <div className="text-lg font-black text-[#1A1816]">
                                {price.toLocaleString()} <span className="text-xs font-normal text-stone-500">ج.م / ليلة</span>
                              </div>
                              <span className="text-[10px] text-emerald-700 font-semibold block">
                                {isRTL ? 'عربون التأكيد: ليلة واحدة فقط' : '1-night deposit to confirm'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProceedFromUnit(u.id);
                              }}
                              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#1A1816] text-white shadow-sm'
                                  : 'bg-[#FAF8F5] hover:bg-[#1A1816] hover:text-white text-[#1A1816] border border-[#EAE5DC]'
                              }`}
                            >
                              {isSelected ? (isRTL ? 'تأكيد ومتابعة ➔' : 'Proceed ➔') : (isRTL ? 'اختيار الجناح' : 'Select')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Continue Button */}
                {selectedUnitId && (
                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => handleProceedFromUnit()}
                      className="w-full sm:w-auto bg-[#1A1816] hover:bg-black text-white font-bold px-8 py-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{isRTL ? 'تأكيد الجناح والمتابعة لمواعيد الإقامة ➔' : 'Confirm Suite & Continue to Dates ➔'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 2: مواعيد الإقامة (تنسيق يوم/شهر/سنة + تقويم راقٍ) ─── */}
            {activeStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#9E7A4A] uppercase tracking-wider mb-1">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'الخطوة الثانية • مواعيد الإقامة' : 'Step 2 • Stay Dates'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1A1816] tracking-tight">
                    {isRTL ? 'حدد موعد الوصول وموعد المغادرة' : 'Select Check-in and Check-out Dates'}
                  </h2>
                  <p className="text-xs text-[#7A7265] leading-relaxed">
                    {isRTL 
                      ? 'يمكنك كتابة التاريخ مباشرة بتنسيق (يوم / شهر / سنة) أو النقر على أي يوم من التقويم الفندقي أدناه.'
                      : 'Enter dates as DD / MM / YYYY or tap directly on the calendar below.'}
                  </p>
                </div>

                {/* Luxury Date Inputs (Day / Month / Year Guaranteed) */}
                <div className="bg-white p-6 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Check In Input */}
                    <div className="space-y-1">
                      <LuxuryDateInput
                        label={isRTL ? 'تاريخ الوصول (تسجيل الدخول - 14:00)' : 'Check-In Date (from 14:00)'}
                        value={checkIn}
                        min={getTodayStr()}
                        onChange={(val) => {
                          setCheckIn(val);
                          setStep1Focus('checkOut');
                          if (val && checkOut && new Date(checkOut) <= new Date(val)) {
                            const next = new Date(val);
                            next.setDate(next.getDate() + 1);
                            setCheckOut(next.toISOString().split('T')[0]);
                          }
                        }}
                        isRTL={isRTL}
                      />
                    </div>

                    {/* Check Out Input */}
                    <div className="space-y-1">
                      <LuxuryDateInput
                        label={isRTL ? 'تاريخ المغادرة (تسجيل الخروج - 12:00)' : 'Check-Out Date (until 12:00)'}
                        value={checkOut}
                        min={checkIn || getTodayStr()}
                        onChange={(val) => {
                          setCheckOut(val);
                        }}
                        isRTL={isRTL}
                      />
                    </div>
                  </div>

                  {/* Duration Banner & Quick Chips */}
                  <div className="pt-4 border-t border-[#EAE5DC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#9E7A4A]" />
                      <span className="text-sm font-black text-[#1A1816]">
                        {isRTL ? 'مدة الإقامة المحسوبة:' : 'Calculated Duration:'}
                      </span>
                      <span className="bg-[#FAF8F5] border border-[#EAE5DC] text-[#9E7A4A] font-bold px-3 py-1 rounded-lg text-xs font-mono">
                        {nights} {nights === 1 ? (isRTL ? 'ليلة واحدة' : 'Night') : (isRTL ? 'ليالٍ' : 'Nights')}
                      </span>
                    </div>

                    {/* Quick Duration Buttons */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="text-[11px] text-stone-400">{isRTL ? 'خيارات سريعة:' : 'Quick:'}</span>
                      {[
                        { label: isRTL ? 'ليلة واحدة' : '1 Night', n: 1 },
                        { label: isRTL ? 'ليلتين' : '2 Nights', n: 2 },
                        { label: isRTL ? '3 ليالٍ' : '3 Nights', n: 3 },
                        { label: isRTL ? 'أسبوع (7 ليالٍ)' : '7 Nights', n: 7 },
                      ].map((item) => (
                        <button
                          key={item.n}
                          type="button"
                          onClick={() => setDurationNights(item.n)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${
                            nights === item.n
                              ? 'bg-[#1A1816] text-white border-[#1A1816]'
                              : 'bg-[#FAF8F5] text-[#5C554B] border-[#EAE5DC] hover:border-stone-400'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Clean Luxury Calendar */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold text-[#7A7265] pb-2 border-b border-[#EAE5DC]">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1A1816]" />
                      <span>{step1Focus === 'checkIn' ? (isRTL ? 'اختر موعد الوصول من التقويم' : 'Select Check-in Date') : (isRTL ? 'اختر موعد المغادرة من التقويم' : 'Select Check-out Date')}</span>
                    </span>
                    <span className="text-[#9E7A4A] font-semibold">
                      {isRTL ? 'أيام الأسبوع تبدأ من السبت' : 'Week starts on Saturday'}
                    </span>
                  </div>

                  <Calendar
                    checkIn={checkIn}
                    checkOut={checkOut}
                    activeTab={step1Focus}
                    bookedDates={bookedDates}
                    onSelect={(inDate, outDate) => {
                      setCheckIn(inDate);
                      setCheckOut(outDate);
                      if (inDate && !outDate) setStep1Focus('checkOut');
                    }}
                  />
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="bg-white border border-[#EAE5DC] hover:border-[#1A1816] text-[#1A1816] font-bold px-6 py-3.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    {isRTL ? '← تغيير الجناح' : '← Change Suite'}
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedFromDates}
                    className="bg-[#1A1816] hover:bg-black text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <span>{isRTL ? 'تأكيد المواعيد والمتابعة للبيانات ➔' : 'Confirm Dates & Continue ➔'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 3: بيانات الضيف وإثبات الهوية ─── */}
            {activeStep === 3 && (
              <form onSubmit={handleProceedFromGuestInfo} className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#9E7A4A] uppercase tracking-wider mb-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'الخطوة الثالثة • بيانات النزيل الرئيسي' : 'Step 3 • Guest Information'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1A1816] tracking-tight">
                    {isRTL ? 'بيانات الضيف وإثبات الشخصية' : 'Guest Details & Identification'}
                  </h2>
                  <p className="text-xs text-[#7A7265] leading-relaxed">
                    {isRTL ? 'يرجى تسجيل بيانات النزيل بدقة لتجهيز كارت الدخول الإلكتروني للجناح.' : 'Please provide guest details to prepare the electronic suite keycard.'}
                  </p>
                </div>

                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
                  {/* Name Input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#1A1816]">
                      {isRTL ? 'الاسم بالكامل (كما في بطاقة الهوية / الجواز)' : 'Full Legal Name'} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={isRTL ? 'مثال: أحمد محمد علي' : 'e.g. John Doe'}
                        className="w-full bg-[#FAF8F5] border border-[#EAE5DC] rounded-xl px-4 py-3.5 text-sm font-semibold outline-none focus:border-[#1A1816] focus:bg-white transition-all text-[#1A1816]"
                      />
                      <User className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-4' : 'right-4'} w-4 h-4 text-stone-400`} />
                    </div>
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#1A1816]">
                      {isRTL ? 'رقم الهاتف / واتساب لتأكيد الحجز' : 'Phone / WhatsApp'} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="01xxxxxxxxx"
                        className="w-full bg-[#FAF8F5] border border-[#EAE5DC] rounded-xl px-4 py-3.5 text-sm font-semibold outline-none focus:border-[#1A1816] focus:bg-white transition-all text-[#1A1816] font-mono text-right"
                      />
                      <Phone className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-4' : 'right-4'} w-4 h-4 text-stone-400`} />
                    </div>
                  </div>

                  {/* Guests Count Selector */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#1A1816]">
                      {isRTL ? 'عدد النزلاء المصاحبين' : 'Number of Guests'}
                    </label>
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setGuestsCount(num)}
                          className={`py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            guestsCount === num
                              ? 'bg-[#1A1816] text-white border-[#1A1816] shadow-xs'
                              : 'bg-[#FAF8F5] text-[#5C554B] border-[#EAE5DC] hover:border-stone-400'
                          }`}
                        >
                          {num} {num === 1 ? (isRTL ? 'فرد' : '') : (isRTL ? 'أفراد' : '')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload National ID / Passport */}
                  <div className="pt-4 border-t border-[#EAE5DC] space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-bold text-[#1A1816]">
                        {isRTL ? 'إثبات الشخصية (بطاقة الرقم القومي أو جواز السفر)' : 'National ID or Passport'}
                      </label>
                      <span className="text-[10px] text-stone-400 font-medium">
                        {isRTL ? 'اختياري الآن ويمكن تقديمه عند الوصول' : 'Optional now'}
                      </span>
                    </div>

                    <div className="relative border-2 border-dashed border-[#EAE5DC] hover:border-[#9E7A4A] rounded-2xl p-6 bg-[#FAF8F5] transition-all text-center">
                      {idDocUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                          <span className="text-xs font-bold text-[#1A1816]">{isRTL ? 'تم رفع إثبات الهوية بنجاح' : 'ID uploaded successfully'}</span>
                          <button
                            type="button"
                            onClick={() => setIdDocUrl('')}
                            className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                          >
                            {isRTL ? 'حذف واستبدال' : 'Remove & replace'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <UploadCloud className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                          <p className="text-xs font-bold text-[#1A1816] mb-1">
                            {isRTL ? 'اضغط لرفع صورة إثبات الشخصية' : 'Click to upload ID photo'}
                          </p>
                          <p className="text-[10px] text-[#7A7265] mb-3">
                            {isRTL ? 'صورة واضحة للوجهين (JPG, PNG أو PDF)' : 'High resolution image or PDF'}
                          </p>

                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setIsUploadingIdDoc(true);
                              setIdDocError(null);
                              try {
                                const url = await processAndUploadDocument(file);
                                setIdDocUrl(url);
                              } catch (err: any) {
                                setIdDocError(err.message || 'فشل رفع الملف');
                              } finally {
                                setIsUploadingIdDoc(false);
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />

                          {isUploadingIdDoc && (
                            <div className="text-xs text-[#9E7A4A] font-bold flex items-center justify-center gap-2">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>{isRTL ? 'جارٍ رفع الملف بأمان...' : 'Uploading...'}</span>
                            </div>
                          )}

                          {idDocError && (
                            <p className="text-xs text-rose-600 font-bold mt-2">{idDocError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="bg-white border border-[#EAE5DC] hover:border-[#1A1816] text-[#1A1816] font-bold px-6 py-3.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    {isRTL ? '← تعديل المواعيد' : '← Edit Dates'}
                  </button>

                  <button
                    type="submit"
                    className="bg-[#1A1816] hover:bg-black text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <span>{isRTL ? 'المتابعة لخطوة العربون والحساب البنكي ➔' : 'Proceed to Payment ➔'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ─── STEP 4: تأكيد الحجز والعربون ─── */}
            {activeStep === 4 && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#9E7A4A] uppercase tracking-wider mb-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'الخطوة الرابعة • تأكيد الحجز وسداد العربون' : 'Step 4 • Deposit & Confirmation'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1A1816] tracking-tight">
                    {isRTL ? 'سداد عربون تأكيد الحجز' : 'Reservation Deposit'}
                  </h2>
                  <p className="text-xs text-[#7A7265] leading-relaxed">
                    {isRTL 
                      ? 'وفقاً لسياسة مجمع مزار الفندقي، يُعتمد الحجز فورياً بسداد عربون ليلة واحدة فقط، ويُسدد المتبقي عند الوصول.'
                      : 'Per Mazar policy, booking is secured by a 1-night deposit. Remainder due upon arrival.'}
                  </p>
                </div>

                {/* Amount Banner */}
                <div className="bg-[#1A1816] text-[#FAF8F5] p-6 sm:p-8 rounded-2xl shadow-lg space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                    <div>
                      <span className="text-xs text-[#C1A68D] font-bold block mb-1">
                        {isRTL ? 'عربون تأكيد الحجز المطلوب الآن (ليلة واحدة)' : 'Confirmation Deposit (1 Night)'}
                      </span>
                      <div className="text-3xl sm:text-4xl font-black text-white font-mono">
                        {depositRequired.toLocaleString()} <span className="text-base font-normal text-stone-300">ج.م</span>
                      </div>
                    </div>
                    <div className="text-right sm:text-left bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="text-[11px] text-stone-400">{isRTL ? 'إجمالي مدة الإقامة:' : 'Total Stay:'}</div>
                      <div className="text-sm font-bold text-white font-mono">{totalAmount.toLocaleString()} ج.م</div>
                      <div className="text-[11px] text-emerald-400 mt-0.5">{isRTL ? `المتبقي عند الوصول: ${remainingOnArrival.toLocaleString()} ج.م` : `Due on arrival: ${remainingOnArrival} EGP`}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-stone-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{isRTL ? 'سداد رسمي مؤمّن ومربوط برقم الحجز الخاص بك لدى إدارة مزار.' : 'Secure payment linked to your reservation.'}</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-[#1A1816]">
                      {isRTL ? 'اختر طريقة سداد العربون المعتمدة:' : 'Select Payment Method:'}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'instapay_bank', title: isRTL ? 'إنستاباي / تحويل بنكي' : 'InstaPay / Bank', badge: isRTL ? 'الموصى به' : 'Recommended' },
                        { id: 'visa', title: isRTL ? 'بطاقة فيزا / ماستركارد' : 'Visa / MasterCard', badge: isRTL ? 'بوابة إلكترونية' : 'Online' },
                        { id: 'whatsapp', title: isRTL ? 'التأكيد عبر واتساب' : 'WhatsApp Concierge', badge: isRTL ? 'تواصل فوري' : 'Direct' },
                      ].map((m) => (
                        <div
                          key={m.id}
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            paymentMethod === m.id
                              ? 'border-[#1A1816] bg-[#FAF8F5] ring-1 ring-[#1A1816]'
                              : 'border-[#EAE5DC] hover:border-stone-400'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-[#9E7A4A] bg-[#FAF8F5] px-1.5 py-0.5 rounded border border-[#EAE5DC]">{m.badge}</span>
                            <input
                              type="radio"
                              name="paymentMethod"
                              checked={paymentMethod === m.id}
                              onChange={() => {}}
                              className="accent-[#1A1816]"
                            />
                          </div>
                          <div className="font-black text-sm text-[#1A1816]">{m.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bank Accounts Details (Apple-Card Clean Look) */}
                  {paymentMethod === 'instapay_bank' && (
                    <div className="space-y-4 pt-4 border-t border-[#EAE5DC] animate-fade-in">
                      <div className="text-xs font-bold text-[#1A1816] flex items-center justify-between">
                        <span>{isRTL ? 'بيانات الحسابات الرسمية لإدارة مزار:' : 'Official Bank Details:'}</span>
                        <span className="text-[11px] text-stone-400">{isRTL ? 'اضغط على أي رقم لنسخه فوراً' : 'Tap to copy'}</span>
                      </div>

                      {/* NBE Bank Card */}
                      <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC] space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-[#1A1816]">البنك الأهلي المصري (NBE)</span>
                          <span className="text-[10px] text-[#9E7A4A] font-bold">حساب رسمي</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-500">اسم المستفيد:</span>
                          <span className="font-bold text-[#1A1816]">مدحت عز الدين حسانين الجوهري</span>
                        </div>
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-[#EAE5DC]">
                          <span className="text-stone-500">رقم الحساب:</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('1683071192994900010', 'nbe')}
                            className="flex items-center gap-1.5 font-mono font-bold text-[#1A1816] hover:text-[#9E7A4A] bg-white px-2.5 py-1 rounded-md border border-[#EAE5DC] transition-all cursor-pointer"
                          >
                            <span>1683071192994900010</span>
                            {copiedKey === 'nbe' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                          </button>
                        </div>
                      </div>

                      {/* InstaPay & Vodafone Cash */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* InstaPay */}
                        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC] space-y-2">
                          <div className="text-xs font-black text-[#1A1816]">إنستاباي (InstaPay)</div>
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-[#EAE5DC]">
                            <span className="text-stone-500">رقم التحويل:</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard('01005318003', 'instapay')}
                              className="flex items-center gap-1.5 font-mono font-bold text-[#1A1816] hover:text-[#9E7A4A] bg-white px-2.5 py-1 rounded-md border border-[#EAE5DC] transition-all cursor-pointer"
                            >
                              <span>01005318003</span>
                              {copiedKey === 'instapay' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                            </button>
                          </div>
                        </div>

                        {/* Vodafone Cash */}
                        <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC] space-y-2">
                          <div className="text-xs font-black text-[#1A1816]">فودافون كاش (Vodafone Cash)</div>
                          <div className="flex justify-between items-center text-xs pt-1 border-t border-[#EAE5DC]">
                            <span className="text-stone-500">رقم المحفظة:</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard('01021691745', 'vodafone')}
                              className="flex items-center gap-1.5 font-mono font-bold text-[#1A1816] hover:text-[#9E7A4A] bg-white px-2.5 py-1 rounded-md border border-[#EAE5DC] transition-all cursor-pointer"
                            >
                              <span>01021691745</span>
                              {copiedKey === 'vodafone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Attach Transfer Receipt */}
                      <div className="pt-2 border-t border-[#EAE5DC] space-y-2">
                        <label className="block text-xs font-bold text-[#1A1816]">
                          {isRTL ? 'إرفاق إيصال التحويل أو سكرين شوت السداد' : 'Attach Transfer Receipt (Image or PDF)'}
                        </label>
                        <div className="relative border-2 border-dashed border-[#EAE5DC] hover:border-[#9E7A4A] rounded-2xl p-5 bg-[#FAF8F5] transition-all text-center">
                          {receiptUrl ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                              <span className="text-xs font-bold text-[#1A1816]">{isRTL ? 'تم إرفاق إيصال السداد بنجاح' : 'Receipt attached'}</span>
                              <button
                                type="button"
                                onClick={() => setReceiptUrl('')}
                                className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                              >
                                {isRTL ? 'حذف واستبدال' : 'Remove & replace'}
                              </button>
                            </div>
                          ) : (
                            <div>
                              <UploadCloud className="w-6 h-6 text-stone-400 mx-auto mb-1.5" />
                              <p className="text-xs font-bold text-[#1A1816]">
                                {isRTL ? 'انقر لرفع صورة إيصال التحويل' : 'Click to upload receipt'}
                              </p>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setIsUploadingReceipt(true);
                                  setUploadError(null);
                                  try {
                                    const url = await processAndUploadReceipt(file);
                                    setReceiptUrl(url);
                                  } catch (err: any) {
                                    setUploadError(err.message || 'فشل رفع الملف');
                                  } finally {
                                    setIsUploadingReceipt(false);
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              {isUploadingReceipt && (
                                <div className="text-xs text-[#9E7A4A] font-bold flex items-center justify-center gap-1.5 mt-2">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>{isRTL ? 'جارٍ رفع الإيصال...' : 'Uploading receipt...'}</span>
                                </div>
                              )}
                              {uploadError && <p className="text-xs text-rose-600 font-bold mt-1">{uploadError}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Visa Option */}
                  {paymentMethod === 'visa' && (
                    <div className="p-5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC] text-center space-y-2 animate-fade-in">
                      <CreditCard className="w-8 h-8 text-[#9E7A4A] mx-auto" />
                      <div className="font-black text-sm text-[#1A1816]">{isRTL ? 'بوابة الدفع الإلكتروني الآمن' : 'Secure Online Payment'}</div>
                      <p className="text-xs text-[#7A7265] max-w-md mx-auto">
                        {isRTL 
                          ? 'عند تأكيد الحجز، سيتم توجيهك بأمان لسداد عربون ليلة واحدة عبر بوابة الدفع البنكية وتصلك رسالة التأكيد فوراً.' 
                          : 'You will be securely redirected to complete the 1-night deposit via gateway.'}
                      </p>
                    </div>
                  )}

                  {/* House Rules Agreement */}
                  <div className="pt-4 border-t border-[#EAE5DC] space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rulesAccepted}
                        onChange={(e) => setRulesAccepted(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-[#EAE5DC] text-[#1A1816] focus:ring-[#1A1816] accent-[#1A1816]"
                      />
                      <span className="text-xs text-[#5C554B] leading-relaxed">
                        {isRTL ? (
                          <>
                            أوافق وأتعهد بالالتزام بـ{' '}
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }}
                              className="font-bold text-[#1A1816] underline hover:text-[#9E7A4A] cursor-pointer"
                            >
                              قوانين وشروط الإقامة لمجمع مزار
                            </button>
                            {' '}(ممنوع اصطحاب الحيوانات، الحفاظ على الهدوء، وتسجيل بيانات النزلاء طبقاً للقانون).
                          </>
                        ) : (
                          <>
                            I agree to the{' '}
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }}
                              className="font-bold text-[#1A1816] underline cursor-pointer"
                            >
                              Mazar House Rules
                            </button>
                            {' '}(no pets, quiet hours, legal guest registration).
                          </>
                        )}
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

                {/* Final Submit Actions */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="bg-white border border-[#EAE5DC] hover:border-[#1A1816] text-[#1A1816] font-bold px-6 py-3.5 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    {isRTL ? '← تعديل بيانات الضيف' : '← Edit Guest Info'}
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting || !rulesAccepted}
                    onClick={handleSubmitBooking}
                    className={`bg-[#1A1816] hover:bg-black text-white font-black px-10 py-4 rounded-xl text-sm transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
                      isSubmitting || !rulesAccepted ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isRTL ? 'جارٍ تسجيل الحجز...' : 'Processing...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{isRTL ? 'تأكيد الحجز النهائي وإرسال الإشعار ➔' : 'Confirm & Complete Booking ➔'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT COLUMN: STICKY LUXURY FOLIO SUMMARY (4 of 12 cols)
          ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-28 space-y-4">
            <div className="bg-white rounded-2xl border border-[#EAE5DC] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
              
              {/* Folio Top Header */}
              <div className="p-5 border-b border-[#EAE5DC] bg-[#FAF8F5] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#9E7A4A]" />
                  <span className="text-xs font-black text-[#1A1816] uppercase tracking-wider">
                    {isRTL ? 'ملخص حجز الإقامة' : 'Stay Folio'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#9E7A4A] bg-white px-2 py-0.5 rounded-md border border-[#EAE5DC]">
                  Mazar Suites
                </span>
              </div>

              {selectedUnit ? (
                <div className="p-5 space-y-4">
                  {/* Selected Unit Thumbnail & Info */}
                  <div className="flex gap-3.5 items-center">
                    <div className="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-[#EAE5DC]">
                      <img src={selectedUnitPhotos[0]} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-sm text-[#1A1816] truncate">
                        {selectedUnit.title?.[language] || selectedUnit.id}
                      </h4>
                      <p className="text-[11px] text-[#7A7265] mt-0.5">
                        {selectedUnitSpecs.badge}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveStep(1)}
                        className="text-[10px] font-bold text-[#9E7A4A] hover:underline mt-1 cursor-pointer block"
                      >
                        {isRTL ? 'تغيير الجناح' : 'Change Suite'}
                      </button>
                    </div>
                  </div>

                  {/* Dates Overview (Strict Day/Month/Year Format) */}
                  <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#EAE5DC] space-y-2 text-xs">
                    <div className="flex justify-between items-center text-stone-600">
                      <span className="text-[11px] text-stone-400">{isRTL ? 'تاريخ الوصول:' : 'Check-in:'}</span>
                      <span className="font-mono font-bold text-[#1A1816]" dir="ltr">{formatDateDMY(checkIn)}</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-600">
                      <span className="text-[11px] text-stone-400">{isRTL ? 'تاريخ المغادرة:' : 'Check-out:'}</span>
                      <span className="font-mono font-bold text-[#1A1816]" dir="ltr">{formatDateDMY(checkOut)}</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-600 pt-1.5 border-t border-[#EAE5DC]">
                      <span className="text-[11px] text-stone-400">{isRTL ? 'عدد الليالي:' : 'Duration:'}</span>
                      <span className="font-bold text-[#9E7A4A]">{nights} {nights === 1 ? (isRTL ? 'ليلة واحدة' : 'night') : (isRTL ? 'ليالٍ' : 'nights')}</span>
                    </div>
                  </div>

                  {/* Financial Breakdown (Strict 1-Night Deposit Rule) */}
                  <div className="space-y-2.5 pt-2 text-xs">
                    <div className="flex justify-between items-center text-[#7A7265]">
                      <span>{isRTL ? 'سعر الليلة:' : 'Nightly rate:'}</span>
                      <span className="font-bold text-[#1A1816]">{pricePerNight.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between items-center text-[#7A7265]">
                      <span>{isRTL ? 'إجمالي مدة الإقامة:' : 'Total stay cost:'}</span>
                      <span className="font-bold text-[#1A1816]">{totalAmount.toLocaleString()} ج.م</span>
                    </div>

                    <div className="pt-2 border-t border-[#EAE5DC] flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="font-black text-xs text-[#1A1816]">
                          {isRTL ? 'عربون التأكيد (ليلة واحدة):' : 'Confirmation Deposit:'}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {isRTL ? 'المطلوب سداده الآن' : 'Due now to confirm'}
                        </span>
                      </div>
                      <span className="text-base font-black text-[#9E7A4A]">
                        {depositRequired.toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="bg-[#FAF8F5] p-2.5 rounded-lg border border-[#EAE5DC] flex justify-between items-center text-[11px]">
                      <span className="text-stone-500 font-medium">{isRTL ? 'المتبقي عند الوصول:' : 'Due at Check-in:'}</span>
                      <span className="font-bold text-[#1A1816]">{remainingOnArrival.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-stone-400 font-medium">
                  {isRTL ? 'يرجى اختيار الجناح الفندقي أولاً' : 'Please select a suite to view folio'}
                </div>
              )}

              {/* Guarantees Footer */}
              <div className="p-4 bg-[#FAF8F5] border-t border-[#EAE5DC] space-y-2 text-[10px] text-[#7A7265] font-medium">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{isRTL ? 'حجز فوري مباشر من إدارة مجمع مزار بدون عمولات' : 'Direct booking with zero intermediary commissions'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#9E7A4A] shrink-0" />
                  <span>{isRTL ? 'تسجيل وصول سلس واستلام فوري لكارت الدخول الذكي' : 'Express check-in and smart card access'}</span>
                </div>
              </div>
            </div>

            {/* Direct Assistance Box */}
            <div className="bg-white p-4 rounded-xl border border-[#EAE5DC] flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-[#1A1816]">{isRTL ? 'تحتاج مساعدة أو استفسار؟' : 'Need booking assistance?'}</div>
                <div className="text-[11px] text-stone-400">{isRTL ? 'خدمة عملاء مزار متاحة 24/7' : 'Concierge available 24/7'}</div>
              </div>
              <a
                href={`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg bg-[#FAF8F5] hover:bg-[#1A1816] hover:text-white text-[#1A1816] font-bold text-[11px] border border-[#EAE5DC] transition-all cursor-pointer"
              >
                {isRTL ? 'محادثة فورية' : 'Chat'}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── House Rules Modal ─── */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto border border-[#EAE5DC] shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#EAE5DC] pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#9E7A4A]" />
                <h3 className="font-black text-lg text-[#1A1816]">{isRTL ? 'شروط وقوانين الإقامة بمزار' : 'Mazar House Rules'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#5C554B] leading-relaxed">
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC]">
                <span className="font-bold text-[#1A1816] block mb-1">1. إثبات الهوية وتسجيل النزلاء:</span>
                يلتزم جميع النزلاء بتقديم بطاقة الرقم القومي أو جواز السفر الساري عند الوصول، وتسجيل بيانات جميع المرافقين طبقاً للتعليمات الفندقية والأمنية الرسمية.
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC]">
                <span className="font-bold text-[#1A1816] block mb-1">2. مواعيد الوصول والمغادرة:</span>
                تسجيل الدخول يبدأ من الساعة 14:00 ظهراً، وتسجيل المغادرة وتسليم الكارت الذكي بحد أقصى الساعة 12:00 ظهراً.
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC]">
                <span className="font-bold text-[#1A1816] block mb-1">3. سياسة العربون والتأكيد:</span>
                يتم تأكيد الحجز بسداد عربون يعادل قيمة ليلة واحدة فقط. العربون غير مسترد في حال الإلغاء قبل أقل من 24 ساعة من موعد الوصول.
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DC]">
                <span className="font-bold text-[#1A1816] block mb-1">4. المحافظة على الهدوء والآداب العامة:</span>
                يُمنع منعاً باتاً اصطحاب الحيوانات الأليفة، ويُرجى الحفاظ على الهدوء التام داخل المجمع ومراعاة راحة النزلاء في الأجنحة المجاورة.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRulesAccepted(true);
                setShowRulesModal(false);
              }}
              className="w-full bg-[#1A1816] hover:bg-black text-white font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer"
            >
              {isRTL ? 'قرأت الشروط وأوافق عليها' : 'I Understand & Accept'}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
    </main>
  );
}
