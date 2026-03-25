"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Helper for availability (Mocking the logic for now)
const TOTAL_APARTMENTS = 10;

export default function BookingPage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    nationalId: '',
    checkIn: '',
    checkOut: '',
    guests: '1',
  });

  const [availableCount, setAvailableCount] = useState(TOTAL_APARTMENTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Calculate real availability
  useEffect(() => {
    const apts = JSON.parse(localStorage.getItem('apartments') || '[]');
    const availableApts = apts.filter((a: any) => a.status === 'available');
    
    if (formData.checkIn && formData.checkOut) {
      const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
      const approved = bookings.filter((b: any) => b.status === 'approved');
      
      const checkInDate = new Date(formData.checkIn);
      const checkOutDate = new Date(formData.checkOut);

      // Simple collision check
      const bookedIds = new Set();
      approved.forEach((b: any) => {
        const bIn = new Date(b.checkIn);
        const bOut = new Date(b.checkOut);
        if (bIn < checkOutDate && bOut > checkInDate) {
          bookedIds.add(b.apartmentId);
        }
      });

      const trulyAvailable = availableApts.filter((a: any) => !bookedIds.has(a.id));
      setAvailableCount(trulyAvailable.length);
    } else {
      setAvailableCount(availableApts.length);
    }
  }, [formData.checkIn, formData.checkOut]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (availableCount === 0) {
      alert('عذراً، لا توجد شقق متاحة لهذه التواريخ.');
      return;
    }
    setIsSubmitting(true);
    
    setTimeout(() => {
      const apts = JSON.parse(localStorage.getItem('apartments') || '[]');
      const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
      const approved = bookings.filter((b: any) => b.status === 'approved');
      
      const checkInDate = new Date(formData.checkIn);
      const checkOutDate = new Date(formData.checkOut);
      const bookedIds = new Set(approved.filter((b: any) => {
        const bIn = new Date(b.checkIn);
        const bOut = new Date(b.checkOut);
        return bIn < checkOutDate && bOut > checkInDate;
      }).map((b: any) => b.apartmentId));

      const firstFreeApt = apts.find((a: any) => a.status === 'available' && !bookedIds.has(a.id));

      const newBooking = {
        ...formData,
        id: Date.now(),
        apartmentId: firstFreeApt?.id || null,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      bookings.push(newBooking);
      localStorage.setItem('bookings', JSON.stringify(bookings));
      
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1500);
  };

  if (isSuccess) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card max-w-lg text-center p-12">
          <div className="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="text-3xl font-black mb-4">تم إرسال طلبك بنجاح!</h2>
          <p className="text-gray mb-8">
            شكراً لثقتك بنا. سيقوم فريقنا بمراجعة طلبك والتواصل معك عبر الهاتف للتأكيد في أقرب وقت ممكن.
          </p>
          <Link href="/" className="btn-gold block w-full">
            العودة للرئيسية
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-32 pb-20 px-6">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-gold/20 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black text-gradient">مجمع النخبة</Link>
        <Link href="/" className="text-sm font-bold hover:text-gold transition-colors">العودة للرئيسية</Link>
      </nav>

      <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12">
        {/* Left Side: Info & Availability */}
        <div className="lg:col-span-2 space-y-10">
          <div className="space-y-4 animate-fade-in">
            <h1 className="text-5xl font-black leading-tight text-white">احجز <br/><span className="text-gradient">إقامتك الفاخرة</span></h1>
            <p className="text-gray-400 font-medium italic">المكان الذي تلتقي فيه الرفاهية بالراحة.</p>
          </div>

          <div className="glass-card p-8 text-center border-gold/30 bg-gold/5 space-y-6 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gold/10 rounded-full blur-3xl group-hover:bg-gold/20 transition-all" />
            <div className="text-6xl font-black text-gold mb-2 tabular-nums">{availableCount}</div>
            <div className="text-sm font-black text-gray-300 uppercase tracking-widest">شقق متاحة للاستلام</div>
            <div className="w-full bg-white/10 h-3 rounded-full mt-6 overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-gold to-gold-light transition-all duration-1000 shadow-[0_0_15px_rgba(201,168,76,0.5)]" 
                style={{ width: `${(availableCount / TOTAL_APARTMENTS) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-gray uppercase tracking-tighter">تحديث تلقائي لحالة الـ 10 وحدات فور التأكيد اليدوي</p>
          </div>

          <div className="glass-card space-y-6 animate-slide-up delay-100">
            <h3 className="font-black text-lg flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs">★</span>
              إطلالة على مجمع النخبة
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-video rounded-2xl overflow-hidden bg-white/5 border border-white/5 group">
                  <img 
                    src={`https://images.unsplash.com/photo-${1522708323590 + i}-d24dbb6b0267?auto=format&fit=crop&q=80&w=400`} 
                    alt="Property Preview" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                </div>
              ))}
            </div>
            <button className="w-full py-4 text-sm font-black text-gold border border-gold/20 rounded-2xl hover:bg-gold hover:text-navy transition-all flex items-center justify-center gap-3 group">
              جولة فيديو شاملة <span className="text-lg group-hover:translate-x-1 transition-transform">📽️</span>
            </button>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="glass-card p-8 md:p-10 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="full-name" className="text-sm font-bold text-gray-400">الاسم بالكامل</label>
                <input 
                  id="full-name"
                  required
                  type="text" 
                  placeholder="محمد أحمد..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold transition-colors"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-bold text-gray-400">رقم الهاتف</label>
                <input 
                  id="phone"
                  required
                  type="tel" 
                  placeholder="010xxxxxxx"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold transition-colors"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="check-in" className="text-sm font-bold text-gray-400">تاريخ الوصول</label>
                <input 
                  id="check-in"
                  required
                  type="date" 
                  title="تاريخ الوصول"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold transition-colors [color-scheme:dark]"
                  value={formData.checkIn}
                  onChange={e => setFormData({...formData, checkIn: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="check-out" className="text-sm font-bold text-gray-400">تاريخ المغادرة</label>
                <input 
                  id="check-out"
                  required
                  type="date" 
                  title="تاريخ المغادرة"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold transition-colors [color-scheme:dark]"
                  value={formData.checkOut}
                  onChange={e => setFormData({...formData, checkOut: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="guests" className="text-sm font-bold text-gray-400">عدد الأفراد</label>
              <select 
                id="guests"
                title="عدد الأفراد"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold transition-colors appearance-none"
                value={formData.guests}
                onChange={e => setFormData({...formData, guests: e.target.value})}
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} فرد</option>
                ))}
              </select>
            </div>

            <div className="pt-4 border-t border-white/10">
              <div className="flex justify-between items-center mb-6">
                <div className="text-sm text-gray">سعر الليلة التقديري</div>
                <div className="text-2xl font-black text-gold">
                  {typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('apartments') || '[]').filter((a: any) => a.status === 'available')[0]?.price || '1,200') : '1,200'} ج.م
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full btn-gold !py-4 flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <span className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>أرسل طلب الحجز 📧</>
                )}
              </button>
              <p className="text-center text-[10px] text-gray mt-4 leading-relaxed">
                بالضغط على طلب حجز، أنت توافق على شروط وقوانين المكان التي تم توضيحها مسبقاً.
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
