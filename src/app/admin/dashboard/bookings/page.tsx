"use client";

import { useEffect, useState } from 'react';

export default function BookingsManagement() {
  const [bookings, setBookings] = useState<any[]>([]);

  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [availableAptsForBooking, setAvailableAptsForBooking] = useState<any[]>([]);
  const [selectedAptId, setSelectedAptId] = useState<number | null>(null);
  const [paymentInfo, setPaymentInfo] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('bookings') || '[]');
    setBookings(data.sort((a: any, b: any) => b.id - a.id));
  }, []);

  // Find free apartments when a booking is selected for approval
  useEffect(() => {
    if (selectedBooking) {
      const apts = JSON.parse(localStorage.getItem('apartments') || '[]');
      const allBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
      const approved = allBookings.filter((b: any) => b.status === 'approved' && b.id !== selectedBooking.id);
      
      const checkInDate = new Date(selectedBooking.checkIn);
      const checkOutDate = new Date(selectedBooking.checkOut);

      const bookedIds = new Set(approved.filter((b: any) => {
        const bIn = new Date(b.checkIn);
        const bOut = new Date(b.checkOut);
        return bIn < checkOutDate && bOut > checkInDate;
      }).map((b: any) => b.apartmentId));

      const free = apts.filter((a: any) => a.status === 'available' && !bookedIds.has(a.id));
      setAvailableAptsForBooking(free);
      setSelectedAptId(selectedBooking.apartmentId || (free.length > 0 ? free[0].id : null));
    }
  }, [selectedBooking]);

  const approveBooking = () => {
    if (!selectedBooking || !selectedAptId) return;
    
    const updated = bookings.map((b: any) => 
      b.id === selectedBooking.id ? { ...b, status: 'approved', apartmentId: selectedAptId, paymentInfo } : b
    );
    setBookings(updated);
    localStorage.setItem('bookings', JSON.stringify(updated));
    
    // Create notification for admin logic
    const notifs = JSON.parse(localStorage.getItem('admin_notifs') || '[]');
    notifs.unshift({ 
      id: Date.now(), 
      msg: `✅ تم قبول حجز ${selectedBooking.name} (شقة ${selectedAptId}) وإرسال بيانات الدفع.`, 
      read: false 
    });
    localStorage.setItem('admin_notifs', JSON.stringify(notifs.slice(0,50)));
    
    setShowApproveModal(false);
    setSelectedBooking(null);
    setPaymentInfo('');
  };

  const updateStatus = (id: number, status: string) => {
    const updated = bookings.map((b: any) => 
      b.id === id ? { ...b, status } : b
    );
    setBookings(updated);
    localStorage.setItem('bookings', JSON.stringify(updated));
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black mb-2">إدارة <span className="text-gold">الطلبات</span></h1>
          <p className="text-gray text-sm">مراجعة والرد على طلبات الحجز المقدمة من العملاء.</p>
        </div>
      </header>

      <div className="glass-card !p-0 overflow-hidden border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-widest">
                <th className="px-6 py-4 font-bold">العميل</th>
                <th className="px-6 py-4 font-bold">التواريخ</th>
                <th className="px-6 py-4 font-bold">الشقة</th>
                <th className="px-6 py-4 font-bold">الحالة</th>
                <th className="px-6 py-4 font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray italic">لا توجد طلبات حجز حالياً.</td>
                </tr>
              ) : (
                bookings.map((booking: any) => (
                  <tr key={booking.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold">{booking.name}</div>
                      <div className="text-[10px] text-gray mt-1">{booking.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs">من: {booking.checkIn}</div>
                      <div className="text-xs text-gray">إلى: {booking.checkOut}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gold/10 text-gold px-2 py-1 rounded text-[10px] font-bold">شقة {booking.apartmentId || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        booking.status === 'approved' ? 'bg-success/20 text-success' : 
                        booking.status === 'rejected' ? 'bg-danger/20 text-danger' : 
                        'bg-warning/20 text-warning'
                      }`}>
                        {booking.status === 'approved' ? 'تم القبول' : 
                         booking.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {booking.status === 'pending' && (
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowApproveModal(true);
                            }}
                            className="w-8 h-8 rounded-lg bg-success/20 text-success flex items-center justify-center hover:bg-success hover:text-navy transition-all"
                            title="قبول"
                          >
                            ✓
                          </button>
                          <button 
                            type="button"
                            onClick={() => updateStatus(booking.id, 'rejected')}
                            className="w-8 h-8 rounded-lg bg-danger/20 text-danger flex items-center justify-center hover:bg-danger hover:text-white transition-all"
                            title="رفض"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {booking.status !== 'pending' && (
                        <button 
                          type="button"
                          onClick={() => {
                            if(confirm('هل أنت متأكد من حذف هذا السجل؟')) {
                              const filtered = bookings.filter((b: any) => b.id !== booking.id);
                              setBookings(filtered);
                              localStorage.setItem('bookings', JSON.stringify(filtered));
                            }
                          }}
                          className="text-gray/30 hover:text-danger transition-colors text-xs"
                        >
                          حذف السجل
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      {showApproveModal && selectedBooking && (
        <div className="fixed inset-0 bg-navy/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="glass-card max-w-xl w-full p-10 space-y-8 border-gold/40 shadow-[0_0_50px_rgba(201,168,76,0.15)] animate-scale-in">
            <header className="space-y-2">
              <h3 className="text-2xl font-black">تأكيد الحجز: <span className="text-gold">{selectedBooking.name}</span></h3>
              <p className="text-gray text-xs">سيتم إرسال بيانات الدفع للعميل فور الضغط على تأكيد.</p>
            </header>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">تسكين في شقة رقم</label>
                  <select 
                    title="اختر رقم الشقة"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    value={selectedAptId || ''}
                    onChange={e => setSelectedAptId(Number(e.target.value))}
                  >
                    {availableAptsForBooking.map(apt => (
                      <option key={apt.id} value={apt.id}>شقة رقم {apt.id}</option>
                    ))}
                    {availableAptsForBooking.length === 0 && (
                      <option value="">لا توجد شقق متاحة!</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">بيانات تحويل العربون</label>
                <div className="flex gap-2 mb-4">
                   <button 
                     onClick={() => setPaymentInfo(`يرجى تحويل عربون 500 ج.م عبر Instapay على الحساب: example@instapay`)}
                     className="text-[10px] bg-gold/10 text-gold px-3 py-1 rounded-full border border-gold/20 hover:bg-gold hover:text-navy transition-all"
                   >
                     + Instapay
                   </button>
                   <button 
                     onClick={() => setPaymentInfo(`يرجى تحويل عربون 500 ج.م على رقم فودافون كاش: 010xxxxxxxx`)}
                     className="text-[10px] bg-danger/10 text-danger px-3 py-1 rounded-full border border-danger/20 hover:bg-danger hover:text-white transition-all"
                   >
                     + Vodafone Cash
                   </button>
                </div>
                <textarea 
                  placeholder="اكتب نص الرسالة التي ستصل للعميل هنا..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm min-h-[120px] outline-none focus:border-gold transition-all"
                  value={paymentInfo}
                  onChange={e => setPaymentInfo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={approveBooking}
                disabled={!paymentInfo}
                className="flex-[2] py-4 bg-gold text-navy font-black rounded-2xl hover:bg-gold-light transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gold/20"
              >
                تأكيد الحجز وإرسال البيانات ✅
              </button>
              <button 
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedBooking(null);
                  setPaymentInfo('');
                }}
                className="flex-1 py-4 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Message Hint */}
      <div className="glass-card bg-info/5 border-info/20 p-6 flex gap-4 items-start">
        <span className="text-2xl">💡</span>
        <div className="text-xs leading-relaxed text-gray-300">
          <strong className="block mb-2 text-info">نصيحة للإدارة:</strong>
          عند الموافقة على الحجز، سيتم التواصل مع العميل تلقائياً (محاكاة). يمكنك في النسخة الكاملة ربط هذا النظام بـ WhatsApp أو Email لإرسال رقم Instapay أو Vodafone Cash للعميل لتحويل العربون.
        </div>
      </div>
    </div>
  );
}
