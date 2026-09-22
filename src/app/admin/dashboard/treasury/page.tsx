"use client";

import { useEffect, useMemo, useState } from 'react';
import { getBookings } from '@/lib/data-init';
import {
  deleteDbTreasuryTransfer,
  getDbExpenses,
  getDbTreasuryTransfers,
  saveDbTreasuryTransfer,
} from '@/lib/actions/db';
import { ArrowLeftRight, Plus, Trash2, Wallet } from 'lucide-react';

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
  const [form, setForm] = useState({ amount: '', handedBy: '', receivedBy: '', date: today.toISOString().slice(0, 10), notes: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // --- Owner detection (no changes to Admin) ---
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

  // --- Withdrawal from main treasury (owners only) ---
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawDate, setWithdrawDate] = useState(today.toISOString().slice(0, 10));
  const [isSavingWithdraw, setIsSavingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Phase 1: load transfers (fast small table)
      const transferData = await getDbTreasuryTransfers();
      setTransfers(transferData || []);
    } catch (e) {
      console.error('Treasury transfers load error:', e);
    } finally {
      setIsLoading(false);
    }

    // Phase 2: load bookings + expenses in background (separate try, won't block page)
    try {
      const [bookingData, expenseData] = await Promise.all([
        getBookings(),
        getDbExpenses(),
      ]);
      setBookings(bookingData || []);
      setExpenses(expenseData || []);
    } catch (e) {
      console.error('Bookings/expenses load error:', e);
      // Don't show error to user — summary cards will just show 0
    }
  };

  useEffect(() => { loadData(); }, []);

  const monthlyBookings = useMemo(() => bookings.filter((booking) => {
    if (!CONFIRMED_STATUSES.includes(String(booking.status))) return false;
    const parsed = parseDateYM(booking.checkIn);
    return parsed ? parsed.month === month && parsed.year === year : false;
  }), [bookings, month, year]);

  const monthlyExpenses = useMemo(() => expenses.filter((expense) => {
    const parsed = parseDateYM(expense.date);
    return parsed ? parsed.month === month && parsed.year === year : false;
  }), [expenses, month, year]);

  const grossTreasury = useMemo(() => {
    const revenue = monthlyBookings.reduce((sum, booking) => sum + (Number(booking.totalAmount) || 0), 0);
    const commissions = monthlyBookings.reduce((sum, booking) => sum + (Number(booking.commission) || 0), 0);
    const expensesTotal = monthlyExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    return Math.max(0, revenue - commissions - expensesTotal);
  }, [monthlyBookings, monthlyExpenses]);

  const monthlyTransfers = useMemo(() => transfers.filter((transfer) => {
    const parsed = parseDateYM(transfer.transfer_date);
    return parsed ? parsed.month === month && parsed.year === year : false;
  }), [transfers, month, year]);

  const mainTreasury = monthlyTransfers.reduce((sum, transfer) => sum + (Number(transfer.amount) || 0), 0);
  const subTreasury = Math.max(0, grossTreasury - mainTreasury);

  // Withdrawals from main treasury = transfers where notes contains [نوع: سحب من الرئيسية]
  const mainWithdrawals = useMemo(() => transfers.filter(t => {
    const isWithdraw = (t.notes || '').includes('[نوع: سحب من الرئيسية]');
    const parsed = parseDateYM(t.transfer_date);
    return isWithdraw && parsed ? parsed.month === month && parsed.year === year : false;
  }), [transfers, month, year]);

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
      setForm({ amount: '', handedBy: '', receivedBy: '', date: form.date, notes: '' });
      await loadData();
    } catch (saveError) {
      console.error(saveError);
      setError('فشل حفظ حركة التحويل.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeTransfer = async (id: string) => {
    if (!window.confirm('هل تريد حذف حركة التحويل؟')) return;
    try {
      await deleteDbTreasuryTransfer(id);
      setTransfers((current) => current.filter((transfer) => transfer.id !== id));
    } catch (deleteError) {
      console.error(deleteError);
      setError('فشل حذف حركة التحويل.');
    }
  };

  // Submit withdrawal from main treasury
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) { setWithdrawError('أدخل مبلغ صحيح'); return; }
    if (!withdrawReason.trim()) { setWithdrawError('اكتب سبب السحب'); return; }
    setIsSavingWithdraw(true);
    setWithdrawError('');
    try {
      const actorName = adminInfo?.name?.includes('مدحت') ? 'مدحت' : 'مؤمن';
      await saveDbTreasuryTransfer({
        amount: String(amt),
        handed_by: actorName,
        received_by: actorName,
        transfer_date: withdrawDate,
        notes: `[نوع: سحب من الرئيسية] [سبب: ${withdrawReason.trim()}]`,
      });
      setWithdrawAmount('');
      setWithdrawReason('');
      setWithdrawSuccess('✅ تم تسجيل السحب');
      setTimeout(() => setWithdrawSuccess(''), 3000);
      await loadData();
    } catch (err: any) {
      setWithdrawError('فشل التسجيل: ' + (err.message || ''));
    } finally {
      setIsSavingWithdraw(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <h1 className="text-4xl font-black text-[#2A2723]">الخزنة</h1>
          <p className="text-sm font-bold text-[#7A7061] mt-2">حركة التوريد من الخزنة الفرعية إلى الخزنة الرئيسية</p>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-2xl border border-[#EAE4D9]">
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="bg-[#FDFBF7] rounded-xl px-3 py-2 text-xs font-black">
            {MONTHS_AR.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </select>
          <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="bg-[#FDFBF7] rounded-xl px-3 py-2 text-xs font-black">
            {[2025, 2026, 2027].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </header>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 text-xs font-black">{error}</div>}

      <section className="grid md:grid-cols-3 gap-5">
        <div className="bg-[#2A2723] text-white p-7 rounded-[2rem] shadow-xl">
          <div className="flex items-center gap-3 text-[#C1A68D] text-xs font-black"><Wallet size={18} /> الخزنة الفرعية</div>
          <div className="text-3xl font-black mt-5">{isLoading ? '...' : money(subTreasury)}</div>
          <p className="text-[10px] text-white/60 font-bold mt-3">الحجوزات - العمولات - المصروفات</p>
        </div>
        <div className="bg-white border border-[#EAE4D9] p-7 rounded-[2rem] shadow-sm">
          <div className="flex items-center gap-3 text-[#7A7061] text-xs font-black"><ArrowLeftRight size={18} /> الخزنة الرئيسية</div>
          <div className="text-3xl font-black text-[#C1A68D] mt-5">{isLoading ? '...' : money(mainTreasury)}</div>
          <p className="text-[10px] text-[#7A7061] font-bold mt-3">إجمالي ما تم توريده لصاحب المكان</p>
        </div>
        <div className="bg-[#FDFBF7] border border-[#EAE4D9] p-7 rounded-[2rem] shadow-sm">
          <div className="text-xs font-black text-[#7A7061]">الإجمالي الشامل</div>
          <div className="text-3xl font-black text-[#2A2723] mt-5">{isLoading ? '...' : money(grossTreasury)}</div>
          <p className="text-[10px] text-[#7A7061] font-bold mt-3">الخزنة الفرعية + الخزنة الرئيسية</p>
        </div>
      </section>

      {/* Withdrawal from main treasury — OWNERS ONLY (مؤمن & مدحت) */}
      {isOwner && (
        <section className="bg-[#FDFBF7] border border-[#EAE4D9] rounded-[2rem] p-6 md:p-8 shadow-sm">
          <h2 className="text-lg font-black text-[#2A2723] mb-1">سحب من الخزنة الرئيسية</h2>
          <p className="text-[11px] font-bold text-[#7A7061] mb-5">سجّل لو أخدت فلوس من الخزنة الرئيسية</p>

          {withdrawError && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-black mb-4">{withdrawError}</div>}
          {withdrawSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-xs font-black mb-4">{withdrawSuccess}</div>}

          <form onSubmit={handleWithdrawSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <label className="text-[10px] font-black text-[#7A7061]">
              المبلغ المسحوب
              <input required type="number" min="1" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-white" placeholder="0" />
            </label>
            <label className="text-[10px] font-black text-[#7A7061] sm:col-span-2">
              السبب
              <input required value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-white" placeholder="سحبت ليه؟" />
            </label>
            <label className="text-[10px] font-black text-[#7A7061]">
              التاريخ
              <input required type="date" value={withdrawDate} onChange={e => setWithdrawDate(e.target.value)} className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black bg-white" />
            </label>
            <button disabled={isSavingWithdraw} className="sm:col-span-4 md:col-span-1 bg-[#2A2723] text-white rounded-xl px-4 py-3 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 h-[46px]">
              <Plus size={16} /> {isSavingWithdraw ? 'جاري الحفظ...' : 'تسجيل السحب'}
            </button>
          </form>

          {/* Withdrawals table */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[#EAE4D9]">
            <table className="w-full text-right text-xs">
              <thead className="bg-white text-[#7A7061] font-black">
                <tr>
                  <th className="p-4">المبلغ</th>
                  <th className="p-4">السبب</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">حذف</th>
                </tr>
              </thead>
              <tbody>
                {mainWithdrawals.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-[#7A7061] font-bold">لا يوجد سحب من الخزنة الرئيسية هذا الشهر</td></tr>
                ) : (
                  mainWithdrawals.map(w => {
                    const reasonMatch = (w.notes || '').match(/\[سبب: ([^\]]+)\]/);
                    const reason = reasonMatch ? reasonMatch[1] : '—';
                    return (
                      <tr key={w.id} className="border-t border-[#EAE4D9]/60 font-bold">
                        <td className="p-4 text-red-600 font-black">{money(Number(w.amount))}</td>
                        <td className="p-4">{reason}</td>
                        <td className="p-4">{w.transfer_date}</td>
                        <td className="p-4">
                          <button onClick={() => removeTransfer(w.id)} className="text-red-400 hover:text-red-600">
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

      <section className="bg-white border border-[#EAE4D9] rounded-[2rem] p-6 md:p-8 shadow-sm">
        <h2 className="text-lg font-black text-[#2A2723] mb-6">إضافة مبلغ من الخزنة الفرعية إلى الرئيسية</h2>
        <form onSubmit={submitTransfer} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <label className="text-[10px] font-black text-[#7A7061]">المبلغ<input required type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black" /></label>
          <label className="text-[10px] font-black text-[#7A7061]">مسلم<input required value={form.handedBy} onChange={(event) => setForm({ ...form, handedBy: event.target.value })} className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black" /></label>
          <label className="text-[10px] font-black text-[#7A7061]">مستلم<input required value={form.receivedBy} onChange={(event) => setForm({ ...form, receivedBy: event.target.value })} className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black" /></label>
          <label className="text-[10px] font-black text-[#7A7061]">ملاحظة<input placeholder="أضف ملاحظة..." value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black" /></label>
          <label className="text-[10px] font-black text-[#7A7061]">التاريخ<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-2 w-full border border-[#EAE4D9] rounded-xl px-4 py-3 text-sm font-black" /></label>
          <button disabled={isSaving} className="bg-[#2A2723] text-white rounded-xl px-4 py-3 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-50 h-[46px]"><Plus size={16} /> {isSaving ? 'جاري الحفظ' : 'إضافة'}</button>
        </form>
      </section>

      <section className="bg-white border border-[#EAE4D9] rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#EAE4D9] flex justify-between items-center">
          <h2 className="text-lg font-black text-[#2A2723]">حركات التوريد</h2>
          <span className="text-xs font-black text-[#7A7061]">{monthlyTransfers.filter(t => !(t.notes || '').includes('[نوع: سحب من الرئيسية]')).length} حركة</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#FDFBF7] text-[#7A7061] font-black">
              <tr>
                <th className="p-5">المبلغ</th>
                <th className="p-5">مسلم</th>
                <th className="p-5">مستلم</th>
                <th className="p-5">ملاحظة</th>
                <th className="p-5">التاريخ</th>
                <th className="p-5">حذف</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTransfers.filter(t => !(t.notes || '').includes('[نوع: سحب من الرئيسية]')).length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-[#7A7061] font-bold">لا توجد تحويلات لهذا الشهر</td></tr>
              ) : (
                monthlyTransfers
                  .filter(t => !(t.notes || '').includes('[نوع: سحب من الرئيسية]'))
                  .map((transfer) => (
                    <tr key={transfer.id} className="border-t border-[#EAE4D9]/60 font-bold">
                      <td className="p-5 text-[#C1A68D] font-black">{money(Number(transfer.amount))}</td>
                      <td className="p-5">{transfer.handed_by}</td>
                      <td className="p-5">{transfer.received_by}</td>
                      <td className="p-5 text-[#7A7061]">{transfer.notes || '—'}</td>
                      <td className="p-5">{transfer.transfer_date}</td>
                      <td className="p-5">
                        <button onClick={() => removeTransfer(transfer.id)} title="حذف الحركة" className="text-red-500">
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
