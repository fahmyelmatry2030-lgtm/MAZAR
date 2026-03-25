"use client";

import { useEffect, useState } from 'react';

export default function ApartmentsManagement() {
  const [apartments, setApartments] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('apartments');
    if (saved) {
      setApartments(JSON.parse(saved));
    } else {
      const apartmentTypes = [
        { name: 'جناح ملكي عصري', price: 2500, img: '/apartments/apt1.png' },
        { name: 'شقة كلاسيكية فاخرة', price: 1800, img: '/apartments/apt2.png' },
        { name: 'ستوديو مينيمالست', price: 1200, img: '/apartments/apt3.png' },
        { name: 'بنتهاوس بانورامي', price: 3500, img: '/apartments/apt4.png' },
        { name: 'جناح سكاندينافي', price: 1500, img: '/apartments/apt1.png' },
        { name: 'شقة النخبة 6', price: 2000, img: '/apartments/apt2.png' },
        { name: 'شقة النخبة 7', price: 2200, img: '/apartments/apt3.png' },
        { name: 'شقة النخبة 8', price: 1900, img: '/apartments/apt4.png' },
        { name: 'شقة النخبة 9', price: 1700, img: '/apartments/apt1.png' },
        { name: 'شقة النخبة 10', price: 2100, img: '/apartments/apt2.png' },
      ];

      const initial = apartmentTypes.map((type, i) => ({
        id: i + 1,
        name: type.name,
        price: type.price,
        image: type.img,
        status: 'available',
      }));
      setApartments(initial);
      localStorage.setItem('apartments', JSON.stringify(initial));
    }
  }, []);

  const toggleStatus = (id: number) => {
    const updated = apartments.map(apt => {
      if (apt.id === id) {
        const nextStatus = apt.status === 'available' ? 'maintenance' : 'available';
        return { ...apt, status: nextStatus };
      }
      return apt;
    });
    setApartments(updated);
    localStorage.setItem('apartments', JSON.stringify(updated));
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black mb-2">إدارة <span className="text-gold">الشقق</span></h1>
        <p className="text-gray text-sm">تتبع حالة الـ 10 شقق وتحديث توافرها للصيانة أو الحجز.</p>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {apartments.map((apt) => (
          <div key={apt.id} className="glass-card !p-0 overflow-hidden flex flex-col group">
            <div className="relative aspect-video overflow-hidden">
              <img 
                src={apt.image} 
                alt={apt.name} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-3 right-3">
                <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg ${
                  apt.status === 'available' ? 'bg-success/20 text-success border border-success/30' : 'bg-warning/20 text-warning border border-warning/30'
                }`}>
                  {apt.status === 'available' ? 'متاحة' : 'صيانة'}
                </span>
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg">{apt.name}</h3>
                <div className="text-gold font-black">{apt.price} <span className="text-[10px]">ج.م</span></div>
              </div>
              
              <div className="mt-auto pt-4 flex gap-2">
                <button 
                  onClick={() => toggleStatus(apt.id)}
                  className={`flex-1 py-2.5 rounded-xl border font-bold text-[10px] transition-all outline-none ${
                    apt.status === 'available' 
                      ? 'border-warning/30 text-warning hover:bg-warning/10' 
                      : 'border-success/30 text-success hover:bg-success/10'
                  }`}
                >
                  {apt.status === 'available' ? 'تحويل للصيانة 🛠️' : 'تفعيل للجمهور ✅'}
                </button>
                <button className="p-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
                  ✏️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card bg-gold/5 border-gold/20 flex gap-4 items-center">
        <span className="text-2xl">ℹ️</span>
        <p className="text-xs text-gray-300">
          الشقق التي في وضع "الصيانة" لن تظهر للعملاء في صفحة الحجز ولن يتم احتسابها في عدد الشقق المتاحة.
        </p>
      </div>
    </div>
  );
}
