'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Calendar from '@/components/Calendar';
import { useLanguage } from '@/lib/LanguageContext';
import { processAndUploadReceipt, processAndUploadDocument } from '@/lib/uploadHelper';
import { resolveUnitVideo } from '@/lib/utils';
import PaymentInfoBox from '@/components/PaymentInfoBox';



export default function BookingPage() {
  const { t, isRTL, language } = useLanguage();

  const [step, setStep] = useState(1);

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
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);
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
  const [showUnitSelector, setShowUnitSelector] = useState(true);

  const ADMIN_WHATSAPP = '201108109969';

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getSafeUnitPrice = (unit: any): number => {
    if (!unit) return 3000;
    const num = parseInt(String(unit.price || '').replace(/[^0-9]/g, ''), 10) || 0;
    if (num >= 1000) return num;
    const idStr = String(unit.id || '').toLowerCase();
    if (idStr.startsWith('apt-') || idStr.startsWith('ext-')) return 4000;
    return 3000;
  };

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const unitParam = params.get('unit');
      const checkInParam = params.get('checkIn');
      const checkOutParam = params.get('checkOut');

      if (checkInParam && checkOutParam) {
        setCheckIn(checkInParam);
        setCheckOut(checkOutParam);
      }

      if (unitParam) {
        setSelectedUnitId(unitParam);
        setShowUnitSelector(false);
        try {
          const res = await fetch('/api/bookings', { cache: 'no-store' });
          if (res.ok) {
            const allBookings = await res.json();
            const unitBooked = allBookings
              .filter((b: any) => b.apartmentId === unitParam && !['cancelled', 'deleted', 'rejected', 'مرفوض'].includes(b.status))
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
          }
        } catch {
          // ignore — no booked dates blocked
        }
      }

      // If dates are provided, fetch units, check availability, and skip Step 1!
      if (checkInParam && checkOutParam) {
        setIsLoading(true);
        setError(null);
        try {
          const res = await fetch('/api/units');
          if (!res.ok) throw new Error('Failed to fetch units');
          const allUnits = await res.json();

          const bookingsRes = await fetch('/api/bookings', { cache: 'no-store' });
          const allBookings = bookingsRes.ok ? await bookingsRes.json() : [];

          const activeUnitsByStatus = allUnits.filter((u: any) => u.status === 'متاح' || !u.status);
          
          const available = activeUnitsByStatus.filter((unit: any) => {
            const hasOverlap = allBookings.some((b: any) => {
              if (b.apartmentId !== unit.id) return false;
              if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
              return (checkInParam < b.checkOut && checkOutParam > b.checkIn);
            });
            return !hasOverlap;
          });

          setAvailableUnits(available);
          if (available.length > 0) {
            const currentSTillAvailable = available.find((u: any) => u.id === (unitParam || selectedUnitId));
            if (currentSTillAvailable) {
              setSelectedUnitId(currentSTillAvailable.id);
            } else {
              setSelectedUnitId(available[0].id);
            }
            setStep(2);
          } else {
            setSelectedUnitId('');
            setError(isRTL ? 'عذراً، لا توجد وحدات متاحة في هذه المواعيد. جرب تغيير التاريخ.' : 'Sorry, no units are available for these dates. Try changing the dates.');
          }
        } catch (err) {
          console.error('Auto availability check failed:', err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    init();
  }, [isRTL]);

  const openWhatsAppAdmin = useCallback(() => {
    const selectedUnit = availableUnits.find((u: any) => u.id === selectedUnitId);
    
    // Calculate total nights & price
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const pricePerNight = getSafeUnitPrice(selectedUnit);
    const totalAmount = nights * pricePerNight;

    const methodLabel = paymentMethod === 'visa' ? 'فيزا (بطاقة بنكية)' : paymentMethod === 'instapay_bank' ? 'إنستا باي / تحويل بنكي' : 'تواصل عبر واتساب للتأكيد';
    
    let paymentStatusMsg = '';
    if (receiptUrl) {
      paymentStatusMsg = `\n🧾 *إيصال التحويل:* ${receiptUrl}\n✅ *حالة السداد:* تم إرفاق الإيصال`;
    } else if (paymentMethod === 'visa') {
      paymentStatusMsg = `\n💳 *طريقة الدفع:* فيزا (بطاقة بنكية أونلاين)`;
    } else {
      paymentStatusMsg = `\n⚠️ *ملاحظة:* بانتظار إرسال صورة إيصال التحويل لاعتماد الحجز`;
    }

    const adminMsg = `🔔 *طلب حجز جديد من الموقع!*\n\n` +
      `👤 *العميل:* ${name}\n` +
      `📱 *الموبايل:* ${phone}\n` +
      `👥 *عدد الأشخاص:* ${guestsCount}\n` +
      `🏠 *الوحدة:* ${selectedUnit ? (selectedUnit.title?.['ar'] || selectedUnitId) : selectedUnitId}\n` +
      `📅 *الفترة:* من ${formatDate(checkIn)} إلى ${formatDate(checkOut)} (إجمالي ${nights} ليالي)\n` +
      `💰 *إجمالي التكلفة:* ${totalAmount} ج.م (${nights} ليالي × ${pricePerNight} ج.م)\n` +
      `💳 *وسيلة الدفع:* ${methodLabel}\n` +
      (idDocUrl ? `🪪 *إثبات الشخصية:* ${idDocUrl}\n` : '') +
      paymentStatusMsg + `\n\nيرجى تأكيد الحجز معي.`;

    const waUrl = `https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}&text=${encodeURIComponent(adminMsg)}`;
    window.open(waUrl, '_blank');
  }, [availableUnits, checkIn, checkOut, name, phone, selectedUnitId, paymentMethod, receiptUrl, idDocUrl, guestsCount]);

  // Update booked dates when a unit is selected (for cases where they go back to step 1)
  useEffect(() => {
     if (selectedUnitId) {
        const fetchBooked = async () => {
           try {
             const res = await fetch('/api/bookings', { cache: 'no-store' });
             if (!res.ok) return;
             const allBookings = await res.json();
             const unitBooked = allBookings
               .filter((b: any) => b.apartmentId === selectedUnitId && !['cancelled', 'deleted', 'rejected', 'مرفوض'].includes(b.status))
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

  // Redirect logic handled directly in handleSubmitBooking for immediacy

  const isDateOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    return (start1 < end2 && end1 > start2);
  };

  const handleDateSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/units');
      if (!res.ok) throw new Error('Failed to fetch units');
      const allUnits = await res.json();

      // Fetch bookings to check for overlaps
      const bookingsRes = await fetch('/api/bookings', { cache: 'no-store' });
      const allBookings = bookingsRes.ok ? await bookingsRes.json() : [];

      const activeUnitsByStatus = allUnits.filter((u: any) => u.status === 'متاح' || !u.status);
      
      const available = activeUnitsByStatus.filter((unit: any) => {
        const hasOverlap = allBookings.some((b: any) => {
          if (b.apartmentId !== unit.id) return false;
          if (['cancelled', 'deleted', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)) return false;
          // Overlap check
          return (checkIn < b.checkOut && checkOut > b.checkIn);
        });
        return !hasOverlap;
      });

      setAvailableUnits(available);
      if (available.length > 0) {
        const currentSTillAvailable = available.find((u: any) => u.id === selectedUnitId);
        if (!currentSTillAvailable) setSelectedUnitId(available[0].id);
        setStep(2);
      } else {
        setSelectedUnitId('');
        setError(isRTL ? 'عذراً، لا توجد وحدات متاحة في هذه المواعيد. جرب تغيير التاريخ.' : 'Sorry, no units are available for these dates. Try changing the dates.');
      }
    } catch (err) {
      console.error('Availability check failed:', err);
      setError(isRTL ? 'حدث خطأ أثناء فحص التوافر. يرجى المحاولة مرة أخرى.' : 'Error checking availability. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    if (!rulesAccepted) {
      alert(isRTL ? 'يرجى الموافقة على قواعد وشروط الإقامة للمتابعة.' : 'Please accept house rules to proceed.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const selectedUnit = availableUnits.find((u: any) => u.id === selectedUnitId);
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const pricePerNight = getSafeUnitPrice(selectedUnit);
    const totalAmount = nights * pricePerNight;

    const methodLabel = 'إنستا باي / تحويل بنكي';

    const notesParts: string[] = [];
    if (receiptUrl) notesParts.push(`إيصال التحويل: ${receiptUrl}`);
    if (idDocUrl) notesParts.push(`إثبات الشخصية: ${idDocUrl}`);
    notesParts.push(`طريقة الدفع: ${methodLabel}`);
    if (!receiptUrl) {
      notesParts.push('حجز معلق بانتظار إرسال صورة التحويل عبر واتساب');
    }

    const fullNotes = `[طلب من الموقع] ${notesParts.join(' | ')}`;
    const paymentSummary = `إجمالي الحجز: ${totalAmount} ج.م (${nights} ليالي × ${pricePerNight} ج.م) | متبقي: ${totalAmount} ج.م`;
    const fullPaymentInfo = `${paymentSummary} | ${fullNotes}`;

    const bookingData = {
      name,
      phone,
      checkIn,
      checkOut,
      numberOfDays: nights,
      pricePerNight,
      totalAmount: totalAmount > 0 ? totalAmount : null,
      paidAmount: 0,
      remainingAmount: totalAmount > 0 ? totalAmount : null,
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
      
      // WhatsApp Redirect
      let paymentNotice = '';
      if (receiptUrl) {
        paymentNotice = `\n🧾 *إيصال التحويل:* ${receiptUrl}\n✅ *حالة السداد:* تم إرفاق الإيصال وجاري المطابقة`;
      } else {
        paymentNotice = `\n⚠️ *ملاحظة:* لم يتم إرفاق إيصال بعد وسيقوم العميل بإرسال صورة التحويل عبر واتساب لتأكيد الحجز`;
      }

      const adminMsg = `🔔 *طلب حجز جديد من الموقع!*\n\n` +
        `👤 *الاسم:* ${name}\n` +
        `📱 *الموبايل:* ${phone}\n` +
        `👥 *عدد الضيوف:* ${guestsCount}\n` +
        `🏠 *الوحدة:* ${selectedUnit ? (selectedUnit.title?.['ar'] || selectedUnitId) : selectedUnitId}\n` +
        `📅 *الفترة:* من ${formatDate(checkIn)} إلى ${formatDate(checkOut)} (${nights} ليالي)\n` +
        `💰 *إجمالي التكلفة:* ${totalAmount} ج.م (${nights} ليالي × ${pricePerNight} ج.م)\n` +
        `💳 *وسيلة السداد:* ${methodLabel}\n` +
        (idDocUrl ? `🪪 *إثبات الشخصية:* ${idDocUrl}\n` : '') +
        paymentNotice + `\n\nيرجى تأكيد الحجز معي.`;

      const waUrl = `https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}&text=${encodeURIComponent(adminMsg)}`;
      window.location.href = waUrl;
      
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setError(isRTL ? 'حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.' : 'Error saving request. Please try again.');
      alert(isRTL ? 'حدث خطأ أثناء حفظ الطلب.' : 'An error occurred while saving the request.');
    }
  };

  const selectedUnit = availableUnits.find((u: any) => u.id === selectedUnitId);

  // Grouped Available Units
  const studioUnits = availableUnits.filter((u: any) => u.type === 'studio');
  const apartmentUnits = availableUnits.filter((u: any) => u.type === 'apartment');

  if (isSuccess) {
    return (
      <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] flex flex-col justify-center items-center p-6 animate-fade-in font-sans">
        <div className="bg-white p-12 md:p-16 rounded-[60px] border border-[#EAE4D9] shadow-2xl text-center max-w-2xl w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1.5 bg-[#25D366] transition-all duration-1000 ease-linear" style={{ width: `${(3 - redirectCountdown) * 33.33}%` }} />

          <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 border border-green-100 shadow-sm animate-bounce">
            ✓
          </div>

          <h2 className="text-4xl md:text-5xl font-black text-[#2A2723] mb-6 tracking-tighter">
            {isRTL ? 'تهانينا، تم استلام طلبك!' : 'Congratulations, request received!'}
          </h2>

          <div className="bg-[#F7F5F0] py-8 px-10 rounded-[40px] mb-8 border border-[#EAE4D9]">
            <p className="text-[11px] font-black text-[#C1A68D] uppercase tracking-widest mb-2">{isRTL ? 'الوحدة المختارة' : 'Selected Unit'}</p>
            <p className="text-3xl font-black text-[#2A2723] mb-1">{selectedUnit ? (selectedUnit.title?.[language] || selectedUnitId) : selectedUnitId}</p>
            <div className="flex justify-center gap-6 mt-4">
              <div className="text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{isRTL ? 'من' : 'From'}</p>
                <p className="text-xs font-black">{formatDate(checkIn)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase">{isRTL ? 'إلى' : 'To'}</p>
                <p className="text-xs font-black">{formatDate(checkOut)}</p>
              </div>
            </div>
          </div>

          <div className="text-[#5C554B] text-base md:text-lg leading-relaxed font-bold mb-10 space-y-3">
            {receiptUrl || paymentMethod === 'visa' ? (
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-200">
                {isRTL
                  ? '✨ تم تسجيل طلبك ومرفقاتك بنجاح! حجزك معتمد وجاري المراجعة والتأكيد الفوري.'
                  : '✨ Your booking and documents have been received successfully! Instant confirmation in progress.'}
              </div>
            ) : (
              <div className="bg-amber-50 text-amber-900 p-4 rounded-2xl border border-amber-200 text-sm">
                {isRTL
                  ? '⚠️ تم تسجيل طلبك المبدئي بنجاح! يرجى إرسال صورة إيصال التحويل عبر واتساب الآن لتأكيد الحجز النهائي وتجنب إلغائه.'
                  : '⚠️ Preliminary booking registered! Please send transfer receipt via WhatsApp now to finalize confirmation.'}
              </div>
            )}
            <p className="text-[#25D366] font-black p-2 animate-pulse">
              {isRTL
                ? 'جاري تحويلك للواتساب للتأكيد الآن...'
                : 'Redirecting to WhatsApp for confirmation now...'}
            </p>
          </div>
          
          {/* Copy Number Section */}
          <div className="mb-10 p-6 bg-[#FDFBF7] rounded-[30px] border border-dashed border-[#EAE4D9] flex flex-col items-center gap-3">
            <p className="text-[10px] font-black text-[#C1A68D] uppercase tracking-[0.2em]">
              {isRTL ? 'أو يمكنك نسخ الرقم والتواصل يدوياً' : 'Or copy number & contact manually'}
            </p>
            <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-[#EAE4D9] shadow-sm">
              <span className="text-2xl font-black text-[#2A2723] tracking-wider select-all">01108109969</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText('01108109969');
                  alert(isRTL ? '✅ تم نسخ الرقم بنجاح!' : '✅ Number copied successfully!');
                }}
                className="w-10 h-10 flex items-center justify-center bg-[#FDFBF7] rounded-xl hover:bg-[#2A2723] hover:text-white transition-all shadow-inner border border-[#EAE4D9]"
                title={isRTL ? 'نسخ الرقم' : 'Copy Number'}
              >
                📋
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={openWhatsAppAdmin}
              className="w-full bg-[#25D366] text-white font-black py-5 rounded-[28px] hover:bg-[#128C7E] shadow-xl shadow-green-500/20 transition-all flex items-center justify-center gap-3 text-lg"
            >
              💬 {isRTL ? 'تأكيد عبر واتساب الآن' : 'Confirm via WhatsApp'}
            </button>
            <Link href="/" className="w-full bg-[#2A2723] text-white font-black py-5 rounded-[28px] hover:bg-black transition-all text-sm flex items-center justify-center gap-3">
              🏠 {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] selection:bg-[#C1A68D] selection:text-white relative overflow-x-hidden font-sans">

      <div className="absolute top-0 left-0 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[#EAE4D9]/30 rounded-full blur-[60px] md:blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-[#D5C5B3]/20 rounded-full blur-[50px] md:blur-[100px] -z-10 pointer-events-none" />

      {/* Navigation */}
      <nav className="w-full px-4 md:px-8 py-3 md:py-5 hidden md:flex justify-between items-center max-w-screen-2xl mx-auto z-50 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-[#EAE4D9]">
        <Link href="/" className="shrink-0">
          <Logo size={45} mdSize={54} />
        </Link>
        
        <div className="hidden md:flex gap-10 text-sm font-bold text-[#5C554B]">
          <Link href="/" className="hover:text-[#2A2723] transition-colors">{t.common.home}</Link>
          <Link href="/mazar/about" className="hover:text-[#2A2723] transition-colors">{t.common.about}</Link>
          <Link href="/mazar/rules" className="hover:text-[#2A2723] transition-colors">{t.common.rules}</Link>
          <Link href="/mazar/how-to-book" className="hover:text-[#2A2723] transition-colors">{t.common.howToBook}</Link>
        </div>

        <div className="flex items-center gap-3 md:gap-8">
          <LanguageSwitcher />
          <Link href="/" className="hidden xs:inline-flex text-[10px] md:text-xs font-black text-[#7A7061] hover:text-[#2A2723] uppercase tracking-tighter">
            {isRTL ? 'العودة للرئيسية ←' : '← Back to Home'}
          </Link>
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto flex flex-col items-center">

        {step === 1 ? (
          /* STEP 1: MANUAL DROPDOWN SELECTORS (FULL USER CONTROL) */
          <div className="w-full max-w-4xl mx-auto p-4 md:p-6 py-12 md:py-24">
            <div className="text-center mb-12 md:mb-16">
              <div className="inline-block px-4 py-1.5 rounded-full bg-[#C1A68D]/10 text-[#C1A68D] text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-4 border border-[#C1A68D]/20">Step 01 / Reservation</div>
              <h1 className="text-4xl md:text-7xl font-black text-[#2A2723] mb-4 tracking-tighter leading-tight">
                {isRTL ? 'حدد مواعيدك' : 'Select Dates'}
              </h1>
              <p className="text-base md:text-lg text-[#7A7061] font-bold mb-8 px-4 opacity-80">
                {isRTL ? 'أدخل البيانات بدقة تامة لضمان توفر الوحدات' : 'Enter dates with total precision to check availability'}
              </p>

              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="inline-flex items-center gap-3 bg-[#2A2723] text-white px-6 md:px-8 py-4 rounded-2xl md:rounded-3xl font-black text-xs md:text-sm hover:bg-black transition-all shadow-xl active:scale-95"
              >
                {showCalendar ? '📅 ' + (isRTL ? 'إخفاء التقويم' : 'Hide Calendar') : '📅 ' + (isRTL ? 'عرض التقويم البصري' : 'Show Visual Calendar')}
              </button>
            </div>

            {showCalendar && (
              <div className="mb-12 md:mb-16 animate-in fade-in slide-in-from-top-8 duration-500 max-w-2xl mx-auto px-2">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 px-2">

              {/* Arrival Box */}
              <div className="bg-white p-6 md:p-10 rounded-[30px] md:rounded-[50px] border border-[#EAE4D9]/50 shadow-2xl space-y-6 md:space-y-8 relative overflow-visible">
                <div className="absolute top-0 right-0 w-16 md:w-24 h-16 md:h-24 bg-[#C1A68D]/5 rounded-bl-full pointer-events-none" />
                <div className="flex items-center gap-3 md:gap-4 mb-2">
                  <span className="text-2xl md:text-3xl">🛬</span>
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-[#C1A68D]">{isRTL ? 'تاريخ الوصول' : 'Arrival Date'}</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {(() => {
                    const ManualPicker = ({ label, value, options, onSelect, color }: any) => {
                      const [isOpen, setIsOpen] = useState(false);
                      return (
                        <div className="space-y-1 md:space-y-2 relative">
                          <label className="block text-[8px] md:text-[9px] font-bold text-gray-400 uppercase px-1">{label}</label>
                          <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className={`w-full bg-[#F7F5F0] border-2 transition-all rounded-xl md:rounded-2xl p-3 md:p-4 text-lg md:text-xl font-black flex items-center justify-between group ${isOpen ? (color === 'red' ? 'border-[#E63946] bg-white shadow-lg' : 'border-[#C1A68D] bg-white shadow-lg') : 'border-transparent text-[#2A2723] hover:border-gray-200'}`}
                          >
                            <span className="flex-1 text-center">{value}</span>
                            <span className="text-[8px] opacity-20 group-hover:opacity-100 transition-opacity">▼</span>
                          </button>

                          {isOpen && (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                              <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-[#EAE4D9] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] z-[70] p-2 max-h-[220px] md:max-h-[280px] overflow-y-auto animate-in slide-in-from-top-4 fade-in duration-300">
                                <div className="grid grid-cols-1 gap-1">
                                  {options.map((opt: any) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => { onSelect(opt); setIsOpen(false); }}
                                      className={`p-3 rounded-xl text-base md:text-lg font-black transition-all ${value === opt ? (color === 'red' ? 'bg-[#E63946] text-white shadow-md' : 'bg-[#2A2723] text-white shadow-md') : 'hover:bg-[#F7F5F0] text-[#2A2723]'}`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        <ManualPicker
                          label={isRTL ? 'اليوم' : 'Day'}
                          value={checkIn.split('-')[2]}
                          options={(() => {
                            const [year, month] = checkIn.split('-').map(Number);
                            const days = new Date(year, month, 0).getDate();
                            return Array.from({ length: days }, (_, i) => (i + 1).toString().padStart(2, '0'));
                          })()}
                          onSelect={(v: string) => {
                            const parts = checkIn.split('-');
                            const newDate = `${parts[0]}-${parts[1]}-${v}`;
                            setCheckIn(newDate);
                            setStep1Focus('checkIn');
                          }}
                        />
                        <ManualPicker
                          label={isRTL ? 'الشهر' : 'Month'}
                          value={checkIn.split('-')[1]}
                          options={Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))}
                          onSelect={(v: string) => {
                            const parts = checkIn.split('-');
                            const [year, , day] = parts.map(Number);
                            const maxDays = new Date(year, Number(v), 0).getDate();
                            const newDay = day > maxDays ? maxDays.toString().padStart(2, '0') : parts[2];
                            const newDate = `${parts[0]}-${v}-${newDay}`;
                            setCheckIn(newDate);
                            setStep1Focus('checkIn');
                          }}
                        />
                        <ManualPicker
                          label={isRTL ? 'السنة' : 'Year'}
                          value={checkIn.split('-')[0]}
                          options={[new Date().getFullYear().toString(), (new Date().getFullYear() + 1).toString()]}
                          onSelect={(v: string) => {
                            const parts = checkIn.split('-');
                            const [, month, day] = parts.map(Number);
                            const maxDays = new Date(Number(v), month, 0).getDate();
                            const newDay = day > maxDays ? maxDays.toString().padStart(2, '0') : parts[2];
                            const newDate = `${v}-${parts[1]}-${newDay}`;
                            setCheckIn(newDate);
                            setStep1Focus('checkIn');
                          }}
                        />
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Departure Box */}
              <div className="bg-white p-6 md:p-10 rounded-[30px] md:rounded-[50px] border border-[#EAE4D9]/50 shadow-2xl space-y-6 md:space-y-8 relative overflow-visible">
                <div className="absolute top-0 right-0 w-16 md:w-24 h-16 md:h-24 bg-[#E63946]/5 rounded-bl-full pointer-events-none" />
                <div className="flex items-center gap-3 md:gap-4 mb-2">
                  <span className="text-2xl md:text-3xl">🛫</span>
                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-[#E63946]">{isRTL ? 'تاريخ المغادرة' : 'Departure Date'}</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {(() => {
                    const ManualPicker = ({ label, value, options, onSelect, color }: any) => {
                      const [isOpen, setIsOpen] = useState(false);
                      return (
                        <div className="space-y-1 md:space-y-2 relative">
                          <label className="block text-[8px] md:text-[9px] font-bold text-gray-400 uppercase px-1">{label}</label>
                          <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className={`w-full bg-[#F7F5F0] border-2 transition-all rounded-xl md:rounded-2xl p-3 md:p-4 text-lg md:text-xl font-black flex items-center justify-between group ${isOpen ? (color === 'red' ? 'border-[#E63946] bg-white shadow-lg' : 'border-[#C1A68D] bg-white shadow-lg') : 'border-transparent text-[#2A2723] hover:border-gray-200'}`}
                          >
                            <span className="flex-1 text-center">{value}</span>
                            <span className="text-[8px] opacity-20 group-hover:opacity-100 transition-opacity">▼</span>
                          </button>

                          {isOpen && (
                            <>
                              <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                              <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-white border border-[#EAE4D9] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] z-[70] p-2 max-h-[220px] md:max-h-[280px] overflow-y-auto animate-in slide-in-from-top-4 fade-in duration-300">
                                <div className="grid grid-cols-1 gap-1">
                                  {options.map((opt: any) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => { onSelect(opt); setIsOpen(false); }}
                                      className={`p-3 rounded-xl text-base md:text-lg font-black transition-all ${value === opt ? (color === 'red' ? 'bg-[#E63946] text-white shadow-md' : 'bg-[#2A2723] text-white shadow-md') : 'hover:bg-[#F7F5F0] text-[#2A2723]'}`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        <ManualPicker
                          color="red"
                          label={isRTL ? 'اليوم' : 'Day'}
                          value={checkOut.split('-')[2]}
                          options={(() => {
                            const [year, month] = checkOut.split('-').map(Number);
                            const days = new Date(year, month, 0).getDate();
                            return Array.from({ length: days }, (_, i) => (i + 1).toString().padStart(2, '0'));
                          })()}
                          onSelect={(v: string) => {
                            const parts = checkOut.split('-');
                            const newDate = `${parts[0]}-${parts[1]}-${v}`;
                            setCheckOut(newDate);
                            setStep1Focus('checkOut');
                          }}
                        />
                        <ManualPicker
                          color="red"
                          label={isRTL ? 'الشهر' : 'Month'}
                          value={checkOut.split('-')[1]}
                          options={Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))}
                          onSelect={(v: string) => {
                            const parts = checkOut.split('-');
                            const [year, , day] = parts.map(Number);
                            const maxDays = new Date(year, Number(v), 0).getDate();
                            const newDay = day > maxDays ? maxDays.toString().padStart(2, '0') : parts[2];
                            const newDate = `${parts[0]}-${v}-${newDay}`;
                            setCheckOut(newDate);
                            setStep1Focus('checkOut');
                          }}
                        />
                        <ManualPicker
                          color="red"
                          label={isRTL ? 'السنة' : 'Year'}
                          value={checkOut.split('-')[0]}
                          options={[new Date().getFullYear().toString(), (new Date().getFullYear() + 1).toString()]}
                          onSelect={(v: string) => {
                            const parts = checkOut.split('-');
                            const [, month, day] = parts.map(Number);
                            const maxDays = new Date(Number(v), month, 0).getDate();
                            const newDay = day > maxDays ? maxDays.toString().padStart(2, '0') : parts[2];
                            const newDate = `${v}-${parts[1]}-${newDay}`;
                            setCheckOut(newDate);
                            setStep1Focus('checkOut');
                          }}
                        />
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>

            {/* Action Area */}
            <div className="mt-12 md:mt-16 flex flex-col items-center gap-6 md:gap-10">
              {checkIn && checkOut && new Date(checkOut) > new Date(checkIn) && (
                <div className="bg-[#2A2723] text-white px-8 py-3 rounded-full text-base md:text-lg font-black shadow-xl animate-bounce">
                  ✨ {isRTL ? `المجموع: ${Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))} ليالي` : `Total: ${Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))} Nights`}
                </div>
              )}

              <button
                onClick={handleDateSelection}
                disabled={!checkIn || !checkOut || isLoading}
                className="w-full max-w-xl bg-[#2A2723] text-white font-black py-6 md:py-8 rounded-[25px] md:rounded-[40px] text-2xl md:text-4xl hover:bg-black transition-all shadow-[0_20px_60px_rgba(0,0,0,0.15)] disabled:opacity-20 active:scale-95"
              >
                {isLoading ? '...' : (isRTL ? 'الخطوة التالية: اختر الوحدة' : 'Next: Select Unit')}
              </button>

              {error && (
                <div className="bg-red-50 text-red-500 p-4 rounded-2xl border border-red-100 font-bold text-center mt-4">
                  ⚠️ {error}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STEP 2: PREMIUM UNIT SELECTION */
          <div className="w-full max-w-7xl px-4 md:px-6 pb-24">
            <div className="flex flex-col lg:flex-row gap-8 md:gap-12 items-start">

              {/* UNIT SELECTION SIDE (Left/Main) */}
              <div className="flex-1 space-y-8 md:space-y-12 w-full order-2 lg:order-1">
                {!showUnitSelector && selectedUnitId ? (
                  <div className="space-y-8">
                    {/* Header */}
                    <header className={`space-y-3 md:space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-[9px] md:text-[10px] font-black text-[#C1A68D] hover:text-[#2A2723] mb-2 inline-flex items-center gap-2 uppercase tracking-widest transition-all bg-white px-4 py-2 rounded-full border border-[#EAE4D9] hover:shadow-md"
                      >
                        {isRTL ? '← تعديل المواعيد' : '← Edit Dates'}
                      </button>
                      <div className="flex justify-between items-center flex-wrap gap-4">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="w-1.5 h-8 md:h-10 bg-[#C1A68D] rounded-full" />
                          <h2 className="text-3xl md:text-5xl font-black text-[#2A2723] tracking-tighter">
                            {isRTL ? 'الوحدة المختارة' : 'Selected Unit'}
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowUnitSelector(true)}
                          className="text-xs font-black text-[#C1A68D] hover:text-[#2A2723] bg-white border border-[#EAE4D9] px-4 py-2.5 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                          {isRTL ? '🔁 تغيير الوحدة' : '🔁 Change Unit'}
                        </button>
                      </div>
                      <p className="text-xs md:text-sm font-bold text-[#7A7061] opacity-70">
                        {isRTL 
                          ? 'لقد اخترت هذه الوحدة لإقامتك. يرجى إتمام بيانات الدفع والحجز على اليمين لتأكيد طلبك.' 
                          : 'You have selected this unit. Please complete payment and contact details on the right to confirm.'}
                      </p>
                    </header>

                    {/* Selected Unit Details Card */}
                    {(() => {
                      const selectedUnit = availableUnits.find(u => u.id === selectedUnitId);
                      if (!selectedUnit) return (
                        <div className="p-8 bg-[#F7F5F0] rounded-[2rem] border border-[#EAE4D9] text-center font-bold text-sm text-[#7A7061]">
                          {isRTL ? 'جاري تحميل تفاصيل الوحدة...' : 'Loading unit details...'}
                        </div>
                      );
                      return (
                        <div className="bg-white rounded-[2rem] border border-[#EAE4D9] overflow-hidden shadow-md flex flex-col md:flex-row gap-6 p-6">
                          {/* Image */}
                          <div className="w-full md:w-1/3 aspect-[4/3] rounded-2xl overflow-hidden bg-[#F7F5F0] relative shrink-0">
                            {selectedUnit.images && selectedUnit.images[0] ? (
                              <img src={selectedUnit.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl">🏢</div>
                            )}
                          </div>
                          {/* Details */}
                          <div className={`flex-grow flex flex-col justify-between ${isRTL ? 'text-right' : 'text-left'}`}>
                            <div className="space-y-3">
                              <span className="inline-block bg-[#C1A68D]/10 text-[#C1A68D] px-3 py-1 rounded-full text-[9px] font-black uppercase">
                                {selectedUnit.type === 'studio' ? (isRTL ? 'استوديو' : 'Studio') : (isRTL ? 'شقة فندقية' : 'Apartment')}
                              </span>
                              <h3 className="text-xl md:text-2xl font-bold text-[#2A2723]">
                                {selectedUnit.title?.[language] || selectedUnit.id}
                              </h3>
                              <p className="text-xs md:text-sm text-[#7A7061] leading-relaxed">
                                {selectedUnit.description?.[language]}
                              </p>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-[#F0EBE3] mt-6">
                              <span className="text-xs font-bold text-[#7A7061]">
                                {isRTL ? 'سعر الليلة' : 'Price per Night'}
                              </span>
                              <span className="text-base md:text-lg font-black text-[#C1A68D]">
                                {selectedUnit.price}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    <header className={`space-y-3 md:space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-[9px] md:text-[10px] font-black text-[#C1A68D] hover:text-[#2A2723] mb-2 inline-flex items-center gap-2 uppercase tracking-widest transition-all bg-white px-4 py-2 rounded-full border border-[#EAE4D9] hover:shadow-md"
                      >
                        {isRTL ? '← تعديل المواعيد' : '← Edit Dates'}
                      </button>
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-1.5 h-8 md:h-10 bg-[#C1A68D] rounded-full" />
                        <h2 className="text-3xl md:text-5xl font-black text-[#2A2723] tracking-tighter">
                          {isRTL ? 'اختر وحدتك' : 'Select Your Unit'}
                        </h2>
                      </div>
                      <p className="text-xs md:text-sm font-bold text-[#7A7061] opacity-70">
                        {isRTL ? 'تصفح جميع الوحدات واختر الأنسب لك' : 'Browse all units and select your preference'}
                      </p>
                    </header>

                    {/* SEARCH RESULTS GROUPS */}
                    <div className="space-y-10 md:space-y-14">

                      {/* HELPER COMPONENT FOR UNIT CARDS */}
                      {(() => {
                        const UnitGroup = ({ title, icon, units, badgeColor }: any) => {
                          if (units.length === 0) return null;
                          return (
                            <div className="space-y-6 md:space-y-8">
                              <div className={`flex items-center justify-between pb-3 border-b border-[#F0EBE3] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className="flex items-center gap-2 md:gap-3">
                                  <span className="text-xl md:text-2xl">{icon}</span>
                                  <h3 className="text-xs md:text-sm font-black uppercase text-[#2A2723] tracking-[0.1em] md:tracking-[0.2em]">{title}</h3>
                                </div>
                                <span className="bg-white border border-[#EAE4D9]/50 text-[8px] md:text-[9px] font-black px-3 py-1 rounded-full text-[#7A7061] shadow-sm">
                                  {units.length} {isRTL ? 'متوفرة' : 'Available'}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                                {units.map((u: any) => (
                                  <div
                                    key={u.id}
                                    onClick={() => setSelectedUnitId(u.id)}
                                    className={`cursor-pointer group relative flex flex-col text-right transition-all duration-500 rounded-3xl md:rounded-[32px] overflow-hidden border-2 ${selectedUnitId === u.id
                                      ? 'bg-[#2A2723] border-[#2A2723] shadow-xl scale-[1.02] z-10'
                                      : 'bg-white border-[#EAE4D9]/50 hover:border-[#C1A68D] hover:shadow-lg'
                                      }`}
                                  >
                                    {/* Photo */}
                                    <div className="h-24 md:h-28 w-full relative overflow-hidden bg-[#F7F5F0]">
                                      {u.images && u.images[0] ? (
                                        <img src={u.images[0]} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                      ) : (
                                        <div className={`w-full h-full flex items-center justify-center opacity-30 ${selectedUnitId === u.id ? 'bg-white/10' : 'bg-[#EAE4D9]/20'}`}>
                                          <span className="text-2xl">🏢</span>
                                        </div>
                                      )}
                                      <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-full text-[6px] md:text-[7px] font-black text-[#2A2723] uppercase">
                                        {u.type === 'studio' ? (isRTL ? 'استوديو' : 'Studio') : (isRTL ? 'شقة' : 'Apartment')}
                                      </div>
                                    </div>

                                    <div className="p-3 md:p-4 space-y-2 flex-grow">
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[7px] md:text-[8px] font-black uppercase tracking-widest ${selectedUnitId === u.id ? 'text-[#C1A68D]' : 'text-[#7A7061] opacity-50'}`}>
                                          {u.id}
                                        </span>
                                        {selectedUnitId === u.id && (
                                          <div className="w-4 h-4 rounded-full bg-[#E63946] flex items-center justify-center text-[7px] text-white">✓</div>
                                        )}
                                      </div>
                                      <h4 className={`text-xs md:text-sm font-black leading-snug transition-colors ${selectedUnitId === u.id ? 'text-white' : 'text-[#2A2723]'}`}>
                                        {u?.title?.[language] || u.id}
                                      </h4>
                                      <div className={`p-1.5 md:p-2 rounded-xl text-[7px] md:text-[8px] font-bold text-center transition-all ${selectedUnitId === u.id ? 'bg-white/10 text-white/70' : 'bg-[#F7F5F0] text-[#7A7061]'}`}>
                                        ✨ {isRTL ? 'إقامة بريميوم' : 'Premium Stay'}
                                      </div>
                                    </div>

                                    <div className="px-3 pb-3 pt-0 mt-auto">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const vid = resolveUnitVideo(u);
                                          setQuickViewUnit(u);
                                          setQuickViewActiveImage(vid || (u.images && u.images[0]) || '');
                                        }}
                                        className={`w-full inline-flex justify-center items-center py-2 md:py-2.5 rounded-xl border text-[9px] md:text-[10px] font-bold transition-colors ${selectedUnitId === u.id ? 'border-white/20 text-white hover:bg-white/10' : 'border-[#EAE4D9] text-[#5C554B] hover:bg-[#F7F5F0]'}`}
                                      >
                                        {isRTL ? '👁️ تفاصيل الوحدة' : '👁️ View Details'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-12 md:space-y-16">
                            <UnitGroup
                              title={isRTL ? 'الاستديوهات المتاحة' : 'Available Studios'}
                              icon="✨"
                              units={studioUnits}
                            />
                            <UnitGroup
                              title={isRTL ? 'الشقق العائلية المتاحة' : 'Available Apartments'}
                              icon="🏘️"
                              units={apartmentUnits}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* FINAL FORM SIDE (Right/Sticky) */}
              <div className="w-full lg:w-[400px] xl:w-[450px] sticky top-32 order-1 lg:order-2">
                <div className="bg-white p-8 md:p-12 rounded-[40px] md:rounded-[60px] border border-[#EAE4D9]/60 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-[#C1A68D]/5 rounded-bl-full -z-10" />

                  <header className={`space-y-2 mb-8 md:mb-10 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <h3 className="text-2xl md:text-3xl font-black text-[#2A2723] tracking-tighter italic">
                      {isRTL ? 'أتمم حجزك الآن' : 'Finalize Reservation'}
                    </h3>
                    <p className="text-[9px] md:text-[10px] font-bold text-[#7A7061] uppercase tracking-widest leading-relaxed opacity-70">
                      {isRTL ? 'أدخل بياناتك للتأكيد الفوري عبر واتساب' : 'Enter your details for instant WhatsApp confirmation'}
                    </p>
                  </header>

                  <form onSubmit={handleSubmitBooking} className="space-y-6 md:space-y-8">
                    <div className="space-y-4 md:space-y-5">
                      <div className="space-y-2">
                        <label className={`block text-[9px] md:text-[10px] font-black text-[#5C554B] uppercase px-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          👤 {isRTL ? 'اسم الضيف بالكامل' : 'Full Guest Name'}
                        </label>
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder={isRTL ? "مثال: م. فوزي المطرى" : "e.g. John Doe"}
                          className={`w-full bg-[#F7F5F0] border-2 border-transparent focus:border-[#C1A68D] focus:bg-white rounded-2xl md:rounded-3xl px-6 md:px-8 py-4 md:py-5 outline-none font-bold transition-all ${isRTL ? 'text-right' : 'text-left'}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className={`block text-[18px] md:text-[20px] font-black text-[#E63946] uppercase px-2 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          📱 {isRTL ? 'رقم الواتس اب للتواصل' : 'WhatsApp Number for Contact'}
                        </label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+20 1..."
                          className={`w-full bg-[#F7F5F0] border-2 border-transparent focus:border-[#E63946] focus:bg-white rounded-2xl md:rounded-3xl px-6 md:px-8 py-4 md:py-5 outline-none font-black text-xl md:text-2xl transition-all ${isRTL ? 'text-right' : 'text-left'}`}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className={`block text-[9px] md:text-[10px] font-black text-[#5C554B] uppercase px-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          👥 {isRTL ? 'عدد الضيوف' : 'Number of Guests'}
                        </label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5, 6].map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setGuestsCount(num)}
                              className={`flex-1 py-3 rounded-xl font-black transition-all border-2 ${guestsCount === num ? 'bg-[#2A2723] text-white border-[#2A2723]' : 'bg-[#F7F5F0] text-[#7A7061] border-transparent hover:border-gray-200'}`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* SECTION 1: إثبات الشخصية */}
                      <div className="p-5 md:p-6 bg-[#F7F5F0] rounded-[24px] border border-[#EAE4D9] space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-[#EAE4D9]/60">
                          <label className={`text-xs font-black text-[#2A2723] flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <span>🪪</span>
                            <span>{isRTL ? 'إثبات الشخصية (بطاقة أو باسبور)' : 'National ID or Passport'}</span>
                          </label>
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full">
                            {isRTL ? 'مطلوب للإقامة' : 'Required'}
                          </span>
                        </div>
                        <p className={`text-[10px] text-[#7A7061] font-bold leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                          {isRTL ? 'يرجى إرفاق صورة واضحة من بطاقة الرقم القومي أو جواز السفر (صورة أو ملف PDF)' : 'Please attach a clear photo of your ID or passport (image or PDF)'}
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
                              setIdDocError(err?.message || (isRTL ? 'فشل رفع المستند، يرجى المحاولة مرة أخرى.' : 'Upload failed. Please try again.'));
                            } finally {
                              setIsUploadingIdDoc(false);
                            }
                          }}
                          className="w-full text-xs text-[#7A7061] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-[#2A2723] file:text-white hover:file:bg-black file:cursor-pointer cursor-pointer"
                        />
                        {isUploadingIdDoc && (
                          <p className="text-[10px] font-black text-amber-600 animate-pulse">⏳ {isRTL ? 'جاري رفع إثبات الشخصية...' : 'Uploading ID document...'}</p>
                        )}
                        {idDocUrl && (
                          <div className="flex items-center justify-between p-2.5 bg-green-50 border border-green-200 rounded-xl text-green-800 text-[11px] font-black">
                            <span>✓ {isRTL ? 'تم رفع إثبات الشخصية بنجاح!' : 'ID document uploaded successfully!'}</span>
                            <a href={idDocUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2A2723] underline hover:text-black">
                              {isRTL ? 'معاينة' : 'Preview'}
                            </a>
                          </div>
                        )}
                        {idDocError && (
                          <p className="text-[10px] font-black text-red-500">⚠️ {idDocError}</p>
                        )}
                      </div>

                      {/* SECTION 2: طريقة السداد والتحويل */}
                      <div className="p-5 md:p-6 bg-[#F7F5F0] rounded-[24px] border border-[#EAE4D9] space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[#EAE4D9]/60">
                          <h4 className={`text-xs font-black text-[#2A2723] flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <span>⚡</span>
                            <span>{isRTL ? 'بيانات التحويل والسداد (إنستا باي / تحويل بنكي)' : 'Payment & Transfer Info (InstaPay / Bank)'}</span>
                          </h4>
                        </div>

                        <div className="space-y-3 pt-2">
                          <PaymentInfoBox isRTL={isRTL} />
                          <div className="space-y-2 pt-2 border-t border-[#EAE4D9]">
                            <label className={`block text-[10px] font-black text-[#5C554B] uppercase ${isRTL ? 'text-right' : 'text-left'}`}>
                              🧾 {isRTL ? 'إرفاق صورة التحويل (إيصال السداد أو سكرين شوت)' : 'Attach Transfer Receipt (Image / PDF)'}
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
                                  setUploadError(err?.message || (isRTL ? 'فشل رفع الإيصال، يرجى المحاولة مرة أخرى.' : 'Upload failed. Please try again.'));
                                } finally {
                                  setIsUploadingReceipt(false);
                                }
                              }}
                              className="w-full text-xs text-[#7A7061] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-[#2A2723] file:text-white hover:file:bg-black file:cursor-pointer cursor-pointer"
                            />
                            {isUploadingReceipt && (
                              <p className="text-[10px] font-black text-amber-600 animate-pulse">⏳ {isRTL ? 'جاري رفع الإيصال...' : 'Uploading receipt...'}</p>
                            )}
                            {receiptUrl && (
                              <div className="flex items-center justify-between p-2.5 bg-green-50 border border-green-200 rounded-xl text-green-800 text-[11px] font-black">
                                <span>✓ {isRTL ? 'تم رفع إيصال التحويل بنجاح!' : 'Receipt uploaded successfully!'}</span>
                                <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2A2723] underline hover:text-black">
                                  {isRTL ? 'معاينة' : 'Preview'}
                                </a>
                              </div>
                            )}
                            {uploadError && (
                              <p className="text-[10px] font-black text-red-500">⚠️ {uploadError}</p>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>

                    {selectedUnitId && (() => {
                      const selUnit = availableUnits.find(u => u.id === selectedUnitId);
                      const unitP = getSafeUnitPrice(selUnit);
                      const nDays = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)));
                      const tot = nDays * unitP;
                      return (
                        <div className="bg-[#2A2723] p-5 md:p-6 rounded-3xl text-white space-y-4 shadow-lg">
                          <div className="flex justify-between items-center opacity-60 text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                            <span>{isRTL ? 'تفاصيل الحجز' : 'Selection Detail'}</span>
                            <span>{formatDate(checkIn)} → {formatDate(checkOut)}</span>
                          </div>
                          <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <p className="text-base md:text-lg font-bold">{selUnit?.title?.[language] || selectedUnitId}</p>
                            <span className="text-xs bg-[#C1A68D]/20 text-[#C1A68D] px-2.5 py-1 rounded-full font-black">
                              {selUnit?.type === 'studio' ? (isRTL ? 'استوديو' : 'Studio') : (isRTL ? 'شقة فندقية' : 'Apartment')}
                            </span>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center text-gray-300">
                              <span>{isRTL ? 'سعر الليلة:' : 'Price per night:'}</span>
                              <span className="font-bold text-white">{unitP} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-300">
                              <span>{isRTL ? 'عدد الليالي:' : 'Number of nights:'}</span>
                              <span className="font-bold text-white">{nDays} {isRTL ? 'ليالي' : 'nights'}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-white/10 text-base font-black">
                              <span className="text-[#C1A68D]">{isRTL ? 'الإجمالي المطلوب:' : 'Total Amount:'}</span>
                              <span className="text-xl text-[#4ECDC4]">{tot} ج.م</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* SECTION 3: شروط وقوانين الإقامة */}
                    <div className="space-y-3 pt-2">
                      <div className={`flex items-center justify-between ${isRTL ? 'flex-row' : 'flex-row-reverse'}`}>
                        <button
                          type="button"
                          onClick={() => setShowRulesModal(true)}
                          className="text-xs font-black text-[#C1A68D] hover:text-[#2A2723] underline flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>📜</span>
                          <span>{isRTL ? 'اضغط هنا لقراءة قواعد وشروط الإقامة' : 'Click to view house rules & terms'}</span>
                        </button>
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer group bg-[#F7F5F0] p-4 rounded-2xl border border-[#EAE4D9] hover:border-[#C1A68D] transition-colors">
                        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                          <input 
                            type="checkbox" 
                            required
                            checked={rulesAccepted}
                            onChange={(e) => setRulesAccepted(e.target.checked)}
                            className="peer appearance-none w-5 h-5 border-2 border-[#C1A68D] rounded-md checked:bg-[#2A2723] checked:border-[#2A2723] transition-colors cursor-pointer"
                          />
                          <span className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none text-xs font-black">✓</span>
                        </div>
                        <p className={`text-xs text-[#5C554B] font-bold leading-relaxed selection:bg-transparent ${isRTL ? 'text-right' : 'text-left'}`}>
                          {isRTL ? (
                            <>أوافق على قراءة والالتزام الكامل بـ <span onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }} className="text-[#C1A68D] underline font-black">قواعد وشروط الإقامة</span> الخاصة بمجمع مزار الفندقي.</>
                          ) : (
                            <>I agree to comply with the <span onClick={(e) => { e.preventDefault(); setShowRulesModal(true); }} className="text-[#C1A68D] underline font-black">house rules and terms</span> of Mazar.</>
                          )}
                        </p>
                      </label>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <div className="pt-2 space-y-3">
                      {(!receiptUrl && paymentMethod === 'whatsapp') && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold text-center">
                          ⚠️ {isRTL ? 'تنبيه: لتأكيد الحجز النهائي يرجى التواصل معنا على واتساب وإرسال صورة إيصال التحويل' : 'Final confirmation requires transfer receipt via WhatsApp'}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSubmitting || !name || !phone || !selectedUnitId || !rulesAccepted}
                        className={`group relative w-full text-white font-black py-5 md:py-6 rounded-2xl md:rounded-[28px] transition-all flex items-center justify-center gap-3 text-lg md:text-xl shadow-xl disabled:opacity-30 ${
                          receiptUrl || paymentMethod === 'visa'
                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                            : 'bg-[#E63946] hover:bg-[#c1121f] shadow-red-500/20'
                        }`}
                      >
                        <span className="relative z-10">
                          {isSubmitting ? '...' : (
                            receiptUrl || paymentMethod === 'visa'
                              ? (isRTL ? '✅ تأكيد وإرسال الحجز الفوري' : '✅ Instant Confirmation')
                              : (isRTL ? '💬 إرسال الطلب والتواصل عبر واتساب' : '💬 Reserve & Confirm via WhatsApp')
                          )}
                        </span>
                      </button>

                      <p className="text-center text-[10px] font-bold text-[#7A7061] opacity-80">
                        {receiptUrl || paymentMethod === 'visa'
                          ? (isRTL ? '✨ سيتم تأكيد حجزك فورياً لمطابقة الإيصال وإثبات الشخصية' : 'Instant confirmation upon receipt and ID verification')
                          : (isRTL ? 'لو لم ترسل صورة تحويل، يرجى التواصل معنا على واتساب لاعتماد الحجز' : 'If no receipt is attached, contact us on WhatsApp to confirm')}
                      </p>
                    </div>
                  </form>

                  <div className="mt-6 md:mt-8 text-center">
                    <p className="text-[8px] md:text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center justify-center gap-2">
                      <span className="w-6 md:w-8 h-[1px] bg-gray-100" />
                      {isRTL ? 'دفع عند الوصول' : 'Pay on Arrival'}
                      <span className="w-6 md:w-8 h-[1px] bg-gray-100" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      {quickViewUnit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setQuickViewUnit(null)} />
          <div className="bg-white w-full max-w-6xl rounded-3xl md:rounded-[40px] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row max-h-[95vh] animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setQuickViewUnit(null)}
              className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-10 h-10 bg-black/50 hover:bg-black text-white rounded-full flex items-center justify-center z-20 backdrop-blur-md transition-colors`}
            >
              ✕
            </button>

            {/* Left Side: Exact Gallery Section */}
            <div className="md:w-[45%] lg:w-1/2 p-6 md:p-10 bg-[#FDFBF7] flex flex-col gap-6 overflow-y-auto hidden-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {/* Main Image/Video View */}
              <div className="relative h-[300px] md:h-[450px] rounded-[32px] overflow-hidden shadow-sm bg-black flex items-center justify-center shrink-0">
                {(() => {
                  const isVideo = (url: string) => {
                    if (!url) return false;
                    const l = url.toLowerCase();
                    return l.includes('.mp4') || l.includes('.mov') || l.includes('.webm');
                  };
                  return isVideo(quickViewActiveImage) ? (
                    <video src={encodeURI(quickViewActiveImage)} controls autoPlay muted playsInline preload="metadata" className="w-full h-full object-contain" />
                  ) : (
                    <img src={quickViewActiveImage} alt="Active Media" className="w-full h-full object-cover transition-transform duration-700" />
                  );
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                <div className={`absolute bottom-6 ${isRTL ? 'right-6' : 'left-6'} text-white`}>
                  <div className="text-sm font-bold bg-[#E63946] px-3 py-1 rounded-full inline-block mb-2 shadow-sm">
                    {quickViewUnit.type === 'studio' ? (isRTL ? 'استوديو' : 'Studio') : (isRTL ? 'شقة فندقية' : 'Hotel Apartment')}
                  </div>
                </div>
              </div>

              {/* Thumbnail Grid (Media) */}
              <div className="grid grid-cols-5 md:grid-cols-6 gap-3 shrink-0">
                {(() => {
                  const resolvedVid = resolveUnitVideo(quickViewUnit);
                  return resolvedVid ? (
                    <button
                      onClick={() => setQuickViewActiveImage(resolvedVid)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all bg-black flex flex-col items-center justify-center ${quickViewActiveImage === resolvedVid ? 'border-[#C1A68D] scale-95 shadow-lg' : 'border-[#EAE4D9] hover:border-[#C1A68D]/40'}`}
                      title={isRTL ? "تشغيل فيديو الوحدة" : "Play Unit Video"}
                    >
                      <span className="text-[#C1A68D] text-lg font-black">▶</span>
                      <span className="text-[7px] font-bold text-white uppercase">{isRTL ? "فيديو" : "Video"}</span>
                    </button>
                  ) : null;
                })()}
                {quickViewUnit.images && quickViewUnit.images.slice(0, 11).map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setQuickViewActiveImage(img)}
                    className={`aspect-square rounded-2xl overflow-hidden border-2 transition-all ${quickViewActiveImage === img ? 'border-[#C1A68D] scale-95 shadow-lg' : 'border-[#EAE4D9] hover:border-[#C1A68D]/40'}`}
                  >
                    <img src={img} alt={`Thumb ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right Side: Exact Info Section */}
            <div className={`flex flex-col md:w-[55%] lg:w-1/2 p-6 md:p-10 overflow-y-auto max-h-[70vh] md:max-h-[95vh] ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-block bg-[#F7F5F0] border border-[#C1A68D]/30 px-3 py-1 rounded-lg text-[10px] font-bold text-[#C1A68D] uppercase tracking-widest">
                  {quickViewUnit.type}
                </div>
                <div className={`inline-block px-3 py-1 rounded-lg text-white text-[10px] font-bold tracking-widest shadow-md ${quickViewUnit.status === 'متاح' || !quickViewUnit.status ? 'bg-green-500' : quickViewUnit.status === 'مشغول' ? 'bg-blue-500' : 'bg-red-500'}`}>
                  {quickViewUnit.status || 'متاح'}
                </div>
              </div>

              <h1 className="text-3xl md:text-5xl font-black text-[#2A2723] mb-6 leading-tight">
                {quickViewUnit?.title?.[language] || quickViewUnit?.id}
              </h1>

              {quickViewUnit.price && (
                <div className="flex items-center gap-4 mb-8">
                  <div className="text-3xl font-black text-[#C1A68D]">
                    {quickViewUnit.price} <span className="text-base font-bold">/ {isRTL ? 'الليلة' : 'Night'}</span>
                  </div>
                  {quickViewUnit.originalPrice && (
                    <div className="text-xl text-[#9A8F82] line-through font-bold">
                      {quickViewUnit.originalPrice}
                    </div>
                  )}
                </div>
              )}

              <p className="text-base md:text-lg text-[#5C554B] leading-loose mb-10 opacity-90">
                {quickViewUnit?.description?.[language] || ''}
              </p>

              <div className="bg-white p-6 md:p-8 rounded-[30px] md:rounded-[40px] border border-[#EAE4D9] shadow-sm mb-10 shrink-0">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E63946]"></span>
                  {isRTL ? 'مميزات الوحدة' : 'Unit Features'}
                </h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                  {quickViewUnit?.features?.[language]?.map((feat: string, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-[#4A3F2F] font-bold">
                      <span className="text-green-500">✓</span>
                      {feat}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-[#EAE4D9] shrink-0">
                <button
                  onClick={() => { setSelectedUnitId(quickViewUnit.id); setQuickViewUnit(null); }}
                  className="w-full bg-[#E63946] text-white font-black py-4 md:py-6 rounded-2xl md:rounded-3xl hover:bg-[#c1121f] text-xl md:text-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <span className="text-2xl">🗓️</span>
                  {isRTL ? 'تحديد هذه الوحدة للحجز' : 'Select this Unit'}
                </button>
              </div>

              <div className="mt-8 flex items-center gap-4 justify-center shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#9A8F82] uppercase tracking-[0.2em]">
                  <span>🔒</span>
                  <span>Smart Access</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-[#EAE4D9]" />
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#9A8F82] uppercase tracking-[0.2em]">
                  <span>❄️</span>
                  <span>Full AC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
