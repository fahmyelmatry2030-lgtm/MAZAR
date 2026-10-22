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
    try {
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
        setErrorMsg('حدث خطأ أثناء حفظ البيانات. تأكد من إعدادات قاعدة البيانات.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('خطأ في النظام أثناء الحفظ.');
    } finally {
      setIsLoading(false);
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
    return <div className="p-8 text-center text-[#7A7061] font-black uppercase tracking-widest animate-pulse">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in relative z-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black mb-2 text-[#2A2723]">فريق <span className="text-[#C1A68D]">الإدارة</span></h1>
          <p className="text-[#7A7061] font-bold opacity-70 text-sm">أضف حسابات فرعية، وتحكم في صلاحيات الوصول لضمان أمان النظام.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[#2A2723] text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-black/10 hover:scale-105 transition-all text-sm flex items-center gap-2"
        >
          <span>➕</span> إضافة مدير جديد
        </button>
      </header>

      <div className="bg-white border border-[#EAE4D9]/50 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-[#FDFBF7] text-[#7A7061] font-black uppercase tracking-wider text-[10px] border-b border-[#EAE4D9]/50">
                <th className="p-8">الاسم والصلاحية</th>
                <th className="p-8 text-center">اسم المستخدم (User)</th>
                <th className="p-8 text-center">الرقم السري (Pass)</th>
                <th className="p-8 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE4D9]/30 text-[#2A2723]">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-[#FDFBF7]/50 transition-colors group">
                  <td className="p-8">
                    <div className="font-black text-lg mb-1.5">{admin.name}</div>
                    <span className={`text-[10px] px-3.5 py-1.5 rounded-full font-black border ${
                      admin.role === 'Super Admin' ? 'bg-[#C1A68D]/10 text-[#C1A68D] border-[#C1A68D]/20' : 
                      admin.role === 'مدير الوحدات' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                      admin.role === 'Mohsen' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      admin.role === 'Aura' || admin.role === 'Partner' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      'bg-green-50 text-green-600 border-green-100'
                    }`}>
                      {admin.role === 'Mohsen' ? 'شريك مزار 1 و 2 (محسن)' : admin.role === 'Aura' || admin.role === 'Partner' ? 'شريك مزار 3' : admin.role}
                    </span>
                  </td>
                  <td className="p-8 font-mono text-[#7A7061] text-center" dir="ltr">{admin.username}</td>
                  <td className="p-8 text-center">
                    <span className="font-mono text-[#7A7061] tracking-widest blur-[4px] group-hover:blur-none transition-all selection:bg-[#C1A68D] selection:text-white cursor-pointer opacity-40 group-hover:opacity-100">
                      {admin.password}
                    </span>
                  </td>
                  <td className="p-8 font-black flex justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(admin)} className="bg-[#FDFBF7] hover:bg-[#C1A68D] hover:text-white text-[#2A2723] px-5 py-2.5 rounded-xl transition-all border border-[#EAE4D9] text-[10px]">تعديل ✏️</button>
                    <button onClick={() => handleDelete(admin.id, admin.role)} className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-5 py-2.5 rounded-xl transition-all border border-red-100 text-[10px]">حذف ✖</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-[#FDFBF7] border border-[#EAE4D9] w-full max-w-lg rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.1)] p-10 md:p-12 space-y-8 animate-scale-in" dir="rtl">
            <h2 className="text-2xl font-black text-[#2A2723]">{editingAdmin ? 'تعديل بيانات وإذن المدير' : 'إضافة حساب إداري جديد'}</h2>
            
            {errorMsg && <div className="text-red-600 bg-red-50 text-xs font-bold p-4 rounded-2xl border border-red-100">{errorMsg}</div>}
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] text-[#7A7061] font-black mb-3 block uppercase tracking-widest px-2 opacity-60">الاسم كامل (يظهر في اللوحة)</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-5 py-4 text-sm text-[#2A2723] font-black focus:border-[#C1A68D] outline-none shadow-sm" placeholder="مثال: أحمد محمد" />
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] text-[#7A7061] font-black mb-3 block uppercase tracking-widest px-2 opacity-60">User Login</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-5 py-4 text-sm text-[#2A2723] font-black focus:border-[#C1A68D] outline-none shadow-sm" dir="ltr" placeholder="ahmed123" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-[#7A7061] font-black mb-3 block uppercase tracking-widest px-2 opacity-60">Password</label>
                  <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-5 py-4 text-sm text-[#2A2723] font-black focus:border-[#C1A68D] outline-none shadow-sm" dir="ltr" placeholder="***" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#C1A68D] font-black mb-3 block uppercase tracking-widest px-2 leading-relaxed">نوع الصلاحيات (Role Level)</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-white border border-[#C1A68D]/40 text-[#2A2723] rounded-2xl px-5 py-4 outline-none focus:border-[#C1A68D] cursor-pointer text-sm font-black shadow-sm">
                  <option value="Super Admin">مدير عام (وصول تام لكل شيء)</option>
                  <option value="مدير الحجوزات">مدير حجوزات (لا يمكنه تعديل الوحدات أو التقارير)</option>
                  <option value="مدير الوحدات">مدير وحدات (لا يمكنه رؤية الحجوزات والتقارير)</option>
                  <option value="Mohsen">شريك مزار 1 و 2 (حساب محسن - مزار 1 و 2 فقط)</option>
                  <option value="Aura">شريك مزار 3 (حساب Aura - رؤية مزار 3 فقط)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-[#EAE4D9]/50">
              <button onClick={handleSave} className="flex-[2] bg-[#C1A68D] text-white font-black py-4.5 px-6 rounded-2xl hover:bg-[#D5C5B3] transition-all text-sm shadow-xl shadow-[#C1A68D]/20 active:scale-95">حفظ الحساب ✅</button>
              <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white border border-[#EAE4D9] text-[#7A7061] font-black py-4.5 px-6 rounded-2xl hover:bg-[#FDFBF7] transition-all text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
