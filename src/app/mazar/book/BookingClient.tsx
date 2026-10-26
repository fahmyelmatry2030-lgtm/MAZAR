'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Calendar from '@/components/Calendar';
import { useLanguage } from '@/lib/LanguageContext';
import { processAndUploadReceipt, processAndUploadDocument } from '@/lib/uploadHelper';
import { resolveUnitVideo, formatDateDMY } from '@/lib/utils';
import PaymentInfoBox from '@/components/PaymentInfoBox';

export default function BookingPage() {
  const { t, isRTL, language } = useLanguage();

  // ─── 4-Step Booking Sequence ───
  // 1: اختيار الوحدة (Unit Selection)
  // 2: تحديد التواريخ (Dates & Nights)
  // 3: بيانات الضيف والإثبات (Guest Details & ID)
  // 4: تأكيد الحجز وعربون ليلة واحدة (1-Night Deposit & Confirmation)
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
  const [isLoading, setIsLoading] = useState(false);
  const [step1Focus, setStep1Focus] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [showCalendar, setShowCalendar] = useState(false);
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
  const [showRulesModal, setShowRulesModal] = useState(false);

  const stepContainerRef = useRef<HTMLDivElement>(null);

  const ADMIN_WHATSAPP = '201108109969';

  const formatDate = (dateStr: string) => {
    return formatDateDMY(dateStr);
  };

  const getSafeUnitPrice = (unit: any): number => {
    if (!unit) return 3000;
    const num = parseInt(String(unit.price || '').replace(/[^0-9]/g, ''), 10) || 0;
    if (num >= 1000) return num;
    const idStr = String(unit.id || '').toLowerCase();
    if (idStr.startsWith('apt-') || idStr.startsWith('ext-')) return 4000;
    return 3000;
  };

  // ─── Initial Load & URL Parameters ───
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

        // 1. Fetch units
        const res = await fetch('/api/units');
        const unitsData = res.ok ? await res.json() : [];
        const activeUnits = unitsData.filter((u: any) => u.status === 'متاح' || !u.status);
        setAllUnits(activeUnits);
        setAvailableUnits(activeUnits);

        // 2. Fetch bookings for availability & booked dates
        const bookingsRes = await fetch('/api/bookings', { cache: 'no-store' });
        const allBookings = bookingsRes.ok ? await bookingsRes.json() : [];

        // If unitParam is present, lock to it and load its booked dates
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

          // If both unit and dates are provided, go directly to Step 3 (Guest Info)
          if (checkInParam && checkOutParam) {
            setActiveStep(3);
          } else {
            // Unit is known, advance to Step 2 (Dates)
            setActiveStep(2);
          }
        } else if (checkInParam && checkOutParam) {
          // Dates are known, filter available units and stay at Step 1 (or 2)
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
          // Standard fresh visit -> Step 1 (Select Unit)
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

  // Helper to scroll smoothly to current step
  const scrollToStepContainer = () => {
    if (stepContainerRef.current) {
      stepContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handle advancing from Step 1 (Unit Selection)
  const handleProceedFromUnit = () => {
    if (!selectedUnitId) {
      alert(isRTL ? 'يرجى اختيار الوحدة الفندقية أولاً' : 'Please select a unit first');
      return;
    }
    setActiveStep(2);
    scrollToStepContainer();
  };

  // Handle advancing from Step 2 (Dates Selection)
  const handleProceedFromDates = () => {
    if (!checkIn || !checkOut) {
      alert(isRTL ? 'يرجى تحديد تاريخ الوصول وتاريخ المغادرة' : 'Please select arrival and departure dates');
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      alert(isRTL ? 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول' : 'Departure date must be after arrival date');
      return;
    }
    setActiveStep(3);
    scrollToStepContainer();
  };

  // Handle advancing from Step 3 (Guest Info & ID)
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

  // Financial calculations:
  // "المفروض يدفع كام؟ المفروض يدفع الحجز يكون بقيمة ليلة واحدة من اللي هو حاجزها."
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
      alert(isRTL ? 'يرجى إدخال الاسم ورقم الواتساب' : 'Please enter name and phone');
      setActiveStep(3);
      return;
    }
    if (!rulesAccepted) {
      alert(isRTL ? 'يرجى الموافقة على قواعد وشروط الإقامة للمتابعة.' : 'Please accept house rules to proceed.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const methodLabel = paymentMethod === 'visa' 
      ? 'فيزا (بطاقة بنكية)' 
      : paymentMethod === 'instapay_bank' 
        ? 'إنستا باي / تحويل بنكي / فودافون كاش' 
        : 'تأكيد مباشر عبر واتساب';

    const notesParts: string[] = [];
    if (receiptUrl) notesParts.push(`إيصال العربون: ${receiptUrl}`);
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

      // WhatsApp Notification to Admin
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
        `📅 *الفترة:* من ${formatDate(checkIn)} إلى ${formatDate(checkOut)} (${nights} ليالي)\n` +
        `💰 *إجمالي الإقامة:* ${totalAmount} ج.م (${nights} ليالي × ${pricePerNight} ج.م)\n` +
        `🌟 *المطلوب سداده لتأكيد الحجز (عربون ليلة):* ${depositRequired} ج.م\n` +
        `💵 *المتبقي عند الوصول والاستلام:* ${remainingOnArrival} ج.م\n` +
        `💳 *وسيلة السداد:* ${methodLabel}\n` +
        (idDocUrl ? `🪪 *إثبات الشخصية:* ${idDocUrl}\n` : '') +
        paymentNotice + `\n\nيرجى تأكيد الحجز معي ومطابقة البيانات.`;

      const waUrl = `https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}&text=${encodeURIComponent(adminMsg)}`;
      window.location.href = waUrl;

    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setError(isRTL ? 'حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.' : 'Error saving request. Please try again.');
      alert(isRTL ? 'حدث خطأ أثناء حفظ الطلب.' : 'An error occurred while saving the request.');
    }
  };

  // Grouped Units
  const studioUnits = allUnits.filter((u: any) => u.type === 'studio');
  const apartmentUnits = allUnits.filter((u: any) => u.type === 'apartment');

  // Success Screen
  if (isSuccess) {
    return (
      <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] flex flex-col justify-center items-center p-6 animate-fade-in font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="bg-white p-8 md:p-14 rounded-[40px] md:rounded-[50px] border border-[#EAE4D9] shadow-2xl text-center max-w-2xl w-full relative overflow-hidden">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner border border-emerald-100">
            ✓
          </div>

          <h2 className="text-3xl md:text-5xl font-black text-[#2A2723] mb-4 tracking-tight">
            {isRTL ? 'تهانينا، تم استلام طلب حجزك بنجاح!' : 'Congratulations, booking received!'}
          </h2>

          <div className="bg-[#FDFBF7] py-6 px-8 rounded-3xl mb-8 border border-[#EAE4D9] text-center space-y-3">
            <p className="text-[11px] font-black text-[#C1A68D] uppercase tracking-widest">{isRTL ? 'تفاصيل الحجز' : 'Booking Summary'}</p>
            <p className="text-2xl font-black text-[#2A2723]">{selectedUnit ? (selectedUnit.title?.[language] || selectedUnitId) : selectedUnitId}</p>
            
            <div className="flex justify-center items-center gap-6 pt-2 border-t border-[#EAE4D9]/60 text-sm font-black">
              <div>
                <span className="text-gray-400 text-[10px] block font-bold">{isRTL ? 'الوصول (دخول)' : 'Check-in'}</span>
                <span dir="ltr">{formatDate(checkIn)}</span>
              </div>
              <span className="text-[#C1A68D]">➔</span>
              <div>
                <span className="text-gray-400 text-[10px] block font-bold">{isRTL ? 'المغادرة (خروج)' : 'Check-out'}</span>
                <span dir="ltr">{formatDate(checkOut)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#EAE4D9]/60 flex justify-between items-center text-xs font-bold px-2">
              <span className="text-[#7A7061]">{isRTL ? 'عربون تأكيد الحجز (ليلة واحدة):' : '1-Night Deposit:'}</span>
              <span className="text-emerald-700 font-black text-sm">{depositRequired} ج.م</span>
            </div>
          </div>

          <p className="text-sm md:text-base text-[#5C554B] font-bold mb-8">
            {isRTL
              ? 'جاري تحويلك الآن لمحادثة واتساب مزار لمتابعة وتأكيد الحجز النهائي واستلام كارت الدخول.'
              : 'Redirecting to WhatsApp to finalize reservation and arrange check-in.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href={`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] text-white font-black py-4 rounded-2xl hover:bg-[#128C7E] shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-2 text-base"
            >
              💬 {isRTL ? 'متابعة عبر واتساب' : 'Continue on WhatsApp'}
            </a>
            <Link href="/" className="w-full bg-[#2A2723] text-white font-black py-4 rounded-2xl hover:bg-black transition-all text-sm flex items-center justify-center gap-2">
              🏠 {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] selection:bg-[#C1A68D] selection:text-white relative overflow-x-hidden font-sans" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Fixed / Sticky Luxury Header (ثابت على الموبايل والـ PC دائماً) ── */}
      <header className="sticky top-0 z-50 w-full bg-[#FDFBF7]/95 backdrop-blur-md border-b border-[#EAE4D9]/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3.5 flex justify-between items-center">
          {/* Brand Logo & Prominent Title */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <Logo size={48} mdSize={56} />
            <div className="flex flex-col text-right">
              <span className="text-xl md:text-2xl font-black text-[#2A2723] tracking-tight group-hover:text-[#C1A68D] transition-colors leading-none">
                مجمع مزار
              </span>
              <span className="text-[9px] md:text-[10px] font-bold text-[#C1A68D] tracking-widest uppercase mt-0.5">
                MAZAR HOTEL SUITES
              </span>
            </div>
          </Link>

          {/* Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-[#5C554B]">
            <Link href="/" className="hover:text-[#2A2723] transition-colors">{t.common.home}</Link>
            <Link href="/mazar/about" className="hover:text-[#2A2723] transition-colors">{t.common.about}</Link>
            <Link href="/mazar/rules" className="hover:text-[#2A2723] transition-colors">{t.common.rules}</Link>
            <Link href="/mazar/how-to-book" className="hover:text-[#2A2723] transition-colors">{t.common.howToBook}</Link>
            <Link href="/social" className="hover:text-[#2A2723] transition-colors">{isRTL ? 'السوشيال ميديا' : 'Social'}</Link>
          </nav>

          {/* Quick Actions (WhatsApp & Language) */}
          <div className="flex items-center gap-3">
            <a
              href={`https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5b] text-white px-3.5 py-1.5 rounded-full text-xs font-black shadow-sm transition-all"
              title="تواصل مباشر واتساب"
            >
              <span>💬</span>
              <span className="font-mono tracking-wider">01108109969</span>
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div ref={stepContainerRef} className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* ══════════════════════════════════════════════════════════════
            STEPPER (شريط خطوات الحجز العلوي)
        ══════════════════════════════════════════════════════════════ */}
        <section className="mb-8 md:mb-12">
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-5xl font-black text-[#2A2723] tracking-tight mb-2">
              {isRTL ? 'حجز إقامتك في مزار' : 'Book Your Stay at Mazar'}
            </h1>
            <p className="text-xs md:text-base text-[#7A7061] font-bold">
              {isRTL ? 'خطوات حجز مرنة وسهلة في 4 مراحل واضحة وبسيطة' : 'Smooth, easy 4-step reservation process'}
            </p>
          </div>

          {/* Sequence Stepper Pills */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 max-w-4xl mx-auto">
            {[
              { num: 1, title: isRTL ? '1. اختيار الوحدة' : '1. Unit', icon: '🏢' },
              { num: 2, title: isRTL ? '2. تحديد التواريخ' : '2. Dates', icon: '📅' },
              { num: 3, title: isRTL ? '3. بيانات الضيف' : '3. Guest & ID', icon: '👤🪪' },
              { num: 4, title: isRTL ? '4. تأكيد الحجز' : '4. Confirm', icon: '💳' },
            ].map((st) => {
              const isActive = activeStep === st.num;
              const isPassed = activeStep > st.num;
              return (
                <button
                  key={st.num}
                  type="button"
                  onClick={() => setActiveStep(st.num)}
                  className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl font-black text-xs md:text-sm transition-all border ${
                    isActive
                      ? 'bg-[#2A2723] text-white border-[#2A2723] shadow-md scale-[1.02]'
                      : isPassed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-white text-[#7A7061] border-[#EAE4D9] hover:border-[#C1A68D]'
                  }`}
                >
                  <span className="text-base">{isPassed ? '✓' : st.icon}</span>
                  <span className="truncate">{st.title}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            STEP 1: اختيار الوحدة الفندقية
        ══════════════════════════════════════════════════════════════ */}
        {activeStep === 1 && (
          <section className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#EAE4D9] shadow-xs">
              <div>
                <span className="text-xs font-black text-[#C1A68D] uppercase tracking-widest block mb-1">
                  {isRTL ? 'الخطوة الأولى' : 'Step 1'}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-[#2A2723]">
                  {isRTL ? 'اختر الوحدة الفندقية المناسبة لك' : 'Select Your Preferred Unit'}
                </h2>
                <p className="text-xs md:text-sm text-[#7A7061] font-bold mt-1">
                  {isRTL ? 'استوديوهات فندقية مجهزة وشقق فاخرة في أرقى مناطق مدينة نصر' : 'Fully furnished hotel studios and luxury apartments in Nasr City'}
                </p>
              </div>

              {selectedUnitId && (
                <button
                  type="button"
                  onClick={handleProceedFromUnit}
                  className="bg-[#2A2723] hover:bg-black text-white font-black px-8 py-4 rounded-2xl text-sm transition-all shadow-md active:scale-95 shrink-0 flex items-center justify-center gap-2"
                >
                  <span>{isRTL ? 'تأكيد الوحدة والمتابعة للتواريخ ➔' : 'Confirm Unit & Select Dates ➔'}</span>
                </button>
              )}
            </div>

            {/* Units Categories Grid */}
            <div className="space-y-10">
              {/* Studios */}
              {studioUnits.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EAE4D9]">
                    <span className="text-2xl">✨</span>
                    <h3 className="text-lg md:text-xl font-black text-[#2A2723]">
                      {isRTL ? 'الاستوديوهات الفندقية (فرع 1 وفرع 2)' : 'Hotel Studios (Branch 1 & 2)'}
                    </h3>
                    <span className="text-xs text-[#7A7061] font-bold bg-[#FDFBF7] px-3 py-1 rounded-full border border-[#EAE4D9]">
                      {studioUnits.length} {isRTL ? 'وحدة متاحة' : 'Units'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studioUnits.map((u: any) => {
                      const isSelected = selectedUnitId === u.id;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedUnitId(u.id)}
                          className={`group cursor-pointer rounded-3xl border-2 transition-all overflow-hidden flex flex-col justify-between ${
                            isSelected
                              ? 'bg-white border-[#2A2723] shadow-xl ring-2 ring-[#2A2723]/10 scale-[1.01]'
                              : 'bg-white border-[#EAE4D9] hover:border-[#C1A68D] hover:shadow-md'
                          }`}
                        >
                          <div className="relative aspect-[16/10] bg-[#F7F5F0] overflow-hidden">
                            {u.images && u.images[0] ? (
                              <img src={u.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl">🏢</div>
                            )}
                            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full">
                              {u.id}
                            </div>
                            {isSelected && (
                              <div className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                                <span>✓</span>
                                <span>{isRTL ? 'تم الاختيار' : 'Selected'}</span>
                              </div>
                            )}
                          </div>

                          <div className="p-4 space-y-2 flex-grow flex flex-col justify-between">
                            <div>
                              <h4 className="font-black text-base text-[#2A2723]">{u.title?.[language] || u.id}</h4>
                              <p className="text-xs text-[#7A7061] font-bold line-clamp-2 mt-1">{u.description?.[language]}</p>
                            </div>

                            <div className="pt-3 border-t border-[#F0EBE3] flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-[#7A7061] block font-bold">{isRTL ? 'السعر' : 'Price'}</span>
                                <span className="text-sm font-black text-[#C1A68D]">{u.price || '3000 ج.م / الليلة'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUnitId(u.id);
                                  handleProceedFromUnit();
                                }}
                                className={`text-xs font-black px-4 py-2 rounded-xl transition-all ${
                                  isSelected
                                    ? 'bg-[#2A2723] text-white shadow-sm'
                                    : 'bg-[#F7F5F0] text-[#2A2723] hover:bg-[#2A2723] hover:text-white'
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
                </div>
              )}

              {/* Apartments */}
              {apartmentUnits.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EAE4D9]">
                    <span className="text-2xl">🏘️</span>
                    <h3 className="text-lg md:text-xl font-black text-[#2A2723]">
                      {isRTL ? 'الشقق الفندقية العائلية والفاخرة (سيتي ستارز وعباس العقاد)' : 'Luxury Apartments (City Stars & Abbas El-Akkad)'}
                    </h3>
                    <span className="text-xs text-[#7A7061] font-bold bg-[#FDFBF7] px-3 py-1 rounded-full border border-[#EAE4D9]">
                      {apartmentUnits.length} {isRTL ? 'شقة متاحة' : 'Units'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {apartmentUnits.map((u: any) => {
                      const isSelected = selectedUnitId === u.id;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedUnitId(u.id)}
                          className={`group cursor-pointer rounded-3xl border-2 transition-all overflow-hidden flex flex-col justify-between ${
                            isSelected
                              ? 'bg-white border-[#2A2723] shadow-xl ring-2 ring-[#2A2723]/10 scale-[1.01]'
                              : 'bg-white border-[#EAE4D9] hover:border-[#C1A68D] hover:shadow-md'
                          }`}
                        >
                          <div className="relative aspect-[16/10] bg-[#F7F5F0] overflow-hidden">
                            {u.images && u.images[0] ? (
                              <img src={u.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl">🏢</div>
                            )}
                            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full">
                              {u.id}
                            </div>
                            {isSelected && (
                              <div className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                                <span>✓</span>
                                <span>{isRTL ? 'تم الاختيار' : 'Selected'}</span>
                              </div>
                            )}
                          </div>

                          <div className="p-4 space-y-2 flex-grow flex flex-col justify-between">
                            <div>
                              <h4 className="font-black text-base text-[#2A2723]">{u.title?.[language] || u.id}</h4>
                              <p className="text-xs text-[#7A7061] font-bold line-clamp-2 mt-1">{u.description?.[language]}</p>
                            </div>

                            <div className="pt-3 border-t border-[#F0EBE3] flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-[#7A7061] block font-bold">{isRTL ? 'السعر' : 'Price'}</span>
                                <span className="text-sm font-black text-[#C1A68D]">{u.price || '4000 ج.م / الليلة'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUnitId(u.id);
                                  handleProceedFromUnit();
                                }}
                                className={`text-xs font-black px-4 py-2 rounded-xl transition-all ${
                                  isSelected
                                    ? 'bg-[#2A2723] text-white shadow-sm'
                                    : 'bg-[#F7F5F0] text-[#2A2723] hover:bg-[#2A2723] hover:text-white'
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
                </div>
              )}
            </div>

            {/* Bottom Proceed Bar */}
            {selectedUnitId && (
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleProceedFromUnit}
                  className="w-full sm:w-auto bg-[#2A2723] hover:bg-black text-white font-black px-10 py-5 rounded-2xl text-base transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                >
                  <span>{isRTL ? 'المتابعة لتحديد التواريخ والأيام ➔' : 'Proceed to Dates & Nights ➔'}</span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 2: تحديد التواريخ والأيام المتاحة
        ══════════════════════════════════════════════════════════════ */}
        {activeStep === 2 && (
          <section className="space-y-8 animate-fade-in max-w-4xl mx-auto">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#EAE4D9] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-[#C1A68D] uppercase tracking-widest block mb-1">
                  {isRTL ? 'الخطوة الثانية' : 'Step 2'}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-[#2A2723]">
                  {isRTL ? 'حدد تواريخ وأيام الإقامة' : 'Select Stay Dates & Nights'}
                </h2>
                <p className="text-xs md:text-sm text-[#7A7061] font-bold mt-1">
                  {isRTL ? 'تاريخ الوصول والمغادرة بنظام يوم / شهر / سنة' : 'Check-in and Check-out in Day / Month / Year'}
                </p>
              </div>

              {selectedUnit && (
                <div className="bg-[#FDFBF7] px-4 py-2.5 rounded-2xl border border-[#EAE4D9] flex items-center gap-3 shrink-0">
                  <span className="text-xl">🏢</span>
                  <div>
                    <span className="text-[10px] text-[#7A7061] block font-bold">{isRTL ? 'الوحدة المختارة' : 'Unit'}</span>
                    <span className="text-xs font-black text-[#2A2723]">{selectedUnit.title?.[language] || selectedUnit.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="text-[10px] text-[#C1A68D] font-black underline hover:text-[#2A2723] mr-2"
                  >
                    {isRTL ? 'تغيير' : 'Change'}
                  </button>
                </div>
              )}
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Check-in */}
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#EAE4D9]">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛬</span>
                    <h3 className="text-base font-black text-[#2A2723]">{isRTL ? 'تاريخ الوصول (دخول)' : 'Check-In Date'}</h3>
                  </div>
                  <span className="text-xs font-mono font-black text-[#C1A68D] bg-[#FDFBF7] px-3 py-1 rounded-full border border-[#EAE4D9]" dir="ltr">
                    {formatDate(checkIn)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center" dir="rtl">
                  {(() => {
                    const [y, m, d] = checkIn.split('-');
                    const maxDays = new Date(Number(y), Number(m), 0).getDate();
                    const daysArr = Array.from({ length: maxDays }, (_, i) => (i + 1).toString().padStart(2, '0'));
                    const monthsArr = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
                    const yearsArr = [new Date().getFullYear().toString(), (new Date().getFullYear() + 1).toString()];

                    return (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 block">{isRTL ? 'اليوم' : 'Day'}</label>
                          <select
                            value={d}
                            onChange={(e) => setCheckIn(`${y}-${m}-${e.target.value}`)}
                            className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-xl p-2.5 text-sm font-black text-center outline-none cursor-pointer"
                          >
                            {daysArr.map(dayVal => <option key={dayVal} value={dayVal}>{dayVal}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 block">{isRTL ? 'الشهر' : 'Month'}</label>
                          <select
                            value={m}
                            onChange={(e) => {
                              const newMax = new Date(Number(y), Number(e.target.value), 0).getDate();
                              const safeD = Number(d) > newMax ? newMax.toString().padStart(2, '0') : d;
                              setCheckIn(`${y}-${e.target.value}-${safeD}`);
                            }}
                            className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-xl p-2.5 text-sm font-black text-center outline-none cursor-pointer"
                          >
                            {monthsArr.map(monthVal => <option key={monthVal} value={monthVal}>{monthVal}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 block">{isRTL ? 'السنة' : 'Year'}</label>
                          <select
                            value={y}
                            onChange={(e) => setCheckIn(`${e.target.value}-${m}-${d}`)}
                            className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-xl p-2.5 text-sm font-black text-center outline-none cursor-pointer"
                          >
                            {yearsArr.map(yearVal => <option key={yearVal} value={yearVal}>{yearVal}</option>)}
                          </select>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Check-out */}
              <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#EAE4D9]">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛫</span>
                    <h3 className="text-base font-black text-[#E63946]">{isRTL ? 'تاريخ المغادرة (خروج)' : 'Check-Out Date'}</h3>
                  </div>
                  <span className="text-xs font-mono font-black text-[#E63946] bg-red-50 px-3 py-1 rounded-full border border-red-100" dir="ltr">
                    {formatDate(checkOut)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center" dir="rtl">
                  {(() => {
                    const [y, m, d] = checkOut.split('-');
                    const maxDays = new Date(Number(y), Number(m), 0).getDate();
                    const daysArr = Array.from({ length: maxDays }, (_, i) => (i + 1).toString().padStart(2, '0'));
                    const monthsArr = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
                    const yearsArr = [new Date().getFullYear().toString(), (new Date().getFullYear() + 1).toString()];

                    return (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 block">{isRTL ? 'اليوم' : 'Day'}</label>
                          <select
                            value={d}
                            onChange={(e) => setCheckOut(`${y}-${m}-${e.target.value}`)}
                            className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-xl p-2.5 text-sm font-black text-center outline-none cursor-pointer"
                          >
                            {daysArr.map(dayVal => <option key={dayVal} value={dayVal}>{dayVal}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 block">{isRTL ? 'الشهر' : 'Month'}</label>
                          <select
                            value={m}
                            onChange={(e) => {
                              const newMax = new Date(Number(y), Number(e.target.value), 0).getDate();
                              const safeD = Number(d) > newMax ? newMax.toString().padStart(2, '0') : d;
                              setCheckOut(`${y}-${e.target.value}-${safeD}`);
                            }}
                            className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-xl p-2.5 text-sm font-black text-center outline-none cursor-pointer"
                          >
                            {monthsArr.map(monthVal => <option key={monthVal} value={monthVal}>{monthVal}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 block">{isRTL ? 'السنة' : 'Year'}</label>
                          <select
                            value={y}
                            onChange={(e) => setCheckOut(`${e.target.value}-${m}-${d}`)}
                            className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-xl p-2.5 text-sm font-black text-center outline-none cursor-pointer"
                          >
                            {yearsArr.map(yearVal => <option key={yearVal} value={yearVal}>{yearVal}</option>)}
                          </select>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Visual Calendar Toggle */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="inline-flex items-center gap-2 bg-white border border-[#EAE4D9] text-[#2A2723] hover:border-[#C1A68D] px-5 py-2.5 rounded-full text-xs font-black transition-all shadow-xs"
              >
                <span>📅</span>
                <span>{showCalendar ? (isRTL ? 'إخفاء التقويم البصري' : 'Hide Calendar') : (isRTL ? 'عرض التقويم البصري' : 'Show Visual Calendar')}</span>
              </button>
            </div>

            {showCalendar && (
              <div className="bg-white p-6 rounded-3xl border border-[#EAE4D9] shadow-sm animate-fade-in max-w-xl mx-auto">
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
            )}

            {/* Nights Summary Banner */}
            {nights > 0 && (
              <div className="bg-[#2A2723] text-white p-6 rounded-3xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌙</span>
                  <div>
                    <span className="text-xs text-[#C1A68D] block font-bold">{isRTL ? 'مدة الإقامة الإجمالية' : 'Stay Duration'}</span>
                    <span className="text-lg md:text-xl font-black">{nights} {isRTL ? 'ليالي' : 'Nights'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-bold text-stone-300">
                  <span dir="ltr">{formatDate(checkIn)}</span>
                  <span>➔</span>
                  <span dir="ltr">{formatDate(checkOut)}</span>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="bg-white border border-[#EAE4D9] hover:border-[#2A2723] text-[#2A2723] font-black px-6 py-4 rounded-2xl text-xs md:text-sm transition-all"
              >
                {isRTL ? '← الرجوع لاختيار الوحدة' : '← Back to Units'}
              </button>

              <button
                type="button"
                onClick={handleProceedFromDates}
                className="bg-[#2A2723] hover:bg-black text-white font-black px-8 py-4 rounded-2xl text-xs md:text-sm transition-all shadow-xl active:scale-95 flex items-center gap-2"
              >
                <span>{isRTL ? 'المتابعة لبيانات الضيف والإثبات ➔' : 'Proceed to Guest Details ➔'}</span>
              </button>
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 3: بيانات الضيف وإثبات الشخصية (Sequential & Elegant)
        ══════════════════════════════════════════════════════════════ */}
        {activeStep === 3 && (
          <section className="space-y-8 animate-fade-in max-w-4xl mx-auto">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#EAE4D9] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-[#C1A68D] uppercase tracking-widest block mb-1">
                  {isRTL ? 'الخطوة الثالثة' : 'Step 3'}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-[#2A2723]">
                  {isRTL ? 'بيانات الضيف وإثبات الشخصية' : 'Guest Details & Identification'}
                </h2>
                <p className="text-xs md:text-sm text-[#7A7061] font-bold mt-1">
                  {isRTL ? 'بيانات التواصل الأساسية ورفع إثبات الهوية لتجهيز عقد الإقامة' : 'Primary contact info and valid ID upload for check-in preparation'}
                </p>
              </div>

              <div className="bg-[#FDFBF7] px-4 py-2.5 rounded-2xl border border-[#EAE4D9] flex items-center gap-3 shrink-0">
                <span className="text-xl">📅</span>
                <div>
                  <span className="text-[10px] text-[#7A7061] block font-bold">{isRTL ? 'الإقامة' : 'Stay'}</span>
                  <span className="text-xs font-black text-[#2A2723]">{nights} {isRTL ? 'ليالي' : 'Nights'}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleProceedFromGuestInfo} className="space-y-6">
              {/* Row 1: Name and Phone side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-2">
                  <label className="block text-xs font-black text-[#2A2723]">
                    👤 {isRTL ? 'اسم الضيف بالكامل (رب الأسرة أو المستأجر)' : 'Full Guest Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isRTL ? 'مثال: أ/ محمد أحمد فوزي' : 'e.g. John Doe'}
                    className="w-full bg-[#FDFBF7] border border-[#EAE4D9] focus:border-[#C1A68D] focus:bg-white rounded-2xl px-4 py-3.5 outline-none font-bold text-sm text-[#2A2723] transition-all"
                  />
                  <p className="text-[10px] text-[#7A7061] font-bold">
                    {isRTL ? 'يُكتب كما هو مدون في بطاقة الرقم القومي أو جواز السفر' : 'As written in official ID'}
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-2">
                  <label className="block text-xs font-black text-[#2A2723]">
                    📱 {isRTL ? 'رقم الواتساب للتواصل وتأكيد الحجز' : 'WhatsApp Contact Number'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+20 1..."
                    dir="ltr"
                    className="w-full bg-[#FDFBF7] border border-[#EAE4D9] focus:border-[#25D366] focus:bg-white rounded-2xl px-4 py-3.5 outline-none font-mono font-black text-base text-[#2A2723] transition-all"
                  />
                  <p className="text-[10px] text-[#7A7061] font-bold">
                    {isRTL ? 'سيتم إرسال كارت الدخول وتفاصيل الوصول على هذا الرقم' : 'Access card and details will be sent here'}
                  </p>
                </div>
              </div>

              {/* Row 2: Guests Count & ID Upload side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Guests Count */}
                <div className="bg-white p-6 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-3">
                  <label className="block text-xs font-black text-[#2A2723]">
                    👥 {isRTL ? 'عدد الضيوف والمقيمين' : 'Number of Guests'}
                  </label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setGuestsCount(num)}
                        className={`py-3 rounded-xl font-black text-sm transition-all border ${
                          guestsCount === num
                            ? 'bg-[#2A2723] text-white border-[#2A2723] shadow-sm'
                            : 'bg-[#F7F5F0] text-[#7A7061] border-transparent hover:border-[#EAE4D9]'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#7A7061] font-bold">
                    {isRTL ? 'أقصى عدد للضيوف حسب سعة الوحدة المختارة' : 'Maximum based on unit capacity'}
                  </p>
                </div>

                {/* ID Upload */}
                <div className="bg-white p-6 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-[#2A2723]">
                      🪪 {isRTL ? 'إثبات الشخصية (بطاقة أو باسبور)' : 'National ID or Passport'}
                    </label>
                    <span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                      {isRTL ? 'مطلوب للإقامة' : 'Required'}
                    </span>
                  </div>

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
                        setIdDocError(err?.message || (isRTL ? 'فشل رفع المستند، يرجى المحاولة مرة أخرى.' : 'Upload failed. Please try again.'));
                      } finally {
                        setIsUploadingIdDoc(false);
                      }
                    }}
                    className="w-full text-xs text-[#7A7061] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#2A2723] file:text-white hover:file:bg-black file:cursor-pointer cursor-pointer bg-[#FDFBF7] p-2 rounded-2xl border border-[#EAE4D9]"
                  />

                  {isUploadingIdDoc && (
                    <p className="text-xs font-black text-amber-600 animate-pulse">⏳ {isRTL ? 'جاري رفع إثبات الشخصية...' : 'Uploading ID...'}</p>
                  )}

                  {idDocUrl && (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-black">
                      <span>✓ {isRTL ? 'تم رفع إثبات الشخصية بنجاح!' : 'ID uploaded successfully!'}</span>
                      <a href={idDocUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                        {isRTL ? 'معاينة' : 'Preview'}
                      </a>
                    </div>
                  )}

                  {idDocError && (
                    <p className="text-xs font-black text-red-500">⚠️ {idDocError}</p>
                  )}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="bg-white border border-[#EAE4D9] hover:border-[#2A2723] text-[#2A2723] font-black px-6 py-4 rounded-2xl text-xs md:text-sm transition-all"
                >
                  {isRTL ? '← الرجوع للتواريخ' : '← Back to Dates'}
                </button>

                <button
                  type="submit"
                  className="bg-[#2A2723] hover:bg-black text-white font-black px-8 py-4 rounded-2xl text-xs md:text-sm transition-all shadow-xl active:scale-95 flex items-center gap-2"
                >
                  <span>{isRTL ? 'المتابعة لحساب الشركة والدفع ➔' : 'Proceed to Payment ➔'}</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            STEP 4: حساب الشركة وعربون ليلة واحدة وتأكيد الحجز
        ══════════════════════════════════════════════════════════════ */}
        {activeStep === 4 && (
          <section className="space-y-8 animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#EAE4D9] shadow-xs">
              <span className="text-xs font-black text-[#C1A68D] uppercase tracking-widest block mb-1">
                {isRTL ? 'الخطوة الرابعة والأخيرة' : 'Step 4 / Final Confirmation'}
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-[#2A2723]">
                {isRTL ? 'تأكيد الحجز وسداد عربون ليلة واحدة' : 'Confirm Booking & 1-Night Deposit'}
              </h2>
              <p className="text-xs md:text-sm text-[#7A7061] font-bold mt-1">
                {isRTL 
                  ? 'لتأكيد حجز الوحدة الفندقية نهائياً، يتم سداد عربون ليلة واحدة فقط لحساب الشركة، والمتبقي عند الوصول' 
                  : 'To finalize reservation, a 1-night deposit is paid to the company account, with remainder due upon check-in'}
              </p>
            </div>

            {/* Financial Breakdown Card (عربون ليلة واحدة) */}
            <div className="bg-[#2A2723] text-white p-6 md:p-8 rounded-3xl shadow-xl space-y-5">
              <div className="flex justify-between items-center pb-4 border-b border-white/10 text-xs font-bold text-[#C1A68D]">
                <span>{selectedUnit?.title?.[language] || selectedUnitId}</span>
                <span dir="ltr">{formatDate(checkIn)} ➔ {formatDate(checkOut)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <span className="text-xs text-gray-400 block font-bold mb-1">{isRTL ? 'إجمالي مدة الإقامة:' : 'Total Stay:'}</span>
                  <span className="text-xl font-black text-white">{totalAmount.toLocaleString()} ج.م</span>
                  <span className="text-[10px] text-gray-400 block mt-1">({nights} ليالي × {pricePerNight} ج.م)</span>
                </div>

                <div className="bg-emerald-500/15 p-4 rounded-2xl border border-emerald-500/30">
                  <span className="text-xs text-emerald-300 block font-bold mb-1">
                    🌟 {isRTL ? 'المطلوب لتأكيد الحجز (عربون ليلة):' : 'Deposit (1 Night):'}
                  </span>
                  <span className="text-2xl font-black text-emerald-400">{depositRequired.toLocaleString()} ج.م</span>
                  <span className="text-[10px] text-emerald-200/80 block mt-1">{isRTL ? 'يُدفع الآن لاعتماد الحجز' : 'Paid now to confirm'}</span>
                </div>

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <span className="text-xs text-gray-400 block font-bold mb-1">{isRTL ? 'المتبقي عند الوصول:' : 'Remaining on Arrival:'}</span>
                  <span className="text-xl font-black text-white">{remainingOnArrival.toLocaleString()} ج.م</span>
                  <span className="text-[10px] text-gray-400 block mt-1">{isRTL ? 'يُسدد عند الاستلام والدخول' : 'Paid at check-in'}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-6">
              <h3 className="text-base font-black text-[#2A2723] flex items-center gap-2">
                <span>💳</span>
                <span>{isRTL ? 'اختر طريقة سداد عربون الليلة:' : 'Select Deposit Payment Method:'}</span>
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'instapay_bank', label: isRTL ? 'إنستاباي / تحويل بنكي' : 'InstaPay / Bank', icon: '⚡' },
                  { id: 'visa', label: isRTL ? 'الدفع بالفيزا' : 'Visa / Card', icon: '💳' },
                  { id: 'whatsapp', label: isRTL ? 'تواصل عبر واتساب' : 'Via WhatsApp', icon: '💬' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-3.5 px-3 rounded-2xl font-black text-xs md:text-sm transition-all border flex flex-col sm:flex-row items-center justify-center gap-2 ${
                      paymentMethod === m.id
                        ? 'bg-[#2A2723] text-white border-[#2A2723] shadow-md'
                        : 'bg-[#F7F5F0] text-[#7A7061] border-transparent hover:border-[#EAE4D9]'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab 1: InstaPay & Bank Transfer */}
              {paymentMethod === 'instapay_bank' && (
                <div className="space-y-4 pt-2 animate-fade-in">
                  <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EAE4D9] space-y-3">
                    <p className="text-xs text-[#5C554B] font-bold">
                      {isRTL 
                        ? `يرجى تحويل قيمة عربون الليلة (${depositRequired.toLocaleString()} ج.م) إلى أحد حسابات الشركة التالية:` 
                        : `Please transfer 1-night deposit (${depositRequired.toLocaleString()} EGP) to one of our company accounts:`}
                    </p>
                    <PaymentInfoBox isRTL={isRTL} />
                  </div>

                  {/* Receipt Upload */}
                  <div className="p-4 bg-white rounded-2xl border border-[#EAE4D9] space-y-2">
                    <label className="block text-xs font-black text-[#2A2723]">
                      🧾 {isRTL ? 'إرفاق إيصال التحويل أو سكرين شوت السداد' : 'Attach Transfer Receipt (Screenshot / PDF)'}
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
                      className="w-full text-xs text-[#7A7061] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#2A2723] file:text-white hover:file:bg-black file:cursor-pointer cursor-pointer bg-[#FDFBF7] p-2 rounded-2xl border border-[#EAE4D9]"
                    />

                    {isUploadingReceipt && (
                      <p className="text-xs font-black text-amber-600 animate-pulse">⏳ {isRTL ? 'جاري رفع إيصال التحويل...' : 'Uploading receipt...'}</p>
                    )}

                    {receiptUrl && (
                      <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-black">
                        <span>✓ {isRTL ? 'تم رفع إيصال التحويل بنجاح!' : 'Receipt uploaded successfully!'}</span>
                        <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                          {isRTL ? 'معاينة الإيصال' : 'Preview'}
                        </a>
                      </div>
                    )}

                    {uploadError && (
                      <p className="text-xs font-black text-red-500">⚠️ {uploadError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Visa Card */}
              {paymentMethod === 'visa' && (
                <div className="p-6 bg-[#FDFBF7] rounded-2xl border border-[#EAE4D9] space-y-4 animate-fade-in text-center">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl mx-auto border border-blue-100">
                    💳
                  </div>
                  <h4 className="text-base font-black text-[#2A2723]">
                    {isRTL ? 'الدفع الآمن بالفيزا والبطاقات البنكية' : 'Secure Online Card Payment'}
                  </h4>
                  <p className="text-xs text-[#7A7061] font-bold max-w-md mx-auto leading-relaxed">
                    {isRTL
                      ? `سيتم سداد عربون ليلة واحدة (${depositRequired.toLocaleString()} ج.م) لتأكيد الحجز. بمجرد الضغط على تأكيد سيتم توجيهك بأمان أو إرسال رابط الدفع المباشر المشفر.`
                      : `A 1-night deposit (${depositRequired.toLocaleString()} EGP) will be processed securely.`}
                  </p>
                </div>
              )}

              {/* Tab 3: Direct WhatsApp */}
              {paymentMethod === 'whatsapp' && (
                <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-3 animate-fade-in text-center">
                  <span className="text-3xl block">💬</span>
                  <h4 className="text-base font-black text-emerald-900">
                    {isRTL ? 'تأكيد الحجز الفوري مع خدمة العملاء عبر واتساب' : 'Instant Confirmation via WhatsApp'}
                  </h4>
                  <p className="text-xs text-emerald-800 font-bold max-w-md mx-auto leading-relaxed">
                    {isRTL
                      ? 'يمكنك إتمام الحجز الآن وسيتواصل معك موظف الحجوزات لتأكيد الوحدة وتزويدك بكافة تفاصيل الوصول وكارت الدخول.'
                      : 'Complete your booking now and our guest relations team will confirm your stay immediately.'}
                  </p>
                </div>
              )}
            </div>

            {/* Rules Acceptance & Final Submit */}
            <form onSubmit={handleSubmitBooking} className="bg-white p-6 md:p-8 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-6">
              {/* House Rules */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowRulesModal(true)}
                    className="text-xs font-black text-[#C1A68D] hover:text-[#2A2723] underline flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>📜</span>
                    <span>{isRTL ? 'اضغط هنا لقراءة قواعد وشروط الإقامة' : 'Read House Rules & Terms'}</span>
                  </button>
                </div>

                <label className="flex items-start gap-3 cursor-pointer p-4 bg-[#FDFBF7] rounded-2xl border border-[#EAE4D9] hover:border-[#C1A68D] transition-all">
                  <input
                    type="checkbox"
                    required
                    checked={rulesAccepted}
                    onChange={(e) => setRulesAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-[#2A2723] rounded cursor-pointer"
                  />
                  <span className="text-xs text-[#5C554B] font-bold leading-relaxed">
                    {isRTL ? (
                      <>أوافق على قراءة والالتزام الكامل بـ <span onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }} className="text-[#C1A68D] underline font-black">قواعد وشروط الإقامة</span> الخاصة بمجمع مزار الفندقي.</>
                    ) : (
                      <>I agree to comply with the <span onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }} className="text-[#C1A68D] underline font-black">house rules and terms</span> of Mazar.</>
                    )}
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !rulesAccepted}
                  className="w-full bg-[#2A2723] hover:bg-black text-white font-black py-5 md:py-6 rounded-2xl md:rounded-3xl text-lg md:text-xl transition-all shadow-xl active:scale-95 disabled:opacity-40 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span>
                    {isSubmitting 
                      ? 'جاري إتمام الحجز...' 
                      : (isRTL ? `✅ تأكيد حجز الوحدة الآن (${depositRequired.toLocaleString()} ج.م عربون)` : `✅ Confirm Reservation (${depositRequired.toLocaleString()} EGP)`)}
                  </span>
                </button>

                <p className="text-center text-[10px] md:text-xs text-[#7A7061] font-bold">
                  {isRTL ? '✨ يتم مراجعة الحجز واعتماده فوراً وتحويلك إلى واتساب لإرسال كارت الدخول' : 'Your booking will be processed and confirmed immediately'}
                </p>
              </div>

              {/* Back Button */}
              <div className="pt-2 border-t border-[#EAE4D9]">
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="text-xs font-black text-[#7A7061] hover:text-[#2A2723]"
                >
                  {isRTL ? '← الرجوع لتعديل بيانات الضيف' : '← Back to Guest Details'}
                </button>
              </div>
            </form>
          </section>
        )}

      </div>

      {/* House Rules Quick Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white max-w-xl w-full rounded-[2.5rem] border border-[#EAE4D9] shadow-2xl p-6 md:p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE4D9]">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📜</span>
                <h3 className="text-lg md:text-xl font-black text-[#2A2723]">
                  {isRTL ? 'قواعد وشروط الإقامة' : 'House Rules & Terms'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-9 h-9 rounded-full bg-[#F7F5F0] hover:bg-[#2A2723] hover:text-white flex items-center justify-center font-black transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs md:text-sm text-[#5C554B] font-bold leading-relaxed">
              <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EAE4D9] space-y-2">
                <h4 className="font-black text-[#2A2723] flex items-center gap-2">
                  <span>🕒</span>
                  <span>{isRTL ? 'مواعيد الدخول والمغادرة' : 'Check-In & Check-Out'}</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-[#7A7061]">
                  <li>{isRTL ? 'تسجيل الوصول: من الساعة 2:00 ظهرًا.' : 'Check-in: from 2:00 PM.'}</li>
                  <li>{isRTL ? 'تسجيل المغادرة: حتى الساعة 12:00 ظهرًا.' : 'Check-out: by 12:00 PM.'}</li>
                </ul>
              </div>

              <div className="p-4 bg-[#FDFBF7] rounded-2xl border border-[#EAE4D9] space-y-2">
                <h4 className="font-black text-[#2A2723] flex items-center gap-2">
                  <span>🪪</span>
                  <span>{isRTL ? 'إثبات الهوية واستلام الوحدة' : 'ID & Unit Handover'}</span>
                </h4>
                <p className="text-[#7A7061]">
                  {isRTL
                    ? 'يجب تقديم بطاقة رقم قومي سارية أو جواز سفر لجميع المقيمين عند الاستلام، وكارت الدخول مسؤولية شخصية.'
                    : 'Valid ID or passport is required for all guests upon arrival.'}
                </p>
              </div>

              <div className="p-4 bg-red-50/80 rounded-2xl border border-red-100 space-y-2 text-red-950">
                <h4 className="font-black text-red-700 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{isRTL ? 'سياسة الهدوء والأمان' : 'Peace & Safety Policy'}</span>
                </h4>
                <ul className="list-disc list-inside space-y-1 text-red-900/90 text-[11px] md:text-xs">
                  <li>{isRTL ? 'يمنع منعاً باتاً استقبال أي زائر غير مسجل لدى إدارة مزار مسبقاً.' : 'Unregistered visitors are strictly prohibited.'}</li>
                  <li>{isRTL ? 'يمنع إدخال أو تناول المشروبات الكحولية أو المواد المخدرة داخل المبنى.' : 'Alcohol and drugs are strictly prohibited.'}</li>
                  <li>{isRTL ? 'تحتفظ إدارة مزار بالحق في إنهاء الإقامة فوراً دون استرداد في حال مخالفة التعليمات.' : 'Management reserves the right to terminate stay without refund upon violation.'}</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setRulesAccepted(true);
                  setShowRulesModal(false);
                }}
                className="flex-1 bg-[#2A2723] text-white py-3.5 rounded-2xl font-black text-xs hover:bg-black transition-all shadow-md text-center"
              >
                {isRTL ? '✓ قرأت وأوافق على جميع الشروط' : '✓ I have read and agree'}
              </button>
              <Link
                href="/mazar/rules"
                target="_blank"
                className="py-3.5 px-5 rounded-2xl border border-[#EAE4D9] text-[#7A7061] hover:text-[#2A2723] font-black text-xs transition-colors text-center"
              >
                {isRTL ? 'فتح صفحة القواعد الكاملة' : 'View Full Rules Page'}
              </Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
