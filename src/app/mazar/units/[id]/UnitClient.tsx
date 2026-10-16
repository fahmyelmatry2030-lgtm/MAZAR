'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';
import { processAndUploadReceipt } from '@/lib/uploadHelper';
import PaymentInfoBox from '@/components/PaymentInfoBox';
import Image from 'next/image';
import UnitImageLightbox from '@/components/UnitImageLightbox';
import { ZoomIn } from 'lucide-react';


const ADMIN_WHATSAPP = '201108109969';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const getTodayStr = () => new Date().toISOString().split('T')[0];
const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

const fixImagePath = (src?: string) => {
  if (!src) return '/images/logo-en.jpg';
  try {
    let clean = decodeURIComponent(src)
      .replace(/\/Mazar%201%20Pictures\//gi, '/mazar1/')
      .replace(/\/Mazar\s*1\s*Pictures\//gi, '/mazar1/');
    if (!clean.startsWith('http') && !clean.startsWith('/')) {
      clean = '/' + clean;
    }
    return clean;
  } catch {
    return src;
  }
};

export default function UnitDetailsPage({ initialUnit }: { initialUnit: any }) {
  const { t, isRTL, language } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [unit, setUnit] = useState<any>(initialUnit);
  const [activeMedia, setActiveMedia] = useState<'image' | 'video'>('image');
  const [activeImage, setActiveImage] = useState<string>(
    fixImagePath((initialUnit?.images && initialUnit?.images[0]) || '/images/logo-en.jpg')
  );
  const [status, setStatus] = useState<string>(initialUnit?.status || 'متاح');
  const [isLoading, setIsLoading] = useState(!initialUnit);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // ── Booking form state ──────────────────────────────────────────────
  const [checkIn, setCheckIn] = useState(getTodayStr());
  const [checkOut, setCheckOut] = useState(getTomorrowStr());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guestsCount, setGuestsCount] = useState(1);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [unitAvailable, setUnitAvailable] = useState(true);

  // ── Load unit data ──────────────────────────────────────────────────
  useEffect(() => {
    const loadUnit = async () => {
      try {
        const res = await fetch('/api/units');
        if (!res.ok) return;
        const allUnits = await res.json();
        const foundUnit: any = allUnits.find((u: any) => u.id === id);
        if (foundUnit) {
          setUnit(foundUnit);
          if (foundUnit.images && foundUnit.images.length > 0) {
            setActiveImage(fixImagePath(foundUnit.images[0]));
          }
          setStatus(foundUnit.status || 'متاح');
        }
      } catch { /* silently fail */ }
      setIsLoading(false);
    };
    if (!initialUnit) loadUnit();
    else setIsLoading(false);
  }, [id, initialUnit]);

  // ── Load booked dates for this unit ────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const fetchBooked = async () => {
      try {
        const res = await fetch('/api/bookings', { cache: 'no-store' });
        if (!res.ok) return;
        const allBookings = await res.json();
        const dates = allBookings
          .filter((b: any) => b.apartmentId === id && !['cancelled', 'deleted', 'rejected', 'مرفوض'].includes(b.status))
          .flatMap((b: any) => {
            const result: string[] = [];
            let current = new Date(b.checkIn);
            const end = new Date(b.checkOut);
            while (current < end) {
              result.push(current.toISOString().split('T')[0]);
              current.setDate(current.getDate() + 1);
            }
            return result;
          });
        setBookedDates(dates);
      } catch { setBookedDates([]); }
    };
    fetchBooked();
  }, [id]);

  // ── Check availability when dates change ───────────────────────────
  useEffect(() => {
    if (!checkIn || !checkOut || !id) return;
    const isBooked = bookedDates.some(d => d >= checkIn && d < checkOut);
    setUnitAvailable(!isBooked);
  }, [checkIn, checkOut, bookedDates, id]);

  // ── Submit booking ──────────────────────────────────────────────────
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !rulesAccepted) return;
    setIsSubmitting(true);
    setBookingError(null);

    const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)));
    const pricePerNight = unit?.price ? (parseInt(String(unit.price).replace(/[^0-9]/g, '')) || 0) : 0;
    const totalAmount = nights * pricePerNight;

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
      apartmentId: id,
      dates: `${checkIn} - ${checkOut}`,
      guest: name,
      guestsCount,
      studio: unit?.title?.['ar'] || id,
      paymentInfo: receiptUrl ? `[طلب ويب] صورة التحويل: ${receiptUrl}` : (totalAmount > 0 ? `متبقي ${totalAmount}` : 'باقي'),
      notes: receiptUrl ? `رابط إيصال التحويل: ${receiptUrl}` : '',
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

      const adminMsg = `🔔 *طلب حجز جديد من الموقع!*\n\n👤 *العميل:* ${name}\n📱 *الموبايل:* ${phone}\n👥 *عدد الأشخاص:* ${guestsCount}\n🏠 *الوحدة:* ${unit?.title?.['ar'] || id}\n📅 *الفترة:* من ${formatDate(checkIn)} إلى ${formatDate(checkOut)} (إجمالي ${nights} ليالي)${receiptUrl ? `\n📸 *إيصال التحويل:* ${receiptUrl}` : ''}\n\nيرجى تأكيد الحجز معي.`;
      const waUrl = `https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}&text=${encodeURIComponent(adminMsg)}`;
      window.location.href = waUrl;
    } catch {
      setIsSubmitting(false);
      setBookingError(isRTL ? 'حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.' : 'Error saving request. Please try again.');
    }
  };

  // ── Date picker helper ─────────────────────────────────────────────
  const ManualPicker = ({ label, value, options, onSelect, color = 'gold' }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div className="space-y-1 relative">
        <label className="block text-[9px] font-bold text-gray-400 uppercase px-1">{label}</label>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full bg-[#F7F5F0] border-2 transition-all rounded-xl p-3 text-base font-black flex items-center justify-between ${isOpen ? (color === 'red' ? 'border-[#E63946] bg-white shadow-lg' : 'border-[#C1A68D] bg-white shadow-lg') : 'border-transparent hover:border-gray-200'}`}
        >
          <span className="flex-1 text-center">{value}</span>
          <span className="text-[8px] opacity-30">▼</span>
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
            <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-[#EAE4D9] rounded-2xl shadow-2xl z-[70] p-1.5 max-h-[200px] overflow-y-auto">
              {options.map((opt: any) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onSelect(opt); setIsOpen(false); }}
                  className={`w-full p-2.5 rounded-xl text-sm font-black transition-all ${value === opt ? (color === 'red' ? 'bg-[#E63946] text-white' : 'bg-[#2A2723] text-white') : 'hover:bg-[#F7F5F0] text-[#2A2723]'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

  if (isLoading) {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-[#2A2723] font-bold">جاري التحميل...</div>;
  }

  if (!unit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="mb-8">{isRTL ? 'الوحدة غير موجودة' : 'Unit not found'}</p>
          <button onClick={() => router.push('/')} className="bg-[#2A2723] text-white px-8 py-2 rounded-full">
            {isRTL ? 'الرئيسية' : 'Home'}
          </button>
        </div>
      </div>
    );
  }

  const nights = checkIn && checkOut && new Date(checkOut) > new Date(checkIn)
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <main className="min-h-screen bg-[#FDFBF7] text-[#2A2723] selection:bg-[#C1A68D] selection:text-white">

      {/* Navigation */}
      <nav className="w-full px-6 py-4 hidden md:flex justify-between items-center max-w-screen-2xl mx-auto z-50 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-[#EAE4D9]">
        <Link href="/">
          <Logo size={42} />
        </Link>
        <div className="flex items-center gap-6">
          <LanguageSwitcher />
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-8 md:py-16">

        {/* Back button */}
        <div className="mb-8">
          <button onClick={() => router.back()} className="text-sm font-bold text-[#C1A68D] flex items-center gap-2 hover:opacity-80">
            ← {isRTL ? 'العودة' : 'Back'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

          {/* ── LEFT: Gallery ──────────────────────────────────── */}
          <div className="space-y-6">
            {/* Main media */}
            <div
              onClick={() => {
                if (activeMedia === 'image' && unit?.images?.length) {
                  const idx = unit.images.findIndex((img: string) => fixImagePath(img) === fixImagePath(activeImage));
                  setLightboxIndex(idx >= 0 ? idx : 0);
                  setIsLightboxOpen(true);
                }
              }}
              className="relative h-[360px] md:h-[480px] rounded-[32px] overflow-hidden shadow-md bg-black flex items-center justify-center group cursor-pointer"
            >
              {activeMedia === 'video' && unit?.video ? (
                <video src={encodeURI(unit.video)} controls autoPlay muted playsInline preload="metadata" className="w-full h-full object-contain" />
              ) : (
                <>
                  <Image
                    src={fixImagePath(activeImage)}
                    alt={unit?.title?.[language] || ''}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    unoptimized
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target) {
                        target.srcset = '/images/logo-en.jpg';
                        target.src = '/images/logo-en.jpg';
                      }
                    }}
                    priority
                  />
                  {activeMedia === 'image' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const idx = unit?.images?.findIndex((img: string) => fixImagePath(img) === fixImagePath(activeImage));
                        setLightboxIndex(idx >= 0 ? idx : 0);
                        setIsLightboxOpen(true);
                      }}
                      className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} z-20 bg-black/60 hover:bg-[#C1A68D] text-white hover:text-black p-2.5 px-3.5 rounded-full backdrop-blur-md border border-white/20 transition-all shadow-lg flex items-center gap-1.5 text-xs font-bold`}
                      title={isRTL ? "تكبير واستعراض الصورة" : "Zoom & Preview Image"}
                    >
                      <ZoomIn size={16} />
                      <span>{isRTL ? "تكبير الصورة" : "Zoom"}</span>
                    </button>
                  )}
                  {unit?.video && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMedia('video');
                      }}
                      className="absolute inset-0 m-auto w-20 h-20 md:w-24 md:h-24 rounded-full bg-black/60 hover:bg-[#C1A68D] text-white hover:text-[#2A2723] backdrop-blur-md border-2 border-white/40 flex flex-col items-center justify-center gap-1 transition-all duration-300 transform hover:scale-110 shadow-2xl z-20 group/play cursor-pointer"
                      title={isRTL ? 'تشغيل فيديو الاستوديو' : 'Play Studio Video'}
                    >
                      <span className="text-2xl md:text-3xl ml-1 text-[#C1A68D] group-hover/play:text-[#2A2723] transition-colors">▶</span>
                      <span className="text-[10px] font-black tracking-wider uppercase">{isRTL ? 'تشغيل الفيديو' : 'Play Video'}</span>
                    </button>
                  )}
                </>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              <div className={`absolute bottom-5 ${isRTL ? 'right-5' : 'left-5'}`}>
                <div className="text-xs font-bold bg-[#E63946] text-white px-3 py-1 rounded-full">
                  {unit?.type === 'studio' ? (isRTL ? 'استوديو' : 'Studio') : (isRTL ? 'شقة فندقية' : 'Hotel Apartment')}
                </div>
              </div>
            </div>

            {/* Thumbnails */}
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {unit?.video && (
                <button
                  type="button"
                  onClick={() => setActiveMedia('video')}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 bg-[#2A2723] text-white flex flex-col items-center justify-center gap-0.5 transition-all ${
                    activeMedia === 'video'
                      ? 'border-[#C1A68D] scale-95 shadow-lg ring-2 ring-[#C1A68D]'
                      : 'border-[#EAE4D9] hover:border-[#C1A68D]/60'
                  }`}
                  title={isRTL ? 'تشغيل فيديو الاستوديو' : 'Play Studio Video'}
                >
                  <span className="text-lg font-black text-[#C1A68D]">▶</span>
                  <span className="text-[9px] font-black tracking-wider opacity-90">{isRTL ? 'فيديو' : 'Video'}</span>
                </button>
              )}
              {unit?.images?.map((imgRaw: string, i: number) => {
                const img = fixImagePath(imgRaw);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setActiveMedia('image');
                      setActiveImage(img);
                    }}
                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
                      activeMedia === 'image' && activeImage === img
                        ? 'border-[#C1A68D] scale-95 shadow-md'
                        : 'border-[#EAE4D9] hover:border-[#C1A68D]/50'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={unit?.title?.[language] || `Thumb ${i}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target) {
                          target.srcset = '/images/logo-en.jpg';
                          target.src = '/images/logo-en.jpg';
                        }
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Unit info */}
            <div className={`flex flex-col ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="bg-[#F7F5F0] border border-[#C1A68D]/30 px-3 py-1 rounded-lg text-[10px] font-bold text-[#C1A68D] uppercase tracking-widest">
                  {unit?.type || 'Unit'}
                </div>
                <div className={`px-3 py-1 rounded-lg text-white text-[10px] font-bold tracking-widest ${status === 'متاح' ? 'bg-green-500' : status === 'مشغول' ? 'bg-blue-500' : 'bg-red-500'}`}>
                  {status}
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-black text-[#2A2723] mb-4 leading-tight">
                {unit?.title?.[language] || (isRTL ? 'وحدة بدون اسم' : 'Unnamed Unit')}
              </h1>

              {unit?.price && (
                <div className="flex items-center gap-4 mb-6">
                  <div className="text-2xl font-black text-[#C1A68D]">
                    {unit.price} <span className="text-sm font-bold">/ {isRTL ? 'الليلة' : 'Night'}</span>
                  </div>
                  {unit.originalPrice && (
                    <div className="text-lg text-[#9A8F82] line-through font-bold">{unit.originalPrice}</div>
                  )}
                </div>
              )}

              <p className="text-base text-[#5C554B] leading-loose mb-8 opacity-90">
                {unit?.description?.[language] || ''}
              </p>

              {/* Features */}
              {unit?.features?.[language]?.length > 0 && (
                <div className="bg-white p-6 rounded-[28px] border border-[#EAE4D9] shadow-sm">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E63946]"></span>
                    {t.unitsPage.unitFeatures}
                  </h3>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                    {unit.features[language].map((feat: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-[#4A3F2F] font-bold">
                        <span className="text-green-500">✓</span>
                        {feat}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Booking Form ─────────────────────────────── */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="bg-white rounded-[40px] border border-[#EAE4D9] shadow-xl p-8 md:p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#C1A68D]/5 rounded-bl-full -z-10" />

              <div className={`mb-8 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className="inline-block text-[10px] font-black px-3 py-1 rounded-full bg-[#C1A68D]/10 text-[#C1A68D] border border-[#C1A68D]/20 mb-3">
                  🗓️ {isRTL ? 'احجز هذه الوحدة' : 'Book This Unit'}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-[#2A2723] tracking-tight">
                  {isRTL ? 'أتمم حجزك الآن' : 'Finalize Your Booking'}
                </h2>
                <p className="text-xs font-bold text-[#7A7061] mt-1 opacity-70">
                  {isRTL ? 'أدخل التواريخ وبياناتك للتأكيد الفوري' : 'Enter dates & details for instant confirmation'}
                </p>
              </div>

              <form onSubmit={handleSubmitBooking} className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>

                {/* ── Dates ─────────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Check-in */}
                  <div className="bg-[#F7F5F0] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🛬</span>
                      <span className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest">
                        {isRTL ? 'تاريخ الوصول' : 'Check-in'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <ManualPicker
                        label={isRTL ? 'اليوم' : 'Day'}
                        value={checkIn.split('-')[2]}
                        options={Array.from({ length: getDaysInMonth(+checkIn.split('-')[0], +checkIn.split('-')[1]) }, (_, i) => (i + 1).toString().padStart(2, '0'))}
                        onSelect={(v: string) => setCheckIn(`${checkIn.split('-')[0]}-${checkIn.split('-')[1]}-${v}`)}
                      />
                      <ManualPicker
                        label={isRTL ? 'الشهر' : 'Month'}
                        value={checkIn.split('-')[1]}
                        options={Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))}
                        onSelect={(v: string) => setCheckIn(`${checkIn.split('-')[0]}-${v}-${checkIn.split('-')[2]}`)}
                      />
                      <ManualPicker
                        label={isRTL ? 'السنة' : 'Year'}
                        value={checkIn.split('-')[0]}
                        options={[new Date().getFullYear().toString(), (new Date().getFullYear() + 1).toString()]}
                        onSelect={(v: string) => setCheckIn(`${v}-${checkIn.split('-')[1]}-${checkIn.split('-')[2]}`)}
                      />
                    </div>
                  </div>

                  {/* Check-out */}
                  <div className="bg-[#FFF5F5] rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🛫</span>
                      <span className="text-[10px] font-black text-[#E63946] uppercase tracking-widest">
                        {isRTL ? 'تاريخ المغادرة' : 'Check-out'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <ManualPicker
                        label={isRTL ? 'اليوم' : 'Day'}
                        value={checkOut.split('-')[2]}
                        options={Array.from({ length: getDaysInMonth(+checkOut.split('-')[0], +checkOut.split('-')[1]) }, (_, i) => (i + 1).toString().padStart(2, '0'))}
                        onSelect={(v: string) => setCheckOut(`${checkOut.split('-')[0]}-${checkOut.split('-')[1]}-${v}`)}
                        color="red"
                      />
                      <ManualPicker
                        label={isRTL ? 'الشهر' : 'Month'}
                        value={checkOut.split('-')[1]}
                        options={Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))}
                        onSelect={(v: string) => setCheckOut(`${checkOut.split('-')[0]}-${v}-${checkOut.split('-')[2]}`)}
                        color="red"
                      />
                      <ManualPicker
                        label={isRTL ? 'السنة' : 'Year'}
                        value={checkOut.split('-')[0]}
                        options={[new Date().getFullYear().toString(), (new Date().getFullYear() + 1).toString()]}
                        onSelect={(v: string) => setCheckOut(`${v}-${checkOut.split('-')[1]}-${checkOut.split('-')[2]}`)}
                        color="red"
                      />
                    </div>
                  </div>

                  {/* Nights summary */}
                  {nights > 0 && (
                    <div className={`flex items-center justify-between bg-[#2A2723] text-white px-5 py-3 rounded-2xl font-black`}>
                      <span className="text-sm">{isRTL ? 'إجمالي الإقامة' : 'Total Stay'}</span>
                      <span className="text-lg">✨ {nights} {isRTL ? 'ليالي' : 'Nights'}</span>
                    </div>
                  )}

                  {/* Unavailable warning */}
                  {nights > 0 && !unitAvailable && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm font-bold text-center">
                      ⚠️ {isRTL ? 'هذه الوحدة محجوزة في هذا التاريخ. جرب تاريخاً آخر.' : 'Unit is booked for these dates. Try different dates.'}
                    </div>
                  )}
                </div>

                {/* ── Guest Name ─────────────────────────────────── */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-[#5C554B] uppercase px-1">
                    👤 {isRTL ? 'اسم الضيف بالكامل' : 'Full Guest Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={isRTL ? 'مثال: أحمد محمد' : 'e.g. John Doe'}
                    className="w-full bg-[#F7F5F0] border-2 border-transparent focus:border-[#C1A68D] focus:bg-white rounded-2xl px-5 py-4 outline-none font-bold transition-all text-right"
                    dir="rtl"
                  />
                </div>

                {/* ── WhatsApp Phone ─────────────────────────────── */}
                <div className="space-y-2">
                  <label className="block text-base font-black text-[#E63946] uppercase px-1">
                    📱 {isRTL ? 'رقم الواتس اب للتواصل' : 'WhatsApp Number'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+20 1..."
                    className="w-full bg-[#F7F5F0] border-2 border-transparent focus:border-[#E63946] focus:bg-white rounded-2xl px-5 py-4 outline-none font-black text-xl transition-all text-right"
                    dir="ltr"
                  />
                </div>

                {/* ── Guests count ───────────────────────────────── */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-[#5C554B] uppercase px-1">
                    👥 {isRTL ? 'عدد الضيوف' : 'Number of Guests'}
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setGuestsCount(num)}
                        className={`flex-1 py-3 rounded-xl font-black transition-all border-2 text-sm ${guestsCount === num ? 'bg-[#2A2723] text-white border-[#2A2723]' : 'bg-[#F7F5F0] text-[#7A7061] border-transparent hover:border-gray-200'}`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Payment & Receipt ──────────────────────────── */}
                <div className="p-5 bg-[#F7F5F0] rounded-2xl border border-[#EAE4D9] space-y-3">
                  <h4 className="text-xs font-black text-[#2A2723] pb-2 border-b border-[#EAE4D9]/60 text-right">
                    💳 {isRTL ? 'بيانات الدفع' : 'Payment Info'}
                  </h4>
                  <PaymentInfoBox isRTL={isRTL} />
                  <div className="space-y-2 pt-1">
                    <label className="block text-[10px] font-black text-[#5C554B] uppercase text-right">
                      📸 {isRTL ? 'إرفاق إيصال التحويل (اختياري)' : 'Attach Receipt (Optional)'}
                    </label>
                    <input
                      type="file"
                      accept="image/*"
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
                          setUploadError(err?.message || (isRTL ? 'فشل رفع الصورة، يرجى المحاولة مرة أخرى أو اختيار صورة أخرى.' : 'Upload failed. Please try again.'));
                        } finally {
                          setIsUploadingReceipt(false);
                        }
                      }}
                      className="w-full text-xs text-[#7A7061] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-[#2A2723] file:text-white hover:file:bg-black file:cursor-pointer cursor-pointer"
                    />
                    {isUploadingReceipt && <p className="text-[10px] font-black text-amber-600 animate-pulse">⏳ {isRTL ? 'جاري رفع الإيصال...' : 'Uploading...'}</p>}
                    {receiptUrl && <p className="text-[10px] font-black text-green-600">✓ {isRTL ? 'تم رفع الإيصال بنجاح!' : 'Receipt uploaded!'}</p>}
                    {uploadError && <p className="text-[10px] font-black text-red-500">⚠️ {uploadError}</p>}
                  </div>
                </div>

                {/* ── Rules checkbox ─────────────────────────────── */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="relative flex items-center justify-center shrink-0 mt-1">
                    <input
                      type="checkbox"
                      required
                      checked={rulesAccepted}
                      onChange={e => setRulesAccepted(e.target.checked)}
                      className="peer appearance-none w-6 h-6 border-2 border-[#EAE4D9] rounded-lg checked:bg-[#2A2723] checked:border-[#2A2723] transition-colors cursor-pointer"
                    />
                    <span className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none text-xs">✓</span>
                  </div>
                  <p className="text-xs text-[#7A7061] font-bold leading-relaxed text-right">
                    أوافق على{' '}
                    <Link href="/mazar/rules" target="_blank" className="text-[#C1A68D] underline hover:text-[#2A2723] font-black">
                      قواعد المبيت والشروط والأحكام
                    </Link>{' '}
                    الخاصة بمجمع مزار الفندقي.
                  </p>
                </label>

                {/* ── Error ──────────────────────────────────────── */}
                {bookingError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm font-bold text-center">
                    ⚠️ {bookingError}
                  </div>
                )}

                {/* ── Submit ─────────────────────────────────────── */}
                <button
                  type="submit"
                  disabled={isSubmitting || !name || !phone || !rulesAccepted || nights <= 0 || !unitAvailable}
                  className="w-full bg-[#E63946] text-white font-black py-5 rounded-2xl text-lg hover:bg-[#c1121f] transition-all shadow-xl shadow-red-500/20 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-30"
                >
                  <span className="text-2xl">💬</span>
                  {isSubmitting ? '...' : (isRTL ? 'تأكيد الحجز عبر واتساب' : 'Confirm via WhatsApp')}
                </button>

                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                  {isRTL ? 'دفع عند الوصول' : 'Pay on Arrival'}
                </p>

              </form>
            </div>
          </div>

        </div>

        {/* ── Gallery Grid ─────────────────────────────────────────── */}
        {unit?.images?.length > 3 && (
          <section className="mt-20 pt-16 border-t border-[#EAE4D9]">
            <h2 className="text-2xl font-black text-[#2A2723] mb-8 text-right">{t.unitsPage.gallery}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {unit.images.map((img: string, i: number) => (
                <div
                  key={i}
                  onClick={() => {
                    setLightboxIndex(i);
                    setIsLightboxOpen(true);
                  }}
                  className={`relative rounded-3xl overflow-hidden border border-[#EAE4D9] h-64 cursor-pointer hover:shadow-xl transition-all ${i % 3 === 0 ? 'md:col-span-2' : ''}`}
                >
                  <Image src={img} alt={`Gallery ${i}`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover hover:scale-105 transition-transform duration-700" />
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      <UnitImageLightbox
        isOpen={isLightboxOpen}
        images={(unit?.images || []).map(fixImagePath)}
        currentIndex={lightboxIndex}
        onClose={() => setIsLightboxOpen(false)}
        onSelectIndex={(idx) => setLightboxIndex(idx)}
        isRTL={isRTL}
      />

      <Footer />
    </main>
  );
}
