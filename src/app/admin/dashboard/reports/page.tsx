"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getFreshDbBookings,
  getDbUnits,
  updateDbBookingStatus,
  saveDbBooking,
  deleteDbBooking
} from '@/lib/actions/db';
import { Pencil, Trash2, Plus, Wallet, CreditCard, Banknote, Sparkles } from 'lucide-react';
import ExpensesTab from './ExpensesTab';
import FinancialSummaryTab from './FinancialSummaryTab';
import CustomerProfileModal from '@/components/CustomerProfileModal';

type PaymentSplitItem = {
  method: string;
  amount: number | string;
};

const parsePaymentSplitsFromString = (raw: string, fallbackTotal: number = 0): PaymentSplitItem[] => {
  if (!raw || !raw.trim()) {
    return [{ method: 'كاش', amount: fallbackTotal > 0 ? fallbackTotal : '' }];
  }
  const clean = raw.trim();
  const parts = clean.split(/[|+\n،,]+/).map(p => p.trim()).filter(Boolean);
  const parsed: PaymentSplitItem[] = [];

  for (const part of parts) {
    const colonMatch = part.match(/^(.*?)\s*[:=]\s*(\d+(?:\.\d+)?)/);
    if (colonMatch) {
      let m = colonMatch[1].replace(/ج\.?م|جنيه/g, '').trim();
      let a = parseFloat(colonMatch[2]) || '';
      parsed.push({ method: m || 'كاش', amount: a });
      continue;
    }

    const revMatch = part.match(/^(\d+(?:\.\d+)?)\s*(?:ج\.?م|جنيه)?\s*(.*)$/);
    if (revMatch && revMatch[2].trim()) {
      let a = parseFloat(revMatch[1]) || '';
      let m = revMatch[2].trim() || 'كاش';
      parsed.push({ method: m, amount: a });
      continue;
    }

    if (part) {
      parsed.push({ method: part, amount: fallbackTotal > 0 && parsed.length === 0 ? fallbackTotal : '' });
    }
  }

  return parsed.length > 0 ? parsed : [{ method: 'كاش', amount: fallbackTotal > 0 ? fallbackTotal : '' }];
};

