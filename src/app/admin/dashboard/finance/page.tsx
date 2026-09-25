"use client";

import { useState, useEffect, useMemo } from 'react';
import { getBookings, getSystemUnits } from '@/lib/data-init';
import { getDbExpenses, getDbSalaries } from '@/lib/actions/db';
import { Calendar, TrendingUp } from 'lucide-react';
import FinancialSummaryTab from '../reports/FinancialSummaryTab';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// شركاء مزار (1) + مزار (2) — استوديوهات 1 إلى 24
const PARTNERS_MAZAR12 = [
  { key: 'MH', label: 'M.H', percentage: 35 },
  { key: 'HO', label: 'H.O', percentage: 18 },
  { key: 'ME', label: 'M.E', percentage: 23.5 },
  { key: 'HM', label: 'H.M', percentage: 23.5 },
];

// شركاء مزار (3) — الوحدات 25 إلى 30
const PARTNERS_MAZAR3 = [
  { key: 'Koura', label: 'Koura', percentage: 50 },
  { key: 'MM',   label: 'M.M',   percentage: 25 },
  { key: 'ME',   label: 'M.E',   percentage: 25 },
];

// ── بطاقة مقياس ──
function KpiCard({
  label,
  value,
  sub,
  color = 'text-[#2A2723]',
  bg = 'bg-white',
  border = 'border-[#EAE4D9]/50',
  highlighted = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  bg?: string;
  border?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`${bg} p-5 rounded-2xl border ${border} shadow-sm text-center flex flex-col items-center justify-center gap-1 ${highlighted ? 'ring-2 ring-[#FACC15]' : ''}`}
    >
      <p className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest">{label}</p>
      <div className={`text-2xl font-black ${color}`}>
        {value} <small className="text-xs font-bold text-[#7A7061]">ج.م</small>
      </div>
      {sub && <p className="text-[9px] text-[#7A7061] font-bold">{sub}</p>}
    </div>
  );
}

