"use client";

import { useState, useEffect } from 'react';
import { X, User, Phone, Calendar, History, Star, FileText, MessageSquare, Award, CheckCircle2, Home, Check, Sparkles } from 'lucide-react';
import { formatWhatsAppNumber, getCustomerProfileNote, saveCustomerProfileNoteLocally, normalizeCustomerNameKey, formatDateDMY } from '@/lib/utils';
import { saveDbCustomerNote } from '@/lib/actions/db';

interface CustomerProfileModalProps {
  customerName: string | null;
  customerPhone?: string | null;
  bookings: any[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  initialMode?: 'history' | 'notes';
}

export default function CustomerProfileModal({
  customerName,
  customerPhone,
  bookings,
  isOpen,
  onClose,
  onRefresh,
  initialMode = 'history'
}: CustomerProfileModalProps) {
  const [globalNote, setGlobalNote] = useState('');
  const [isEditingGlobalNote, setIsEditingGlobalNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'history'>('notes');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Normalize customer name and filter all matching bookings
  const normalize = (s: string) => String(s || '').trim().toLowerCase().replace(/^(أ|ا|إ|أ\.|د|م|مهندس|دكتور|استاذ|شيخ|حاج|حاجة)\s*/g, '');
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

  // Load permanent customer note (مفصول تماماً عن ملاحظات الحجوزات والفلوس)
  useEffect(() => {
    if (!isOpen) return;
    const note = getCustomerProfileNote(phone, customerName);
    setGlobalNote(note);

    if (initialMode === 'notes') {
      setActiveTab('notes');
      if (!note) {
        setIsEditingGlobalNote(true);
      } else {
        setIsEditingGlobalNote(false);
      }
    } else {
      setActiveTab('history');
      setIsEditingGlobalNote(false);
    }
  }, [phone, customerName, isOpen, initialMode]);

  const handleSaveGlobalNote = async () => {
    const trimmed = globalNote.trim();
    setIsSaving(true);

    // 1. حفظ فوري في الكاش و LocalStorage لكافة صيغ الهاتف والاسم
    saveCustomerProfileNoteLocally(phone, customerName, trimmed);

    // 2. مزامنة مع قاعدة البيانات Supabase
    const primaryKey = phone?.trim() || normalizeCustomerNameKey(customerName);
    if (primaryKey) {
      try {
        await saveDbCustomerNote(primaryKey, trimmed);
      } catch (e) {
        console.error('Failed to sync customer note to DB:', e);
      }
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    setIsEditingGlobalNote(false);
    if (onRefresh) onRefresh();
  };

  if (!isOpen || !customerName) return null;

  // VIP / Loyal Status badges
  const isVip = customerBookings.length >= 3;
  const isRepeatGuest = customerBookings.length >= 2;

  return (
    <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in" dir="rtl">
      <div className="bg-[#1F1C18] border border-[#EAE4D9]/20 rounded-3xl sm:rounded-[2.5rem] max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[95vh] text-white">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#2A2723] via-[#38332D] to-[#2A2723] p-4 sm:p-6 border-b border-white/10 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 sm:top-6 left-4 sm:left-6 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all z-10"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 sm:gap-4 pl-10">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#C1A68D] to-[#9E8268] flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg shrink-0">
              {customerName.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white truncate">{customerName}</h2>
                {isVip && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <Star size={11} fill="currentColor" /> VIP
                  </span>
                )}
                {isRepeatGuest && !isVip && (
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <Award size={11} /> متكرر ({customerBookings.length})
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-[#C1A68D] font-bold mt-0.5">
                ملف العميل الموحد والملاحظات الدائمة
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 sm:p-4 bg-[#25221E] border-b border-white/5 text-center flex-shrink-0">
          <div className="bg-white/5 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-white/5">
            <span className="text-[9px] sm:text-[10px] font-black text-gray-400 block mb-0.5">الحجوزات</span>
            <span className="text-base sm:text-xl font-black text-amber-400">{customerBookings.length} <span className="text-[10px] text-white/50">حجز</span></span>
          </div>
          <div className="bg-white/5 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-white/5">
            <span className="text-[9px] sm:text-[10px] font-black text-gray-400 block mb-0.5">الليالي</span>
            <span className="text-base sm:text-xl font-black text-blue-400">{totalNights} <span className="text-[10px] text-white/50">ليلة</span></span>
          </div>
          <div className="bg-white/5 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-white/5">
            <span className="text-[9px] sm:text-[10px] font-black text-gray-400 block mb-0.5">الإيراد</span>
            <span className="text-base sm:text-xl font-black text-emerald-400">{totalRevenue.toLocaleString()} <span className="text-[10px] text-white/50">ج.م</span></span>
          </div>
        </div>

        {/* Contact Actions */}
        <div className="px-4 sm:px-6 py-3 bg-[#1F1C18] border-b border-white/5 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
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
              <span className="text-gray-500">غير مسجل</span>
            )}
          </div>
          {phone && (
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shrink-0"
            >
              <MessageSquare size={13} />
              <span>واتساب</span>
            </a>
          )}
        </div>

        {/* Tab Controls (Clear & Touch-friendly on Mobile & PC) */}
        <div className="flex border-b border-white/10 bg-[#171513] px-3 sm:px-6 pt-2 flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs sm:text-sm font-black border-b-2 transition-all rounded-t-xl ${
              activeTab === 'notes'
                ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <FileText size={15} />
            <span>ملاحظات العميل الدائمة</span>
            {globalNote ? (
              <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs sm:text-sm font-black border-b-2 transition-all rounded-t-xl ${
              activeTab === 'history'
                ? 'border-[#C1A68D] text-[#C1A68D] bg-white/5'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <History size={15} />
            <span>سجل الحجوزات ({customerBookings.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar-horizontal min-h-[280px]">
          {activeTab === 'notes' ? (
            /* 📝 PERMANENT CUSTOMER NOTES TAB */
            <div className="max-w-3xl mx-auto space-y-4">
              
              {/* Notice Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 sm:p-4 text-xs text-amber-200/90 flex items-start gap-2.5">
                <span className="text-base shrink-0">💡</span>
                <div className="leading-relaxed">
                  <strong className="text-amber-300 block mb-0.5">ملاحظات العميل الدائمة (العلامة الصفراء ⭐):</strong>
                  هذه الملاحظات خاصة بملف العميل وتظهر معه في كل حجوزاته السابقة والمستقبلية، ومفصولة تماماً عن ملاحظات المكان أو تفاصيل الحجز الفردي.
                </div>
              </div>

              {/* Feedback Success */}
              {saveSuccess && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-300 font-black flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 size={16} />
                  <span>تم حفظ وتحديث ملاحظة العميل بنجاح! ستظهر العلامة الصفراء بجانب اسمه فوراً.</span>
                </div>
              )}

              {/* Note Editor Card */}
              <div className="bg-[#2A2723] border-2 border-amber-500/40 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-sm font-black text-amber-400 flex items-center gap-2">
                    <FileText size={18} />
                    <span>ملاحظات العميل الدائمة (فايل العميل)</span>
                  </span>
                  {!isEditingGlobalNote && (
                    <button
                      onClick={() => setIsEditingGlobalNote(true)}
                      className="text-xs bg-amber-400 hover:bg-amber-300 text-stone-950 font-black px-3.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>تعديل الملاحظة</span>
                      <span>✏️</span>
                    </button>
                  )}
                </div>

                {isEditingGlobalNote ? (
                  <div className="space-y-3">
                    <textarea
                      rows={8}
                      value={globalNote}
                      onChange={(e) => setGlobalNote(e.target.value)}
                      placeholder="اكتب ملاحظات باستفاضة عن العميل هنا (مثلاً: يفضل الطوابق العليا، يفضل الهدوء، العميل دقيق في المواعيد، لديه طلبات متكررة، انطباع عام عن العميل)..."
                      className="w-full bg-[#1A1815] border-2 border-amber-500/60 rounded-2xl p-4 text-sm text-white outline-none font-bold resize-none leading-relaxed focus:ring-2 focus:ring-amber-400/40 placeholder-stone-500"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setIsEditingGlobalNote(false);
                          setGlobalNote(getCustomerProfileNote(phone, customerName));
                        }}
                        className="px-4 py-2 rounded-xl text-xs bg-white/10 text-gray-300 hover:bg-white/20 font-bold transition-all"
                        disabled={isSaving}
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={handleSaveGlobalNote}
                        disabled={isSaving}
                        className="px-6 py-2.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-stone-950 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                      >
                        {isSaving ? <span>جارٍ الحفظ...</span> : <><span>حفظ الملاحظة الدائمة</span><span>💾</span></>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/35 p-5 rounded-2xl border border-white/5 min-h-[160px] flex flex-col justify-between">
                    <p className="text-sm text-amber-100 font-bold leading-relaxed whitespace-pre-wrap">
                      {globalNote ? globalNote : '💬 لا توجد ملاحظات مسجلة في ملف هذا العميل حالياً. اضغط على "تعديل الملاحظة" في الأعلى للبدء بكتابة ملاحظات تخص العميل.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 📋 BOOKINGS TIMELINE TAB */
            <div className="space-y-4">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <History size={14} className="text-[#C1A68D]" />
                <span>سجل الحجوزات والتفاصيل ({customerBookings.length})</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {customerBookings.length === 0 ? (
                  <div className="col-span-2 text-center py-10 text-gray-500 text-xs font-bold">لا يوجد سجلات حجوزات سابقة لهذا العميل</div>
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

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-black/20 p-2.5 rounded-xl text-center">
                        <div>
                          <span className="text-gray-400 text-[9px] block">من (دخول)</span>
                          <span className="font-bold text-blue-300" dir="ltr">{formatDateDMY(b.checkIn)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block">إلى (خروج)</span>
                          <span className="font-bold text-rose-300" dir="ltr">{formatDateDMY(b.checkOut)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block">الليالي</span>
                          <span className="font-bold text-amber-300">{b.numberOfDays || '—'} أيام</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[9px] block">المبلغ</span>
                          <span className="font-black text-emerald-400">{b.totalAmount ? `${b.totalAmount} ج.م` : '—'}</span>
                        </div>
                      </div>

                      {/* Shift Lead Approver Badge */}
                      <div className="flex items-center justify-between text-[11px] bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-xl text-blue-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <span>🛡️ اعتمد بواسطة:</span>
                          <strong className="text-white font-black">{(() => {
                            if (b.bookingManager && b.bookingManager.trim() !== '' && b.bookingManager !== b.name && b.bookingManager !== b.guest) {
                              return b.bookingManager;
                            }
                            const match = String(b.notes || '').match(/\[اعتماد:\s*([^\]]+)\]/i);
                            if (match && match[1]) return match[1].trim();
                            return 'قائد الشيفت';
                          })()}</strong>
                        </span>
                        {b.paymentMethod && <span className="text-emerald-400 font-black">💳 {b.paymentMethod}</span>}
                      </div>

                      {b.notes && (
                        <div className="bg-black/10 p-2.5 rounded-xl border border-white/5 text-[11px] text-gray-400 font-medium">
                          <span className="text-[#C1A68D] font-bold">ملاحظة الحجز:</span> {b.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-[#1A1816] border-t border-white/10 text-center flex-shrink-0">
          <button
            onClick={onClose}
            className="bg-[#2A2723] hover:bg-[#38332D] text-white text-xs font-black px-8 py-2.5 rounded-xl sm:rounded-2xl transition-all border border-white/10"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
}