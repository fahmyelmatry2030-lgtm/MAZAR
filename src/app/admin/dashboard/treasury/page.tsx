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
  Banknote,
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// طرق الدفع والتحويل المدعومة (إنستا باي وحساب بنكي مدمجين معاً بناءً على طلب العميل)
const PAYMENT_METHODS = [
  { id: 'cash', label: 'كاش', icon: Banknote, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', activeBg: 'bg-emerald-600 text-white' },
  { id: 'instapay', label: 'إنستا باي / حساب بنكي', icon: Zap, color: 'text-purple-700 bg-purple-50 border-purple-200', activeBg: 'bg-purple-600 text-white' },
  { id: 'vodafone_cash', label: 'فودافون كاش', icon: Smartphone, color: 'text-red-700 bg-red-50 border-red-200', activeBg: 'bg-red-600 text-white' },
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
};

const money = (value: number) => `${Math.round(value).toLocaleString('ar-EG')} ج.م`;

export default function TreasuryPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<TreasuryTransfer[]>([]);

  // نموذج إضافة تحويل من الخزنة الصغيرة إلى الخزنة الكبيرة
  const [form, setForm] = useState({
    amount: '',
    handedBy: '',
    receivedBy: 'الخزنة الكبيرة',
    method: 'cash' as PaymentMethodId,
    date: today.toISOString().slice(0, 10),
    notes: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // فلتر مراجعة التحويلات حسب طريقة الدفع
  const [transferFilter, setTransferFilter] = useState<'all' | PaymentMethodId>('all');

  // فلتر جدول الحجوزات
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // نافذة تعديل المدفوع والمتبقي للحجز
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editPaidInput, setEditPaidInput] = useState<string>('');
  const [editNotesInput, setEditNotesInput] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // نافذة تعديل حركة التحويل (المبلغ / طريقة الدفع / الملاحظات)
  const [editingTransfer, setEditingTransfer] = useState<any | null>(null);
  const [editTransferMethod, setEditTransferMethod] = useState<PaymentMethodId>('cash');
  const [editTransferAmount, setEditTransferAmount] = useState<string>('');
  const [editTransferNotes, setEditTransferNotes] = useState<string>('');
  const [isSavingTransferEdit, setIsSavingTransferEdit] = useState(false);

  // --- Owner detection ---
  const [adminInfo, setAdminInfo] = useState<any>(null);
  useEffect(() => {
    const info = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminInfo') || '{}') : {};
    setAdminInfo(info);
  }, []);

  const isOwner = useMemo(() => {
    const name = (adminInfo?.name || '').trim();
    const username = (adminInfo?.username || '').toLowerCase().trim();
    const role = (adminInfo?.role || '').toLowerCase().trim();
    return (
      ['مؤمن', 'مدحت'].some(n => name.includes(n)) ||
      ['mo2men', 'medhat'].some(u => username.includes(u)) ||
      role === 'owner'
    );
  }, [adminInfo]);

  // نموذج سحب من الخزنة الكبيرة (مؤمن / مدحت)
  const defaultOwnerName = useMemo(() => {
    return adminInfo?.name?.includes('مدحت') ? 'مدحت' : 'مؤمن';
  }, [adminInfo]);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethodId>('cash');
  const [withdrawDate, setWithdrawDate] = useState(today.toISOString().slice(0, 10));
  const [withdrawBy, setWithdrawBy] = useState('مؤمن');
  const [isSavingWithdraw, setIsSavingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  useEffect(() => {
    if (adminInfo?.name) {
      setWithdrawBy(adminInfo.name.includes('مدحت') ? 'مدحت' : 'مؤمن');
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
  // حجوزات الشهر المؤكدة
  const monthlyBookings = useMemo(() => (bookings || []).filter((booking) => {
    if (!booking || !CONFIRMED_STATUSES.includes(String(booking.status))) return false;
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
  } = useMemo(() => {
    let revPaid = 0;
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

      return {
        ...b,
        calculatedPaid: p,
        calculatedRemaining: r,
        isFullyPaid: r === 0,
      };
    });

    return {
      totalRevenueCollected: revPaid,
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

  // تحويلات الشهر (من الخزنة الصغيرة إلى الخزنة الكبيرة)
  const monthlyDeposits = useMemo(() => (transfers || []).filter((t) => {
    if (!t) return false;
    const isWithdraw = (t.notes || '').includes('[نوع: سحب من الرئيسية]') || (t.notes || '').includes('[نوع: سحب]');
    const parsed = parseDateYM(t.transfer_date);
    return !isWithdraw && parsed ? parsed.month === month && parsed.year === year : false;
  }), [transfers, month, year]);

  const totalDepositedToBig = useMemo(() => {
    return monthlyDeposits.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
  }, [monthlyDeposits]);

  // سحوبات الخزنة الكبيرة في هذا الشهر (مؤمن ومدحت)
  const monthlyWithdrawals = useMemo(() => (transfers || []).filter((t) => {
    if (!t) return false;
    const isWithdraw = (t.notes || '').includes('[نوع: سحب من الرئيسية]') || (t.notes || '').includes('[نوع: سحب]');
    const parsed = parseDateYM(t.transfer_date);
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

  // 2) رصيد الخزنة الصغيرة = صافي المقبوض فعلياً بعد المصروفات - ما تم تحويله للخزنة الكبيرة
  const smallTreasuryBalance = useMemo(() => {
    return (grossTreasury || 0) - totalDepositedToBig;
  }, [grossTreasury, totalDepositedToBig]);

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

  // فلترة سجل التوريدات حسب طريقة الدفع المختارة
  const filteredDeposits = useMemo(() => {
    if (transferFilter === 'all') return monthlyDeposits;
    return monthlyDeposits.filter((t) => {
      const fullText = `${t.notes || ''} ${t.handed_by || ''} ${t.received_by || ''}`;
      return detectPaymentMethod(fullText).id === transferFilter;
    });
  }, [monthlyDeposits, transferFilter]);

  // إرسال تحويل من الخزنة الصغيرة إلى الخزنة الكبيرة
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
      const combinedNotes = `[طريقة: ${methodObj.label}]${customNotes ? ` ${customNotes}` : ''}`;

      await saveDbTreasuryTransfer({
        amount: form.amount,
        handed_by: form.handedBy,
        received_by: form.receivedBy,
        transfer_date: form.date,
        notes: combinedNotes,
      });
      setForm({
        amount: '',
        handedBy: '',
        receivedBy: 'الخزنة الكبيرة',
        method: form.method,
        date: form.date,
        notes: ''
      });
      await loadData();
    } catch (saveError) {
      console.error(saveError);
      setError('فشل حفظ حركة التحويل.');
    } finally {
      setIsSaving(false);
    }
  };

  // فتح نافذة تعديل حركة التحويل
  const openTransferEditModal = (transfer: TreasuryTransfer) => {
    const fullText = `${transfer.notes || ''} ${transfer.handed_by || ''} ${transfer.received_by || ''}`;
    const detected = detectPaymentMethod(fullText).id;
    const cleanNotes = (transfer.notes || '').replace(/\[طريقة:[^\]]+\]/g, '').replace(/\[نوع:[^\]]+\]/g, '').trim();

    setEditingTransfer(transfer);
    setEditTransferMethod(detected);
    setEditTransferAmount(String(transfer.amount || ''));
    setEditTransferNotes(cleanNotes);
  };

  // حفظ تعديل حركة التحويل
  const handleSaveTransferEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransfer) return;
    const amt = parseFloat(editTransferAmount);
    if (!amt || amt <= 0) { setError('المبلغ غير صحيح'); return; }

    setIsSavingTransferEdit(true);
    try {
      const methodObj = PAYMENT_METHODS.find(m => m.id === editTransferMethod) || PAYMENT_METHODS[0];
      const customNotes = editTransferNotes.trim();
      const newNotes = `[طريقة: ${methodObj.label}]${customNotes ? ` ${customNotes}` : ''}`;

      await updateDbTreasuryTransfer(editingTransfer.id, {
        amount: amt,
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

  // حذف حركة تحويل
  const removeTransfer = async (id: string) => {
    if (!window.confirm('هل تريد حذف هذه الحركة بالتأكيد؟')) return;
    try {
      await deleteDbTreasuryTransfer(id);
      setTransfers((current) => current.filter((transfer) => transfer.id !== id));
    } catch (deleteError) {
      console.error(deleteError);
      setError('فشل حذف الحركة.');
    }
  };

  // سحب من الخزنة الكبيرة (خاص بمؤمن ومدحت)
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) { setWithdrawError('أدخل مبلغ صحيح'); return; }
    if (!withdrawReason.trim()) { setWithdrawError('اكتب سبب السحب'); return; }
    setIsSavingWithdraw(true);
    setWithdrawError('');
    try {
      const actorName = withdrawBy.trim() || defaultOwnerName;
      const methodObj = PAYMENT_METHODS.find(m => m.id === withdrawMethod) || PAYMENT_METHODS[0];
      await saveDbTreasuryTransfer({
        amount: String(amt),
        handed_by: 'الخزنة الكبيرة',
        received_by: actorName,
        transfer_date: withdrawDate,
        notes: `[نوع: سحب من الرئيسية] [طريقة: ${methodObj.label}] [سبب: ${withdrawReason.trim()}] [المستلم: ${actorName}]`,
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
    setEditPaidInput(String(booking.calculatedPaid ?? booking.totalAmount ?? ''));
    setEditNotesInput(booking.notes || '');
  };

  // حفظ تعديل المدفوع والمتبقي للحجز
  const handleSavePaymentBreakdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    const total = Number(editingBooking.totalAmount || 0);
    const paid = Math.min(total, Math.max(0, parseFloat(editPaidInput) || 0));
    const remaining = Math.max(0, total - paid);
    const isClean = remaining === 0;

    setIsSavingEdit(true);
    try {
      let notes = editNotesInput.trim();
      notes = notes.replace(/\[مدفوع:[^\]]+\]/g, '').replace(/\[متبقي:[^\]]+\]/g, '').trim();
      const tagString = `[مدفوع: ${paid}] [متبقي: ${remaining}]${isClean ? ' [حساب خالص]' : ''}`;
      const finalNotes = notes ? `${notes} | ${tagString}` : tagString;

      await updateDbBookingStatus(editingBooking.id, {
        paidAmount: paid,
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
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl font-black text-[#2A2723]">الخزنة</h1>
          <p className="text-sm font-bold text-[#7A7061] mt-2">
            متابعة حركة النقدية المحصلة بين <span className="text-[#C1A68D]">الخزنة الصغيرة</span> و <span className="text-[#2A2723]">الخزنة الكبيرة</span> ومراجعة التحويلات (كاش / إنستا باي وبنك / فودافون كاش)
          </p>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-2xl border border-[#EAE4D9] shadow-sm">
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="bg-[#FDFBF7] rounded-xl px-3 py-2 text-xs font-black outline-none cursor-pointer border border-[#EAE4D9]/60"
          >
            {MONTHS_AR.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </select>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="bg-[#FDFBF7] rounded-xl px-3 py-2 text-xs font-black outline-none cursor-pointer border border-[#EAE4D9]/60"
          >
            {yearOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </header>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 text-xs font-black">{error}</div>}

      {/* ── كروت إحصائيات الخزائن الرئيسية ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* كارت الخزنة الصغيرة */}
        <div className="bg-white border-2 border-[#EAE4D9] p-6 rounded-[2rem] shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#7A7061] text-xs font-black">
                <Wallet size={18} className="text-[#C1A68D]" /> الخزنة الصغيرة (الفرعية)
              </div>
              <span className="text-[10px] bg-[#FDFBF7] text-[#7A7061] px-2.5 py-1 rounded-full font-bold border border-[#EAE4D9]">
                المتبقي للتحويل
              </span>
            </div>
            <div className="text-3xl font-black text-[#2A2723] mt-5">
              {isLoading ? '...' : money(smallTreasuryBalance)}
            </div>
          </div>
          <p className="text-[10px] text-[#7A7061] font-bold mt-4 pt-3 border-t border-[#EAE4D9]/60 leading-relaxed">
            صافي المقبوض فعلياً ({money(totalRevenueCollected - totalCommissions)}) − كل المصروفات ({money(totalExpenses)}) − المحول للكبيرة ({money(totalDepositedToBig)})
          </p>
        </div>

        {/* كارت الخزنة الكبيرة (الرصيد الإجمالي) */}
        <div className="bg-[#2A2723] text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#C1A68D] text-xs font-black">
                <ArrowLeftRight size={18} /> الخزنة الكبيرة (الرئيسية)
              </div>
              <span className="text-[10px] bg-white/10 text-[#C1A68D] px-2.5 py-1 rounded-full font-bold">
                الرصيد الفعلي
              </span>
            </div>
            <div className="text-3xl font-black text-white mt-5">
              {isLoading ? '...' : money(bigTreasuryBalance)}
            </div>
          </div>
          <div className="text-[10px] text-white/70 font-bold mt-4 pt-3 border-t border-white/10 flex justify-between">
            <span>المحول إليها: {money(totalDepositedToBig)}</span>
            <span className="text-red-300">المسحوب منها: {money(totalWithdrawnFromBig)}</span>
          </div>
        </div>

        {/* كارت إجمالي صافي الأرباح المقبوضة فعلياً */}
        <div className="bg-[#FDFBF7] border border-[#EAE4D9] p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-[#7A7061]">صافي أرباح الشهر</div>
              <span className="text-[10px] bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-bold border border-green-200">
                المحصل بالخزائن
              </span>
            </div>
            <div className="text-3xl font-black text-green-700 mt-5">
              {isLoading ? '...' : money(grossTreasury)}
            </div>
          </div>
          <p className="text-[10px] text-[#7A7061] font-bold mt-4 pt-3 border-t border-[#EAE4D9]/60">
            الصغيرة ({money(smallTreasuryBalance)}) + الكبيرة ({money(bigTreasuryBalance)}) + المسحوب ({money(totalWithdrawnFromBig)})
          </p>
        </div>

        {/* كارت مبالغ تحت التحصيل (متبقي على العملاء) */}
        <div className="bg-amber-50/60 border-2 border-amber-200/80 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-black">
              <Clock size={16} /> مبالغ تحت التحصيل
            </div>
            <div className="text-3xl font-black text-amber-800 mt-5">
              {isLoading ? '...' : money(totalRemainingUncollected)}
            </div>
          </div>
          <p className="text-[10px] text-amber-700 font-bold mt-4 pt-3 border-t border-amber-200/60 leading-relaxed">
            مبالغ متبقية على العملاء لم تُدفع بعد — لا تدخل في الخزنة حتى يتم تحصيلها وتصفير المتبقي.
          </p>
        </div>
      </section>

      {/* ── كروت توزيع رصيد الخزنة الكبيرة وتجميعات طرق التحويل (تفاعلية للفلترة) ── */}
      <section className="bg-white border border-[#EAE4D9] rounded-[2rem] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-base font-black text-[#2A2723]">توزيع رصيد الخزنة الكبيرة وإجمالي المحافظ</h2>
            <p className="text-[11px] font-bold text-[#7A7061]">
              اضغط على أي كارت لفلترة حركات التحويل الخاصة به ومراجعتها بضغطة زر واحدة
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#C1A68D] bg-[#FDFBF7] px-3 py-1.5 rounded-xl border border-[#EAE4D9]">
              إجمالي رصيد المحافظ: {money(bigTreasuryBalance)}
            </span>
            {transferFilter !== 'all' && (
              <button
                onClick={() => setTransferFilter('all')}
                className="text-[11px] font-black text-blue-600 hover:underline cursor-pointer bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200"
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
                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'border-[#2A2723] bg-[#FDFBF7] shadow-md ring-2 ring-[#2A2723]/10 scale-[1.02]'
                    : 'border-[#EAE4D9] bg-[#FDFBF7] hover:border-[#C1A68D] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`p-2.5 rounded-xl border ${pm.color}`}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <span className="text-xs font-black text-[#2A2723] block">{pm.label}</span>
                      <span className="text-[10px] text-[#7A7061] font-bold">{data.count} تحويل مسجل</span>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] bg-[#2A2723] text-white px-2 py-0.5 rounded-full font-bold">
                      محدد للجدول ✓
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-[#7A7061]">إجمالي المحول (الوارد):</div>
                  <div className="text-2xl font-black text-[#2A2723]">
                    {isLoading ? '...' : money(data.deposited)}
                  </div>
                </div>

                <div className="text-[10px] text-[#7A7061] font-bold mt-3 pt-2.5 border-t border-[#EAE4D9]/60 flex justify-between">
                  <span className="text-red-500">المسحوب منه: {money(data.withdrawn)}</span>
                  <span className="font-black text-[#2A2723]">الصافي: {money(data.balance)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── جدول حركات التوريد (من الخزنة الصغيرة إلى الخزنة الكبيرة) مع الفلترة والتعديل ── */}
      <section className="bg-white border-2 border-[#EAE4D9] rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#EAE4D9] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-[#2A2723]">سجل حركات التوريد (من الصغيرة إلى الكبيرة)</h2>
            <p className="text-[11px] font-bold text-[#7A7061] mt-0.5">
              كل مبالغ التحويل المنقولة للخزنة الكبيرة مع إمكانية تعديل طريقة الدفع لأي حركة بنقرة واحدة
            </p>
          </div>

          {/* تبويبات الفلترة السريعة */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#FDFBF7] p-1.5 rounded-2xl border border-[#EAE4D9]">
            <button
              onClick={() => setTransferFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                transferFilter === 'all' ? 'bg-[#2A2723] text-white shadow-sm' : 'text-[#7A7061] hover:text-[#2A2723]'
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isSelected ? pm.activeBg : 'text-[#7A7061] hover:text-[#2A2723]'
                  }`}
                >
                  {pm.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ملخص إجماليات التحويلات */}
        <div className="bg-[#FDFBF7] px-6 py-3 border-b border-[#EAE4D9] flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-[#7A7061]">
          <div className="flex items-center gap-4">
            <span>إجمالي التحويلات المعروضة: <strong className="text-base text-[#2A2723] font-black">{money(filteredDeposits.reduce((sum, t) => sum + (Number(t.amount) || 0), 0))}</strong></span>
            <span>عدد الحركات: <strong className="text-[#2A2723] font-black">{filteredDeposits.length}</strong></span>
          </div>
          {transferFilter !== 'all' && (
            <span className="text-xs font-black text-amber-800 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
              مفلتر حالياً: {PAYMENT_METHODS.find(m => m.id === transferFilter)?.label}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#FDFBF7] text-[#7A7061] font-black">
              <tr>
                <th className="p-4">المبلغ</th>
                <th className="p-4">طريقة التحويل</th>
                <th className="p-4">مسلم (من)</th>
                <th className="p-4">مستلم (إلى)</th>
                <th className="p-4">ملاحظة</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4 text-center">تعديل / حذف</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-[#7A7061] font-bold">لا توجد حركات توريد مسجلة في هذا التبويب</td></tr>
              ) : (
                filteredDeposits.map((transfer) => {
                  const fullText = `${transfer.notes || ''} ${transfer.handed_by || ''} ${transfer.received_by || ''}`;
                  const method = detectPaymentMethod(fullText);
                  const methodObj = PAYMENT_METHODS.find(m => m.id === method.id) || PAYMENT_METHODS[0];
                  const MethodIcon = methodObj.icon;
                  const cleanNotes = (transfer.notes || '').replace(/\[[^\]]+\]/g, '').trim();

                  return (
                    <tr key={transfer.id} className="border-t border-[#EAE4D9]/60 font-bold hover:bg-[#FDFBF7] transition-colors">
                      <td className="p-4 text-[#2A2723] font-black text-sm">{money(Number(transfer.amount))}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border ${methodObj.color}`}>
                          <MethodIcon size={14} />
                          {methodObj.label}
                        </span>
                      </td>
                      <td className="p-4 text-[#2A2723]">{transfer.handed_by}</td>
                      <td className="p-4 text-[#7A7061]">{transfer.received_by}</td>
                      <td className="p-4 text-[#7A7061] max-w-xs truncate" title={cleanNotes}>
                        {cleanNotes || '—'}
                      </td>
                      <td className="p-4 text-[#7A7061]">{transfer.transfer_date}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openTransferEditModal(transfer)}
                            title="تعديل طريقة الدفع أو المبلغ"
                            className="bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 px-2.5 py-1.5 rounded-xl font-black text-[10px] inline-flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Edit3 size={12} />
                            تعديل الطريقة
                          </button>
                          <button
                            onClick={() => removeTransfer(transfer.id)}
                            title="حذف الحركة"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors p-1.5 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
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

      {/* ── نموذج إضافة مبلغ من الخزنة الصغيرة إلى الخزنة الكبيرة ── */}
      <section className="bg-white border border-[#EAE4D9] rounded-[2rem] p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-[#2A2723]">نقل مبلغ من الخزنة الصغيرة إلى الخزنة الكبيرة</h2>
            <p className="text-[11px] font-bold text-[#7A7061] mt-1">تسجيل تحويل النقدية المحصلة مع تحديد طريقة التحويل</p>
          </div>
          <span className="text-xs font-black bg-[#FDFBF7] text-[#C1A68D] px-3 py-1.5 rounded-xl border border-[#EAE4D9]">
            تسمع في الخزنة الكبيرة فوراً
          </span>
        </div>

        <form onSubmit={submitTransfer} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3 items-end">
          <label className="text-[10px] font-black text-[#7A7061]">
            المبلغ
            <input
              required
              type="number"
              min="1"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-[#FDFBF7]"
              placeholder="0"
            />
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            طريقة التحويل
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethodId })}
              className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-3 py-3 text-xs font-black bg-[#FDFBF7] cursor-pointer outline-none"
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
              className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-[#FDFBF7]"
              placeholder="اسم الأدمن المسلّم"
            />
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            المستلم (إلى)
            <input
              required
              value={form.receivedBy}
              onChange={(event) => setForm({ ...form, receivedBy: event.target.value })}
              className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-[#FDFBF7]"
              placeholder="الخزنة الكبيرة / المستلم"
            />
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            ملاحظة
            <input
              placeholder="ملاحظات التحويل..."
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-[#FDFBF7]"
            />
          </label>
          <label className="text-[10px] font-black text-[#7A7061]">
            التاريخ
            <input
              required
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-[#FDFBF7]"
            />
          </label>
          <button
            disabled={isSaving}
            className="bg-[#2A2723] hover:bg-[#3D3833] text-white rounded-xl px-4 py-3 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 h-[46px] transition-colors cursor-pointer"
          >
            <Plus size={16} /> {isSaving ? 'جاري التحويل...' : 'تسجيل التحويل'}
          </button>
        </form>
      </section>

      {/* ── جدول حركة الحجوزات (المقبوض والمتبقي بدقة) ── */}
      <section className="bg-white border-2 border-[#EAE4D9] rounded-[2rem] p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-black text-[#2A2723] flex items-center gap-2">
              <Banknote size={18} className="text-[#C1A68D]" />
              حسابات حجوزات الشهر (المقبوض فعلياً والمتبقي)
            </h2>
            <p className="text-[11px] font-bold text-[#7A7061] mt-0.5">
              كل حجز يوضح كم تم دفعه فعلياً (دخل الخزنة) وكم المتبقي على العميل (خارج الخزنة)
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#FDFBF7] p-1.5 rounded-2xl border border-[#EAE4D9]">
            <button
              onClick={() => setBookingFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                bookingFilter === 'all' ? 'bg-[#2A2723] text-white shadow-sm' : 'text-[#7A7061] hover:text-[#2A2723]'
              }`}
            >
              الكل ({bookingsWithBreakdown.length})
            </button>
            <button
              onClick={() => setBookingFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                bookingFilter === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-800 hover:text-amber-900'
              }`}
            >
              عليه متبقي ({pendingBookings.length})
            </button>
            <button
              onClick={() => setBookingFilter('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                bookingFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              خالص ({completedBookings.length})
            </button>
          </div>
        </div>

        {displayedBookings.length === 0 ? (
          <div className="p-8 text-center bg-[#FDFBF7] rounded-2xl border border-dashed border-[#EAE4D9]">
            <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
            <p className="text-xs font-black text-[#2A2723]">لا توجد حجوزات في هذا التبويب لهذا الشهر</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#EAE4D9]">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#FDFBF7] text-[#7A7061] font-black">
                <tr>
                  <th className="p-4">العميل</th>
                  <th className="p-4">الوحدة</th>
                  <th className="p-4">الدخول - الخروج</th>
                  <th className="p-4">إجمالي الحجز</th>
                  <th className="p-4 bg-emerald-50/60 text-emerald-800">تم دفع (بالخزنة) 🟢</th>
                  <th className="p-4 bg-amber-50/60 text-amber-900">المتبقي (خارجها) ⏳</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4">الملاحظات</th>
                  <th className="p-4 text-center">إجراءات</th>
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
          <div className="bg-white border-2 border-[#EAE4D9] rounded-[2rem] w-full max-w-md p-6 shadow-2xl space-y-5 animate-scale-in" dir="rtl">
            <div className="flex items-center justify-between border-b border-[#EAE4D9]/60 pb-3">
              <div>
                <h3 className="text-base font-black text-[#2A2723]">تعديل حساب الحجز</h3>
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

              <div>
                <label className="text-xs font-black text-[#2A2723] block mb-1.5">
                  المبلغ المدفوع (المحصل فعلياً بالخزنة)
                </label>
                <div className="relative">
                  <input
                    required
                    type="number"
                    min="0"
                    max={Number(editingBooking.totalAmount || 0)}
                    value={editPaidInput}
                    onChange={(e) => setEditPaidInput(e.target.value)}
                    className="w-full border-2 border-emerald-300 focus:border-emerald-600 bg-emerald-50/30 rounded-xl px-4 py-3 text-base font-black text-emerald-800 outline-none"
                    placeholder="0"
                  />
                  <span className="absolute left-3 top-3.5 text-xs font-bold text-[#7A7061]">ج.م</span>
                </div>
              </div>

              <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 flex justify-between items-center text-xs">
                <span className="font-bold text-amber-900">المبلغ المتبقي المحسوب:</span>
                <span className="font-black text-base text-rose-600">
                  {money(Math.max(0, Number(editingBooking.totalAmount || 0) - (parseFloat(editPaidInput) || 0)))}
                </span>
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

      {/* ── قسم السحب من الخزنة الكبيرة (خاص بـ Owner: مؤمن ومدحت) ── */}
      {isOwner && (
        <section className="bg-[#FDFBF7] border-2 border-[#EAE4D9] rounded-[2rem] p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-black text-[#2A2723] flex items-center gap-2">
                <ArrowDownLeft size={20} className="text-red-500" />
                سحب من الخزنة الكبيرة (الملاك: مؤمن ومدحت)
              </h2>
              <p className="text-[11px] font-bold text-[#7A7061] mt-1">
                حدد طريقة السحب (كاش، إنستا باي / بنك، فودافون كاش) ليتم خصمها من رصيد المحفظة المحددة
              </p>
            </div>
            <div className="text-left bg-white px-4 py-2 rounded-xl border border-[#EAE4D9]">
              <span className="text-[10px] text-[#7A7061] font-bold block">إجمالي سحوبات الشهر</span>
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
                className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-white"
                placeholder="0"
              />
            </label>
            <label className="text-[10px] font-black text-[#7A7061]">
              طريقة السحب
              <select
                value={withdrawMethod}
                onChange={e => setWithdrawMethod(e.target.value as PaymentMethodId)}
                className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-3 py-3 text-xs font-black bg-white cursor-pointer outline-none"
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
                className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-white cursor-pointer outline-none"
              >
                <option value="مؤمن">مؤمن</option>
                <option value="مدحت">مدحت</option>
                <option value="أحمد كورة">أحمد كورة</option>
                <option value="أخرى">أخرى</option>
              </select>
            </label>
            <label className="text-[10px] font-black text-[#7A7061] sm:col-span-2">
              السبب / البيان
              <input
                required
                value={withdrawReason}
                onChange={e => setWithdrawReason(e.target.value)}
                className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-white"
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
                className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-white"
              />
            </label>
            <button
              disabled={isSavingWithdraw}
              className="sm:col-span-6 bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-3 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 h-[46px] transition-colors cursor-pointer"
            >
              <ArrowDownLeft size={16} /> {isSavingWithdraw ? 'جاري تسجيل السحب...' : 'تسجيل سحب من الخزنة الكبيرة'}
            </button>
          </form>

          {/* جدول سحوبات الخزنة الكبيرة */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[#EAE4D9] bg-white">
            <div className="p-4 bg-[#FDFBF7] border-b border-[#EAE4D9] flex justify-between items-center">
              <h3 className="text-xs font-black text-[#2A2723]">سجل سحوبات الخزنة الكبيرة لهذا الشهر</h3>
              <span className="text-[11px] font-bold text-[#7A7061]">{monthlyWithdrawals.length} حركة سحب</span>
            </div>
            <table className="w-full text-right text-xs">
              <thead className="bg-[#FDFBF7] text-[#7A7061] font-black">
                <tr>
                  <th className="p-4">المبلغ</th>
                  <th className="p-4">طريقة السحب</th>
                  <th className="p-4">المسحوب لـ</th>
                  <th className="p-4">السبب / البيان</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">حذف</th>
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
                      <tr key={w.id} className="border-t border-[#EAE4D9]/60 font-bold hover:bg-red-50/20">
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
                        <td className="p-4">
                          <button
                            onClick={() => removeTransfer(w.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
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
    </div>
  );
}
