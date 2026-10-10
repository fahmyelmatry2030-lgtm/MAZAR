"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  getDbStaff, saveDbStaff, deleteDbStaff, 
  getDbSalaries, saveDbSalary, deleteDbSalary, 
  getDbVacations, saveDbVacation, deleteDbVacation 
} from '@/lib/actions/db';
import { 
  User, Phone, FileText, Calendar, Plus, Trash2, Edit, 
  CreditCard, ShieldCheck, X, DollarSign, Wallet, 
  Palmtree, Clock, CheckCircle2, AlertCircle, Filter, ArrowRight,
  TrendingDown, TrendingUp, Check, RefreshCw, AlertTriangle,
  UserPlus, Search, MapPin, Hash, ShieldAlert, Award
} from 'lucide-react';

const MONTH_NAMES = [
  'يناير (1)', 'فبراير (2)', 'مارس (3)', 'أبريل (4)', 
  'مايو (5)', 'يونيو (6)', 'يوليو (7)', 'أغسطس (8)', 
  'سبتمبر (9)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
];

const PAYMENT_METHODS = [
  { id: 'كاش', label: 'كاش 💵' },
  { id: 'فودافون كاش', label: 'فودافون كاش 📱' },
  { id: 'إنستا باي', label: 'إنستا باي ⚡' },
  { id: 'فيزا', label: 'فيزا 💳' }
];

const MANAGERS = ['مؤمن', 'مدحت', 'الإدارة', 'الخزنة الصغيرة', 'الخزنة الكبيرة'];

