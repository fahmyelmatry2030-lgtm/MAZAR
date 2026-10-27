'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Calendar from '@/components/Calendar';
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
  ChevronDown
} from 'lucide-react';

export default function BookingPage() {
  const { t, isRTL, language } = useLanguage();

  // ─── 4-Step Modern Booking Track ───
  // 1: اختيار الجناح الفندقي (Suite Selection)
  // 2: تواريخ الإقامة والليالي (Dates & Nights)
  // 3: بيانات الضيف وإثبات الهوية (Guest Details & ID)
  // 4: سداد العربون وتأكيد الحجز (Deposit & Confirmation)
  const [activeStep, setActiveStep] = useState<number>(1);

  // Initialize with current date strings (YYYY-MM-DD)
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
  const [quickViewUnit, setQuickViewUnit] = useState<any>(null);
  const [quickViewActiveImage, setQuickViewActiveImage] = useState<string>('');
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

        // 1. Fetch all system units
        const res = await fetch('/api/units');
        const unitsData = res.ok ? await res.json() : [];
        const activeUnits = unitsData.filter((u: any) => u.status === 'متاح' || !u.status);
        setAllUnits(activeUnits);
        setAvailableUnits(activeUnits);

        // 2. Fetch bookings for availability & booked dates
        const bookingsRes = await fetch('/api/bookings', { cache: 'no-store' });
        const allBookings = bookingsRes.ok ? await bookingsRes.json() : [];

        // If unitParam is present, lock and fetch its booked dates
        if (unitParam) {
          setSelectedUnitId(unitParam);
          const unitBooked = allBookings
            .filter((b: any) => b.apartmentId === unitParam && !['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status))
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

          if (checkInParam && checkOutParam) {
            setActiveStep(3);
          } else {
            setActiveStep(2);
          }
        } else if (checkInParam && checkOutParam) {
          const available = activeUnits.filter((unit: any) => {
            const hasOverlap = allBookings.some((b: any) => {
              if (b.apartmentId !== unit.id) return false;
              if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
              return (checkInParam < b.checkOut && checkOutParam > b.checkIn);
            });
            return !hasOverlap;
          });
          setAvailableUnits(available);
          if (available.length > 0) {
            setSelectedUnitId(available[0].id);
          }
          setActiveStep(1);
        } else {
          if (activeUnits.length > 0) {
            setSelectedUnitId(activeUnits[0].id);
          }
          setActiveStep(1);
        }
      } catch (err) {
        console.error('Initialization failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [isRTL]);

  // Update booked dates when a unit is selected
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

  const handleProceedFromUnit = () => {
    if (!selectedUnitId) {
      alert(isRTL ? 'يرجى اختيار الجناح الفندقي أولاً' : 'Please select a unit first');
      return;
    }
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
      alert(isRTL ? 'يرجى إدخال اسم الضيف بالكامل' : 'Please enter full guest name');
      return;
    }
    if (!phone.trim()) {
      alert(isRTL ? 'يرجى إدخال رقم الواتساب للتواصل' : 'Please enter WhatsApp number');
      return;
    }
    setActiveStep(4);
    scrollToStepContainer();
  };

  // ─── Financial Calculations ───
  // Business rule: The reservation is confirmed with a 1-night deposit.
  const selectedUnit = allUnits.find((u: any) => u.id === selectedUnitId) || availableUnits.find((u: any) => u.id === selectedUnitId);
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  const pricePerNight = getSafeUnitPrice(selectedUnit);
  const totalAmount = nights * pricePerNight;
  const depositRequired = pricePerNight; // عربون ليلة واحدة
  const remainingOnArrival = Math.max(0, totalAmount - depositRequired);

  // Submit Final Booking
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      alert(isRTL ? 'يرجى إدخال الاسم ورقم الهاتف' : 'Please enter name and phone');
      setActiveStep(3);
      return;
    }
    if (!rulesAccepted) {
      alert(isRTL ? 'يرجى قراءة وقبول شروط الإقامة للمتابعة' : 'Please accept house rules to proceed');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const methodLabel = paymentMethod === 'visa' 
      ? 'بطاقة بنكية / فيزا' 
      : paymentMethod === 'instapay_bank' 
        ? 'إنستا باي / تحويل بنكي / فودافون كاش' 
        : 'تأكيد مباشر عبر واتساب';

    const notesParts: string[] = [];
    if (receiptUrl) notesParts.push(`إيصال التحويل: ${receiptUrl}`);
    if (idDocUrl) notesParts.push(`إثبات الشخصية: ${idDocUrl}`);
    notesParts.push(`طريقة السداد: ${methodLabel}`);
    notesParts.push(`عربون ليلة واحدة مطلوب: ${depositRequired} ج.م | متبقي عند الوصول: ${remainingOnArrival} ج.م`);

    const fullNotes = `[طلب من الموقع] ${notesParts.join(' | ')}`;
    const paymentSummary = `إجمالي الحجز: ${totalAmount} ج.م (${nights} ليالي × ${pricePerNight} ج.م) | عربون ليلة واحدة: ${depositRequired} ج.م | متبقي عند الوصول: ${remainingOnArrival} ج.م`;
    const fullPaymentInfo = `${paymentSummary} | ${fullNotes}`;

    const bookingData = {
      name,
      phone,
      checkIn,
      checkOut,
      numberOfDays: nights,
      pricePerNight,
      totalAmount: totalAmount > 0 ? totalAmount : null,
      paidAmount: receiptUrl ? depositRequired : 0,
      remainingAmount: receiptUrl ? remainingOnArrival : totalAmount,
      paymentStatus: 'باقي',
      paymentMethod: paymentMethod === 'visa' ? 'فيزا' : (paymentMethod === 'instapay_bank' ? 'إنستا باي' : 'كاش'),
      idNumber: idDocUrl || null,
      apartmentId: selectedUnitId,
      dates: `${checkIn} - ${checkOut}`,
      guest: name,
      guestsCount: guestsCount,
      studio: selectedUnit ? (selectedUnit.title?.[language] || selectedUnitId) : selectedUnitId,
      paymentInfo: fullPaymentInfo,
      notes: fullNotes,
      source: 'website',
      isWebsiteBooking: true,
      clientStatus: 'انتظار',
    };

    try {
      const saveRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });
      if (!saveRes.ok) throw new Error('Failed to save booking');
      setIsSubmitting(false);
      setIsSuccess(true);

      // WhatsApp Notification for instant concierge matching
      let paymentNotice = '';
      if (receiptUrl) {
        paymentNotice = `\n🧾 *إيصال تحويل العربون:* ${receiptUrl}\n✅ *حالة السداد:* تم إرفاق إيصال عربون الليلة (${depositRequired} ج.م)`;
      } else if (paymentMethod === 'visa') {
        paymentNotice = `\n💳 *طريقة الدفع:* فيزا (سداد عربون ليلة ${depositRequired} ج.م)`;
      } else {
        paymentNotice = `\n⚠️ *ملاحظة:* بانتظار إرسال إيصال عربون الليلة (${depositRequired} ج.م) عبر واتساب لتأكيد الحجز النهائي`;
      }

      const adminMsg = `🔔 *طلب حجز جديد من موقع مزار!*\n\n` +
        `👤 *الاسم:* ${name}\n` +
        `📱 *الموبايل:* ${phone}\n` +
        `👥 *عدد الضيوف:* ${guestsCount}\n` +
        `🏠 *الوحدة:* ${selectedUnit ? (selectedUnit.title?.['ar'] || selectedUnitId) : selectedUnitId}\n` +
        `📅 *الفترة:* من ${formatDateDMY(checkIn)} إلى ${formatDateDMY(checkOut)} (${nights} ليالي)\n` +
        `💰 *إجمالي الإقامة:* ${totalAmount} ج.م (${nights} ليالي × ${pricePerNight} ج.م)\n` +
        `🌟 *عربون تأكيد الحجز (ليلة واحدة):* ${depositRequired} ج.م\n` +
        `💵 *المتبقي عند الوصول والاستلام:* ${remainingOnArrival} ج.م\n` +
        `💳 *وسيلة السداد:* ${methodLabel}\n` +
        (idDocUrl ? `🪪 *إثبات الشخصية:* ${idDocUrl}\n` : '') +
        paymentNotice + `\n\nيرجى تأكيد الحجز معي وتجهيز كارت الدخول.`;

      const waUrl = `https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}&text=${encodeURIComponent(adminMsg)}`;
      window.location.href = waUrl;

    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setError(isRTL ? 'حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.' : 'Error saving request. Please try again.');
    }
  };

  // Filtered Units
  const filteredUnits = allUnits.filter((u: any) => {
    if (unitFilter === 'studio') return u.type === 'studio';
    if (unitFilter === 'apartment') return u.type === 'apartment';
    return true;
  });

  // Helper date labels for preview
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return formatDateDMY(dateStr);
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
            <div className="text-sm font-black text-[#1A1816]">{selectedUnit?.title?.[language] || selectedUnitId}</div>
            
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
              className="flex-1 bg-[#1A1816] hover:bg-black text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
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
          STICKY LUXURY HEADER (ثابت وراقي على الموبايل والـ PC دائماً)
      ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 w-full bg-[#FAF8F5]/90 backdrop-blur-xl border-b border-[#EAE5DC] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
          
          {/* Brand Logo & Prominent Title */}
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
              <span className="text-[11px] font-medium text-[#7A7265] hidden sm:block">
                أجنحة وشقق فندقية فاخرة • مدينة نصر
              </span>
            </div>
          </Link>

          {/* Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-bold text-[#5C554B]">
            <Link href="/" className="hover:text-[#1A1816] transition-colors">{t.common.home}</Link>
            <Link href="/mazar/units/studios" className="hover:text-[#1A1816] transition-colors">{isRTL ? 'الأجنحة الفندقية' : 'Suites'}</Link>
            <Link href="/mazar/about" className="hover:text-[#1A1816] transition-colors">{t.common.about}</Link>
            <Link href="/mazar/rules" className="hover:text-[#1A1816] transition-colors">{t.common.rules}</Link>
            <Link href="/mazar/how-to-book" className="hover:text-[#1A1816] transition-colors">{t.common.howToBook}</Link>
          </nav>

          {/* Quick Actions (WhatsApp & Language) */}
          <div className="flex items-center gap-3">
            <a
              href={`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#1A1816] hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs"
              title="تواصل مباشر واتساب"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono tracking-wider font-bold">01108109969</span>
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          MAIN BOOKING ENGINE CONTAINER
      ══════════════════════════════════════════════════════════════ */}
      <div ref={stepContainerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* ─── Breadcrumb Progress Stepper (Minimalist Luxury) ─── */}
        <section className="mb-8 md:mb-12">
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { step: 1, title: isRTL ? 'الوحدة الفندقية' : 'Select Suite', icon: Building2 },
                { step: 2, title: isRTL ? 'مواعيد الإقامة' : 'Stay Dates', icon: CalendarIcon },
                { step: 3, title: isRTL ? 'بيانات الضيف' : 'Guest & ID', icon: User },
                { step: 4, title: isRTL ? 'تأكيد الحجز والعربون' : 'Deposit & Confirm', icon: CreditCard },
              ].map((item) => {
                const isActive = activeStep === item.step;
                const isPassed = activeStep > item.step;
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setActiveStep(item.step)}
                    className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl transition-all text-right w-full ${
                      isActive
                        ? 'bg-[#1A1816] text-white shadow-sm'
                        : isPassed
                        ? 'bg-[#FAF8F5] text-[#1A1816] hover:bg-stone-100'
                        : 'text-stone-400 hover:text-stone-700'
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

        {/* ─── 2-Column Luxury Split Layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ══════════════════════════════════════════════════════════════
              LEFT/MAIN COLUMN: ACTIVE STEP CONTENT (8 of 12 cols)
          ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">

            {/* ─── STEP 1: اختيار الوحدة ─── */}
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
                        className={`px-3 py-1.5 rounded-lg transition-all ${unitFilter === 'all' ? 'bg-white text-[#1A1816] shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                      >
                        {isRTL ? 'الكل' : 'All'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnitFilter('studio')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${unitFilter === 'studio' ? 'bg-white text-[#1A1816] shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                      >
                        {isRTL ? 'استوديوهات' : 'Studios'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnitFilter('apartment')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${unitFilter === 'apartment' ? 'bg-white text-[#1A1816] shadow-xs' : 'text-stone-500 hover:text-stone-800'}`}
                      >
                        {isRTL ? 'شقق فاخرة' : 'Apartments'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#7A7265] leading-relaxed">
                    {isRTL ? 'جميع الوحدات مفروشة بأرقى الديكورات الفندقية ومجهزة بشاشات سمارت، تكييفات مركزية، ومطابخ متكاملة في قلب مدينة نصر.' : 'All units feature luxury furnishings, smart TVs, climate control, and full kitchens in prime Nasr City.'}
                  </p>
                </div>

                {/* Suites Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredUnits.map((u: any) => {
                    const isSelected = selectedUnitId === u.id;
                    const price = getSafeUnitPrice(u);

                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUnitId(u.id)}
                        className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between group ${
                          isSelected
                            ? 'border-[#1A1816] ring-2 ring-[#1A1816]/10 shadow-md'
                            : 'border-[#EAE5DC] hover:border-stone-400 hover:shadow-sm'
                        }`}
                      >
                        {/* Photo */}
                        <div className="relative aspect-[16/10] bg-stone-100 overflow-hidden">
                          {u.images && u.images[0] ? (
                            <img
                              src={u.images[0]}
                              alt={u.title?.[language] || u.id}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <Building2 className="w-12 h-12 stroke-[1]" />
                            </div>
                          )}

                          <div className="absolute top-3 right-3 bg-[#1A1816]/80 backdrop-blur-md text-white px-2.5 py-1 rounded-md text-[11px] font-mono font-bold">
                            {u.id}
                          </div>

                          {isSelected && (
                            <div className="absolute top-3 left-3 bg-[#1A1816] text-[#FAF8F5] px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-md">
                              <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-400" />
                              <span>{isRTL ? 'محدد' : 'Selected'}</span>
                            </div>
                          )}

                          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md text-[#1A1816] px-2.5 py-0.5 rounded text-[10px] font-bold">
                            {u.type === 'studio' ? (isRTL ? 'جناح استوديو' : 'Studio') : (isRTL ? 'شقة فندقية فاخرة' : 'Hotel Apartment')}
                          </div>
                        </div>

                        {/* Info Body */}
                        <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                          <div>
                            <h3 className="font-black text-base text-[#1A1816] group-hover:text-[#9E7A4A] transition-colors">
                              {u.title?.[language] || u.id}
                            </h3>
                            <p className="text-xs text-[#7A7265] mt-1.5 line-clamp-2 leading-relaxed">
                              {u.description?.[language] || 'إقامة فندقية متكاملة بأعلى معايير الخصوصية والرفاهية.'}
                            </p>
                          </div>

                          {/* Amenities Micro-Badges */}
                          <div className="flex flex-wrap gap-2 text-[10px] text-stone-600 font-medium">
                            <span className="inline-flex items-center gap-1 bg-[#FAF8F5] px-2 py-1 rounded-md border border-[#EAE5DC]">
                              <Bed className="w-3 h-3 text-[#9E7A4A]" /> {isRTL ? 'سرير فندقي' : 'Bed'}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#FAF8F5] px-2 py-1 rounded-md border border-[#EAE4D9]">
                              <Wifi className="w-3 h-3 text-[#9E7A4A]" /> {isRTL ? 'واي فاي' : 'WiFi'}
                            </span>
                            <span className="inline-flex items-center gap-1 bg-[#FAF8F5] px-2 py-1 rounded-md border border-[#EAE4D9]">
                              <Tv className="w-3 h-3 text-[#9E7A4A]" /> {isRTL ? 'سمارت TV' : 'Smart TV'}
                            </span>
                          </div>

                          {/* Price & Action */}
                          <div className="pt-3 border-t border-[#EAE5DC] flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-stone-400 block font-semibold">{isRTL ? 'السعر لليلة' : 'Rate per night'}</span>
                              <div className="text-base font-black text-[#1A1816]">
                                {price.toLocaleString()} <span className="text-[11px] font-normal text-stone-500">ج.م</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUnitId(u.id);
                                handleProceedFromUnit();
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-[#1A1816] text-white shadow-xs'
                                  : 'bg-[#FAF8F5] hover:bg-[#1A1816] hover:text-white text-[#1A1816] border border-[#EAE5DC]'
                              }`}
                            >
                              {isSelected ? (isRTL ? 'المتابعة ➔' : 'Proceed ➔') : (isRTL ? 'اختيار' : 'Select')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Continue */}
                {selectedUnitId && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleProceedFromUnit}
                      className="w-full sm:w-auto bg-[#1A1816] hover:bg-black text-white font-bold px-8 py-4 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <span>{isRTL ? 'تأكيد الجناح والمتابعة لمواعيد الإقامة ➔' : 'Confirm Suite & Continue to Dates ➔'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 2: مواعيد الإقامة ─── */}
            {activeStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#9E7A4A] uppercase tracking-wider mb-1">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'الخطوة الثانية • مواعيد الإقامة' : 'Step 2 • Stay Dates'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1A1816] tracking-tight">
                    {isRTL ? 'حدد تاريخ الوصول والمغادرة' : 'Select Arrival & Departure Dates'}
                  </h2>
                  <p className="text-xs text-[#7A7265] leading-relaxed">
                    {isRTL ? 'يمكنك تحديد التواريخ عبر النقر المباشر على التقويم الفندقي أدناه، ويتم احتساب عدد الليالي تلقائياً بدقة.' : 'Pick dates directly on the luxury calendar below. Nights and total stay are calculated automatically.'}
                  </p>
                </div>

                {/* Modern Date Indicator Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Check-In Card */}
                  <div
                    onClick={() => setStep1Focus('checkIn')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      step1Focus === 'checkIn'
                        ? 'bg-white border-[#1A1816] shadow-sm ring-1 ring-[#1A1816]/10'
                        : 'bg-white border-[#EAE5DC] hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#9E7A4A] uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {isRTL ? 'تاريخ الوصول (دخول)' : 'Check-In'}
                      </span>
                      <span className="text-[10px] bg-[#FAF8F5] text-stone-500 px-2 py-0.5 rounded border border-[#EAE5DC] font-mono">
                        14:00 {isRTL ? 'ظهراً' : 'PM'}
                      </span>
                    </div>
                    <div className="text-lg font-black text-[#1A1816]">
                      {formatFriendlyDate(checkIn)}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 mt-1" dir="ltr">
                      {formatDateDMY(checkIn)}
                    </div>
                  </div>

                  {/* Check-Out Card */}
                  <div
                    onClick={() => setStep1Focus('checkOut')}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      step1Focus === 'checkOut'
                        ? 'bg-white border-[#1A1816] shadow-sm ring-1 ring-[#1A1816]/10'
                        : 'bg-white border-[#EAE5DC] hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {isRTL ? 'تاريخ المغادرة (خروج)' : 'Check-Out'}
                      </span>
                      <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100 font-mono">
                        12:00 {isRTL ? 'ظهراً' : 'PM'}
                      </span>
                    </div>
                    <div className="text-lg font-black text-[#1A1816]">
                      {formatFriendlyDate(checkOut)}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 mt-1" dir="ltr">
                      {formatDateDMY(checkOut)}
                    </div>
                  </div>
                </div>

                {/* Modern Luxury Embedded Calendar */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold text-[#7A7265] pb-2 border-b border-[#EAE5DC]">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1A1816]" />
                      <span>{step1Focus === 'checkIn' ? (isRTL ? 'اختر موعد الدخول من التقويم' : 'Select Check-in Date') : (isRTL ? 'اختر موعد الخروج من التقويم' : 'Select Check-out Date')}</span>
                    </span>
                    <span className="text-[#9E7A4A] font-semibold">
                      {nights} {isRTL ? 'ليالي إقامة' : 'Nights'}
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
                    className="bg-white border border-[#EAE5DC] hover:border-[#1A1816] text-[#1A1816] font-bold px-6 py-3.5 rounded-xl text-xs transition-all"
                  >
                    {isRTL ? '← تغيير الجناح' : '← Change Suite'}
                  </button>

                  <button
                    type="button"
                    onClick={handleProceedFromDates}
                    className="bg-[#1A1816] hover:bg-black text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center gap-2"
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
                    <span>{isRTL ? 'الخطوة الثالثة • بيانات النزيل' : 'Step 3 • Guest Information'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1A1816] tracking-tight">
                    {isRTL ? 'بيانات الضيف وإثبات الشخصية' : 'Guest Information & Identification'}
                  </h2>
                  <p className="text-xs text-[#7A7265] leading-relaxed">
                    {isRTL ? 'بيانات التواصل لتجهيز بطاقة الدخول الذكية وعقد الإقامة، مع إرفاق وثيقة الهوية المطلوبة نظامياً.' : 'Contact info to prepare your smart access pass and registration folio.'}
                  </p>
                </div>

                {/* Inputs Grid */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
                  {/* Row 1: Full Name & WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#1A1816]">
                        {isRTL ? 'الاسم بالكامل (كما في بطاقة الهوية)' : 'Full Name (as in official ID)'}
                        <span className="text-red-500 mr-1">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={isRTL ? 'مثال: أ/ محمد أحمد الشريف' : 'e.g. John Doe'}
                        className="w-full bg-[#FAF8F5] border border-[#EAE5DC] focus:border-[#1A1816] focus:bg-white rounded-xl px-4 py-3 outline-none font-bold text-sm text-[#1A1816] transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#1A1816]">
                        {isRTL ? 'رقم الواتساب للتواصل وتأكيد الحجز' : 'WhatsApp Mobile Number'}
                        <span className="text-red-500 mr-1">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+20 10..."
                        dir="ltr"
                        className="w-full bg-[#FAF8F5] border border-[#EAE5DC] focus:border-[#1A1816] focus:bg-white rounded-xl px-4 py-3 outline-none font-mono font-bold text-sm text-[#1A1816] transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2: Guests Count */}
                  <div className="space-y-2.5 pt-2 border-t border-[#EAE5DC]">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-[#1A1816] flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-[#9E7A4A]" />
                        <span>{isRTL ? 'عدد النزلاء والمقيمين بالجناح' : 'Number of Guests'}</span>
                      </label>
                      <span className="text-[11px] text-[#7A7265] font-medium">
                        {guestsCount} {isRTL ? 'ضيوف' : 'guests'}
                      </span>
                    </div>

                    <div className="grid grid-cols-6 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setGuestsCount(num)}
                          className={`py-2.5 rounded-xl font-bold text-xs transition-all border ${
                            guestsCount === num
                              ? 'bg-[#1A1816] text-white border-[#1A1816] shadow-xs'
                              : 'bg-[#FAF8F5] text-[#5C554B] border-[#EAE5DC] hover:border-stone-400'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Row 3: ID Document Upload (Modern Luxury Upload Zone) */}
                  <div className="space-y-2.5 pt-2 border-t border-[#EAE5DC]">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-[#1A1816] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#9E7A4A]" />
                        <span>{isRTL ? 'إثبات الهوية (بطاقة الرقم القومي أو جواز السفر)' : 'Official ID or Passport'}</span>
                      </label>
                      <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                        {isRTL ? 'مطلوب نظامياً للإقامة' : 'Required'}
                      </span>
                    </div>

                    <div className="border-2 border-dashed border-[#EAE5DC] hover:border-[#9E7A4A] bg-[#FAF8F5] rounded-2xl p-6 text-center transition-all">
                      <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-[#EAE5DC] flex items-center justify-center mx-auto mb-3 text-stone-600">
                        <UploadCloud className="w-5 h-5 text-[#9E7A4A]" />
                      </div>

                      <div className="text-xs font-bold text-[#1A1816] mb-1">
                        {isRTL ? 'اضغط لرفع صورة بطاقة الهوية أو جواز السفر' : 'Click to upload your ID or Passport photo'}
                      </div>
                      <p className="text-[11px] text-[#7A7265] mb-4">
                        {isRTL ? 'صورة واضحة للمستند (JPG, PNG أو PDF)' : 'High resolution image or PDF'}
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
                            console.error('ID upload failed:', err);
                            setIdDocError(err?.message || (isRTL ? 'فشل رفع المستند' : 'Upload failed'));
                          } finally {
                            setIsUploadingIdDoc(false);
                          }
                        }}
                        className="text-xs text-stone-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1A1816] file:text-white hover:file:bg-black file:cursor-pointer cursor-pointer"
                      />

                      {isUploadingIdDoc && (
                        <p className="text-xs font-bold text-amber-700 mt-3 animate-pulse">
                          ⏳ {isRTL ? 'جاري رفع المستند بأمان...' : 'Uploading securely...'}
                        </p>
                      )}

                      {idDocUrl && (
                        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>{isRTL ? 'تم رفع إثبات الهوية بنجاح' : 'ID document uploaded'}</span>
                          </span>
                          <a href={idDocUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                            {isRTL ? 'معاينة' : 'Preview'}
                          </a>
                        </div>
                      )}

                      {idDocError && (
                        <p className="text-xs font-bold text-red-600 mt-2">⚠️ {idDocError}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="bg-white border border-[#EAE5DC] hover:border-[#1A1816] text-[#1A1816] font-bold px-6 py-3.5 rounded-xl text-xs transition-all"
                  >
                    {isRTL ? '← تعديل المواعيد' : '← Edit Dates'}
                  </button>

                  <button
                    type="submit"
                    className="bg-[#1A1816] hover:bg-black text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center gap-2"
                  >
                    <span>{isRTL ? 'المتابعة لحساب الشركة وتأكيد الحجز ➔' : 'Proceed to Payment & Confirm ➔'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ─── STEP 4: سداد العربون وتأكيد الحجز ─── */}
            {activeStep === 4 && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#9E7A4A] uppercase tracking-wider mb-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'الخطوة الرابعة • تأكيد الحجز والعربون' : 'Step 4 • Deposit & Confirmation'}</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1A1816] tracking-tight">
                    {isRTL ? 'سداد عربون ليلة واحدة لتأكيد الحجز' : '1-Night Confirmation Deposit'}
                  </h2>
                  <p className="text-xs text-[#7A7265] leading-relaxed">
                    {isRTL 
                      ? 'وفقاً لسياسة مجمع مزار، يتم تأكيد حجز الجناح بسداد عربون ليلة واحدة فقط لحساب الشركة، والمبلغ المتبقي يُسدد عند الوصول والاستلام.' 
                      : 'Per Mazar policy, your reservation is confirmed upon paying a 1-night deposit to the company account. Remainder is paid at check-in.'}
                  </p>
                </div>

                {/* Financial Policy Notice */}
                <div className="bg-[#1A1816] text-white p-6 rounded-2xl shadow-md space-y-4">
                  <div className="flex justify-between items-center text-xs text-stone-300 pb-3 border-b border-white/10 font-bold">
                    <span>{isRTL ? 'ملخص القيمة المالية للحجز' : 'Reservation Cost Folio'}</span>
                    <span className="text-[#9E7A4A]">{nights} {isRTL ? 'ليالي إقامة' : 'Nights'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                      <span className="text-[11px] text-stone-400 block mb-1 font-medium">{isRTL ? 'إجمالي الإقامة' : 'Total Stay'}</span>
                      <span className="text-lg font-black text-white">{totalAmount.toLocaleString()} ج.م</span>
                    </div>

                    <div className="bg-[#9E7A4A]/20 p-3.5 rounded-xl border border-[#9E7A4A]/40">
                      <span className="text-[11px] text-amber-200 block mb-1 font-bold">
                        🌟 {isRTL ? 'عربون التأكيد (ليلة واحدة)' : 'Required Deposit'}
                      </span>
                      <span className="text-xl font-black text-amber-300">{depositRequired.toLocaleString()} ج.م</span>
                    </div>

                    <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                      <span className="text-[11px] text-stone-400 block mb-1 font-medium">{isRTL ? 'المتبقي عند الوصول' : 'Due at Check-in'}</span>
                      <span className="text-lg font-black text-stone-200">{remainingOnArrival.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Payment Options (Segmented Tabs) */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-[#1A1816]">
                      {isRTL ? 'طريقة سداد عربون الحجز:' : 'Select Deposit Payment Method:'}
                    </h3>
                    <p className="text-xs text-[#7A7265]">
                      {isRTL ? 'اختر الوسيلة الأنسب لك لسداد عربون ليلة واحدة' : 'Choose how you would like to pay the 1-night deposit'}
                    </p>
                  </div>

                  {/* Segmented Controls */}
                  <div className="grid grid-cols-3 gap-2 bg-[#FAF8F5] p-1.5 rounded-xl border border-[#EAE5DC]">
                    {[
                      { id: 'instapay_bank', label: isRTL ? 'إنستاباي / بنكي' : 'InstaPay / Bank' },
                      { id: 'visa', label: isRTL ? 'بطاقة بنكية / فيزا' : 'Visa / Card' },
                      { id: 'whatsapp', label: isRTL ? 'تأكيد واتساب' : 'WhatsApp' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPaymentMethod(tab.id as any)}
                        className={`py-2.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                          paymentMethod === tab.id
                            ? 'bg-white text-[#1A1816] shadow-xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab 1: InstaPay, Bank, Vodafone Cash */}
                  {paymentMethod === 'instapay_bank' && (
                    <div className="space-y-4 pt-1 animate-fade-in">
                      <div className="text-xs text-stone-600 font-medium">
                        {isRTL 
                          ? `يرجى تحويل قيمة عربون الليلة (${depositRequired.toLocaleString()} ج.م) لأحد الحسابات التالية، ثم إرفاق إيصال التحويل:`
                          : `Please transfer 1-night deposit (${depositRequired.toLocaleString()} EGP) to one of the following accounts:`}
                      </div>

                      {/* Bank Accounts Luxury Cards */}
                      <div className="space-y-3">
                        {/* InstaPay Card */}
                        <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#EAE5DC] flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-[#1A1816] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <span>{isRTL ? 'إنستا باي (InstaPay)' : 'InstaPay'}</span>
                            </div>
                            <div className="text-[11px] text-[#7A7265] mt-0.5">
                              {PAYMENT_DETAILS.instapay.accountName}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(PAYMENT_DETAILS.instapay.number, 'insta')}
                            className="bg-white hover:bg-[#1A1816] hover:text-white text-[#1A1816] border border-[#EAE5DC] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                          >
                            <span>{copiedKey === 'insta' ? (isRTL ? 'تم النسخ ✓' : 'Copied ✓') : PAYMENT_DETAILS.instapay.number}</span>
                            <Copy className="w-3 h-3 text-stone-400" />
                          </button>
                        </div>

                        {/* Vodafone Cash */}
                        <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#EAE5DC] flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-[#1A1816] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              <span>{isRTL ? 'محفظة فودافون كاش' : 'Vodafone Cash'}</span>
                            </div>
                            <div className="text-[11px] text-[#7A7265] mt-0.5">
                              {PAYMENT_DETAILS.vodafoneCash.accountName}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(PAYMENT_DETAILS.vodafoneCash.number, 'voda')}
                            className="bg-white hover:bg-[#1A1816] hover:text-white text-[#1A1816] border border-[#EAE5DC] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                          >
                            <span>{copiedKey === 'voda' ? (isRTL ? 'تم النسخ ✓' : 'Copied ✓') : PAYMENT_DETAILS.vodafoneCash.number}</span>
                            <Copy className="w-3 h-3 text-stone-400" />
                          </button>
                        </div>

                        {/* National Bank of Egypt */}
                        <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#EAE5DC] space-y-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-xs font-bold text-[#1A1816]">
                                {PAYMENT_DETAILS.bank.bankName}
                              </div>
                              <div className="text-[11px] text-[#7A7265]">
                                {PAYMENT_DETAILS.bank.accountName}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(PAYMENT_DETAILS.bank.accountNumber, 'acc')}
                              className="bg-white hover:bg-[#1A1816] hover:text-white text-[#1A1816] border border-[#EAE5DC] px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                            >
                              <span>{copiedKey === 'acc' ? (isRTL ? 'تم النسخ ✓' : 'Copied ✓') : PAYMENT_DETAILS.bank.accountNumber}</span>
                              <Copy className="w-3 h-3 text-stone-400" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Attach Transfer Receipt */}
                      <div className="pt-2 border-t border-[#EAE5DC] space-y-2">
                        <label className="block text-xs font-bold text-[#1A1816]">
                          {isRTL ? 'إرفاق إيصال التحويل أو سكرين شوت السداد' : 'Attach Transfer Receipt (Image or PDF)'}
                        </label>
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
                              console.error('Receipt upload failed:', err);
                              setUploadError(err?.message || (isRTL ? 'فشل رفع الإيصال' : 'Upload failed'));
                            } finally {
                              setIsUploadingReceipt(false);
                            }
                          }}
                          className="w-full text-xs text-stone-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1A1816] file:text-white hover:file:bg-black file:cursor-pointer cursor-pointer bg-[#FAF8F5] p-2.5 rounded-xl border border-[#EAE5DC]"
                        />

                        {isUploadingReceipt && (
                          <p className="text-xs font-bold text-amber-700 animate-pulse">
                            ⏳ {isRTL ? 'جاري رفع الإيصال...' : 'Uploading receipt...'}
                          </p>
                        )}

                        {receiptUrl && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>{isRTL ? 'تم إرفاق إيصال التحويل بنجاح' : 'Receipt attached'}</span>
                            </span>
                            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                              {isRTL ? 'معاينة' : 'Preview'}
                            </a>
                          </div>
                        )}

                        {uploadError && (
                          <p className="text-xs font-bold text-red-600">⚠️ {uploadError}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Visa Card Payment */}
                  {paymentMethod === 'visa' && (
                    <div className="bg-[#FAF8F5] p-6 rounded-xl border border-[#EAE5DC] text-center space-y-3 animate-fade-in">
                      <CreditCard className="w-8 h-8 text-[#9E7A4A] mx-auto" />
                      <h4 className="text-sm font-bold text-[#1A1816]">
                        {isRTL ? 'الدفع الإلكتروني الآمن بالبطاقة البنكية' : 'Secure Online Card Payment'}
                      </h4>
                      <p className="text-xs text-[#7A7265] max-w-md mx-auto leading-relaxed">
                        {isRTL 
                          ? `سيتم سداد عربون ليلة واحدة (${depositRequired.toLocaleString()} ج.م) لتأكيد الحجز الفوري. سيصلك رابط دفع مشفر ومباشر فور تأكيد الطلب.`
                          : `A 1-night deposit (${depositRequired.toLocaleString()} EGP) will be processed via secure payment link.`}
                      </p>
                    </div>
                  )}

                  {/* Tab 3: Direct WhatsApp */}
                  {paymentMethod === 'whatsapp' && (
                    <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-200 text-center space-y-3 animate-fade-in">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto text-lg font-bold">
                        💬
                      </div>
                      <h4 className="text-sm font-bold text-emerald-950">
                        {isRTL ? 'التأكيد المباشر عبر واتساب خدمة العملاء' : 'Instant Confirmation via WhatsApp'}
                      </h4>
                      <p className="text-xs text-emerald-900/80 max-w-md mx-auto leading-relaxed">
                        {isRTL 
                          ? 'يمكنك تأكيد الحجز الآن وسيقوم موظف الحجوزات بتنسيق تحويل العربون وتجهيز كارت الدخول الخاص بك.' 
                          : 'Confirm your request now and our concierge team will handle your deposit and access arrangements.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Terms Agreement & Final Action */}
                <form onSubmit={handleSubmitBooking} className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAE5DC] shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
                  {/* House Rules Checkbox */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowRulesModal(true)}
                        className="text-xs font-bold text-[#9E7A4A] hover:underline flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'قواعد وشروط الإقامة في مزار (اضغط للقراءة)' : 'Mazar House Rules (Click to view)'}</span>
                      </button>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE5DC] hover:border-stone-400 transition-all">
                      <input
                        type="checkbox"
                        required
                        checked={rulesAccepted}
                        onChange={(e) => setRulesAccepted(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#1A1816] rounded cursor-pointer"
                      />
                      <span className="text-xs text-[#5C554B] font-medium leading-relaxed">
                        {isRTL ? (
                          <>أقر بأني قرأت وأوافق على الالتزام الكامل بـ <span onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }} className="text-[#9E7A4A] underline font-bold">قواعد وشروط الإقامة</span> الخاصة بمجمع مزار الفندقي.</>
                        ) : (
                          <>I agree to comply with the <span onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }} className="text-[#9E7A4A] underline font-bold">house rules and terms</span> of Mazar Hotel Suites.</>
                        )}
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !rulesAccepted}
                      className="w-full bg-[#1A1816] hover:bg-black text-white font-bold py-4 px-8 rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{isRTL ? 'جاري تأكيد الحجز...' : 'Processing reservation...'}</span>
                        </span>
                      ) : (
                        <span>
                          {isRTL ? `تأكيد حجز الجناح (عربون ليلة: ${depositRequired.toLocaleString()} ج.م)` : `Confirm Reservation (${depositRequired.toLocaleString()} EGP)`}
                        </span>
                      )}
                    </button>

                    <p className="text-center text-[11px] text-[#7A7265] font-medium">
                      {isRTL ? 'سيتم اعتماد الحجز فورياً ومشاركتك كارت الدخول الإلكتروني' : 'Your reservation will be confirmed and electronic access details shared.'}
                    </p>
                  </div>

                  {/* Back Link */}
                  <div className="pt-2 border-t border-[#EAE5DC]">
                    <button
                      type="button"
                      onClick={() => setActiveStep(3)}
                      className="text-xs font-bold text-stone-500 hover:text-[#1A1816]"
                    >
                      {isRTL ? '← الرجوع لتعديل بيانات النزيل' : '← Back to Guest Info'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              RIGHT/SIDEBAR COLUMN: STICKY LUXURY FOLIO CARD (4 of 12 cols)
          ══════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-28 space-y-4">
            <div className="bg-white rounded-2xl border border-[#EAE5DC] shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
              
              {/* Folio Header */}
              <div className="p-5 border-b border-[#EAE5DC] bg-[#FAF8F5] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-[#1A1816]">
                  <Building2 className="w-4 h-4 text-[#9E7A4A]" />
                  <span>{isRTL ? 'ملخص حجز الإقامة' : 'Stay Summary'}</span>
                </div>
                <span className="text-[10px] font-bold text-[#9E7A4A] bg-white px-2 py-0.5 rounded border border-[#EAE5DC] uppercase">
                  Mazar Suites
                </span>
              </div>

              {/* Suite Preview */}
              {selectedUnit ? (
                <div className="p-5 space-y-4">
                  <div className="flex gap-3.5 items-center">
                    <div className="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden shrink-0 border border-[#EAE5DC]">
                      {selectedUnit.images && selectedUnit.images[0] ? (
                        <img src={selectedUnit.images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                          <Building2 className="w-6 h-6 stroke-[1]" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-[#1A1816] leading-snug">
                        {selectedUnit.title?.[language] || selectedUnit.id}
                      </h4>
                      <p className="text-[11px] text-[#7A7265] mt-0.5">
                        {selectedUnit.type === 'studio' ? (isRTL ? 'جناح استوديو فاخر' : 'Studio') : (isRTL ? 'شقة فندقية راقية' : 'Apartment')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveStep(1)}
                        className="text-[10px] font-bold text-[#9E7A4A] hover:underline mt-1"
                      >
                        {isRTL ? 'تغيير الوحدة' : 'Change Suite'}
                      </button>
                    </div>
                  </div>

                  {/* Dates Overview */}
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
                      <span className="font-bold text-[#9E7A4A]">{nights} {isRTL ? 'ليالي' : 'nights'}</span>
                    </div>
                  </div>

                  {/* Financial Breakdown (عربون ليلة واحدة) */}
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
                  {isRTL ? 'يرجى اختيار الوحدة الفندقية أولاً' : 'Please select a suite to view folio'}
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
                className="bg-[#FAF8F5] hover:bg-[#1A1816] hover:text-white text-[#1A1816] border border-[#EAE5DC] px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
              >
                {isRTL ? 'محادثة فورية' : 'Chat Now'}
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* ─── House Rules Modal ─── */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white max-w-lg w-full rounded-2xl border border-[#EAE5DC] shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE5DC]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#9E7A4A]" />
                <h3 className="text-base font-black text-[#1A1816]">
                  {isRTL ? 'قواعد وشروط الإقامة بمجمع مزار' : 'Mazar Hotel Suites Regulations'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-lg bg-[#FAF8F5] hover:bg-[#1A1816] hover:text-white flex items-center justify-center font-bold transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#5C554B] leading-relaxed">
              <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE5DC] space-y-1.5">
                <h4 className="font-black text-[#1A1816] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#9E7A4A]" />
                  <span>{isRTL ? 'مواعيد الدخول والمغادرة' : 'Check-In & Check-Out'}</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-stone-600 text-[11px]">
                  <li>{isRTL ? 'تسجيل الوصول: ابتداءً من الساعة 2:00 ظهراً.' : 'Check-in: from 2:00 PM onwards.'}</li>
                  <li>{isRTL ? 'تسجيل المغادرة: حتى الساعة 12:00 ظهراً كحد أقصى.' : 'Check-out: by 12:00 PM.'}</li>
                </ul>
              </div>

              <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE5DC] space-y-1.5">
                <h4 className="font-black text-[#1A1816] flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#9E7A4A]" />
                  <span>{isRTL ? 'إثبات الهوية واستلام الوحدة' : 'Identity Verification'}</span>
                </h4>
                <p className="text-stone-600 text-[11px]">
                  {isRTL
                    ? 'يُشترط تقديم بطاقة رقم قومي سارية أو جواز سفر أصلي لجميع النزيلين عند الاستلام طبقاً للتعليمات الأمنية.'
                    : 'Valid official ID or passport is required for all guests upon arrival.'}
                </p>
              </div>

              <div className="p-4 bg-red-50/70 rounded-xl border border-red-100 space-y-1.5 text-red-950">
                <h4 className="font-black text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>{isRTL ? 'سياسة الهدوء والأمان' : 'Peace & Safety Policy'}</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-red-900/90 text-[11px]">
                  <li>{isRTL ? 'يُمنع منعاً باتاً استقبال زوار غير مسجلين لدى إدارة مزار.' : 'Unregistered guests/visitors are strictly prohibited.'}</li>
                  <li>{isRTL ? 'يُمنع إدخال أو تداول المشروبات الكحولية أو الممنوعات داخل المبنى.' : 'Alcohol and illegal substances are strictly prohibited.'}</li>
                  <li>{isRTL ? 'تلتزم إدارة مزار بتوفير أعلى درجات الهدوء والراحة لجميع النزلاء.' : 'Mazar strictly maintains a quiet, peaceful luxury environment.'}</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setRulesAccepted(true);
                  setShowRulesModal(false);
                }}
                className="flex-1 bg-[#1A1816] text-white py-3 rounded-xl font-bold text-xs hover:bg-black transition-all shadow-xs"
              >
                {isRTL ? 'قرأت وأوافق على الالتزام الكامل' : 'I have read and agree'}
              </button>
              <Link
                href="/mazar/rules"
                target="_blank"
                className="py-3 px-4 rounded-xl border border-[#EAE5DC] text-[#7A7265] hover:text-[#1A1816] font-bold text-xs text-center transition-colors"
              >
                {isRTL ? 'عرض صفحة القواعد الكاملة' : 'View Full Rules'}
              </Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
