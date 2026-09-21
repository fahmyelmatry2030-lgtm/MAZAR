"use client";

import { useEffect, useMemo, useState } from 'react';
import { getBookings } from '@/lib/data-init';
import {
  deleteDbTreasuryTransfer,
  getDbExpenses,
  getDbTreasuryTransfers,
  saveDbTreasuryTransfer,
} from '@/lib/actions/db';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  TrendingDown,
  UserCheck,
  Wallet,
  CheckCircle2,
} from 'lucide-react';

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const CONFIRMED_STATUSES = ['approved', 'مؤكد', 'مؤكد/دخول', 'مغادر/تنظيف', 'مغادر/تم'];

const money = (value: number) => `${Math.round(value).toLocaleString('ar-EG')} ج.م`;

// Robust Date Parser supporting YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, ISO strings
const parseDateYearMonth = (dateStr: any): { year: number; month: number } | null => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    return {
      year: parseInt(ymdMatch[1], 10),
      month: parseInt(ymdMatch[2], 10) - 1, // 0-indexed
    };
  }

  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    return {
      year: parseInt(dmyMatch[3], 10),
      month: parseInt(dmyMatch[2], 10) - 1, // 0-indexed
    };
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  }

  return null;
};

const getCurrentFormattedTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default function TreasuryPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form for New Withdrawal
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    reason: '',
    date: today.toISOString().slice(0, 10),
    time: getCurrentFormattedTime(),
  });

  // Admin Auth / Ownership
  const [adminInfo, setAdminInfo] = useState<any>(null);

  useEffect(() => {
    const info = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminInfo') || '{}') : {};
    setAdminInfo(info);
    setWithdrawForm(prev => ({ ...prev, time: getCurrentFormattedTime() }));
  }, []);

  const currentUserName = useMemo(() => {
    if (adminInfo?.name?.includes('مدحت') || adminInfo?.username?.toLowerCase()?.includes('medhat')) return 'مدحت';
    if (adminInfo?.name?.includes('مؤمن') || adminInfo?.username?.toLowerCase()?.includes('mo2men')) return 'مؤمن';
    return adminInfo?.name || adminInfo?.username || 'مؤمن';
  }, [adminInfo]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bookingData, expenseData, transferData] = await Promise.all([
        getBookings(),
        getDbExpenses(),
        getDbTreasuryTransfers(),
      ]);
      setBookings(bookingData || []);
      setExpenses(expenseData || []);
      setTransfers(transferData || []);
    } catch (loadError) {
      console.error(loadError);
      setError('تعذر تحميل بيانات الخزنة.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. Calculate Monthly Profit / Inflow for Selected Month
  const monthlyProfitInflow = useMemo(() => {
    // Bookings revenue for this month
    const confirmedBookingsThisMonth = bookings.filter((b) => {
      if (!CONFIRMED_STATUSES.includes(String(b.status))) return false;
      const parsed = parseDateYearMonth(b.checkIn);
      return parsed && parsed.month === month && parsed.year === year;
    });

    const totalRev = confirmedBookingsThisMonth.reduce(
      (sum, b) => sum + ((Number(b.totalAmount) || 0) - (Number(b.commission) || 0)),
      0
    );

    // Approved Expenses for this month
    const approvedExpensesThisMonth = expenses.filter((e) => {
      const isApproved = (e.status && (e.status.includes('تم الموافقة') || e.status === 'APPROVED')) || (e.approved_by && e.approved_by !== '');
      if (!isApproved) return false;
      const parsed = parseDateYearMonth(e.date);
      return parsed && parsed.month === month && parsed.year === year;
    });

    const totalExp = approvedExpensesThisMonth.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    return Math.max(0, totalRev - totalExp);
  }, [bookings, expenses, month, year]);

  // 2. Filter Withdrawals for Selected Month
  const monthlyWithdrawals = useMemo(() => {
    return transfers.filter((t) => {
      if (t.type !== 'withdrawal') return false;
      const parsed = parseDateYearMonth(t.transfer_date);
      return parsed && parsed.month === month && parsed.year === year;
    });
  }, [transfers, month, year]);

  // 3. Total Withdrawals this month
  const totalWithdrawalsThisMonth = useMemo(() => {
    return monthlyWithdrawals.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [monthlyWithdrawals]);

  // 4. Monthly Remaining Balance (resets each month)
  const currentMonthlyRemaining = Math.max(0, monthlyProfitInflow - totalWithdrawalsThisMonth);

  // 5. Calculate Running Balance for the monthly table
  const withdrawalsWithRunningBalance = useMemo(() => {
    // Sort withdrawals chronologically
    const sorted = [...monthlyWithdrawals].sort((a, b) => {
      const d1 = new Date(`${a.transfer_date}T00:00:00`).getTime();
      const d2 = new Date(`${b.transfer_date}T00:00:00`).getTime();
      return d1 - d2;
    });

    let running = monthlyProfitInflow;
    const items = sorted.map((w, idx) => {
      running = Math.max(0, running - (Number(w.amount) || 0));
      return {
        ...w,
        index: idx + 1,
        remaining: running,
      };
    });

    return items;
  }, [monthlyWithdrawals, monthlyProfitInflow]);

  // Submit New Withdrawal
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawForm.amount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      alert('الرجاء إدخال مبلغ صحيح للسحب');
      return;
    }
    if (!withdrawForm.reason.trim()) {
      alert('الرجاء كتابة سبب السحب (سحبت ليه؟)');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const timeToSave = withdrawForm.time.trim() || getCurrentFormattedTime();
      await saveDbTreasuryTransfer({
        type: 'withdrawal',
        amount: amountNum,
        handed_by: 'الخزنة الرئيسية',
        received_by: currentUserName,
        actor: currentUserName,
        reason: withdrawForm.reason.trim(),
        time: timeToSave,
        notes: withdrawForm.reason.trim(),
        transfer_date: withdrawForm.date || today.toISOString().slice(0, 10),
      });

      setWithdrawForm({
        amount: '',
        reason: '',
        date: today.toISOString().slice(0, 10),
        time: getCurrentFormattedTime(),
      });
      setSuccessMsg('✅ تم تسجيل حركة السحب بنجاح');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError('فشل تسجيل السحب: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Record
  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف حركة السحب هذه؟')) return;
    try {
      await deleteDbTreasuryTransfer(id);
      setTransfers((prev) => prev.filter((t) => t.id !== id));
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء الحذف: ' + err.message);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-fade-in font-sans" dir="rtl">
      
      {/* Header & Month Selector */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#EAE4D9] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#2A2723] text-mazar-gold px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xs mb-3">
            <Wallet size={14} />
            <span>الخزنة الشهرية (تصفر شهرياً)</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-[#2A2723] tracking-tight">إدارة الخزنة</h1>
          <p className="text-xs md:text-sm font-bold text-[#7A7061] mt-1">
            متابعة رصيد أرباح الشهر وجدول المسحوبات البسيط
          </p>
        </div>

        {/* Month & Year Selectors */}
        <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-[#EAE4D9] shadow-xs">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[#C1A68D]" />
            <span className="text-xs font-black text-[#2A2723]">الشهر:</span>
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-4 py-2 text-xs font-black outline-none cursor-pointer focus:border-mazar-gold transition-all"
          >
            {MONTHS_AR.map((name, index) => (
              <option key={name} value={index}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-4 py-2 text-xs font-black outline-none cursor-pointer focus:border-mazar-gold transition-all"
          >
            {[2025, 2026, 2027].map((val) => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </div>
      </header>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 text-xs font-black">{error}</div>}
      {successMsg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl p-4 text-xs font-black">{successMsg}</div>}

      {/* Monthly Balance Overview Card */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Treasury Balance for Month */}
        <div className="md:col-span-2 glass-card bg-gradient-to-br from-[#2A2723] via-[#35312C] to-[#1F1C18] text-white p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between border border-white/10">
          <div className="flex justify-between items-start z-10">
            <div>
              <span className="text-[11px] font-black text-mazar-gold uppercase tracking-[0.2em] bg-white/10 px-3.5 py-1 rounded-full border border-mazar-gold/30">
                المتبقي في الخزنة لشهر ({MONTHS_AR[month]} {year})
              </span>
              <div className="text-4xl md:text-5xl font-black text-white mt-4 tracking-tight flex items-baseline gap-2">
                <span>{isLoading ? '...' : Math.round(currentMonthlyRemaining).toLocaleString()}</span>
                <span className="text-xl text-mazar-gold font-bold">ج.م</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-mazar-gold flex items-center justify-center text-2xl shadow-xl border border-white/10">
              🔐
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-white/10 z-10">
            <div>
              <span className="text-[10px] text-white/60 font-bold block">أرباح الشهر المتاحة في الخزنة</span>
              <span className="text-base font-black text-emerald-400 mt-1 block">+{money(monthlyProfitInflow)}</span>
            </div>
            <div>
              <span className="text-[10px] text-white/60 font-bold block">إجمالي ما تم سحبه هذا الشهر</span>
              <span className="text-base font-black text-rose-400 mt-1 block">-{money(totalWithdrawalsThisMonth)}</span>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="bg-white border border-[#EAE4D9] p-8 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-black text-[#7A7061] uppercase tracking-wider block mb-2">
              الحساب الحالي
            </span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-black text-[#2A2723]">👤 {currentUserName}</span>
            </div>
            <p className="text-[11px] text-[#7A7061] font-bold mt-3 leading-relaxed">
              يتم تسجيل اسم الساحب وساعة السحب تلقائياً لضبط حسابات الشهر بدقة.
            </p>
          </div>

          <div className="bg-[#FDFBF7] p-3.5 rounded-2xl border border-[#EAE4D9] mt-4 flex items-center justify-between text-xs font-bold text-[#2A2723]">
            <span>حركات سحب الشهر:</span>
            <span className="font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
              {monthlyWithdrawals.length} حركة
            </span>
          </div>
        </div>

      </section>

      {/* Simple Form: تسجيل سحب من الخزنة */}
      <section className="bg-white p-6 md:p-8 rounded-3xl border border-[#EAE4D9] shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
            <TrendingDown size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#2A2723]">تسجيل سحب فلوس من الخزنة</h3>
            <p className="text-[11px] font-bold text-[#7A7061]">اكتب المبلغ وسبب السحب ليتم خصمه من رصيد الشهر فوراً</p>
          </div>
        </div>

        <form onSubmit={handleWithdrawSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#7A7061]">المبلغ المسحوب (ج.م) *</label>
              <input
                required
                type="number"
                min="1"
                step="any"
                placeholder="مثلاً: 20000"
                value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-gray-200 focus:border-rose-400 rounded-xl px-4 py-3 text-sm font-black text-rose-600 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#7A7061]">السبب (سحبت ليه؟) *</label>
              <input
                required
                placeholder="مثلاً: سحب أرباح مؤمن، التزامات..."
                value={withdrawForm.reason}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-gray-200 focus:border-mazar-gold rounded-xl px-4 py-3 text-sm font-bold text-[#2A2723] outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#7A7061]">تاريخ السحب (سحبت إمتى؟) *</label>
              <input
                required
                type="date"
                value={withdrawForm.date}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, date: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-gray-200 focus:border-mazar-gold rounded-xl px-4 py-3 text-xs font-bold text-[#2A2723] outline-none transition-all cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-[#7A7061]">ساعة السحب *</label>
              <input
                required
                placeholder="مثلاً: 08:30 م"
                value={withdrawForm.time}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, time: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-gray-200 focus:border-mazar-gold rounded-xl px-4 py-3 text-xs font-bold text-[#2A2723] outline-none transition-all"
              />
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black px-8 py-3.5 rounded-xl transition-all shadow-md active:scale-95 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <TrendingDown size={16} />
              <span>{isSaving ? 'جاري التسجيل...' : 'تسجيل السحب من الخزنة'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Simple Withdrawals Table: جدول مسحوبات الشهر */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xl font-black text-[#2A2723] flex items-center gap-2">
            <span>📋 جدول مسحوبات شهر ({MONTHS_AR[month]} {year})</span>
          </h2>
          <span className="text-xs font-black text-[#7A7061]">
            المتبقي في الخزنة حالياً: <b className="text-emerald-700">{money(currentMonthlyRemaining)}</b>
          </span>
        </div>

        <div className="glass-card overflow-hidden border-[#EAE4D9] shadow-sm rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#2A2723] text-white text-xs font-black uppercase tracking-wider">
                  <th className="px-3 py-3.5 border-x border-white/10 w-12">م</th>
                  <th className="px-4 py-3.5 border-x border-white/10 w-32">المبلغ المسحوب</th>
                  <th className="px-4 py-3.5 border-x border-white/10 w-36">التاريخ والساعة</th>
                  <th className="px-6 py-3.5 border-x border-white/10 text-right">السبب / البيان</th>
                  <th className="px-4 py-3.5 border-x border-white/10 w-32">سحب بواسطة</th>
                  <th className="px-4 py-3.5 border-x border-white/10 w-36">المتبقي في الخزنة</th>
                  <th className="px-3 py-3.5 border-x border-white/10 w-20">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4D9]/60 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="inline-block w-6 h-6 border-3 border-mazar-gold border-t-transparent rounded-full animate-spin"></div>
                    </td>
                  </tr>
                ) : withdrawalsWithRunningBalance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-14 text-center text-[#7A7061] font-bold">
                      ✨ لا توجد أي مسحوبات مسجلة لشهر ({MONTHS_AR[month]} {year})، رصيد الخزنة كامل ومتاح ({money(monthlyProfitInflow)}).
                    </td>
                  </tr>
                ) : (
                  withdrawalsWithRunningBalance.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FDFBF7] transition-colors">
                      <td className="px-3 py-3.5 font-bold text-gray-400">{item.index}</td>
                      <td className="px-4 py-3.5 font-black text-rose-600 whitespace-nowrap text-sm">
                        -{Number(item.amount).toLocaleString()} ج.م
                      </td>
                      <td className="px-4 py-3.5 font-bold text-gray-600 whitespace-nowrap">
                        <div>{item.transfer_date}</div>
                        {item.time && <div className="text-[10px] text-gray-400 mt-0.5 font-normal">⏰ {item.time}</div>}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-[#2A2723] text-right">
                        {item.reason || item.notes || 'سحب من الخزنة'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-black">
                          <UserCheck size={12} className="text-emerald-600" />
                          <span>{item.actor || item.received_by || 'مؤمن'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-black text-[#2A2723] whitespace-nowrap bg-[#FDFBF7]/60">
                        {money(item.remaining)}
                      </td>
                      <td className="px-3 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransfer(item.id)}
                          title="حذف حركة السحب"
                          className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center active:scale-90 mx-auto cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}
