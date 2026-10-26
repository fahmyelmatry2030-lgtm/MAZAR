"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { getFreshDbBookings, deleteDbBookingsByPhone, saveDbCustomerNote } from '@/lib/actions/db';
import { formatWhatsAppNumber, getCustomerProfileNote, formatDateDMY } from '@/lib/utils';
import {
  X, Search, Download, Phone, MessageSquare, Trash2,
  Star, Calendar, Home, TrendingUp, Clock, FileText,
  ChevronRight, Award, Users, Repeat, Sparkles, Shield,
  User, Hash, BookOpen
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CustomerRecord {
  name: string;
  phone: string;
  count: number;
  totalRevenue: number;
  totalNights: number;
  firstSeen: string;
  lastSeen: string;
  units: string[];
  hasDiscount: boolean;
  bookings: any[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DISCOUNT_KW = ['خصم', 'discount', 'تخفيض', 'وفر', 'بونص', 'free', 'هدية'];

function getBadge(c: CustomerRecord) {
  if (c.count >= 3) return { label: 'VIP', icon: '🏆', color: 'bg-amber-100 text-amber-700 border-amber-300' };
  if (c.count >= 2) return { label: 'متكرر', icon: '🔄', color: 'bg-blue-100 text-blue-700 border-blue-300' };
  return { label: 'جديد', icon: '✨', color: 'bg-green-100 text-green-700 border-green-300' };
}

function getAvatarColor(name: string) {
  const colors = [
    'bg-rose-100 text-rose-600',
    'bg-violet-100 text-violet-600',
    'bg-sky-100 text-sky-600',
    'bg-emerald-100 text-emerald-600',
    'bg-amber-100 text-amber-600',
    'bg-pink-100 text-pink-600',
    'bg-indigo-100 text-indigo-600',
    'bg-teal-100 text-teal-600',
  ];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}

function fmt(date: string) {
  if (!date) return '—';
  return formatDateDMY(date);
}

function fmtMoney(n: number) {
  return n.toLocaleString('ar-EG') + ' ج';
}

function statusColor(status: string) {
  if (status === 'approved' || status === 'confirmed') return 'bg-green-100 text-green-700';
  if (status === 'pending') return 'bg-yellow-100 text-yellow-700';
  if (status === 'cancelled' || status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function statusLabel(status: string) {
  if (status === 'approved' || status === 'confirmed') return 'مؤكد';
  if (status === 'pending' || status === 'رد جديد') return 'معلق';
  if (status === 'cancelled') return 'ملغي';
  if (status === 'rejected') return 'مرفوض';
  return status || '—';
}

// ─── Avatar gradient palettes ─────────────────────────────────────────────────
const GRADIENTS = [
  'from-rose-400 to-pink-600',
  'from-violet-400 to-purple-600',
  'from-sky-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-500',
  'from-fuchsia-400 to-pink-600',
  'from-indigo-400 to-violet-600',
  'from-cyan-400 to-sky-600',
];
function getGradient(name: string) {
  return GRADIENTS[(name?.charCodeAt(0) || 0) % GRADIENTS.length];
}

// ─── Customer Modal (Premium Centered) ───────────────────────────────────────
function CustomerModal({
  customer,
  onClose,
  onDelete,
  isDeleting
}: {
  customer: CustomerRecord | null;
  onClose: () => void;
  onDelete: (phone: string, name: string) => void;
  isDeleting: boolean;
}) {
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'notes' | 'units'>('history');

  useEffect(() => {
    if (customer?.phone) {
      setNote(getCustomerProfileNote(customer.phone));
    }
    setEditingNote(false);
    setActiveTab('history');
  }, [customer?.phone]);

  // 🔒 Lock body scroll when modal is open
  useEffect(() => {
    if (customer) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [customer]);


  const saveNote = async () => {
    if (customer?.phone) {
      const trimmed = note.trim();
      const p = customer.phone.trim();
      if (typeof window !== 'undefined') {
        if (trimmed) {
          localStorage.setItem(`customer_note_${p}`, trimmed);
        } else {
          localStorage.removeItem(`customer_note_${p}`);
        }
      }
      try {
        await saveDbCustomerNote(p, trimmed);
      } catch (e) {
        console.error('Failed to sync customer note to DB:', e);
      }
      window.dispatchEvent(new Event('customer_notes_updated'));
    }
    setEditingNote(false);
  };

  if (!customer) return null;

  const badge = getBadge(customer);
  const gradient = getGradient(customer.name);
  const cleanPhone = formatWhatsAppNumber(customer.phone);
  const avgAmount = customer.count > 0 ? Math.round(customer.totalRevenue / customer.count) : 0;

  const unitFreq: Record<string, number> = {};
  customer.bookings.forEach(b => { if (b.studio) unitFreq[b.studio] = (unitFreq[b.studio] || 0) + 1; });
  const favoriteUnit = Object.entries(unitFreq).sort((a, b) => b[1] - a[1])[0]?.[0];

  const STATS = [
    { label: 'إجمالي الإيراد', value: fmtMoney(customer.totalRevenue), icon: '💰', from: 'from-emerald-500', to: 'to-teal-600' },
    { label: 'عدد الحجوزات',   value: `${customer.count} مرة`,         icon: '📅', from: 'from-blue-500',    to: 'to-indigo-600' },
    { label: 'إجمالي الليالي', value: `${customer.totalNights} ليلة`,   icon: '🌙', from: 'from-violet-500',  to: 'to-purple-600' },
    { label: 'متوسط الحجز',    value: fmtMoney(avgAmount),              icon: '📊', from: 'from-amber-500',   to: 'to-orange-600' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        dir="rtl"
      >
        <div
          className="relative w-full max-w-2xl max-h-[92vh] bg-white rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col"
          style={{ animation: 'modalPop 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Gradient Hero Header ─────────────────────────────── */}
          <div className={`relative bg-gradient-to-br ${gradient} px-8 pt-10 pb-16 overflow-hidden flex-shrink-0`}>
            {/* Decorative circles */}
            <div className="absolute -top-10 -left-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-black/10 rounded-full blur-2xl" />

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 left-5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-all backdrop-blur-sm"
            >
              <X size={16} className="text-white" />
            </button>

            {/* Avatar + Name */}
            <div className="relative flex items-center gap-5">
              {/* Avatar ring */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-3xl bg-white/25 backdrop-blur-sm border-4 border-white/40 flex items-center justify-center shadow-xl">
                  <span className="text-4xl font-black text-white drop-shadow">
                    {customer.name?.substring(0, 1) || '?'}
                  </span>
                </div>
                {/* VIP crown */}
                {customer.count >= 3 && (
                  <div className="absolute -top-3 -right-3 text-xl animate-bounce">👑</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-black text-white drop-shadow-sm leading-tight mb-2">
                  {customer.name}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-white/25 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1 rounded-full border border-white/30">
                    {badge.icon} {badge.label}
                  </span>
                  {customer.hasDiscount && (
                    <span className="bg-white/25 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1 rounded-full border border-white/30">
                      💎 خصم سابق
                    </span>
                  )}
                  <span className="bg-white/25 backdrop-blur-sm text-white text-[10px] font-black px-3 py-1 rounded-full border border-white/30" dir="ltr">
                    📞 {customer.phone}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex gap-3 mt-6">
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-white text-emerald-600 font-black py-3 rounded-2xl text-sm hover:bg-emerald-50 transition-all shadow-lg"
              >
                <MessageSquare size={15} /> واتساب
              </a>
              <a
                href={`tel:${customer.phone}`}
                className="flex-1 flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm text-white font-black py-3 rounded-2xl text-sm hover:bg-white/30 transition-all border border-white/30"
              >
                <Phone size={15} /> اتصال
              </a>
            </div>
          </div>

          {/* ── Stats Cards (floating over header) ──────────────── */}
          <div className="px-6 -mt-8 flex-shrink-0 relative z-10">
            <div className="grid grid-cols-4 gap-3">
              {STATS.map((s, i) => (
                <div
                  key={i}
                  className={`bg-gradient-to-br ${s.from} ${s.to} rounded-2xl p-3 text-center shadow-lg`}
                  style={{ animation: `statPop 0.4s ${0.05 * i + 0.2}s both cubic-bezier(0.34,1.56,0.64,1)` }}
                >
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="text-white font-black text-xs leading-tight">{s.value}</div>
                  <div className="text-white/70 text-[8px] font-bold mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Timeline info row ───────────────────────────────── */}
          <div className="flex items-center gap-4 px-6 py-4 flex-shrink-0">
            <div className="flex-1 bg-[#FDFBF7] rounded-2xl px-4 py-3 border border-[#EAE4D9]/40 text-center">
              <div className="text-[9px] text-[#7A7061] font-bold opacity-70 mb-0.5">أول حجز</div>
              <div className="text-xs font-black text-[#2A2723]">{fmt(customer.firstSeen)}</div>
            </div>
            <div className="w-8 h-px bg-[#EAE4D9] flex-shrink-0" />
            {favoriteUnit && (
              <div className="flex-1 bg-amber-50 rounded-2xl px-4 py-3 border border-amber-200 text-center">
                <div className="text-[9px] text-amber-600 font-bold mb-0.5">الوحدة المفضلة</div>
                <div className="text-xs font-black text-amber-700 truncate">{favoriteUnit}</div>
              </div>
            )}
            <div className="w-8 h-px bg-[#EAE4D9] flex-shrink-0" />
            <div className="flex-1 bg-[#FDFBF7] rounded-2xl px-4 py-3 border border-[#EAE4D9]/40 text-center">
              <div className="text-[9px] text-[#7A7061] font-bold opacity-70 mb-0.5">آخر زيارة</div>
              <div className="text-xs font-black text-[#2A2723]">{fmt(customer.lastSeen)}</div>
            </div>
          </div>

          {/* ── Tabs ────────────────────────────────────────────── */}
          <div className="flex gap-1 px-6 pb-2 flex-shrink-0">
            {[
              { key: 'history', label: 'سجل الحجوزات', icon: BookOpen, count: customer.bookings.length },
              { key: 'notes',   label: 'ملاحظات',       icon: FileText,  count: null },
              { key: 'units',   label: 'الوحدات',        icon: Home,      count: customer.units.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                  activeTab === tab.key
                    ? 'bg-[#2A2723] text-white shadow-md'
                    : 'bg-[#F0EDE6] text-[#7A7061] hover:bg-[#E5DDD1]'
                }`}
              >
                <tab.icon size={12} />
                {tab.label}
                {tab.count !== null && (
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${activeTab === tab.key ? 'bg-white/20' : 'bg-white'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Scrollable Content ──────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-3 pt-2">
                {customer.bookings.length === 0 ? (
                  <div className="text-center py-16 text-[#7A7061] opacity-40">
                    <Calendar size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="font-black">لا توجد حجوزات مسجلة</p>
                  </div>
                ) : customer.bookings.map((b: any, i: number) => (
                  <div
                    key={b.id || i}
                    className="group bg-[#FDFBF7] hover:bg-white rounded-2xl border border-[#EAE4D9]/50 hover:border-[#C1A68D]/40 p-4 hover:shadow-md transition-all"
                    style={{ animation: `fadeSlideUp 0.3s ${i * 0.04}s both` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="w-7 h-7 rounded-xl bg-[#C1A68D]/15 flex items-center justify-center flex-shrink-0">
                            <Home size={12} className="text-[#C1A68D]" />
                          </div>
                          <span className="font-black text-[#2A2723] text-sm">{b.studio || 'وحدة غير محددة'}</span>
                          <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full ${statusColor(b.status)}`}>
                            {statusLabel(b.status)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#7A7061] font-bold pr-9">
                          <span dir="ltr">📅 {fmt(b.checkIn)} ← {fmt(b.checkOut)}</span>
                          {b.numberOfDays && <span className="bg-violet-50 text-violet-600 px-2 py-0.5 rounded-lg">🌙 {b.numberOfDays} ليلة</span>}
                          {b.guestsCount  && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg">👥 {b.guestsCount} أشخاص</span>}
                        </div>
                        {b.notes && (
                          <p className="text-[10px] text-[#7A7061] bg-white rounded-xl px-3 py-2 border border-[#EAE4D9]/40 leading-relaxed pr-9">
                            📝 {b.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-black text-[#2A2723]">{fmtMoney(b.totalAmount || 0)}</div>
                        {b.paidAmount && Number(b.paidAmount) !== Number(b.totalAmount) && (
                          <div className="text-[9px] text-emerald-600 font-bold">مدفوع: {fmtMoney(b.paidAmount)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="pt-2 space-y-4">
                <div className="bg-[#FDFBF7] rounded-2xl border border-[#EAE4D9]/50 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-[#2A2723] flex items-center gap-2">
                      <FileText size={15} className="text-[#C1A68D]" />
                      ملاحظات خاصة
                    </h3>
                    {!editingNote && (
                      <button
                        onClick={() => setEditingNote(true)}
                        className="text-[10px] font-black text-[#C1A68D] border border-[#C1A68D]/30 px-3 py-1.5 rounded-xl hover:bg-[#C1A68D]/10 transition-all"
                      >
                        ✏️ تعديل
                      </button>
                    )}
                  </div>
                  {editingNote ? (
                    <div className="space-y-3">
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={6}
                        placeholder="مثلاً: عميل محترم، يفضل الغرف الهادئة، سبق وحصل على خصم 10%..."
                        className="w-full border border-[#EAE4D9] rounded-2xl p-4 text-sm font-bold text-[#2A2723] focus:border-[#C1A68D] outline-none resize-none leading-relaxed bg-white"
                        dir="rtl"
                      />
                      <div className="flex gap-2">
                        <button onClick={saveNote} className="bg-[#2A2723] text-white font-black px-6 py-2.5 rounded-xl text-xs hover:bg-black transition-all flex-1">✅ حفظ الملاحظة</button>
                        <button onClick={() => setEditingNote(false)} className="bg-[#F0EDE6] text-[#7A7061] font-black px-5 py-2.5 rounded-xl text-xs hover:bg-[#E5DDD1] transition-all">إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`text-sm leading-relaxed rounded-xl p-4 ${note ? 'bg-white border border-[#EAE4D9]/50 text-[#2A2723] font-bold' : 'text-[#7A7061] opacity-50 font-bold'}`}>
                      {note || '💬 لا توجد ملاحظات بعد — اضغط تعديل لإضافة ملاحظة عن هذا العميل.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Units Tab */}
            {activeTab === 'units' && (
              <div className="pt-2 space-y-3">
                {customer.units.length === 0 ? (
                  <div className="text-center py-16 text-[#7A7061] opacity-40">
                    <Home size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="font-black">لا توجد وحدات مسجلة</p>
                  </div>
                ) : Object.entries(unitFreq).sort((a, b) => b[1] - a[1]).map(([unit, freq], i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-[#FDFBF7] rounded-2xl px-5 py-4 border border-[#EAE4D9]/50 hover:border-[#C1A68D]/30 transition-all"
                    style={{ animation: `fadeSlideUp 0.3s ${i * 0.05}s both` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#C1A68D]/15 flex items-center justify-center">
                        <Home size={16} className="text-[#C1A68D]" />
                      </div>
                      <div>
                        <div className="font-black text-[#2A2723]">{unit}</div>
                        {i === 0 && <div className="text-[9px] text-amber-600 font-black">⭐ الأكثر حجزاً</div>}
                      </div>
                    </div>
                    <span className="bg-[#2A2723] text-white font-black text-xs px-3 py-1.5 rounded-full">
                      {freq} {freq > 1 ? 'مرات' : 'مرة'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer Delete ────────────────────────────────────── */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-[#EAE4D9]/30">
            <button
              onClick={() => onDelete(customer.phone, customer.name)}
              disabled={isDeleting}
              className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 font-black py-3 rounded-2xl text-sm transition-all disabled:opacity-30"
            >
              <Trash2 size={14} />
              {isDeleting ? 'جاري الحذف...' : 'حذف هذا العميل نهائياً'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.88) translateY(24px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes statPop {
          from { opacity: 0; transform: scale(0.7) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomersDatabase() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [adminRole, setAdminRole] = useState<string>('Admin');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'vip' | 'repeat' | 'new' | 'discount'>('all');

  useEffect(() => {
    const info = sessionStorage.getItem('adminInfo');
    if (info) setAdminRole(JSON.parse(info)?.role || 'Admin');
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    let data = await getFreshDbBookings(Date.now().toString());
    const currentRole = typeof window !== 'undefined'
      ? (JSON.parse(sessionStorage.getItem('adminInfo') || '{}')?.role || adminRole)
      : adminRole;
    if (currentRole === 'Akoura' || currentRole === 'Partner') {
      data = data.filter((b: any) => String(b.apartmentId).startsWith('p-s') || String(b.apartmentId).startsWith('apt-') || !b.apartmentId);
    } else if (currentRole === 'Mohsen') {
      data = data.filter((b: any) => !String(b.apartmentId).startsWith('p-s') && !String(b.apartmentId).startsWith('apt-'));
    }
    setBookings(data);
    setIsLoading(false);
  }, [adminRole]);

  useEffect(() => { loadData(); }, [loadData]);

  const customers = useMemo<CustomerRecord[]>(() => {
    const map = new Map<string, CustomerRecord>();
    bookings.forEach(b => {
      const phone = b.phone?.trim();
      if (!phone) return;
      const hasDiscount = b.notes && DISCOUNT_KW.some(kw => String(b.notes).toLowerCase().includes(kw));
      const existing = map.get(phone);
      if (existing) {
        existing.count += 1;
        existing.totalRevenue += Number(b.totalAmount) || 0;
        existing.totalNights += Number(b.numberOfDays) || 0;
        if (hasDiscount) existing.hasDiscount = true;
        const t = new Date(b.timestamp || b.checkIn || 0).getTime();
        if (t > new Date(existing.lastSeen).getTime()) { existing.lastSeen = b.timestamp || b.checkIn; existing.name = b.name; }
        if (t < new Date(existing.firstSeen).getTime()) existing.firstSeen = b.timestamp || b.checkIn;
        if (b.studio && !existing.units.includes(b.studio)) existing.units.push(b.studio);
        existing.bookings.push(b);
      } else {
        map.set(phone, {
          name: b.name,
          phone,
          count: 1,
          totalRevenue: Number(b.totalAmount) || 0,
          totalNights: Number(b.numberOfDays) || 0,
          firstSeen: b.timestamp || b.checkIn || '',
          lastSeen: b.timestamp || b.checkIn || '',
          hasDiscount: !!hasDiscount,
          units: b.studio ? [b.studio] : [],
          bookings: [b],
        });
      }
    });
    return Array.from(map.values())
      .map(c => ({ ...c, bookings: c.bookings.sort((a, b) => new Date(b.checkIn || 0).getTime() - new Date(a.checkIn || 0).getTime()) }))
      .sort((a, b) => b.count - a.count);
  }, [bookings]);

  // Summary counts
  const counts = useMemo(() => ({
    all: customers.length,
    vip: customers.filter(c => c.count >= 3).length,
    repeat: customers.filter(c => c.count === 2).length,
    new: customers.filter(c => c.count === 1).length,
    discount: customers.filter(c => c.hasDiscount).length,
  }), [customers]);

  const filtered = useMemo(() => {
    let list = customers;
    if (activeFilter === 'vip') list = list.filter(c => c.count >= 3);
    else if (activeFilter === 'repeat') list = list.filter(c => c.count === 2);
    else if (activeFilter === 'new') list = list.filter(c => c.count === 1);
    else if (activeFilter === 'discount') list = list.filter(c => c.hasDiscount);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(c => c.name?.toLowerCase().includes(s) || c.phone?.includes(searchTerm));
    }
    return list;
  }, [customers, activeFilter, searchTerm]);

  const handleDelete = async (phone: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف العميل "${name}"؟ سيتم حذف كافة سجلات حجوزاته نهائياً.`)) return;
    setIsDeleting(true);
    try {
      const { deleteDbBookingsByPhone } = await import('@/lib/actions/db');
      await deleteDbBookingsByPhone(phone);
      setSelectedCustomer(null);
      await loadData();
    } catch {
      alert('فشل الحذف. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['الاسم', 'الهاتف', 'عدد الحجوزات', 'إجمالي الإيراد', 'إجمالي الليالي', 'أول حجز', 'آخر زيارة', 'خصم سابق'];
    const rows = filtered.map(c => [
      c.name, c.phone, c.count, c.totalRevenue, c.totalNights,
      fmt(c.firstSeen), fmt(c.lastSeen), c.hasDiscount ? 'نعم' : 'لا'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Mazar_Customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.style.visibility = 'hidden'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const FILTERS = [
    { key: 'all', label: 'الكل', icon: Users, count: counts.all },
    { key: 'vip', label: 'VIP', icon: Award, count: counts.vip },
    { key: 'repeat', label: 'متكرر', icon: Repeat, count: counts.repeat },
    { key: 'new', label: 'جديد', icon: Sparkles, count: counts.new },
    { key: 'discount', label: 'خصم سابق', icon: Shield, count: counts.discount },
  ];

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* ── Header ── */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black mb-2 text-[#2A2723]">
            قاعدة <span className="text-[#C1A68D]">العملاء</span>
          </h1>
          <p className="text-[#7A7061] font-bold opacity-70 text-sm">
            {isLoading ? 'جاري التحميل...' : `${counts.all} عميل • ${bookings.length} حجز إجمالي`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-80">
            <input
              type="text"
              placeholder="بحث بالاسم أو الرقم..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#EAE4D9]/50 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm focus:border-[#C1A68D] transition-all outline-none"
            />
            <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#7A7061] opacity-30" />
          </div>
          <button
            onClick={exportToCSV}
            className="bg-[#2A2723] text-white font-black px-8 py-4 rounded-2xl hover:bg-black transition-all text-sm shadow-xl shadow-black/10 flex items-center justify-center gap-3"
          >
            <Download size={15} /> تصدير CSV
          </button>
        </div>
      </header>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all border ${
              activeFilter === f.key
                ? 'bg-[#2A2723] text-white border-[#2A2723] shadow-lg'
                : 'bg-white text-[#7A7061] border-[#EAE4D9]/50 hover:border-[#C1A68D] hover:text-[#2A2723]'
            }`}
          >
            <f.icon size={13} />
            {f.label}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
              activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-[#F0EDE6] text-[#7A7061]'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Customer Cards Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-[#EAE4D9]/50 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#EAE4D9]/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#EAE4D9]/50 rounded-full w-3/4" />
                  <div className="h-3 bg-[#EAE4D9]/30 rounded-full w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-[#EAE4D9]/30 rounded-full" />
                <div className="h-3 bg-[#EAE4D9]/20 rounded-full w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-[#7A7061] opacity-40">
          <User size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-black text-lg">لا يوجد عملاء يطابقون البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const badge = getBadge(c);
            const avatarColor = getAvatarColor(c.name);
            return (
              <button
                key={c.phone}
                onClick={() => setSelectedCustomer(c)}
                className="bg-white rounded-3xl p-6 border border-[#EAE4D9]/50 shadow-sm hover:shadow-xl hover:border-[#C1A68D]/40 transition-all text-right group"
              >
                {/* Card Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-2xl ${avatarColor} flex items-center justify-center text-xl font-black flex-shrink-0`}>
                    {c.name?.substring(0, 1) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-[#2A2723] text-sm leading-tight truncate">{c.name || 'عميل'}</div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${badge.color}`}>
                        {badge.icon} {badge.label}
                      </span>
                      {c.hasDiscount && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-300">
                          💎 خصم
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-[#C1A68D] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-[#FDFBF7] rounded-xl p-2.5 text-center border border-[#EAE4D9]/30">
                    <div className="text-sm font-black text-[#2A2723]">{c.count}</div>
                    <div className="text-[8px] text-[#7A7061] opacity-70 font-bold">حجوزات</div>
                  </div>
                  <div className="bg-[#FDFBF7] rounded-xl p-2.5 text-center border border-[#EAE4D9]/30">
                    <div className="text-sm font-black text-[#2A2723]">{c.totalNights}</div>
                    <div className="text-[8px] text-[#7A7061] opacity-70 font-bold">ليلة</div>
                  </div>
                  <div className="bg-[#FDFBF7] rounded-xl p-2.5 text-center border border-[#EAE4D9]/30">
                    <div className="text-[10px] font-black text-emerald-600">{(c.totalRevenue / 1000).toFixed(1)}k</div>
                    <div className="text-[8px] text-[#7A7061] opacity-70 font-bold">إيراد</div>
                  </div>
                </div>

                {/* Phone & Last Seen */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-[#7A7061] font-bold" dir="ltr">
                    <Phone size={10} className="flex-shrink-0" />
                    <span className="truncate">{c.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#7A7061] font-bold">
                    <Clock size={10} className="flex-shrink-0" />
                    <span>آخر زيارة: {fmt(c.lastSeen)}</span>
                  </div>
                  {c.units.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px] text-[#7A7061] font-bold">
                      <Home size={10} className="flex-shrink-0" />
                      <span className="truncate">{c.units.slice(0, 2).join('، ')}{c.units.length > 2 ? ` +${c.units.length - 2}` : ''}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Customer Modal ── */}
      <CustomerModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </div>

  );
}
