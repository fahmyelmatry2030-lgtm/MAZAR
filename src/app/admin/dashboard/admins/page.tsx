"use client";

import { useEffect, useState } from 'react';
import { getDbAdmins, addDbAdmin, updateDbAdmin, deleteDbAdmin } from '@/lib/actions/db';

export default function AdminsManagementPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('مدير الحجوزات');
  const [errorMsg, setErrorMsg] = useState('');

  const loadAdmins = async () => {
    setIsLoading(true);
    const data = await getDbAdmins();
    setAdmins(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleOpenModal = (admin?: any) => {
    setErrorMsg('');
    if (admin) {
      setEditingAdmin(admin);
      setUsername(admin.username);
      setPassword(admin.password);
      setName(admin.name);
      setRole(admin.role);
    } else {
      setEditingAdmin(null);
      setUsername('');
      setPassword('');
      setName('');
      setRole('مدير الحجوزات');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!username || !password || !name) {
      setErrorMsg('يرجى تعبئة جميع الحقول المطلوبة.');
      return;
    }

    // Role safety check (Can't downgrade original Super Admin randomly if it's oneself, but we trust the inputs for now)
    const adminData = { username, password, name, role };
    let res;

    if (editingAdmin) {
      res = await updateDbAdmin(editingAdmin.id, adminData);
    } else {
      res = await addDbAdmin(adminData);
    }

    if (res.success) {
      setIsModalOpen(false);
      loadAdmins();
    } else {
      setErrorMsg('حدث خطأ أثناء حفظ البيانات.');
    }
  };

  const handleDelete = async (id: string, adminRole: string) => {
    if (adminRole === 'Super Admin' && admins.filter(a => a.role === 'Super Admin').length <= 1) {
      alert('لا يمكنك حذف مدير النظام الرئيسي الأخير!');
      return;
    }
    if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
      const res = await deleteDbAdmin(id);
      if (res.success) {
        loadAdmins();
      } else {
        alert('حدث خطأ أثناء الحذف.');
      }
    }
  };

  if (isLoading && admins.length === 0) {
    return <div className="p-8 text-center text-white">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in relative z-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black mb-2 text-white">فريق <span className="text-gold">الإدارة</span></h1>
          <p className="text-gray-400 text-sm">أضف حسابات فرعية، وتحكم في صلاحيات الوصول لضمان أمان النظام.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-gold text-navy font-black py-3 px-6 rounded-2xl shadow-[0_4px_20px_rgba(201,168,76,0.3)] hover:scale-105 transition-all text-sm flex items-center gap-2"
        >
          <span>➕</span> إضافة مدير جديد
        </button>
      </header>

      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden glass-card p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#060b18] text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-white/5">
              <tr>
                <th className="p-6">الاسم والصلاحية</th>
                <th className="p-6">اسم المستخدم (User)</th>
                <th className="p-6">الرقم السري (Pass)</th>
                <th className="p-6 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white bg-[#0a0f1e]/50">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-6">
                    <div className="font-bold text-base mb-1">{admin.name}</div>
                    <span className={`text-[10px] px-3 py-1 rounded-full font-black border ${
                      admin.role === 'Super Admin' ? 'bg-gold/10 text-gold border-gold/20' : 
                      admin.role === 'مدير الوحدات' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                      'bg-success/10 text-success border-success/20'
                    }`}>
                      {admin.role}
                    </span>
                  </td>
                  <td className="p-6 font-mono text-gray-300" dir="ltr">{admin.username}</td>
                  <td className="p-6">
                    <span className="font-mono text-gray-500 tracking-widest blur-[3px] group-hover:blur-none transition-all selection:bg-gold selection:text-navy cursor-pointer">
                      {admin.password}
                    </span>
                  </td>
                  <td className="p-6 font-bold flex justify-end gap-3">
                    <button onClick={() => handleOpenModal(admin)} className="bg-white/5 hover:bg-gold hover:text-navy text-white px-4 py-2 rounded-xl transition-all border border-white/5 text-[10px]">تعديل ✏️</button>
                    <button onClick={() => handleDelete(admin.id, admin.role)} className="bg-danger/10 hover:bg-danger text-danger hover:text-white px-4 py-2 rounded-xl transition-all border border-danger/20 text-[10px]">حذف ✖</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0a0f1e] border border-white/10 w-full max-w-lg rounded-[30px] shadow-2xl p-8 space-y-6 animate-scale-in" dir="rtl">
            <h2 className="text-xl font-black text-white">{editingAdmin ? 'تعديل بيانات وإذن المدير' : 'إضافة حساب إداري جديد'}</h2>
            
            {errorMsg && <div className="text-danger bg-danger/10 text-xs font-bold p-3 rounded-lg border border-danger/20">{errorMsg}</div>}
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold mb-2 block">الاسم كامل (يظهر في اللوحة)</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-gold outline-none" placeholder="مثال: أحمد محمد" />
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 font-bold mb-2 block">اسم المستخدم (Login User)</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-gold outline-none" dir="ltr" placeholder="ahmed123" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 font-bold mb-2 block">الرقم السري (Password)</label>
                  <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-gold outline-none" dir="ltr" placeholder="***" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gold font-bold mb-2 block uppercase tracking-widest">نوع الصلاحيات (Role Level)</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-[#060b18] border border-gold/30 text-white rounded-xl px-4 py-3 outline-none focus:border-gold cursor-pointer text-sm font-bold">
                  <option value="Super Admin">مدير عام (وصول تام لكل شيء)</option>
                  <option value="مدير الحجوزات">مدير حجوزات (لا يمكنه تعديل الوحدات أو التقارير)</option>
                  <option value="مدير الوحدات">مدير وحدات (لا يمكنه رؤية الحجوزات والتقارير)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button onClick={handleSave} className="flex-1 bg-gold text-navy font-black py-3 px-6 rounded-xl hover:scale-105 transition-transform text-sm">حفظ الحساب ✅</button>
              <button onClick={() => setIsModalOpen(false)} className="bg-white/5 text-gray-300 font-black py-3 px-6 rounded-xl hover:bg-white/10 transition-colors text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
