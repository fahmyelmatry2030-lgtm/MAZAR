'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';
import { saveBooking, initializeData, getSystemUnits, getBookings } from '@/lib/data-init';

export default function BookingPage() {
  const { t, isRTL, language } = useLanguage();

  const [step, setStep] = useState(1);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  const ADMIN_WHATSAPP = '201153705134';

  useEffect(() => {
    const init = async () => {
        await initializeData();
        const params = new URLSearchParams(window.location.search);
        const unitParam = params.get('unit');
        if (unitParam) {
          setSelectedUnitId(unitParam);
        }
    };
    init();
  }, []);

  const openWhatsAppAdmin = useCallback(() => {
    const selectedUnit = availableUnits.find((u: any) => u.id === selectedUnitId);
    const adminMsg = `🔔 *طلب حجز جديد من الموقع!*\n\n👤 *العميل:* ${name}\n📱 *الموبايل:* ${phone}\n🏠 *الوحدة:* ${selectedUnit ? selectedUnit.title['ar'] : selectedUnitId}\n📅 *الفترة:* ${checkIn} إلى ${checkOut}\n\nيرجى تأكيد الحجز معي.`;
    const waUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(adminMsg)}`;
    window.open(waUrl, '_blank');
  }, [availableUnits, checkIn, checkOut, name, phone, selectedUnitId]);

  useEffect(() => {
    if (isSuccess && redirectCountdown > 0) {
      const timer = setTimeout(() => setRedirectCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isSuccess && redirectCountdown === 0) {
      openWhatsAppAdmin();
    }
  }, [isSuccess, redirectCountdown, openWhatsAppAdmin]);

  const isDateOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    return (start1 < end2 && end1 > start2);
  };

  const handleDateSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkIn || !checkOut) return;
    
    setIsLoading(true);
    try {
        const allUnits = await getSystemUnits();
        const allBookings = await getBookings();
        
        const activeUnitsByStatus = allUnits.filter((u: any) => u.status === 'متاح' || !u.status);
        const available = activeUnitsByStatus.filter((unit: any) => {
            const unitBookings = allBookings.filter((b: any) => 
                b.apartmentId === unit.id && b.status !== 'cancelled' && b.status !== 'deleted'
            );
            const hasOverlap = unitBookings.some((b: any) => 
                isDateOverlap(checkIn, checkOut, b.checkIn, b.checkOut)
            );
            return !hasOverlap;
        });

        setAvailableUnits(available);
        if (available.length > 0) {
            const currentSTillAvailable = available.find((u: any) => u.id === selectedUnitId);
            if (!currentSTillAvailable) setSelectedUnitId(available[0].id);
        } else {
            setSelectedUnitId('');
        }
        setStep(2);
    } catch (err) {
        console.error('Availability check failed:', err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    setIsSubmitting(true);
    
    const selectedUnit = availableUnits.find((u: any) => u.id === selectedUnitId);
    const bookingData = {
      name,
      phone,
      checkIn,
      checkOut,
      apartmentId: selectedUnitId,
      dates: `${checkIn} - ${checkOut}`,
      guest: name,
      studio: selectedUnit ? selectedUnit.title[language] : selectedUnitId,
    };

    try {
        await saveBooking(bookingData);
        setIsSubmitting(false);
        setIsSuccess(true);
    } catch (err) {
        console.error(err);
        setIsSubmitting(false);
        alert('حدث خطأ أثناء حفظ الطلب.');
    }
  };

  const selectedUnit = availableUnits.find((u: any) => u.id === selectedUnitId);

  // Grouped Available Units
  const mazar1Units = availableUnits.filter((u: any) => u.branch === 1 && u.type === 'studio');
  const mazar2Units = availableUnits.filter((u: any) => u.branch === 2 && u.type === 'studio');
  const familyApartments = availableUnits.filter((u: any) => u.type === 'apartment');

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
              <p className="text-3xl font-black text-[#2A2723] mb-1">{selectedUnit ? selectedUnit.title[language] : selectedUnitId}</p>
              <div className="flex justify-center gap-6 mt-4">
                 <div className="text-center">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">{isRTL ? 'من' : 'From'}</p>
                    <p className="text-xs font-black">{checkIn}</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[9px] font-bold text-gray-400 uppercase">{isRTL ? 'إلى' : 'To'}</p>
                    <p className="text-xs font-black">{checkOut}</p>
                 </div>
              </div>
           </div>

           <p className="text-[#5C554B] text-lg leading-relaxed font-bold mb-10">
              {isRTL 
                ? 'لقد تم تسجيل طلبك بنجاح وجاري مراجعته.' 
                : 'Your booking has been saved successfully and is under review.'}
              <br/>
              <span className="text-[#25D366] font-black p-2 block animate-pulse">
                {isRTL 
                  ? `جاري تحويلك للواتساب للتأكيد تلقائياً خلال ${redirectCountdown}...` 
                  : `Redirecting to WhatsApp for confirmation in ${redirectCountdown}...`}
              </span>
           </p>

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
      
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#EAE4D9]/30 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#D5C5B3]/20 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Navigation */}
      <nav className="w-full px-8 py-5 flex justify-between items-center max-w-screen-2xl mx-auto z-50 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-[#EAE4D9]">
        <Link href="/">
           <Logo size={42} />
        </Link>
        <div className="flex items-center gap-8">
          <LanguageSwitcher />
          <Link href="/" className="text-xs font-black text-[#7A7061] hover:text-[#2A2723] uppercase tracking-tighter">
            {isRTL ? 'العودة للرئيسية ←' : '← Back to Home'}
          </Link>
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto flex flex-col items-center">
         
         {step === 1 ? (
           /* STEP 1: DATE SELECTION */
           <div className="w-full max-w-3xl p-6 py-12 md:py-24 animate-in fade-in zoom-in duration-700">
              <div className="text-center mb-12">
                 <div className="inline-block px-4 py-1.5 rounded-full bg-[#C1A68D]/10 text-[#C1A68D] text-[10px] font-black uppercase tracking-widest mb-4 border border-[#C1A68D]/20">Step 01 / Booking</div>
                 <h1 className="text-5xl md:text-6xl font-black text-[#2A2723] mb-4 tracking-tighter">{isRTL ? 'اختر مواعيدك' : 'Choose Your Dates'}</h1>
                 <p className="text-lg text-[#7A7061] font-medium">{isRTL ? 'حدد مواعيد الوصول والمغادرة للبدء' : 'Select arrival and departure dates to start'}</p>
              </div>

              <div className="bg-white p-12 rounded-[48px] border border-[#EAE4D9] shadow-[0_30px_100px_rgba(0,0,0,0.04)] relative overflow-hidden group">
                 <div className={`absolute top-0 ${isRTL ? 'right-0' : 'left-0'} w-24 h-24 bg-[#C1A68D]/5 rounded-br-full -z-0`} />
                 
                 <form onSubmit={handleDateSelection} className="space-y-10 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <label htmlFor="check-in" className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-1 flex items-center gap-2">
                             <span>📅</span> {isRTL ? 'تاريخ الوصول' : 'Check-in'}
                          </label>
                          <div className="relative">
                            <input 
                               id="check-in"
                               type="date" required min={new Date().toISOString().split('T')[0]}
                               value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                               className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-3xl px-8 py-5 focus:outline-none focus:border-[#C1A68D] transition-all text-xl font-bold"
                            />
                          </div>
                       </div>
                       <div className="space-y-4">
                          <label htmlFor="check-out" className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-1 flex items-center gap-2">
                             <span>🏁</span> {isRTL ? 'تاريخ المغادرة' : 'Check-out'}
                          </label>
                          <div className="relative">
                            <input 
                               id="check-out"
                               type="date" required min={checkIn || new Date().toISOString().split('T')[0]}
                               value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                               className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-3xl px-8 py-5 focus:outline-none focus:border-[#C1A68D] transition-all text-xl font-bold"
                            />
                          </div>
                       </div>
                    </div>

                    <button 
                       type="submit" disabled={!checkIn || !checkOut || isLoading}
                       className="w-full bg-[#2A2723] text-white font-black py-6 rounded-3xl text-2xl hover:bg-black transition-all"
                    >
                       {isLoading ? '...' : (isRTL ? 'تأكد من التوافر' : 'Check Availability')}
                    </button>
                 </form>
              </div>
           </div>
         ) : (
           /* STEP 2: COMPACT SELECTION */
           <div className="w-full max-w-7xl px-6 pb-24 animate-in slide-in-from-bottom-12 duration-1000">
              
              <div className="flex flex-col lg:flex-row gap-12 items-start">
                 
                 {/* UNIT SELECTION SIDE (Left/Main) */}
                 <div className="flex-1 space-y-12 w-full">
                    <header className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                       <button type="button" onClick={() => setStep(1)} className="text-[10px] font-black text-[#C1A68D] hover:text-[#2A2723] mb-4 inline-flex items-center gap-2 uppercase tracking-widest transition-colors">
                           {isRTL ? '← المواعيد' : '← Dates'}
                       </button>
                       <h2 className="text-4xl font-black text-[#2A2723] tracking-tighter">{isRTL ? 'الوحدات المتاحة حالياً' : 'Currently Available Units'}</h2>
                    </header>

                    {/* BRANCH GROUPS */}
                    <div className="space-y-10">
                       <div className="space-y-6">
                           <div className={`flex items-center justify-between pb-2 border-b border-[#EAE4D9] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                               <h3 className="text-xs font-black uppercase text-[#C1A68D] tracking-[0.2em]">📍 {isRTL ? 'مجموعة مزار 1' : 'Mazar 1 Collection'}</h3>
                               <p className="text-[10px] font-black text-[#7A7061]">{mazar1Units.length} {isRTL ? 'متاح' : 'Available'}</p>
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                              {mazar1Units.map((u) => (
                                 <button key={u.id} onClick={() => setSelectedUnitId(u.id)}
                                    className={`p-5 rounded-3xl border-2 transition-all text-center ${selectedUnitId === u.id ? 'bg-[#2A2723] border-[#2A2723] text-white shadow-lg' : 'bg-white border-[#EAE4D9]/50 text-[#2A2723]'}`}
                                 >
                                    <span className="text-sm font-black">{u.title[language]}</span>
                                 </button>
                              ))}
                           </div>
                       </div>
                       <div className="space-y-6">
                           <div className={`flex items-center justify-between pb-2 border-b border-[#EAE4D9] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                               <h3 className="text-xs font-black uppercase text-[#C1A68D] tracking-[0.2em]">🏩 {isRTL ? 'مجموعة مزار 2' : 'Mazar 2 Collection'}</h3>
                               <p className="text-[10px] font-black text-[#7A7061]">{mazar2Units.length} {isRTL ? 'متاح' : 'Available'}</p>
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                              {mazar2Units.map((u) => (
                                 <button key={u.id} onClick={() => setSelectedUnitId(u.id)}
                                    className={`p-5 rounded-3xl border-2 transition-all text-center ${selectedUnitId === u.id ? 'bg-[#2A2723] border-[#2A2723] text-white shadow-lg' : 'bg-white border-[#EAE4D9]/50 text-[#2A2723]'}`}
                                 >
                                    <span className="text-sm font-black">{u.title[language]}</span>
                                 </button>
                              ))}
                           </div>
                       </div>
                       <div className="space-y-6">
                           <div className={`flex items-center justify-between pb-2 border-b border-[#EAE4D9] ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                               <h3 className="text-xs font-black uppercase text-[#C1A68D] tracking-[0.2em]">🏠 {isRTL ? 'شقق فندقية عائلية' : 'Family Apartments'}</h3>
                               <p className="text-[10px] font-black text-[#7A7061]">{familyApartments.length} {isRTL ? 'متاح' : 'Available'}</p>
                           </div>
                           <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                              {familyApartments.map((u) => (
                                 <button key={u.id} onClick={() => setSelectedUnitId(u.id)}
                                    className={`p-5 rounded-3xl border-2 transition-all text-center ${selectedUnitId === u.id ? 'bg-[#2A2723] border-[#2A2723] text-white shadow-lg' : 'bg-white border-[#EAE4D9]/50 text-[#2A2723]'}`}
                                 >
                                    <span className="text-sm font-black">{u.title[language]}</span>
                                 </button>
                              ))}
                           </div>
                       </div>
                    </div>
                 </div>

                 {/* FINAL FORM SIDE (Right/Sticky) */}
                 <div className="w-full lg:w-[400px] sticky top-32">
                    <div className="bg-white p-8 md:p-10 rounded-[48px] border border-[#EAE4D9] shadow-2xl space-y-10">
                       <header className={`space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <h3 className="text-2xl font-black text-[#2A2723] tracking-tighter">{isRTL ? 'بيانات الاتصال' : 'Contact Details'}</h3>
                       </header>
                       <form onSubmit={handleSubmitBooking} className="space-y-6">
                          <div className="space-y-4">
                             <div className="space-y-2">
                                <label className={`block text-[10px] font-black text-[#5C554B] uppercase px-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                   👤 {isRTL ? 'اسم الضيف' : 'Guest Name'}
                                </label>
                                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                                   className={`w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-2xl px-6 py-4 outline-none font-bold ${isRTL ? 'text-right' : 'text-left'}`}
                                />
                             </div>
                             <div className="space-y-2">
                                <label className={`block text-[10px] font-black text-[#5C554B] uppercase px-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                   📱 {isRTL ? 'رقم الواتساب' : 'WhatsApp Number'}
                                </label>
                                <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
                                   className={`w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-2xl px-6 py-4 outline-none font-bold ${isRTL ? 'text-right' : 'text-left'}`}
                                />
                             </div>
                          </div>
                          <div className="pt-4">
                             <button type="submit" disabled={isSubmitting || !name || !phone || !selectedUnitId}
                                className="w-full bg-[#E63946] text-white font-black py-5 rounded-[22px] hover:bg-[#c1121f] transition-all flex items-center justify-center gap-4 text-xl disabled:opacity-20"
                             >
                                {isSubmitting ? '...' : (isRTL ? 'تأكيد الحجز' : 'Confirm Booking')}
                             </button>
                          </div>
                       </form>
                    </div>
                 </div>
              </div>
           </div>
         )}
      </div>
    </main>
  );
}
