"use client";

import { useEffect, useState } from 'react';

export default function ReportsPage() {
  const [data, setData] = useState<any>({
    totalRevenue: 0,
    approvedCount: 0,
    averageRevenue: 0,
    monthlyBreakdown: [],
  });

  const PRICE_PER_NIGHT = 1200; // Standard price for now

  useEffect(() => {
    const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
    const approved = bookings.filter((b: any) => b.status === 'approved');
    
    let revenue = 0;
    const months: { [key: string]: number } = {};

    approved.forEach((b: any) => {
      const start = new Date(b.checkIn);
      const end = new Date(b.checkOut);
      const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const bookingRevenue = nights * PRICE_PER_NIGHT;
      revenue += bookingRevenue;

      const month = b.checkIn.substring(0, 7); // YYYY-MM
      if (!months[month]) months[month] = 0;
      months[month] += bookingRevenue;
    });

    setData({
      totalRevenue: revenue,
      approvedCount: approved.length,
      averageRevenue: approved.length > 0 ? revenue / approved.length : 0,
      monthlyBreakdown: Object.entries(months).map(([name, val]) => ({ name, val })),
    });
  }, []);

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-black mb-2">التقارير <span className="text-gold">المالية</span></h1>
        <p className="text-gray text-sm">تحليل أداء الحجوزات والتدفق النقدي للمجمع.</p>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="glass-card">
          <div className="text-gray text-xs font-bold mb-2 tracking-widest uppercase">إجمالي الإيرادات</div>
          <div className="text-4xl font-black text-gradient">
            {data.totalRevenue.toLocaleString()} <small className="text-sm font-normal text-gray">ج.م</small>
          </div>
        </div>
        <div className="glass-card">
          <div className="text-gray text-xs font-bold mb-2 tracking-widest uppercase">حجوزات مؤكدة</div>
          <div className="text-4xl font-black text-success">{data.approvedCount}</div>
        </div>
        <div className="glass-card">
          <div className="text-gray text-xs font-bold mb-2 tracking-widest uppercase">متوسط قيمة الحجز</div>
          <div className="text-4xl font-black text-gold">{Math.round(data.averageRevenue).toLocaleString()}</div>
        </div>
      </div>

      <div className="glass-card">
        <h3 className="font-bold mb-8">الأداء الشهري</h3>
        {data.monthlyBreakdown.length === 0 ? (
          <div className="py-20 text-center text-gray italic">لا توجد بيانات كافية لعرض التقرير الشهري.</div>
        ) : (
          <div className="space-y-6">
            {data.monthlyBreakdown.map((item: any, i: number) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>{item.name}</span>
                  <span className="text-gold">{item.val.toLocaleString()} ج.م</span>
                </div>
                <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-l from-gold to-gold-dark" 
                    style={{ width: `${(item.val / data.totalRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="glass-card border-white/5">
          <h4 className="font-bold mb-4 text-sm">توزيع الإيرادات</h4>
          <p className="text-gray text-xs leading-loose">
            يتم احتساب الإيرادات بناءً على سعر افتراضي (1200 ج.م لليلة) مضروباً في عدد الليالي لكل حجز "مقبول". 
            لا يتم احتساب الحجوزات المعلقة أو المرفوضة في هذا التقرير.
          </p>
        </div>
        <div className="glass-card border-white/5">
          <h4 className="font-bold mb-4 text-sm">توقعات الشهر القادم</h4>
          <p className="text-gray text-xs leading-loose">
            بناءً على طلبات الحجز المعلقة، هناك إيرادات محتملة بقيمة تقدر بـ 15,000 ج.م في حال تم قبول جميع الطلبات الحالية.
          </p>
        </div>
      </div>
    </div>
  );
}