export default function StaffManagement() {
  const [staff, setStaff] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selected Employee & Search & Filter Month/Year
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Modal for Adding New Employee
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    age: '',
    national_id: '',
    address: '',
    phone: '',
    position: '',
    base_salary: '',
    hiring_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Selected Staff Profile Form State (Personal details edit)
  const [profileForm, setProfileForm] = useState({
    id: '',
    name: '',
    age: '',
    national_id: '',
    address: '',
    phone: '',
    position: '',
    base_salary: '',
    hiring_date: '',
    notes: ''
  });

  // Quick Payout/Advance Form State (استلام مرتب أو دفعة)
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'كاش',
    handed_by: 'مؤمن',
    notes: 'دفعة من المرتب'
  });

  // Quick Deduction/Penalty Form State (جزاء أو خصم)
  const [deductionForm, setDeductionForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reason: 'خصم فيزا',
    ordered_by: 'مؤمن',
    notes: ''
  });

  // Quick Vacation Form State (نازل إجازة ⬅️ راجع)
  const [vacationForm, setVacationForm] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    type: 'سنوية',
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

  // Sync profileForm whenever selectedStaffId changes
  useEffect(() => {
    if (!selectedStaffId) {
      setProfileForm({
        id: '',
        name: '',
        age: '',
        national_id: '',
        address: '',
        phone: '',
        position: '',
        base_salary: '',
        hiring_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      return;
    }
    const current = staff.find(s => s.id === selectedStaffId);
    if (current) {
      setProfileForm({
        id: current.id,
        name: current.name || '',
        age: current.age || '',
        national_id: current.national_id || '',
        address: current.address || '',
        phone: current.phone || '',
        position: current.position || '',
        base_salary: current.base_salary ? String(current.base_salary) : '',
        hiring_date: current.hiring_date || new Date().toISOString().split('T')[0],
        notes: current.notes || ''
      });
    }
  }, [selectedStaffId, staff]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Currently selected staff object
  const currentStaff = useMemo(() => {
    return staff.find(s => s.id === selectedStaffId) || null;
  }, [staff, selectedStaffId]);

  // Filtered staff list for search
  const filteredStaffList = useMemo(() => {
    if (!searchQuery.trim()) return staff;
    const q = searchQuery.toLowerCase().trim();
    return staff.filter(s => 
      s.name?.toLowerCase().includes(q) || 
      s.position?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.national_id?.includes(q)
    );
  }, [staff, searchQuery]);

  // Filtered Salaries (Payouts) for Selected Staff and Selected Month/Year
  const monthlyStaffPayouts = useMemo(() => {
    return salaries.filter(sal => {
      if (!selectedStaffId || sal.staff_id !== selectedStaffId) return false;
      if (sal.entry_type === 'deduction') return false; // Deductions handled separately
      
      const pDate = sal.payment_date || sal.date;
      if (pDate) {
        const d = new Date(pDate);
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

  // Filtered Deductions / Penalties for Selected Staff and Selected Month/Year
  const monthlyStaffDeductions = useMemo(() => {
    return salaries.filter(sal => {
      if (!selectedStaffId || sal.staff_id !== selectedStaffId) return false;
      if (sal.entry_type !== 'deduction') return false; // Only deductions
      
      const pDate = sal.payment_date || sal.date;
      if (pDate) {
        const d = new Date(pDate);
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

  // Filtered Vacations for Selected Staff and Selected Month/Year
  const monthlyStaffVacations = useMemo(() => {
    return vacations.filter(vac => {
      if (!selectedStaffId || vac.staff_id !== selectedStaffId) return false;
      if (!vac.start_date) return false;

      const start = new Date(vac.start_date);
      const end = vac.end_date ? new Date(vac.end_date) : start;
      const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
      const monthEnd = new Date(selectedYear, selectedMonth, 0);

      return start <= monthEnd && end >= monthStart;
    });
  }, [vacations, selectedStaffId, selectedMonth, selectedYear]);

  // Financial Calculations for the active employee this month
  const baseSalary = Number(profileForm.base_salary) || Number(currentStaff?.base_salary) || 0;
  
  const totalPayoutsThisMonth = useMemo(() => {
    return monthlyStaffPayouts.reduce((sum, s) => sum + (Number(s.amount || s.net_salary) || 0), 0);
  }, [monthlyStaffPayouts]);

  const totalDeductionsThisMonth = useMemo(() => {
    return monthlyStaffDeductions.reduce((sum, s) => sum + (Number(s.deductions || s.amount) || 0), 0);
  }, [monthlyStaffDeductions]);

  const netRemainingSalary = baseSalary - totalPayoutsThisMonth - totalDeductionsThisMonth;

  // 1. Add New Staff Member
  const handleAddNewStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.name.trim()) {
      showNotification('error', 'يرجى إدخال اسم الموظف بالكامل');
      return;
    }

    try {
      setIsSaving(true);
      const newId = `staff-${Date.now()}`;
      const payload = {
        id: newId,
        name: newStaffForm.name.trim(),
        age: newStaffForm.age.trim(),
        national_id: newStaffForm.national_id.trim(),
        address: newStaffForm.address.trim(),
        phone: newStaffForm.phone.trim(),
        position: newStaffForm.position.trim() || 'موظف',
        base_salary: Number(newStaffForm.base_salary) || 0,
        hiring_date: newStaffForm.hiring_date || new Date().toISOString().split('T')[0],
        notes: newStaffForm.notes.trim()
      };

      await saveDbStaff(payload);
      showNotification('success', `تمت إضافة الموظف "${payload.name}" بنجاح ✅`);
      setIsAddStaffModalOpen(false);
      setNewStaffForm({
        name: '',
        age: '',
        national_id: '',
        address: '',
        phone: '',
        position: '',
        base_salary: '',
        hiring_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      await loadData();
      setSelectedStaffId(newId);
    } catch (err: any) {
      showNotification('error', 'حدث خطأ أثناء إضافة الموظف: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Save Updated Profile Data
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    if (!profileForm.name.trim()) {
      showNotification('error', 'يرجى إدخال اسم الموظف');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        id: selectedStaffId,
        name: profileForm.name.trim(),
        age: profileForm.age.trim(),
        national_id: profileForm.national_id.trim(),
        address: profileForm.address.trim(),
        phone: profileForm.phone.trim(),
        position: profileForm.position.trim(),
        base_salary: Number(profileForm.base_salary) || 0,
        hiring_date: profileForm.hiring_date,
        notes: profileForm.notes.trim()
      };

      await saveDbStaff(payload);
      showNotification('success', `تم تحديث بروفايل الموظف "${payload.name}" بنجاح ✅`);
      await loadData();
    } catch (err: any) {
      showNotification('error', 'حدث خطأ أثناء حفظ التعديلات: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Delete Staff Member
  const handleDeleteStaff = async () => {
    if (!selectedStaffId || !currentStaff) return;
    if (!confirm(`هل أنت متأكد تماماً من حذف بروفايل الموظف "${currentStaff.name}"؟ سيتم حذف جميع بياناته.`)) return;

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

  // 4. Save Quick Salary Payout (استلام مرتب / دفعة)
  const handleAddPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      showNotification('error', 'يرجى اختيار الموظف أولاً');
      return;
    }
    const amountVal = Number(payoutForm.amount);
    if (!amountVal || amountVal <= 0) {
      showNotification('error', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    try {
      setIsSaving(true);
      const paymentDate = payoutForm.date || new Date().toISOString().split('T')[0];
      const pDateObj = new Date(paymentDate);
      const m = !isNaN(pDateObj.getTime()) ? (pDateObj.getMonth() + 1) : selectedMonth;
      const y = !isNaN(pDateObj.getTime()) ? pDateObj.getFullYear() : selectedYear;

      const salData = {
        id: `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        staff_id: selectedStaffId,
        month: m,
        year: y,
        amount: amountVal,
        net_salary: amountVal,
        payment_date: paymentDate,
        payment_method: payoutForm.method,
        handed_by: payoutForm.handed_by,
        entry_type: 'salary',
        payment_status: 'paid',
        notes: payoutForm.notes.trim() || 'استلام دفعة من الراتب'
      };

      await saveDbSalary(salData);
      showNotification('success', `تم تسجيل استلام ${amountVal.toLocaleString()} ج.م وخُصمت من الخزنة الصغيرة بنجاح ✅`);
      setPayoutForm({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        method: 'كاش',
        handed_by: 'مؤمن',
        notes: 'دفعة من المرتب'
      });
      await loadData();
    } catch (err: any) {
      showNotification('error', 'حدث خطأ أثناء تسجيل الدفعة: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Delete Salary Payout
  const handleDeletePayout = async (id: string, amount: number) => {
    if (!confirm(`هل أنت متأكد من حذف هذه الدفعة (${amount.toLocaleString()} ج.م)؟ سيتم إرجاع المبلغ للخزنة الصغيرة تلقائياً.`)) return;
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

  // 6. Save Deduction / Penalty (جزاء أو خصم)
  const handleAddDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      showNotification('error', 'يرجى اختيار الموظف أولاً');
      return;
    }
    const amountVal = Number(deductionForm.amount);
    if (!amountVal || amountVal <= 0) {
      showNotification('error', 'يرجى إدخال مبلغ الخصم');
      return;
    }

    try {
      setIsSaving(true);
      const pDate = deductionForm.date || new Date().toISOString().split('T')[0];
      const pDateObj = new Date(pDate);
      const m = !isNaN(pDateObj.getTime()) ? (pDateObj.getMonth() + 1) : selectedMonth;
      const y = !isNaN(pDateObj.getTime()) ? pDateObj.getFullYear() : selectedYear;

      const reasonNote = `[سبب: ${deductionForm.reason}] [بأمر: ${deductionForm.ordered_by}] ${deductionForm.notes.trim()}`.trim();

      const salData = {
        id: `ded-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        staff_id: selectedStaffId,
        month: m,
        year: y,
        amount: amountVal,
        deductions: amountVal,
        net_salary: 0,
        payment_date: pDate,
        entry_type: 'deduction',
        payment_status: 'deduction',
        notes: reasonNote
      };

      await saveDbSalary(salData);
      showNotification('success', `تم تسجيل الخصم بقيمة ${amountVal.toLocaleString()} ج.م بنجاح ⚠️`);
      setDeductionForm({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        reason: 'خصم فيزا',
        ordered_by: 'مؤمن',
        notes: ''
      });
      await loadData();
    } catch (err: any) {
      showNotification('error', 'حدث خطأ أثناء تسجيل الخصم: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // 7. Delete Deduction
  const handleDeleteDeduction = async (id: string) => {
    if (!confirm('هل تريد حذف هذا الخصم/الجزاء؟')) return;
    try {
      setIsSaving(true);
      await deleteDbSalary(id);
      showNotification('success', 'تم حذف الخصم بنجاح ✅');
      await loadData();
    } catch (err: any) {
      showNotification('error', 'تعذر حذف الخصم: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // 8. Save Vacation (نازل إجازة ⬅️ راجع)
  const handleAddVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      showNotification('error', 'يرجى اختيار الموظف أولاً');
      return;
    }
    if (!vacationForm.start_date || !vacationForm.end_date) {
      showNotification('error', 'يرجى إدخال تاريخ النزول وتاريخ الرجوع');
      return;
    }

    try {
      setIsSaving(true);
      const vacData = {
        id: `vac-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        staff_id: selectedStaffId,
        start_date: vacationForm.start_date,
        end_date: vacationForm.end_date,
        type: vacationForm.type,
        notes: vacationForm.notes.trim()
      };

      await saveDbVacation(vacData);
      showNotification('success', 'تم تسجيل بند الإجازة بنجاح 🌴');
      setVacationForm({
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        type: 'سنوية',
        notes: ''
      });
      await loadData();
    } catch (err: any) {
      showNotification('error', 'حدث خطأ أثناء تسجيل الإجازة: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // 9. Delete Vacation
  const handleDeleteVacation = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف بند الإجازة؟')) return;
    try {
      setIsSaving(true);
      await deleteDbVacation(id);
      showNotification('success', 'تم حذف بند الإجازة بنجاح');
      await loadData();
    } catch (err: any) {
      showNotification('error', 'تعذر حذف بند الإجازة: ' + (err.message || ''));
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate inclusive vacation days
  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
  };

  return (
    <div className="space-y-6 pb-24 text-right" dir="rtl">
      
      {/* Toast Notification */}
      {statusMessage && (
        <div className={`fixed bottom-6 left-6 z-50 px-6 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 text-white font-medium transition-all animate-bounce ${
          statusMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-indigo-900/50">
        <div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <User className="w-8 h-8 text-amber-400" />
            <span>بروفايل الموظفين وإدارة الفريق</span>
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            ملف كامل لكل موظف: البيانات الشخصية، بنود الإجازات، سجل استلام المرتبات، وسجل الجزاءات والخصومات
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsAddStaffModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-900/40 transition-all active:scale-95 cursor-pointer text-sm"
          >
            <UserPlus className="w-5 h-5" />
            <span>+ إضافة موظف جديد</span>
          </button>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: ALL STAFF CONTAINER (مربع واحد كبير يجمع جميع الموظفين) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-3 h-8 bg-indigo-600 rounded-full" />
            <div>
              <h2 className="text-lg font-black text-slate-800">فريق العمل والموظفين ({staff.length})</h2>
              <p className="text-xs text-slate-500">اختر موظفاً من الصندوق لعرض البروفايل الخاص به بالكامل والتحكم فيه</p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="بحث باسم الموظف أو الوظيفة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Staff Cards Grid */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            <span>جاري تحميل بيانات الموظفين...</span>
          </div>
        ) : filteredStaffList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="font-bold text-slate-600 mb-2">لا يوجد موظفين مسجلين حالياً</p>
            <button
              onClick={() => setIsAddStaffModalOpen(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة أول موظف</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredStaffList.map((emp) => {
              const isSelected = emp.id === selectedStaffId;
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedStaffId(emp.id)}
                  className={`text-right p-4 rounded-xl border transition-all text-sm relative group cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-600 shadow-md ring-2 ring-indigo-500/30'
                      : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70 hover:shadow-sm'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-2.5 left-2.5 w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
                  )}
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                      }`}>
                        {emp.name?.slice(0, 2) || 'مو'}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className={`font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                          {emp.name}
                        </h3>
                        <p className="text-xs text-slate-400 truncate">{emp.position || 'موظف'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100/80 mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-bold text-emerald-700">
                      {(Number(emp.base_salary) || 0).toLocaleString()} ج.م
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {emp.hiring_date ? new Date(emp.hiring_date).getFullYear() : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: DEDICATED PROFILE OF SELECTED EMPLOYEE (بروفايل الموظف المحدد) */}
      {/* ========================================================================= */}
      {currentStaff ? (
        <div className="space-y-6">
          
          {/* Main Profile Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md shadow-indigo-200">
                  {currentStaff.name?.slice(0, 2) || 'مو'}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <span>بروفايل: {currentStaff.name}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                      {currentStaff.position || 'موظف'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    البيانات الشخصية والتعيين - يمكنك تعديل أي حقل والضغط على حفظ التعديلات
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteStaff}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer border border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الموظف</span>
                </button>
              </div>
            </div>

            {/* Editable Profile Fields */}
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الاسم الكامل</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>السن</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: 28 سنة"
                    value={profileForm.age}
                    onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>

                {/* National ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الرقم القومي (14 رقم)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="الرقم القومي في البطاقة"
                    value={profileForm.national_id}
                    onChange={(e) => setProfileForm({ ...profileForm, national_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-indigo-600" />
                    <span>رقم التليفون</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="010..."
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
                  />
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>العنوان ومحل الإقامة</span>
                  </label>
                  <input
                    type="text"
                    placeholder="المحافظة - المركز - القرية أو الشارع"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الوظيفة / المسمى الوظيفي</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: كاشير / مسؤول استوديو"
                    value={profileForm.position}
                    onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>

                {/* Hiring Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>تاريخ التعيين</span>
                  </label>
                  <input
                    type="date"
                    value={profileForm.hiring_date}
                    onChange={(e) => setProfileForm({ ...profileForm, hiring_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>

                {/* Base Salary */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>الراتب الأساسي (ج.م)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={profileForm.base_salary}
                    onChange={(e) => setProfileForm({ ...profileForm, base_salary: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-emerald-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
                  />
                </div>

                {/* Profile Notes */}
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ملاحظات عامة على الموظف</span>
                  </label>
                  <input
                    type="text"
                    placeholder="أي ملاحظات شخصية أو إدارية..."
                    value={profileForm.notes}
                    onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ تعديلات البروفايل</span>
                </button>
              </div>
            </form>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2.1: MONTH SELECTOR & FINANCIAL SNAPSHOT BAR */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-7 bg-amber-400 rounded-full" />
                <div>
                  <h3 className="font-black text-base text-amber-400">
                    ملخص حسابات شهر {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                  </h3>
                  <p className="text-xs text-slate-400">
                    الحساب المالي للموظف {currentStaff.name} خلال هذا الشهر المحدد
                  </p>
                </div>
              </div>

              {/* Month & Year Selectors */}
              <div className="flex items-center gap-2.5">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>

            {/* Financial 4 Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              
              {/* 1. Base Salary */}
              <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60">
                <p className="text-[11px] text-slate-400 font-medium mb-1">الراتب الأساسي</p>
                <p className="text-lg font-black text-white">
                  {baseSalary.toLocaleString()} <span className="text-xs font-normal text-slate-400">ج.م</span>
                </p>
              </div>

              {/* 2. Received Payouts */}
              <div className="bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-800/40">
                <p className="text-[11px] text-emerald-400 font-medium mb-1">المستلم خلال الشهر ({monthlyStaffPayouts.length} دفعات)</p>
                <p className="text-lg font-black text-emerald-400">
                  {totalPayoutsThisMonth.toLocaleString()} <span className="text-xs font-normal text-emerald-300">ج.م</span>
                </p>
              </div>

              {/* 3. Deductions & Penalties */}
              <div className="bg-rose-950/40 p-3.5 rounded-xl border border-rose-800/40">
                <p className="text-[11px] text-rose-400 font-medium mb-1">الخصومات والجزاءات ({monthlyStaffDeductions.length})</p>
                <p className="text-lg font-black text-rose-400">
                  {totalDeductionsThisMonth.toLocaleString()} <span className="text-xs font-normal text-rose-300">ج.م</span>
                </p>
              </div>

              {/* 4. Net Remaining */}
              <div className={`p-3.5 rounded-xl border ${
                netRemainingSalary >= 0 
                  ? 'bg-amber-950/30 border-amber-700/50' 
                  : 'bg-rose-900/50 border-rose-600'
              }`}>
                <p className="text-[11px] text-amber-300 font-medium mb-1">الصافي المتبقي له</p>
                <p className={`text-lg font-black ${netRemainingSalary >= 0 ? 'text-amber-300' : 'text-rose-300'}`}>
                  {netRemainingSalary.toLocaleString()} <span className="text-xs font-normal opacity-80">ج.م</span>
                </p>
              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: THE THREE ITEMIZED LOGS (الإجازات - المرتبات - الجزاءات) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ------------------------------------------------------------- */}
            {/* BOX 1: سجل وبنود الإجازات (نازل يوم كذا ⬅️ راجع يوم كذا) */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                      <Palmtree className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-black text-slate-800 text-base">سجل وبنود الإجازات</h3>
                      <p className="text-[11px] text-slate-400">نازل يوم كذا ⬅️ راجع يوم كذا</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-700 rounded-lg">
                    {monthlyStaffVacations.length} إجازة
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 mb-4">
                  {monthlyStaffVacations.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      لا توجد إجازات مسجلة لهذا الشهر
                    </div>
                  ) : (
                    monthlyStaffVacations.map((vac) => {
                      const days = calculateDays(vac.start_date, vac.end_date);
                      return (
                        <div 
                          key={vac.id}
                          className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl text-xs space-y-1 relative group hover:bg-emerald-50 transition"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <div className="flex items-center gap-1.5 text-emerald-900">
                              <span>نازل: {vac.start_date}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-emerald-600 rotate-180" />
                              <span>راجع: {vac.end_date}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteVacation(vac.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition"
                              title="حذف الإجازة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-600 pt-1">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                              {days} {days === 1 ? 'يوم' : 'أيام'}
                            </span>
                            <span className="text-slate-500">نوع الإجازة: {vac.type}</span>
                          </div>

                          {vac.notes && (
                            <p className="text-[11px] text-slate-500 bg-white/70 p-1.5 rounded border border-emerald-100 mt-1">
                              ملاحظات: {vac.notes}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Add Vacation Form */}
              <form onSubmit={handleAddVacation} className="pt-3 border-t border-slate-100 space-y-2.5 bg-slate-50/70 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تسجيل إجازة جديدة</span>
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">نازل إجازة يوم</label>
                    <input
                      type="date"
                      required
                      value={vacationForm.start_date}
                      onChange={(e) => setVacationForm({ ...vacationForm, start_date: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">راجع يوم</label>
                    <input
                      type="date"
                      required
                      value={vacationForm.end_date}
                      onChange={(e) => setVacationForm({ ...vacationForm, end_date: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={vacationForm.type}
                    onChange={(e) => setVacationForm({ ...vacationForm, type: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  >
                    <option value="سنوية">إجازة سنوية</option>
                    <option value="عارضة">إجازة عارضة</option>
                    <option value="راحة أسبوعية">راحة أسبوعية</option>
                    <option value="مرضي">إجازة مرضي</option>
                  </select>

                  <input
                    type="text"
                    placeholder="ملاحظات (اختياري)"
                    value={vacationForm.notes}
                    onChange={(e) => setVacationForm({ ...vacationForm, notes: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  + إضافة بند الإجازة
                </button>
              </form>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* BOX 2: سجل استلام المرتبات والدفعات (استلم يوم كذا من مين) */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                      <Wallet className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-black text-slate-800 text-base">سجل استلام المرتبات</h3>
                      <p className="text-[11px] text-slate-400">استلم يوم كذا مبلغ كذا من مين</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
                    {totalPayoutsThisMonth.toLocaleString()} ج.م
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 mb-4">
                  {monthlyStaffPayouts.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      لا توجد دفعات مستلمة لهذا الشهر
                    </div>
                  ) : (
                    monthlyStaffPayouts.map((sal) => {
                      const amount = Number(sal.amount || sal.net_salary || 0);
                      return (
                        <div 
                          key={sal.id}
                          className="p-3 bg-blue-50/50 border border-blue-200/80 rounded-xl text-xs space-y-1 relative group hover:bg-blue-50 transition"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <div className="flex items-center gap-1.5 text-blue-950">
                              <span className="text-blue-700 font-black">{amount.toLocaleString()} ج.م</span>
                              <span>•</span>
                              <span className="text-slate-600">يوم {sal.payment_date || sal.date}</span>
                            </div>
                            <button
                              onClick={() => handleDeletePayout(sal.id, amount)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition"
                              title="حذف الدفعة وإرجاعها للخزنة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-600 pt-1">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-md">
                              استلم من: {sal.handed_by || 'مؤمن'}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                              {sal.payment_method || 'كاش'}
                            </span>
                          </div>

                          {sal.notes && (
                            <p className="text-[11px] text-slate-500 bg-white/70 p-1.5 rounded border border-blue-100 mt-1">
                              ملاحظات: {sal.notes}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Add Payout Form */}
              <form onSubmit={handleAddPayout} className="pt-3 border-t border-slate-100 space-y-2.5 bg-slate-50/70 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>تسجيل استلام دفعة من المرتب</span>
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">المبلغ (ج.م)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="مثال: 1000"
                      value={payoutForm.amount}
                      onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">تاريخ الاستلام</label>
                    <input
                      type="date"
                      required
                      value={payoutForm.date}
                      onChange={(e) => setPayoutForm({ ...payoutForm, date: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">استلم من</label>
                    <select
                      value={payoutForm.handed_by}
                      onChange={(e) => setPayoutForm({ ...payoutForm, handed_by: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                    >
                      {MANAGERS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">طريقة الدفع</label>
                    <select
                      value={payoutForm.method}
                      onChange={(e) => setPayoutForm({ ...payoutForm, method: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="ملاحظة (مثال: دفعة من الراتب مع مؤمن)"
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                />

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  + تسجيل الدفعة (خصم من الخزنة)
                </button>
              </form>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* BOX 3: سجل الجزاءات والخصومات (عنده خصم كذا والسبب كذا) */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                      <ShieldAlert className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-black text-slate-800 text-base">سجل الجزاءات والخصومات</h3>
                      <p className="text-[11px] text-slate-400">عنده خصم فيزا / غياب والسبب كذا</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-rose-50 text-rose-700 rounded-lg">
                    {totalDeductionsThisMonth.toLocaleString()} ج.م
                  </span>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 mb-4">
                  {monthlyStaffDeductions.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      لا توجد جزاءات أو خصومات مسجلة لهذا الشهر
                    </div>
                  ) : (
                    monthlyStaffDeductions.map((ded) => {
                      const amount = Number(ded.deductions || ded.amount || 0);
                      return (
                        <div 
                          key={ded.id}
                          className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl text-xs space-y-1 relative group hover:bg-rose-50 transition"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <div className="flex items-center gap-1.5 text-rose-950">
                              <span className="text-rose-700 font-black">خصم {amount.toLocaleString()} ج.م</span>
                              <span>•</span>
                              <span className="text-slate-600">يوم {ded.payment_date || ded.date}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteDeduction(ded.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition"
                              title="حذف الخصم"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-700 pt-1">
                            {ded.notes ? (
                              <p className="bg-white/80 p-1.5 rounded border border-rose-100">
                                {ded.notes}
                              </p>
                            ) : (
                              <span className="text-slate-500">خصم من الراتب</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Add Deduction Form */}
              <form onSubmit={handleAddDeduction} className="pt-3 border-t border-slate-100 space-y-2.5 bg-slate-50/70 p-3 rounded-xl">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-rose-600" />
                  <span>تسجيل جزاء أو خصم</span>
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">قيمة الخصم (ج.م)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="مثال: 200"
                      value={deductionForm.amount}
                      onChange={(e) => setDeductionForm({ ...deductionForm, amount: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">تاريخ الخصم</label>
                    <input
                      type="date"
                      required
                      value={deductionForm.date}
                      onChange={(e) => setDeductionForm({ ...deductionForm, date: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">سبب الخصم</label>
                    <select
                      value={deductionForm.reason}
                      onChange={(e) => setDeductionForm({ ...deductionForm, reason: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                    >
                      <option value="خصم فيزا">خصم فيزا</option>
                      <option value="غياب">غياب بدون إذن</option>
                      <option value="تأخير">تأخير</option>
                      <option value="تلفيات">تلفيات أو إهدار</option>
                      <option value="جزاء إداري">جزاء إداري</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">الآمر بالخصم</label>
                    <select
                      value={deductionForm.ordered_by}
                      onChange={(e) => setDeductionForm({ ...deductionForm, ordered_by: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                    >
                      {MANAGERS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="ملاحظات توضيحية إضافية..."
                  value={deductionForm.notes}
                  onChange={(e) => setDeductionForm({ ...deductionForm, notes: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
                />

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-lg font-bold text-xs transition cursor-pointer"
                >
                  + تسجيل الجزاء / الخصم
                </button>
              </form>
            </div>

          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
          <p className="font-bold text-slate-600 mb-2">يرجى اختيار موظف من الصندوق أعلاه لعرض البروفايل الخاص به</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW EMPLOYEE (+ إضافة موظف جديد) */}
      {/* ========================================================================= */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">إضافة موظف جديد للنظام</h3>
                  <p className="text-xs text-slate-500">أدخل البيانات الأساسية وسيتم إنشاء بروفايل كامل له فوراً</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddStaffModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewStaff} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم الموظف ثلاثي أو رباعي"
                    value={newStaffForm.name}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">السن</label>
                  <input
                    type="text"
                    placeholder="مثال: 25 سنة"
                    value={newStaffForm.age}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, age: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* National ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الرقم القومي</label>
                  <input
                    type="text"
                    placeholder="14 رقم"
                    value={newStaffForm.national_id}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, national_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم التليفون</label>
                  <input
                    type="tel"
                    placeholder="010..."
                    value={newStaffForm.phone}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوظيفة / المسمى الوظيفي</label>
                  <input
                    type="text"
                    placeholder="كاشير / مسؤول استوديو"
                    value={newStaffForm.position}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, position: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">العنوان</label>
                  <input
                    type="text"
                    placeholder="العنوان بالتفصيل"
                    value={newStaffForm.address}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Base Salary */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الراتب الأساسي (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newStaffForm.base_salary}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, base_salary: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-emerald-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
                  />
                </div>

                {/* Hiring Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ التعيين</label>
                  <input
                    type="date"
                    value={newStaffForm.hiring_date}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, hiring_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                  <input
                    type="text"
                    placeholder="أي ملاحظات تخص الموظف..."
                    value={newStaffForm.notes}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-sm font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>تأكيد الإضافة</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
