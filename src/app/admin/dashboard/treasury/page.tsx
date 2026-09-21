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
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const CONFIRMED_STATUSES = ['approved', 'مؤكد', 'مؤكد/دخول', 'مغادر/تنظيف', 'مغادر/تم'];

const money = (value: number) => `${Math.round(value).toLocaleString('ar-EG')} ج.م`;

export default function TreasuryPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [filterMode, setFilterMode] = useState<'all' | 'monthly'>('all');

  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  // Forms
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '',
    reason: '',
    date: today.toISOString().slice(0, 10),
  });

  const [depositForm, setDepositForm] = useState({
    amount: '',
    handedBy: '',
    notes: '',
    date: today.toISOString().slice(0, 10),
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Admin Auth / Ownership
  const [adminInfo, setAdminInfo] = useState<any>(null);

  useEffect(() => {
    const info = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminInfo') || '{}') : {};
    setAdminInfo(info);
    if (info?.name || info?.username) {
      const displayName = info.name || info.username;
      setDepositForm(prev => ({ ...prev, handedBy: displayName }));
    }
  }, []);

  const currentUserName = useMemo(() => {
    if (adminInfo?.name?.includes('مدحت') || adminInfo?.username?.toLowerCase()?.includes('medhat')) return 'مدحت';
    if (adminInfo?.name?.includes('مؤمن') || adminInfo?.username?.toLowerCase()?.includes('mo2men')) return 'مؤمن';
    return adminInfo?.name || adminInfo?.username || 'Admin';
  }, [adminInfo]);

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

  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals'>('deposits');

  // If user is owner, default to withdrawals tab or allow toggle; if not owner, force deposits
  useEffect(() => {
    if (isOwner) {
      setActiveTab('withdrawals');
    } else {
      setActiveTab('deposits');
    }
  }, [isOwner]);

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

  // Filter transfers by month/year if needed
  const displayTransfers = useMemo(() => {
    if (filterMode === 'all') return transfers;
    return transfers.filter((t) => {
      const date = new Date(`${t.transfer_date}T00:00:00`);
      return date.getMonth() === month && date.getFullYear() === year;
    });
  }, [transfers, filterMode, month, year]);

  // Separate into Deposits and Withdrawals
  const depositsList = useMemo(() => {
    return displayTransfers.filter((t) => t.type !== 'withdrawal');
  }, [displayTransfers]);

  const withdrawalsList = useMemo(() => {
    return displayTransfers.filter((t) => t.type === 'withdrawal');
  }, [displayTransfers]);

  // Overall totals across the whole database
  const totalDepositsAllTime = useMemo(() => {
    return transfers
      .filter((t) => t.type !== 'withdrawal')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transfers]);

  const totalWithdrawalsAllTime = useMemo(() => {
    return transfers
      .filter((t) => t.type === 'withdrawal')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transfers]);

  const currentMainTreasuryBalance = Math.max(0, totalDepositsAllTime - totalWithdrawalsAllTime);

  // Sub Treasury (Revenues - Commissions - Expenses)
  const subTreasuryCalculated = useMemo(() => {
    const confirmedBookings = bookings.filter((b) => CONFIRMED_STATUSES.includes(String(b.status)));
    const revenue = confirmedBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    const commissions = confirmedBookings.reduce((sum, b) => sum + (Number(b.commission) || 0), 0);
    const approvedExpenses = expenses
      .filter((e) => (e.status && e.status.includes('تم الموافقة')) || (e.approved_by && e.approved_by !== ''))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netSub = Math.max(0, revenue - commissions - approvedExpenses);
    return Math.max(0, netSub - totalDepositsAllTime);
  }, [bookings, expenses, totalDepositsAllTime]);

  // Calculate Running Remaining Balance for Withdrawals Table
  const withdrawalsWithRunningBalance = useMemo(() => {
    // Sort all transfers chronologically to calculate accurate remaining
    const sortedAll = [...transfers].sort((a, b) => {
      const d1 = new Date(`${a.transfer_date}T00:00:00`).getTime();
      const d2 = new Date(`${b.transfer_date}T00:00:00`).getTime();
      return d1 - d2;
    });

    let running = 0;
    const balanceMap: Record<string, number> = {};

    sortedAll.forEach((t) => {
      if (t.type !== 'withdrawal') {
        running += Number(t.amount) || 0;
      } else {
        running = Math.max(0, running - (Number(t.amount) || 0));
        balanceMap[t.id] = running;
      }
    });

    // Return the withdrawals to display with their calculated running balance
    return withdrawalsList.map((w, idx) => ({
      ...w,
      index: idx + 1,
      remaining: balanceMap[w.id] !== undefined ? balanceMap[w.id] : currentMainTreasuryBalance,
    }));
  }, [transfers, withdrawalsList, currentMainTreasuryBalance]);

  // Submit Withdrawal
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawForm.amount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      alert('الرجاء كتابة مبلغ سحب صحيح');
      return;
    }
    if (!withdrawForm.reason.trim()) {
      alert('الرجاء كتابة سبب السحب');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await saveDbTreasuryTransfer({
        type: 'withdrawal',
        amount: amountNum,
        handed_by: 'الخزنة الرئيسية',
        received_by: currentUserName,
        actor: currentUserName,
        reason: withdrawForm.reason.trim(),
        notes: withdrawForm.reason.trim(),
        transfer_date: withdrawForm.date || today.toISOString().slice(0, 10),
      });

      setWithdrawForm({
        amount: '',
        reason: '',
        date: today.toISOString().slice(0, 10),
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

  // Submit Deposit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositForm.amount);
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      alert('الرجاء كتابة مبلغ توريد صحيح');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await saveDbTreasuryTransfer({
        type: 'deposit',
        amount: amountNum,
        handed_by: depositForm.handedBy.trim() || currentUserName,
        received_by: 'الخزنة الرئيسية',
        actor: depositForm.handedBy.trim() || currentUserName,
        reason: depositForm.notes.trim() || 'توريد للخزنة الرئيسية',
        notes: depositForm.notes.trim() || 'توريد للخزنة الرئيسية',
        transfer_date: depositForm.date || today.toISOString().slice(0, 10),
      });

      setDepositForm({
        amount: '',
        handedBy: currentUserName,
        notes: '',
        date: today.toISOString().slice(0, 10),
      });
      setSuccessMsg('✅ تم تسجيل التوريد إلى الخزنة الرئيسية بنجاح');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError('فشل تسجيل التوريد: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Record
  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الحركة المالية؟')) return;
    try {
      await deleteDbTreasuryTransfer(id);
      setTransfers((prev) => prev.filter((t) => t.id !== id));
      loadData();
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء الحذف: ' + err.message);
    }
  };

  // Render
  return (
    <div className="space-y-10 pb-20 animate-fade-in font-sans" dir="rtl">
      
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#EAE4D9] pb-6">
        <div>
          {isOwner ? (
            <div className="inline-flex items-center gap-2 bg-[#2A2723] text-mazar-gold px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xs mb-3">
              <Lock size={13} />
              <span>خاص بأصحاب المكان (مؤمن + مدحت)</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-[#2A2723] text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-xs mb-3">
              <Wallet size={13} className="text-mazar-gold" />
              <span>إدارة تحويلات وتوريدات الخزنة</span>
            </div>
          )}
          <h1 className="text-3xl md:text-5xl font-black text-[#2A2723] tracking-tight">إدارة الخزنة</h1>
          <p className="text-xs md:text-sm font-bold text-[#7A7061] mt-2">
            متابعة أرصدة الخزنة الرئيسية والفرعية والتحويلات المالية والتوريدات
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-2xl border border-[#EAE4D9] shadow-xs">
          <div className="flex gap-1 bg-[#FDFBF7] p-1 rounded-xl border border-[#EAE4D9]">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                filterMode === 'all' ? 'bg-[#2A2723] text-white shadow-xs' : 'text-gray-600 hover:text-black'
              }`}
            >
              عرض الكل
            </button>
            <button
              onClick={() => setFilterMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                filterMode === 'monthly' ? 'bg-[#2A2723] text-white shadow-xs' : 'text-gray-600 hover:text-black'
              }`}
            >
              تصفية شهرية
            </button>
          </div>

          {filterMode === 'monthly' && (
            <div className="flex gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-black outline-none"
              >
                {MONTHS_AR.map((name, index) => <option key={name} value={index}>{name}</option>)}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-3 py-2 text-xs font-black outline-none"
              >
                {[2025, 2026, 2027].map((val) => <option key={val} value={val}>{val}</option>)}
              </select>
            </div>
          )}
        </div>
      </header>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 text-xs font-black">{error}</div>}
      {successMsg && <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl p-4 text-xs font-black">{successMsg}</div>}

      {/* Main Balance Hero Cards (الخزنة الرئيسية + الخزنة الفرعية) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Treasury Balance */}
        <div className="md:col-span-2 glass-card bg-gradient-to-br from-[#2A2723] via-[#35312C] to-[#1F1C18] text-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between border border-white/10">
          <div className="flex justify-between items-start z-10">
            <div>
              <span className="text-[11px] font-black text-mazar-gold uppercase tracking-[0.2em] bg-white/10 px-4 py-1.5 rounded-full border border-mazar-gold/30">
                المبلغ اللي في الخزنة الرئيسية حالياً
              </span>
              <div className="text-4xl md:text-6xl font-black text-white mt-5 tracking-tight flex items-baseline gap-2">
                <span>{isLoading ? '...' : Math.round(currentMainTreasuryBalance).toLocaleString()}</span>
                <span className="text-xl md:text-2xl text-mazar-gold font-bold">ج.م</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/10 text-mazar-gold flex items-center justify-center text-3xl shadow-xl border border-white/10">
              🔐
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/10 z-10">
            <div>
              <span className="text-[10px] text-white/60 font-bold block">إجمالي الوارد للخزنة الرئيسية</span>
              <span className="text-lg font-black text-emerald-400 mt-1 block">+{money(totalDepositsAllTime)}</span>
            </div>
            {isOwner ? (
              <div>
                <span className="text-[10px] text-white/60 font-bold block">إجمالي المسحوبات</span>
                <span className="text-lg font-black text-rose-400 mt-1 block">-{money(totalWithdrawalsAllTime)}</span>
              </div>
            ) : (
              <div>
                <span className="text-[10px] text-white/60 font-bold block">حالة الخزنة</span>
                <span className="text-sm font-black text-mazar-gold mt-1 block">🟢 نشطة ومحدثة</span>
              </div>
            )}
          </div>
        </div>

        {/* Sub-treasury Info Card */}
        <div className="bg-[#FDFBF7] border border-[#EAE4D9] p-8 rounded-[2.5rem] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-[#7A7061] mb-2">
              <Wallet size={16} />
              <span>الخزنة الفرعية (الأرباح المتاحة للتوريد)</span>
            </div>
            <div className="text-3xl font-black text-[#2A2723] mt-3">
              {isLoading ? '...' : money(subTreasuryCalculated)}
            </div>
            <p className="text-[11px] text-[#7A7061] font-bold mt-4 leading-relaxed">
              صافي أرباح الحجوزات التشغيلية المتبقية المتاحة للتحويل إلى الخزنة الرئيسية.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#EAE4D9] mt-6 flex items-center justify-between">
            <span className="text-[11px] font-black text-[#2A2723]">المستخدم الحالي:</span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              🟢 {currentUserName}
            </span>
          </div>
        </div>
      </section>

      {/* Action Forms Section (سحب جديد للمالك / توريد جديد للكل) */}
      <section className="glass-card bg-white p-8 md:p-10 rounded-[2.5rem] border border-[#EAE4D9] shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {isOwner && (
              <button
                type="button"
                onClick={() => setActiveTab('withdrawals')}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'withdrawals'
                    ? 'bg-rose-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <TrendingDown size={16} />
                <span>تسجيل سحب من الخزنة الرئيسية</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('deposits')}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                activeTab === 'deposits'
                  ? 'bg-emerald-600 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <TrendingUp size={16} />
              <span>تحويل / توريد من الخزنة الفرعية إلى الخزنة الرئيسية</span>
            </button>
          </div>

          <span className="text-xs font-black text-[#7A7061]">
            رصيد الخزنة الفرعية المتاح: <b className="text-emerald-700">{money(subTreasuryCalculated)}</b>
          </span>
        </div>

        {/* 1. Withdrawal Form (Owner Only) */}
        {isOwner && activeTab === 'withdrawals' && (
          <form onSubmit={handleWithdrawSubmit} className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest">المبلغ المسحوب (ج.م) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  placeholder="مثلاً: 5000"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  className="w-full bg-[#FDFBF7] border-2 border-rose-100 focus:border-rose-400 rounded-2xl px-5 py-4 text-sm font-black text-rose-700 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest">السبب / البيان *</label>
                <input
                  required
                  placeholder="مثلاً: سحب أرباح، استحقاق خاص..."
                  value={withdrawForm.reason}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
                  className="w-full bg-[#FDFBF7] border-2 border-gray-100 focus:border-mazar-gold rounded-2xl px-5 py-4 text-sm font-bold text-[#2A2723] outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest">تاريخ السحب *</label>
                <input
                  required
                  type="date"
                  value={withdrawForm.date}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, date: e.target.value })}
                  className="w-full bg-[#FDFBF7] border-2 border-gray-100 focus:border-mazar-gold rounded-2xl px-5 py-4 text-sm font-bold text-[#2A2723] outline-none transition-all cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">سحب بواسطة (تلقائي)</label>
                <div className="w-full bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-5 py-4 text-sm font-black text-emerald-800 flex items-center justify-between">
                  <span>{currentUserName}</span>
                  <span className="text-[9px] bg-emerald-200 px-2 py-0.5 rounded-full">تلقائي</span>
                </div>
              </div>

            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <TrendingDown size={18} />
              <span>{isSaving ? 'جاري تسجيل السحب...' : 'تسجيل حركة السحب من الخزنة الرئيسية'}</span>
            </button>
          </form>
        )}

        {/* 2. Deposit / Transfer Form (Accessible to Admin & Owners) */}
        {activeTab === 'deposits' && (
          <form onSubmit={handleDepositSubmit} className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest">المبلغ المراد تحويله (ج.م) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  placeholder="مثلاً: 20000"
                  value={depositForm.amount}
                  onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                  className="w-full bg-[#FDFBF7] border-2 border-emerald-100 focus:border-emerald-400 rounded-2xl px-5 py-4 text-sm font-black text-emerald-700 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest">مُسلّم المبلغ / القائم بالتحويل *</label>
                <input
                  required
                  placeholder="مثلاً: الخزنة الفرعية، Admin، مؤمن..."
                  value={depositForm.handedBy}
                  onChange={(e) => setDepositForm({ ...depositForm, handedBy: e.target.value })}
                  className="w-full bg-[#FDFBF7] border-2 border-gray-100 focus:border-mazar-gold rounded-2xl px-5 py-4 text-sm font-bold text-[#2A2723] outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest">التاريخ *</label>
                <input
                  required
                  type="date"
                  value={depositForm.date}
                  onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
                  className="w-full bg-[#FDFBF7] border-2 border-gray-100 focus:border-mazar-gold rounded-2xl px-5 py-4 text-sm font-bold text-[#2A2723] outline-none transition-all cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest">ملاحظات / البيان</label>
                <input
                  placeholder="تحويل أرباح الخزنة الفرعية للخزنة الرئيسية..."
                  value={depositForm.notes}
                  onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                  className="w-full bg-[#FDFBF7] border-2 border-gray-100 focus:border-mazar-gold rounded-2xl px-5 py-4 text-sm font-bold text-[#2A2723] outline-none transition-all"
                />
              </div>

            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <TrendingUp size={18} />
              <span>{isSaving ? 'جاري تسجيل التحويل...' : 'إتمام التحويل إلى الخزنة الرئيسية'}</span>
            </button>
          </form>
        )}
      </section>

      {/* Main Table: جدول سحب من الخزنة الرئيسية (يظهر لمؤمن ومدحت فقط) */}
      {isOwner && (
        <section className="space-y-6">
          <div className="flex justify-between items-end px-2">
            <div>
              <h2 className="text-2xl font-black text-[#2A2723] flex items-center gap-3">
                <span>* جدول سحب من الخزنة الرئيسية</span>
                <span className="text-xs bg-rose-100 text-rose-800 px-3 py-1 rounded-full font-black">
                  {withdrawalsList.length} حركة سحب
                </span>
              </h2>
              <p className="text-[11px] font-bold text-[#7A7061] mt-1">
                سحب بواسطة يكتب تلقائياً، والرصيد المتبقي في الخزنة يُحسب تراكمياً وتلقائياً بعد كل سحب
              </p>
            </div>
          </div>

          <div className="glass-card overflow-hidden border-[#EAE4D9] shadow-2xl rounded-[2rem] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse min-w-[750px]">
                <thead>
                  <tr className="bg-[#2A2723] text-white text-xs font-black uppercase tracking-widest">
                    <th className="px-4 py-5 border-x border-white/10 w-16">م</th>
                    <th className="px-6 py-5 border-x border-white/10 w-36">المبلغ</th>
                    <th className="px-6 py-5 border-x border-white/10 w-36">التاريخ</th>
                    <th className="px-8 py-5 border-x border-white/10 text-right">السبب</th>
                    <th className="px-6 py-5 border-x border-white/10 w-44">سحب بواسطة</th>
                    <th className="px-6 py-5 border-x border-white/10 w-44">المتبقي في الخزنة</th>
                    <th className="px-4 py-5 border-x border-white/10 w-24">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4D9]/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-16 text-center">
                        <div className="inline-block w-8 h-8 border-4 border-mazar-gold border-t-transparent rounded-full animate-spin"></div>
                      </td>
                    </tr>
                  ) : withdrawalsWithRunningBalance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-20 text-center text-[#7A7061] font-black text-sm">
                        لا توجد أي حركات سحب مسجلة من الخزنة الرئيسية حتى الآن
                      </td>
                    </tr>
                  ) : (
                    withdrawalsWithRunningBalance.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FDFBF7] transition-colors">
                        <td className="px-4 py-5 text-sm font-black text-gray-500">{item.index}</td>
                        <td className="px-6 py-5 text-base font-black text-rose-600 whitespace-nowrap">
                          -{Number(item.amount).toLocaleString()} ج.م
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-gray-600 whitespace-nowrap">
                          {item.transfer_date}
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-[#2A2723] text-right">
                          {item.reason || item.notes || '—'}
                        </td>
                        <td className="px-6 py-5">
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-black">
                            <UserCheck size={14} className="text-emerald-600" />
                            <span>{item.actor || item.received_by || 'مؤمن'}</span>
                          </span>
                        </td>
                        <td className="px-6 py-5 text-base font-black text-[#2A2723] whitespace-nowrap bg-[#FDFBF7]/80">
                          {money(item.remaining)}
                        </td>
                        <td className="px-4 py-5">
                          <button
                            type="button"
                            onClick={() => handleDeleteTransfer(item.id)}
                            title="حذف حركة السحب"
                            className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-xs flex items-center justify-center active:scale-90 mx-auto cursor-pointer"
                          >
                            <Trash2 size={16} strokeWidth={2.5} />
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
      )}

      {/* Secondary Table: سجل التوريدات الواردة للخزنة الرئيسية */}
      <section className="space-y-6 pt-6 border-t border-[#EAE4D9]">
        <div className="flex justify-between items-end px-2">
          <div>
            <h2 className="text-xl font-black text-[#2A2723] flex items-center gap-3">
              <span>📥 سجل التوريدات والإيداعات إلى الخزنة الرئيسية</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-black">
                {depositsList.length} حركة توريد
              </span>
            </h2>
            <p className="text-[11px] font-bold text-[#7A7061] mt-1">
              المبالغ المحولة والمودعة لتغذية رصيد الخزنة الرئيسية
            </p>
          </div>
        </div>

        <div className="glass-card overflow-hidden border-[#EAE4D9] shadow-md rounded-[2rem] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#35312C] text-white text-xs font-black uppercase tracking-widest">
                  <th className="px-4 py-4 border-x border-white/10 w-16">م</th>
                  <th className="px-6 py-4 border-x border-white/10 w-36">المبلغ</th>
                  <th className="px-6 py-4 border-x border-white/10 w-36">التاريخ</th>
                  <th className="px-8 py-4 border-x border-white/10 text-right">البيان / الملاحظات</th>
                  <th className="px-6 py-4 border-x border-white/10 w-44">مُسلّم المبلغ</th>
                  <th className="px-4 py-4 border-x border-white/10 w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4D9]/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <div className="inline-block w-6 h-6 border-3 border-mazar-gold border-t-transparent rounded-full animate-spin"></div>
                    </td>
                  </tr>
                ) : depositsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-[#7A7061] font-bold text-xs">
                      لا توجد توريدات مسجلة لهذا الشهر
                    </td>
                  </tr>
                ) : (
                  depositsList.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-[#FDFBF7] transition-colors text-xs">
                      <td className="px-4 py-4 font-bold text-gray-400">{idx + 1}</td>
                      <td className="px-6 py-4 font-black text-emerald-600 whitespace-nowrap">
                        +{money(Number(item.amount))}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-600 whitespace-nowrap">
                        {item.transfer_date}
                      </td>
                      <td className="px-8 py-4 font-bold text-[#2A2723] text-right">
                        {item.notes || item.reason || 'توريد للخزنة الرئيسية'}
                      </td>
                      <td className="px-6 py-4 font-black text-[#7A7061]">
                        {item.actor || item.handed_by || 'مزار'}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => handleDeleteTransfer(item.id)}
                          title="حذف حركة التوريد"
                          className="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center active:scale-90 mx-auto cursor-pointer"
                        >
                          <Trash2 size={14} />
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
