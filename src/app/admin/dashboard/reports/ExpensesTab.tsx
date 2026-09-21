"use client";

import { useState, useEffect, useMemo } from 'react';
import { saveDbExpense, deleteDbExpense, getDbExpenses, updateDbExpense } from '@/lib/actions/db';
import { Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// ── Custom CountUp Component (No external lib needed) ──
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (outQuart)
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(start + (end - start) * ease);
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
}

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(-1);
  const [selectedYear, setSelectedYear] = useState(-1);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
  }, []);

  const getDefaultDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [newExpense, setNewExpense] = useState({
    amount: '',
    description: '',
    date: '',
    branch: '12',
    from_entity: '',
    to_entity: '',
    ordered_by: '',
    invoice_number: '',
    notes: '',
    status: 'PENDING',
    approved_by: '',
  });

  useEffect(() => {
    setNewExpense(prev => ({
      ...prev,
      date: getDefaultDate()
    }));
  }, []);

  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };

  const parseDate = (displayStr: string) => {
    if (!displayStr || !displayStr.includes('/')) return displayStr;
    const parts = displayStr.split('/');
    if (parts.length !== 3) return displayStr;
    const [d, m, y] = parts;
    if (y && y.length === 4 && m && d) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return displayStr;
  };

  // Validate date is in YYYY-MM-DD format
  const isValidDate = (dateStr: string) => {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
  };

  const [adminRole, setAdminRole] = useState<string>('Super Admin');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');

  useEffect(() => {
    const info = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('adminInfo') || '{}') : {};
    if (info) {
      setAdminRole(info.role || '');
      setCurrentUserName(info.name || '');
      setCurrentUsername(info.username || '');
      if (info.role === 'Akoura' || info.role === 'Aura') {
        setNewExpense(prev => ({ ...prev, branch: '3' }));
      }
    }
  }, []);

  const isAkoura = adminRole === 'Akoura' || adminRole === 'Aura';
  // ONLY Mo2men and Medhat can approve/toggle expenses
  const isOwner = 
    ['مؤمن', 'مدحت'].includes((currentUserName || '').trim()) ||
    ['mo2men', 'medhat'].includes((currentUsername || '').toLowerCase().trim()) ||
    ['mo2men', 'medhat'].includes((currentUserName || '').toLowerCase().trim());

  const approverDisplayName = 
    (currentUserName.includes('مدحت') || currentUsername.toLowerCase().includes('medhat')) ? 'مدحت' : 'مؤمن';

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Sync branch filter with form branch field
  useEffect(() => {
    if (isAkoura) return; // Akoura always uses branch 3
    if (selectedBranch !== 'all') {
      setNewExpense(prev => ({ ...prev, branch: selectedBranch }));
    }
  }, [selectedBranch, isAkoura]);

  const getBranchLabel = (branch: any) => {
    const b = parseInt(branch);
    if (b === 1 || b === 2 || b === 12) return 'مزار 1 و 2';
    if (b === 3) return 'مزار 3';
    if (b === 4) return 'شقة ذكي رستم';
    if (b === 5) return 'شقة سيتي';
    if (b === 6) return 'شقة عباس الرئيسي';
    return 'مزار 1 و 2';
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await getDbExpenses();
      let cleanData = data || [];
      if (typeof window !== 'undefined') {
        const info = JSON.parse(sessionStorage.getItem('adminInfo') || '{}');
        if (info?.role === 'Akoura') {
          cleanData = cleanData.filter((e: any) => e.branch === 3);
        }
      }
      setExpenses(cleanData);
      setError(null);
    } catch (err: any) {
      console.error('Error loading expenses:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const isExpenseApproved = (exp: any) => {
    if (!exp) return false;
    if (exp.status && (exp.status.includes('تم الموافقة') || exp.status === 'APPROVED')) return true;
    if (exp.approved_by && exp.approved_by !== '') return true;
    return false;
  };

  // ── Derived Data: Filter by month + branch ──
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e: any) => {
      if (!e.date) return false;
      const parts = e.date.split('-');
      if (parts.length < 2) return false;
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      if (month !== selectedMonth || year !== selectedYear) return false;

      // Branch filter
      if (selectedBranch !== 'all') {
        const b = parseInt(e.branch) || 0;
        if (selectedBranch === '12') {
          if (b !== 1 && b !== 2 && b !== 12 && e.branch) return false;
        } else {
          if (b !== parseInt(selectedBranch)) return false;
        }
      }

      return true;
    });
  }, [expenses, selectedMonth, selectedYear, selectedBranch]);

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => {
      return isExpenseApproved(curr) ? acc + (curr.amount || 0) : acc;
    }, 0);
  }, [filteredExpenses]);

  const pendingTotal = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => {
      return !isExpenseApproved(curr) ? acc + (curr.amount || 0) : acc;
    }, 0);
  }, [filteredExpenses]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(newExpense.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      alert('الرجاء إدخال مبلغ صحيح');
      return;
    }

    if (!newExpense.description.trim()) {
      alert('الرجاء إدخال السبب / البيان');
      return;
    }

    let dateToSave = newExpense.date;
    if (!isValidDate(dateToSave)) {
      const parsed = parseDate(dateToSave);
      if (isValidDate(parsed)) {
        dateToSave = parsed;
      } else {
        dateToSave = getDefaultDate();
      }
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      await saveDbExpense({
        category: 'عام',
        amount: amount,
        description: newExpense.description.trim(),
        date: dateToSave,
        branch: parseInt(newExpense.branch) || 12,
        from_entity: newExpense.from_entity.trim(),
        to_entity: newExpense.to_entity.trim(),
        ordered_by: newExpense.ordered_by.trim(),
        invoice_number: newExpense.invoice_number.trim(),
        notes: newExpense.notes.trim(),
        status: newExpense.status || 'PENDING',
        approved_by: newExpense.approved_by || '',
      });
      setNewExpense({
        amount: '',
        description: '',
        date: getDefaultDate(),
        branch: '12',
        from_entity: '',
        to_entity: '',
        ordered_by: '',
        invoice_number: '',
        notes: '',
        status: 'PENDING',
        approved_by: '',
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadExpenses();
    } catch (error: any) {
      console.error('Error saving expense:', error);
      alert('خطأ في الإضافة: ' + (error.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApproval = async (exp: any) => {
    if (!isOwner) {
      alert('عفواً، هذه الصلاحية مقتصرة على الأونر فقط (مؤمن ومدحت)');
      return;
    }
    if (togglingId) return;

    const currentlyApproved = isExpenseApproved(exp);
    const newStatus = currentlyApproved ? 'PENDING' : `تم الموافقة بواسطة: ${approverDisplayName}`;
    const newApprovedBy = currentlyApproved ? '' : approverDisplayName;

    // Optimistic Update
    setExpenses(prev => prev.map(item => item.id === exp.id ? { ...item, status: newStatus, approved_by: newApprovedBy } : item));
    setTogglingId(exp.id);

    try {
      await updateDbExpense(exp.id, {
        status: newStatus,
        approved_by: newApprovedBy,
        description: exp.description,
        branch: exp.branch,
        amount: exp.amount,
        date: exp.date,
        from_entity: exp.from_entity,
        to_entity: exp.to_entity,
        ordered_by: exp.ordered_by,
        invoice_number: exp.invoice_number,
        notes: exp.notes,
      });
      // Refresh to ensure exact DB sync
      const freshData = await getDbExpenses();
      if (freshData) {
        let clean = freshData;
        if (typeof window !== 'undefined') {
          const info = JSON.parse(sessionStorage.getItem('adminInfo') || '{}');
          if (info?.role === 'Akoura') clean = clean.filter((e: any) => e.branch === 3);
        }
        setExpenses(clean);
      }
    } catch (error: any) {
      console.error('Error toggling approval:', error);
      alert('حدث خطأ أثناء تحديث حالة الاعتماد: ' + (error.message || 'خطأ غير معروف'));
      loadExpenses();
    } finally {
      setTogglingId(null);
    }
  };

  const handleEdit = (expense: any) => {
    if (!isOwner) {
      alert('عفواً، هذه الصلاحية مقتصرة على الأونر فقط (مؤمن ومدحت)');
      return;
    }
    setEditingExpense({ ...expense });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      alert('عفواً، هذه الصلاحية مقتصرة على الأونر فقط (مؤمن ومدحت)');
      return;
    }
    try {
      await updateDbExpense(editingExpense.id, {
        amount: parseFloat(editingExpense.amount),
        description: editingExpense.description,
        date: editingExpense.date,
        from_entity: editingExpense.from_entity,
        to_entity: editingExpense.to_entity,
        ordered_by: editingExpense.ordered_by,
        invoice_number: editingExpense.invoice_number,
        notes: editingExpense.notes,
        status: editingExpense.status || 'PENDING',
        approved_by: editingExpense.approved_by || '',
        branch: parseInt(editingExpense.branch) || 12,
      });
      setIsEditModalOpen(false);
      setEditingExpense(null);
      loadExpenses();
    } catch (error: any) {
      alert('خطأ في التعديل: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isOwner) {
      alert('عفواً، هذه الصلاحية مقتصرة على الأونر فقط (مؤمن ومدحت)');
      return;
    }
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await deleteDbExpense(id);
      loadExpenses();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (error && (error.includes('Could not find the table') || error.includes('relation "public.expenses" does not exist'))) {
    return (
      <div className="p-12 text-center glass-card border-red-100 animate-in fade-in zoom-in duration-500">
        <span className="text-5xl mb-6 block animate-bounce">⚠️</span>
        <h3 className="text-xl font-black text-mazar-coffee mb-2 uppercase">جدول المصروفات غير موجود</h3>
        <p className="text-xs text-mazar-gray font-bold max-w-md mx-auto leading-relaxed">
          يرجى إنشاء جدول المصروفات في قاعدة البيانات بنفس الهيكلية المعتمدة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20" dir="rtl">
      
      {/* Top Banner & Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-card border-mazar-gold/30 bg-gradient-to-br from-white via-[#FDFBF7] to-[#F7F3EB] p-8 md:p-10 shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start z-10">
            <div>
              <span className="text-[10px] font-black text-mazar-gold uppercase tracking-[0.2em] bg-mazar-gold/10 px-4 py-1.5 rounded-full border border-mazar-gold/20">
                إجمالي المصروفات المعتمدة المقبولة
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-mazar-coffee mt-4">
                <AnimatedNumber value={totalAmount} /> <span className="text-base text-mazar-gold">ج.م</span>
              </h2>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-mazar-coffee text-mazar-gold flex items-center justify-center text-2xl shadow-xl">
              💰
            </div>
          </div>
          <p className="text-xs font-bold text-gray-500 mt-6 z-10">
            يتم احتساب المصروفات المعتمدة فقط في الإجمالي، بينما تظل المصروفات المعلقة بانتظار موافقة الأونر.
          </p>
        </div>

        <div className="glass-card border-amber-200 bg-amber-50/50 p-8 shadow-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] bg-amber-100 px-3 py-1 rounded-full border border-amber-200">
              ⏳ المصروفات غير المعتمدة (معلقة)
            </span>
            <h3 className="text-2xl md:text-3xl font-black text-amber-900 mt-4">
              <AnimatedNumber value={pendingTotal} /> <span className="text-sm text-amber-700">ج.م</span>
            </h3>
          </div>
          <p className="text-[11px] font-bold text-amber-800/80 mt-4">
            لا تُجمع مع الإجمالي إلا بعد ضغط الأونر على زر الاعتماد.
          </p>
        </div>
      </div>

      {/* Filters Bar & Section Tabs */}
      <div className="space-y-4">
        {/* Branch Circle Tabs (مطابقة لتقسيمة الكشكول) */}
        {!isAkoura && (
          <div className="flex flex-wrap items-center gap-2.5 bg-white/90 p-3.5 rounded-3xl border border-[#EAE4D9] shadow-sm">
            <span className="text-[11px] font-black text-mazar-coffee px-2">الأقسام:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: '12', label: 'مزار 1 + مزار 2' },
              { id: '3', label: 'مزار 3' },
              { id: '4', label: 'شقة ذكي رستم' },
              { id: '5', label: 'شقة سيتي' },
              { id: '6', label: 'شقة عباس الرئيسي' },
            ].map(tab => {
              const isActive = selectedBranch === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedBranch(tab.id)}
                  className={`px-5 py-2.5 rounded-full text-xs font-black transition-all duration-200 border cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-mazar-coffee text-mazar-gold border-mazar-gold shadow-md scale-105'
                      : 'bg-[#FDFBF7] text-gray-700 hover:bg-gray-100 border-[#EAE4D9]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap justify-between items-center gap-4 bg-white/80 p-4 rounded-2xl border border-[#EAE4D9] shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#2A2723]">القسم المختار:</span>
            <span className="text-xs font-black text-mazar-gold bg-mazar-coffee/10 px-3 py-1 rounded-xl">
              {selectedBranch === 'all' ? 'عرض جميع الأقسام' : getBranchLabel(selectedBranch)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#2A2723]">الشهر والسنوات:</span>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-4 py-2 text-xs font-black outline-none cursor-pointer">
              {MONTHS_AR.map((m, idx) => <option key={idx} value={idx}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-4 py-2 text-xs font-black outline-none cursor-pointer">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Add Form */}
      <div className="glass-card animate-in slide-in-from-bottom duration-500 border-mazar-gold/40 p-10 shadow-3xl">
        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-gray-100">
          <div className="w-12 h-12 rounded-2xl bg-mazar-coffee text-white flex items-center justify-center font-black shadow-lg">01</div>
          <div>
             <h3 className="text-2xl font-black text-mazar-coffee uppercase">تسجيل مصروف جديد</h3>
             <p className="text-[10px] font-black text-mazar-gray uppercase tracking-widest mt-1">ينزل المصروف بحالة "قيد الانتظار" لحين اعتماد الأونر له</p>
          </div>
        </div>

        <form onSubmit={handleAddExpense} className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-10">
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-mazar-coffee uppercase tracking-widest opacity-40 group-focus-within:opacity-100 transition-opacity">المبلغ (ج.م)</label>
              <input type="number" required placeholder="0.00" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="w-full bg-transparent border-b-2 border-gray-100 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all placeholder:text-gray-300" />
            </div>
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-mazar-coffee uppercase tracking-widest opacity-40 group-focus-within:opacity-100 transition-opacity">التاريخ</label>
              <input type="date" required value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} className="w-full bg-transparent border-b-2 border-gray-100 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" />
            </div>
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-mazar-coffee uppercase tracking-widest opacity-40 group-focus-within:opacity-100 transition-opacity">رقم الفاتورة</label>
              <input placeholder="مثلاً: INV-001" value={newExpense.invoice_number} onChange={e => setNewExpense({...newExpense, invoice_number: e.target.value})} className="w-full bg-transparent border-b-2 border-gray-100 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all placeholder:text-gray-300" />
            </div>
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-mazar-coffee uppercase tracking-widest opacity-40 group-focus-within:opacity-100 transition-opacity">الآمر بالصرف</label>
              <input placeholder="اسم المسؤول" value={newExpense.ordered_by} onChange={e => setNewExpense({...newExpense, ordered_by: e.target.value})} className="w-full bg-transparent border-b-2 border-gray-100 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all placeholder:text-gray-300" />
            </div>
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-mazar-coffee uppercase tracking-widest opacity-40 group-focus-within:opacity-100 transition-opacity">من (الجهة)</label>
              <input placeholder="مصدر المبلغ" value={newExpense.from_entity} onChange={e => setNewExpense({...newExpense, from_entity: e.target.value})} className="w-full bg-transparent border-b-2 border-gray-100 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all placeholder:text-gray-300" />
            </div>
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-mazar-coffee uppercase tracking-widest opacity-40 group-focus-within:opacity-100 transition-opacity">إلى (الجهة)</label>
              <input placeholder="المستلم" value={newExpense.to_entity} onChange={e => setNewExpense({...newExpense, to_entity: e.target.value})} className="w-full bg-transparent border-b-2 border-gray-100 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all placeholder:text-gray-300" />
            </div>
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-mazar-coffee uppercase tracking-widest opacity-40 group-focus-within:opacity-100 transition-opacity">الفرع / القسم</label>
              <select disabled={isAkoura} value={newExpense.branch} onChange={e => setNewExpense({...newExpense, branch: e.target.value})} className="w-full bg-transparent border-b-2 border-gray-100 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all cursor-pointer">
                <option value="12">مزار 1 و 2</option>
                <option value="3">مزار 3</option>
                <option value="4">شقة ذكي رستم</option>
                <option value="5">شقة سيتي</option>
                <option value="6">شقة عباس الرئيسي</option>
              </select>
            </div>
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-mazar-coffee uppercase tracking-widest opacity-40 group-focus-within:opacity-100 transition-opacity">السبب / البيان (Reason)</label>
              <input required placeholder="مثلاً: إعلانات فيسبوك، شراء أدوات نظافة..." value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full bg-transparent border-b-2 border-gray-100 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all placeholder:text-gray-300" />
            </div>
            
            {/* حالة الاعتماد */}
            <div className="space-y-3 group">
              <label className="text-[10px] font-black text-green-700 uppercase tracking-widest opacity-70 group-focus-within:opacity-100 transition-opacity">حالة الاعتماد (مؤمن ومدحت فقط)</label>
              <select
                disabled={!isOwner}
                value={newExpense.status}
                onChange={e => {
                  const val = e.target.value;
                  const approver = val.includes('مدحت') ? 'مدحت' : val.includes('مؤمن') ? 'مؤمن' : approverDisplayName;
                  setNewExpense({ ...newExpense, status: val, approved_by: val === 'PENDING' ? '' : approver });
                }}
                className="w-full bg-transparent border-b-2 border-green-200 px-0 py-4 text-sm font-bold text-green-800 outline-none focus:border-mazar-gold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="PENDING">⏳ غير معتمد (قيد الانتظار)</option>
                {isOwner && (
                  <>
                    <option value="تم الموافقة بواسطة: مؤمن">✅ تم الموافقة بواسطة: مؤمن</option>
                    <option value="تم الموافقة بواسطة: مدحت">✅ تم الموافقة بواسطة: مدحت</option>
                  </>
                )}
              </select>
            </div>

            {/* ملاحظات */}
            <div className="space-y-3 lg:col-span-4 group">
              <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest opacity-70 group-focus-within:opacity-100 transition-opacity">ملاحظات إضافية (Notes)</label>
              <input placeholder="أضف أي ملاحظات إضافية هنا..." value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} className="w-full bg-transparent border-b-2 border-amber-200 px-0 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all placeholder:text-gray-300" />
            </div>
          </div>
          
          <button type="submit" disabled={saving} className={`w-full font-black py-6 rounded-2xl transition-all shadow-2xl active:scale-95 uppercase tracking-[0.3em] text-xs ${saving ? 'bg-gray-400 text-white cursor-wait' : saveSuccess ? 'bg-green-600 text-white' : 'bg-mazar-coffee text-white hover:bg-mazar-gold hover:text-mazar-coffee'}`}>
            {saving ? (
              <span className="flex items-center justify-center gap-3"><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>جاري الحفظ...</span>
            ) : saveSuccess ? '✅ تم تسجيل المصروف بنجاح' : 'إدراج المصروف وتسجيله بنجاح'}
          </button>
        </form>
      </div>

      {/* Records Section */}
      <div className="space-y-8">
        <div className="flex justify-between items-end px-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-2xl font-black text-mazar-coffee uppercase leading-none">سجلات القيود المالية للمصروفات</h3>
            <p className="text-[9px] font-black text-mazar-gray uppercase tracking-widest mt-2">عرض {filteredExpenses.length} عملية (المصروفات غير المعتمدة تظهر بلون خفيف ولا تدخل في المجموع إلا بعد الموافقة)</p>
          </div>
        </div>
        
        <div className="glass-card overflow-hidden border-[#EAE4D9]/60 shadow-2xl rounded-[1.5rem]">
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse min-w-[1050px]">
              <thead>
                <tr className="bg-[#2A2723] text-white text-xs font-black uppercase tracking-widest">
                  <th className="px-4 py-5 border-x border-white/10 w-12">No</th>
                  <th className="px-4 py-5 border-x border-white/10 w-36">التاريخ</th>
                  <th className="px-4 py-5 border-x border-white/10 w-32">المبلغ</th>
                  <th className="px-4 py-5 border-x border-white/10">السبب / البيان</th>
                  <th className="px-4 py-5 border-x border-white/10">ملاحظات</th>
                  <th className="px-4 py-5 border-x border-white/10 w-36">رقم الفاتورة</th>
                  <th className="px-4 py-5 border-x border-white/10 w-32">من</th>
                  <th className="px-4 py-5 border-x border-white/10 w-32">إلى</th>
                  <th className="px-4 py-5 border-x border-white/10 w-32">الآمر بالصرف</th>
                  <th className="px-4 py-5 border-x border-white/10 w-36">الفرع</th>
                  <th className="px-4 py-5 border-x border-white/10 w-48">حالة الاعتماد</th>
                  <th className="px-4 py-5 border-x border-white/10 w-28">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr><td colSpan={12} className="p-20 text-center"><div className="inline-block w-8 h-8 border-4 border-mazar-gold border-t-transparent rounded-full animate-spin"></div></td></tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr><td colSpan={12} className="p-32 text-center text-gray-300 font-black uppercase tracking-widest text-sm">لا توجد سجلات مصروفات لهذا الشهر</td></tr>
                ) : filteredExpenses.map((exp, i) => {
                  const approved = isExpenseApproved(exp);
                  return (
                    <tr key={exp.id} className={`transition-colors group ${approved ? 'hover:bg-[#FDFBF7] bg-white' : 'bg-amber-50/40 opacity-90 hover:opacity-100'}`}>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-sm font-black text-mazar-gray">{i + 1}</td>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-sm font-black whitespace-nowrap">{formatDate(exp.date)}</td>
                      <td className={`px-4 py-5 border border-[#EAE4D9]/40 text-base font-black ${approved ? 'text-red-600' : 'text-amber-700'}`}>{exp.amount?.toLocaleString()}</td>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-right"><span className="text-sm font-bold text-mazar-coffee">{exp.description || '—'}</span></td>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-right"><span className="text-xs font-bold text-gray-600">{exp.notes || '—'}</span></td>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-sm font-bold text-mazar-gold">{exp.invoice_number || '—'}</td>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-sm font-bold text-mazar-coffee">{exp.from_entity || '—'}</td>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-sm font-bold text-mazar-coffee">{exp.to_entity || '—'}</td>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-sm font-bold text-mazar-coffee">{exp.ordered_by || '—'}</td>
                      <td className="px-4 py-5 border border-[#EAE4D9]/40 text-xs font-black text-mazar-gold">{getBranchLabel(exp.branch)}</td>
                      
                      {/* حالة الاعتماد */}
                      <td className="px-4 py-4 border border-[#EAE4D9]/40 text-xs font-black">
                        {isOwner ? (
                          <button
                            type="button"
                            disabled={togglingId === exp.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleApproval(exp);
                            }}
                            title={approved ? "اضغط لإلغاء الاعتماد (تحويل إلى غير معتمد)" : "اضغط للاعتماد الفوري بضغطة واحدة"}
                            className={`group/btn relative inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl font-black text-xs transition-all duration-200 shadow-sm active:scale-95 cursor-pointer border select-none ${
                              approved
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-amber-500/10'
                            }`}
                          >
                            {togglingId === exp.id ? (
                              <div className="flex items-center gap-2 px-2 py-0.5">
                                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                <span className="text-[10px]">جاري التحديث...</span>
                              </div>
                            ) : approved ? (
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-white text-emerald-600 flex items-center justify-center text-xs font-black shadow-xs shrink-0">✓</span>
                                <div className="flex flex-col text-right leading-tight">
                                  <span className="text-[11px] font-black">{exp.status && exp.status.includes('تم الموافقة') ? exp.status : `معتمد (${exp.approved_by || approverDisplayName})`}</span>
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
                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full border border-emerald-200 font-black text-xs">
                              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                              <span>معتمد ✅ {exp.approved_by ? `(${exp.approved_by})` : ''}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3.5 py-1.5 rounded-full border border-amber-200 font-black text-xs">
                              <Clock size={15} className="text-amber-600 shrink-0" />
                              <span>غير معتمد ⏳</span>
                            </div>
                          )
                        )}
                      </td>

                      {/* الإجراءات */}
                      <td className="px-4 py-4 border border-[#EAE4D9]/40">
                        {isOwner ? (
                          <div className="flex gap-2 justify-center items-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(exp);
                              }}
                              title="تعديل المصروف"
                              className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-xs flex items-center justify-center active:scale-90 border border-blue-200 cursor-pointer"
                            >
                              <Pencil size={15} strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(exp.id);
                              }}
                              title="حذف المصروف"
                              className="w-9 h-9 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-xs flex items-center justify-center active:scale-90 border border-red-200 cursor-pointer"
                            >
                              <Trash2 size={15} strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold">🔒 للمسؤولين فقط</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingExpense && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-3xl border border-white/10 overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-mazar-coffee p-8 flex justify-between items-center text-white">
              <div><h3 className="text-2xl font-black uppercase tracking-tight">تعديل سجل المصروف</h3><p className="text-[10px] font-black text-mazar-gold uppercase tracking-[0.2em] mt-1">تعديل البيانات المالية المسجلة</p></div>
              <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-2"><label className="text-[9px] font-black text-mazar-coffee uppercase tracking-widest opacity-60">المبلغ</label><input type="number" required value={editingExpense.amount} onChange={e => setEditingExpense({...editingExpense, amount: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" /></div>
                <div className="space-y-2"><label className="text-[9px] font-black text-mazar-coffee uppercase tracking-widest opacity-60">التاريخ</label><input type="text" required value={formatDate(editingExpense.date)} onChange={e => setEditingExpense({...editingExpense, date: parseDate(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" /></div>
                <div className="space-y-2"><label className="text-[9px] font-black text-mazar-coffee uppercase tracking-widest opacity-60">رقم الفاتورة</label><input value={editingExpense.invoice_number || ''} onChange={e => setEditingExpense({...editingExpense, invoice_number: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" /></div>
                <div className="space-y-2"><label className="text-[9px] font-black text-mazar-coffee uppercase tracking-widest opacity-60">الآمر بالصرف</label><input value={editingExpense.ordered_by} onChange={e => setEditingExpense({...editingExpense, ordered_by: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" /></div>
                <div className="space-y-2"><label className="text-[9px] font-black text-mazar-coffee uppercase tracking-widest opacity-60">من</label><input value={editingExpense.from_entity} onChange={e => setEditingExpense({...editingExpense, from_entity: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" /></div>
                <div className="space-y-2"><label className="text-[9px] font-black text-mazar-coffee uppercase tracking-widest opacity-60">إلى</label><input value={editingExpense.to_entity} onChange={e => setEditingExpense({...editingExpense, to_entity: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" /></div>
                <div className="space-y-2"><label className="text-[9px] font-black text-mazar-coffee uppercase tracking-widest opacity-60">الفرع / القسم</label><select disabled={isAkoura} value={editingExpense.branch} onChange={e => setEditingExpense({...editingExpense, branch: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all"><option value="12">مزار 1 و 2</option><option value="3">مزار 3</option><option value="4">شقة ذكي رستم</option><option value="5">شقة سيتي</option><option value="6">شقة عباس الرئيسي</option></select></div>
                <div className="space-y-2"><label className="text-[9px] font-black text-mazar-coffee uppercase tracking-widest opacity-60">السبب / البيان</label><input required value={editingExpense.description} onChange={e => setEditingExpense({...editingExpense, description: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" /></div>

                {/* حالة الاعتماد */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-green-700 uppercase tracking-widest opacity-80">حالة الاعتماد (مؤمن ومدحت فقط)</label>
                  <select
                    disabled={!isOwner}
                    value={
                      isExpenseApproved(editingExpense)
                        ? (editingExpense.status && editingExpense.status.includes('تم الموافقة')
                            ? editingExpense.status
                            : `تم الموافقة بواسطة: ${editingExpense.approved_by || approverDisplayName}`)
                        : 'PENDING'
                    }
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'PENDING') {
                        setEditingExpense({ ...editingExpense, status: 'PENDING', approved_by: '' });
                      } else {
                        const approver = val.includes('مدحت') ? 'مدحت' : 'مؤمن';
                        setEditingExpense({ ...editingExpense, status: val, approved_by: approver });
                      }
                    }}
                    className="w-full bg-green-50 border border-green-200 rounded-2xl px-6 py-4 text-sm font-bold text-green-900 outline-none focus:border-green-500 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="PENDING">⏳ غير معتمد (قيد الانتظار)</option>
                    <option value="تم الموافقة بواسطة: مؤمن">✅ تم الموافقة بواسطة: مؤمن</option>
                    <option value="تم الموافقة بواسطة: مدحت">✅ تم الموافقة بواسطة: مدحت</option>
                  </select>
                </div>

                <div className="space-y-2"><label className="text-[9px] font-black text-amber-700 uppercase tracking-widest opacity-70">ملاحظات</label><input value={editingExpense.notes || ''} onChange={e => setEditingExpense({...editingExpense, notes: e.target.value})} className="w-full bg-gray-50 border border-amber-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-mazar-gold transition-all" /></div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-mazar-coffee text-white font-black py-5 rounded-2xl hover:bg-mazar-gold hover:text-mazar-coffee transition-all shadow-xl active:scale-95 uppercase tracking-widest text-[11px]">حفظ التعديلات</button>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-10 bg-gray-100 text-gray-500 font-black py-5 rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest text-[11px]">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
