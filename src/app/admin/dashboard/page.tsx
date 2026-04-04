"use client";

import { useEffect, useState, useCallback } from 'react';
import { getBookings, getSystemUnits } from '@/lib/data-init';

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    approvedBookings: 0,
    checkInTomorrow: 0,
    checkOutTomorrow: 0,
  });

  const [tomorrowPlans, setTomorrowPlans] = useState<{in: any[], out: any[]}>({ in: [], out: [] });
  const [todaySchedule, setTodaySchedule] = useState<{in: any[], out: any[]}>({ in: [], out: [] });
  const [apartmentMap, setApartmentMap] = useState<any[]>([]);

  const loadOverviewData = useCallback(async () => {
    const bookings = await getBookings();
    const apts = await getSystemUnits();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const approved = bookings.filter((b: any) => b.status === 'مؤكد' || b.status === 'approved');

    setTomorrowPlans({
      in: approved.filter((b: any) => b.checkIn === tomorrowStr),
      out: approved.filter((b: any) => b.checkOut === tomorrowStr),
    });

    setStats({
      totalBookings: bookings.length,
      pendingBookings: bookings.filter((b: any) => ['جديد', 'قيد المراجعة', 'pending', 'رد جديد'].includes(b.status)).length,
      approvedBookings: approved.length,
      checkInTomorrow: approved.filter((b: any) => b.checkIn === tomorrowStr).length,
      checkOutTomorrow: approved.filter((b: any) => b.checkOut === tomorrowStr).length,
    });

    setTodaySchedule({
      in: approved.filter((b: any) => b.checkIn === todayStr),
      out: approved.filter((b: any) => b.checkOut === todayStr),
    });

    // Map units to their current status (live check)
    const map = apts.map((apt: any) => {
      const activeBooking = approved.find((b: any) => {
         const bIn = new Date(b.checkIn);
         const bOut = new Date(b.checkOut);
         return b.unitId === apt.id && today >= bIn && today < bOut;
      });
      return { ...apt, isOccupied: !!activeBooking || apt.status === 'مشغول', guest: activeBooking?.name };
    });
    setApartmentMap(map);
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);


  const kpis = [
    { label: 'إجمالي الطلبات', value: stats.totalBookings, icon: '📊', color: 'text-white' },
    { label: 'قيد المراجعة', value: stats.pendingBookings, icon: '⏳', color: 'text-warning' },
    { label: 'مؤكدة', value: stats.approvedBookings, icon: '💎', color: 'text-success' },
    { label: 'وصول (غداً)', value: stats.checkInTomorrow, icon: '🔑', color: 'text-gold' },
    { label: 'مغادرة (غداً)', value: stats.checkOutTomorrow, icon: '🚪', color: 'text-blue-400' },
  ];

  return (
    <div className="space-y-12 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">مركز <span className="text-gold">العمليات</span></h1>
          <p className="text-gray-400 font-medium">متابعة دقيقة وشاملة لـ 10 وحدات فندقية فاخرة.</p>
        </div>
        <div className="flex gap-3">
           <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
             {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
           </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="glass-card hover:border-gold/30 transition-all group overflow-hidden relative">
            <div className="absolute -bottom-4 -right-4 text-5xl opacity-[0.03] group-hover:opacity-10 transition-opacity rotate-12">{kpi.icon}</div>
            <div className={`text-3xl font-black mb-3 ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Apartment Status Map - Live View */}
        <div className="lg:col-span-2 glass-card border-gold/10">
          <div className="flex justify-between items-center mb-8">
             <h3 className="font-black text-lg">🗺️ خريطة الوحدات (Live)</h3>
             <div className="flex gap-3">
               <div className="flex items-center gap-1.5 text-[8px] font-bold text-success uppercase"><span className="w-1.5 h-1.5 rounded-full bg-success" /> متاح</div>
               <div className="flex items-center gap-1.5 text-[8px] font-bold text-danger uppercase"><span className="w-1.5 h-1.5 rounded-full bg-danger" /> مشغول</div>
               <div className="flex items-center gap-1.5 text-[8px] font-bold text-gray uppercase"><span className="w-1.5 h-1.5 rounded-full bg-gray" /> صيانة</div>
             </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {apartmentMap.map((apt) => (
              <div key={apt.id} className={`p-4 rounded-2xl border transition-all ${
                apt.status === 'maintenance' ? 'bg-gray/5 border-white/5 opacity-50' : 
                apt.isOccupied ? 'bg-danger/5 border-danger/20' : 'bg-success/5 border-success/20'
              }`}>
                <div className="text-[10px] font-black text-gray-400 uppercase mb-2">وحدة {apt.id}</div>
                <div className={`text-xs font-black mb-3 ${apt.status === 'صيانة' ? 'text-gray' : apt.isOccupied ? 'text-danger' : 'text-success'}`}>
                  {apt.status === 'صيانة' ? 'صيانة' : apt.isOccupied ? 'مشغول' : 'متاح'}
                </div>
                {apt.isOccupied && <div className="text-[8px] text-white/40 truncate font-bold">الضيف: {apt.guest}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Arriving Tomorrow (New Explicit Requirement) */}
        <div className="glass-card bg-gold/5 border-gold/20 flex flex-col">
          <h3 className="font-black text-lg mb-6 flex items-center justify-between">
            <span>📅 غداً - القادمون</span>
            <span className="w-6 h-6 rounded-full bg-gold text-navy text-[10px] flex items-center justify-center">{tomorrowPlans.in.length}</span>
          </h3>
          <div className="space-y-4 flex-1">
            {tomorrowPlans.in.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 mt-10">
                 <span className="text-4xl mb-2">🛌</span>
                 <p className="text-[10px] font-bold">لا يوجد وصول مجدول لغدٍ.</p>
              </div>
            ) : (
              tomorrowPlans.in.map((b, i) => (
                <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between group">
                   <div>
                     <div className="text-xs font-black text-white">{b.name}</div>
                     <div className="text-[9px] text-gold mt-1">وحدة رقم {b.unitId}</div>
                   </div>
                   <div className="text-[10px] font-bold text-gray-500 group-hover:text-gold transition-colors">تجهيز المفتاح 🔑</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Today's Schedule - Final Match */}
        <div className="glass-card border-white/5">
          <h3 className="font-black text-lg mb-8">⌚ جدول اليوم ({new Date().toLocaleDateString('ar-EG')})</h3>
          <div className="grid md:grid-cols-2 gap-6">
             <div className="space-y-4">
               <h4 className="text-[10px] font-black text-success uppercase tracking-widest pl-2 border-r-2 border-success">وصول (In)</h4>
               {todaySchedule.in.map((b, i) => (
                 <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center text-xs font-black">{b.unitId || '?'}</div>
                    <div className="text-xs font-bold">{b.name}</div>
                 </div>
               ))}
               {todaySchedule.in.length === 0 && <p className="text-[9px] text-gray italic opacity-50">لا عمليات وصول.</p>}
             </div>
             <div className="space-y-4">
               <h4 className="text-[10px] font-black text-danger uppercase tracking-widest pl-2 border-r-2 border-danger">مغادرة (Out)</h4>
               {todaySchedule.out.map((b, i) => (
                 <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center text-xs font-black">{b.unitId || '?'}</div>
                    <div className="text-xs font-bold">{b.name}</div>
                 </div>
               ))}
               {todaySchedule.out.length === 0 && <p className="text-[9px] text-gray italic opacity-50">لا عمليات مغادرة.</p>}
             </div>
          </div>
        </div>

        {/* Sent Messages Feed (High Visibility) */}
        <div className="glass-card border-white/5 overflow-hidden flex flex-col">
           <h3 className="font-black text-lg mb-6 flex items-center gap-2">
             <span className="text-gold">📩</span> آخر المراسلات المرسلة
           </h3>
            <div className="space-y-4 flex-1">
              <MessagesFeed />
           </div>
        </div>
      </div>
    </div>
  );
}

function MessagesFeed() {
  const [messages, setMessages] = useState<any[]>([]);
  useEffect(() => {
    getBookings().then(bookings => {
      setMessages(bookings.filter((b: any) => b.paymentInfo).slice(0, 4));
    });
  }, []);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-gray opacity-30 italic py-10">
         لم يتم إرسال أي تعليمات دفع متقدمة حتى الآن.
      </div>
    );
  }

  return (
    <>
      {messages.map((m: any, i: number) => (
        <div key={i} className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-all">
          <div className="flex justify-between items-center mb-2">
             <span className="text-xs font-black text-white">{m.name}</span>
             <span className="text-[9px] text-gray-500 font-bold">{new Date(m.id).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</span>
          </div>
          <p className="text-[10px] text-gray-400 line-clamp-2 italic leading-relaxed font-medium">"{m.paymentInfo}"</p>
        </div>
      ))}
    </>
  );
}
