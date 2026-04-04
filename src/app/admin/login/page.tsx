"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { verifyAdminAuth } from '@/lib/actions/db';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const res = await verifyAdminAuth(username, password);

    if (res.success) {
      sessionStorage.setItem('isAdmin', 'true');
      sessionStorage.setItem('adminInfo', JSON.stringify(res.admin));
      router.push('/admin/dashboard');
    } else {
      setError('بيانات الدخول غير صحيحة');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[#0a0f1e]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gold/5 blur-[120px] rounded-full" />
      </div>

      <div className="glass-card w-full max-w-md relative z-10 p-10 border-gold/30">
        <div className="text-center mb-10">
          <Link href="/" className="text-3xl font-black text-gradient block mb-4">مزار</Link>
          <h2 className="text-xl font-bold text-gray-300">تسجيل دخول الإدارة</h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-400">اسم المستخدم</label>
              <input 
                required
                type="text" 
                placeholder="admin"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold transition-colors text-center text-white"
                value={username}
                onChange={e => setUsername(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-400">كلمة المرور</label>
              <input 
                required
                type="password" 
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-gold transition-colors text-center tracking-widest text-white"
                value={password}
                onChange={e => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger text-xs p-3 rounded-lg text-center animate-shake">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full btn-gold !py-4 flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
            ) : (
              'دخول للوحة التحكم'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[10px] text-gray uppercase tracking-widest">
          المجمع السكني الرقمي v1.0
        </div>
      </div>
    </main>
  );
}
