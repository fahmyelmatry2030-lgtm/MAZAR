"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  getDbStaff, saveDbStaff, deleteDbStaff, 
  getDbSalaries, saveDbSalary, deleteDbSalary, 
  getDbVacations, saveDbVacation, deleteDbVacation 
} from '@/lib/actions/db';
import { 
  User, Phone, FileText, Calendar, Plus, Trash2, Edit, 
  CreditCard, ShieldCheck, FileSpreadsheet, X, DollarSign, Wallet, 
  Palmtree, Clock, CheckCircle2, AlertCircle, Filter, ArrowRight,
  TrendingDown, TrendingUp, Check, RefreshCw
} from 'lucide-react';

const MONTH_NAMES = [
  'يناير (1)', 'فبراير (2)', 'مارس (3)', 'أبريل (4)', 
  'مايو (5)', 'يونيو (6)', 'يوليو (7)', 'أغسطس (8)', 
  'سبتمبر (9)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'كاش 💵' },
  { id: 'instapay', label: 'إنستا باي ⚡' },
  { id: 'vodafone_cash', label: 'فودافون كاش 📱' },
  { id: 'visa', label: 'فيزا 💳' }
];

export default function StaffManagement() {
  const [staff, setStaff] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected Employee & Filter Month/Year
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Staff Form State (for Add or Edit)
  const [staffForm, setStaffForm] = useState<any>({
    id: '',
    name: '',
    position: '',
    base_salary: '',
    housing_allowance: '',
    transport_allowance: '',
    other_allowances: '',
    national_id: '',
    phone: '',
    hiring_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Quick Monthly Advance/Payout Form State
  const [paymentForm, setPaymentForm] = useState({
    staff_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'cash',
    notes: 'دفعة من الراتب'
  });

  // Quick Monthly Vacation Form State
  const [vacationForm, setVacationForm] = useState({
    staff_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    type: 'سنوية',
    amount: '', // "بكام" - خصم أو تكلفة الإجازة
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [s, sal, v] = await Promise.all([
        getDbStaff(),
        getDbSalaries(),
        getDbVacations()
      ]);
      const staffList = Array.isArray(s) ? s : [];
      setStaff(staffList);
      setSalaries(Array.isArray(sal) ? sal : []);
      setVacations(Array.isArray(v) ? v : []);

      // If no staff selected or current selected doesn't exist, select the first staff
      setSelectedStaffId(prev => {
        if (prev && staffList.some(item => item.id === prev)) return prev;
        return staffList[0]?.id || '';
      });
    } catch (error) {
      console.error('Failed to load HR staff data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync staffForm whenever selectedStaffId changes
  useEffect(() => {
    if (!selectedStaffId) {
      setStaffForm({
        id: '',
        name: '',
        position: '',
        base_salary: '',
        housing_allowance: '',
        transport_allowance: '',
        other_allowances: '',
        national_id: '',
        phone: '',
        hiring_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      return;
    }
    const current = staff.find(s => s.id === selectedStaffId);
    if (current) {
      setStaffForm({
        id: current.id,
        name: current.name || '',
        position: current.position || '',
        base_salary: current.base_salary || '',
        housing_allowance: current.housing_allowance || '',
        transport_allowance: current.transport_allowance || '',
        other_allowances: current.other_allowances || '',
        national_id: current.national_id || '',
        phone: current.phone || '',
        hiring_date: current.hiring_date || new Date().toISOString().split('T')[0],
        notes: current.notes || ''
      });
    }
  }, [selectedStaffId, staff]);

  // Sync default staff_id in quick forms
  useEffect(() => {
    if (selectedStaffId) {
      setPaymentForm(prev => ({ ...prev, staff_id: selectedStaffId }));
      setVacationForm(prev => ({ ...prev, staff_id: selectedStaffId }));
    }
  }, [selectedStaffId]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Currently selected staff object
  const currentStaff = useMemo(() => {
    return staff.find(s => s.id === selectedStaffId) || null;
  }, [staff, selectedStaffId]);

  // Calculated package for active staff
  const staffPackage = useMemo(() => {
    const base = Number(staffForm.base_salary) || 0;
    const housing = Number(staffForm.housing_allowance) || 0;
    const transport = Number(staffForm.transport_allowance) || 0;
    const other = Number(staffForm.other_allowances) || 0;
    return {
      base,
      housing,
      transport,
      other,
      total: base + housing + transport + other
    };
  }, [staffForm]);

  // Save / Update Staff Member
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name?.trim()) {
      showNotification('error', 'يرجى كتابة اسم الموظف بالكامل');
      return;
    }
    
    setIsSaving(true);
    try {
      const staffId = staffForm.id || `staff-${Date.now()}`;
      const data = {
        id: staffId,
        name: staffForm.name.trim(),
        position: staffForm.position || '',
        base_salary: Number(staffForm.base_salary) || 0,
        housing_allowance: Number(staffForm.housing_allowance) || 0,
        transport_allowance: Number(staffForm.transport_allowance) || 0,
        other_allowances: Number(staffForm.other_allowances) || 0,
        national_id: staffForm.national_id || '',
        phone: staffForm.phone || '',
        hiring_date: staffForm.hiring_date || new Date().toISOString().split('T')[0],
        notes: staffForm.notes || '',
      };
      await saveDbStaff(data);
      showNotification('success', staffForm.id ? 'تم تحديث بيانات الموظف والبدلات بنجاح ✅' : 'تم إضافة الموظف الجديد بنجاح ✅');
      await loadData();
      setSelectedStaffId(staffId);
    } catch (err: any) {
      showNotification('error', 'حدث خطأ أثناء حفظ بيانات الموظف: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async () => {
    if (!selectedStaffId) return;
    if (!confirm(`هل أنت متأكد من حذف الموظف "${currentStaff?.name}" وجميع بياناته؟`)) return;

    try {
      setIsSaving(true);
      await deleteDbStaff(selectedStaffId);
      showNotification('success', 'تم حذف الموظف بنجاح');
      setSelectedStaffId('');
      await loadData();
    } catch (err: any) {
      showNotification('error', 'تعذر حذف الموظف: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Monthly Filtered Salaries / Advances for Selected Staff
  const monthlyStaffSalaries = useMemo(() => {
    return salaries.filter(sal => {
      if (selectedStaffId && sal.staff_id !== selectedStaffId) return false;
      
      // Filter by Month and Year
      if (sal.payment_date) {
        const d = new Date(sal.payment_date);
        if (!isNaN(d.getTime())) {
          return (d.getMonth() + 1) === selectedMonth && d.getFullYear() === selectedYear;
        }
      }
      if (sal.month && sal.year) {
        return Number(sal.month) === selectedMonth && Number(sal.year) === selectedYear;
      }
      return false;
    });
  }, [salaries, selectedStaffId, selectedMonth, selectedYear]);

  // Total Paid to Employee This Month (خصم فوري من الخزنة الصغيرة)
  const totalPaidThisMonth = useMemo(() => {
    return monthlyStaffSalaries.reduce((sum, s) => sum + (Number(s.net_salary || s.amount) || 0), 0);
  }, [monthlyStaffSalaries]);

  // Monthly Filtered Vacations for Selected Staff
  const monthlyStaffVacations = useMemo(() => {
    return vacations.filter(vac => {
      if (selectedStaffId && vac.staff_id !== selectedStaffId) return false;
      if (!vac.start_date) return false;

      const start = new Date(vac.start_date);
      const end = vac.end_date ? new Date(vac.end_date) : start;
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
      const monthEnd = new Date(selectedYear, selectedMonth, 0);

      return start <= monthEnd && end >= monthStart;
    });
  }, [vacations, selectedStaffId, selectedMonth, selectedYear]);

  // Total Vacation Deductions "بكام" for This Month
  const totalVacationCostThisMonth = useMemo(() => {
    return monthlyStaffVacations.reduce((sum, v) => sum + (Number(v.amount) || 0), 0);
  }, [monthlyStaffVacations]);

  // Remaining Balance for this Employee this Month
  const remainingMonthlyBalance = useMemo(() => {
    return staffPackage.total - totalPaidThisMonth - totalVacationCostThisMonth;
  }, [staffPackage.total, totalPaidThisMonth, totalVacationCostThisMonth]);

  // Save Quick Advance/Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetStaffId = paymentForm.staff_id || selectedStaffId;
    if (!targetStaffId) {
      showNotification('error', 'يرجى تسجيل وحفظ الموظف أولاً من النموذج أعلاه');
      return;
    }
    const amountNum = Number(paymentForm.amount);
    if (!amountNum || amountNum <= 0) {
      showNotification('error', 'يرجى كتابة مبلغ صحيح أكبر من 0 (إن شاء الله حتى لو جنيه)');
      return;
    }

    try {
      setIsSaving(true);
      const paymentDate = paymentForm.date || new Date().toISOString().split('T')[0];
      const pDateObj = new Date(paymentDate);
      const m = !isNaN(pDateObj.getTime()) ? (pDateObj.getMonth() + 1) : selectedMonth;
      const y = !isNaN(pDateObj.getTime()) ? pDateObj.getFullYear() : selectedYear;

      const salData = {
        id: `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        staff_id: targetStaffId,
        month: m,
        year: y,
        amount: amountNum,
        net_salary: amountNum,
        payment_date: paymentDate,
        payment_method: paymentForm.method,
        payment_status: 'paid',
        notes: paymentForm.notes?.trim() || 'دفعة راتب'
      };

      await saveDbSalary(salData);
      showNotification('success', `تم تسجيل صرف ${amountNum.toLocaleString()} ج.م وخُصمت فوراً من الخزنة الصغيرة ✅`);
      setPaymentForm({
        staff_id: targetStaffId,
        amount: '',
        date: new Date().toISOString().split('T')[0],
        method: 'cash',
        notes: 'دفعة من الراتب'
      });
      await loadData();
    } catch (err: any) {
      showNotification('error', 'حدث خطأ أثناء تسجيل الدفعة: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Payment (restores money to Small Treasury)
  const handleDeletePayment = async (id: string, amount: number) => {
    if (!confirm(`هل أنت متأكد من حذف هذه الدفعة (${amount.toLocaleString()} ج.م)؟ سيتم إلغاؤها وإرجاع المبلغ للخزنة الصغيرة.`)) return;
    try {
      setIsSaving(true);
      await deleteDbSalary(id);
      showNotification('success', 'تم حذف الدفعة وإرجاع المبلغ للخزنة الصغيرة بنجاح ✅');
      await loadData();
    } catch (err: any) {
      showNotification('error', 'تعذر حذف الدفعة: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Save Quick Vacation
  const handleSaveVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetStaffId = vacationForm.staff_id || selectedStaffId;
    if (!targetStaffId) {
      showNotification('error', 'يرجى تسجيل وحفظ الموظف أولاً من النموذج أعلاه');
      return;
    }
    if (!vacationForm.start_date || !vacationForm.end_date) {
      showNotification('error', 'يرجى تحديد تاريخ البداية وتاريخ النهاية');
      return;
    }

    try {
      setIsSaving(true);
      const vacData = {
        id: `vac-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        staff_id: targetStaffId,
        start_date: vacationForm.start_date,
        end_date: vacationForm.end_date,
        type: vacationForm.type,
        amount: Number(vacationForm.amount) || 0,
        notes: vacationForm.notes?.trim() || ''
      };

      await saveDbVacation(vacData);
      showNotification('success', 'تم تسجيل الإجازة بنجاح 🌴');
      setVacationForm({
        staff_id: targetStaffId,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        type: 'سنوية',
        amount: '',
        notes: ''
      });
      await loadData();
    } catch (err: any) {
      showNotification('error', 'حدث خطأ أثناء حفظ الإجازة: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Vacation
  const handleDeleteVacation = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف قيد هذه الإجازة؟')) return;
    try {
      setIsSaving(true);
      await deleteDbVacation(id);
      showNotification('success', 'تم حذف الإجازة بنجاح');
      await loadData();
    } catch (err: any) {
      showNotification('error', 'تعذر حذف الإجازة: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'instapay':
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg text-[10px] font-black border border-purple-200">إنستا باي ⚡</span>;
      case 'vodafone_cash':
        return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-lg text-[10px] font-black border border-red-200">فودافون كاش 📱</span>;
      case 'visa':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-[10px] font-black border border-blue-200">فيزا 💳</span>;
      case 'cash':
      default:
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black border border-emerald-200">كاش 💵</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16" dir="rtl">
      
      {/* Toast Notification */}
      {statusMessage && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-6 py-3.5 rounded-2xl shadow-2xl font-black text-xs md:text-sm flex items-center gap-2 animate-bounce transition-all ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-800 text-white border border-emerald-600' 
            : 'bg-rose-800 text-white border border-rose-600'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Page Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5 border-b border-[#EAE4D9] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2A2723] text-[#C1A68D] flex items-center justify-center font-black text-xl shadow-lg">
              👤
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[#2A2723]">الملف الوظيفي والمالي الموحد للموظف</h1>
              <p className="text-xs md:text-sm font-bold text-[#7A7061] mt-1">
                بيانات الموظف، بدلاته، وسجل السلف والدفعات (تُخصم من الخزنة الصغيرة)، وسجل الإجازات في صفحة واحدة.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedStaffId('');
              setStaffForm({
                id: '',
                name: '',
                position: '',
                base_salary: '',
                housing_allowance: '',
                transport_allowance: '',
                other_allowances: '',
                national_id: '',
                phone: '',
                hiring_date: new Date().toISOString().split('T')[0],
                notes: ''
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="bg-[#2A2723] text-white hover:bg-black font-black px-5 py-3 rounded-2xl text-xs md:text-sm shadow-xl flex items-center gap-2 transition-all"
          >
            <Plus size={16} />
            <span>إضافة موظف جديد +</span>
          </button>
        </div>
      </header>

      {/* ── EMPLOYEES QUICK SELECTOR BAR ── */}
      <div className="bg-white p-4 rounded-3xl border border-[#EAE4D9] shadow-sm space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-black text-[#2A2723] flex items-center gap-2">
            <span>👥</span> الموظفون المسجلون (اضغط على أي موظف لفتح حسابه):
          </span>
          <span className="text-[11px] font-bold text-[#7A7061]">
            إجمالي الموظفين المسجلين: {staff.length}
          </span>
        </div>

        {staff.length === 0 && !isLoading ? (
          <div className="p-4 text-center text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center gap-2">
            <span>ℹ️</span>
            <span>لا يوجد موظفين مسجلين حالياً. اكتب بيانات أول موظف في النموذج أدناه واضغط "حفظ" لتسجيله وتفعيل حساباته فوراً.</span>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            {staff.map((s) => {
              const isSelected = s.id === selectedStaffId;
              const totalPkg = (Number(s.base_salary) || 0) + 
                               (Number(s.housing_allowance) || 0) + 
                               (Number(s.transport_allowance) || 0) + 
                               (Number(s.other_allowances) || 0);

              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStaffId(s.id)}
                  className={`px-4 py-3 rounded-2xl border text-right shrink-0 transition-all flex items-center gap-3 ${
                    isSelected 
                      ? 'bg-[#2A2723] text-white border-[#2A2723] shadow-lg scale-[1.02]' 
                      : 'bg-[#FDFBF7] text-[#2A2723] border-[#EAE4D9] hover:bg-gray-100 hover:border-[#C1A68D]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                    isSelected ? 'bg-[#C1A68D] text-[#2A2723]' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {s.name ? s.name.charAt(0) : '؟'}
                  </div>
                  <div>
                    <div className="text-xs font-black leading-tight">{s.name}</div>
                    <div className={`text-[10px] font-bold mt-0.5 ${isSelected ? 'text-[#C1A68D]' : 'text-gray-400'}`}>
                      {s.position || 'موظف'} • {totalPkg.toLocaleString()} ج.م
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 1: بيانات الموظف (إضافة / تعديل الملف) ── */}
      <section className="bg-white rounded-[2.5rem] border border-[#EAE4D9] p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#EAE4D9]/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center text-lg font-black">
              📋
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-[#2A2723]">
                {staffForm.id ? `بيانات وملف الموظف: ${staffForm.name}` : 'إضافة موظف جديد بالبدلات'}
              </h2>
              <p className="text-[11px] font-bold text-gray-400">
                {staffForm.id ? 'يمكنك تعديل أي بيانات والضغط على حفظ التعديلات.' : 'املأ بيانات الموظف والراتب والبدلات لحفظه بالنظام.'}
              </p>
            </div>
          </div>

          {staffForm.id && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={isSaving}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={14} />
                <span>حذف الموظف</span>
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveStaff} className="space-y-6">
          {/* Row 1: Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#C1A68D] uppercase">اسم الموظف بالكامل *</label>
              <input 
                type="text" required
                placeholder="اسم الموظف..."
                value={staffForm.name || ''}
                onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#C1A68D] uppercase">الوظيفة / القسم *</label>
              <input 
                type="text" required
                placeholder="مثال: موظف استقبال، هاوس كيبنج..."
                value={staffForm.position || ''}
                onChange={e => setStaffForm({ ...staffForm, position: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#C1A68D] uppercase">تاريخ التعيين</label>
              <input 
                type="date"
                value={staffForm.hiring_date || ''}
                onChange={e => setStaffForm({ ...staffForm, hiring_date: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
              />
            </div>
          </div>

          {/* Row 2: Financial Package */}
          <div className="bg-[#FDFBF7] p-5 rounded-2xl border border-[#EAE4D9] space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
              <h3 className="font-black text-xs text-[#2A2723] uppercase flex items-center gap-1.5">
                <span>💰</span> تفاصيل الراتب والبدلات الشاملة للموظف
              </h3>
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-1.5 rounded-xl font-black text-xs shadow-sm">
                إجمالي الباكج الشهري المستحق: <span className="text-sm font-black">{staffPackage.total.toLocaleString()}</span> ج.م
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-600">الراتب الأساسي (ج.م)</label>
                <input 
                  type="number" min="0" step="any"
                  placeholder="0.00"
                  value={staffForm.base_salary ?? ''}
                  onChange={e => setStaffForm({ ...staffForm, base_salary: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-blue-700">بدل السكن (ج.م)</label>
                <input 
                  type="number" min="0" step="any"
                  placeholder="0.00"
                  value={staffForm.housing_allowance ?? ''}
                  onChange={e => setStaffForm({ ...staffForm, housing_allowance: e.target.value })}
                  className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-xs font-bold text-blue-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-amber-700">بدل الانتقالات (ج.م)</label>
                <input 
                  type="number" min="0" step="any"
                  placeholder="0.00"
                  value={staffForm.transport_allowance ?? ''}
                  onChange={e => setStaffForm({ ...staffForm, transport_allowance: e.target.value })}
                  className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-xs font-bold text-amber-900 outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-emerald-700">بدلات وحوافز أخرى (ج.م)</label>
                <input 
                  type="number" min="0" step="any"
                  placeholder="0.00"
                  value={staffForm.other_allowances ?? ''}
                  onChange={e => setStaffForm({ ...staffForm, other_allowances: e.target.value })}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-xs font-bold text-emerald-900 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Personal & Contact */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#C1A68D] uppercase">رقم الهاتف</label>
              <input 
                type="text"
                placeholder="010xxxxxxxx"
                value={staffForm.phone || ''}
                onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#C1A68D] uppercase">الرقم القومي (14 رقم)</label>
              <input 
                type="text"
                placeholder="الرقم القومي / الهوية..."
                value={staffForm.national_id || ''}
                onChange={e => setStaffForm({ ...staffForm, national_id: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#C1A68D] uppercase">ملاحظات العقد والضمانات</label>
              <input 
                type="text"
                placeholder="أي ملاحظات أو ضمانات..."
                value={staffForm.notes || ''}
                onChange={e => setStaffForm({ ...staffForm, notes: e.target.value })}
                className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="submit"
              disabled={isSaving}
              className="bg-[#2A2723] hover:bg-black text-white font-black px-8 py-3.5 rounded-2xl text-xs md:text-sm shadow-xl flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Check size={16} />
              <span>{staffForm.id ? 'حفظ تعديلات بيانات الموظف والبدلات' : 'تسجيل وحفظ الموظف الجديد ✅'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* ── SECTION 2: فلتر الشهر والسنة + لوحة الحساب الشهري ── */}
      <section className="space-y-6">
        {/* Month / Year Selector Bar */}
        <div className="bg-[#2A2723] text-white p-6 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#C1A68D] text-[#2A2723] flex items-center justify-center font-black text-xl">
              📅
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black">
                كشف حساب الشهر للموظف: {currentStaff?.name || '(حدد موظفاً من الأعلى)'}
              </h3>
              <p className="text-xs text-gray-300 font-bold mt-0.5">
                اختر الشهر والسنة لتصفية الدفعات المسحوبة والإجازات خلال هذا الشهر:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl border border-white/20">
              <span className="text-xs font-black text-[#C1A68D]">الشهر:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-white font-black text-xs outline-none cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1} className="text-[#2A2723] bg-white">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl border border-white/20">
              <span className="text-xs font-black text-[#C1A68D]">السنة:</span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-white font-black text-xs outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map(yr => (
                  <option key={yr} value={yr} className="text-[#2A2723] bg-white">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedMonth(new Date().getMonth() + 1);
                setSelectedYear(new Date().getFullYear());
              }}
              className="bg-white/10 hover:bg-white/20 text-white text-xs font-black px-3.5 py-2 rounded-2xl border border-white/20 transition-all flex items-center gap-1.5"
              title="الشهر الحالي"
            >
              <RefreshCw size={13} />
              <span>الشهر الحالي</span>
            </button>
          </div>
        </div>

        {/* 4 Monthly KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Monthly Package */}
          <div className="bg-white p-5 rounded-[2rem] border border-[#EAE4D9] shadow-sm">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">الباكج المستحق بالشهر</div>
            <div className="text-2xl font-black text-[#2A2723] mt-2">
              {staffPackage.total.toLocaleString()} <span className="text-xs font-bold text-gray-400">ج.م</span>
            </div>
            <div className="text-[10px] text-gray-500 font-bold mt-1">الراتب والبدلات المعتمدة</div>
          </div>

          {/* Card 2: Total Paid This Month */}
          <div className="bg-white p-5 rounded-[2rem] border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/40">
            <div className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center justify-between">
              <span>المدفوع / السلفيات</span>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black">الخزنة الصغيرة ✅</span>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">
              {totalPaidThisMonth.toLocaleString()} <span className="text-xs font-bold text-emerald-600">ج.م</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-1">
              {monthlyStaffSalaries.length} دفعة مخصومة من الخزنة
            </div>
          </div>

          {/* Card 3: Vacation Deductions */}
          <div className="bg-white p-5 rounded-[2rem] border border-amber-200 shadow-sm bg-gradient-to-br from-white to-amber-50/40">
            <div className="text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center justify-between">
              <span>خصومات الإجازات</span>
              <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-black">بكام</span>
            </div>
            <div className="text-2xl font-black text-amber-800 mt-2">
              {totalVacationCostThisMonth.toLocaleString()} <span className="text-xs font-bold text-amber-600">ج.م</span>
            </div>
            <div className="text-[10px] text-amber-700 font-bold mt-1">
              {monthlyStaffVacations.length} إجازة مسجلة
            </div>
          </div>

          {/* Card 4: Net Remaining Balance */}
          <div className={`p-5 rounded-[2rem] border shadow-sm ${
            remainingMonthlyBalance <= 0 && staffPackage.total > 0
              ? 'bg-emerald-700 text-white border-emerald-600' 
              : 'bg-white text-[#2A2723] border-[#EAE4D9]'
          }`}>
            <div className={`text-[10px] font-black uppercase tracking-wider ${
              remainingMonthlyBalance <= 0 && staffPackage.total > 0 ? 'text-emerald-100' : 'text-gray-400'
            }`}>
              صافي المتبقي للموظف
            </div>
            <div className="text-2xl font-black mt-2">
              {remainingMonthlyBalance.toLocaleString()} <span className={`text-xs font-bold ${
                remainingMonthlyBalance <= 0 && staffPackage.total > 0 ? 'text-emerald-100' : 'text-gray-400'
              }`}>ج.م</span>
            </div>
            <div className={`text-[10px] font-bold mt-1 ${
              remainingMonthlyBalance <= 0 && staffPackage.total > 0 ? 'text-emerald-200' : 'text-emerald-700'
            }`}>
              {remainingMonthlyBalance <= 0 && staffPackage.total > 0 ? 'تم تقفيل مستحقات الشهر بالكامل 🎉' : 'متبقي مستحق للصرف'}
            </div>
          </div>
        </div>

        {/* ── SECTION 3: الفلوس اللي خدها خلال الشهر (سجل الصرف والسلفيات) ── */}
        <section className="bg-white rounded-[2.5rem] border border-[#EAE4D9] p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#EAE4D9]/60 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center text-lg font-black">
                💸
              </div>
              <div>
                <h3 className="text-lg font-black text-[#2A2723]">
                  الفلوس اللي خدها الموظف خلال شهر ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
                </h3>
                <p className="text-[11px] font-bold text-gray-500">
                  سجل أي دفعة أو سلفة أخذها (النهاردة 1000، بكرة 1000) — <strong className="text-emerald-700">تُخصم فوراً من الخزنة الصغيرة حتى لو جنيه واحد</strong>.
                </p>
              </div>
            </div>

            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-2xl text-xs font-black">
              إجمالي ما تم صرفه: {totalPaidThisMonth.toLocaleString()} ج.م
            </div>
          </div>

          {/* Quick Add Payment Form */}
          <form onSubmit={handleSavePayment} className="bg-[#FDFBF7] p-5 rounded-2xl border border-[#EAE4D9] space-y-4">
            <span className="text-xs font-black text-[#2A2723] block">
              ➕ تسجيل دفعة جديدة للموظف (تُخصم فوراً من الخزنة الصغيرة):
            </span>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* Staff Selector inside Form if multiple or none */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">الموظف *</label>
                <select
                  value={paymentForm.staff_id || selectedStaffId}
                  onChange={e => {
                    const sid = e.target.value;
                    setPaymentForm({ ...paymentForm, staff_id: sid });
                    if (sid) setSelectedStaffId(sid);
                  }}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-black text-[#2A2723] outline-none focus:border-[#C1A68D]"
                >
                  <option value="">-- اختر موظفاً --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.position || '—'})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">المبلغ المنصرف (ج.م) *</label>
                <input 
                  type="number" required min="1" step="any"
                  placeholder="مثال: 1000"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-2.5 text-xs font-black text-emerald-700 outline-none focus:border-[#C1A68D]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">تاريخ الصرف</label>
                <input 
                  type="date" required
                  value={paymentForm.date}
                  onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">طريقة الدفع</label>
                <select
                  value={paymentForm.method}
                  onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">البيان / ملاحظة</label>
                <input 
                  type="text"
                  placeholder="سلفة، دفعة تحت الحساب..."
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-6 py-3 rounded-xl text-xs shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <DollarSign size={15} />
                <span>تسجيل وصرف المبلغ (خصم فوري من الخزنة الصغيرة) 💸</span>
              </button>
            </div>
          </form>

          {/* Payments Table */}
          <div className="border border-[#EAE4D9] rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-[#2A2723] text-white font-black">
                <tr>
                  <th className="px-5 py-3.5">تاريخ الصرف</th>
                  <th className="px-5 py-3.5 text-center">المبلغ المستلم</th>
                  <th className="px-5 py-3.5 text-center">طريقة الدفع</th>
                  <th className="px-5 py-3.5">البيان والملاحظات</th>
                  <th className="px-5 py-3.5 text-center">جهة الخصم</th>
                  <th className="px-5 py-3.5 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4D9]/40 bg-white font-bold">
                {monthlyStaffSalaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 font-bold">
                      لم يتم تسجيل أي دفعات أو سلفيات لهذا الموظف في شهر ({MONTH_NAMES[selectedMonth - 1]} {selectedYear}).
                    </td>
                  </tr>
                ) : (
                  monthlyStaffSalaries.map((sal) => {
                    const amountVal = Number(sal.net_salary || sal.amount || 0);
                    return (
                      <tr key={sal.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4 text-[#2A2723]">
                          {sal.payment_date ? sal.payment_date.split('T')[0] : (sal.date || '—')}
                        </td>
                        <td className="px-5 py-4 text-center font-black text-emerald-700 text-sm">
                          {amountVal.toLocaleString()} ج.م
                        </td>
                        <td className="px-5 py-4 text-center">
                          {getMethodBadge(sal.payment_method)}
                        </td>
                        <td className="px-5 py-4 text-gray-700">
                          {sal.notes || 'دفعة راتب'}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-[10px] font-black">
                            الخزنة الصغيرة ✅
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => handleDeletePayment(sal.id, amountVal)}
                            disabled={isSaving}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="حذف القيد ورد المبلغ للخزنة"
                          >
                            <Trash2 size={16} />
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

        {/* ── SECTION 4: إجازات الموظف خلال الشهر (سجل الإجازات بإمتى وبكام) ── */}
        <section className="bg-white rounded-[2.5rem] border border-[#EAE4D9] p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-[#EAE4D9]/60 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center text-lg font-black">
                🌴
              </div>
              <div>
                <h3 className="text-lg font-black text-[#2A2723]">
                  إجازات الموظف خلال شهر ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
                </h3>
                <p className="text-[11px] font-bold text-gray-500">
                  سجل إجازات الموظف مع تسجيل التكلفة أو الخصم (الإجازة بإمتى وبكام).
                </p>
              </div>
            </div>

            <div className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-2xl text-xs font-black">
              إجمالي خصومات الإجازات: {totalVacationCostThisMonth.toLocaleString()} ج.م
            </div>
          </div>

          {/* Quick Add Vacation Form */}
          <form onSubmit={handleSaveVacation} className="bg-[#FDFBF7] p-5 rounded-2xl border border-[#EAE4D9] space-y-4">
            <span className="text-xs font-black text-[#2A2723] block">
              ➕ تسجيل إجازة جديدة للموظف (بإمتى وبكام):
            </span>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              {/* Staff Selector */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">الموظف *</label>
                <select
                  value={vacationForm.staff_id || selectedStaffId}
                  onChange={e => {
                    const sid = e.target.value;
                    setVacationForm({ ...vacationForm, staff_id: sid });
                    if (sid) setSelectedStaffId(sid);
                  }}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-black text-[#2A2723] outline-none focus:border-[#C1A68D]"
                >
                  <option value="">-- اختر موظفاً --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">من تاريخ *</label>
                <input 
                  type="date" required
                  value={vacationForm.start_date}
                  onChange={e => setVacationForm({ ...vacationForm, start_date: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">إلى تاريخ *</label>
                <input 
                  type="date" required
                  value={vacationForm.end_date}
                  onChange={e => setVacationForm({ ...vacationForm, end_date: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">نوع الإجازة</label>
                <select
                  value={vacationForm.type}
                  onChange={e => setVacationForm({ ...vacationForm, type: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
                >
                  <option value="سنوية">سنوية</option>
                  <option value="عارضة">عارضة</option>
                  <option value="مرضية">مرضية</option>
                  <option value="بدون مرتب">بدون مرتب</option>
                  <option value="إذن خاص">إذن خاص</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">الخصم (بكام) ج.م</label>
                <input 
                  type="number" min="0" step="any"
                  placeholder="0.00 إذا مدفوعة"
                  value={vacationForm.amount}
                  onChange={e => setVacationForm({ ...vacationForm, amount: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-black text-amber-800 outline-none focus:border-[#C1A68D]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#C1A68D] uppercase">السبب وملاحظات</label>
                <input 
                  type="text"
                  placeholder="ظروف عائلية، مرض..."
                  value={vacationForm.notes}
                  onChange={e => setVacationForm({ ...vacationForm, notes: e.target.value })}
                  className="w-full bg-white border border-[#EAE4D9] rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-[#C1A68D]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#C1A68D] hover:opacity-90 text-white font-black px-6 py-3 rounded-xl text-xs shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Palmtree size={15} />
                <span>تسجيل الإجازة والخصم 🌴</span>
              </button>
            </div>
          </form>

          {/* Vacations Table */}
          <div className="border border-[#EAE4D9] rounded-2xl overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-[#2A2723] text-white font-black">
                <tr>
                  <th className="px-5 py-3.5">من تاريخ</th>
                  <th className="px-5 py-3.5">إلى تاريخ</th>
                  <th className="px-5 py-3.5 text-center">نوع الإجازة</th>
                  <th className="px-5 py-3.5 text-center">الخصم / التكلفة (بكام)</th>
                  <th className="px-5 py-3.5">السبب / ملاحظات</th>
                  <th className="px-5 py-3.5 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4D9]/40 bg-white font-bold">
                {monthlyStaffVacations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 font-bold">
                      لا توجد إجازات مسجلة لهذا الموظف في شهر ({MONTH_NAMES[selectedMonth - 1]} {selectedYear}).
                    </td>
                  </tr>
                ) : (
                  monthlyStaffVacations.map((vac) => {
                    const costVal = Number(vac.amount) || 0;
                    return (
                      <tr key={vac.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-4 text-[#2A2723]">{vac.start_date}</td>
                        <td className="px-5 py-4 text-[#2A2723]">{vac.end_date}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-[10px] font-black border border-gray-200">
                            {vac.type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {costVal > 0 ? (
                            <span className="text-rose-600 font-black">
                              -{costVal.toLocaleString()} ج.م
                            </span>
                          ) : (
                            <span className="text-gray-400 font-bold">
                              مدفوعة (0 ج.م)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-600">{vac.notes || '—'}</td>
                        <td className="px-5 py-4 text-center">
                          <button
                            onClick={() => handleDeleteVacation(vac.id)}
                            disabled={isSaving}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="حذف الإجازة"
                          >
                            <Trash2 size={16} />
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
      </section>

      {/* ── SECTION 5: جدول استعراض كافة موظفي المؤسسة ── */}
      <section className="bg-white rounded-[2.5rem] border border-[#EAE4D9] p-6 md:p-8 shadow-sm space-y-5">
        <div className="flex justify-between items-center border-b border-[#EAE4D9]/60 pb-4">
          <h3 className="text-lg font-black text-[#2A2723] flex items-center gap-2">
            <span>👥</span> دليل كافة الموظفين والبدلات
          </h3>
          <span className="text-xs font-black text-[#7A7061]">
            إجمالي الموظفين: {staff.length}
          </span>
        </div>

        <div className="border border-[#EAE4D9] rounded-2xl overflow-hidden">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-[#2A2723] text-white font-black">
              <tr>
                <th className="px-5 py-3.5">الموظف</th>
                <th className="px-5 py-3.5">الوظيفة / القسم</th>
                <th className="px-5 py-3.5 text-center">الأساسي</th>
                <th className="px-5 py-3.5 text-center">سكن</th>
                <th className="px-5 py-3.5 text-center">انتقال</th>
                <th className="px-5 py-3.5 text-center">إجمالي الباكج</th>
                <th className="px-5 py-3.5">الهاتف</th>
                <th className="px-5 py-3.5 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE4D9]/40 bg-white font-bold">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    لا يوجد موظفين مسجلين.
                  </td>
                </tr>
              ) : (
                staff.map((s) => {
                  const base = Number(s.base_salary) || 0;
                  const housing = Number(s.housing_allowance) || 0;
                  const transport = Number(s.transport_allowance) || 0;
                  const other = Number(s.other_allowances) || 0;
                  const total = base + housing + transport + other;
                  const isCurrent = s.id === selectedStaffId;

                  return (
                    <tr 
                      key={s.id} 
                      className={`hover:bg-amber-50/30 transition-colors ${
                        isCurrent ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <td className="px-5 py-4 font-black text-[#2A2723]">{s.name}</td>
                      <td className="px-5 py-4 text-gray-600">{s.position || '—'}</td>
                      <td className="px-5 py-4 text-center">{base.toLocaleString()}</td>
                      <td className="px-5 py-4 text-center text-blue-700">{housing.toLocaleString()}</td>
                      <td className="px-5 py-4 text-center text-amber-700">{transport.toLocaleString()}</td>
                      <td className="px-5 py-4 text-center font-black text-emerald-700 text-sm">
                        {total.toLocaleString()} ج.م
                      </td>
                      <td className="px-5 py-4 text-gray-500">{s.phone || '—'}</td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedStaffId(s.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                            isCurrent
                              ? 'bg-[#2A2723] text-white shadow'
                              : 'bg-gray-100 text-gray-700 hover:bg-[#2A2723] hover:text-white'
                          }`}
                        >
                          {isCurrent ? 'محدد حالياً ✅' : 'فتح وتعديل 👆'}
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

    </div>
  );
}
