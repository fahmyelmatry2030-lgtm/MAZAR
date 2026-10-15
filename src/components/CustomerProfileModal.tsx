"use client";

import { useState, useEffect } from 'react';
import { X, User, Phone, Calendar, History, Star, FileText, MessageSquare, Award, CheckCircle2, Home } from 'lucide-react';
import { formatWhatsAppNumber } from '@/lib/utils';
import { updateDbBookingStatus } from '@/lib/actions/db';

interface CustomerProfileModalProps {
  customerName: string | null;
  customerPhone?: string | null;
  bookings: any[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function CustomerProfileModal({
  customerName,
  customerPhone,
  bookings,
  isOpen,
  onClose,
  onRefresh
}: CustomerProfileModalProps) {
  const [noteText, setNoteText] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [globalNote, setGlobalNote] = useState('');
  const [isEditingGlobalNote, setIsEditingGlobalNote] = useState(false);

  // Normalize customer name and filter all matching bookings
  const normalize = (s: string) => String(s || '').trim().toLowerCase().replace(/^(أ|ا|إ|أ\.|د|م|مهندس|دكتور|استاذ)\s*/g, '');
  const targetName = customerName ? normalize(customerName) : '';
  const targetPhone = customerPhone?.trim();

  const customerBookings = bookings.filter((b: any) => {
    if (targetPhone && b.phone && b.phone.trim() === targetPhone) return true;
    if (targetName && b.name) {
      const bn = normalize(b.name);
      return bn === targetName || bn.includes(targetName) || targetName.includes(bn);
    }
    return false;
  }).sort((a: any, b: any) => new Date(b.checkIn || 0).getTime() - new Date(a.checkIn || 0).getTime());

  const latestBooking = customerBookings[0] || {};
  const phone = customerPhone || latestBooking.phone || '';
  const cleanPhone = formatWhatsAppNumber(phone);
  const totalRevenue = customerBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
  const totalNights = customerBookings.reduce((sum, b) => sum + (Number(b.numberOfDays) || 0), 0);

  // Set note text when modal opens or customer changes
  useEffect(() => {
    if (latestBooking) {
      setNoteText(latestBooking.notes || '');
    }
    setIsEditingNote(false);
  }, [customerName, latestBooking.notes]);

  useEffect(() => {
    if (phone) {
      setGlobalNote(localStorage.getItem(`customer_note_${phone}`) || '');
    }
    setIsEditingGlobalNote(false);
  }, [phone]);

  const handleSaveGlobalNote = () => {
    if (phone) {
      const trimmed = globalNote.trim();
      if (trimmed) {
        localStorage.setItem(`customer_note_${phone.trim()}`, trimmed);
      } else {
        localStorage.removeItem(`customer_note_${phone.trim()}`);
      }
      setIsEditingGlobalNote(false);
      window.dispatchEvent(new Event('customer_notes_updated'));
      if (onRefresh) onRefresh();
    }
  };

  if (!isOpen || !customerName) return null;

  // VIP / Loyal Status badges
  const isVip = customerBookings.length >= 3;
  const isRepeatGuest = customerBookings.length >= 2;

  const handleSaveNote = async () => {
    if (!latestBooking.id) {
      alert('لا يوجد حجز مسجل لتعديل ملاحظاته');
      return;
    }
    setIsSaving(true);
    try {
      await updateDbBookingStatus(latestBooking.id, { notes: noteText });
      setIsEditingNote(false);
      window.dispatchEvent(new Event('customer_notes_updated'));
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('فشل حفظ الملاحظة');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="bg-[#1F1C18] border border-[#EAE4D9]/20 rounded-[2.5rem] max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#2A2723] via-[#38332D] to-[#2A2723] p-6 border-b border-white/10 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-6 left-6 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C1A68D] to-[#9E8268] flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0">
              {customerName.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-white">{customerName}</h2>
                {isVip && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Star size={11} fill="currentColor" /> عميل VIP مميز
                  </span>
                )}
                {isRepeatGuest && !isVip && (
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Award size={11} /> عميل متكرر ({customerBookings.length} حجوزات)
                  </span>
                )}
              </div>
              <p className="text-xs text-[#C1A68D] font-bold mt-1">
                سجل البيانات الموحد للعميل وكافة الحجوزات السابقة
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3 p-6 bg-[#25221E] border-b border-white/5 text-center flex-shrink-0">
          <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">عدد الحجوزات</span>
            <span className="text-xl font-black text-amber-400">{customerBookings.length} <span className="text-xs text-white/50">حجز</span></span>
          </div>
          <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">إجمالي الليالي</span>
            <span className="text-xl font-black text-blue-400">{totalNights} <span className="text-xs text-white/50">ليلة</span></span>
          </div>
          <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">إجمالي الإيراد</span>
            <span className="text-xl font-black text-emerald-400">{totalRevenue.toLocaleString()} <span className="text-xs text-white/50">ج.م</span></span>
          </div>
        </div>

        {/* Contact Actions */}
        <div className="px-6 py-4 bg-[#1F1C18] border-b border-white/5 flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
            <Phone size={14} className="text-[#C1A68D]" />
            <span>الهاتف:</span>
            {phone ? (
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="font-mono text-emerald-400 hover:text-emerald-300 hover:underline tracking-wider"
                title="اضغط للمحادثة واتساب"
              >
                {phone}
              </a>
            ) : (
              <span>غير مسجل</span>
            )}
          </div>
          {phone && (
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md"
            >
              <MessageSquare size={14} />
              <span>محادثة واتساب متميزة</span>
            </a>
          )}
        </div>

        {/* Two Column Layout: Notes on Right, Bookings on Left */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar-horizontal min-h-[300px]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Column Right (6 cols): Notes & Global Profile Info */}
            <div className="md:col-span-6 space-y-5">
              
              {/* 📝 Permanent Customer Profile Notes (Extensive) */}
              <div className="bg-[#2A2723] border-2 border-[#C1A68D]/40 rounded-3xl p-6 space-y-4 shadow-xl relative">
                <div className="absolute top-0 left-0 bg-[#C1A68D] text-[#1F1C18] text-[9px] font-black px-3 py-1 rounded-bl-2xl rounded-tr-sm uppercase tracking-wider">
                  ملف العميل الدائم الموحد
                </div>
                
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-sm font-black text-[#C1A68D] flex items-center gap-2 mt-1">
                    <FileText size={18} />
                    <span>ملاحظات العميل الدائمة (باستفاضة)</span>
                  </span>
                  {!isEditingGlobalNote && phone && (
                    <button
                      onClick={() => setIsEditingGlobalNote(true)}
                      className="text-xs text-[#C1A68D] hover:text-white underline font-black"
                    >
                      تعديل الملاحظة ✏️
                    </button>
                  )}
                </div>

                {isEditingGlobalNote ? (
                  <div className="space-y-3 mt-2">
                    <textarea
                      rows={12}
                      value={globalNote}
                      onChange={(e) => setGlobalNote(e.target.value)}
                      placeholder="اكتب ملاحظات باستفاضة عن العميل هنا (مثلاً: يفضل الطوابق العليا، يفضل الهدوء، العميل دقيق في المواعيد، لديه طلبات متكررة، إلخ)..."
                      className="w-full bg-[#1E1B18] border-2 border-[#C1A68D] rounded-2xl p-4 text-sm text-white outline-none font-bold resize-none leading-relaxed focus:ring-2 focus:ring-[#C1A68D]/30"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setIsEditingGlobalNote(false); setGlobalNote(localStorage.getItem(`customer_note_${phone}`) || ''); }}
                        className="px-4 py-2 rounded-xl text-xs bg-white/10 text-gray-300 hover:bg-white/20 font-bold"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={handleSaveGlobalNote}
                        className="px-5 py-2 rounded-xl text-xs font-black bg-[#C1A68D] text-[#1F1C18] hover:bg-[#d5baa0] transition-all flex items-center gap-1.5 shadow-md"
                      >
                        حفظ الملاحظة الدائمة 💾
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/35 p-5 rounded-2xl border border-white/5 min-h-[260px] flex flex-col justify-between">
                    <p className="text-sm text-amber-100 font-bold leading-relaxed whitespace-pre-wrap">
                      {globalNote ? globalNote : '💬 لا توجد ملاحظات عامة مسجلة في ملف هذا العميل حالياً. اضغط على "تعديل الملاحظة" في الأعلى للبدء بالكتابة باستفاضة.'}
                    </p>
                  </div>
                )}
              </div>

              {/* 🏠 Latest Booking Specific Note */}
              <div className="bg-[#25221E] border border-white/5 rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400 flex items-center gap-1.5">
                    <span>🏠 ملاحظة الحجز الأخير (خاصة بهذا الحجز فقط)</span>
                  </span>
                  {!isEditingNote && latestBooking.id && (
                    <button
                      onClick={() => setIsEditingNote(true)}
                      className="text-[10px] text-[#C1A68D] hover:underline font-bold"
                    >
                      تعديل ✏️
                    </button>
                  )}
                </div>

                {isEditingNote ? (
                  <div className="space-y-2 mt-2">
                    <textarea
                      rows={3}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="اكتب ملاحظة تخص الحجز الأخير فقط..."
                      className="w-full bg-[#1F1C18] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none font-bold resize-none"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setIsEditingNote(false); setNoteText(latestBooking.notes || ''); }}
                        className="px-3 py-1 rounded-lg text-xs bg-white/10 text-gray-300 hover:bg-white/20"
                      >
                        إلغاء
                      </button>
                      <button
                        disabled={isSaving}
                        onClick={handleSaveNote}
                        className="px-4 py-1 rounded-lg text-xs font-black bg-[#C1A68D] text-white hover:opacity-90 flex items-center gap-1"
                      >
                        {isSaving ? 'جاري الحفظ...' : 'حفظ 💾'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 font-bold leading-relaxed whitespace-pre-wrap bg-black/10 p-3 rounded-xl border border-white/5">
                    {latestBooking.notes ? latestBooking.notes : 'لا توجد ملاحظة للحجز الأخير.'}
                  </p>
                )}
              </div>

            </div>

            {/* Column Left (6 cols): Bookings Timeline */}
            <div className="md:col-span-6 space-y-4">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <History size={14} className="text-[#C1A68D]" />
                <span>سجل الحجوزات والتفاصيل ({customerBookings.length})</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customerBookings.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-xs font-bold">لا يوجد سجلات حجوزات سابقة لهذا العميل</div>
                ) : (
                  customerBookings.map((b: any, index: number) => (
                    <div key={b.id || index} className="bg-[#25221E] border border-white/10 rounded-2xl p-4 transition-all hover:border-[#C1A68D]/40 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 bg-[#C1A68D]/20 text-[#C1A68D] font-black rounded-lg flex items-center justify-center text-xs border border-[#C1A68D]/30">
                            <Home size={14} />
                          </span>
                          <span className="font-black text-sm text-white">
                            {b.studio || b.apartmentId || 'وحدة مزار'}
                          </span>
                          <span className="text-[10px] font-black bg-white/10 px-2 py-0.5 rounded-full text-gray-300">
                            ID: {b.apartmentId}
                          </span>
                        </div>

                        <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${
                          b.status === 'approved' || b.status === 'مؤكد' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {b.status === 'approved' || b.status === 'مؤكد' ? 'مؤكد' : b.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] bg-black/20 p-3 rounded-xl text-center">
                        <div>
                          <span className="text-gray-400 text-[9px] block">من تاريخ</span>
                          <span className="font-bold text-blue-300">{b.checkIn}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block">إلى تاريخ</span>
                          <span className="font-bold text-rose-300">{b.checkOut}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block">الليالي</span>
                          <span className="font-bold text-amber-300">{b.numberOfDays || '—'} أيام</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block">المبلغ الإجمالي</span>
                          <span className="font-black text-emerald-400">{b.totalAmount ? `${b.totalAmount} ج.م` : '—'}</span>
                        </div>
                      </div>

                      {/* Shift Lead Approver Badge */}
                      <div className="flex items-center justify-between text-[11px] bg-blue-500/10 border border-blue-500/20 px-3.5 py-2.5 rounded-xl text-blue-300 font-bold mt-2">
                        <span className="flex items-center gap-1.5">
                          <span>🛡️ اعتمد بواسطة:</span>
                          <strong className="text-white font-black">{(() => {
                            if (b.bookingManager && b.bookingManager.trim() !== '' && b.bookingManager !== b.name && b.bookingManager !== b.guest) {
                              return b.bookingManager;
                            }
                            const match = String(b.notes || '').match(/\[اعتماد:\s*([^\]]+)\]/i);
                            if (match && match[1]) return match[1].trim();
                            return 'قائد الشيفت (المشرف)';
                          })()}</strong>
                        </span>
                        {b.paymentMethod && <span className="text-emerald-400 font-black">💳 {b.paymentMethod}</span>}
                      </div>

                      {b.notes && b.id !== latestBooking.id && (
                        <div className="bg-black/10 p-2.5 rounded-xl border border-white/5 text-[11px] text-gray-400 font-medium">
                          <span className="text-[#C1A68D] font-bold">ملاحظة الحجز السابق:</span> {b.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#1A1816] border-t border-white/10 text-center flex-shrink-0">
          <button
            onClick={onClose}
            className="bg-[#2A2723] hover:bg-[#38332D] text-white text-xs font-black px-8 py-3 rounded-2xl transition-all border border-white/10"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
}