// Units will be fetched dynamically from the database
const LAYOUT_VERSION = 'v2.0.0'; // Auto-increment this to force-clear client caches

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const formatDate = (dateStr: any) => {
  if (typeof dateStr !== 'string') return '';
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

const parseDate = (displayStr: any) => {
  if (typeof displayStr !== 'string') return '';
  if (!displayStr || !displayStr.includes('/')) return displayStr;
  const [d, m, y] = displayStr.split('/');
  if (y && m && d) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return displayStr;
};

// Editable cell component
function EditableCell({
  value,
  bookingId,
  field,
  onSave,
  type = 'text',
  className = '',
  readOnly = false,
}: {
  value: string | number;
  bookingId: string;
  field: string;
  onSave: (id: string, field: string, value: any) => void;
  type?: 'text' | 'number';
  className?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ ALL hooks must be called before any early return (React Rules of Hooks)
  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (readOnly) {
    return <div className={`px-2 py-3 ${className}`}>{value || '—'}</div>;
  }

  const handleSave = async () => {
    setEditing(false);
    const newVal = type === 'number' ? Number(editValue) || 0 : editValue;
    if (String(newVal) !== String(value)) {
      setSaving(true);
      await onSave(bookingId, field, newVal);
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="relative w-full">
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          className="w-full bg-yellow-50 border-2 border-[#C1A68D] rounded px-2 py-1 text-[11px] font-black text-[#2A2723] outline-none text-center shadow-inner"
          style={{ minWidth: '60px' }}
        />
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] opacity-30 animate-pulse">💾</div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`group cursor-text hover:bg-white/50 px-2 py-1.5 rounded-lg transition-all block w-full min-h-[32px] relative ${saving ? 'opacity-50 animate-pulse' : ''} ${className}`}
      title="اضغط للتعديل"
    >
      <div className="flex items-center justify-center gap-1">
        <span>{value || <span className="text-[#EAE4D9]">—</span>}</span>
        <span className="opacity-0 group-hover:opacity-40 text-[10px] transition-opacity">✏️</span>
      </div>
    </div>
  );
}

const AdminDatePicker = ({ label, value, onChange, icon, color }: any) => {
  const [defaultParts, setDefaultParts] = useState<string[]>(['', '', '']);
  useEffect(() => {
    setDefaultParts([new Date().getFullYear().toString(), (new Date().getMonth() + 1).toString().padStart(2, '0'), new Date().getDate().toString().padStart(2, '0')]);
  }, []);
  const parts = value ? value.split('-') : defaultParts;
  const year = parts[0] || '';
  const month = parts[1] || '';
  const day = parts[2] || '';

  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const days = Array.from({ length: daysInMonth || 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const years = [new Date().getFullYear().toString(), (new Date().getFullYear() + 1).toString(), (new Date().getFullYear() - 1).toString()];

  const update = (y: string, m: string, d: string) => {
    const max = new Date(Number(y), Number(m), 0).getDate();
    const safeD = Number(d) > max ? max.toString().padStart(2, '0') : d;
    onChange(`${y}-${m}-${safeD}`);
  };

  return (
    <div className={`bg-white p-3 md:p-4 rounded-[20px] border border-[#EAE4D9]/50 shadow-sm relative overflow-visible ${color === 'red' ? 'shadow-red-500/5' : 'shadow-[#C1A68D]/5'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg md:text-xl">{icon}</span>
        <h3 className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${color === 'red' ? 'text-[#E63946]' : 'text-[#C1A68D]'}`}>{label}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1 text-center">
          <label className="block text-[8px] font-bold text-gray-400 uppercase">اليوم</label>
          <div className="relative">
            <select value={day} onChange={e => update(year, month, e.target.value)} className="w-full bg-[#F7F5F0] border border-transparent focus:border-[#C1A68D] rounded-xl p-2 text-xs font-black appearance-none text-center outline-none cursor-pointer">
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] opacity-30 pointer-events-none">▼</span>
          </div>
        </div>
        <div className="space-y-1 text-center">
          <label className="block text-[8px] font-bold text-gray-400 uppercase">الشهر</label>
          <div className="relative">
            <select value={month} onChange={e => update(year, e.target.value, day)} className="w-full bg-[#F7F5F0] border border-transparent focus:border-[#C1A68D] rounded-xl p-2 text-xs font-black appearance-none text-center outline-none cursor-pointer">
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] opacity-30 pointer-events-none">▼</span>
          </div>
        </div>
        <div className="space-y-1 text-center">
          <label className="block text-[8px] font-bold text-gray-400 uppercase">السنة</label>
          <div className="relative">
            <select value={year} onChange={e => update(e.target.value, month, day)} className="w-full bg-[#F7F5F0] border border-transparent focus:border-[#C1A68D] rounded-xl p-2 text-xs font-black appearance-none text-center outline-none cursor-pointer">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] opacity-30 pointer-events-none">▼</span>
          </div>
        </div>
      </div>
    </div>
  );
};

function ReportsContent() {
  const searchParams = useSearchParams();
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  
  // Initialize from URL params if available, otherwise default
  const [selectedUnit, setSelectedUnit] = useState<string>(searchParams.get('unit') || '');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const m = searchParams.get('month');
    return m ? parseInt(m, 10) : -1;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const y = searchParams.get('year');
    return y ? parseInt(y, 10) : -1;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitItem[]>([
    { method: 'كاش', amount: '' },
  ]);
  const [activeTab, setActiveTab] = useState<'operational' | 'expenses'>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'operational' || tab === 'expenses') return tab;
    return searchParams.get('unit') ? 'operational' : 'expenses';
  });

  const [profileModal, setProfileModal] = useState<{ isOpen: boolean; name: string | null; phone?: string | null }>({
    isOpen: false,
    name: null,
    phone: null,
  });

  // URL PARAM SYNC (for dynamic updates without full reload)
  useEffect(() => {
    const unitParam = searchParams.get('unit');
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const tabParam = searchParams.get('tab');
    const checkInParam = searchParams.get('checkIn');
    const checkOutParam = searchParams.get('checkOut');

    if (unitParam) setSelectedUnit(unitParam);
    if (monthParam) setSelectedMonth(parseInt(monthParam, 10));
    if (yearParam) setSelectedYear(parseInt(yearParam, 10));
    if (tabParam) setActiveTab(tabParam as any);
    
    if (checkInParam || checkOutParam) {
      setNewRecord(prev => ({
        ...prev,
        checkIn: checkInParam || prev.checkIn,
        checkOut: checkOutParam || prev.checkOut
      }));
    }
  }, [searchParams]);

  // AUTO-RESET LOGIC: Clears stale localStorage once per version update
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const lastVersion = localStorage.getItem('mazar_layout_version');
      if (lastVersion !== LAYOUT_VERSION) {
        console.log(`[VERSION-UPDATE] Migrating from ${lastVersion} to ${LAYOUT_VERSION}. Clearing cache...`);
        localStorage.clear();
        localStorage.setItem('mazar_layout_version', LAYOUT_VERSION);
        window.location.reload();
      }
    }
  }, []);

  // Initialize month/year on client-side only to avoid hydration mismatch
  useEffect(() => {
    if (selectedMonth === -1) setSelectedMonth(new Date().getMonth());
    if (selectedYear === -1) setSelectedYear(new Date().getFullYear());
  }, [selectedMonth, selectedYear]);

  const monthStr = String(selectedMonth + 1).padStart(2, '0');
  const safeDateStr = `${selectedYear}-${monthStr}-01`;

  const [newRecord, setNewRecord] = useState({
    name: '',
    nationality: '',
    idNumber: '',
    phone: '',
    checkIn: '',
    checkOut: '',
    pricePerNight: 0,
    commission: 0,
    clientStatus: 'انتظار',
    brokerName: '',
    bookingManager: '',
    paymentMethod: '',
    notes: ''
  });

  // 🔮 Smart Accommodation Assistant States
  const [smartAssistantOpen, setSmartAssistantOpen] = useState(false);
  const [smartCheckIn, setSmartCheckIn] = useState('');
  const [smartCheckOut, setSmartCheckOut] = useState('');
  const [smartCategory, setSmartCategory] = useState('all');
  const [smartSuggestions, setSmartSuggestions] = useState<any[]>([]);
  const [hasSearchedSmart, setHasSearchedSmart] = useState(false);
  const [conflictDays, setConflictDays] = useState<string[]>([]);

  const printRef = useRef<HTMLDivElement>(null);

  // Update checkIn/Out safely if month/year changes
  // Update checkIn/Out safely if month/year changes (only if not passed via URL parameters)
  useEffect(() => {
    if (selectedMonth === -1 || selectedYear === -1) return;
    const urlCheckIn = searchParams.get('checkIn');
    const urlCheckOut = searchParams.get('checkOut');
    if (urlCheckIn || urlCheckOut) return; // Skip default month initialization if URL params are present

    const sStr = String(selectedMonth + 1).padStart(2, '0');
    const safeStr = `${selectedYear}-${sStr}-01`;
    setNewRecord(prev => ({ ...prev, checkIn: safeStr, checkOut: safeStr }));
  }, [selectedMonth, selectedYear, searchParams]);

  const [adminRole, setAdminRole] = useState<string>('Super Admin');

  useEffect(() => {
    const info = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminInfo') || '{}') : {};
    if (info?.role) setAdminRole(info.role);
  }, []);

  const isAkoura = adminRole === 'Akoura';

  const selectedUnitRef = useRef(selectedUnit);
  selectedUnitRef.current = selectedUnit;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [b, u] = await Promise.all([getFreshDbBookings(), getDbUnits()]);
      let safeUnits = (u || []).filter((unit: any) => unit && unit.id);
      
      // Filter for Akoura (only show Mazar 3 units)
      if (typeof window !== 'undefined') {
        const info = JSON.parse(sessionStorage.getItem('adminInfo') || '{}');
        if (info?.role === 'Akoura') {
          safeUnits = safeUnits.filter((unit: any) => unit.branch === 3);
        }
      }
      
      const getUnitCategory = (unitId: string, currentType: string) => {
        if (unitId.startsWith('apt-')) return 'apartment';
        if (unitId.startsWith('p-s')) return 'apartment';
        const mapping: { [key: string]: string } = {
          'b1-s1': 'double', 'b1-s2': 'single', 'b1-s3': 'single', 'b1-s4': 'triple', 'b1-s5': 'double',
          'b1-s6': 'single', 'b1-s7': 'single', 'b1-s8': 'single', 'b1-s9': 'double', 'b1-s10': 'double',
          'b1-s11': 'double', 'b1-s12': 'double',
          'b2-s1': 'double', 'b2-s2': 'triple', 'b2-s3': 'triple', 'b2-s4': 'triple', 'b2-s5': 'single',
          'b2-s6': 'double', 'b2-s7': 'triple', 'b2-s8': 'double', 'b2-s9': 'triple', 'b2-s10': 'triple',
          'b2-s11': 'triple', 'b2-s12': 'double',
        };
        return mapping[unitId] || currentType || 'single';
      };

      const mappedUnits = safeUnits.map((unit: any) => ({
        ...unit,
        category: getUnitCategory(unit.id, unit.type)
      }));

      setBookings(b || []);
      setUnits(mappedUnits);
      
      // Only set default unit if none is selected AND none in URL
      if (!selectedUnitRef.current && !searchParams.get('unit') && safeUnits.length > 0) {
        // If Akoura, default to p-s25 (first branch 3 unit)
        const isUserAkoura = typeof window !== 'undefined' && JSON.parse(sessionStorage.getItem('adminInfo') || '{}')?.role === 'Akoura';
        if (isUserAkoura) {
          const firstM3 = safeUnits.find((unit: any) => String(unit.id).startsWith('p-s'));
          setSelectedUnit((firstM3 || safeUnits[0]).id);
        } else {
          const firstStudio = safeUnits.find((unit: any) =>
            String(unit.id).startsWith('b1-s') || String(unit.id).startsWith('b2-s')
          );
          setSelectedUnit((firstStudio || safeUnits[0]).id);
        }
      }
    } catch (error) {
      console.error('Error loading reports data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCellSave = async (bookingId: string, field: string, value: any) => {
    try {
      setSaveStatus('جاري الحفظ...');

      const currentBooking = bookings.find(b => b.id === bookingId);
      if (!currentBooking) return;

      let finalValue = value;
      if (field === 'checkIn' || field === 'checkOut') {
        finalValue = parseDate(value);
      }

      const updates: any = { [field]: finalValue };

      // Auto-calculate dependencies
      if (['checkIn', 'checkOut', 'pricePerNight', 'totalAmount'].includes(field)) {
        const cIn = field === 'checkIn' ? finalValue : currentBooking.checkIn;
        const cOut = field === 'checkOut' ? finalValue : currentBooking.checkOut;

        let pNight = field === 'pricePerNight' ? (parseFloat(value) || 0) : currentBooking.pricePerNight;
        let totalAmt = field === 'totalAmount' ? (parseFloat(value) || 0) : currentBooking.totalAmount;

        if (cIn && cOut) {
          const dIn = new Date(cIn);
          const dOut = new Date(cOut);
          const diff = Math.ceil((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24));
          const nights = diff > 0 ? diff : 0;

          updates.numberOfDays = nights;

          if (field === 'checkIn' || field === 'checkOut' || field === 'pricePerNight') {
            // Price per night or dates changed -> recalculate total
            updates.totalAmount = nights * pNight;
          } else if (field === 'totalAmount' && nights > 0) {
            // Total changed -> recalculate price per night
            updates.pricePerNight = totalAmt / nights;
          }

          // Overlap check on edit
          if (nights > 0 && (field === 'checkIn' || field === 'checkOut')) {
            const hasOverlap = bookings.some(b => {
              if (b.id === bookingId || b.status === 'deleted' || b.apartmentId !== currentBooking.apartmentId) return false;
              if (b.status !== 'approved' && b.status !== 'مؤكد') return false;
              const bIn = new Date(b.checkIn).getTime();
              const bOut = new Date(b.checkOut).getTime();
              const nIn = new Date(cIn).getTime();
              const nOut = new Date(cOut).getTime();
              return nIn < bOut && nOut > bIn;
            });
            if (hasOverlap && !confirm("⚠️ تنبيه: التواريخ الجديدة تتداخل مع حجز موجود بالفعل لهذا الاستوديو. هل تريد الاستمرار؟")) {
              return;
            }
          }
        }
      }

      // Removed manual discount logic

      const freshData = await updateDbBookingStatus(bookingId, updates);

      // Update local state WITH THE FRESH DATA RETURNED FROM SERVER
      if (freshData && Array.isArray(freshData)) {
        setBookings(freshData);
      }

      setSaveStatus('✅ تم الحفظ');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('❌ فشل الحفظ');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const openEditModal = (fullBooking: any) => {
    setEditingBooking({ ...fullBooking });
    const initialSplits = parsePaymentSplitsFromString(
      fullBooking.paymentMethod,
      fullBooking.paidAmount !== undefined ? fullBooking.paidAmount : fullBooking.totalAmount
    );
    setPaymentSplits(initialSplits);
    setIsEditModalOpen(true);
  };

  const handleAddPaymentSplit = () => {
    const currentTotal = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const bookingTotal = Number(editingBooking?.totalAmount || 0);
    const remaining = Math.max(0, bookingTotal - currentTotal);
    setPaymentSplits(prev => [
      ...prev,
      { method: 'فيزا', amount: remaining > 0 ? remaining : '' }
    ]);
  };

  const handleRemovePaymentSplit = (idx: number) => {
    if (paymentSplits.length <= 1) {
      setPaymentSplits([{ method: 'كاش', amount: '' }]);
      return;
    }
    setPaymentSplits(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdatePaymentSplit = (idx: number, field: 'method' | 'amount', val: any) => {
    setPaymentSplits(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleFillRemainingSplit = () => {
    const currentTotal = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const bookingTotal = Number(editingBooking?.totalAmount || 0);
    const remaining = Math.max(0, bookingTotal - currentTotal);
    if (remaining > 0) {
      setPaymentSplits(prev => [
        ...prev,
        { method: 'فيزا', amount: remaining }
      ]);
    }
  };

  const handleFullUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;

    try {
      setSaveStatus('جاري حفظ التعديلات...');

      // Process payment splits
      const validSplits = paymentSplits.filter(s => s.method && s.amount !== '' && !isNaN(Number(s.amount)));
      const totalSplits = validSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const bookingTotal = Number(editingBooking.totalAmount || 0);

      const formattedPaymentMethod = validSplits.length > 0
        ? validSplits.map(s => `${s.method}: ${s.amount} ج.م`).join(' | ')
        : (editingBooking.paymentMethod || 'كاش');

      let finalPaid = totalSplits > 0 ? totalSplits : (editingBooking.paidAmount ?? bookingTotal);
      let finalRemaining = Math.max(0, bookingTotal - finalPaid);
      let finalStatus = finalRemaining === 0 ? 'خالص' : 'باقي';

      // Respect explicit user status if splits didn't specify amounts
      if (editingBooking.paymentStatus && validSplits.length === 0) {
        finalStatus = editingBooking.paymentStatus;
        if (finalStatus === 'خالص') {
          finalPaid = bookingTotal;
          finalRemaining = 0;
        }
      }

      let existingNotes = String(editingBooking.notes || '')
        .replace(/\[مدفوع:[^\]]*\]/g, '')
        .replace(/\[متبقي:[^\]]*\]/g, '')
        .replace(/\[باقي:[^\]]*\]/g, '')
        .replace(/\[طريقة:[^\]]*\]/g, '')
        .replace(/\[طريقة الدفع:[^\]]*\]/g, '')
        .trim();
      const tags = `[مدفوع: ${finalPaid}] [متبقي: ${finalRemaining}] [طريقة: ${formattedPaymentMethod}]`;
      const finalNotes = existingNotes ? `${existingNotes} ${tags}` : tags;

      const payload = {
        ...editingBooking,
        paymentMethod: formattedPaymentMethod,
        paidAmount: finalPaid,
        remainingAmount: finalRemaining,
        paymentStatus: finalStatus,
        paymentInfo: finalStatus,
        notes: finalNotes,
      };

      const freshData = await updateDbBookingStatus(editingBooking.id, payload);
      if (freshData && Array.isArray(freshData)) {
        setBookings(freshData);
      }
      setIsEditModalOpen(false);
      setEditingBooking(null);
      setSaveStatus('✅ تم تحديث كافة البيانات وحفظ طرق الدفع بالخزنة');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('❌ فشل تحديث البيانات');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('⚠️ هل أنت متأكد من مسح هذا الحجز نهائياً من قاعدة البيانات؟')) return;

    try {
      setSaveStatus('جاري المسح...');
      const freshData = await deleteDbBooking(id);

      if (freshData && Array.isArray(freshData)) {
        setBookings(freshData);
      }

      setSaveStatus('✅ تم المسح بنجاح');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Delete failed:', err);
      setSaveStatus('❌ فشل المسح');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // 🔮 Smart Booking Assistant Algorithm
  const handleSmartSearch = () => {
    if (!smartCheckIn || !smartCheckOut) {
      alert('يرجى تحديد تاريخ الدخول وتاريخ الخروج أولاً.');
      return;
    }
    if (new Date(smartCheckIn) >= new Date(smartCheckOut)) {
      alert('تاريخ الخروج يجب أن يكون بعد تاريخ الدخول.');
      return;
    }

    setHasSearchedSmart(true);

    const checkInDate = new Date(smartCheckIn);
    const checkOutDate = new Date(smartCheckOut);
    const totalNights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Filter units matching category
    let targetUnits = units;
    if (smartCategory !== 'all') {
      targetUnits = units.filter((u: any) => u.category === smartCategory);
    }

    const suggestionsList: any[] = [];

    // 1. Find Fully Available Units
    targetUnits.forEach((unit: any) => {
      // Find all bookings for this unit to check gaps and overlap
      const unitBookings = bookings.filter((b: any) => {
        if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected') return false;
        const bUnitId = b.apartmentId || b.studio;
        return bUnitId === unit.id;
      });

      const overlaps = unitBookings.filter((b: any) => {
        return (b.checkIn < smartCheckOut) && (b.checkOut > smartCheckIn);
      });

      if (overlaps.length === 0) {
        // Find previous booking (closest ending on or before smartCheckIn)
        const prevBooking = unitBookings
          .filter((b: any) => b.checkOut <= smartCheckIn)
          .sort((a: any, b: any) => b.checkOut.localeCompare(a.checkOut))[0];
        
        // Find next booking (closest starting on or after smartCheckOut)
        const nextBooking = unitBookings
          .filter((b: any) => b.checkIn >= smartCheckOut)
          .sort((a: any, b: any) => a.checkIn.localeCompare(b.checkIn))[0];

        const gapBefore = prevBooking 
          ? Math.round((new Date(smartCheckIn).getTime() - new Date(prevBooking.checkOut).getTime()) / (1000 * 60 * 60 * 24))
          : 99;

        const gapAfter = nextBooking
          ? Math.round((new Date(nextBooking.checkIn).getTime() - new Date(smartCheckOut).getTime()) / (1000 * 60 * 60 * 24))
          : 99;

        // Gap score (lower is better, 0 is perfect)
        const score = gapBefore + gapAfter;

        let efficiencyLabel = '';
        if (gapBefore === 0 && gapAfter === 0) {
          efficiencyLabel = ' (مثالي! يسد الفجوة بالكامل 🌟)';
        } else if (gapBefore === 0 || gapAfter === 0) {
          efficiencyLabel = ` (ممتاز! متصل بحجز آخر ➔)`;
        } else if (gapBefore < 99 || gapAfter < 99) {
          efficiencyLabel = ` (فجوة: ${gapBefore < 99 ? gapBefore + ' يوم قبل' : ''} ${gapAfter < 99 ? gapAfter + ' يوم بعد' : ''})`;
        }

        suggestionsList.push({
          type: 'full',
          unit,
          score,
          gapBefore,
          gapAfter,
          label: `${unit.title?.ar || unit.id} (${unit.category === 'single' ? 'سنجل' : unit.category === 'double' ? 'دبل' : unit.category === 'triple' ? 'تريبل' : unit.category === 'two-room' ? 'غرفتين' : 'شقة'})${efficiencyLabel}`
        });
      }
    });

    // Sort full suggestions by gap score (ascending: closest fit first to fill gaps)
    suggestionsList.sort((a, b) => a.score - b.score);

    // 2. If no unit is fully available, suggest split-stays!
    if (suggestionsList.length === 0 && totalNights >= 2) {
      // Check every split point (e.g. splitting after 'splitNights' nights)
      for (let splitNights = 1; splitNights < totalNights; splitNights++) {
        const splitDate = new Date(checkInDate);
        splitDate.setDate(checkInDate.getDate() + splitNights);
        const splitDateStr = splitDate.toISOString().split('T')[0];

        // Part 1: [smartCheckIn, splitDateStr)
        const part1Available = targetUnits.filter((unit: any) => {
          return !bookings.some((b: any) => {
            if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected') return false;
            const bUnitId = b.apartmentId || b.studio;
            return bUnitId === unit.id && (b.checkIn < splitDateStr) && (b.checkOut > smartCheckIn);
          });
        });

        // Part 2: [splitDateStr, smartCheckOut)
        const part2Available = targetUnits.filter((unit: any) => {
          return !bookings.some((b: any) => {
            if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected') return false;
            const bUnitId = b.apartmentId || b.studio;
            return bUnitId === unit.id && (b.checkIn < smartCheckOut) && (b.checkOut > splitDateStr);
          });
        });

        if (part1Available.length > 0 && part2Available.length > 0) {
          const u1 = part1Available[0];
          const u2 = part2Available[0];
          
          suggestionsList.push({
            type: 'split',
            u1,
            u2,
            splitDateStr,
            splitNights,
            totalNights,
            label: `تسكين مجزأ: الاستوديو (${u1.title?.ar || u1.id}) لمدة ${splitNights} ليالي، ثم الانتقال للاستوديو (${u2.title?.ar || u2.id}) لمدة ${totalNights - splitNights} ليالي.`
          });
          
          if (suggestionsList.length >= 2) break;
        }
      }
    }

    // 3. If still no suggestions, find the specific "problem days" where ALL units are fully booked
    const problemDays: string[] = [];
    if (suggestionsList.length === 0) {
      const cursor = new Date(checkInDate);
      while (cursor < checkOutDate) {
        const dayStr = cursor.toISOString().split('T')[0];
        const nextDay = new Date(cursor);
        nextDay.setDate(cursor.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        const anyFree = targetUnits.some((unit: any) => {
          return !bookings.some((b: any) => {
            if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected') return false;
            const bUnitId = b.apartmentId || b.studio;
            return bUnitId === unit.id && (b.checkIn < nextDayStr) && (b.checkOut > dayStr);
          });
        });

        if (!anyFree) problemDays.push(dayStr);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    setConflictDays(problemDays);
    setSmartSuggestions(suggestionsList);
  };

  const applyFullSuggestion = (unitId: string) => {
    setSelectedUnit(unitId);
    setNewRecord(prev => ({
      ...prev,
      checkIn: smartCheckIn,
      checkOut: smartCheckOut
    }));
    setSmartAssistantOpen(false);
    
    // Smooth scroll to form
    const formEl = document.getElementById('add-record-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const applySplitPart = (unitId: string, checkIn: string, checkOut: string) => {
    setSelectedUnit(unitId);
    setNewRecord(prev => ({
      ...prev,
      checkIn,
      checkOut
    }));
    
    const formEl = document.getElementById('add-record-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSaveNewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedUnit) return alert('الرجاء اختيار وحدة أولاً');
      if (!newRecord.name) return alert('الرجاء إدخال اسم العميل');

      setSaveStatus('جاري الحفظ...');

      const checkInStr = newRecord.checkIn || new Date().toISOString().split('T')[0];
      const checkOutStr = newRecord.checkOut || checkInStr;

      const inDate = new Date(checkInStr);
      const outDate = new Date(checkOutStr);
      const diff = Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
      const nights = diff > 0 ? diff : 0;

      if (nights <= 0) {
        setSaveStatus('');
        return alert('تنبيه: يجب أن يكون تاريخ الخروج بعد تاريخ الدخول (على الأقل ليلة واحدة)');
      }

      const totalAmount = nights * newRecord.pricePerNight;

      // Overlap check for new record
      if (nights > 0) {
        const hasOverlap = bookings.some(b => {
          if (b.status === 'deleted' || b.apartmentId !== selectedUnit) return false;
          const isApproved = b.status === 'approved' || b.status === 'مؤكد';
          if (!isApproved) return false;

          const bIn = new Date(b.checkIn).getTime();
          const bOut = new Date(b.checkOut).getTime();
          const nIn = inDate.getTime();
          const nOut = outDate.getTime();

          return nIn < bOut && nOut > bIn;
        });

        if (hasOverlap && !confirm("⚠️ تنبيه: يوجد حجز آخر بالفعل في هذه التواريخ لهذا الاستوديو. هل تريد المتابعة وإضافة هذا الحجز أيضاً؟")) {
          setSaveStatus('');
          return;
        }
      }

      const newBooking = {
        name: newRecord.name,
        nationality: newRecord.nationality,
        idNumber: newRecord.idNumber,
        phone: newRecord.phone,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        apartmentId: selectedUnit,
        studio: units.find((u: any) => u.id === selectedUnit)?.title?.ar || selectedUnit,
        status: 'approved',
        paymentInfo: 'حجز يدوي من التقارير',
        totalAmount,
        numberOfDays: nights,
        pricePerNight: newRecord.pricePerNight,
        commission: newRecord.commission,
        brokerName: newRecord.brokerName,
        clientStatus: newRecord.clientStatus || 'انتظار',
        bookingManager: (newRecord as any).bookingManager || '',
        paymentMethod: (newRecord as any).paymentMethod || '',
        notes: newRecord.notes
      };

      const result = await saveDbBooking(newBooking);

      if (result.success) {
        // Update local state WITH THE FRESH DATA RETURNED FROM SERVER
        if (result.data && Array.isArray(result.data)) {
          setBookings(result.data);
        } else {
          await loadData();
        }

        // Reset form
        const resetStr = String(selectedMonth + 1).padStart(2, '0');
        const sDateStr = `${selectedYear}-${resetStr}-01`;
        setNewRecord({
          name: '',
          nationality: '',
          idNumber: '',
          phone: '',
          checkIn: sDateStr,
          checkOut: sDateStr,
          pricePerNight: 0,
          commission: 0,
          clientStatus: 'انتظار',
          brokerName: '',
          bookingManager: '',
          paymentMethod: '',
          notes: ''
        } as any);
        setSaveStatus('✅ تمت إضافة السجل للجدول');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus(`❌ فشل: ${result.error}`);
        // Keep status message longer if it's an error
        setTimeout(() => setSaveStatus(''), 10000);
      }
    } catch (err: any) {
      console.error(err);
      setSaveStatus(`❌ فشل غير متوقع: ${err.message || ''}`);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // Filter bookings for selected unit + month/year (supports cross-month)
  const filteredBookings = bookings.map((b: any) => {
    if (selectedMonth === -1 || selectedYear === -1) return { ...b, matches: false };
    
    const partsIn = b.checkIn?.split('-');
    const partsOut = b.checkOut?.split('-');
    if (!partsIn || partsIn.length < 2 || !partsOut || partsOut.length < 2) return { ...b, matches: false };
    
    const checkInYear = parseInt(partsIn[0], 10);
    const checkInMonth = parseInt(partsIn[1], 10) - 1; // 0-indexed
    const checkOutYear = parseInt(partsOut[0], 10);
    const checkOutMonth = parseInt(partsOut[1], 10) - 1; // 0-indexed
    
    const inVal = checkInYear * 12 + checkInMonth;
    const outVal = checkOutYear * 12 + checkOutMonth;
    const selVal = selectedYear * 12 + selectedMonth;
    
    const isCarriedOver = selVal > inVal;
    const matches = selVal >= inVal && selVal <= outVal;
    
    return { ...b, isCarriedOver, matches };
  }).filter((b: any) => {
    if (!b.matches) return false;
    if (b.status === 'deleted') return false;
    const isApproved = b.status === 'approved' || b.status === 'مؤكد';
    if (!isApproved) return false;
    if (b.apartmentId !== selectedUnit) return false;
    return true;
  });

  // Get unit price
  const currentUnit = units.find((u: any) => u.id === selectedUnit);
  const unitPrice = currentUnit?.price ? parseInt(currentUnit.price.toString().replace(/[^0-9]/g, '')) || 0 : 0;

  // Calculate totals with strict numeric safety
  const safeNum = (v: any) => {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const clean = String(v).replace(/[^0-9.-]/g, '');
    const n = Number(clean);
    return isNaN(n) ? 0 : n;
  };

  const totals = filteredBookings.reduce(
    (acc: any, b: any) => {
      if (b.isCarriedOver) return acc;

      const days = safeNum(b.numberOfDays);
      const total = safeNum(b.totalAmount);
      const commission = safeNum(b.commission);
      const netValue = total - commission;

      return {
        days: safeNum(acc.days) + days,
        total: safeNum(acc.total) + total,
        commission: safeNum(acc.commission) + commission,
        netValue: safeNum(acc.netValue) + netValue,
      };
    },
    { days: 0, total: 0, commission: 0, netValue: 0 }
  );

  // Build row data
  const dataRows = filteredBookings.map((booking: any, i: number) => {
    const days = booking.numberOfDays || 0;


    let pricePerNight = unitPrice;
    if (days > 0 && booking.totalAmount !== undefined && booking.totalAmount !== null) {
      pricePerNight = booking.totalAmount / days;
    }

    const total = booking.totalAmount || (days * pricePerNight);
    const commission = booking.commission || 0;
    const netValue = total - commission;

    // Manual Status takes precedence if it's not the default 'انتظار' or if it was manually changed
    let rawStatus = String(booking.clientStatus || 'انتظار').trim();
    let clientStatus = rawStatus;

    // Only apply automatic transitions if the status is currently 'انتظار' أو 'متواجد'
    if (booking.checkIn && booking.checkOut) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;
      const currentHour = now.getHours(); // 0 to 23

      const checkInStr = String(booking.checkIn || '').trim();
      const checkOutStr = String(booking.checkOut || '').trim();

      // If we haven't manually changed it to something else, or if it's still 'انتظار'
      if (rawStatus === 'انتظار' || !rawStatus) {
        // Checkout at 12 PM (hour 12)
        if (todayStr > checkOutStr || (todayStr === checkOutStr && currentHour >= 12)) {
          clientStatus = 'غادر';
        }
        // Checkin at 2 PM (hour 14)
        else if (todayStr > checkInStr || (todayStr === checkInStr && currentHour >= 14)) {
          clientStatus = 'متواجد';
        }
      }
      // If it's 'متواجد', auto-move to 'غادر' if checkout passed (after 12 PM on checkout day)
      else if (rawStatus === 'متواجد') {
        if (todayStr > checkOutStr || (todayStr === checkOutStr && currentHour >= 12)) {
          clientStatus = 'غادر';
        }
      }
    }

    return {
      no: i + 1,
      id: booking.id,
      date: booking.checkIn,
      name: booking.name,
      nationality: booking.nationality || '',
      idNumber: booking.idNumber || '',
      phone: booking.phone,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      days,
      pricePerNight,
      total,
      commission,
      brokerName: booking.brokerName || '',
      netValue,
      clientStatus,
      bookingManager: (() => {
        if (booking.bookingManager && booking.bookingManager.trim() !== '' && booking.bookingManager !== booking.name && booking.bookingManager !== booking.guest) {
          return booking.bookingManager;
        }
        const match = String(booking.notes || '').match(/\[اعتماد:\s*([^\]]+)\]/i);
        if (match && match[1]) return match[1].trim();
        return 'قائد الشيفت';
      })(),
      paymentMethod: booking.paymentMethod || '',
      paymentStatus: (() => {
        const noteStr = String(booking.notes || '').trim().toLowerCase();
        const infoStr = String(booking.paymentInfo || '').trim().toLowerCase();
        const combined = `${noteStr} ${infoStr}`;

        const cleanKeywords = ['حساب خالص', 'الحساب خالص', 'خالص', 'تم الدفع', 'تم السداد', 'مدفوع بالكامل'];
        const isExplicitlyClean = cleanKeywords.some(kw => combined.includes(kw));

        const debtKeywords = ['متبقي', 'باقي', 'باقى', 'علية', 'عليها', 'دين', 'مستحق', 'آجل', 'اجل', 'عقد'];
        const hasNumbers = /\d+/.test(noteStr);
        const hasDebtKeyword = debtKeywords.some(kw => combined.includes(kw));

        if (!isExplicitlyClean && (hasDebtKeyword || hasNumbers)) {
          return 'باقي';
        }
        if (isExplicitlyClean) {
          return 'خالص';
        }
        if (booking.paymentStatus === 'باقي') return 'باقي';
        return 'خالص';
      })(),
      notes: typeof booking.notes === 'string' ? booking.notes.replace(/خصم بقيمة \d+/, '').trim() : '',
      isCarriedOver: booking.isCarriedOver,
      hasData: true,
    };
  });

  // Sort dataRows by check-in date: OLD (Oldest) at TOP, NEW (Newest) at BOTTOM
  const sortedDataRows = [...dataRows].sort((a, b) => {
    // String comparison works perfectly for YYYY-MM-DD
    if (a.checkIn !== b.checkIn) {
      return (a.checkIn || '').localeCompare(b.checkIn || '');
    }
    // Secondary sort: earlier bookings first if same day
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  // Re-assign 'no' after sorting
  const renumberedRows = sortedDataRows.map((r, i) => ({ ...r, no: i + 1 }));

  // Fill empty rows to always show 31
  const emptyRowsCount = Math.max(0, 31 - renumberedRows.length);
  const emptyRows = Array.from({ length: emptyRowsCount }, (_, i) => ({
    no: renumberedRows.length + i + 1,
    id: '', date: '', name: '', nationality: '', idNumber: '', phone: '',
    checkIn: '', checkOut: '', days: 0, pricePerNight: 0, total: 0,
    commission: 0, brokerName: '', netValue: 0, clientStatus: '',
    bookingManager: '', paymentMethod: '', paymentStatus: 'خالص', notes: '', isCarriedOver: false, hasData: false,
  }));

  const allRows = [...renumberedRows, ...emptyRows];

  // Export CSV
  const exportCSV = () => {
    const unitLabel = units.find(u => u.id === selectedUnit)?.title?.ar || selectedUnit;
    const header = ['No', 'Date', 'Name', 'Nationality', 'ID Number', 'Phone Number', 'Check In', 'Check Out', 'No. of Days', 'Price Per Night', 'Total', 'Payment Status', 'Client Status', 'Commission', 'Broker Name', 'Net Value', 'Notes'];

    const csvRows = dataRows.map(r => [
      r.no, r.date, r.name, r.nationality, r.idNumber, r.phone,
      r.checkIn, r.checkOut, r.days, r.pricePerNight, r.total,
      r.paymentStatus === 'باقي' ? 'باقي فلوس (❌)' : 'خالص (✔️)',
      r.clientStatus, r.commission, r.brokerName, r.netValue, r.notes,
    ].join(','));

    csvRows.push(['', '', '', '', '', '', '', '', totals.days, '', totals.total, '', totals.commission, '', totals.netValue, ''].join(','));

    const csvContent = '\uFEFF' + [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_${unitLabel}_${MONTHS_AR[selectedMonth]}_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => { window.print(); };

  const selectedUnitInfo = units.find(u => u.id === selectedUnit);
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 10mm;
            font-size: 9px;
          }
          .no-print { display: none !important; }
          .print-area table { border-collapse: collapse; width: 100%; }
          .print-area th, .print-area td {
            border: 1px solid #333 !important;
            padding: 4px 6px !important;
            font-size: 9px !important;
            background: white !important;
            color: #000 !important;
          }
          .print-area th {
            background: #eee !important;
            font-weight: 900 !important;
          }
          .print-header { display: block !important; text-align: center; margin-bottom: 10mm; }
          .print-header h2 { font-size: 16px; font-weight: 900; margin: 0 0 4px 0; }
          .print-header p { font-size: 11px; margin: 0; color: #555; }
        }
        @media screen {
          .print-header { display: none; }
          .custom-scrollbar-horizontal::-webkit-scrollbar {
            height: 10px;
          }
          .custom-scrollbar-horizontal::-webkit-scrollbar-track {
            background: #FDFBF7;
            border-radius: 10px;
          }
          .custom-scrollbar-horizontal::-webkit-scrollbar-thumb {
            background: #C1A68D;
            border-radius: 10px;
            border: 2px solid #FDFBF7;
          }
          .custom-scrollbar-horizontal::-webkit-scrollbar-thumb:hover {
            background: #2A2723;
          }
        }
      `}</style>

      <div className="space-y-8 animate-fade-in relative z-0">
        {/* Tab Navigation */}
        <div className="no-print bg-[#2A2723] p-2 rounded-[2rem] flex gap-2 w-full max-w-3xl mx-auto shadow-2xl border border-white/5 overflow-x-auto scrollbar-hide" dir="rtl">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 px-6 py-4 rounded-2xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'expenses' ? 'bg-[#C1A68D] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            💸 إدارة المصروفات
          </button>
          <button
            onClick={() => setActiveTab('operational')}
            className={`flex-1 px-6 py-4 rounded-2xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${activeTab === 'operational' ? 'bg-[#C1A68D] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            📋 جدول الحجوزات التشغيلي
          </button>
        </div>

        {activeTab === 'expenses' && (
          <ExpensesTab />
        )}



        {activeTab === 'operational' && (
          <>
            {/* Header */}
            <header className="no-print flex justify-between items-center flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-4xl font-black text-[#2A2723]">تقارير <span className="text-[#C1A68D]">الوحدات</span></h1>
                  <span className="text-[10px] font-black text-[#C1A68D] bg-[#FDFBF7] border border-[#EAE4D9]/50 px-2.5 py-1 rounded-full uppercase tracking-widest shadow-sm">
                    {LAYOUT_VERSION} {isLoading ? 'SYNCING...' : 'SYNCED'}
                  </span>
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border shadow-sm ${bookings.some(b => String(b.id).startsWith('L-')) ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                    {bookings.some(b => String(b.id).startsWith('L-')) ? '⚠️ LOCAL MODE (OFFLINE)' : '✅ DB MODE (ONLINE)'}
                  </span>
                </div>
                <p className="text-[#7A7061] font-bold opacity-70 text-sm">جدول حجوزات شهري لكل وحدة — اضغط على أي خلية لتعديلها مباشرة.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (confirm("⚠️ سيتم مسح الذاكرة المؤقتة للمتصفح بالكامل وإعادة التحميل من قاعدة البيانات لضمان المزامنة بنسبة 100%. هل أنت متأكد؟")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border border-red-100 shadow-md active:scale-95"
                >
                  🔄 حل مشكلة المزامنة (مسح شامل)
                </button>
                {saveStatus && (
                  <div className="bg-white border border-[#EAE4D9] px-4 py-2 rounded-xl text-[10px] font-black text-[#C1A68D] animate-scale-in shadow-sm">
                    {saveStatus}
                  </div>
                )}
              </div>
            </header>

            {/* Filters Bar */}
            <div className="no-print bg-white p-6 rounded-[2rem] border border-[#EAE4D9]/50 shadow-sm flex flex-wrap items-center gap-4" dir="rtl">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest opacity-60">الشهر:</span>
                <select
                  title="اختر الشهر"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="bg-[#FDFBF7] border border-[#EAE4D9]/60 rounded-xl px-4 py-2.5 text-sm text-[#2A2723] font-black outline-none focus:border-[#C1A68D] transition-all cursor-pointer"
                >
                  {MONTHS_AR.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest opacity-60">السنة:</span>
                <select
                  title="اختر السنة"
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-[#FDFBF7] border border-[#EAE4D9]/60 rounded-xl px-4 py-2.5 text-sm text-[#2A2723] font-black outline-none focus:border-[#C1A68D] transition-all cursor-pointer"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1" />

              <button
                onClick={exportCSV}
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
              >
                <span>📥</span> تصدير CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-[#2A2723] text-white px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-black transition-all shadow-lg shadow-black/10"
              >
                <span>🖨️</span> طباعة
              </button>
            </div>

            {/* ADD MANUAL RECORD INLINE FORM */}
            <div className="no-print bg-white p-6 rounded-[2rem] border border-[#EAE4D9]/50 shadow-sm" dir="rtl">
              <form id="add-record-form" onSubmit={handleSaveNewRecord} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-9 gap-3">
                  <div className="space-y-1 col-span-2 xl:col-span-2">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">الاسم</label>
                    <datalist id="past-customers">
                      {Array.from(new Set(bookings.filter(b => b.name).map(b => b.name.trim()))).map((name, idx) => (
                        <option key={idx} value={name} />
                      ))}
                    </datalist>
                    <input 
                      type="text" 
                      required 
                      list="past-customers"
                      value={newRecord.name} 
                      onChange={e => {
                        const enteredName = e.target.value;
                        setNewRecord(prev => {
                          let updates: any = { name: enteredName };
                          if (enteredName.trim().length > 2) {
                            const pastBooking = bookings.find(b => b.name && b.name.trim() === enteredName.trim());
                            if (pastBooking) {
                              updates = {
                                ...updates,
                                nationality: prev.nationality || pastBooking.nationality || '',
                                idNumber: prev.idNumber || pastBooking.idNumber || '',
                                phone: prev.phone || pastBooking.phone || '',
                              };
                            }
                          }
                          return { ...prev, ...updates };
                        });
                      }} 
                      className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#C1A68D]" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">الجنسية</label>
                    <input type="text" value={newRecord.nationality} onChange={e => setNewRecord({ ...newRecord, nationality: e.target.value })} className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#C1A68D]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">رقم الهوية</label>
                    <input type="text" value={newRecord.idNumber} onChange={e => setNewRecord({ ...newRecord, idNumber: e.target.value })} className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#C1A68D]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">الهاتف</label>
                    <input type="text" value={newRecord.phone} onChange={e => setNewRecord({ ...newRecord, phone: e.target.value })} className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#C1A68D]" />
                  </div>
                  <div className="col-span-2 xl:col-span-2 space-y-1">
                    <AdminDatePicker
                      label="تاريخ الدخول"
                      value={newRecord.checkIn}
                      onChange={(v: string) => setNewRecord({ ...newRecord, checkIn: v })}
                      icon="🛬"
                      color="gold"
                    />
                  </div>
                  <div className="col-span-2 xl:col-span-2 space-y-1">
                    <AdminDatePicker
                      label="تاريخ الخروج"
                      value={newRecord.checkOut}
                      onChange={(v: string) => setNewRecord({ ...newRecord, checkOut: v })}
                      icon="🛫"
                      color="red"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">سعر الليلة</label>
                    <input type="number" required value={newRecord.pricePerNight} onChange={e => setNewRecord({ ...newRecord, pricePerNight: Number(e.target.value) })} className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-black outline-none focus:border-[#C1A68D]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">العمولة</label>
                    <input type="number" value={newRecord.commission} onChange={e => setNewRecord({ ...newRecord, commission: Number(e.target.value) })} className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-black text-orange-500 outline-none focus:border-[#C1A68D]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">الوحدة</label>
                    <select
                      required
                      value={selectedUnit}
                      onChange={e => setSelectedUnit(e.target.value)}
                      className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-black text-[#2A2723] outline-none focus:border-[#C1A68D]"
                    >
                      <option value="" disabled>اختر الوحدة</option>
                      <optgroup label="الاستديوهات الفندقية">
                        {units.filter(u => u && u.id && (u.type === 'studio' || String(u.id).startsWith('b1-s') || String(u.id).startsWith('b2-s') || String(u.id).startsWith('p-s'))).sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true })).map(u => (
                          <option key={u.id} value={u.id}>{u.title?.ar || u.id}</option>
                        ))}
                      </optgroup>
                      {!isAkoura && (
                      <optgroup label="الشقق الفندقية">
                        {units.filter(u => u && u.id && u.type === 'apartment').sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true })).map(u => (
                          <option key={u.id} value={u.id}>{u.title?.ar || u.id}</option>
                        ))}
                      </optgroup>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">حالة العميل</label>
                    <select value={(newRecord as any).clientStatus || 'انتظار'} onChange={e => setNewRecord({ ...newRecord, clientStatus: e.target.value } as any)} className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-black text-[#2A2723] outline-none focus:border-[#C1A68D]">
                      <option value="انتظار">انتظار</option>
                      <option value="متواجد">متواجد</option>
                      <option value="غادر">غادر</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">مسئول الحجز</label>
                    <input type="text" value={(newRecord as any).bookingManager || ''} onChange={e => setNewRecord({ ...newRecord, bookingManager: e.target.value } as any)} placeholder="اسم المسئول" className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#C1A68D]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-[#C1A68D] uppercase px-2">طريقة الدفع</label>
                    <input type="text" value={(newRecord as any).paymentMethod || ''} onChange={e => setNewRecord({ ...newRecord, paymentMethod: e.target.value } as any)} placeholder="طريقة الدفع" className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#C1A68D]" />
                  </div>
                </div>

                <div className="flex justify-end mt-2">
                  <button type="submit" className="h-[40px] px-10 bg-[#2A2723] text-white font-black rounded-xl hover:bg-black transition-all text-sm whitespace-nowrap shadow-lg">إضافة للجدول</button>
                </div>
              </form>
            </div>

            {/* Unit Tabs */}
            <div className="no-print bg-white p-4 rounded-[2rem] border border-[#EAE4D9]/50 shadow-sm space-y-4" dir="rtl">
              {/* Color Legend */}
              <div className="flex items-center gap-4 px-3 pb-2 border-b border-[#EAE4D9]/40">
                <span className="text-[9px] font-black text-[#7A7061] uppercase tracking-wider">دليل الألوان:</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /><span className="text-[9px] font-black text-blue-700">جميع الاستديوهات الفندقية</span></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#C1A68D] inline-block" /><span className="text-[9px] font-black text-[#C1A68D]">الشقق الفندقية</span></span>
              </div>
              <div>
              {!isAkoura && (
              <div>
                <div className="text-[9px] font-black text-[#C1A68D] uppercase tracking-[0.25em] px-3 mb-2">الاستديوهات الفندقية — المبنى الأول (1-12)</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {units
                    .filter(u => u && u.id && String(u.id).startsWith('b1-s'))
                    .sort((a, b) => {
                      const getNum = (u: any) => parseInt(String(u.id || '').replace('b1-s', ''), 10) || 99;
                      return getNum(a) - getNum(b);
                    })
                    .map(u => {
                      const isActive = selectedUnit === u.id;
                      return (
                        <button key={u.id} onClick={() => setSelectedUnit(u.id)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                          }`}>
                          {u.title?.ar || u.id}
                        </button>
                      );
                    })}
                </div>
                <div className="text-[9px] font-black text-[#C1A68D] uppercase tracking-[0.25em] px-3 mb-2">الاستديوهات الفندقية — المبنى الثاني (13-24)</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {units
                    .filter(u => u && u.id && String(u.id).startsWith('b2-s'))
                    .sort((a, b) => {
                      const getNum = (u: any) => parseInt(String(u.id || '').replace('b2-s', ''), 10) || 99;
                      return getNum(a) - getNum(b);
                    })
                    .map(u => {
                      const isActive = selectedUnit === u.id;
                      return (
                        <button key={u.id} onClick={() => setSelectedUnit(u.id)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                          }`}>
                          {u.title?.ar || u.id}
                        </button>
                      );
                    })}
                </div>
              </div>
              )}
              
              <div>
                <div className="text-[9px] font-black text-[#C1A68D] uppercase tracking-[0.25em] px-3 mb-2">الاستديوهات الفندقية — مزار 3 (25-30)</div>
                <div className="flex flex-wrap gap-1.5">
                  {units
                    .filter(u => u && u.id && String(u.id).startsWith('p-s'))
                    .sort((a, b) => {
                      const getNum = (u: any) => parseInt(String(u.id || '').replace('p-s', ''), 10) || 99;
                      return getNum(a) - getNum(b);
                    })
                    .map(u => {
                      const isActive = selectedUnit === u.id;
                      return (
                        <button key={u.id} onClick={() => setSelectedUnit(u.id)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all ${
                            isActive
                              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                              : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                          }`}>
                          {u.title?.ar || u.id}
                        </button>
                      );
                    })}
                </div>
              </div>

              {!isAkoura && (
              <div>
                <div className="text-[9px] font-black text-[#C1A68D] uppercase tracking-[0.25em] px-3 mb-2">الشقق الفندقية</div>
                <div className="flex flex-wrap gap-1.5">
                  {units.filter(u => u && u.id && u.type === 'apartment' && !String(u.id).startsWith('p-s')).map(u => (
                    <button key={u.id} onClick={() => setSelectedUnit(u.id)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all ${selectedUnit === u.id
                          ? 'bg-[#C1A68D] text-white shadow-lg shadow-[#C1A68D]/20'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                        }`}>
                      {u.title?.ar || u.id}
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>
            </div>

            {/* 🔮 Smart Booking Assistant Widget */}
            <div className="no-print bg-gradient-to-br from-[#2A2723] to-[#1E1B18] p-6 rounded-[2rem] border-2 border-[#C1A68D]/40 shadow-xl text-white space-y-4" dir="rtl">
              <button
                type="button"
                onClick={() => setSmartAssistantOpen(!smartAssistantOpen)}
                className="w-full flex items-center justify-between text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#C1A68D]/20 border border-[#C1A68D]/40 flex items-center justify-center text-[#C1A68D]">
                    <span className="text-xl">🔮</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">مساعد التسكين الذكي واقتراح الغرف</h3>
                    <p className="text-[10px] text-[#C1A68D] font-bold">ابحث عن الغرف المتاحة أو اقتراحات تقسيم الإقامة لفترة محددة.</p>
                  </div>
                </div>
                <span className="text-[#C1A68D] font-black text-sm">{smartAssistantOpen ? 'إغلاق المساعد ▲' : 'فتح المساعد المساعد ▼'}</span>
              </button>

              {smartAssistantOpen && (
                <div className="pt-4 border-t border-white/10 space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[#C1A68D] uppercase px-1">تاريخ الدخول</label>
                      <input
                        type="date"
                        value={smartCheckIn}
                        onChange={e => setSmartCheckIn(e.target.value)}
                        className="w-full bg-[#1E1B18] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-[#C1A68D]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[#C1A68D] uppercase px-1">تاريخ الخروج</label>
                      <input
                        type="date"
                        value={smartCheckOut}
                        onChange={e => setSmartCheckOut(e.target.value)}
                        className="w-full bg-[#1E1B18] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-[#C1A68D]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[#C1A68D] uppercase px-1">نوع الغرفة المطلوب</label>
                      <select
                        value={smartCategory}
                        onChange={e => setSmartCategory(e.target.value)}
                        className="w-full bg-[#1E1B18] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-[#C1A68D] outline-none"
                      >
                        <option value="all">الكل</option>
                        <option value="single">سنجل (Single)</option>
                        <option value="double">دبل (Double)</option>
                        <option value="triple">تريبل (Triple)</option>
                        <option value="two-room">غرفتين (Double Room)</option>
                        <option value="apartment">شقق (Apartment)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSmartSearch}
                      className="bg-[#C1A68D] hover:bg-[#d5baa0] text-[#1E1B18] font-black px-8 py-3 rounded-xl text-xs transition-all shadow-md flex items-center gap-2"
                    >
                      🔍 ابحث عن المقترحات المتاحة
                    </button>
                  </div>

                  {hasSearchedSmart && (
                    <div className="space-y-3 pt-4 border-t border-white/10">
                      <h4 className="text-xs font-black text-[#C1A68D] uppercase tracking-wider">💡 مقترحات التسكين المتاحة:</h4>
                      
                      {smartSuggestions.length === 0 ? (
                        <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-3">
                          <p className="text-xs text-gray-400 font-bold text-center">
                            ⚠️ لا توجد غرف متاحة لهذه الفترة. يرجى تعديل التواريخ أو الفئة.
                          </p>
                          {conflictDays.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black text-red-400 text-center uppercase tracking-wider">🔴 الأيام المشكلة (كل الغرف محجوزة فيها):</p>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {conflictDays.map(day => (
                                  <span key={day} className="bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-black px-3 py-1.5 rounded-full">
                                    🔴 {new Date(day + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'long' })}
                                  </span>
                                ))}
                              </div>
                              <p className="text-[10px] text-gray-500 font-bold text-center">يجب تعديل التواريخ لتتجنب هذه الأيام، أو مراجعة الحجوزات الموجودة.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {smartSuggestions.map((s, idx) => (
                            <div
                              key={idx}
                              className={`p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                                s.type === 'full' ? 'bg-green-500/5 border-green-500/30' : 'bg-amber-500/5 border-amber-500/30'
                              }`}
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                    s.type === 'full' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                                  }`}>
                                    {s.type === 'full' ? 'متاح بالكامل 🟢' : 'خطة تسكين مجزأ 🔀'}
                                  </span>
                                  <span className="font-bold text-xs text-white">
                                    {s.type === 'full'
                                      ? `${s.unit.title?.ar || s.unit.id} (${s.unit.category === 'single' ? 'سنجل' : s.unit.category === 'double' ? 'دبل' : s.unit.category === 'triple' ? 'تريبل' : s.unit.category === 'two-room' ? 'غرفتين' : 'شقة'})`
                                      : s.label}
                                  </span>
                                </div>
                                {s.type === 'split' && (
                                  <p className="text-[10px] text-gray-400 font-bold">
                                    💡 ستحتاج لتسجيل حجزين منفصلين للعميل لكي تكتمل الفترة المطلوبة.
                                  </p>
                                )}
                              </div>

                              {s.type === 'full' ? (
                                <button
                                  type="button"
                                  onClick={() => applyFullSuggestion(s.unit.id)}
                                  className="bg-green-600 hover:bg-green-500 text-white font-black px-4 py-2 rounded-xl text-[10px] transition-all flex items-center gap-1.5 shrink-0 self-stretch md:self-auto text-center justify-center"
                                >
                                  تطبيق وتسكين مباشر 📝
                                </button>
                              ) : (
                                <div className="flex gap-2 w-full md:w-auto">
                                  <button
                                    type="button"
                                    onClick={() => applySplitPart(s.u1.id, smartCheckIn, s.splitDateStr)}
                                    className="flex-1 md:flex-none bg-amber-600 hover:bg-amber-500 text-white font-black px-3 py-2 rounded-xl text-[10px] transition-all"
                                  >
                                    تعبئة الجزء الأول 📝
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => applySplitPart(s.u2.id, s.splitDateStr, smartCheckOut)}
                                    className="flex-1 md:flex-none bg-[#C1A68D] hover:bg-[#d5baa0] text-[#1E1B18] font-black px-3 py-2 rounded-xl text-[10px] transition-all"
                                  >
                                    تعبئة الجزء الثاني 📝
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Summary Cards */}
            <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-4" dir="rtl">
              <div className="bg-white p-6 rounded-[1.5rem] border border-[#EAE4D9]/50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#C1A68D]/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-[#C1A68D]/10 transition-colors" />
                <div className="text-[#7A7061] text-[9px] font-black mb-2 tracking-[0.15em] uppercase opacity-60">عدد الحجوزات</div>
                <div className="text-3xl font-black text-[#2A2723]">{filteredBookings.length}</div>
              </div>
              <div className="bg-white p-6 rounded-[1.5rem] border border-[#EAE4D9]/50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-green-500/10 transition-colors" />
                <div className="text-[#7A7061] text-[9px] font-black mb-2 tracking-[0.15em] uppercase opacity-60">إجمالي الإيرادات</div>
                <div className="text-3xl font-black text-green-600">{totals.total.toLocaleString()} <small className="text-xs font-bold text-green-400">ج.م</small></div>
              </div>
              <div className="bg-white p-6 rounded-[1.5rem] border border-[#EAE4D9]/50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-orange-500/10 transition-colors" />
                <div className="text-[#7A7061] text-[9px] font-black mb-2 tracking-[0.15em] uppercase opacity-60">إجمالي العمولات</div>
                <div className="text-3xl font-black text-orange-500">{totals.commission.toLocaleString()} <small className="text-xs font-bold text-orange-300">ج.م</small></div>
              </div>
              <div className="bg-white p-6 rounded-[1.5rem] border border-[#EAE4D9]/50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#C1A68D]/5 rounded-full blur-2xl -mr-6 -mt-6 group-hover:bg-[#C1A68D]/10 transition-colors" />
                <div className="text-[#7A7061] text-[9px] font-black mb-2 tracking-[0.15em] uppercase opacity-60">صافي الأرباح</div>
                <div className="text-3xl font-black text-[#C1A68D]">{totals.netValue.toLocaleString()} <small className="text-xs font-bold text-[#D5C5B3]">ج.م</small></div>
              </div>
            </div>

            {/* THE TABLE */}
            <div ref={printRef} className="print-area bg-[#F8F5F0] rounded-[2rem] border-2 border-[#2A2723]/15 shadow-lg overflow-hidden">
              <div className="print-header">
                <h2>مزار — تقرير حجوزات {selectedUnitInfo?.title?.ar || selectedUnit}</h2>
                <p>{MONTHS_AR[selectedMonth]} {selectedYear}</p>
              </div>

              <div className="overflow-x-auto custom-scrollbar-horizontal pb-4">
                <table className="w-full min-w-[1500px] text-center border-collapse" dir="rtl">
                  <thead className="sticky top-0 z-30">
                    <tr className="bg-gradient-to-l from-[#1a1714] via-[#2A2723] to-[#1a1714] text-[#E8DFD0] text-[9px] uppercase tracking-widest font-black">
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap sticky right-0 bg-[#2A2723] z-20 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">No</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">التاريخ</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">الاسم</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">الجنسية</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">رقم الهوية</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">الهاتف</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">دخول</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">خروج</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">الأيام</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">سعر الليلة</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">الإجمالي</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">العمولة</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">الوسيط</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">الصافي</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">مسئول الحجز</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">طريقة الدفع</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">حالة الدفع</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap">ملاحظات</th>
                      <th className="px-3 py-4 no-print whitespace-nowrap border-l border-[#3a3730]">الإجراءات</th>
                      <th className="px-3 py-4 border-l border-[#3a3730] whitespace-nowrap sticky left-0 bg-[#2A2723] z-20 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] font-semibold">
                    {isLoading ? (
                      <tr>
                        <td colSpan={16} className="px-6 py-20 text-center text-[#7A7061] italic font-bold opacity-40 uppercase tracking-widest">
                          جاري تحميل البيانات...
                        </td>
                      </tr>
                    ) : allRows.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="px-6 py-20 text-center text-[#7A7061] italic font-bold opacity-40 uppercase tracking-widest">لا توجد سجلات لهذا الشهر</td>
                      </tr>
                    ) : (
                      allRows.map((row, index) => (
                        <tr key={index} className={`border-t border-[#D5CBB8]/60 transition-colors group ${!row.hasData ? 'bg-[#F0EBE2] opacity-50' : row.isCarriedOver ? 'bg-[#F5F0E6]' : index % 2 === 0 ? 'bg-[#FDFBF7] hover:bg-[#F0EBE2]' : 'bg-[#F7F3EC] hover:bg-[#EBE5D9]'}`}>
                          <td className="px-2 py-3 text-[#8B7355] font-black tracking-widest sticky right-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.06)] transition-colors" style={{ backgroundColor: !row.hasData ? '#F0EBE2' : row.isCarriedOver ? '#F5F0E6' : index % 2 === 0 ? '#FDFBF7' : '#F7F3EC' }}>
                            {row.no.toString().padStart(2, '0')}
                          </td>
                          <td className="px-3 py-3 border-l border-[#D5CBB8]/40 font-black text-[#1a1714] whitespace-nowrap">{formatDate(row.date)}</td>
                          
                          {/* EDITABLE: Name */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20 relative group/name flex items-center justify-between">
                            {row.hasData ? (
                              <>
                                <EditableCell value={row.name} bookingId={row.id} field="name" onSave={handleCellSave} className="text-[#1a1714] font-black flex-1" readOnly={row.isCarriedOver} />
                                {row.name && (
                                  <button
                                    onClick={() => setProfileModal({ isOpen: true, name: row.name, phone: row.phone })}
                                    className="opacity-0 group-hover/name:opacity-100 text-[10px] bg-[#C1A68D] text-white px-1.5 py-0.5 rounded ml-1 transition-opacity shrink-0 font-black shadow-sm"
                                    title="عرض سجل وحجوزات العميل"
                                  >
                                    👤 السجل
                                  </button>
                                )}
                              </>
                            ) : <span className="text-[#D5CBB8]">—</span>}
                          </td>

                          {/* EDITABLE: Nationality */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? (
                              <EditableCell value={row.nationality} bookingId={row.id} field="nationality" onSave={handleCellSave} className="text-[#4A4035] font-bold" readOnly={row.isCarriedOver} />
                            ) : <span className="text-[#D5CBB8]">—</span>}
                          </td>
                          
                          {/* EDITABLE: ID Number */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? (
                              <EditableCell value={row.idNumber} bookingId={row.id} field="idNumber" onSave={handleCellSave} className="text-[#4A4035] font-bold" readOnly={row.isCarriedOver} />
                            ) : <span className="text-[#D5CBB8]">—</span>}
                          </td>

                          {/* EDITABLE: Phone */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? (
                              <EditableCell value={row.phone} bookingId={row.id} field="phone" onSave={handleCellSave} className="text-[#1a1714] font-black" readOnly={row.isCarriedOver} />
                            ) : <span className="text-[#D5CBB8]">—</span>}
                          </td>

                          {/* EDITABLE: Check In */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? <EditableCell value={formatDate(row.checkIn)} bookingId={row.id} field="checkIn" onSave={handleCellSave} className="text-blue-700 font-black bg-blue-100/70" readOnly={row.isCarriedOver} /> : <span className="text-[#D5CBB8]">—</span>}
                          </td>
                          
                          {/* EDITABLE: Check Out */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? <EditableCell value={formatDate(row.checkOut)} bookingId={row.id} field="checkOut" onSave={handleCellSave} className="text-red-700 font-black bg-red-100/70" readOnly={row.isCarriedOver} /> : <span className="text-[#D5CBB8]">—</span>}
                          </td>

                          <td className="px-3 py-3 border-l border-[#D5CBB8]/40 text-[#8B6914] font-black text-[11px]">{row.hasData ? row.days : 0}</td>

                          {/* EDITABLE: Price per Night */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? <EditableCell value={row.pricePerNight} bookingId={row.id} field="pricePerNight" onSave={handleCellSave} type="number" className="text-[#3A3020] font-black" readOnly={row.isCarriedOver} /> : <span className="text-[#D5CBB8]">—</span>}
                          </td>
                          
                          {/* EDITABLE: Total Amount */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? <EditableCell value={row.total} bookingId={row.id} field="totalAmount" onSave={handleCellSave} type="number" className="text-[#0d6e3f] font-black text-[11px] bg-green-50/60" readOnly={row.isCarriedOver} /> : <span className="text-[#D5CBB8]">—</span>}
                          </td>

                          {/* EDITABLE: Commission */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? <EditableCell value={row.commission} bookingId={row.id} field="commission" onSave={handleCellSave} type="number" className="text-orange-700 font-black bg-orange-50/60" readOnly={row.isCarriedOver} /> : <span className="text-[#D5CBB8]">—</span>}
                          </td>

                          {/* EDITABLE: Broker Name */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? <EditableCell value={row.brokerName} bookingId={row.id} field="brokerName" onSave={handleCellSave} className="text-[#7A7061] font-bold" readOnly={row.isCarriedOver} /> : <span className="text-[#EAE4D9]">—</span>}
                          </td>

                          <td className="px-3 py-3 border-l border-[#D5CBB8]/40 font-black text-[11px] text-emerald-700 bg-emerald-50/40">{row.hasData ? row.netValue : 0}</td>

                          {/* EDITABLE: Booking Manager */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? <EditableCell value={row.bookingManager} bookingId={row.id} field="bookingManager" onSave={handleCellSave} className="text-[#2A2723] font-bold" readOnly={row.isCarriedOver} /> : <span className="text-[#EAE4D9]">—</span>}
                          </td>

                          {/* EDITABLE: Payment Method */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? (
                              <EditableCell value={row.paymentMethod} bookingId={row.id} field="paymentMethod" onSave={handleCellSave} className="text-blue-600 font-bold" readOnly={row.isCarriedOver} />
                            ) : <span className="text-[#EAE4D9]">—</span>}
                          </td>

                          {/* EDITABLE / TOGGLE: Payment Status (خالص / باقي) */}
                          <td className="px-1 py-1 border-l border-[#EAE4D9]/20">
                            {row.hasData ? (
                              <button
                                disabled={row.isCarriedOver}
                                onClick={() => {
                                  const nextStatus = row.paymentStatus === 'باقي' ? 'خالص' : 'باقي';
                                  handleCellSave(row.id, 'paymentStatus', nextStatus);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all shadow-sm flex items-center justify-center gap-1 mx-auto ${
                                  row.isCarriedOver ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                                } ${
                                  row.paymentStatus === 'باقي'
                                    ? 'bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200'
                                    : 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                                }`}
                                title={row.paymentStatus === 'باقي' ? 'باقي فلوس - اضغط للتغيير إلى خالص' : 'خالص - اضغط للتغيير إلى باقي فلوس'}
                              >
                                {row.paymentStatus === 'باقي' ? (
                                  <>
                                    <span className="text-xs font-black text-rose-600">❌</span>
                                    <span>باقي</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-xs font-black text-green-600">✔️</span>
                                    <span>خالص</span>
                                  </>
                                )}
                              </button>
                            ) : <span className="text-[#EAE4D9]">—</span>}
                          </td>

                          {/* EDITABLE: Notes */}
                          <td className="px-0 py-0 border-l border-[#EAE4D9]/20">
                            {row.hasData ? <EditableCell value={row.notes} bookingId={row.id} field="notes" onSave={handleCellSave} className="text-[#7A7061] font-bold text-[9px]" readOnly={row.isCarriedOver} /> : <span className="text-[#EAE4D9]">—</span>}
                          </td>

                          {/* --- ACTIONS --- */}
                          <td className="px-1 py-1 no-print border-l border-[#EAE4D9]/20 transition-colors group-hover:bg-[#FDFBF7]" style={{ backgroundColor: row.isCarriedOver ? '#fcf9f2' : 'inherit' }}>
                            {row.hasData && (
                              row.isCarriedOver ? (
                                <div className="flex items-center justify-center">
                                  <span className="text-[9px] font-black text-[#C1A68D] bg-white border border-[#EAE4D9] px-2 py-1 rounded-lg tracking-widest shadow-sm">مرحّل</span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => {
                                      const fullBooking = bookings.find(b => b.id === row.id);
                                      if (fullBooking) {
                                        openEditModal(fullBooking);
                                      }
                                    }}
                                    className="w-8 h-8 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                    title="تعديل كافة البيانات"
                                  >
                                    <Pencil size={14} strokeWidth={2.5} />
                                  </button>

                                  <button
                                    onClick={() => handleDelete(row.id)}
                                    className="w-8 h-8 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                    title="حذف الحجز"
                                  >
                                    <Trash2 size={14} strokeWidth={2.5} />
                                  </button>
                                </div>
                              )
                            )}
                          </td>

                          {/* EDITABLE: Client Status */}
                          <td className="px-1 py-3 border-l border-[#D5CBB8]/40 sticky left-0 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.06)] transition-colors" style={{ backgroundColor: !row.hasData ? '#F0EBE2' : row.isCarriedOver ? '#F5F0E6' : index % 2 === 0 ? '#FDFBF7' : '#F7F3EC' }}>
                            {row.hasData ? (
                              row.isCarriedOver ? (
                                <span className={`font-black text-[10px] px-2.5 py-1.5 rounded-lg text-center block ${row.clientStatus === 'انتظار' ? 'text-gray-600 bg-gray-200/80 border border-gray-300/50' : row.clientStatus === 'متواجد' ? 'text-emerald-800 bg-emerald-200/80 border border-emerald-300/50' : 'text-red-800 bg-red-200/80 border border-red-300/50'}`}>{row.clientStatus}</span>
                              ) : (
                                <select
                                  value={row.clientStatus}
                                  onChange={(e) => handleCellSave(row.id, 'clientStatus', e.target.value)}
                                  className={`bg-transparent outline-none font-black text-[10px] px-2.5 py-1.5 rounded-lg text-center cursor-pointer appearance-none block w-full ${row.clientStatus === 'انتظار' ? 'text-gray-700 bg-gray-200/80 border border-gray-300/50' : row.clientStatus === 'متواجد' ? 'text-emerald-800 bg-emerald-200/80 border border-emerald-300/50' : 'text-red-800 bg-red-200/80 border border-red-300/50'}`}
                                >
                                  <option value="انتظار">انتظار</option>
                                  <option value="متواجد">متواجد</option>
                                  <option value="غادر">غادر</option>
                                </select>
                              )
                            ) : <span className="text-[#EAE4D9]">—</span>}
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Totals Row */}
                    <tr className="bg-gradient-to-l from-[#1a1714] via-[#2A2723] to-[#1a1714] text-[#E8DFD0] font-black text-[11px] border-t-4 border-[#C1A68D]">
                      <td colSpan={8} className="px-4 py-4 text-center tracking-widest uppercase text-[9px]">الإجمالي</td>
                      <td className="px-3 py-4 border-l border-[#3a3730]">{totals.days}</td>
                      <td className="px-3 py-4 border-l border-[#3a3730]"></td>
                      <td className="px-3 py-4 border-l border-[#3a3730] text-[#C1A68D]">{totals.total.toLocaleString()}</td>
                      <td className="px-3 py-4 border-l border-[#3a3730] text-orange-300">{totals.commission.toLocaleString()}</td>
                      <td className="px-3 py-4 border-l border-[#3a3730]"></td>
                      <td className="px-3 py-4 border-l border-[#3a3730] text-green-400">{totals.netValue.toLocaleString()}</td>
                      <td className="px-3 py-4 border-l border-[#3a3730]"></td>
                      <td className="px-3 py-4 border-l border-[#3a3730]"></td>
                      <td className="px-3 py-4 border-l border-[#3a3730]"></td>
                      <td className="px-3 py-4 no-print border-l border-[#3a3730]"></td>
                      <td className="px-3 py-4 border-l border-[#3a3730]"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info Note */}
            <div className="no-print bg-[#FDFBF7] p-6 rounded-[1.5rem] border border-[#EAE4D9]/50 flex gap-4 items-start" dir="rtl">
              <span className="text-2xl mt-1">✏️</span>
              <div className="text-[10px] leading-relaxed text-[#7A7061] font-bold">
                <strong className="block mb-1 text-[#C1A68D] text-xs font-black tracking-widest uppercase">كيفية التعديل على الجدول:</strong>
                <ul className="list-disc list-inside space-y-1 mr-2 opacity-80">
                  <li>أي مكان في الخلية مكتوب فيه نص <span className="text-[#C1A68D] font-black">(الاسم / الجنسية / التاريخ / المبالغ / الملاحظات)</span> تقدر تضغط عليه مباشرة وهتتحول لخانة كتابة.</li>
                  <li>بعد ما تخلص كتابة، اضغط <span className="text-blue-600 font-black">Enter</span> أو اضغط في أي مكان بره الخلية عشان الحفظ يتم تلقائياً.</li>
                  <li>علامة الـ <span className="text-yellow-600">✏️</span> بتظهر لما تقف بالماوس على الخلية عشان تعرف إنها قابلة للتعديل.</li>
                  <li>الخلايا الفاضية <span className="text-[#EAE4D9]">(—)</span> في الحجوزات الموجودة برضه قابلة للتعديل بنفس الطريقة.</li>
                  <li>الصفوف الرمادية في آخر الجدول هي صفوف انتظار ولا يمكن التعديل عليها، استخدم نموذج "إضافة للجدول" في الأعلى لإضافة حجز جديد.</li>
                </ul>
              </div>
            </div>

            {/* Edit Booking Modal */}
            {isEditModalOpen && editingBooking && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in no-print">
                <div className="bg-[#FDFBF7] border border-[#EAE4D9] w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-[#EAE4D9]/50 flex justify-between items-center bg-white">
                    <h2 className="text-xl font-black text-[#2A2723]">تعديل بيانات <span className="text-[#C1A68D]">الحجز</span></h2>
                    <button onClick={() => setIsEditModalOpen(false)} className="text-2xl text-[#7A7061] hover:text-red-500">×</button>
                  </div>

                  <form onSubmit={handleFullUpdate} className="p-8 space-y-6 overflow-y-auto custom-scrollbar" dir="rtl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">اسم العميل</label>
                        <input
                          type="text" required
                          value={editingBooking.name || ''}
                          onChange={e => setEditingBooking({ ...editingBooking, name: e.target.value })}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">رقم الهاتف</label>
                        <input
                          type="text" required
                          value={editingBooking.phone || ''}
                          onChange={e => setEditingBooking({ ...editingBooking, phone: e.target.value })}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">الجنسية</label>
                        <input
                          type="text"
                          value={editingBooking.nationality || ''}
                          onChange={e => setEditingBooking({ ...editingBooking, nationality: e.target.value })}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">رقم الهوية</label>
                        <input
                          type="text"
                          value={editingBooking.idNumber || ''}
                          onChange={e => setEditingBooking({ ...editingBooking, idNumber: e.target.value })}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold"
                        />
                      </div>
                      <div className="space-y-2 col-span-1">
                        <AdminDatePicker
                          label="تاريخ الدخول"
                          value={editingBooking.checkIn}
                          onChange={(v: string) => {
                            const dIn = new Date(v);
                            const dOut = new Date(editingBooking.checkOut);
                            const diff = Math.ceil((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24));
                            const nights = diff > 0 ? diff : 0;
                            setEditingBooking({
                              ...editingBooking,
                              checkIn: v,
                              numberOfDays: nights,
                              totalAmount: nights * (editingBooking.pricePerNight || 0)
                            });
                          }}
                          icon="🛬"
                          color="gold"
                        />
                      </div>
                      <div className="space-y-2 col-span-1">
                        <AdminDatePicker
                          label="تاريخ الخروج"
                          value={editingBooking.checkOut}
                          onChange={(v: string) => {
                            const dIn = new Date(editingBooking.checkIn);
                            const dOut = new Date(v);
                            const diff = Math.ceil((dOut.getTime() - dIn.getTime()) / (1000 * 60 * 60 * 24));
                            const nights = diff > 0 ? diff : 0;
                            setEditingBooking({
                              ...editingBooking,
                              checkOut: v,
                              numberOfDays: nights,
                              totalAmount: nights * (editingBooking.pricePerNight || 0)
                            });
                          }}
                          icon="🛫"
                          color="red"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">سعر الليلة</label>
                        <input
                          type="number"
                          value={editingBooking.pricePerNight || 0}
                          onChange={e => {
                            const pNight = Number(e.target.value);
                            const nights = editingBooking.numberOfDays || 0;
                            setEditingBooking({
                              ...editingBooking,
                              pricePerNight: pNight,
                              totalAmount: pNight * nights
                            });
                          }}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-black text-blue-600"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">إجمالي المبلغ</label>
                        <input
                          type="number" required
                          value={editingBooking.totalAmount || 0}
                          onChange={e => {
                            const total = Number(e.target.value);
                            const nights = editingBooking.numberOfDays || 0;
                            setEditingBooking({
                              ...editingBooking,
                              totalAmount: total,
                              pricePerNight: nights > 0 ? total / nights : total
                            });
                          }}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-black"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">العمولة</label>
                        <input
                          type="number"
                          value={editingBooking.commission || 0}
                          onChange={e => setEditingBooking({ ...editingBooking, commission: Number(e.target.value) })}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold text-orange-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">اسم الوسيط</label>
                        <input
                          type="text"
                          value={editingBooking.brokerName || ''}
                          onChange={e => setEditingBooking({ ...editingBooking, brokerName: e.target.value })}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">مسئول الحجز</label>
                        <input
                          type="text"
                          value={editingBooking.bookingManager || ''}
                          onChange={e => setEditingBooking({ ...editingBooking, bookingManager: e.target.value })}
                          placeholder="اسم المسئول"
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">حالة العميل (يدوياً)</label>
                        <select
                          value={editingBooking.clientStatus || 'انتظار'}
                          onChange={e => setEditingBooking({ ...editingBooking, clientStatus: e.target.value })}
                          className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold"
                        >
                          <option value="انتظار">انتظار</option>
                          <option value="متواجد">متواجد</option>
                          <option value="غادر">غادر</option>
                        </select>
                      </div>

                      {/* ── طرق الدفع المتعددة والتوزيع بالخزنة (كاش / فيزا / فودافون كاش / إنستا باي) ── */}
                      <div className="col-span-1 md:col-span-2 space-y-3 bg-gradient-to-b from-[#FBF9F5] to-white p-4 md:p-6 rounded-2xl border-2 border-[#D8C7B5] shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8C7B5]/60">
                          <div>
                            <label className="text-xs md:text-sm font-black text-[#2A2723] flex items-center gap-2">
                              <CreditCard size={18} className="text-[#A88B70]" />
                              <span>طرق الدفع والتوزيع المالي (كاش / فيزا / فودافون كاش / إنستا باي)</span>
                            </label>
                            <p className="text-[11px] font-bold text-[#7A7061] mt-0.5">
                              حدد طريقة الدفع والمبلغ، ويمكنك إضافة أكثر من طريقة (مثلاً 600 كاش + 600 فيزا) لتسجيلها بالخزنة بدقة
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddPaymentSplit}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Plus size={15} />
                            <span>إضافة طريقة دفع أخرى</span>
                          </button>
                        </div>

                        {/* قائمة خانات طرق الدفع الموزعة */}
                        <div className="space-y-2.5">
                          {paymentSplits.map((split, idx) => {
                            const isCustom = !['كاش', 'فيزا', 'إنستا باي / حساب بنكي', 'فودافون كاش'].includes(split.method);
                            return (
                              <div
                                key={idx}
                                className="bg-[#FAF7F2] p-3 rounded-xl border border-[#EAE4D9] shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <span className="text-xs font-black text-[#A88B70] w-5 text-center">{idx + 1}.</span>
                                  <select
                                    value={isCustom ? 'أخرى' : split.method}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'أخرى') {
                                        handleUpdatePaymentSplit(idx, 'method', '');
                                      } else {
                                        handleUpdatePaymentSplit(idx, 'method', val);
                                      }
                                    }}
                                    className="bg-white border-2 border-[#D8C7B5] rounded-xl px-3 py-2 text-xs font-black text-[#2A2723] outline-none cursor-pointer flex-1 focus:border-[#2A2723]"
                                  >
                                    <option value="كاش">💵 كاش (نقدي)</option>
                                    <option value="فيزا">💳 فيزا / بطاقة بنكية</option>
                                    <option value="إنستا باي / حساب بنكي">⚡ إنستا باي / حساب بنكي</option>
                                    <option value="فودافون كاش">📱 فودافون كاش</option>
                                    <option value="أخرى">📝 طريقة مخصصة أخرى...</option>
                                  </select>
                                  {isCustom && (
                                    <input
                                      type="text"
                                      placeholder="اسم الطريقة (مثلاً تحويل...)"
                                      value={split.method}
                                      onChange={(e) => handleUpdatePaymentSplit(idx, 'method', e.target.value)}
                                      className="bg-white border-2 border-[#D8C7B5] rounded-xl px-3 py-2 text-xs font-black text-[#2A2723] outline-none w-36"
                                    />
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-1">
                                  <label className="text-[11px] font-black text-[#7A7061] whitespace-nowrap">المبلغ:</label>
                                  <div className="relative flex-1">
                                    <input
                                      type="number"
                                      min="0"
                                      value={split.amount}
                                      onChange={(e) => handleUpdatePaymentSplit(idx, 'amount', e.target.value)}
                                      placeholder="0"
                                      className="w-full bg-white border-2 border-[#D8C7B5] rounded-xl px-4 py-2 text-sm font-black text-[#2A2723] outline-none focus:border-emerald-600"
                                    />
                                    <span className="absolute left-3 top-2 text-[10px] font-bold text-[#7A7061]">ج.م</span>
                                  </div>
                                </div>

                                {paymentSplits.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePaymentSplit(idx)}
                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 p-2 rounded-lg transition-colors cursor-pointer self-end sm:self-center font-black"
                                    title="حذف هذا البند"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* ملخص الاحتساب والمتبقي */}
                        {(() => {
                          const splitsTotal = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
                          const bookingTotal = Number(editingBooking?.totalAmount || 0);
                          const remaining = Math.max(0, bookingTotal - splitsTotal);
                          const isFullyPaid = bookingTotal > 0 && splitsTotal >= bookingTotal;

                          return (
                            <div className="bg-white p-3.5 rounded-xl border border-[#D8C7B5] flex flex-wrap items-center justify-between gap-3 text-xs mt-1">
                              <div className="flex flex-wrap items-center gap-4">
                                <span className="font-bold text-[#7A7061]">
                                  إجمالي الموزع بالطرق: <strong className="text-emerald-700 font-black text-sm">{splitsTotal.toLocaleString()} ج.م</strong>
                                </span>
                                <span className="font-bold text-[#7A7061]">
                                  إجمالي قيمة الحجز: <strong className="text-[#2A2723] font-black text-sm">{bookingTotal.toLocaleString()} ج.م</strong>
                                </span>
                                {isFullyPaid ? (
                                  <span className="text-emerald-700 font-black bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                                    مسدد بالكامل ✔️ (يدخل الخزنة)
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-black bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                                    المتبقي: {remaining.toLocaleString()} ج.م (باقي فلوس ❌)
                                  </span>
                                )}
                              </div>

                              {remaining > 0 && (
                                <button
                                  type="button"
                                  onClick={handleFillRemainingSplit}
                                  className="text-[11px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                  ➕ توزيع المتبقي ({remaining.toLocaleString()} ج.م) كبند دفع إضافي
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="space-y-2 col-span-1 md:col-span-2">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">حالة الحساب والخزنة</label>
                        <select
                          value={editingBooking.paymentStatus || 'خالص'}
                          onChange={e => setEditingBooking({ ...editingBooking, paymentStatus: e.target.value })}
                          className={`w-full border-2 rounded-xl px-4 py-3 text-sm outline-none font-black ${
                            editingBooking.paymentStatus === 'باقي'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-green-50 text-green-700 border-green-300'
                          }`}
                        >
                          <option value="خالص">خالص (مسدد بالكامل ✔️ - يدخل في الخزنة)</option>
                          <option value="باقي">باقي فلوس (❌ - معلّق خارج الخزنة)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">ملاحظات</label>
                      <textarea
                        rows={3}
                        value={editingBooking.notes || ''}
                        onChange={e => setEditingBooking({ ...editingBooking, notes: e.target.value })}
                        className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C1A68D] font-bold resize-none"
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-[#2A2723] text-white font-black py-4 rounded-xl hover:bg-black transition-all shadow-lg"
                      >
                        حفظ كافة التعديلات 💾
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditModalOpen(false)}
                        className="flex-1 bg-white border border-[#EAE4D9] text-[#7A7061] font-black py-4 rounded-xl hover:bg-gray-50 transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Customer Profile Modal */}
            <CustomerProfileModal
              isOpen={profileModal.isOpen}
              customerName={profileModal.name}
              customerPhone={profileModal.phone}
              bookings={bookings}
              onClose={() => setProfileModal({ isOpen: false, name: null })}
              onRefresh={loadData}
            />
          </>
        )}
      </div>
    </>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-black animate-pulse text-[#C1A68D]">جاري تحميل التقارير...</div>}>
      <ReportsContent />
    </Suspense>
  );
}
