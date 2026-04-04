"use client";

import { useEffect, useState, useCallback } from 'react';
import { getSystemUnits, updateBookingStatus, getBookings } from '@/lib/data-init';

export default function BookingsManagement() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [availableAptsForBooking, setAvailableAptsForBooking] = useState<any[]>([]);
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBookings = useCallback(async () => {
    setIsLoading(true);
    const data = await getBookings();
    setBookings(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  // Find free units when a booking is selected for approval
  useEffect(() => {
    const findFreeUnits = async () => {
        if (selectedBooking) {
            const units = await getSystemUnits();
            const allBookings = await getBookings();
            const approved = allBookings.filter((b: any) => b.status === 'approved' && b.id !== selectedBooking.id);
            
            const checkInDate = new Date(selectedBooking.checkIn);
            const checkOutDate = new Date(selectedBooking.checkOut);
    
            const bookedIds = new Set(approved.filter((b: any) => {
                const bIn = new Date(b.checkIn);
                const bOut = new Date(b.checkOut);
                return bIn < checkOutDate && bOut > checkInDate;
            }).map((b: any) => b.apartmentId));
    
            const free = units.filter((a: any) => a.status === 'متاح' && !bookedIds.has(a.id));
            setAvailableAptsForBooking(free);
            setSelectedAptId(selectedBooking.apartmentId || (free.length > 0 ? free[0].id : null));
        }
    };
    findFreeUnits();
  }, [selectedBooking]);

  const approveBooking = async () => {
    if (!selectedBooking || !selectedAptId) return;
    
    setIsLoading(true);
    await updateBookingStatus(selectedBooking.id, { 
        status: 'approved', 
        apartmentId: selectedAptId, 
        paymentInfo 
    });
    
    // Notifications are still local preference for the admin session or could be moved to DB
    const notifs = JSON.parse(localStorage.getItem('admin_notifs') || '[]');
    notifs.unshift({ 
      id: Date.now(), 
      msg: `✅ تم قبول حجز ${selectedBooking.name} (وحدة ${selectedAptId}) وإرسال بيانات الدفع.`, 
      read: false 
    });
    localStorage.setItem('admin_notifs', JSON.stringify(notifs.slice(0,50)));
    
    setShowApproveModal(false);
    setSelectedBooking(null);
    setPaymentInfo('');
    await refreshBookings();
  };

  const updateStatus = async (id: string, status: string) => {
    setIsLoading(true);
    await updateBookingStatus(id, { status });
    await refreshBookings();
  };

  const openWhatsAppChat = (booking: any) => {
    const phone = booking.phone.replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('2') ? phone : `2${phone}`;
    const msg = `مرحباً أ/ *${booking.name}*،\nبخصوص طلب الحجز الخاص بكم بمجمع مزار للوحدة (*${booking.studio}*) من فترة *${booking.checkIn}* إلى *${booking.checkOut}*.\n\n_نود إبلاغكم بـ..._`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {isLoading && (
         <div className="absolute top-0 right-0 p-4 animate-pulse">
            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">جاري التحديث...</span>
         </div>
      )}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black mb-2 text-white">إدارة <span className="text-gold">الطلبات</span></h1>
          <p className="text-gray-400 text-sm">مراجعة والرد على طلبات الحجز والتواصل المباشر مع العملاء.</p>
        </div>
      </header>

      <div className="glass-card !p-0 overflow-hidden border-white/5 shadow-2xl transition-all">
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead>
              <tr className="bg-white/5 text-gray-500 text-[9px] uppercase tracking-[0.2em] font-black">
                <th className="px-8 py-5">العميل والاتصال</th>
                <th className="px-8 py-5">التواريخ</th>
                <th className="px-8 py-5">الوحدة المطلوبة</th>
                <th className="px-8 py-5">الحالة</th>
                <th className="px-8 py-5 text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center text-gray-500 italic font-medium">
                    {isLoading ? 'جاري تحميل البيانات...' : 'لا توجد طلبات حجز حالياً في النظام.'}
                  </td>
                </tr>
              ) : (
                bookings.map((booking: any) => (
                  <tr key={booking.id} className="border-t border-white/5 hover:bg-white/[0.03] transition-all group">
                    <td className="px-8 py-6">
                      <div className="font-black text-white text-sm mb-1">{booking.name}</div>
                      <div className="flex items-center gap-2">
                        <button 
                            onClick={() => openWhatsAppChat(booking)}
                            className="flex items-center gap-1.5 text-[10px] text-green-500 font-black bg-green-500/5 px-2 py-1 rounded-lg border border-green-500/20 hover:bg-green-500 hover:text-white transition-all"
                        >
                            <span className="text-xs">💬</span> {booking.phone}
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold">
                      <div className="text-white mb-1"><span className="text-gray-500 text-[10px] ml-2">من:</span> {booking.checkIn}</div>
                      <div className="text-white"><span className="text-gray-500 text-[10px] ml-2">إلى:</span> {booking.checkOut}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="bg-gold/10 text-gold px-3 py-1.5 rounded-xl text-[10px] font-black inline-block border border-gold/20">
                        {booking.studio || '—'}
                      </div>
                      {booking.apartmentId && <p className="text-[9px] text-gray-500 mt-1 font-bold">رقم الأي دي: {booking.apartmentId}</p>}
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-2 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm ${
                        booking.status === 'approved' ? 'bg-success/20 text-success border border-success/30' : 
                        booking.status === 'rejected' ? 'bg-danger/20 text-danger border border-danger/30' : 
                        'bg-warning/20 text-warning border border-warning/30 animate-pulse'
                      }`}>
                        {booking.status === 'approved' ? 'تم القبول' : 
                         booking.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                         {booking.status === 'رد جديد' ? (
                            <>
                              <button 
                                onClick={() => { setSelectedBooking(booking); setShowApproveModal(true); }}
                                className="px-4 py-2 rounded-xl bg-success/20 text-success flex items-center gap-2 hover:bg-success hover:text-navy transition-all font-black text-[10px]"
                                title="قبول الطلب"
                              >
                                <span>✓</span> قبول
                              </button>
                              <button 
                                onClick={() => { if(confirm('متأكد من رفض الطلب؟')) updateStatus(booking.id, 'rejected'); }}
                                className="px-4 py-2 rounded-xl bg-danger/20 text-danger flex items-center gap-2 hover:bg-danger hover:text-white transition-all font-black text-[10px]"
                                title="رفض الطلب"
                              >
                                <span>✕</span> رفض
                              </button>
                            </>
                         ) : (
                            <button 
                                onClick={async () => { if(confirm('حذف السجل نهائياً؟')) {
                                    // This requires a special action for deletion or we just filter locally if allowed
                                    await updateBookingStatus(booking.id, { status: 'deleted' });
                                    await refreshBookings();
                                }}}
                                className="text-gray-600 hover:text-danger transition-colors font-bold text-[10px]"
                            >
                                حذف السجل
                            </button>
                         )}
                      </div>
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
        <div className="fixed inset-0 bg-[#060b18]/95 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-[#0a0f1e] border border-gold/30 max-w-2xl w-full p-12 rounded-[40px] space-y-8 shadow-[0_0_80px_rgba(201,168,76,0.15)] animate-scale-in text-right" dir="rtl">
            <header className="space-y-2">
              <div className="text-[10px] font-black text-gold uppercase tracking-[0.3em] mb-2">Confirm Booking</div>
              <h3 className="text-3xl font-black text-white">قبول حجز أ/ <span className="text-gold">{selectedBooking.name}</span></h3>
              <p className="text-gray-400 text-xs font-bold leading-relaxed">سيتم إرسال بيانات الدفع والتسكين للعميل عبر لوحة التحكم.</p>
            </header>

            <div className="space-y-8">
              <div className="grid md:grid-cols-1 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">التسكين الفعلي في وحدة:</label>
                  <select 
                    title="اختر الوحدة"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-gold transition-all cursor-pointer"
                    value={selectedAptId || ''}
                    onChange={e => setSelectedAptId(e.target.value)}
                  >
                    {availableAptsForBooking.map(apt => (
                      <option key={apt.id} value={apt.id} className="bg-[#0a0f1e]">وحدة: {apt.id} ({apt.title.ar})</option>
                    ))}
                    {availableAptsForBooking.length === 0 && (
                      <option value="" className="bg-[#0a0f1e]">لا توجد وحدات متاحة في هذه التוاريخ!</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">بيانات تفاصيل الحجز (ستظهر للعميل)</label>
                <div className="flex gap-2">
                   <button onClick={() => setPaymentInfo(`يرجى تحويل مبلغ العربون (500 ج.م) عبر إنستا باي (Instapay) برقم: 01153705134 لتأكيد الحجز.`)} className="text-[9px] bg-gold/10 text-gold px-4 py-2 rounded-full border border-gold/20 hover:bg-gold hover:text-navy transition-all font-black">إنستا باي +</button>
                   <button onClick={() => setPaymentInfo(`يرجى تحويل العربون (500 ج.م) فودافون كاش على رقم: 01153705134 لتأكيد حجزكم.`)} className="text-[9px] bg-danger/10 text-danger px-4 py-2 rounded-full border border-danger/20 hover:bg-danger hover:text-white transition-all font-black">فودافون كاش +</button>
                </div>
                <textarea 
                  placeholder="اكتب تفاصيل الدفع أو أي ملاحظات للعميل هنا..."
                  className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-sm text-white min-h-[150px] outline-none focus:border-gold transition-all resize-none leading-relaxed"
                  value={paymentInfo}
                  onChange={e => setPaymentInfo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={approveBooking}
                disabled={!paymentInfo || !selectedAptId}
                className="flex-[2] py-5 bg-gold text-navy font-black rounded-2xl hover:bg-gold-light hover:scale-[1.02] transition-all disabled:opacity-20 shadow-2xl shadow-gold/20 text-lg"
              >
                تأكيد القبول والتسكين ✅
              </button>
              <button 
                onClick={() => { setShowApproveModal(false); setSelectedBooking(null); }}
                className="flex-1 py-5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/5 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Hint */}
      <div className="glass-card bg-gold/5 border-gold/20 p-8 flex gap-6 items-center rounded-[32px]">
        <span className="text-4xl">🗨️</span>
        <div className="text-xs leading-relaxed text-gray-400 font-bold">
          <strong className="block mb-2 text-gold text-sm tracking-widest uppercase">نظام التواصل الذكي:</strong>
          عند الضغط على رقم هاتف العميل، سيتم فتح محادثة <span className="text-green-500 font-black">WhatsApp</span> مباشرة مع رسالة مجهزة بتفاصيل الحجز لتسهيل التواصل والرد السريع.
        </div>
      </div>
    </div>
  );
}
