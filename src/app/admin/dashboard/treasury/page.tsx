"use client";

import { useEffect, useMemo, useState } from 'react';
import { getBookings } from '@/lib/data-init';
import {
  deleteDbTreasuryTransfer,
  getDbExpenses,
  getDbTreasuryTransfers,
  saveDbTreasuryTransfer,
  updateDbBookingStatus,
  updateDbTreasuryTransfer,
} from '@/lib/actions/db';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Edit3,
  Lock,
  Plus,
  Receipt,
  Smartphone,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// طرق الدفع والتحويل المدعومة مع تمييز لوني واضح وفاقع لكل محفظة
const PAYMENT_METHODS = [
  {
    id: 'cash',
    label: 'كاش',
    icon: Banknote,
    color: 'text-emerald-800 bg-emerald-100/90 border-emerald-300',
    activeBg: 'bg-emerald-600 text-white shadow-sm',
    cardBorder: 'border-emerald-300 hover:border-emerald-500',
    cardBg: 'bg-emerald-50/50 hover:bg-emerald-50/80',
    cardSelected: 'border-emerald-600 bg-emerald-50/95 ring-2 ring-emerald-500/30 shadow-md',
    textColor: 'text-emerald-950',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'instapay',
    label: 'إنستا باي / حساب بنكي',
    icon: Zap,
    color: 'text-purple-800 bg-purple-100/90 border-purple-300',
    activeBg: 'bg-purple-600 text-white shadow-sm',
    cardBorder: 'border-purple-300 hover:border-purple-500',
    cardBg: 'bg-purple-50/50 hover:bg-purple-50/80',
    cardSelected: 'border-purple-600 bg-purple-50/95 ring-2 ring-purple-500/30 shadow-md',
    textColor: 'text-purple-950',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    id: 'vodafone_cash',
    label: 'فودافون كاش',
    icon: Smartphone,
    color: 'text-red-800 bg-red-100/90 border-red-300',
    activeBg: 'bg-red-600 text-white shadow-sm',
    cardBorder: 'border-red-300 hover:border-red-500',
    cardBg: 'bg-red-50/50 hover:bg-red-50/80',
    cardSelected: 'border-red-600 bg-red-50/95 ring-2 ring-red-500/30 shadow-md',
    textColor: 'text-red-950',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
  },
] as const;

type PaymentMethodId = typeof PAYMENT_METHODS[number]['id'];

// دالة ذكية لتحديد طريقة الدفع (تدمج إنستا باي، الحساب البنكي، والفيزا القديمة في إنستا باي / حساب بنكي)
const detectPaymentMethod = (text: string = ''): { id: PaymentMethodId; label: string } => {
  const t = String(text).toLowerCase();

  const tagMatch = text.match(/\[طريقة:\s*([^\]]+)\]/);
  if (tagMatch) {
    const rawTag = tagMatch[1].trim();
    if (
      rawTag.includes('إنستا') ||
      rawTag.includes('انستا') ||
      rawTag.includes('instapay') ||
      rawTag.includes('بنك') ||
      rawTag.includes('حساب') ||
      rawTag.includes('فيزا') ||
      rawTag.includes('visa')
    ) {
      return { id: 'instapay', label: 'إنستا باي / حساب بنكي' };
    }
    if (rawTag.includes('فودافون') || rawTag.includes('vodafone')) {
      return { id: 'vodafone_cash', label: 'فودافون كاش' };
    }
    if (rawTag.includes('كاش') || rawTag.includes('cash')) {
      return { id: 'cash', label: 'كاش' };
    }
  }

  if (
    t.includes('انستا') ||
    t.includes('إنستا') ||
    t.includes('instapay') ||
    t.includes('بنك') ||
    t.includes('حساب بنكي') ||
    t.includes('حساب') ||
    t.includes('فيزا') ||
    t.includes('visa')
  ) {
    return { id: 'instapay', label: 'إنستا باي / حساب بنكي' };
  }
  if (t.includes('فودافون') || t.includes('vodafone') || t.includes('فودافون كاش')) {
    return { id: 'vodafone_cash', label: 'فودافون كاش' };
  }

  return { id: 'cash', label: 'كاش' };
};

// Robust date parser: supports YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO
const parseDateYM = (dateStr: any): { year: number; month: number } | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return { year: +ymd[1], month: +ymd[2] - 1 };
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return { year: +dmy[3], month: +dmy[2] - 1 };
  const d = new Date(s);
  if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() };
  return null;
};

// Extracts target accounting month (حساب شهر) from transfer metadata/notes if set, otherwise falls back to transfer date
const getTransferTargetYM = (t: TreasuryTransfer): { year: number; month: number } | null => {
  const combined = `${t.notes || ''} ${t.handed_by || ''} ${t.received_by || ''}`;
  const tagMatch = combined.match(/\[(?:حساب_شهر|شهر_التقرير|حساب|شهر|target_month):\s*(\d{4})[-/](\d{1,2})\]/);
  if (tagMatch) {
    const y = parseInt(tagMatch[1], 10);
    const m = parseInt(tagMatch[2], 10) - 1; // 0-indexed
    return { year: y, month: m };
  }
  return parseDateYM(t.transfer_date);
};

const parsePaymentSplitsFromString = (raw: string, fallbackTotal: number = 0): Array<{ method: string; amount: number | string }> => {
  if (!raw || !raw.trim()) {
    return [{ method: 'كاش', amount: fallbackTotal > 0 ? fallbackTotal : '' }];
  }
  const clean = raw.trim();
  const parts = clean.split(/[|+\n،,]+/).map(p => p.trim()).filter(Boolean);
  const parsed: Array<{ method: string; amount: number | string }> = [];

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

const CONFIRMED_STATUSES = ['approved', 'مؤكد', 'مؤكد/دخول', 'مغادر/تنظيف', 'مغادر/تم'];

const parseArabicNumberString = (raw: string): number | null => {
  if (!raw) return null;
  let s = raw
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim()
    .toLowerCase();

  const kMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:k|ك|ألف|الف)/i);
  if (kMatch) {
    const base = parseFloat(kMatch[1].replace(/,/g, '.'));
    return isNaN(base) ? null : Math.round(base * 1000);
  }

  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) {
    s = s.replace(/[.,]/g, '');
    const val = parseFloat(s);
    return isNaN(val) ? null : val;
  }

  s = s.replace(/,/g, '');
  const val = parseFloat(s);
  return isNaN(val) ? null : val;
};

const extractRemainingFromText = (text: string): number | null => {
  if (!text) return null;
  const s = text
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase();

  const regex = /(?:متبقي|باقي|باقى|دين|علية|عليها|مستحق)\s*[:=+\-–—]?\s*(\+?\s*\d[\d.,]*\s*(?:k|ك|ألف|الف)?)/i;
  const match = s.match(regex);
  if (match && match[1]) {
    const rawNum = match[1].replace(/^\+/, '').trim();
    const parsed = parseArabicNumberString(rawNum);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return null;
};

type TreasuryTransfer = {
  id: string;
  amount: number;
  handed_by: string;
  received_by: string;
  transfer_date: string;
  notes?: string;
  clean_user_note?: string;
  type?: string;
  reason?: string;
  actor?: string;
  time?: string;
  status?: string;
  approved_by?: string;
};

const isTransferApproved = (t: TreasuryTransfer): boolean => {
  if (!t) return false;
  if (t.approved_by && t.approved_by.trim() !== '') return true;
  if (t.status && (t.status.includes('تم الموافقة') || t.status === 'APPROVED' || t.status === 'معتمد')) return true;
  const raw = `${t.notes || ''} ${t.handed_by || ''}`;
  if (raw.includes('[اعتماد:')) return true;
  return false;
};

const getTransferApprover = (t: TreasuryTransfer): string => {
  if (!t) return '';
  if (t.approved_by && t.approved_by.trim()) return t.approved_by.trim();
  const raw = `${t.notes || ''} ${t.handed_by || ''}`;
  const m = raw.match(/\[اعتماد:\s*([^\]]+)\]/);
  if (m) return m[1].trim();
  if (t.status && t.status.includes('بواسطة:')) {
    const sMatch = t.status.match(/بواسطة:\s*([^\]]+)/);
    if (sMatch) return sMatch[1].trim();
  }
  return '';
};

const getCleanTransferNote = (transfer: TreasuryTransfer): string => {
  if (transfer.clean_user_note && transfer.clean_user_note.trim()) {
    return transfer.clean_user_note.trim();
  }
  const raw = transfer.notes || '';
  const noteMatch = raw.match(/\[ملاحظة:\s*([^\]]+)\]/);
  if (noteMatch) return noteMatch[1].trim();

  return raw
    .replace(/\[(طريقة|نوع|سبب|المستلم|وقت|حساب_شهر|شهر|اعتماد|حالة):[^\]]+\]/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim();
};

const money = (value: number) => `${Math.round(value).toLocaleString('ar-EG')} ج.م`;

