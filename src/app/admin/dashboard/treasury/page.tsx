"use client";

import { useEffect, useMemo, useState } from 'react';
import { getBookings } from '@/lib/data-init';
import {
  deleteDbTreasuryTransfer,
  getDbExpenses,
  getDbTreasuryTransfers,
  saveDbTreasuryTransfer,
} from '@/lib/actions/db';
import { ArrowLeftRight, ArrowDownLeft, Plus, Trash2, Wallet } from 'lucide-react';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

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

  // نموذج إضافة مبلغ من الخزنة الصغيرة إلى الخزنة الكبيرة (التحويل / التوريد)
  const [form, setForm] = useState({
    amount: '',
    handedBy: '',
    receivedBy: 'الخزنة الكبيرة',
    date: today.toISOString().slice(0, 10),
    notes: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

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

  // نموذج سحب من الخزنة الكبيرة (مؤمن / مدحت / الشركاء)
  const defaultOwnerName = useMemo(() => {
    return adminInfo?.name?.includes('مدحت') ? 'مدحت' : 'مؤمن';
  }, [adminInfo]);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawDate, setWithdrawDate] = useState(today.toISOString().slice(0, 10));
  const [withdrawBy, setWithdrawBy] = useState('مؤمن');
  const [isSavingWithdraw, setIsSavingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  // تحديث الاسم الافتراضي للمسحوب منه عند تحميل معلومات الأدمن
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

  // ── الحسابات الشهرية المفلترة بالشهر والسنة ──
  // حجوزات الشهر
  const monthlyBookings = useMemo(() => (bookings || []).filter((booking) => {
    if (!booking || !CONFIRMED_STATUSES.includes(String(booking.status))) return false;
    const parsed = parseDateYM(booking.checkIn);
    return parsed ? parsed.month === month && parsed.year === year : false;
  }), [bookings, month, year]);

  // مصروفات الشهر
  const monthlyExpenses = useMemo(() => (expenses || []).filter((expense) => {
    if (!expense || expense.status === 'REJECTED' || expense.status === 'مرفوض') return false;
    const parsed = parseDateYM(expense.date);
    return parsed ? parsed.month === month && parsed.year === year : false;
  }), [expenses, month, year]);

  // الإجمالي الشامل للشهر = إيرادات الشهر - عمولاته - مصروفاته (صافي إيرادات الخزينة قبل أي تقسيم)
  const grossTreasury = useMemo(() => {
    const revenue = monthlyBookings.reduce((sum, b) => sum + (Number(b?.totalAmount) || 0), 0);
    const commissions = monthlyBookings.reduce((sum, b) => sum + (Number(b?.commission) || 0), 0);
    const expensesTotal = monthlyExpenses.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0);
    return (revenue || 0) - (commissions || 0) - (expensesTotal || 0);
  }, [monthlyBookings, monthlyExpenses]);

  // تحويلات الشهر (من الخزنة الصغيرة إلى الخزنة الكبيرة)
  const monthlyDeposits = useMemo(() => (transfers || []).filter((t) => {
    if (!t) return false;
    const isWithdraw = (t.notes || '').includes('[نوع: سحب من الرئيسية]') || (t.notes || '').includes('[نوع: سحب]');
    const parsed = parseDateYM(t.transfer_date);
    return !isWithdraw && parsed ? parsed.month === month && parsed.year === year : false;
  }), [transfers, month, year]);

  // إجمالي ما تم توريده من الخزنة الصغيرة إلى الخزنة الكبيرة
  const totalDepositedToBig = useMemo(() => {
    return monthlyDeposits.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
  }, [monthlyDeposits]);

  // سحوبات الخزنة الكبيرة في هذا الشهر
  const monthlyWithdrawals = useMemo(() => (transfers || []).filter((t) => {
    if (!t) return false;
    const isWithdraw = (t.notes || '').includes('[نوع: سحب من الرئيسية]') || (t.notes || '').includes('[نوع: سحب]');
    const parsed = parseDateYM(t.transfer_date);
    return isWithdraw && parsed ? parsed.month === month && parsed.year === year : false;
  }), [transfers, month, year]);

  // إجمالي ما تم سحبه من الخزنة الكبيرة
  const totalWithdrawnFromBig = useMemo(() => {
    return monthlyWithdrawals.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
  }, [monthlyWithdrawals]);

  // 1) رصيد الخزنة الكبيرة الحالي = ما تم تحويله إليها - ما تم سحبه منها
  const bigTreasuryBalance = useMemo(() => {
    return totalDepositedToBig - totalWithdrawnFromBig;
  }, [totalDepositedToBig, totalWithdrawnFromBig]);

  // 2) رصيد الخزنة الصغيرة = صافي الإيرادات الكلية للشهر - ما تم تحويله للخزنة الكبيرة
  const smallTreasuryBalance = useMemo(() => {
    return (grossTreasury || 0) - totalDepositedToBig;
  }, [grossTreasury, totalDepositedToBig]);

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
      await saveDbTreasuryTransfer({
        amount: form.amount,
        handed_by: form.handedBy,
        received_by: form.receivedBy,
        transfer_date: form.date,
        notes: form.notes,
      });
      setForm({
        amount: '',
        handedBy: '',
        receivedBy: 'الخزنة الكبيرة',
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

  // حذف أي حركة (سحب أو توريد)
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

  // إرسال سحب من الخزنة الكبيرة
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) { setWithdrawError('أدخل مبلغ صحيح'); return; }
    if (!withdrawReason.trim()) { setWithdrawError('اكتب سبب السحب'); return; }
    setIsSavingWithdraw(true);
    setWithdrawError('');
    try {
      const actorName = withdrawBy.trim() || defaultOwnerName;
      await saveDbTreasuryTransfer({
        amount: String(amt),
        handed_by: 'الخزنة الكبيرة',
        received_by: actorName,
        transfer_date: withdrawDate,
        notes: `[نوع: سحب من الرئيسية] [سبب: ${withdrawReason.trim()}] [المستلم: ${actorName}]`,
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

  // خيارات السنوات (تسمح باختيار سنوات سابقة وحالية وقادمة)
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
            متابعة حركة النقدية بين <span className="text-[#C1A68D]">الخزنة الصغيرة</span> و <span className="text-[#2A2723]">الخزنة الكبيرة</span>
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

      {/* ── كروت إحصائيات الخزائن ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* كارت الخزنة الصغيرة */}
        <div className="bg-white border-2 border-[#EAE4D9] p-7 rounded-[2rem] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[#7A7061] text-xs font-black">
              <Wallet size={18} className="text-[#C1A68D]" /> الخزنة الصغيرة (الفرعية)
            </div>
            <span className="text-[10px] bg-[#FDFBF7] text-[#7A7061] px-2.5 py-1 rounded-full font-bold border border-[#EAE4D9]">
              المتبقي للتحويل
            </span>
          </div>
          <div className="text-3xl font-black text-[#2A2723] mt-5">
            {isLoading ? '...' : money(smallTreasuryBalance)}
          </div>
          <p className="text-[10px] text-[#7A7061] font-bold mt-3">
            صافي إيرادات الشهر ({money(grossTreasury)}) − المحول للكبيرة ({money(totalDepositedToBig)})
          </p>
        </div>

        {/* كارت الخزنة الكبيرة */}
        <div className="bg-[#2A2723] text-white p-7 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[#C1A68D] text-xs font-black">
              <ArrowLeftRight size={18} /> الخزنة الكبيرة (الرئيسية)
            </div>
            <span className="text-[10px] bg-white/10 text-[#C1A68D] px-2.5 py-1 rounded-full font-bold">
              الرصيد الفعلي
            </span>
          </div>
          <div className="text-3xl font-black text-white mt-5">
            {isLoading ? '...' : money(bigTreasuryBalance)}
          </div>
          <div className="text-[10px] text-white/70 font-bold mt-3 flex justify-between">
            <span>المحول إليها: {money(totalDepositedToBig)}</span>
            <span className="text-red-300">المسحوب منها: {money(totalWithdrawnFromBig)}</span>
          </div>
        </div>

        {/* كارت إجمالي صافي الإيرادات */}
        <div className="bg-[#FDFBF7] border border-[#EAE4D9] p-7 rounded-[2rem] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-[#7A7061]">صافي أرباح الشهر</div>
            <span className="text-[10px] bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-bold border border-green-200">
              شامل الشهر
            </span>
          </div>
          <div className="text-3xl font-black text-green-700 mt-5">
            {isLoading ? '...' : money(grossTreasury)}
          </div>
          <p className="text-[10px] text-[#7A7061] font-bold mt-3">
            الخزنة الصغيرة ({money(smallTreasuryBalance)}) + الخزنة الكبيرة ({money(bigTreasuryBalance)}) + المسحوب ({money(totalWithdrawnFromBig)})
          </p>
        </div>
      </section>

      {/* ── نموذج إضافة مبلغ من الخزنة الصغيرة إلى الخزنة الكبيرة (للأدمن والجميع) ── */}
      <section className="bg-white border border-[#EAE4D9] rounded-[2rem] p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-[#2A2723]">نقل مبلغ من الخزنة الصغيرة إلى الخزنة الكبيرة</h2>
            <p className="text-[11px] font-bold text-[#7A7061] mt-1">تسجيل تحويل النقدية المحصلة من الموقع إلى الخزنة الكبيرة</p>
          </div>
          <span className="text-xs font-black bg-[#FDFBF7] text-[#C1A68D] px-3 py-1.5 rounded-xl border border-[#EAE4D9]">
            تسمع في الخزنة الكبيرة فوراً
          </span>
        </div>

        <form onSubmit={submitTransfer} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
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
            className="bg-[#2A2723] hover:bg-[#3D3833] text-white rounded-xl px-4 py-3 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 h-[46px] transition-colors"
          >
            <Plus size={16} /> {isSaving ? 'جاري التحويل...' : 'تسجيل التحويل'}
          </button>
        </form>
      </section>

      {/* ── قسم السحب من الخزنة الكبيرة (الـ Owner / مؤمن ومدحت) ── */}
      {isOwner && (
        <section className="bg-[#FDFBF7] border-2 border-[#EAE4D9] rounded-[2rem] p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-black text-[#2A2723] flex items-center gap-2">
                <ArrowDownLeft size={20} className="text-red-500" />
                سحب من الخزنة الكبيرة (الملاك: مؤمن ومدحت)
              </h2>
              <p className="text-[11px] font-bold text-[#7A7061] mt-1">
                أي مبلغ يتم سحبه من هنا يُخصم تلقائياً وبشكل مباشر من رصيد الخزنة الكبيرة
              </p>
            </div>
            <div className="text-left bg-white px-4 py-2 rounded-xl border border-[#EAE4D9]">
              <span className="text-[10px] text-[#7A7061] font-bold block">إجمالي سحوبات الشهر</span>
              <span className="text-base font-black text-red-600">{money(totalWithdrawnFromBig)}</span>
            </div>
          </div>

          {withdrawError && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-black mb-4">{withdrawError}</div>}
          {withdrawSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-xs font-black mb-4">{withdrawSuccess}</div>}

          <form onSubmit={handleWithdrawSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
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
              className="sm:col-span-5 bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-3 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 h-[46px] transition-colors"
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
                  <th className="p-4">المسحوب لـ</th>
                  <th className="p-4">السبب / البيان</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">حذف</th>
                </tr>
              </thead>
              <tbody>
                {monthlyWithdrawals.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[#7A7061] font-bold">لا يوجد أي سحب من الخزنة الكبيرة في هذا الشهر</td></tr>
                ) : (
                  monthlyWithdrawals.map(w => {
                    const reasonMatch = (w.notes || '').match(/\[سبب:\s*([^\]]+)\]/);
                    const reason = reasonMatch ? reasonMatch[1] : (w.notes || '—');
                    const actorMatch = (w.notes || '').match(/\[المستلم:\s*([^\]]+)\]/);
                    const actor = actorMatch ? actorMatch[1] : (w.received_by || '—');
                    return (
                      <tr key={w.id} className="border-t border-[#EAE4D9]/60 font-bold hover:bg-red-50/20">
                        <td className="p-4 text-red-600 font-black">{money(Number(w.amount))}</td>
                        <td className="p-4 text-[#2A2723]">{actor}</td>
                        <td className="p-4 text-[#7A7061]">{reason}</td>
                        <td className="p-4">{w.transfer_date}</td>
                        <td className="p-4">
                          <button
                            onClick={() => removeTransfer(w.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1"
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

      {/* ── جدول حركات التوريد (من الخزنة الصغيرة إلى الخزنة الكبيرة) ── */}
      <section className="bg-white border border-[#EAE4D9] rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#EAE4D9] flex justify-between items-center">
          <div>
            <h2 className="text-lg font-black text-[#2A2723]">سجل حركات التوريد (من الصغيرة إلى الكبيرة)</h2>
            <p className="text-[11px] font-bold text-[#7A7061] mt-0.5">كل المبالغ التي قام الأدمن بنقلها للخزنة الكبيرة</p>
          </div>
          <span className="text-xs font-black text-[#7A7061] bg-[#FDFBF7] px-3 py-1.5 rounded-xl border border-[#EAE4D9]">
            {monthlyDeposits.length} حركة توريد
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#FDFBF7] text-[#7A7061] font-black">
              <tr>
                <th className="p-5">المبلغ</th>
                <th className="p-5">مسلم (من)</th>
                <th className="p-5">مستلم (إلى)</th>
                <th className="p-5">ملاحظة</th>
                <th className="p-5">التاريخ</th>
                <th className="p-5">حذف</th>
              </tr>
            </thead>
            <tbody>
              {monthlyDeposits.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-[#7A7061] font-bold">لا توجد حركات توريد مسجلة لهذا الشهر</td></tr>
              ) : (
                monthlyDeposits.map((transfer) => (
                  <tr key={transfer.id} className="border-t border-[#EAE4D9]/60 font-bold hover:bg-[#FDFBF7]">
                    <td className="p-5 text-[#C1A68D] font-black">{money(Number(transfer.amount))}</td>
                    <td className="p-5">{transfer.handed_by}</td>
                    <td className="p-5">{transfer.received_by}</td>
                    <td className="p-5 text-[#7A7061]">{transfer.notes || '—'}</td>
                    <td className="p-5">{transfer.transfer_date}</td>
                    <td className="p-5">
                      <button
                        onClick={() => removeTransfer(transfer.id)}
                        title="حذف الحركة"
                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
