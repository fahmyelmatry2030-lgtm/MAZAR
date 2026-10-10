"use client";

import { useEffect, useState, useCallback } from 'react';
import { getSystemUnits, updateBookingStatus, getBookings, deleteBooking } from '@/lib/data-init';
import { formatWhatsAppNumber } from '@/lib/utils';
import { CheckCircle, Trash2, Smartphone } from 'lucide-react';
import ReceiptImageModal from '@/components/ReceiptImageModal';

const getReceiptUrl = (b: any) => {
  if (!b) return null;
  const text = `${b.paymentInfo || ''} ${b.notes || ''} ${b.payment_info || ''} ${b.paymentProof || ''}`;
  const match = text.match(/https:\/\/[^\s"'\)]+/);
  return match ? match[0] : null;
};


export default function BookingsManagement() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [availableAptsForBooking, setAvailableAptsForBooking] = useState<any[]>([]);
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeReceiptModal, setActiveReceiptModal] = useState<{ isOpen: boolean; url: string | null; name?: string }>({ isOpen: false, url: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Dynamic calculation states
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [numberOfDays, setNumberOfDays] = useState<number>(0);

  // New report fields
  const [nationality, setNationality] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [commission, setCommission] = useState<number>(0);
  const [brokerName, setBrokerName] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [adminRole, setAdminRole] = useState<string>('Admin');

  useEffect(() => {
    const info = sessionStorage.getItem('adminInfo');
    if (info) {
      const admin = JSON.parse(info);
      setAdminRole(admin.role);
    }
  }, []);

  const isModerator = adminRole === 'Moderator';

  const refreshBookings = useCallback(async () => {
    setIsLoading(true);
    let data = await getBookings();
    
    const currentRole = typeof window !== 'undefined'
      ? (JSON.parse(sessionStorage.getItem('adminInfo') || '{}')?.role || adminRole)
      : adminRole;
    
    if (currentRole === 'Akoura' || currentRole === 'Partner') {
      // Filter bookings to Mazar 3 units (apartmentId starts with p-s or contains branch 3 IDs)
      data = data.filter((b: any) => 
        String(b.apartmentId).startsWith('p-s') || 
        !b.apartmentId
      );
    }
    if (currentRole === 'Mohsen') {
      const units = await getSystemUnits();
      const mazar12Ids = new Set(units.filter((unit: any) => unit.branch === 1 || unit.branch === 2).map((unit: any) => unit.id));
      data = data.filter((booking: any) => mazar12Ids.has(booking.apartmentId));
    }
    
    setBookings(data);
    setIsLoading(false);
  }, [adminRole]);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  // Find free units when a booking is selected for approval
  useEffect(() => {
    const findFreeUnits = async () => {
        if (selectedBooking) {
            let units = await getSystemUnits();
            const allBookings = await getBookings();
            
            const currentRole = typeof window !== 'undefined'
              ? (JSON.parse(sessionStorage.getItem('adminInfo') || '{}')?.role || adminRole)
              : adminRole;
            
            if (currentRole === 'Akoura' || currentRole === 'Partner') {
              units = units.filter((a: any) => a.branch === 3);
            }
            if (currentRole === 'Mohsen') {
              units = units.filter((a: any) => a.branch === 1 || a.branch === 2);
            }

            const approved = allBookings.filter((b: any) => b.status === 'approved' && b.id !== selectedBooking.id);
            
            const checkInDate = new Date(selectedBooking.checkIn);
            const checkOutDate = new Date(selectedBooking.checkOut);
    
            const bookedIds = new Set(approved.filter((b: any) => {
                const bIn = new Date(b.checkIn);
                const bOut = new Date(b.checkOut);
                return bIn < checkOutDate && bOut > checkInDate;
            }).map((b: any) => b.apartmentId));
    
            const free = units.filter((a: any) => a.status === 'متاح' && !String(a.id).startsWith('s-') && !bookedIds.has(a.id));
            setAvailableAptsForBooking(free);
            setSelectedAptId(selectedBooking.apartmentId || (free.length > 0 ? free[0].id : null));
        }
    };
    findFreeUnits();
  }, [selectedBooking, adminRole]);

  // Handle Dynamic Calculations
  useEffect(() => {
    if (selectedBooking && selectedAptId && availableAptsForBooking.length > 0) {
      const checkInDate = new Date(selectedBooking.checkIn);
      const checkOutDate = new Date(selectedBooking.checkOut);
      
      const diffTime = Math.abs(checkOutDate.getTime() - checkInDate.getTime());
      let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) diffDays = 1;
      
      setNumberOfDays(diffDays);

      const apt = availableAptsForBooking.find(a => a.id === selectedAptId);
      let calculatedTotal = 0;
      if (apt && apt.price) {
        const numericPrice = parseInt(apt.price.toString().replace(/[^0-9]/g, '')) || 0;
        calculatedTotal = numericPrice * diffDays;
      }
      setTotalAmount(calculatedTotal);
      
      if (calculatedTotal > 0) {
          setPaymentInfo(`إجمالي تكلفة الإقامة لمدة (${diffDays}) ليالي هو ${calculatedTotal} ج.م.\n\nيرجى تحويل مبلغ العربون (500 ج.م) لتأكيد الحجز النهائي.`);
      } else {
          setPaymentInfo(`يرجى تحويل مبلغ العربون (500 ج.م) لتأكيد الحجز.`);
      }
    }
  }, [selectedBooking, selectedAptId, availableAptsForBooking]);

  const approveBooking = async () => {
    if (!selectedBooking || !selectedAptId) return;
    
    setIsLoading(true);
    setError(null);

    let shiftLead = 'قائد الشيفت';
    try {
      const raw = sessionStorage.getItem('adminInfo') || localStorage.getItem('adminInfo');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.name) shiftLead = parsed.name;
        else if (parsed.username) shiftLead = parsed.username;
      }
    } catch(e) {}

    try {
      await updateBookingStatus(selectedBooking.id, { 
          status: 'approved', 
          apartmentId: selectedAptId, 
          paymentInfo,
          totalAmount,
          numberOfDays,
          nationality: nationality || undefined,
          idNumber: idNumber || undefined,
          commission: commission || undefined,
          brokerName: brokerName || undefined,
          bookingManager: shiftLead,
          notes: bookingNotes || '',
      });
      
      if (typeof window !== 'undefined') {
        const notifs = JSON.parse(localStorage.getItem('admin_notifs') || '[]');
        notifs.unshift({ 
          id: Date.now(), 
          msg: `✅ تم قبول حجز ${selectedBooking.name} (وحدة ${selectedAptId}) وإرسال بيانات الدفع.`, 
          read: false 
        });
        localStorage.setItem('admin_notifs', JSON.stringify(notifs.slice(0,50)));
      }
      
      setShowApproveModal(false);
      setSelectedBooking(null);
      setPaymentInfo('');
      setNationality('');
      setIdNumber('');
      setCommission(0);
      setBrokerName('');
      setBookingNotes('');
      await refreshBookings();
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء قبول الحجز. تأكد من إعدادات قاعدة البيانات.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await updateBookingStatus(id, { status });
      await refreshBookings();
    } catch (err) {
      console.error(err);
      setError('فشل تحديث الحالة.');
    } finally {
      setIsLoading(false);
    }
  };

  const openWhatsAppChat = (booking: any) => {
    const cleanPhone = formatWhatsAppNumber(booking.phone);
    const msg = `مرحباً أ/ *${booking.name}*،\nبخصوص طلب الحجز الخاص بكم بمجمع مزار للوحدة (*${booking.studio}*) من فترة *${booking.checkIn}* إلى *${booking.checkOut}*.\n\n_نود إبلاغكم بـ..._`;
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  const isWebsiteBooking = (b: any) => {
    const noteStr = String(b.notes || '');
    const infoStr = String(b.paymentInfo || b.payment_info || '');

    return (
      b.source === 'website' ||
      b.isWebsiteBooking === true ||
      b.is_website_booking === true ||
      infoStr.includes('[طلب') ||
      noteStr.includes('[طلب') ||
      b.status === 'جديد' ||
      b.status === 'pending' ||
      b.status === 'رد جديد' ||
      b.status === 'قيد المراجعة'
    );
  };

  const filteredBookings = bookings.filter((b: any) => {
    if (b.status === 'deleted' || b.status === 'ملغى') return false;

    // Filter strictly for website bookings only
    if (!isWebsiteBooking(b)) return false;

    const st = String(b.status || '').trim();
    const isConfirmed = ['approved', 'مؤكد', 'مؤكد/دخول', 'مغادر/تنظيف', 'مغادر/تم'].some(s => st === s || st.includes('مؤكد'));
    const isPending = !isConfirmed && st !== 'ملغى' && st !== 'deleted';

    if (activeTab === 'pending') {
      return isPending;
    }
    if (activeTab === 'approved') {
      return isConfirmed;
    }
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in relative">
      {isLoading && (
         <div className="absolute top-0 right-0 p-4 animate-pulse">
            <span className="text-[10px] font-black text-[#C1A68D] uppercase tracking-[0.2em]">جاري التحديث...</span>
         </div>
      )}
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black mb-2 text-[#2A2723]">طلبات <span className="text-[#C1A68D]">الموقع الإلكتروني</span></h1>
          <p className="text-[#7A7061] font-bold opacity-70 text-sm">مراجعة ومعاينة كافة الطلبات المباشرة المرسلة من العملاء عبر الموقع الإلكتروني.</p>
        </div>

        <div className="flex gap-4">
          {/* View Toggle */}
          <div className="flex bg-white shadow-sm p-1 rounded-2xl border border-[#EAE4D9]/50 overflow-hidden">
            <button 
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 text-xs font-black transition-all ${viewMode === 'table' ? 'bg-[#2A2723] text-white rounded-xl shadow-lg' : 'text-[#7A7061] hover:bg-gray-50'}`}
              title="عرض الجدول"
            >
              📊
            </button>
            <button 
              onClick={() => setViewMode('cards')}
              className={`px-4 py-2 text-xs font-black transition-all ${viewMode === 'cards' ? 'bg-[#2A2723] text-white rounded-xl shadow-lg' : 'text-[#7A7061] hover:bg-gray-50'}`}
              title="عرض الكروت"
            >
              🃏
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex bg-white/50 p-1.5 rounded-2xl border border-[#EAE4D9]/60 w-full md:w-auto shadow-sm">
            {[
              { id: 'pending', label: 'طلبات جديدة (قيد الانتظار)', icon: '📩' },
              { id: 'approved', label: 'طلبات تم قبولها', icon: '✅' },
              { id: 'all', label: 'كل طلبات الموقع', icon: '🌐' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 md:px-6 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id 
                  ? 'bg-[#C1A68D] text-white shadow-lg' 
                  : 'text-[#7A7061] hover:text-[#2A2723]'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 font-black text-xs animate-scale-in">
          ⚠️ {error}
        </div>
      )}

      {viewMode === 'table' ? (
        <div className="bg-white rounded-[2.5rem] border border-[#EAE4D9]/50 shadow-sm overflow-hidden transition-all">
          <div className="overflow-x-auto">
            <table className="w-full text-right" dir="rtl">
              <thead>
                <tr className="bg-[#FDFBF7] text-[#7A7061] text-[9px] uppercase tracking-[0.2em] font-black border-b border-[#EAE4D9]/50">
                  <th className="px-6 py-6">العميل والاتصال</th>
                  <th className="px-6 py-6">وقت الطلب</th>
                  <th className="px-6 py-6">التواريخ</th>
                  <th className="px-6 py-6">الوحدة المطلوبة</th>
                  <th className="px-6 py-6">إيصال التحويل</th>
                  <th className="px-6 py-6">الحالة</th>
                  <th className="px-6 py-6 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-24 text-center text-[#7A7061] italic font-bold opacity-40 uppercase tracking-widest">
                      {isLoading ? 'جاري تحميل البيانات...' : 'لا توجد طلبات حجز حالياً في هذا القسم.'}
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((booking: any) => (
                    <tr key={booking.id} className="border-t border-[#EAE4D9]/30 hover:bg-[#FDFBF7]/50 transition-all group">
                      <td className="px-6 py-6">
                        <div className="font-black text-[#2A2723] text-sm mb-1">{booking.name}</div>
                        <div className="flex items-center gap-2">
                          <button 
                              onClick={() => openWhatsAppChat(booking)}
                              className="flex items-center gap-1.5 text-[10px] text-green-600 font-black bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-100 hover:bg-green-600 hover:text-white transition-all shadow-sm"
                          >
                              <span className="text-sm">💬</span> {booking.phone}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="bg-[#FDFBF7] px-3 py-1.5 rounded-lg border border-[#EAE4D9]/50 inline-block">
                          <span className="text-[11px] font-black text-[#2A2723]">
                            {booking.timestamp ? new Date(booking.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </div>
                        <div className="text-[9px] text-[#7A7061] mt-1 font-bold opacity-50">
                          {booking.timestamp ? new Date(booking.timestamp).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit' }) : ''}
                        </div>
                      </td>
                      <td className="px-6 py-6 font-black">
                        <div className="text-[#2A2723] mb-1.5"><span className="text-[#7A7061] text-[9px] ml-2 opacity-50">من:</span> {booking.checkIn}</div>
                        <div className="text-[#2A2723]"><span className="text-[#7A7061] text-[9px] ml-2 opacity-50">إلى:</span> {booking.checkOut}</div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="bg-[#C1A68D]/10 text-[#C1A68D] px-3.5 py-2 rounded-xl text-[10px] font-black inline-block border border-[#C1A68D]/20">
                          {booking.studio || '—'}
                        </div>
                        {booking.apartmentId && <p className="text-[9px] text-[#7A7061] mt-1.5 font-bold opacity-60">رقم الأي دي: {booking.apartmentId}</p>}
                      </td>
                      <td className="px-6 py-6">
                        {(() => {
                          const receipt = getReceiptUrl(booking);
                          return receipt ? (
                            <button
                              type="button"
                              onClick={() => setActiveReceiptModal({ isOpen: true, url: receipt, name: booking.name })}
                              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white px-3 py-2 rounded-xl text-[10px] font-black transition-all border border-emerald-200/80 shadow-sm"
                            >
                              <span className="text-xs">🖼️</span>
                              <span>صورة الإيصال</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#7A7061] opacity-40 font-bold">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-6">
                        <span className={`px-4 py-2 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm ${
                          booking.status === 'approved' ? 'bg-green-50 text-green-600 border border-green-100' : 
                          booking.status === 'rejected' ? 'bg-red-50 text-red-600 border border-red-100' : 
                          'bg-orange-50 text-orange-600 border border-orange-100 animate-pulse'
                        }`}>
                          {booking.status === 'approved' ? 'تم القبول' : 
                           booking.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-end gap-3 transition-opacity">
                            {!['approved', 'مؤكد', 'مؤكد/دخول', 'مغادر/تنظيف', 'مغادر/تم'].includes(booking.status) && (
                              <button 
                                  onClick={() => { setSelectedBooking(booking); setShowApproveModal(true); }}
                                  className="w-8 h-8 flex items-center justify-center text-green-600 bg-green-50 rounded-lg hover:bg-green-600 hover:text-white transition-colors"
                                  title="تفعيل الحجز"
                              >
                                  <CheckCircle size={14} strokeWidth={2.5} />
                              </button>
                            )}
                            <button 
                                onClick={() => { setSelectedBooking(booking); setShowDeleteModal(true); }}
                                className="w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                                title="حذف الحجز"
                            >
                                <Trash2 size={14} strokeWidth={2.5} />
                            </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBookings.length === 0 ? (
               <div className="col-span-full py-24 text-center text-[#7A7061] font-black opacity-30 text-xs italic tracking-widest uppercase border-2 border-dashed border-[#EAE4D9] rounded-[3rem]">
                 لا توجد بيانات متاحة لهذا العرض.
               </div>
            ) : (
              filteredBookings.map((b: any) => (
                <div key={b.id} className={`group bg-[#1A1816] rounded-[2.5rem] border-2 shadow-2xl overflow-hidden transition-all duration-500 hover:scale-[1.03] scale-100 ${
                    b.status === 'approved' ? 'border-[#4ECDC4] shadow-[#4ECDC4]/10' : 
                    b.status === 'rejected' ? 'border-red-500 shadow-red-500/10 opacity-60' : 
                    'border-[#FFD166] shadow-[#FFD166]/20'
                }`}>
                  {/* Card Header inspired by Image 1 */}
                  <div className={`p-6 border-b border-white/5 flex justify-between items-center ${b.status === 'approved' ? 'bg-[#4ECDC4]/5' : b.status === 'rejected' ? 'bg-red-500/5' : 'bg-[#FFD166]/5'}`}>
                      <div>
                        <h3 className={`text-xl font-black ${b.status === 'approved' ? 'text-[#4ECDC4]' : b.status === 'rejected' ? 'text-red-400' : 'text-[#FFD166]'} tracking-tighter italic`}>قائمة الحجوزات</h3>
                        <p className="text-[9px] text-gray-500 font-black uppercase mt-1 tracking-widest">مجمع مزار الفندقي</p>
                      </div>
                      <div className="text-right">
                         <div className="text-[10px] text-gray-400 font-bold uppercase">{b.timestamp ? new Date(b.timestamp).toLocaleDateString('ar-EG', {month:'long', year:'numeric'}) : ''}</div>
                         <div className="text-[8px] text-[#C1A68D] font-black tracking-widest border-t border-[#C1A68D]/20 mt-1 pt-1 opacity-60">M Z A R</div>
                      </div>
                  </div>

                  <div className="p-8 space-y-8">
                     <div className="grid grid-cols-2 gap-6">
                        <section className="space-y-4">
                            <div className="border-r-2 border-[#C1A68D]/20 pr-4">
                               <p className="text-[9px] text-gray-500 font-black uppercase mb-1">العميل:</p>
                               <h4 className="text-white text-md font-black">{b.name}</h4>
                            </div>
                            <div className="border-r-2 border-white/5 pr-4 group-hover:border-[#4ECDC4]/50 transition-colors">
                               <p className="text-[9px] text-gray-500 font-black uppercase mb-1">الوحدة:</p>
                               <h4 className="text-[#C1A68D] text-md font-black italic">{b.studio || 'لم يتم الربط'}</h4>
                               <p className="text-[8px] text-gray-600 mt-1 font-bold">Studio: {b.apartmentId || '??'}</p>
                            </div>
                        </section>
                        <section className="space-y-4 text-left">
                            <div className="pl-4">
                               <p className="text-[9px] text-gray-500 font-black uppercase mb-1 text-right">الأفراد:</p>
                               <h4 className="text-white text-2xl font-black italic">2 <span className="text-[10px] text-gray-500">فرد</span></h4>
                            </div>
                            <div className="pl-4">
                               <p className="text-[9px] text-gray-400 font-black uppercase mb-1 text-right">المصدر:</p>
                               <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-[9px] font-black tracking-tighter">Mobile App</span>
                            </div>
                        </section>
                     </div>

                     <div className="grid grid-cols-2 gap-4 bg-white/[0.02] p-6 rounded-3xl border border-white/5 relative overflow-hidden group-hover:bg-white/[0.04] transition-all">
                        <div className="absolute top-0 right-0 w-2 h-full bg-[#C1A68D]/20" />
                        <div>
                            <p className="text-[9px] text-gray-500 font-black mb-1 italic">مدة الإقامة:</p>
                            <h5 className="text-white text-lg font-black">{b.numberOfDays || 0} <span className="text-[10px] opacity-40">أيام</span></h5>
                        </div>
                        <div className="text-left">
                            <p className="text-[9px] text-gray-500 font-black mb-1 italic text-right">الإجمالي:</p>
                            <h5 className="text-[#4ECDC4] text-xl font-black">{b.totalAmount || 0} <span className="text-[10px] opacity-40">ج.م</span></h5>
                        </div>
                     </div>

                     <div className="space-y-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3 text-white">
                           <span className="text-xs">📅</span>
                           <span className="text-[10px] font-black tracking-tighter">دخول: {b.checkIn} ➔ خروج: {b.checkOut}</span>
                        </div>
                     </div>

                     {b.notes && (
                       <div className="pt-4 border-t border-white/5">
                          <p className="text-[9px] text-gray-500 font-black mb-2 uppercase tracking-widest flex items-center gap-2">
                             <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" /> ملاحظات الإدارة:
                          </p>
                          <p className="text-[10px] text-gray-400 leading-relaxed font-bold italic">"{b.notes}"</p>
                       </div>
                     )}

                     <div className="pt-6 border-t border-white/5 flex gap-3">
                        <div className="flex w-full gap-2">
                            {b.status !== 'approved' && b.status !== 'مؤكد' && (
                                <button 
                                    onClick={() => { setSelectedBooking(b); setShowApproveModal(true); }}
                                    className="flex-1 py-4 bg-green-600 text-white rounded-2xl text-[10px] font-black hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                                >
                                    <CheckCircle size={18} strokeWidth={2.5} />
                                </button>
                            )}
                            {!isModerator && <button 
                                onClick={() => openWhatsAppChat(b)}
                                className="flex-1 py-4 bg-white/5 text-white border border-white/10 rounded-2xl text-[10px] font-black hover:bg-white/10 transition-all"
                            >
                                <Smartphone size={18} strokeWidth={2.5} />
                            </button>}
                            <button 
                                onClick={() => { setSelectedBooking(b); setShowDeleteModal(true); }}
                                className="px-6 py-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all"
                                title="حذف"
                            >
                                <Trash2 size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                     </div>
                  </div>
                </div>
              ))
            )}
        </div>
      )}

      {/* Approval Modal */}
      {showApproveModal && selectedBooking && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-[#FDFBF7] border border-[#EAE4D9] max-w-2xl w-full p-10 md:p-14 rounded-[3rem] space-y-10 shadow-[0_30px_100px_rgba(0,0,0,0.1)] animate-scale-in text-right relative overflow-hidden" dir="rtl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C1A68D]/5 rounded-full blur-3xl -mr-10 -mt-10" />
            
            <header className="space-y-3 relative z-10">
              <div className="text-[10px] font-black text-[#C1A68D] uppercase tracking-[0.3em] mb-2">Confirm Booking</div>
              <h3 className="text-3xl font-black text-[#2A2723]">قبول حجز أ/ <span className="text-[#C1A68D]">{selectedBooking.name}</span></h3>
              <p className="text-[#7A7061] text-xs font-bold leading-relaxed opacity-70">سيتم إرسال بيانات الدفع والتسكين للعميل عبر لوحة التحكم.</p>
            </header>

            <div className="space-y-10 relative z-10">
              <div className="space-y-4">
                  <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest px-2 opacity-60">التسكين الفعلي في وحدة:</label>
                  <select 
                    title="اختر الوحدة"
                    className="w-full bg-white border border-[#EAE4D9]/60 rounded-[1.5rem] px-6 py-5 text-sm text-[#2A2723] font-black outline-none focus:border-[#C1A68D] transition-all cursor-pointer shadow-sm"
                    value={selectedAptId || ''}
                    onChange={e => setSelectedAptId(e.target.value)}
                  >
                    {availableAptsForBooking.map(apt => (
                      <option key={apt.id} value={apt.id}>وحدة: {apt.id} ({apt.title.ar})</option>
                    ))}
                    {availableAptsForBooking.length === 0 && (
                      <option value="">لا توجد وحدات متاحة في هذه التواريخ!</option>
                    )}
                  </select>
                </div>

              {/* Report Fields - Optional */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">بيانات التقرير (اختياري)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="الجنسية"
                    className="bg-white border border-[#EAE4D9]/60 rounded-xl px-4 py-3 text-xs text-[#2A2723] font-bold outline-none focus:border-[#C1A68D] transition-all"
                    value={nationality}
                    onChange={e => setNationality(e.target.value)}
                  />
                  <input
                    placeholder="رقم الهوية"
                    className="bg-white border border-[#EAE4D9]/60 rounded-xl px-4 py-3 text-xs text-[#2A2723] font-bold outline-none focus:border-[#C1A68D] transition-all"
                    value={idNumber}
                    onChange={e => setIdNumber(e.target.value)}
                  />
                  <input
                    placeholder="اسم الوسيط (Broker)"
                    className="bg-white border border-[#EAE4D9]/60 rounded-xl px-4 py-3 text-xs text-[#2A2723] font-bold outline-none focus:border-[#C1A68D] transition-all"
                    value={brokerName}
                    onChange={e => setBrokerName(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="العمولة (ج.م)"
                    className="bg-white border border-[#EAE4D9]/60 rounded-xl px-4 py-3 text-xs text-[#2A2723] font-bold outline-none focus:border-[#C1A68D] transition-all"
                    value={commission || ''}
                    onChange={e => setCommission(Number(e.target.value))}
                  />
                </div>
                <input
                  placeholder="ملاحظات"
                  className="w-full bg-white border border-[#EAE4D9]/60 rounded-xl px-4 py-3 text-xs text-[#2A2723] font-bold outline-none focus:border-[#C1A68D] transition-all"
                  value={bookingNotes}
                  onChange={e => setBookingNotes(e.target.value)}
                />
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest px-2 opacity-60">بيانات الحجز (ستظهر للعميل)</label>
                
                {totalAmount > 0 && (
                   <div className="bg-white border border-[#C1A68D]/20 p-5 rounded-[2rem] shadow-sm flex items-center justify-between">
                     <div>
                        <p className="text-[10px] text-[#7A7061] font-black uppercase tracking-widest opacity-60 mb-1">الإجمالي المحسوب ({numberOfDays} ليالي)</p>
                        <p className="text-[#C1A68D] text-2xl font-black">{totalAmount} <span className="text-xs">ج.م</span></p>
                     </div>
                     <span className="text-2xl opacity-20">💰</span>
                   </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                   <button onClick={() => setPaymentInfo(prev => `${prev}\n\nتحويل عبر إنستا باي (InstaPay):\nالاسم: مدحت عزالدين\nالرقم: 01005318003`)} className="text-[9px] bg-[#2A2723] text-white px-4 py-2 rounded-full border border-transparent hover:bg-black transition-all font-black shadow-lg shadow-black/10">إنستا باي +</button>
                   <button onClick={() => setPaymentInfo(prev => `${prev}\n\nتحويل عبر فودافون كاش (Vodafone Cash):\nالاسم: محمود علي\nالرقم: 01021691745`)} className="text-[9px] bg-red-600 text-white px-4 py-2 rounded-full border border-transparent hover:bg-red-700 transition-all font-black shadow-lg shadow-red-600/10">فودافون كاش +</button>
                   <button onClick={() => setPaymentInfo(prev => `${prev}\n\nتحويل بنكي (البنك الأهلي المصري):\nاسم الحساب: مدحت عزالدين\nرقم الحساب: 1385171656685100017\nIBAN: EG620003013851716566851000170`)} className="text-[9px] bg-amber-800 text-white px-4 py-2 rounded-full border border-transparent hover:bg-amber-900 transition-all font-black shadow-lg shadow-amber-800/10">البنك الأهلي +</button>
                </div>
                <textarea 
                  placeholder="اكتب تفاصيل الدفع أو أي ملاحظات للعميل هنا..."
                  className="w-full bg-white border border-[#EAE4D9]/60 rounded-[2rem] p-8 text-sm text-[#2A2723] font-bold min-h-[160px] outline-none focus:border-[#C1A68D] transition-all resize-none leading-relaxed shadow-sm"
                  value={paymentInfo}
                  onChange={e => setPaymentInfo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6 relative z-10">
              <button 
                onClick={approveBooking}
                disabled={!paymentInfo || !selectedAptId}
                className="flex-[2] py-6 bg-[#C1A68D] text-white font-black rounded-2xl hover:bg-[#D5C5B3] hover:scale-[1.02] transition-all disabled:opacity-20 shadow-xl shadow-[#C1A68D]/30 text-lg"
              >
                تأكيد القبول والتسكين ✅
              </button>
              <button 
                onClick={() => { setShowApproveModal(false); setSelectedBooking(null); }}
                className="flex-1 py-6 bg-white border border-[#EAE4D9]/60 text-[#7A7061] font-black rounded-2xl hover:bg-[#FDFBF7] transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedBooking && (
        <div className="fixed inset-0 bg-red-600/10 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white border border-red-100 max-w-md w-full p-10 rounded-[3rem] space-y-8 shadow-[0_30px_100px_rgba(230,57,70,0.15)] animate-scale-in text-right" dir="rtl">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-red-100">
               ⚠️
            </div>
            
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-black text-[#2A2723]">تأكيد رفض الطلب</h3>
              <p className="text-[#7A7061] text-xs font-bold leading-relaxed opacity-70 px-4">
                هل أنت متأكد من رفض طلب الحجز الخاص بـ <span className="text-red-600 font-black">{selectedBooking.name}</span>؟ لن يتمكن العميل من متابعة الحجز للتواريخ المختارة.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={async () => {
                   setIsLoading(true);
                   try {
                     await deleteBooking(selectedBooking.id);
                   } catch (err) {
                     setError('فشل حذف الطلب المرفوض.');
                   }
                   setShowRejectModal(false);
                   setSelectedBooking(null);
                   await refreshBookings();
                }}
                className="flex-[2] py-5 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 hover:scale-[1.02] transition-all shadow-xl shadow-red-600/30 text-sm"
              >
                تأكيد الرفض (مسح نهائي) ✖
              </button>
              <button 
                onClick={() => { setShowRejectModal(false); setSelectedBooking(null); }}
                className="flex-1 py-5 bg-white border border-[#EAE4D9]/60 text-[#7A7061] font-black rounded-2xl hover:bg-[#FDFBF7] transition-all text-sm"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white border border-gray-100 max-w-md w-full p-10 rounded-[3rem] space-y-8 shadow-2xl animate-scale-in text-right" dir="rtl">
            <div className="w-20 h-20 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 border border-gray-100">
               🗑️
            </div>
            
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-black text-[#2A2723]">حذف السجل نهائياً</h3>
              <p className="text-[#7A7061] text-xs font-bold leading-relaxed opacity-70 px-4">
                هل أنت متأكد من حذف سجل حجز <span className="text-red-600 font-black">{selectedBooking.name}</span>؟ هذا الإجراء لا يمكن التراجع عنه وسيختفي الطلب تماماً من الأرشيف.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={async () => {
                   await updateStatus(selectedBooking.id, 'deleted');
                   setShowDeleteModal(false);
                   setSelectedBooking(null);
                }}
                className="flex-[2] py-5 bg-black text-white font-black rounded-2xl hover:bg-gray-900 hover:scale-[1.02] transition-all shadow-xl text-sm"
              >
                تأكيد الحذف النهائي ✖
              </button>
              <button 
                onClick={() => { setShowDeleteModal(false); setSelectedBooking(null); }}
                className="flex-1 py-5 bg-white border border-[#EAE4D9]/60 text-[#7A7061] font-black rounded-2xl hover:bg-[#FDFBF7] transition-all text-sm"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Hint */}
      <div className="bg-white border border-[#EAE4D9]/50 p-8 flex gap-6 items-center rounded-[2.5rem] shadow-sm">
        <span className="text-4xl">🗨️</span>
        <div className="text-[11px] leading-relaxed text-[#7A7061] font-bold">
          <strong className="block mb-2 text-[#C1A68D] text-sm font-black tracking-widest uppercase">نظام التواصل الذكي:</strong>
          عند الضغط على رقم هاتف العميل، سيتم فتح محادثة <span className="text-green-600 font-black">WhatsApp</span> مباشرة مع رسالة مجهزة بتفاصيل الحجز لتسهيل التواصل والرد السريع.
        </div>
      </div>

      {/* RECEIPT IMAGE MODAL */}
      <ReceiptImageModal
        isOpen={activeReceiptModal.isOpen}
        url={activeReceiptModal.url}
        guestName={activeReceiptModal.name}
        onClose={() => setActiveReceiptModal({ isOpen: false, url: null })}
      />
    </div>
  );
}