export default function TreasuryPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<TreasuryTransfer[]>([]);

  // نموذج إضافة تحويل أو سحب
  const [form, setForm] = useState<{
    amount: string;
    handedBy: string;
    receivedBy: string;
    method: PaymentMethodId;
    date: string;
    targetMonth: number;
    targetYear: number;
    notes: string;
    type: 'deposit' | 'withdrawal';
    approvedStatus: 'PENDING' | 'APPROVED';
  }>({
    amount: '',
    handedBy: '',
    receivedBy: 'الخزنة الكبيرة',
    method: 'cash' as PaymentMethodId,
    date: today.toISOString().slice(0, 10),
    targetMonth: today.getMonth(),
    targetYear: today.getFullYear(),
    notes: '',
    type: 'deposit',
    approvedStatus: 'PENDING',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // فلتر مراجعة التحويلات حسب طريقة الدفع
  const [transferFilter, setTransferFilter] = useState<'all' | PaymentMethodId>('all');

  // المربع النشط المختار من شجرة الخزنة (عند النقر يفتح ما يخصه فوراً)
  type DetailBoxId = 'cash' | 'instapay' | 'vodafone' | 'uncollected' | 'expenses' | 'total_expected' | 'collected_net' | 'net_expected' | 'big_treasury';
  const [activeBox, setActiveBox] = useState<DetailBoxId>('cash');

  const handleSelectBox = (boxId: DetailBoxId) => {
    setActiveBox(boxId);
    if (boxId === 'cash') setTransferFilter('cash');
    else if (boxId === 'instapay') setTransferFilter('instapay');
    else if (boxId === 'vodafone') setTransferFilter('vodafone_cash');
    else if (boxId === 'big_treasury') setTransferFilter('all');
    else if (boxId === 'uncollected') setBookingFilter('pending');
    else if (boxId === 'total_expected') setBookingFilter('all');
    
    setTimeout(() => {
      const el = document.getElementById('treasury-detail-viewer');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  // فلتر جدول الحجوزات
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // نافذة تعديل المدفوع والمتبقي للحجز
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editPaidInput, setEditPaidInput] = useState<string>('');
  const [editNotesInput, setEditNotesInput] = useState<string>('');
  const [editSplits, setEditSplits] = useState<Array<{ method: string; amount: number | string }>>([
    { method: 'كاش', amount: '' }
  ]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // نافذة تعديل حركة التحويل (المبلغ / طريقة الدفع / الملاحظات / الشهر المستهدف)
  const [editingTransfer, setEditingTransfer] = useState<any | null>(null);
  const [editTransferMethod, setEditTransferMethod] = useState<PaymentMethodId>('cash');
  const [editTransferAmount, setEditTransferAmount] = useState<string>('');
  const [editTransferNotes, setEditTransferNotes] = useState<string>('');
  const [editTransferDate, setEditTransferDate] = useState<string>('');
  const [editTransferMonth, setEditTransferMonth] = useState<number>(today.getMonth());
  const [editTransferYear, setEditTransferYear] = useState<number>(today.getFullYear());
  const [isSavingTransferEdit, setIsSavingTransferEdit] = useState(false);

  // مزامنة تلقائية لنموذج التحويل والسحب عند تغيير الشهر أو السنة في رأس الصفحة
  useEffect(() => {
    const isCurrent = today.getMonth() === month && today.getFullYear() === year;
    const defaultDate = isCurrent
      ? today.toISOString().slice(0, 10)
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    setForm(prev => ({
      ...prev,
      date: defaultDate,
      targetMonth: month,
      targetYear: year,
    }));
    setWithdrawDate(defaultDate);
  }, [month, year]);

  // --- Owner detection ---
  const [adminInfo, setAdminInfo] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(sessionStorage.getItem('adminInfo') || '{}');
      } catch {
        return {};
      }
    }
    return {};
  });
  useEffect(() => {
    const info = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminInfo') || '{}') : {};
    setAdminInfo(info);
  }, []);

  // السحب والاعتماد للخزنة الكبيرة يتاح حصرياً لمؤمن ومدحت فقط (وحساب المدير العام mazar / Owner)
  const isOwner = useMemo(() => {
    const username = (adminInfo?.username || '').toLowerCase().trim();
    const name = (adminInfo?.name || '').toLowerCase().trim();
    const role = (adminInfo?.role || '').toLowerCase().trim();

    const isMo2men = username === 'mo2men' || name.includes('مؤمن') || name.includes('مأمون');
    const isMedhat = username === 'medhat' || name.includes('مدحت');
    const isSuper = username === 'mazar' || role === 'owner' || role === 'super admin';

    return isMo2men || isMedhat || isSuper;
  }, [adminInfo]);

  const approverDisplayName = useMemo(() => {
    return (adminInfo?.name?.includes('مدحت') || adminInfo?.username?.toLowerCase() === 'medhat') ? 'مدحت' : 'مؤمن';
  }, [adminInfo]);

  const defaultOwnerName = approverDisplayName;

  const [togglingTransferId, setTogglingTransferId] = useState<string | null>(null);

  const handleToggleTransferApproval = async (transfer: TreasuryTransfer) => {
    if (!isOwner) {
      alert('عفواً، اعتماد حركات التوريد مقتصر حصرياً على مؤمن ومدحت فقط');
      return;
    }
    if (togglingTransferId) return;

    const currentlyApproved = isTransferApproved(transfer);
    const newApprovedBy = currentlyApproved ? '' : approverDisplayName;
    const newStatus = currentlyApproved ? 'PENDING' : `تم الموافقة بواسطة: ${approverDisplayName}`;

    // Optimistic Update
    setTransfers(prev =>
      prev.map(item =>
        item.id === transfer.id
          ? { ...item, status: newStatus, approved_by: newApprovedBy }
          : item
      )
    );
    setTogglingTransferId(transfer.id);

    try {
      await updateDbTreasuryTransfer(transfer.id, {
        approved_by: newApprovedBy,
        status: newStatus,
      });
      const freshData = await getDbTreasuryTransfers();
      setTransfers(freshData || []);
    } catch (error: any) {
      console.error('Error toggling transfer approval:', error);
      alert('حدث خطأ أثناء تحديث حالة الاعتماد: ' + (error.message || 'خطأ غير معروف'));
      const freshData = await getDbTreasuryTransfers();
      setTransfers(freshData || []);
    } finally {
      setTogglingTransferId(null);
    }
  };

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethodId>('cash');
  const [withdrawDate, setWithdrawDate] = useState(today.toISOString().slice(0, 10));
  const [withdrawBy, setWithdrawBy] = useState('مؤمن');
  const [isSavingWithdraw, setIsSavingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  useEffect(() => {
    if (adminInfo?.name?.includes('مدحت') || adminInfo?.username?.toLowerCase() === 'medhat') {
      setWithdrawBy('مدحت');
    } else {
      setWithdrawBy('مؤمن');
    }
  }, [adminInfo]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const transferData = await getDbTreasuryTransfers();
      setTransfers(transferData || []);
    } catch (e) {
      console.error('Treasury transfers load error:', e);
    } finally {
      setIsLoading(false);
    }

    try {
      const [bookingData, expenseData] = await Promise.all([
        getBookings(),
        getDbExpenses(),
      ]);
      setBookings(bookingData || []);
      setExpenses(expenseData || []);
    } catch (e) {
      console.error('Bookings/expenses load error:', e);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── الحسابات الشهرية المفلترة بالشهر والسنة (تصفير شهري - شهر بشهر) ──
  // حجوزات الشهر المؤكدة (تشمل الحجوزات داخل الشهر أو الممتدة إليه)
  const monthlyBookings = useMemo(() => (bookings || []).filter((booking) => {
    if (!booking) return false;
    const isApproved = CONFIRMED_STATUSES.includes(String(booking.status)) || booking.status === 'approved' || booking.status === 'مؤكد';
    if (!isApproved) return false;

    // دعم الحجوزات الممتدة عبر الشهور مثل شاشة التقارير
    const partsIn = booking.checkIn?.split('-');
    const partsOut = booking.checkOut?.split('-');
    if (partsIn && partsIn.length >= 2 && partsOut && partsOut.length >= 2) {
      const inVal = parseInt(partsIn[0], 10) * 12 + (parseInt(partsIn[1], 10) - 1);
      const outVal = parseInt(partsOut[0], 10) * 12 + (parseInt(partsOut[1], 10) - 1);
      const selVal = year * 12 + month;
      if (selVal >= inVal && selVal <= outVal) return true;
    }

    const parsed = parseDateYM(booking.checkIn);
    return parsed ? parsed.month === month && parsed.year === year : false;
  }), [bookings, month, year]);

  // احتساب المقبوض الفعلي والمتبقي لكل حجز
  const {
    totalRevenueCollected,
    totalRemainingUncollected,
    totalCommissions,
    bookingsWithBreakdown,
    pendingBookings,
    completedBookings,
    totalCashRevenueCollected,
    totalElectronicRevenueCollected,
  } = useMemo(() => {
    let revPaid = 0;
    let revCash = 0;
    let revElectronic = 0;
    let remUncollected = 0;
    let comm = 0;

    const list = monthlyBookings.map((b) => {
      const total = Number(b.totalAmount || 0);
      const bComm = Number(b.commission || 0);
      comm += bComm;

      let p = b.paidAmount !== undefined ? Number(b.paidAmount) : undefined;
      let r = b.remainingAmount !== undefined ? Number(b.remainingAmount) : undefined;

      if (p === undefined || r === undefined) {
        const combined = `${b.notes || ''} ${b.paymentInfo || ''}`.toLowerCase();
        const rem = extractRemainingFromText(combined);
        if (rem !== null) {
          r = rem;
          p = Math.max(0, total - rem);
        } else if (b.paymentStatus === 'خالص') {
          p = total;
          r = 0;
        } else {
          p = total;
          r = 0;
        }
      }

      revPaid += p;
      remUncollected += r;

      const combinedMethod = `${b.paymentMethod || ''} ${b.paymentInfo || ''} ${b.notes || ''}`.toLowerCase();
      const isElec = combinedMethod.includes('فودافون') || combinedMethod.includes('vodafone') ||
                     combinedMethod.includes('انستا') || combinedMethod.includes('إنستا') ||
                     combinedMethod.includes('instapay') || combinedMethod.includes('بنك') ||
                     combinedMethod.includes('فيزا') || combinedMethod.includes('visa');
      if (isElec) {
        revElectronic += p;
      } else {
        revCash += p;
      }

      return {
        ...b,
        calculatedPaid: p,
        calculatedRemaining: r,
        isFullyPaid: r === 0,
        isElectronicPayment: isElec,
      };
    });

    return {
      totalRevenueCollected: revPaid,
      totalCashRevenueCollected: revCash,
      totalElectronicRevenueCollected: revElectronic,
      totalRemainingUncollected: remUncollected,
      totalCommissions: comm,
      bookingsWithBreakdown: list,
      pendingBookings: list.filter(b => !b.isFullyPaid),
      completedBookings: list.filter(b => b.isFullyPaid),
    };
  }, [monthlyBookings]);

  // مصروفات الشهر (كلها تخصم بالكامل من الخزنة الصغيرة فقط)
  const monthlyExpenses = useMemo(() => (expenses || []).filter((expense) => {
    if (!expense || expense.status === 'REJECTED' || expense.status === 'مرفوض') return false;
    const parsed = parseDateYM(expense.date);
    return parsed ? parsed.month === month && parsed.year === year : false;
  }), [expenses, month, year]);

  const totalExpenses = useMemo(() => {
    return monthlyExpenses.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0);
  }, [monthlyExpenses]);

  // تحويلات الشهر (من الخزنة الصغيرة إلى الخزنة الكبيرة) - تتبع الشهر المستهدف المخصص
  const monthlyDeposits = useMemo(() => (transfers || []).filter((t) => {
    if (!t) return false;
    const isWithdraw = t.type === 'withdrawal' || (t.notes || '').includes('[نوع: سحب') || (t.handed_by || '').includes('[نوع: سحب');
    const parsed = getTransferTargetYM(t);
    return !isWithdraw && parsed ? parsed.month === month && parsed.year === year : false;
  }), [transfers, month, year]);

  const totalDepositedToBig = useMemo(() => {
    return monthlyDeposits.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
  }, [monthlyDeposits]);

  // تقسيم التوريدات للخزنة الكبيرة: كاش فقط مقابل إلكتروني (فودافون كاش / إنستا باي)
  const totalCashDepositedToBig = useMemo(() => {
    return monthlyDeposits.reduce((sum, t) => {
      const fullText = `${t.notes || ''} ${t.handed_by || ''} ${t.received_by || ''}`;
      const method = detectPaymentMethod(fullText).id;
      return method === 'cash' ? sum + (Number(t?.amount) || 0) : sum;
    }, 0);
  }, [monthlyDeposits]);

  const totalElectronicDepositedToBig = useMemo(() => {
    return monthlyDeposits.reduce((sum, t) => {
      const fullText = `${t.notes || ''} ${t.handed_by || ''} ${t.received_by || ''}`;
      const method = detectPaymentMethod(fullText).id;
      return method !== 'cash' ? sum + (Number(t?.amount) || 0) : sum;
    }, 0);
  }, [monthlyDeposits]);

  // سحوبات الخزنة الكبيرة في هذا الشهر (مؤمن ومدحت) - تتبع الشهر المستهدف المخصص
  const monthlyWithdrawals = useMemo(() => (transfers || []).filter((t) => {
    if (!t) return false;
    const isWithdraw = t.type === 'withdrawal' || (t.notes || '').includes('[نوع: سحب') || (t.handed_by || '').includes('[نوع: سحب');
    const parsed = getTransferTargetYM(t);
    return isWithdraw && parsed ? parsed.month === month && parsed.year === year : false;
  }), [transfers, month, year]);

  const totalWithdrawnFromBig = useMemo(() => {
    return monthlyWithdrawals.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
  }, [monthlyWithdrawals]);

  // الإجمالي الشامل لصافي أرباح الشهر المقبوضة فعلياً =
  // ما تم دفعه فعلياً (سواء عربون أو كامل) - العمولات - كل مصروفات الشهر
  const grossTreasury = useMemo(() => {
    return (totalRevenueCollected || 0) - (totalCommissions || 0) - (totalExpenses || 0);
  }, [totalRevenueCollected, totalCommissions, totalExpenses]);

  // 1) رصيد الخزنة الكبيرة الفعلي = ما تم توريده إليها - ما تم سحبه منها
  const bigTreasuryBalance = useMemo(() => {
    return totalDepositedToBig - totalWithdrawnFromBig;
  }, [totalDepositedToBig, totalWithdrawnFromBig]);

  // 2) رصيد الخزنة الصغيرة = كاش الحجوزات المقبوض - العمولات - كل المصروفات - ما تم تحويله كاش فقط للكبيرة
  // (المبالغ الإلكترونية إنستا باي وفودافون كاش لا تُخصم من الصغيرة لأنها تذهب مباشرة للكبيرة)
  const smallTreasuryBalance = useMemo(() => {
    if (totalCashRevenueCollected > 0) {
      return totalCashRevenueCollected - (totalCommissions || 0) - (totalExpenses || 0) - totalCashDepositedToBig;
    }
    return (grossTreasury || 0) - totalCashDepositedToBig;
  }, [totalCashRevenueCollected, totalCommissions, totalExpenses, totalCashDepositedToBig, grossTreasury]);

  // ── تفصيل رصيد الخزنة الكبيرة وتجميعات طرق الدفع (كاش، إنستا باي / بنك، فودافون كاش) ──
  const bigTreasuryByMethod = useMemo(() => {
    const summary: Record<PaymentMethodId, { deposited: number; withdrawn: number; balance: number; count: number }> = {
      cash: { deposited: 0, withdrawn: 0, balance: 0, count: 0 },
      instapay: { deposited: 0, withdrawn: 0, balance: 0, count: 0 },
      vodafone_cash: { deposited: 0, withdrawn: 0, balance: 0, count: 0 },
    };

    // جمع التوريدات مع تحديد الطريقة
    monthlyDeposits.forEach((t) => {
      const fullText = `${t.notes || ''} ${t.handed_by || ''} ${t.received_by || ''}`;
      const method = detectPaymentMethod(fullText).id;
      summary[method].deposited += Number(t.amount) || 0;
      summary[method].count += 1;
    });

    // خصم السحوبات
    monthlyWithdrawals.forEach((w) => {
      const fullText = `${w.notes || ''} ${w.handed_by || ''} ${w.received_by || ''}`;
      const method = detectPaymentMethod(fullText).id;
      summary[method].withdrawn += Number(w.amount) || 0;
    });

    (Object.keys(summary) as PaymentMethodId[]).forEach((m) => {
      summary[m].balance = summary[m].deposited - summary[m].withdrawn;
    });

    return summary;
  }, [monthlyDeposits, monthlyWithdrawals]);

  // ── الحسابات المحاسبية المطابقة لشجرة الورقة بالمليم ──
  const totalAccountMonth = (totalRevenueCollected || 0) + (totalRemainingUncollected || 0);
  const monthExpensesAmount = totalExpenses || 0;
  const totalNetExpectedProfit = totalAccountMonth - monthExpensesAmount;
  const uncollectedAmount = totalRemainingUncollected || 0;
  const collectedNetProfit = grossTreasury || 0;
  const branchCashTreasury = smallTreasuryBalance;
  const bankInstapayTreasury = bigTreasuryByMethod['instapay']?.balance || 0;
  const vodafoneCashTreasury = bigTreasuryByMethod['vodafone_cash']?.balance || 0;

  // فلترة سجل التوريدات حسب طريقة الدفع المختارة
  const filteredDeposits = useMemo(() => {
    if (transferFilter === 'all') return monthlyDeposits;
    return monthlyDeposits.filter((t) => {
      const fullText = `${t.notes || ''} ${t.handed_by || ''} ${t.received_by || ''}`;
      return detectPaymentMethod(fullText).id === transferFilter;
    });
  }, [monthlyDeposits, transferFilter]);

  // إرسال تحويل أو سحب
  const submitTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!Number(form.amount) || !form.handedBy.trim() || !form.receivedBy.trim() || !form.date) {
      setError('اكتب المبلغ واسم المسلم والمستلم والتاريخ.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const methodObj = PAYMENT_METHODS.find(m => m.id === form.method) || PAYMENT_METHODS[0];
      const customNotes = form.notes.trim();
      const isWithdrawal = (form.type === 'withdrawal' && isOwner);

      // السحب يقتصر حصرياً على مؤمن أو مدحت
      const finalReceiver = isWithdrawal
        ? (form.receivedBy.includes('مدحت') ? 'مدحت' : 'مؤمن')
        : form.receivedBy;

      const targetM = form.targetMonth !== undefined ? form.targetMonth : month;
      const targetY = form.targetYear || year;
      const monthTag = `[حساب_شهر: ${targetY}-${String(targetM + 1).padStart(2, '0')}]`;
      const typeTag = isWithdrawal ? '[نوع: سحب]' : '';
      const combinedNotes = `${typeTag} [طريقة: ${methodObj.label}] ${monthTag}${customNotes ? ` ${customNotes}` : ''}`.trim();

      const initialStatus = isWithdrawal
        ? `تم الموافقة بواسطة: ${finalReceiver}`
        : (isOwner && form.approvedStatus === 'APPROVED' ? `تم الموافقة بواسطة: ${approverDisplayName}` : 'PENDING');
      const initialApprovedBy = isWithdrawal
        ? finalReceiver
        : (isOwner && form.approvedStatus === 'APPROVED' ? approverDisplayName : '');

      await saveDbTreasuryTransfer({
        amount: form.amount,
        type: isWithdrawal ? 'withdrawal' : 'deposit',
        handed_by: isWithdrawal ? 'الخزنة الكبيرة' : form.handedBy,
        received_by: finalReceiver,
        reason: isWithdrawal ? (customNotes || 'سحب من الخزنة الكبيرة') : undefined,
        transfer_date: form.date,
        notes: combinedNotes,
        status: initialStatus,
        approved_by: initialApprovedBy,
      });
      setForm({
        amount: '',
        handedBy: '',
        receivedBy: 'الخزنة الكبيرة',
        method: form.method,
        date: form.date,
        targetMonth: month,
        targetYear: year,
        notes: '',
        type: 'deposit',
        approvedStatus: 'PENDING',
      });
      await loadData();
    } catch (saveError) {
      console.error(saveError);
      setError('فشل حفظ حركة التحويل.');
    } finally {
      setIsSaving(false);
    }
  };

  // فتح نافذة تعديل حركة التحويل (مؤمن ومدحت فقط)
  const openTransferEditModal = (transfer: TreasuryTransfer) => {
    if (!isOwner) {
      alert('عفواً، تعديل حركات التوريد مقتصر حصرياً على مؤمن ومدحت فقط.');
      return;
    }
    if (isTransferApproved(transfer)) {
      alert('لا يمكن تعديل هذه الحركة لأنها معتمدة رسمياً ومقفلة ضد التعديل. لإجراء تعديل، يجب أولاً إلغاء الاعتماد بواسطة مؤمن أو مدحت.');
      return;
    }
    const fullText = `${transfer.notes || ''} ${transfer.handed_by || ''} ${transfer.received_by || ''}`;
    const detected = detectPaymentMethod(fullText).id;
    const cleanNotes = getCleanTransferNote(transfer);
    const targetYM = getTransferTargetYM(transfer);

    setEditingTransfer(transfer);
    setEditTransferMethod(detected);
    setEditTransferAmount(String(transfer.amount || ''));
    setEditTransferNotes(cleanNotes);
    setEditTransferDate(transfer.transfer_date || '');
    setEditTransferMonth(targetYM ? targetYM.month : month);
    setEditTransferYear(targetYM ? targetYM.year : year);
  };

  // حفظ تعديل حركة التحويل
  const handleSaveTransferEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setError('غير مصرح لك بالتعديل.');
      return;
    }
    if (!editingTransfer) return;
    if (isTransferApproved(editingTransfer)) {
      alert('لا يمكن تعديل حركة معتمدة.');
      return;
    }
    const amt = parseFloat(editTransferAmount);
    if (!amt || amt <= 0) { setError('المبلغ غير صحيح'); return; }

    setIsSavingTransferEdit(true);
    try {
      const methodObj = PAYMENT_METHODS.find(m => m.id === editTransferMethod) || PAYMENT_METHODS[0];
      const customNotes = editTransferNotes.trim();
      const monthTag = `[حساب_شهر: ${editTransferYear}-${String(editTransferMonth + 1).padStart(2, '0')}]`;
      const newNotes = `[طريقة: ${methodObj.label}] ${monthTag}${customNotes ? ` ${customNotes}` : ''}`;

      await updateDbTreasuryTransfer(editingTransfer.id, {
        amount: amt,
        transfer_date: editTransferDate || editingTransfer.transfer_date,
        notes: newNotes,
      });

      setEditingTransfer(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to update transfer:', err);
      setError('فشل تعديل حركة التحويل.');
    } finally {
      setIsSavingTransferEdit(false);
    }
  };

  // حذف حركة تحويل (مؤمن ومدحت فقط)
  const removeTransfer = async (id: string) => {
    if (!isOwner) {
      alert('عفواً، حذف حركات التوريد مقتصر حصرياً على مؤمن ومدحت فقط.');
      return;
    }
    const target = transfers.find(t => t.id === id);
    if (target && isTransferApproved(target)) {
      alert('لا يمكن حذف هذه الحركة لأنها معتمدة رسمياً ومقفلة ضد الحذف. لإجراء حذف، يجب أولاً إلغاء الاعتماد بواسطة مؤمن أو مدحت.');
      return;
    }
    if (!window.confirm('هل تريد حذف هذه الحركة بالتأكيد؟')) return;
    try {
      await deleteDbTreasuryTransfer(id);
      setTransfers((current) => current.filter((transfer) => transfer.id !== id));
    } catch (deleteError) {
      console.error(deleteError);
      setError('فشل حذف الحركة.');
    }
  };

  // سحب من الخزنة الكبيرة (خاص بمؤمن ومدحت فقط)
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setWithdrawError('غير مصرح لك بإجراء سحب من الخزنة الكبيرة.');
      return;
    }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) { setWithdrawError('أدخل مبلغ صحيح'); return; }
    if (!withdrawReason.trim()) { setWithdrawError('اكتب سبب السحب'); return; }
    setIsSavingWithdraw(true);
    setWithdrawError('');
    try {
      const actorName = withdrawBy.includes('مدحت') ? 'مدحت' : 'مؤمن';
      const methodObj = PAYMENT_METHODS.find(m => m.id === withdrawMethod) || PAYMENT_METHODS[0];
      const monthTag = `[حساب_شهر: ${year}-${String(month + 1).padStart(2, '0')}]`;
      await saveDbTreasuryTransfer({
        amount: String(amt),
        type: 'withdrawal',
        handed_by: 'الخزنة الكبيرة',
        received_by: actorName,
        reason: withdrawReason.trim(),
        transfer_date: withdrawDate,
        notes: `[نوع: سحب] [طريقة: ${methodObj.label}] ${monthTag} [سبب: ${withdrawReason.trim()}] [المستلم: ${actorName}]`,
      });
      setWithdrawAmount('');
      setWithdrawReason('');
      setWithdrawSuccess('✅ تم تسجيل السحب بنجاح');
      setTimeout(() => setWithdrawSuccess(''), 3000);
      await loadData();
    } catch (err: any) {
      setWithdrawError('فشل التسجيل: ' + (err.message || ''));
    } finally {
      setIsSavingWithdraw(false);
    }
  };

  // سداد كامل الباقي للحجز
  const markBookingAsFullyPaid = async (booking: any) => {
    if (!window.confirm(`تأكيد استلام كامل المبلغ المتبقي (${money(booking.calculatedRemaining)}) لحجز العميل "${booking.name || 'عميل'}"؟`)) return;
    setMarkingId(booking.id);
    setError('');
    try {
      const total = Number(booking.totalAmount || 0);
      const cleanNotes = (booking.notes || '').replace(/\[مدفوع:[^\]]+\]/g, '').replace(/\[متبقي:[^\]]+\]/g, '').trim();
      const updatedNotes = cleanNotes ? `${cleanNotes} | [مدفوع: ${total}] [متبقي: 0] [حساب خالص]` : `[مدفوع: ${total}] [متبقي: 0] [حساب خالص]`;

      await updateDbBookingStatus(booking.id, {
        paidAmount: total,
        paymentStatus: 'خالص',
        paymentInfo: 'خالص',
        notes: updatedNotes,
      });
      await loadData();
    } catch (err: any) {
      console.error('Failed to mark booking as fully paid:', err);
      setError('فشل تحديث حالة الحجز.');
    } finally {
      setMarkingId(null);
    }
  };

  // فتح نافذة تعديل المدفوع والمتبقي للحجز
  const openEditModal = (booking: any) => {
    setEditingBooking(booking);
    const paid = booking.calculatedPaid ?? booking.totalAmount ?? '';
    setEditPaidInput(String(paid));
    setEditNotesInput(booking.notes || '');
    setEditSplits(parsePaymentSplitsFromString(booking.paymentMethod, Number(paid) || 0));
  };

  const handleAddEditSplit = () => {
    const currentTotal = editSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const bookingTotal = Number(editingBooking?.totalAmount || 0);
    const remaining = Math.max(0, bookingTotal - currentTotal);
    setEditSplits(prev => [
      ...prev,
      { method: 'فيزا', amount: remaining > 0 ? remaining : '' }
    ]);
  };

  const handleRemoveEditSplit = (idx: number) => {
    if (editSplits.length <= 1) {
      setEditSplits([{ method: 'كاش', amount: '' }]);
      return;
    }
    setEditSplits(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateEditSplit = (idx: number, field: 'method' | 'amount', val: any) => {
    setEditSplits(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleFillRemainingEditSplit = () => {
    const currentTotal = editSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const bookingTotal = Number(editingBooking?.totalAmount || 0);
    const remaining = Math.max(0, bookingTotal - currentTotal);
    if (remaining > 0) {
      setEditSplits(prev => [
        ...prev,
        { method: 'فيزا', amount: remaining }
      ]);
    }
  };

  // حفظ تعديل المدفوع والمتبقي للحجز
  const handleSavePaymentBreakdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    const total = Number(editingBooking.totalAmount || 0);

    const validSplits = editSplits.filter(s => s.method && s.amount !== '' && !isNaN(Number(s.amount)));
    const totalSplits = validSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const paid = totalSplits > 0 ? totalSplits : Math.min(total, Math.max(0, parseFloat(editPaidInput) || 0));
    const remaining = Math.max(0, total - paid);
    const isClean = remaining === 0;

    const formattedPaymentMethod = validSplits.length > 0
      ? validSplits.map(s => `${s.method}: ${s.amount} ج.م`).join(' | ')
      : (editingBooking.paymentMethod || 'كاش');

    setIsSavingEdit(true);
    try {
      let notes = editNotesInput.trim();
      notes = notes.replace(/\[مدفوع:[^\]]+\]/g, '').replace(/\[متبقي:[^\]]+\]/g, '').replace(/\[طريقة:[^\]]+\]/g, '').replace(/\[طريقة الدفع:[^\]]+\]/g, '').trim();
      const tagString = `[مدفوع: ${paid}] [متبقي: ${remaining}] [طريقة: ${formattedPaymentMethod}]${isClean ? ' [حساب خالص]' : ''}`;
      const finalNotes = notes ? `${notes} | ${tagString}` : tagString;

      await updateDbBookingStatus(editingBooking.id, {
        paidAmount: paid,
        remainingAmount: remaining,
        paymentMethod: formattedPaymentMethod,
        paymentStatus: isClean ? 'خالص' : 'باقي',
        paymentInfo: isClean ? 'خالص' : `متبقي ${remaining}`,
        notes: finalNotes,
      });

      setEditingBooking(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to update payment amounts:', err);
      setError('فشل حفظ المبالغ المدفوعة.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // قائمة الحجوزات المعروضة
  const displayedBookings = useMemo(() => {
    if (bookingFilter === 'pending') return pendingBookings;
    if (bookingFilter === 'completed') return completedBookings;
    return bookingsWithBreakdown;
  }, [bookingFilter, bookingsWithBreakdown, pendingBookings, completedBookings]);

  // خيارات السنوات
  const yearOptions = useMemo(() => {
    const currentY = today.getFullYear();
    const list: number[] = [];
    for (let y = currentY - 3; y <= currentY + 1; y++) {
      list.push(y);
    }
    return list;
  }, []);

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* ── العنوان وفلتر التاريخ ── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-6 md:p-8 rounded-[2rem] border-2 border-[#EAE4D9] shadow-sm">
        <div className="text-center md:text-right">
          <h1 className="text-3xl md:text-4xl font-black text-[#2A2723]">الخزنة</h1>
          <p className="text-xs md:text-sm font-bold text-[#7A7061] mt-2">
            متابعة حركة النقدية المحصلة بين <span className="text-[#C1A68D] font-black">الخزنة الصغيرة</span> و <span className="text-[#2A2723] font-black">الخزنة الكبيرة</span> ومراجعة التحويلات (كاش / إنستا باي وبنك / فودافون كاش)
          </p>
        </div>
        <div className="flex gap-2 bg-[#FDFBF7] p-2 rounded-2xl border border-[#EAE4D9] shadow-sm mx-auto md:mx-0">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="bg-white rounded-xl px-4 py-2 text-xs font-black outline-none cursor-pointer border border-[#EAE4D9]"
          >
            {MONTHS_AR.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </select>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="bg-white rounded-xl px-4 py-2 text-xs font-black outline-none cursor-pointer border border-[#EAE4D9]"
          >
            {yearOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </header>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 text-xs font-black">{error}</div>}

      {/* ── شجرة الخزنة المحاسبية التفاعلية (طبق الأصل لرسمة الورقة بالمليم) ── */}
      <section className="bg-gradient-to-b from-[#FDFBF7] via-white to-[#F8F5EE] border-2 border-[#D8C7B5] rounded-[2.5rem] p-6 md:p-8 shadow-xl space-y-6">
        
        {/* شريط الإرشاد والتوجيه */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pb-4 border-b border-[#EAE4D9]">
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-9 bg-amber-500 rounded-full" />
            <div>
              <h2 className="text-xl md:text-2xl font-black text-[#2A2723]">
                شجرة الخزنة وحسابات شهر {MONTHS_AR[month]} {year}
              </h2>
              <p className="text-xs text-[#7A7061] font-bold mt-0.5">
                انقر على أي مربع في الشجرة لفتح ما يخصه فوراً في الجدول بالأسفل 👇
              </p>
            </div>
          </div>
          <div className="text-xs font-black bg-amber-50 text-amber-950 px-4 py-2.5 rounded-2xl border-2 border-amber-300 shadow-sm flex items-center gap-2">
            <span className="text-amber-800">المربع المفتوح حالياً:</span>
            <strong className="underline text-sm font-black">
              {activeBox === 'cash' && '🟢 خزنة فرعية (كاش)'}
              {activeBox === 'instapay' && '🔵 حوالات بنكية / انستاباي / فيزا'}
              {activeBox === 'vodafone' && '🔴 ف كاش / محفظة'}
              {activeBox === 'uncollected' && '⏳ مبالغ لم يتم تحصيلها'}
              {activeBox === 'expenses' && '💸 مصروفات شهر'}
              {activeBox === 'total_expected' && '📋 إجمالي الحساب للشهر'}
              {activeBox === 'collected_net' && '✨ ما تم تحصيله'}
              {activeBox === 'net_expected' && '🏆 صافي الربح الشهري الكلي'}
            </strong>
          </div>
        </div>

        {/* ── المستوى الأول: إجمالي الحساب − مصروفات الشهر = صافي الربح الشهري ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          
          {/* 1. إجمالي الحساب للشهر (أكتوبر) */}
          <button
            type="button"
            onClick={() => handleSelectBox('total_expected')}
            className={`p-5 rounded-2xl border-2 text-right transition-all cursor-pointer relative ${
              activeBox === 'total_expected'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xl ring-4 ring-slate-400/50 scale-[1.02]'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-sm'
            }`}
          >
            <div className="text-xs font-bold opacity-80 mb-1">إجمالي الحساب للشهر ({MONTHS_AR[month]})</div>
            <div className="text-2xl md:text-3xl font-black">{isLoading ? '...' : money(totalAccountMonth)}</div>
            <div className="text-[11px] mt-2 opacity-75 font-semibold">
              إجمالي قيمة حجوزات الشهر كاملة (المقبوض + المتبقي)
            </div>
          </button>

          {/* 2. مصروفات شهر (أكتوبر) */}
          <button
            type="button"
            onClick={() => handleSelectBox('expenses')}
            className={`p-5 rounded-2xl border-2 text-right transition-all cursor-pointer relative ${
              activeBox === 'expenses'
                ? 'bg-rose-900 text-white border-rose-900 shadow-xl ring-4 ring-rose-400/50 scale-[1.02]'
                : 'bg-rose-50/70 hover:bg-rose-100/70 border-rose-200 text-rose-950 shadow-sm'
            }`}
          >
            <div className="text-xs font-bold opacity-80 mb-1 flex items-center justify-between">
              <span>مصروفات شهر ({MONTHS_AR[month]})</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                activeBox === 'expenses' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'
              }`}>− طرح</span>
            </div>
            <div className={`text-2xl md:text-3xl font-black ${activeBox === 'expenses' ? 'text-white' : 'text-rose-600'}`}>
              {isLoading ? '...' : money(monthExpensesAmount)}
            </div>
            <div className="text-[11px] mt-2 opacity-75 font-semibold">
              كل المصروفات المسحوبة من الخزنة ({monthlyExpenses.length} مصروف)
            </div>
          </button>

          {/* 3. صافي الربح الشهري (الكلي) */}
          <button
            type="button"
            onClick={() => handleSelectBox('net_expected')}
            className={`p-5 rounded-2xl border-2 text-right transition-all cursor-pointer relative ${
              activeBox === 'net_expected'
                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xl ring-4 ring-emerald-400/50 scale-[1.02]'
                : 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-300 text-emerald-950 shadow-sm'
            }`}
          >
            <div className="text-xs font-bold opacity-80 mb-1 flex items-center justify-between">
              <span>صافي الربح الشهري الكلي</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                activeBox === 'net_expected' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-900'
              }`}>= الناتج</span>
            </div>
            <div className={`text-2xl md:text-3xl font-black ${activeBox === 'net_expected' ? 'text-white' : 'text-emerald-700'}`}>
              {isLoading ? '...' : money(totalNetExpectedProfit)}
            </div>
            <div className="text-[11px] mt-2 opacity-75 font-semibold">
              إجمالي الحساب للشهر − كل المصروفات
            </div>
          </button>

        </div>

        {/* ── أسهم التفرع للمستوى الثاني ── */}
        <div className="flex items-center justify-center gap-3 text-stone-400 font-bold text-xs py-1">
          <div className="h-0.5 flex-1 bg-stone-200" />
          <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full border border-stone-200">
            ⬇️ يتفرع إلى: مبالغ لم يتم تحصيلها + ما تم تحصيله ⬇️
          </span>
          <div className="h-0.5 flex-1 bg-stone-200" />
        </div>

        {/* ── المستوى الثاني: مبالغ لم يتم تحصيلها + ما تم تحصيله ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* مبالغ لم يتم تحصيلها */}
          <button
            type="button"
            onClick={() => handleSelectBox('uncollected')}
            className={`p-6 rounded-2xl border-2 text-right transition-all cursor-pointer relative ${
              activeBox === 'uncollected'
                ? 'bg-amber-100/95 border-amber-600 shadow-xl ring-4 ring-amber-500/40 scale-[1.02]'
                : 'bg-amber-50/60 hover:bg-amber-100/60 border-amber-300 text-amber-950 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-black text-amber-900 flex items-center gap-1.5">
                <Clock size={16} /> مبالغ لم يتم تحصيلها
              </span>
              <span className="text-[10px] bg-amber-200 text-amber-950 px-2.5 py-1 rounded-full font-black border border-amber-300">
                تحت التحصيل
              </span>
            </div>
            <div className="text-3xl font-black text-amber-800 my-2">
              {isLoading ? '...' : money(uncollectedAmount)}
            </div>
            <div className="text-[11px] text-amber-900/80 font-bold">
              مبالغ متبقية على العملاء لم تُدفع بعد — انقر لعرض الحجوزات المعلقة وسدادها
            </div>
          </button>

          {/* ما تم تحصيله (صافي الربح الشهري المحصل) */}
          <button
            type="button"
            onClick={() => handleSelectBox('collected_net')}
            className={`p-6 rounded-2xl border-2 text-right transition-all cursor-pointer relative ${
              activeBox === 'collected_net'
                ? 'bg-emerald-100/95 border-emerald-600 shadow-xl ring-4 ring-emerald-500/40 scale-[1.02]'
                : 'bg-emerald-50/60 hover:bg-emerald-100/60 border-emerald-300 text-emerald-950 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-black text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 size={16} /> ما تم تحصيله (صافي الربح الشهري المحصل)
              </span>
              <span className="text-[10px] bg-emerald-200 text-emerald-950 px-2.5 py-1 rounded-full font-black border border-emerald-300">
                المحصل بالخزائن
              </span>
            </div>
            <div className="text-3xl font-black text-emerald-700 my-2">
              {isLoading ? '...' : money(collectedNetProfit)}
            </div>
            <div className="text-[11px] text-emerald-900/80 font-bold">
              مجموع الخزنة الفرعية الكاش + الحوالات البنكية/إنستاباي + فودافون كاش
            </div>
          </button>

        </div>

        {/* ── أسهم التفرع للمستوى الثالث (الخزنة الفرعية + الخزنة الكبيرة ومحافظها) ── */}
        <div className="flex items-center justify-center gap-3 text-stone-400 font-bold text-xs py-1">
          <div className="h-0.5 flex-1 bg-stone-200" />
          <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full border border-stone-200">
            ⬇️ تفريعة ما تم تحصيله إلى: الخزنة الفرعية (كاش) + الخزنة الكبيرة (الرئيسية) ومحافظها ⬇️
          </span>
          <div className="h-0.5 flex-1 bg-stone-200" />
        </div>

        {/* ── المستوى الثالث: الخزنتان الأساسيتان (الفرعية والكبيرة) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* المربع 1: خزنة فرعية (كاش) [أخضر] */}
          <button
            type="button"
            onClick={() => handleSelectBox('cash')}
            className={`p-5 md:p-6 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between ${
              activeBox === 'cash'
                ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xl ring-4 ring-emerald-400/50 scale-[1.02]'
                : 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-300 text-emerald-950 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-sm md:text-base flex items-center gap-1.5">
                  <Wallet size={18} /> خزنة فرعية (كاش الدرج)
                </span>
                <span className={`text-[10px] md:text-xs font-black px-2.5 py-1 rounded-full border ${
                  activeBox === 'cash' ? 'bg-white text-emerald-800 border-white' : 'bg-emerald-200 text-emerald-900 border-emerald-300'
                }`}>
                  أخضر 🟢
                </span>
              </div>
              <div className="text-2xl md:text-3xl font-black my-2">{isLoading ? '...' : money(branchCashTreasury)}</div>
            </div>
            <div className={`text-[11px] font-bold pt-2.5 border-t mt-2 leading-relaxed ${
              activeBox === 'cash' ? 'border-white/20 text-emerald-100' : 'border-emerald-200 text-emerald-800'
            }`}>
              رصيد الكاش الفعلي في الدرج (المقبوض كاش − المصروفات − المحول كاش)
            </div>
          </button>

          {/* المربع 2: الخزنة الكبيرة (الرئيسية) 🏦 */}
          <button
            type="button"
            onClick={() => handleSelectBox('big_treasury')}
            className={`p-5 md:p-6 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between ${
              activeBox === 'big_treasury'
                ? 'bg-slate-900 text-white border-slate-950 shadow-2xl ring-4 ring-indigo-400/50 scale-[1.02]'
                : 'bg-slate-900/95 hover:bg-slate-900 text-white border-slate-800 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-sm md:text-base flex items-center gap-1.5 text-amber-300">
                  <Building2 size={18} /> الخزنة الكبيرة (الرئيسية)
                </span>
                <span className="text-[10px] md:text-xs font-black px-2.5 py-1 rounded-full bg-amber-400 text-slate-950">
                  الرصيد الفعلي 🏦
                </span>
              </div>
              <div className="text-2xl md:text-3xl font-black text-white my-2">{isLoading ? '...' : money(bigTreasuryBalance)}</div>
            </div>
            <div className="text-[11px] font-bold pt-2.5 border-t border-slate-700/80 text-slate-300 flex items-center justify-between">
              <span>الوارد إليها: <strong className="text-emerald-400">{money(totalDepositedToBig)}</strong></span>
              <span>المسحوب (مؤمن/مدحت): <strong className="text-rose-400">− {money(totalWithdrawnFromBig)}</strong></span>
            </div>
          </button>

        </div>

        {/* ── تفريعة محافظ ومحتويات الخزنة الكبيرة (أزرق • أحمر • كاش مورد) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          
          {/* حوالات بنكية / انستاباي / فيزا [أزرق] */}
          <button
            type="button"
            onClick={() => handleSelectBox('instapay')}
            className={`p-4 md:p-5 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between ${
              activeBox === 'instapay'
                ? 'bg-blue-700 text-white border-blue-800 shadow-2xl ring-4 ring-blue-400/50 scale-[1.02]'
                : 'bg-blue-50 hover:bg-blue-100/80 border-blue-300 text-blue-950 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-xs md:text-sm flex items-center gap-1.5">
                  <Zap size={15} /> حوالات بنكية / انستاباي / فيزا
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  activeBox === 'instapay' ? 'bg-white text-blue-800 border-white' : 'bg-blue-200 text-blue-900 border-blue-300'
                }`}>
                  أزرق 🔵
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black my-1.5">{isLoading ? '...' : money(bankInstapayTreasury)}</div>
            </div>
            <div className={`text-[10px] font-bold pt-2 border-t mt-1.5 leading-relaxed ${
              activeBox === 'instapay' ? 'border-white/20 text-blue-100' : 'border-blue-200 text-blue-800'
            }`}>
              إجمالي رصيد الحساب البنكي وإنستا باي والفيزا (الوارد − المسحوب)
            </div>
          </button>

          {/* ف كاش / محفظة [أحمر] */}
          <button
            type="button"
            onClick={() => handleSelectBox('vodafone')}
            className={`p-4 md:p-5 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between ${
              activeBox === 'vodafone'
                ? 'bg-rose-700 text-white border-rose-800 shadow-2xl ring-4 ring-rose-400/50 scale-[1.02]'
                : 'bg-rose-50 hover:bg-rose-100/80 border-rose-300 text-rose-950 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-xs md:text-sm flex items-center gap-1.5">
                  <Smartphone size={15} /> ف كاش / محفظة
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  activeBox === 'vodafone' ? 'bg-white text-rose-800 border-white' : 'bg-rose-200 text-rose-900 border-rose-300'
                }`}>
                  أحمر 🔴
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black my-1.5">{isLoading ? '...' : money(vodafoneCashTreasury)}</div>
            </div>
            <div className={`text-[10px] font-bold pt-2 border-t mt-1.5 leading-relaxed ${
              activeBox === 'vodafone' ? 'border-white/20 text-rose-100' : 'border-rose-200 text-rose-800'
            }`}>
              إجمالي رصيد ومحفظة فودافون كاش (الوارد − المسحوب)
            </div>
          </button>

          {/* كاش مورد للخزنة الكبيرة من الدرج */}
          <button
            type="button"
            onClick={() => {
              handleSelectBox('big_treasury');
              setTransferFilter('cash');
            }}
            className="p-4 md:p-5 rounded-2xl border-2 text-right transition-all cursor-pointer relative flex flex-col justify-between bg-purple-50 hover:bg-purple-100/80 border-purple-300 text-purple-950 shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-xs md:text-sm flex items-center gap-1.5">
                  <Banknote size={15} /> كاش مورد إليها من الصغيرة
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-purple-200 text-purple-900 border-purple-300">
                  كاش مورد 💵
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black my-1.5">{isLoading ? '...' : money(totalCashDepositedToBig)}</div>
            </div>
            <div className="text-[10px] font-bold pt-2 border-t mt-1.5 leading-relaxed border-purple-200 text-purple-800">
              إجمالي الكاش المنقول للخزنة الكبيرة ({monthlyDeposits.filter(t => detectPaymentMethod(`${t.notes || ''} ${t.handed_by || ''}`).id === 'cash').length} حركة)
            </div>
          </button>

        </div>

      </section>

      {/* ── لوحة تفاصيل المربع المختار (انقر على أي مربع يفتح ما يخصه فوراً) ── */}
      <section id="treasury-detail-viewer" className="scroll-mt-6 bg-white border-2 border-stone-300 rounded-[2.5rem] p-6 md:p-8 shadow-lg space-y-6">
        
        {/* رأس قسم التفاصيل */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2.5">
              <span className={`p-2 rounded-xl text-white font-black ${
                activeBox === 'big_treasury' ? 'bg-slate-900' :
                activeBox === 'cash' ? 'bg-emerald-600' :
                activeBox === 'instapay' ? 'bg-blue-600' :
                activeBox === 'vodafone' ? 'bg-rose-600' :
                activeBox === 'uncollected' ? 'bg-amber-600' :
                activeBox === 'expenses' ? 'bg-rose-700' :
                'bg-slate-800'
              }`}>
                {activeBox === 'big_treasury' && <Building2 size={20} />}
                {activeBox === 'cash' && <Wallet size={20} />}
                {activeBox === 'instapay' && <Zap size={20} />}
                {activeBox === 'vodafone' && <Smartphone size={20} />}
                {activeBox === 'uncollected' && <Clock size={20} />}
                {activeBox === 'expenses' && <Receipt size={20} />}
                {(activeBox === 'total_expected' || activeBox === 'net_expected' || activeBox === 'collected_net') && <Coins size={20} />}
              </span>
              <div>
                <h3 className="text-xl font-black text-stone-900">
                  {activeBox === 'big_treasury' && 'تفاصيل: الخزنة الكبيرة (الرئيسية) 🏦 — إجمالي الرصيد والتحويلات والمسحوبات'}
                  {activeBox === 'cash' && 'تفاصيل: خزنة فرعية (كاش) — رصيد الكاش وحركاته'}
                  {activeBox === 'instapay' && 'تفاصيل: حوالات بنكية / انستاباي / فيزا'}
                  {activeBox === 'vodafone' && 'تفاصيل: ف كاش / محفظة فودافون كاش'}
                  {activeBox === 'uncollected' && 'تفاصيل: مبالغ لم يتم تحصيلها (المتبقي على العملاء)'}
                  {activeBox === 'expenses' && `تفاصيل: مصروفات شهر ${MONTHS_AR[month]} ${year}`}
                  {activeBox === 'total_expected' && `تفاصيل: إجمالي الحساب وكافة حجوزات شهر ${MONTHS_AR[month]} ${year}`}
                  {activeBox === 'collected_net' && `تفاصيل: ما تم تحصيله (صافي أرباح الشهر المحصلة)`}
                  {activeBox === 'net_expected' && `تفاصيل: صافي الربح الشهري الكلي لشهر ${MONTHS_AR[month]} ${year}`}
                </h3>
                <p className="text-xs text-stone-500 font-bold">
                  {activeBox === 'big_treasury' && 'مجموع المبالغ الموردة بالكامل مخصوماً منها مسحوبات الشركاء لمؤمن ومدحت'}
                  {activeBox === 'cash' && 'بيان حركات الكاش المسحوبة والموردة ورصيد الدرج الصافي المتبقي'}
                  {activeBox === 'instapay' && 'بيان حركات التحويل البنكي والإنستاباي والفيزا الموردة للخزنة الكبيرة'}
                  {activeBox === 'vodafone' && 'بيان حركات وتحويلات فودافون كاش والمحافظ الإلكترونية'}
                  {activeBox === 'uncollected' && 'قائمة بجميع الحجوزات المعلقة التي عليها متبقي لسداده أو تصفيره'}
                  {activeBox === 'expenses' && 'قائمة بكافة أذونات وفواتير الصرف المسحوبة من الخزنة الصغيرة'}
                  {(activeBox === 'total_expected' || activeBox === 'net_expected' || activeBox === 'collected_net') && 'قائمة بالحجوزات المؤكدة والإيرادات المقبوضة'}
                </p>
              </div>
            </div>
          </div>

          {/* تبديل سريع بين المربعات */}
          <div className="flex flex-wrap gap-1.5 bg-stone-100 p-1.5 rounded-2xl border border-stone-200">
            <button
              onClick={() => handleSelectBox('big_treasury')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${activeBox === 'big_treasury' ? 'bg-slate-900 text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
            >
              الخزنة الكبيرة 🏦
            </button>
            <button
              onClick={() => handleSelectBox('cash')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${activeBox === 'cash' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
            >
              كاش 🟢
            </button>
            <button
              onClick={() => handleSelectBox('instapay')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${activeBox === 'instapay' ? 'bg-blue-600 text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
            >
              إنستاباي/بنك 🔵
            </button>
            <button
              onClick={() => handleSelectBox('vodafone')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${activeBox === 'vodafone' ? 'bg-rose-600 text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
            >
              ف كاش 🔴
            </button>
            <button
              onClick={() => handleSelectBox('uncollected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${activeBox === 'uncollected' ? 'bg-amber-600 text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
            >
              تحت التحصيل ⏳
            </button>
            <button
              onClick={() => handleSelectBox('expenses')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${activeBox === 'expenses' ? 'bg-rose-700 text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
            >
              المصروفات 💸
            </button>
          </div>
        </div>

        {/* ── محتوى المربع المختار ── */}
        {/* الحالة 0: الخزنة الكبيرة (الرئيسية) 🏦 */}
        {activeBox === 'big_treasury' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 text-white p-5 rounded-2xl border-2 border-slate-800 shadow-md">
                <p className="text-xs text-amber-400 font-bold mb-1 flex items-center gap-1.5">
                  <Building2 size={16} /> الرصيد الفعلي الحالي للخزنة الكبيرة
                </p>
                <p className="text-3xl font-black text-amber-300">{money(bigTreasuryBalance)}</p>
                <p className="text-[11px] text-slate-400 mt-2">
                  إجمالي الوارد ({money(totalDepositedToBig)}) − المسحوب لمؤمن ومدحت ({money(totalWithdrawnFromBig)})
                </p>
              </div>

              <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200">
                <p className="text-xs text-emerald-800 font-bold mb-1 flex items-center gap-1.5">
                  <ArrowDownRight size={16} /> إجمالي ما تم توريده للخزنة الكبيرة
                </p>
                <p className="text-2xl font-black text-emerald-900">{money(totalDepositedToBig)}</p>
                <p className="text-[11px] text-emerald-700 mt-2">
                  {monthlyDeposits.length} حركة توريد (كاش + إنستاباي + فودافون كاش)
                </p>
              </div>

              <div className="bg-rose-50/80 p-5 rounded-2xl border border-rose-200">
                <p className="text-xs text-rose-800 font-bold mb-1 flex items-center gap-1.5">
                  <ArrowUpRight size={16} /> إجمالي مسحوبات الشركاء (مؤمن ومدحت)
                </p>
                <p className="text-2xl font-black text-rose-700">− {money(totalWithdrawnFromBig)}</p>
                <p className="text-[11px] text-rose-600 mt-2">
                  {monthlyWithdrawals.length} حركة سحب مسجلة من الخزنة الكبيرة
                </p>
              </div>
            </div>

            {/* تفصيل أرصدة المحافظ بالداخل */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-200">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Zap size={14} className="text-blue-600" /> إنستاباي والبنك
                </span>
                <span className="text-sm font-black text-blue-700">{money(bankInstapayTreasury)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-rose-200">
                <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <Smartphone size={14} className="text-rose-600" /> فودافون كاش
                </span>
                <span className="text-sm font-black text-rose-700">{money(vodafoneCashTreasury)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-purple-200">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Banknote size={14} className="text-purple-600" /> كاش مورد من الدرج
                </span>
                <span className="text-sm font-black text-purple-700">{money(totalCashDepositedToBig)}</span>
              </div>
            </div>

            {/* أزرار سريعة للانتقال للتوريد أو السحب */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap gap-2">
                <a
                  href="#transfer-entry-form"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5"
                >
                  <Plus size={14} /> تسجيل توريد للخزنة الكبيرة
                </a>
                <a
                  href="#withdraw-entry-form"
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5"
                >
                  <ArrowDownLeft size={14} /> سحب أرباح لمؤمن أو مدحت
                </a>
              </div>
              <p className="text-xs text-stone-500 font-bold">
                يمكنك مراجعة وتعديل حركات التوريد والمسحوبات في الجداول أسفله 👇
              </p>
            </div>
          </div>
        )}
        {/* الحالة 1: كاش 🟢 */}
        {activeBox === 'cash' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
              <div>
                <p className="text-[10px] text-emerald-800 font-bold">كاش الحجوزات المقبوض</p>
                <p className="text-lg font-black text-emerald-950">{money(totalCashRevenueCollected || (totalRevenueCollected - totalElectronicDepositedToBig))}</p>
              </div>
              <div>
                <p className="text-[10px] text-rose-800 font-bold">كل المصروفات المسحوبة</p>
                <p className="text-lg font-black text-rose-700">− {money(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-[10px] text-indigo-800 font-bold">المحول كاش للكبيرة</p>
                <p className="text-lg font-black text-indigo-900">− {money(totalCashDepositedToBig)}</p>
              </div>
              <div className="bg-emerald-600 text-white p-2.5 rounded-xl text-center">
                <p className="text-[10px] text-emerald-100 font-bold">رصيد الكاش المتبقي في الدرج</p>
                <p className="text-xl font-black">{money(branchCashTreasury)}</p>
              </div>
            </div>

            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
              <h4 className="font-black text-xs text-stone-800 mb-2">حركات التوريد الكاش المحولة للخزنة الكبيرة ({monthlyDeposits.filter(t => detectPaymentMethod(`${t.notes || ''} ${t.handed_by || ''}`).id === 'cash').length} حركة):</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {monthlyDeposits.filter(t => detectPaymentMethod(`${t.notes || ''} ${t.handed_by || ''}`).id === 'cash').map(t => (
                  <div key={t.id} className="p-2.5 bg-white rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-black text-emerald-700">{money(Number(t.amount))}</span>
                      <span className="text-stone-500 mr-2">مسلم من: {t.handed_by} ⬅️ مستلم: {t.received_by}</span>
                    </div>
                    <span className="text-stone-400 text-[11px] font-mono">{t.transfer_date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* الحالة 2: حوالات بنكية / انستاباي / فيزا 🔵 */}
        {activeBox === 'instapay' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-blue-50/70 p-4 rounded-2xl border border-blue-200">
              <div>
                <p className="text-[10px] text-blue-800 font-bold">إجمالي المحول للبنك وإنستا باي</p>
                <p className="text-lg font-black text-blue-950">{money(bigTreasuryByMethod['instapay']?.deposited || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-rose-800 font-bold">المسحوب منه</p>
                <p className="text-lg font-black text-rose-700">− {money(bigTreasuryByMethod['instapay']?.withdrawn || 0)}</p>
              </div>
              <div className="bg-blue-600 text-white p-2.5 rounded-xl text-center">
                <p className="text-[10px] text-blue-100 font-bold">صافي رصيد البنك وإنستا باي</p>
                <p className="text-xl font-black">{money(bankInstapayTreasury)}</p>
              </div>
            </div>

            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
              <h4 className="font-black text-xs text-stone-800 mb-2">حركات إنستا باي والتحويل البنكي المسجلة:</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {monthlyDeposits.filter(t => detectPaymentMethod(`${t.notes || ''} ${t.handed_by || ''}`).id === 'instapay').map(t => (
                  <div key={t.id} className="p-2.5 bg-white rounded-xl border border-blue-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-black text-blue-700">{money(Number(t.amount))}</span>
                      <span className="text-stone-500 mr-2">من: {t.handed_by} ⬅️ إلى: {t.received_by}</span>
                      {t.notes && <span className="text-[11px] text-stone-400 block mt-0.5">{t.notes}</span>}
                    </div>
                    <span className="text-stone-400 text-[11px] font-mono">{t.transfer_date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* الحالة 3: ف كاش / محفظة 🔴 */}
        {activeBox === 'vodafone' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-rose-50/70 p-4 rounded-2xl border border-rose-200">
              <div>
                <p className="text-[10px] text-rose-800 font-bold">إجمالي المحول لمحفظة فودافون كاش</p>
                <p className="text-lg font-black text-rose-950">{money(bigTreasuryByMethod['vodafone_cash']?.deposited || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-600 font-bold">المسحوب منه</p>
                <p className="text-lg font-black text-stone-700">− {money(bigTreasuryByMethod['vodafone_cash']?.withdrawn || 0)}</p>
              </div>
              <div className="bg-rose-600 text-white p-2.5 rounded-xl text-center">
                <p className="text-[10px] text-rose-100 font-bold">صافي رصيد محفظة ف كاش</p>
                <p className="text-xl font-black">{money(vodafoneCashTreasury)}</p>
              </div>
            </div>

            <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
              <h4 className="font-black text-xs text-stone-800 mb-2">حركات فودافون كاش المسجلة:</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {monthlyDeposits.filter(t => detectPaymentMethod(`${t.notes || ''} ${t.handed_by || ''}`).id === 'vodafone_cash').map(t => (
                  <div key={t.id} className="p-2.5 bg-white rounded-xl border border-rose-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-black text-rose-700">{money(Number(t.amount))}</span>
                      <span className="text-stone-500 mr-2">من: {t.handed_by} ⬅️ إلى: {t.received_by}</span>
                      {t.notes && <span className="text-[11px] text-stone-400 block mt-0.5">{t.notes}</span>}
                    </div>
                    <span className="text-stone-400 text-[11px] font-mono">{t.transfer_date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* الحالة 4: مبالغ لم يتم تحصيلها ⏳ */}
        {activeBox === 'uncollected' && (
          <div className="space-y-4">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-900 font-black">إجمالي المتبقي تحت التحصيل على العملاء</p>
                <p className="text-2xl font-black text-amber-800">{money(uncollectedAmount)}</p>
              </div>
              <span className="text-xs font-black bg-amber-200 text-amber-950 px-3 py-1.5 rounded-xl">
                {pendingBookings.length} حجز معلق عليه باقي
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-amber-200 bg-white">
              <table className="w-full text-right text-xs">
                <thead className="bg-amber-100/70 text-amber-950 font-black">
                  <tr>
                    <th className="p-3">اسم العميل</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">المدفوع</th>
                    <th className="p-3 text-red-600">المتبقي المطلوب</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3 text-center">إجراء سريع</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBookings.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-stone-400 font-bold">لا توجد مبالغ متبقية، كل الحسابات خالصة ومحصلة بنجاح ✅</td></tr>
                  ) : (
                    pendingBookings.map(b => (
                      <tr key={b.id} className="border-t border-amber-100 hover:bg-amber-50/50">
                        <td className="p-3 font-bold text-stone-900">{b.name || b.customerName}</td>
                        <td className="p-3 font-bold">{money(b.totalAmount)}</td>
                        <td className="p-3 font-bold text-emerald-700">{money(b.calculatedPaid)}</td>
                        <td className="p-3 font-black text-red-600 text-sm">{money(b.calculatedRemaining)}</td>
                        <td className="p-3 text-stone-500 font-mono">{b.checkIn}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => markBookingAsFullyPaid(b)}
                            disabled={markingId === b.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-black text-[11px] transition cursor-pointer"
                          >
                            {markingId === b.id ? 'جاري السداد...' : 'سداد كامل الباقي ✓'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* الحالة 5: المصروفات 💸 */}
        {activeBox === 'expenses' && (
          <div className="space-y-4">
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-900 font-black">إجمالي مصروفات شهر {MONTHS_AR[month]} {year}</p>
                <p className="text-2xl font-black text-rose-700">{money(monthExpensesAmount)}</p>
              </div>
              <span className="text-xs font-black bg-rose-200 text-rose-950 px-3 py-1.5 rounded-xl">
                {monthlyExpenses.length} فاتورة وإذن صرف
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white max-h-80 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-rose-100/70 text-rose-950 font-black sticky top-0">
                  <tr>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">البيان / الفاتورة</th>
                    <th className="p-3">المصروف إليه</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyExpenses.map((e, idx) => (
                    <tr key={idx} className="border-t border-stone-100 hover:bg-rose-50/30">
                      <td className="p-3 font-black text-rose-700">{money(Number(e.amount))}</td>
                      <td className="p-3 font-mono text-stone-500">{e.date}</td>
                      <td className="p-3 font-semibold text-stone-800">{e.description || e.category}</td>
                      <td className="p-3 text-stone-600">{e.to_entity || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* الحالة 6: إجمالي الحساب / صافي الربح / ما تم تحصيله 📋 */}
        {(activeBox === 'total_expected' || activeBox === 'net_expected' || activeBox === 'collected_net') && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-stone-100/70 p-4 rounded-2xl border border-stone-200">
              <div>
                <p className="text-[10px] text-stone-600 font-bold">إجمالي الحساب</p>
                <p className="text-base font-black text-stone-900">{money(totalAccountMonth)}</p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-800 font-bold">المحصل بالخزائن</p>
                <p className="text-base font-black text-emerald-700">{money(collectedNetProfit)}</p>
              </div>
              <div>
                <p className="text-[10px] text-amber-800 font-bold">تحت التحصيل</p>
                <p className="text-base font-black text-amber-700">{money(uncollectedAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-stone-600 font-bold">عدد الحجوزات</p>
                <p className="text-base font-black text-stone-900">{monthlyBookings.length} حجز مؤكد</p>
              </div>
            </div>

            <p className="text-xs text-stone-500 font-bold text-center">
              يمكنك الاطلاع على الجدول الكامل لكل الحجوزات أو التحويلات في الأقسام أسفله 👇
            </p>
          </div>
        )}

      </section>

      {/* ── كروت توزيع رصيد الخزنة الكبيرة وتجميعات طرق التحويل (تفاعلية للفلترة) ── */}
      <section className="bg-gradient-to-b from-[#FAF7F2] via-amber-50/20 to-white border-2 border-[#D8C7B5] rounded-[2.5rem] p-6 md:p-8 shadow-lg">
        <div className="flex flex-col items-center text-center justify-center gap-2.5 mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-[#2A2723] flex items-center justify-center gap-3">
            <Coins size={28} className="text-[#A88B70]" />
            توزيع رصيد الخزنة الكبيرة وإجمالي المحافظ
          </h2>
          <p className="text-xs md:text-base font-bold text-[#7A7061]">
            اضغط على أي كارت لفلترة حركات التحويل الخاصة به ومراجعتها بضغطة زر واحدة
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <span className="text-xs md:text-sm font-black text-[#2A2723] bg-white px-5 py-2.5 rounded-xl border-2 border-[#D8C7B5] shadow-sm">
              إجمالي رصيد المحافظ: {money(bigTreasuryBalance)}
            </span>
            {transferFilter !== 'all' && (
              <button
                onClick={() => setTransferFilter('all')}
                className="text-xs md:text-sm font-black text-blue-700 hover:underline cursor-pointer bg-blue-50 px-4 py-2.5 rounded-xl border-2 border-blue-200 shadow-sm"
              >
                عرض كل التحويلات 🔄
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PAYMENT_METHODS.map((pm) => {
            const Icon = pm.icon;
            const data = bigTreasuryByMethod[pm.id] || { deposited: 0, withdrawn: 0, balance: 0, count: 0 };
            const isSelected = transferFilter === pm.id;
            return (
              <div
                key={pm.id}
                onClick={() => setTransferFilter(isSelected ? 'all' : pm.id)}
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden shadow-sm ${
                  isSelected
                    ? pm.cardSelected
                    : `${pm.cardBorder} ${pm.cardBg}`
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`p-2.5 rounded-xl border ${pm.color}`}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <span className={`text-sm font-black block ${pm.textColor}`}>{pm.label}</span>
                      <span className="text-[10px] text-[#7A7061] font-bold">{data.count} تحويل مسجل</span>
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="text-[10px] bg-[#2A2723] text-white px-2.5 py-1 rounded-full font-bold shadow-sm">
                      محدد للجدول ✓
                    </span>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${pm.badgeColor}`}>
                      انقر للمراجعة
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#7A7061]">إجمالي المحول (الوارد):</div>
                  <div className={`text-2xl font-black ${pm.textColor}`}>
                    {isLoading ? '...' : money(data.deposited)}
                  </div>
                </div>

                <div className="text-[10px] text-[#7A7061] font-bold mt-3 pt-2.5 border-t border-[#EAE4D9]/60 flex justify-between">
                  <span className="text-red-600 font-bold">المسحوب منه: {money(data.withdrawn)}</span>
                  <span className={`font-black ${pm.textColor}`}>الصافي: {money(data.balance)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── جدول حركات التوريد (من الخزنة الصغيرة إلى الخزنة الكبيرة) مع الفلترة والتعديل ── */}
      <section className="bg-gradient-to-b from-indigo-50/90 via-blue-50/30 to-white border-2 border-indigo-300 rounded-[2.5rem] overflow-hidden shadow-lg p-6 md:p-8">
        <div className="flex flex-col items-center text-center justify-center gap-3 mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-indigo-950 flex items-center justify-center gap-3">
            <ArrowDownRight size={28} className="text-indigo-600" />
            سجل حركات التوريد (من الصغيرة إلى الكبيرة)
          </h2>
          <p className="text-xs md:text-base font-bold text-indigo-900/80">
            كل مبالغ التحويل المنقولة للخزنة الكبيرة مع إمكانية تعديل طريقة الدفع لأي حركة بنقرة واحدة
          </p>

          {/* تبويبات الفلترة السريعة */}
          <div className="flex flex-wrap items-center justify-center gap-2 bg-white/90 p-2 rounded-2xl border-2 border-indigo-200 shadow-sm mt-1">
            <button
              onClick={() => setTransferFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                transferFilter === 'all' ? 'bg-indigo-950 text-white shadow-sm' : 'text-[#7A7061] hover:text-indigo-900'
              }`}
            >
              الكل ({monthlyDeposits.length})
            </button>
            {PAYMENT_METHODS.map((pm) => {
              const count = bigTreasuryByMethod[pm.id]?.count || 0;
              const isSelected = transferFilter === pm.id;
              return (
                <button
                  key={pm.id}
                  onClick={() => setTransferFilter(pm.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isSelected ? pm.activeBg : 'text-[#7A7061] hover:text-indigo-900'
                  }`}
                >
                  {pm.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ملخص إجماليات التحويلات */}
        <div className="bg-indigo-100/60 px-6 py-3.5 rounded-2xl border-2 border-indigo-200 mb-4 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-indigo-950 shadow-sm">
          <div className="flex items-center gap-4">
            <span>إجمالي التحويلات المعروضة: <strong className="text-base text-indigo-900 font-black">{money(filteredDeposits.reduce((sum, t) => sum + (Number(t.amount) || 0), 0))}</strong></span>
            <span>عدد الحركات: <strong className="text-indigo-900 font-black">{filteredDeposits.length}</strong></span>
          </div>
          {transferFilter !== 'all' && (
            <span className="text-xs font-black text-indigo-900 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-sm">
              مفلتر حالياً: {PAYMENT_METHODS.find(m => m.id === transferFilter)?.label}
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border-2 border-indigo-300 shadow-sm bg-white">
          <table className="w-full text-right text-xs">
            <thead className="bg-gradient-to-r from-blue-950 via-indigo-900 to-blue-950 text-white font-black">
              <tr>
                <th className="p-4 text-white">المبلغ</th>
                <th className="p-4 text-white">طريقة التحويل</th>
                <th className="p-4 text-white">مسلم (من)</th>
                <th className="p-4 text-white">مستلم (إلى)</th>
                <th className="p-4 text-white">ملاحظة</th>
                <th className="p-4 text-white">التاريخ</th>
                <th className="p-4 text-center text-white">حالة الاعتماد</th>
                <th className="p-4 text-center text-white">تعديل / حذف</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-[#7A7061] font-bold">لا توجد حركات توريد مسجلة في هذا التبويب</td></tr>
              ) : (
                filteredDeposits.map((transfer) => {
                  const fullText = `${transfer.notes || ''} ${transfer.handed_by || ''} ${transfer.received_by || ''}`;
                  const method = detectPaymentMethod(fullText);
                  const methodObj = PAYMENT_METHODS.find(m => m.id === method.id) || PAYMENT_METHODS[0];
                  const MethodIcon = methodObj.icon;
                  const cleanNotes = getCleanTransferNote(transfer);
                  const approved = isTransferApproved(transfer);
                  const approver = getTransferApprover(transfer);

                  return (
                    <tr
                      key={transfer.id}
                      className={`border-t font-bold transition-colors ${
                        approved
                          ? 'border-indigo-100/70 hover:bg-indigo-50/30 bg-white'
                          : 'border-amber-200/80 bg-amber-50/40 hover:bg-amber-50/70'
                      }`}
                    >
                      <td className="p-4 text-[#2A2723] font-black text-sm">{money(Number(transfer.amount))}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border ${methodObj.color}`}>
                          <MethodIcon size={14} />
                          {methodObj.label}
                        </span>
                      </td>
                      <td className="p-4 text-[#2A2723]">{transfer.handed_by}</td>
                      <td className="p-4 text-[#7A7061]">{transfer.received_by}</td>
                      <td className="p-4 text-[#2A2723] max-w-xs break-words" title={cleanNotes}>
                        {cleanNotes ? (
                          <span className="text-[#2A2723] font-semibold">{cleanNotes}</span>
                        ) : (
                          <span className="text-[#A59D90] font-normal">—</span>
                        )}
                      </td>
                      <td className="p-4 text-[#7A7061] whitespace-nowrap">
                        <div className="font-bold text-[#2A2723]">{transfer.transfer_date}</div>
                        {(() => {
                          const targetYM = getTransferTargetYM(transfer);
                          const actualYM = parseDateYM(transfer.transfer_date);
                          if (targetYM && actualYM && (targetYM.month !== actualYM.month || targetYM.year !== actualYM.year)) {
                            return (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-lg text-[9px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300">
                                🏷️ حساب {MONTHS_AR[targetYM.month]} {targetYM.year} (مبكّر)
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>

                      {/* عمود حالة الاعتماد (Approve) */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {isOwner ? (
                          <button
                            type="button"
                            disabled={togglingTransferId === transfer.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTransferApproval(transfer);
                            }}
                            title={approved ? "اضغط لإلغاء الاعتماد (فتح للتعديل)" : "اضغط للاعتماد الفوري بضغطة واحدة"}
                            className={`group/btn relative inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl font-black text-xs transition-all duration-200 shadow-sm active:scale-95 cursor-pointer border select-none ${
                              approved
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-amber-500/10'
                            }`}
                          >
                            {togglingTransferId === transfer.id ? (
                              <div className="flex items-center gap-2 px-2 py-0.5">
                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                <span className="text-[10px]">جاري التحديث...</span>
                              </div>
                            ) : approved ? (
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-white text-emerald-600 flex items-center justify-center text-xs font-black shadow-xs shrink-0">✓</span>
                                <div className="flex flex-col text-right leading-tight">
                                  <span className="text-[11px] font-black">
                                    معتمد ({approver || approverDisplayName})
                                  </span>
                                  <span className="text-[9px] text-emerald-100 font-bold opacity-80 group-hover/btn:opacity-100">اضغط للإلغاء ✕</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-amber-400/80 text-amber-950 flex items-center justify-center text-xs font-black shadow-xs shrink-0">⏳</span>
                                <div className="flex flex-col text-right leading-tight">
                                  <span className="text-[11px] font-black text-amber-950">غير معتمد</span>
                                  <span className="text-[9px] text-emerald-800 font-black bg-emerald-100/90 px-1.5 py-0.5 rounded-md mt-0.5 group-hover/btn:bg-emerald-200">⚡ اضغط للموافقة</span>
                                </div>
                              </div>
                            )}
                          </button>
                        ) : (
                          approved ? (
                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-200 font-black text-xs">
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                              <span>معتمد ✅ {approver ? `(${approver})` : ''}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full border border-amber-200 font-black text-xs">
                              <Clock size={14} className="text-amber-600 shrink-0" />
                              <span>قيد الوصول ⏳</span>
                            </div>
                          )
                        )}
                      </td>

                      {/* عمود الإجراءات (خاص بمؤمن ومدحت فقط، ومقفل تماماً عند الاعتماد) */}
                      <td className="p-4 text-center">
                        {approved ? (
                          <div
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-black select-none shadow-xs"
                            title="هذه الحركة معتمدة ومقفلة ضد التعديل. لإجراء تعديل يجب على الإدارة إلغاء الاعتماد أولاً."
                          >
                            <Lock size={12} className="text-gray-400 shrink-0" />
                            <span>مغلق ضد التعديل 🔒</span>
                          </div>
                        ) : isOwner ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openTransferEditModal(transfer)}
                              title="تعديل طريقة الدفع أو المبلغ (خاص بمؤمن ومدحت)"
                              className="bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 px-2.5 py-1.5 rounded-xl font-black text-[10px] inline-flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <Edit3 size={12} />
                              تعديل الطريقة
                            </button>
                            <button
                              onClick={() => removeTransfer(transfer.id)}
                              title="حذف الحركة (خاص بمؤمن ومدحت)"
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors p-1.5 rounded-lg cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-200 select-none">
                            عرض فقط 🔒
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── نافذة تعديل حركة التحويل (طريقة الدفع / المبلغ / الملاحظات) ── */}
      {editingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border-2 border-[#EAE4D9] rounded-[2rem] w-full max-w-md p-6 shadow-2xl space-y-5 animate-scale-in" dir="rtl">
            <div className="flex items-center justify-between border-b border-[#EAE4D9]/60 pb-3">
              <div>
                <h3 className="text-base font-black text-[#2A2723]">تعديل طريقة التحويل وبيانات الحركة</h3>
                <p className="text-[11px] font-bold text-[#7A7061] mt-0.5">
                  من: {editingTransfer.handed_by} ⬅️ إلى: {editingTransfer.received_by} ({editingTransfer.transfer_date})
                </p>
              </div>
              <button
                onClick={() => setEditingTransfer(null)}
                className="text-[#7A7061] hover:text-black font-black text-xl p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransferEdit} className="space-y-4">
              <div>
                <label className="text-xs font-black text-[#2A2723] block mb-1.5">
                  طريقة التحويل الصحيحة
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {PAYMENT_METHODS.map((pm) => {
                    const Icon = pm.icon;
                    const isSelected = editTransferMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setEditTransferMethod(pm.id)}
                        className={`p-3 rounded-xl border-2 flex items-center justify-between font-black text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#2A2723] bg-[#FDFBF7] ring-2 ring-[#2A2723]/10 text-[#2A2723]'
                            : 'border-[#EAE4D9] bg-white text-[#7A7061] hover:border-[#C1A68D]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={16} />
                          {pm.label}
                        </span>
                        {isSelected && <span className="text-emerald-600 font-black">✓ محدد</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-[#2A2723] block mb-1.5">
                  مبلغ التحويل
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={editTransferAmount}
                  onChange={(e) => setEditTransferAmount(e.target.value)}
                  className="w-full border border-[#EAE4D9] rounded-xl px-4 py-2.5 text-sm font-black bg-[#FDFBF7] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-[#2A2723] block mb-1.5">
                    تسميع في حساب شهر
                  </label>
                  <select
                    value={editTransferMonth}
                    onChange={(e) => setEditTransferMonth(Number(e.target.value))}
                    className="w-full border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-black bg-[#FDFBF7] outline-none cursor-pointer"
                  >
                    {MONTHS_AR.map((name, index) => (
                      <option key={name} value={index}>{name} {editTransferYear}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-[#2A2723] block mb-1.5">
                    تاريخ المعاملة الفعلي
                  </label>
                  <input
                    type="date"
                    value={editTransferDate}
                    onChange={(e) => setEditTransferDate(e.target.value)}
                    className="w-full border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-black bg-[#FDFBF7] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-[#2A2723] block mb-1.5">
                  ملاحظات التحويل
                </label>
                <input
                  value={editTransferNotes}
                  onChange={(e) => setEditTransferNotes(e.target.value)}
                  className="w-full border border-[#EAE4D9] rounded-xl px-4 py-2.5 text-xs font-bold bg-[#FDFBF7] outline-none"
                  placeholder="ملاحظة إضافية..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingTransferEdit}
                  className="flex-1 bg-[#2A2723] hover:bg-black text-white font-black py-3 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingTransferEdit ? 'جاري الحفظ...' : 'حفظ التعديل وتحديث الخزنة 💾'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTransfer(null)}
                  className="px-4 bg-[#FDFBF7] hover:bg-white border border-[#EAE4D9] text-[#7A7061] font-black rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── نموذج نقل مبلغ من الخزنة الصغيرة إلى الخزنة الكبيرة (توريد) ── */}
      <section id="transfer-entry-form" className="scroll-mt-6 bg-gradient-to-b from-amber-50/70 via-orange-50/20 to-white border-2 border-amber-300 rounded-[2.5rem] p-6 md:p-8 shadow-md">
        <div className="flex flex-col items-center text-center justify-center gap-2 mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-amber-950 flex items-center justify-center gap-3">
            <ArrowUpRight size={28} className="text-amber-600" />
            نقل مبلغ من الخزنة الصغيرة إلى الخزنة الكبيرة
          </h2>
          <p className="text-xs md:text-base font-bold text-amber-900/80 mt-1">
            تسجيل تحويل النقدية المحصلة مع تحديد طريقة التحويل لتسميعها فوراً في الخزنة الكبيرة
          </p>
        </div>

        <form onSubmit={submitTransfer} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 items-end">
          <label className="text-[10px] font-black text-[#7A7061]">
            المبلغ
            <input
              required
              type="number"
              min="1"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              className="mt-2 w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-sm font-black bg-white outline-none focus:border-amber-400"
              placeholder="0"
            />
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            طريقة التحويل
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethodId })}
              className="mt-2 w-full border-2 border-amber-200 rounded-xl px-3 py-3 text-xs font-black bg-white cursor-pointer outline-none focus:border-amber-400"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.label}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            المسلّم (من)
            <input
              required
              value={form.handedBy}
              onChange={(event) => setForm({ ...form, handedBy: event.target.value })}
              className="mt-2 w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-sm font-black bg-white outline-none focus:border-amber-400"
              placeholder="اسم الأدمن المسلّم"
            />
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            المستلم (إلى)
            <input
              required
              value={form.receivedBy}
              onChange={(event) => setForm({ ...form, receivedBy: event.target.value })}
              className="mt-2 w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-sm font-black bg-white outline-none focus:border-amber-400"
              placeholder="الخزنة الكبيرة"
            />
          </label>
          <label className="text-[10px] font-black text-amber-950 bg-amber-100/70 p-1.5 rounded-xl border border-amber-300">
            تسميع في حساب شهر
            <select
              value={form.targetMonth !== undefined ? form.targetMonth : month}
              onChange={(e) => setForm({ ...form, targetMonth: Number(e.target.value) })}
              className="mt-1.5 w-full border border-amber-300 rounded-xl px-2 py-2 text-xs font-black bg-white cursor-pointer outline-none focus:border-amber-500"
            >
              {MONTHS_AR.map((name, index) => (
                <option key={name} value={index}>
                  {name} {year} {index === month ? '⭐ (المعروض)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            التاريخ
            <input
              required
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              className="mt-2 w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-sm font-black bg-white outline-none focus:border-amber-400"
            />
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            ملاحظة
            <input
              placeholder="ملاحظات التحويل..."
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="mt-2 w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-sm font-black bg-white outline-none focus:border-amber-400"
            />
          </label>
          {isOwner && (
            <label className="text-[10px] font-black text-emerald-950 bg-emerald-50/90 p-1.5 rounded-xl border border-emerald-300">
              حالة الاعتماد
              <select
                value={form.approvedStatus}
                onChange={(e) => setForm({ ...form, approvedStatus: e.target.value as 'PENDING' | 'APPROVED' })}
                className="mt-1.5 w-full border border-emerald-300 rounded-xl px-2 py-2 text-xs font-black bg-white cursor-pointer outline-none focus:border-emerald-500"
              >
                <option value="PENDING">⏳ غير معتمد (قيد الوصول)</option>
                <option value="APPROVED">✅ معتمد فوراً ({approverDisplayName})</option>
              </select>
            </label>
          )}
          <div className="col-span-full flex justify-end mt-2">
            <button
              disabled={isSaving}
              className="bg-[#2A2723] hover:bg-black text-white rounded-xl px-8 py-3.5 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 h-[46px] transition-colors cursor-pointer shadow-md"
            >
              <Plus size={16} /> {isSaving ? 'جاري التحويل...' : 'تسجيل التحويل'}
            </button>
          </div>
        </form>
      </section>

      {/* ── قسم السحب من الخزنة الكبيرة (خاص بـ Owner: مؤمن ومدحت فقط - يظهر فوق الحجوزات) ── */}
      {isOwner && (
        <section id="withdraw-entry-form" className="scroll-mt-6 bg-gradient-to-b from-rose-100/70 via-red-50/30 to-white border-2 border-rose-300 rounded-[2.5rem] p-6 md:p-8 shadow-lg">
          <div className="flex flex-col items-center text-center justify-center gap-2 mb-6">
            <h2 className="text-2xl md:text-3xl font-black text-red-700 flex items-center justify-center gap-3">
              <ArrowDownLeft size={28} className="text-red-600" />
              سحب من الخزنة الكبيرة
            </h2>
            <p className="text-xs md:text-base font-bold text-red-900/80 mt-1">
              حدد طريقة السحب (كاش، إنستا باي / بنك، فودافون كاش) ليتم خصمها من رصيد المحفظة المحددة
            </p>
            <div className="inline-flex items-center gap-2 bg-white px-5 py-2.5 rounded-xl border-2 border-red-200 shadow-sm mt-3">
              <span className="text-xs font-bold text-[#7A7061]">إجمالي سحوبات الشهر:</span>
              <span className="text-base font-black text-red-600">{money(totalWithdrawnFromBig)}</span>
            </div>
          </div>

          {withdrawError && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-black mb-4">{withdrawError}</div>}
          {withdrawSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-xs font-black mb-4">{withdrawSuccess}</div>}

          <form onSubmit={handleWithdrawSubmit} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <label className="text-[10px] font-black text-[#7A7061]">
              المبلغ المسحوب
              <input
                required
                type="number"
                min="1"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                className="mt-2 w-full border-2 border-red-200 rounded-xl px-4 py-3 text-sm font-black bg-white outline-none focus:border-red-400"
                placeholder="0"
              />
            </label>
            <label className="text-[10px] font-black text-[#7A7061]">
              طريقة السحب
              <select
                value={withdrawMethod}
                onChange={e => setWithdrawMethod(e.target.value as PaymentMethodId)}
                className="mt-2 w-full border-2 border-red-200 rounded-xl px-3 py-3 text-xs font-black bg-white cursor-pointer outline-none focus:border-red-400"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.id} value={pm.id}>{pm.label}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black text-[#7A7061]">
              المسحوب لـ (المستلم)
              <select
                value={withdrawBy}
                onChange={e => setWithdrawBy(e.target.value)}
                className="mt-2 w-full border-2 border-red-200 rounded-xl px-4 py-3 text-sm font-black bg-white cursor-pointer outline-none focus:border-red-400"
              >
                <option value="مؤمن">مؤمن</option>
                <option value="مدحت">مدحت</option>
              </select>
            </label>
            <label className="text-[10px] font-black text-[#7A7061] sm:col-span-2">
              السبب / البيان
              <input
                required
                value={withdrawReason}
                onChange={e => setWithdrawReason(e.target.value)}
                className="mt-2 w-full border-2 border-red-200 rounded-xl px-4 py-3 text-sm font-black bg-white outline-none focus:border-red-400"
                placeholder="سحبت المبلغ ليه؟ (توزيع أرباح / التزام شخصي...)"
              />
            </label>
            <label className="text-[10px] font-black text-[#7A7061]">
              التاريخ
              <input
                required
                type="date"
                value={withdrawDate}
                onChange={e => setWithdrawDate(e.target.value)}
                className="mt-2 w-full border-2 border-red-200 rounded-xl px-4 py-3 text-sm font-black bg-white outline-none focus:border-red-400"
              />
            </label>
            <button
              disabled={isSavingWithdraw}
              className="sm:col-span-6 bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-3 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 h-[46px] transition-colors cursor-pointer shadow-md shadow-red-600/20"
            >
              <ArrowDownLeft size={16} /> {isSavingWithdraw ? 'جاري تسجيل السحب...' : 'تسجيل سحب من الخزنة الكبيرة'}
            </button>
          </form>

          {/* جدول سحوبات الخزنة الكبيرة */}
          <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-rose-300 bg-white shadow-sm">
            <div className="p-4 bg-gradient-to-b from-rose-100/90 to-red-50/60 border-b-2 border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
              <h3 className="text-base md:text-lg font-black text-rose-950 flex items-center justify-center gap-2">
                <Receipt size={20} className="text-rose-600" />
                سجل سحوبات الخزنة الكبيرة لهذا الشهر
              </h3>
              <span className="text-xs font-black text-red-700 bg-white px-3 py-1.5 rounded-lg border-2 border-rose-200 shadow-sm">
                {monthlyWithdrawals.length} حركة سحب
              </span>
            </div>
            <table className="w-full text-right text-xs">
              <thead className="bg-gradient-to-r from-red-950 via-rose-900 to-red-950 text-white font-black">
                <tr>
                  <th className="p-4 text-white">المبلغ</th>
                  <th className="p-4 text-white">طريقة السحب</th>
                  <th className="p-4 text-white">المسحوب لـ</th>
                  <th className="p-4 text-white">السبب / البيان</th>
                  <th className="p-4 text-white">التاريخ</th>
                  <th className="p-4 text-white text-center">حذف</th>
                </tr>
              </thead>
              <tbody>
                {monthlyWithdrawals.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-[#7A7061] font-bold">لا يوجد أي سحب من الخزنة الكبيرة في هذا الشهر</td></tr>
                ) : (
                  monthlyWithdrawals.map(w => {
                    const fullText = `${w.notes || ''} ${w.handed_by || ''} ${w.received_by || ''}`;
                    const method = detectPaymentMethod(fullText);
                    const methodObj = PAYMENT_METHODS.find(m => m.id === method.id) || PAYMENT_METHODS[0];
                    const MethodIcon = methodObj.icon;

                    const reasonMatch = (w.notes || '').match(/\[سبب:\s*([^\]]+)\]/);
                    const reason = reasonMatch ? reasonMatch[1] : (w.notes?.replace(/\[[^\]]+\]/g, '').trim() || '—');
                    const actorMatch = (w.notes || '').match(/\[المستلم:\s*([^\]]+)\]/);
                    const actor = actorMatch ? actorMatch[1] : (w.received_by || '—');
                    return (
                      <tr key={w.id} className="border-t border-rose-100 font-bold hover:bg-rose-50/40 transition-colors">
                        <td className="p-4 text-red-600 font-black">{money(Number(w.amount))}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black border ${methodObj.color}`}>
                            <MethodIcon size={13} />
                            {methodObj.label}
                          </span>
                        </td>
                        <td className="p-4 text-[#2A2723]">{actor}</td>
                        <td className="p-4 text-[#7A7061]">{reason}</td>
                        <td className="p-4">{w.transfer_date}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => removeTransfer(w.id)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                            title="حذف حركة السحب"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── جدول حركة الحجوزات (المقبوض والمتبقي بدقة) ── */}
      <section className="bg-gradient-to-b from-emerald-50/90 via-teal-50/30 to-white border-2 border-emerald-300 rounded-[2.5rem] p-6 md:p-8 shadow-lg overflow-hidden">
        <div className="flex flex-col items-center text-center justify-center gap-2.5 mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-emerald-950 flex items-center justify-center gap-3">
            <Banknote size={28} className="text-emerald-600" />
            حسابات حجوزات الشهر (المقبوض فعلياً والمتبقي)
          </h2>
          <p className="text-xs md:text-base font-bold text-emerald-900/80">
            كل حجز يوضح كم تم دفعه فعلياً (دخل الخزنة) وكم المتبقي على العميل (خارج الخزنة)
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 bg-white/90 p-2 rounded-2xl border-2 border-emerald-200 mt-2 shadow-sm">
            <button
              onClick={() => setBookingFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                bookingFilter === 'all' ? 'bg-[#2A2723] text-white shadow-sm' : 'text-[#7A7061] hover:text-[#2A2723]'
              }`}
            >
              الكل ({bookingsWithBreakdown.length})
            </button>
            <button
              onClick={() => setBookingFilter('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                bookingFilter === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-800 hover:text-amber-900'
              }`}
            >
              عليه متبقي ({pendingBookings.length})
            </button>
            <button
              onClick={() => setBookingFilter('completed')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                bookingFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              خالص ({completedBookings.length})
            </button>
          </div>
        </div>

        {displayedBookings.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border-2 border-dashed border-emerald-200">
            <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
            <p className="text-xs font-black text-[#2A2723]">لا توجد حجوزات في هذا التبويب لهذا الشهر</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border-2 border-emerald-400 bg-white shadow-sm">
            <table className="w-full text-right text-xs">
              <thead className="bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 text-white font-black">
                <tr>
                  <th className="p-4 text-white">العميل</th>
                  <th className="p-4 text-white">الوحدة</th>
                  <th className="p-4 text-white">الدخول - الخروج</th>
                  <th className="p-4 text-white">إجمالي الحجز</th>
                  <th className="p-4 bg-emerald-800/80 text-emerald-100">تم دفع (بالخزنة) 🟢</th>
                  <th className="p-4 text-white">طريقة الدفع 💳</th>
                  <th className="p-4 bg-amber-800/80 text-amber-100">المتبقي (خارجها) ⏳</th>
                  <th className="p-4 text-white">الحالة</th>
                  <th className="p-4 text-white">الملاحظات</th>
                  <th className="p-4 text-center text-white">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {displayedBookings.map((b) => (
                  <tr key={b.id} className="border-t border-[#EAE4D9]/60 font-bold hover:bg-[#FDFBF7] transition-colors">
                    <td className="p-4">
                      <div className="font-black text-[#2A2723]">{b.name || 'عميل'}</div>
                      <div className="text-[10px] text-[#7A7061] font-mono">{b.phone || '—'}</div>
                    </td>
                    <td className="p-4 text-[#C1A68D] font-black">{b.apartmentId || b.studio || '—'}</td>
                    <td className="p-4 text-[#7A7061] text-[11px]">{b.checkIn} ⬅️ {b.checkOut}</td>
                    <td className="p-4 font-black text-[#2A2723]">{money(Number(b.totalAmount) || 0)}</td>
                    <td className="p-4 bg-emerald-50/30 font-black text-emerald-700 text-sm">
                      {money(b.calculatedPaid)}
                    </td>
                    <td className="p-4">
                      {b.paymentMethod ? (
                        <span className="inline-block text-[11px] font-black bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-xl max-w-xs break-words shadow-sm">
                          {b.paymentMethod}
                        </span>
                      ) : (
                        <span className="text-[#A59D90] font-normal text-xs">—</span>
                      )}
                    </td>
                    <td className="p-4 bg-amber-50/30 font-black text-sm">
                      {b.calculatedRemaining > 0 ? (
                        <span className="text-rose-600">{money(b.calculatedRemaining)}</span>
                      ) : (
                        <span className="text-emerald-600 text-xs">0 (خالص ✔️)</span>
                      )}
                    </td>
                    <td className="p-4">
                      {b.isFullyPaid ? (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-black border border-emerald-200">
                          خالص ✔️
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-200">
                          باقي فلوس ❌
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-[10px] text-[#7A7061] max-w-xs truncate" title={b.notes}>
                      {b.notes || '—'}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(b)}
                          className="bg-[#FDFBF7] hover:bg-white text-[#7A7061] hover:text-[#2A2723] border border-[#EAE4D9] px-2.5 py-1.5 rounded-xl font-black text-[10px] inline-flex items-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer"
                          title="تعديل المبلغ المدفوع والمتبقي"
                        >
                          <Edit3 size={12} />
                          تعديل المدفوع
                        </button>
                        {!b.isFullyPaid && (
                          <button
                            disabled={markingId === b.id}
                            onClick={() => markBookingAsFullyPaid(b)}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-xl font-black text-[10px] inline-flex items-center gap-1 transition-all shadow-sm shadow-emerald-600/20 active:scale-95 cursor-pointer"
                            title="سداد كامل المبلغ المتبقي بضغطة زر"
                          >
                            <CheckCircle2 size={12} />
                            {markingId === b.id ? '...' : 'سداد الباقي'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── نافذة تعديل المدفوع والمتبقي للحجز ── */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border-2 border-[#EAE4D9] rounded-[2rem] w-full max-w-lg md:max-w-xl p-6 shadow-2xl space-y-5 animate-scale-in" dir="rtl">
            <div className="flex items-center justify-between border-b border-[#EAE4D9]/60 pb-3">
              <div>
                <h3 className="text-base font-black text-[#2A2723]">تعديل حساب الحجز وطرق الدفع</h3>
                <p className="text-[11px] font-bold text-[#7A7061] mt-0.5">
                  العميل: {editingBooking.name || 'عميل'} ({editingBooking.apartmentId || editingBooking.studio})
                </p>
              </div>
              <button
                onClick={() => setEditingBooking(null)}
                className="text-[#7A7061] hover:text-black font-black text-xl p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePaymentBreakdown} className="space-y-4">
              <div className="bg-[#FDFBF7] p-3.5 rounded-2xl border border-[#EAE4D9] flex justify-between items-center text-xs">
                <span className="font-bold text-[#7A7061]">إجمالي قيمة الحجز:</span>
                <span className="font-black text-base text-[#2A2723]">{money(Number(editingBooking.totalAmount || 0))}</span>
              </div>

              {/* طرق الدفع والتوزيع بالخزنة */}
              <div className="space-y-3 bg-gradient-to-b from-[#FBF9F5] to-white p-4 rounded-2xl border-2 border-[#D8C7B5]">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#D8C7B5]/60">
                  <div>
                    <label className="text-xs font-black text-[#2A2723] flex items-center gap-1.5">
                      <CreditCard size={16} className="text-[#A88B70]" />
                      <span>توزيع طرق الدفع (كاش / فيزا / إنستا باي / فودافون كاش)</span>
                    </label>
                    <p className="text-[10px] font-bold text-[#7A7061] mt-0.5">
                      يمكنك تقسيم المبلغ على أكثر من طريقة دفع لتسجيلها بالخزنة بدقة
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEditSplit}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>إضافة طريقة</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {editSplits.map((split, idx) => {
                    const isCustom = !['كاش', 'فيزا', 'إنستا باي / حساب بنكي', 'فودافون كاش'].includes(split.method);
                    return (
                      <div key={idx} className="bg-white p-2.5 rounded-xl border border-[#EAE4D9] shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <span className="text-xs font-black text-[#A88B70] w-4">{idx + 1}.</span>
                          <select
                            value={isCustom ? 'أخرى' : split.method}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateEditSplit(idx, 'method', val === 'أخرى' ? '' : val);
                            }}
                            className="bg-[#FAF7F2] border border-[#D8C7B5] rounded-xl px-2.5 py-1.5 text-xs font-black text-[#2A2723] outline-none flex-1"
                          >
                            <option value="كاش">💵 كاش (نقدي)</option>
                            <option value="فيزا">💳 فيزا / بطاقة بنكية</option>
                            <option value="إنستا باي / حساب بنكي">⚡ إنستا باي / حساب بنكي</option>
                            <option value="فودافون كاش">📱 فودافون كاش</option>
                            <option value="أخرى">📝 أخرى...</option>
                          </select>
                          {isCustom && (
                            <input
                              type="text"
                              placeholder="اسم الطريقة"
                              value={split.method}
                              onChange={(e) => handleUpdateEditSplit(idx, 'method', e.target.value)}
                              className="bg-white border border-[#D8C7B5] rounded-xl px-2.5 py-1 text-xs font-black text-[#2A2723] outline-none w-28"
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-1">
                          <label className="text-[10px] font-black text-[#7A7061] whitespace-nowrap">المبلغ:</label>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              value={split.amount}
                              onChange={(e) => handleUpdateEditSplit(idx, 'amount', e.target.value)}
                              placeholder="0"
                              className="w-full bg-white border border-[#D8C7B5] rounded-xl px-3 py-1.5 text-xs font-black text-[#2A2723] outline-none"
                            />
                            <span className="absolute left-2.5 top-1.5 text-[10px] font-bold text-[#7A7061]">ج.م</span>
                          </div>
                        </div>

                        {editSplits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEditSplit(idx)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg font-black"
                            title="حذف"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const splitsTotal = editSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
                  const bookingTotal = Number(editingBooking?.totalAmount || 0);
                  const remaining = Math.max(0, bookingTotal - splitsTotal);
                  return (
                    <div className="bg-white p-2.5 rounded-xl border border-[#D8C7B5] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#7A7061]">
                          الموزع: <strong className="text-emerald-700 font-black">{money(splitsTotal)}</strong>
                        </span>
                        {remaining > 0 ? (
                          <span className="text-rose-600 font-black">
                            المتبقي: {money(remaining)}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-black">
                            خالص ✔️
                          </span>
                        )}
                      </div>

                      {remaining > 0 && (
                        <button
                          type="button"
                          onClick={handleFillRemainingEditSplit}
                          className="text-[10px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg"
                        >
                          ➕ إضافة المتبقي ({money(remaining)})
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="text-xs font-black text-[#2A2723] block mb-1.5">
                  ملاحظات الحساب (اختياري)
                </label>
                <input
                  value={editNotesInput}
                  onChange={(e) => setEditNotesInput(e.target.value)}
                  className="w-full border border-[#EAE4D9] rounded-xl px-4 py-2.5 text-xs font-bold bg-[#FDFBF7] outline-none"
                  placeholder="مثال: دفع عربون 1000 وباقي 2000 عند الدخول"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 bg-[#2A2723] hover:bg-black text-white font-black py-3 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit ? 'جاري الحفظ...' : 'حفظ وتحديث الخزنة 💾'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="px-4 bg-[#FDFBF7] hover:bg-white border border-[#EAE4D9] text-[#7A7061] font-black rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
