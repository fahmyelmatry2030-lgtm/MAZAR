"use client";

import { useEffect, useMemo, useState } from 'react';
import { deleteDbTodo, getDbTodos, saveDbTodo, updateDbTodoStatus } from '@/lib/actions/db';
import { Calendar, CheckCircle2, Clock, Plus, Trash2, Check, Filter } from 'lucide-react';

type TodoItem = {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  created_by?: string;
  completed_by?: string;
  created_at?: string;
  completed_at?: string;
};

const formatDateTime = (isoStr?: string) => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const datePart = d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timePart = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} - ${timePart}`;
  } catch {
    return isoStr;
  }
};

const formatDateOnly = (isoStr?: string) => {
  if (!isoStr) return 'غائب التعيين';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return isoStr;
  }
};

export default function TasksPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ title: '', notes: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [adminRole, setAdminRole] = useState<string>('Admin');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const info = sessionStorage.getItem('adminInfo') || localStorage.getItem('adminInfo');
      if (info) {
        try {
          const parsed = JSON.parse(info);
          if (parsed.role) setAdminRole(parsed.role);
        } catch (e) {}
      }
    }
  }, []);

  const canManage = adminRole !== 'Partner' && adminRole !== 'Akoura';

  const getLoggedInAdminName = () => {
    if (typeof window === 'undefined') return 'قائد الشيفت';
    try {
      const info = sessionStorage.getItem('adminInfo') || localStorage.getItem('adminInfo');
      if (info) {
        const parsed = JSON.parse(info);
        if (parsed.name) return parsed.name;
        if (parsed.username) return parsed.username;
      }
    } catch (e) {}
    return 'قائد الشيفت';
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await getDbTodos(Date.now().toString());
      setTodos(data || []);
    } catch (err: any) {
      console.error(err);
      setError('تعذر تحميل بيانات المهام.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Distinct dates for filtering
  const availableDates = useMemo(() => {
    const datesSet = new Set<string>();
    todos.forEach((t) => {
      if (t.created_at) {
        const dateStr = t.created_at.slice(0, 10);
        datesSet.add(dateStr);
      }
    });
    return Array.from(datesSet).sort().reverse();
  }, [todos]);

  // Filtered Todos
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      if (statusFilter === 'pending' && t.completed) return false;
      if (statusFilter === 'completed' && !t.completed) return false;
      if (selectedDateFilter !== 'all' && t.created_at) {
        if (!t.created_at.startsWith(selectedDateFilter)) return false;
      }
      return true;
    });
  }, [todos, statusFilter, selectedDateFilter]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setIsSaving(true);
    setError('');
    try {
      const createdBy = getLoggedInAdminName();
      const newTodo = await saveDbTodo({
        title: form.title,
        notes: form.notes,
        created_by: createdBy,
      });
      setTodos((prev) => [newTodo, ...prev]);
      setForm({ title: '', notes: '' });
    } catch (err: any) {
      console.error(err);
      setError('فشل حفظ المهمة.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (item: TodoItem) => {
    if (!canManage) return;
    const newStatus = !item.completed;
    const currentAdmin = getLoggedInAdminName();
    
    // Immediate UI optimistic update
    setTodos((prev) =>
      prev.map((t) =>
        t.id === item.id
          ? {
              ...t,
              completed: newStatus,
              completed_at: newStatus ? new Date().toISOString() : undefined,
              completed_by: newStatus ? currentAdmin : undefined,
            }
          : t
      )
    );

    try {
      await updateDbTodoStatus(item.id, newStatus, currentAdmin);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) return;
    if (!window.confirm('هل تريد حذف هذه المهمة نهائياً؟')) return;
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteDbTodo(id);
    } catch (err) {
      console.error(err);
    }
  };

  const pendingCount = useMemo(() => todos.filter((t) => !t.completed).length, [todos]);
  const completedCount = useMemo(() => todos.filter((t) => t.completed).length, [todos]);

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-[#EAE4D9] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2A2723] text-[#C1A68D] flex items-center justify-center font-black shadow-lg">
              📋
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-[#2A2723]">قائمة المهام والملاحظات</h1>
              <p className="text-xs md:text-sm font-bold text-[#7A7061] mt-1">
                السجل الكامل للمهام والتعليمات اليومية وتاريخ التسجيل والتنفيذ
              </p>
            </div>
          </div>
        </div>

        {/* Date & Status Quick Stats */}
        <div className="flex items-center gap-3">
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-black shadow-sm">
            <span>🔴 لم يتم التنفيذ: {pendingCount}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-black shadow-sm">
            <span>🟢 تم التنفيذ: {completedCount}</span>
          </div>
        </div>
      </header>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-4 text-xs font-black">{error}</div>}

      {/* Filters Bar */}
      <section className="bg-white p-4 rounded-2xl border border-[#EAE4D9] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-[#2A2723] flex items-center gap-1">
            <Filter size={14} /> تصفية حسب الحالة:
          </span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              statusFilter === 'all' ? 'bg-[#2A2723] text-white shadow-sm' : 'bg-[#FDFBF7] text-gray-600 border border-[#EAE4D9]'
            }`}
          >
            عرض الكل ({todos.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              statusFilter === 'pending' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            🔴 لم يتم التنفيذ ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
              statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            🟢 تم التنفيذ ({completedCount})
          </button>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-[#2A2723]">تصفية بالتاريخ:</span>
          <select
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-4 py-2 text-xs font-black text-[#2A2723] outline-none"
          >
            <option value="all">جميع التواريخ</option>
            {availableDates.map((dateStr) => (
              <option key={dateStr} value={dateStr}>
                يوم {dateStr}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Main Tasks Table */}
      <section className="bg-white border border-[#EAE4D9] rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[#EAE4D9] flex justify-between items-center bg-[#FDFBF7]">
          <h2 className="text-base font-black text-[#2A2723] flex items-center gap-2">
            <span>📋 سجل المهام والملاحظات المسجلة</span>
          </h2>
          <span className="text-xs font-black text-[#7A7061]">عدد المهام المعروضة: {filteredTodos.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-[#2A2723] text-white font-black text-xs">
              <tr>
                <th className="p-4 w-12 text-center">#</th>
                <th className="p-4 w-40 text-center">تاريخ التسجيل</th>
                <th className="p-4 w-40 text-center">تاريخ التنفيذ</th>
                <th className="p-4 w-44 text-center">حالة المهمة</th>
                <th className="p-4">المهمة / الملاحظة</th>
                <th className="p-4">ملاحظات إضافية</th>
                <th className="p-4 w-28 text-center">سُجلت بواسطة</th>
                <th className="p-4 w-28 text-center">نُفذت بواسطة</th>
                {canManage && <th className="p-4 w-16 text-center">حذف</th>}
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="p-16 text-center text-gray-400 font-bold">
                    جاري تحميل المهام...
                  </td>
                </tr>
              ) : filteredTodos.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="p-16 text-center text-gray-400 font-bold">
                    لا توجد مهام مطابقة للتصفية المختارة
                  </td>
                </tr>
              ) : (
                filteredTodos.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className={`border-t border-[#EAE4D9]/60 transition-colors ${
                      item.completed ? 'bg-emerald-50/20' : 'bg-rose-50/20 hover:bg-rose-50/40'
                    }`}
                  >
                    <td className="p-4 text-center font-bold text-[#7A7061]">{idx + 1}</td>
                    <td className="p-4 text-center text-[11px] font-bold text-gray-600 whitespace-nowrap">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="p-4 text-center text-[11px] font-bold text-gray-600 whitespace-nowrap">
                      {item.completed ? formatDateTime(item.completed_at || item.created_at) : '—'}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => handleToggleStatus(item)}
                        title={canManage ? 'اضغط لتغيير حالة التنفيذ' : undefined}
                        className={`w-full py-2 px-3 rounded-xl font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                          item.completed
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95'
                        } ${!canManage ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                      >
                        {item.completed ? (
                          <>
                            <CheckCircle2 size={14} />
                            <span>🟢 تم التنفيذ</span>
                          </>
                        ) : (
                          <>
                            <Clock size={14} />
                            <span>🔴 لم يتم التنفيذ</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs md:text-sm font-normal leading-relaxed ${
                          item.completed ? 'line-through text-gray-400 font-normal' : 'text-[#2A2723] font-normal'
                        }`}
                      >
                        {item.title}
                      </span>
                    </td>
                    <td className="p-4 text-[#7A7061] font-normal text-xs">
                      {item.notes || '—'}
                    </td>
                    <td className="p-4 text-center text-gray-500 font-medium text-xs">
                      {item.created_by || 'Admin'}
                    </td>
                    <td className="p-4 text-center text-emerald-700 font-bold text-xs">
                      {item.completed ? item.completed_by || item.created_by || 'Admin' : '—'}
                    </td>
                    {canManage && (
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          title="حذف المهمة"
                          className="text-red-500 hover:text-red-700 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
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