// ── جدول توزيع الأرباح ──
function ProfitDistribution({
  partners,
  netProfit,
  isLoading,
}: {
  partners: { key: string; label: string; percentage: number }[];
  netProfit: number;
  isLoading: boolean;
}) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full border-collapse text-center">
        <thead>
          <tr className="bg-[#FDFBF7]">
            <th className="px-4 py-3 text-[10px] font-black text-[#7A7061] border border-[#EAE4D9]/60">توزيع الأرباح</th>
            {partners.map((p) => (
              <th key={p.key} className="px-6 py-3 font-black text-sm text-[#2A2723] border border-[#EAE4D9]/60">
                {p.label}
                <span className="block text-[10px] font-bold text-[#C1A68D]">%{p.percentage}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-4 py-5 font-black text-[#7A7061] text-xs border border-[#EAE4D9]/40 bg-[#FDFBF7]/60">
              القيمة
            </td>
            {partners.map((p) => (
              <td key={p.key} className="px-6 py-5 border border-[#EAE4D9]/40">
                <div className={`text-xl font-black ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {isLoading ? '...' : Math.round((netProfit * p.percentage) / 100).toLocaleString()}
                </div>
                <div className="text-[10px] text-[#7A7061] font-bold mt-1">ج.م</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Robust date parser: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO
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

export default function FinancePage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(-1);
  const [selectedYear, setSelectedYear] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [adminRole, setAdminRole] = useState<string>('Super Admin');



  useEffect(() => {
    const info = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminInfo') || '{}') : {};
    if (info?.role) setAdminRole(info.role);
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
  }, []);

  const isAkoura = adminRole === 'Akoura' || adminRole === 'Aura';
  const isMohsen = adminRole === 'Mohsen';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [b, expData, salData, unitsData] = await Promise.all([
        getBookings(),
        getDbExpenses(),
        getDbSalaries(),
        getSystemUnits(),
      ]);
      setBookings(b);
      setExpenses(expData || []);
      setSalaries(salData || []);
      setUnits(unitsData || []);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getBranchLabel = (branch: any) => {
    const b = parseInt(branch);
    if (b === 1 || b === 2 || b === 12) return 'مزار 1 و 2';
    if (b === 3) return 'مزار 3';
    if (b === 4) return 'شقة فندقية 1';
    if (b === 5) return 'شقة فندقية 2';
    if (b === 6) return 'شقة فندقية 3';
    return 'عام';
  };




  const monthlyRollupData = useMemo(() => {
    const activeYear = selectedYear !== -1 ? selectedYear : new Date().getFullYear();
    const result = [];

    for (let m = 0; m < 12; m++) {
      // Month bookings
      const mBookings = bookings.filter((b: any) => {
        if (b.status === 'deleted') return false;
        if (b.status !== 'approved' && b.status !== 'مؤكد') return false;
        const parsed = parseDateYM(b.checkIn);
        if (!parsed || parsed.month !== m || parsed.year !== activeYear) return false;

        const u = units.find((unit: any) => unit.id === b.apartmentId);
        if (isAkoura) {
          return u?.branch === 3 || String(b.apartmentId).startsWith('p-s');
        }
        if (isMohsen) return u?.branch === 1 || u?.branch === 2;
        return true;
      });

      // Month expenses
      // Include all expenses except explicitly rejected — old data may have no status
      const isApprovedExpense = (e: any) => {
        if (!e) return false;
        if (e.status === 'REJECTED' || e.status === 'مرفوض') return false;
        return true;
      };

      const mExpenses = expenses.filter((e: any) => {
        if (!isApprovedExpense(e)) return false;
        if (!e.date) return false;
        const parsed = parseDateYM(e.date);
        if (!parsed || parsed.month !== m || parsed.year !== activeYear) return false;

        if (isAkoura) {
          return e.branch === 3 || e.branch === '3' || String(e.unitId || '').startsWith('p-s');
        }
        if (isMohsen) return [1, 2, 12].includes(Number(e.branch) || 12);
        return true;
      });

      const rev = mBookings.reduce((acc, b) => acc + (parseFloat(b.totalAmount || 0) - parseFloat(b.commission || 0)), 0);
      const exp = mExpenses.reduce((acc, e) => acc + parseFloat(e.amount || 0), 0);
      const profit = rev - exp;

      result.push({
        monthIndex: m,
        monthName: MONTHS_AR[m],
        bookingsCount: mBookings.length,
        revenue: rev,
        expenses: exp,
        netProfit: profit,
        hasData: rev > 0 || exp > 0 || mBookings.length > 0
      });
    }

    return result;
  }, [bookings, expenses, units, selectedYear, isAkoura, isMohsen]);

  // ── الحجوزات المؤكدة للشهر المختار ──
  const monthlyBookings = useMemo(() => {
    return bookings.filter((b: any) => {
      if (b.status === 'deleted') return false;
      if (b.status !== 'approved' && b.status !== 'مؤكد') return false;
      const parsed = parseDateYM(b.checkIn);
      if (!parsed || parsed.month !== selectedMonth || parsed.year !== selectedYear) return false;
      if (!isMohsen) return true;
      const unit = units.find((candidate: any) => candidate.id === b.apartmentId);
      return unit?.branch === 1 || unit?.branch === 2;
    });
  }, [bookings, selectedMonth, selectedYear, units, isMohsen]);

  // ── المصروفات الشهرية ──
  const monthlyExpenses = useMemo(() => {
    // Include all expenses except explicitly rejected — old data may have no status
    return expenses.filter((e: any) => {
      if (!e || e.status === 'REJECTED' || e.status === 'مرفوض') return false;
      if (!e.date) return false;
      const parsed = parseDateYM(e.date);
      if (!parsed || parsed.month !== selectedMonth || parsed.year !== selectedYear) return false;
      return !isMohsen || [1, 2, 12].includes(Number(e.branch) || 12);
    });
  }, [expenses, selectedMonth, selectedYear, isMohsen]);

  const monthlySalaries = useMemo(() => {
    return salaries.filter((s: any) =>
      Number(s.month) - 1 === selectedMonth && Number(s.year) === selectedYear
    );
  }, [salaries, selectedMonth, selectedYear]);

  // إجمالي الرواتب
  const salariesFromExpenses = monthlyExpenses
    .filter(e => e.category === 'رواتب' || e.category === 'مرتبات' || e.category === 'مرتب')
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const salariesTotal = monthlySalaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) + salariesFromExpenses;

  // المصروفات التشغيلية لـ مزار 1 ومزار 2 (غير الرواتب)
  const mazar12Expenses = monthlyExpenses
    .filter(e =>
      (e.branch === 1 || e.branch === 2 || e.branch === '1' || e.branch === '2' || e.branch === 12 || e.branch === '12' || !e.branch) &&
      e.category !== 'رواتب' &&
      e.category !== 'مرتبات' &&
      e.category !== 'مرتب'
    )
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // المصروفات التشغيلية لـ مزار 3
  const mazar3Expenses = monthlyExpenses
    .filter(e =>
      (e.branch === 3 || e.branch === '3') &&
      e.category !== 'رواتب' &&
      e.category !== 'مرتبات' &&
      e.category !== 'مرتب'
    )
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // مصروفات الشقق الفندقية
  const apt1Expenses = monthlyExpenses
    .filter(e => e.branch === 4 || e.branch === '4')
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const apt2Expenses = monthlyExpenses
    .filter(e => e.branch === 5 || e.branch === '5')
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const apt3Expenses = monthlyExpenses
    .filter(e => e.branch === 6 || e.branch === '6')
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // ════════════════════════════════════════════════
  //  SECTION 1: مزار(1) + مزار(2) — استوديوهات 1-24
  // ════════════════════════════════════════════════
  const mazar12Bookings = monthlyBookings.filter(b => {
    const u = units.find(u => u.id === b.apartmentId);
    return u?.type === 'studio' && (u?.branch === 1 || u?.branch === 2);
  });

  const mazar12Revenue = mazar12Bookings.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
  const mazar12Commissions = mazar12Bookings.reduce((sum, b) => sum + parseFloat(b.commission || 0), 0);
  const mazar12TotalNights = mazar12Bookings.reduce((sum, b) => sum + (Number(b.numberOfDays) || 0), 0);
  const mazar12AvgNight = mazar12TotalNights > 0 ? mazar12Revenue / mazar12TotalNights : 0;
  // صافي الربح = الإيراد - العمولات - المصروفات التشغيلية - الرواتب
  const mazar12NetProfit = mazar12Revenue - mazar12Commissions - mazar12Expenses - salariesTotal;

  // ════════════════════════════════════════════════
  //  SECTION 2: مزار(3) — الوحدات من 25 إلى 30
  // ════════════════════════════════════════════════
  const mazar3Bookings = monthlyBookings.filter(b => {
    const u = units.find(u => u.id === b.apartmentId);
    return u?.branch === 3;
  });

  const mazar3Revenue = mazar3Bookings.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
  const mazar3Commissions = mazar3Bookings.reduce((sum, b) => sum + parseFloat(b.commission || 0), 0);
  const mazar3TotalNights = mazar3Bookings.reduce((sum, b) => sum + (Number(b.numberOfDays) || 0), 0);
  const mazar3AvgNight = mazar3TotalNights > 0 ? mazar3Revenue / mazar3TotalNights : 0;
  const mazar3NetProfit = mazar3Revenue - mazar3Commissions - mazar3Expenses;

  // ════════════════════════════════════════════════
  //  SECTION 3: الشقق الفندقية — apt-1 / apt-2 / apt-3
  // ════════════════════════════════════════════════
  const aptBooking = (aptId: string) =>
    monthlyBookings.filter(b => b.apartmentId === aptId);

  const aptRevenue = (aptId: string) =>
    aptBooking(aptId).reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);

  const aptCommission = (aptId: string) =>
    aptBooking(aptId).reduce((sum, b) => sum + parseFloat(b.commission || 0), 0);

  const apt1Net = aptRevenue('apt-1') - aptCommission('apt-1') - apt1Expenses;
  const apt2Net = aptRevenue('apt-2') - aptCommission('apt-2') - apt2Expenses;
  const apt3Net = aptRevenue('apt-3') - aptCommission('apt-3') - apt3Expenses;

  return (
    <div className="space-y-10 animate-fade-in" dir="rtl">

      {/* ══════════ HEADER ══════════ */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#2A2723]">
            {isAkoura ? 'مزار' : isMohsen ? 'مزار 1 و 2' : 'الإدارة'} <span className="text-[#C1A68D]">{isAkoura ? '(3) — كشف الحساب' : 'المالية الشاملة'}</span>
          </h1>
          <p className="text-[#7A7061] font-bold opacity-70 text-sm mt-1">
            كشف حساب شهر{' '}
            <span className="text-[#2A2723] font-black">
              {selectedMonth >= 0 ? MONTHS_AR[selectedMonth] : '...'} {selectedYear > 0 ? selectedYear : ''}
            </span>
          </p>
        </div>
        <div className="flex gap-3 bg-white p-2 rounded-[1.5rem] border border-[#EAE4D9]/50 shadow-sm">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="bg-[#FDFBF7] border-none rounded-xl px-4 py-2 text-xs font-black outline-none"
          >
            {MONTHS_AR.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-[#FDFBF7] border-none rounded-xl px-4 py-2 text-xs font-black outline-none"
          >
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 ★ مزار(1) + مزار(2) — من استوديو 1 إلى 24
      ══════════════════════════════════════════════════════════════ */}
      {!isAkoura && <div className="bg-white rounded-[2.5rem] border border-[#EAE4D9]/50 shadow-sm overflow-hidden">
        {/* عنوان القسم */}
        <div className="bg-[#2A2723] px-8 py-4 flex items-center gap-3">
          <span className="text-white font-black text-sm tracking-widest">★ مزار (1) + مزار (2)</span>
          <span className="text-[#C1A68D] text-xs font-bold">— من استوديو 1 إلى استوديو 24</span>
        </div>

        <div className="p-6 space-y-6">
          {/* بطاقات المقاييس */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
            <KpiCard
              label="إجمالي الإيراد"
              value={isLoading ? '...' : mazar12Revenue.toLocaleString()}
              sub={`${mazar12Bookings.length} حجز مؤكد`}
              color="text-green-600"
              border="border-green-200"
            />
            <KpiCard
              label="إجمالي المصروفات"
              value={isLoading ? '...' : (mazar12Expenses + salariesTotal).toLocaleString()}
              sub="مصروفات + رواتب"
              color="text-red-500"
              border="border-red-200"
            />
            <KpiCard
              label="إجمالي العمولات"
              value={isLoading ? '...' : mazar12Commissions.toLocaleString()}
              color="text-orange-500"
              border="border-orange-200"
            />
            <KpiCard
              label="صافي الربح"
              value={isLoading ? '...' : mazar12NetProfit.toLocaleString()}
              color={mazar12NetProfit >= 0 ? 'text-green-700' : 'text-red-600'}
              bg={mazar12NetProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}
              border={mazar12NetProfit >= 0 ? 'border-green-300' : 'border-red-300'}
              highlighted={true}
            />
            <KpiCard
              label="معدل سعر الليلة"
              value={isLoading ? '...' : Math.round(mazar12AvgNight).toLocaleString()}
              sub={`${mazar12TotalNights} ليلة`}
              color="text-[#2A2723]"
            />
          </div>

          {/* توزيع الأرباح */}
          <div>
            <p className="text-xs font-black text-[#7A7061] mb-2 uppercase tracking-widest">توزيع الأرباح</p>
            <ProfitDistribution
              partners={PARTNERS_MAZAR12}
              netProfit={mazar12NetProfit}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 ★ مزار(3) — الوحدات من شقة 25 إلى شقة 30
      ══════════════════════════════════════════════════════════════ */}
      {!isMohsen && <div className="bg-white rounded-[2.5rem] border border-[#EAE4D9]/50 shadow-sm overflow-hidden">
        {/* عنوان القسم */}
        <div className="bg-[#2A2723] px-8 py-4 flex items-center gap-3">
          <span className="text-white font-black text-sm tracking-widest">مزار (3)</span>
          <span className="text-[#C1A68D] text-xs font-bold">— الوحدات من شقة 25 إلى شقة 30</span>
        </div>

        <div className="p-6 space-y-6">
          {/* بطاقات المقاييس */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
            <KpiCard
              label="إجمالي الإيراد"
              value={isLoading ? '...' : mazar3Revenue.toLocaleString()}
              sub={`${mazar3Bookings.length} حجز مؤكد`}
              color="text-green-600"
              border="border-green-200"
            />
            <KpiCard
              label="المصروفات"
              value={isLoading ? '...' : mazar3Expenses.toLocaleString()}
              color="text-red-500"
              border="border-red-200"
            />
            <KpiCard
              label="العمولات"
              value={isLoading ? '...' : mazar3Commissions.toLocaleString()}
              color="text-orange-500"
              border="border-orange-200"
            />
            <KpiCard
              label="صافي الربح"
              value={isLoading ? '...' : mazar3NetProfit.toLocaleString()}
              color={mazar3NetProfit >= 0 ? 'text-green-700' : 'text-red-600'}
              bg={mazar3NetProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}
              border={mazar3NetProfit >= 0 ? 'border-green-300' : 'border-red-300'}
              highlighted={true}
            />
            <KpiCard
              label="معدل سعر الليلة"
              value={isLoading ? '...' : Math.round(mazar3AvgNight).toLocaleString()}
              sub={`${mazar3TotalNights} ليلة`}
              color="text-[#2A2723]"
            />
          </div>

          {/* توزيع الأرباح */}
          <div>
            <p className="text-xs font-black text-[#7A7061] mb-2 uppercase tracking-widest">توزيع الأرباح</p>
            <ProfitDistribution
              partners={PARTNERS_MAZAR3}
              netProfit={mazar3NetProfit}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 ★ الشقق الفندقية — شقة(1) + شقة(2) + شقة(3)
      ══════════════════════════════════════════════════════════════ */}
      {!isAkoura && !isMohsen && (
      <div className="bg-white rounded-[2.5rem] border border-[#EAE4D9]/50 shadow-sm overflow-hidden">
        {/* عنوان القسم */}
        <div className="bg-[#2A2723] px-8 py-4 flex items-center gap-3">
          <span className="text-white font-black text-sm tracking-widest">الشقق الفندقية</span>
          <span className="text-[#C1A68D] text-xs font-bold">— شقة (1) ذكي رستم + شقة (2) سيتي ستارز + شقة (3) عباس الرئيسي</span>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* شقة (1) */}
            <div className={`p-6 rounded-2xl border text-center ${apt1Net >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest mb-3">صافي ربح شقة 1 (ذكي رستم)</p>
              <div className={`text-3xl font-black ${apt1Net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {isLoading ? '...' : apt1Net.toLocaleString()}
                <small className="text-sm font-bold text-[#7A7061] ml-1">ج.م</small>
              </div>
              <div className="mt-3 text-[9px] text-[#7A7061] font-bold space-y-0.5">
                <div>إيراد: {isLoading ? '...' : aptRevenue('apt-1').toLocaleString()} ج.م</div>
                <div>عمولات: {isLoading ? '...' : aptCommission('apt-1').toLocaleString()} ج.م</div>
                <div>مصروفات: {isLoading ? '...' : apt1Expenses.toLocaleString()} ج.م</div>
              </div>
            </div>

            {/* شقة (2) */}
            <div className={`p-6 rounded-2xl border text-center ${apt2Net >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest mb-3">صافي ربح شقة 2 (سيتي ستارز)</p>
              <div className={`text-3xl font-black ${apt2Net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {isLoading ? '...' : apt2Net.toLocaleString()}
                <small className="text-sm font-bold text-[#7A7061] ml-1">ج.م</small>
              </div>
              <div className="mt-3 text-[9px] text-[#7A7061] font-bold space-y-0.5">
                <div>إيراد: {isLoading ? '...' : aptRevenue('apt-2').toLocaleString()} ج.م</div>
                <div>عمولات: {isLoading ? '...' : aptCommission('apt-2').toLocaleString()} ج.م</div>
                <div>مصروفات: {isLoading ? '...' : apt2Expenses.toLocaleString()} ج.م</div>
              </div>
            </div>

            {/* شقة (3) */}
            <div className={`p-6 rounded-2xl border text-center ${apt3Net >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest mb-3">صافي ربح شقة 3 (عباس الرئيسي)</p>
              <div className={`text-3xl font-black ${apt3Net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {isLoading ? '...' : apt3Net.toLocaleString()}
                <small className="text-sm font-bold text-[#7A7061] ml-1">ج.م</small>
              </div>
              <div className="mt-3 text-[9px] text-[#7A7061] font-bold space-y-0.5">
                <div>إيراد: {isLoading ? '...' : aptRevenue('apt-3').toLocaleString()} ج.م</div>
                <div>عمولات: {isLoading ? '...' : aptCommission('apt-3').toLocaleString()} ج.م</div>
                <div>مصروفات: {isLoading ? '...' : apt3Expenses.toLocaleString()} ج.م</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
      {/* ════════════════ التقرير المالي الشامل ════════════════ */}
      {!isMohsen && <div className="border-t border-[#EAE4D9] pt-10">
        <FinancialSummaryTab
          bookings={bookings}
          units={units}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          setSelectedMonth={setSelectedMonth}
          setSelectedYear={setSelectedYear}
        />
      </div>}

    </div>
  );
}
