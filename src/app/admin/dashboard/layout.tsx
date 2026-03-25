"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSent, setShowSent] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const auth = sessionStorage.getItem('isAdmin');
    if (!auth && pathname !== '/admin/login') {
      router.push('/admin/login');
    } else {
      setIsAuthorized(true);
      
      // Load Data
      const bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
      let notifs = JSON.parse(localStorage.getItem('admin_notifs') || '[]');
      
      // Generate Daily Reminders logic
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const lastCheck = localStorage.getItem('last_notif_check');
      if (lastCheck !== tomorrowStr) {
        const checkIns = bookings.filter((b: any) => b.status === 'approved' && b.checkIn === tomorrowStr);
        const checkOuts = bookings.filter((b: any) => b.status === 'approved' && b.checkOut === tomorrowStr);
        
        if (checkIns.length > 0) {
          notifs.unshift({ id: Date.now(), msg: `🔔 تنبيه: غداً يوجد ${checkIns.length} عملية وصول (Check-in).`, read: false });
        }
        if (checkOuts.length > 0) {
          notifs.unshift({ id: Date.now() + 1, msg: `🔔 تنبيه: غداً يوجد ${checkOuts.length} عملية مغادرة (Check-out).`, read: false });
        }
        localStorage.setItem('admin_notifs', JSON.stringify(notifs.slice(0, 50))); // Keep last 50
        localStorage.setItem('last_notif_check', tomorrowStr);
      }

      const pendingCount = bookings.filter((b: any) => b.status === 'pending').length;
      setUnreadNotifs(pendingCount + notifs.filter((n: any) => !n.read).length);
      setNotifications(notifs);

      // Simulate Sent Messages Log
      const sent = bookings
        .filter((b: any) => b.paymentInfo)
        .map((b: any) => ({
          id: b.id,
          name: b.name,
          msg: b.paymentInfo,
          time: new Date(b.id).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        }));
      setSentMessages(sent);
    }
  }, [pathname, router]);

  if (!isAuthorized && pathname !== '/admin/login') return null;
  if (pathname === '/admin/login') return <>{children}</>;

  const menuItems = [
    { name: 'الاستعراض العام', href: '/admin/dashboard', icon: '📊' },
    { name: 'طلبات الحجز', href: '/admin/dashboard/bookings', icon: '📩' },
    { name: 'إدارة الشقق', href: '/admin/dashboard/apartments', icon: '🏢' },
    { name: 'التقارير المالي', href: '/admin/dashboard/reports', icon: '💰' },
  ];

  return (
    <div className="min-h-screen bg-[#060b18] flex flex-col md:flex-row custom-scrollbar">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-[#0a0f1e] border-l border-white/5 flex flex-col z-40">
        <div className="p-8">
          <Link href="/" className="text-2xl font-black text-gradient block mb-1">مجمع النخبة</Link>
          <span className="text-[10px] text-gold/50 font-bold uppercase tracking-wider">نظام الإدارة المتكامل</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all duration-300 ${
                  isActive 
                  ? 'bg-gold text-navy shadow-[0_4px_20px_rgba(201,168,76,0.3)]' 
                  : 'text-gray hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
                {item.name === 'طلبات الحجز' && unreadNotifs > 0 && (
                  <span className={`mr-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-navy text-gold' : 'bg-gold text-navy'}`}>
                    {unreadNotifs}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-8 border-t border-white/5">
          <button 
            onClick={() => {
              sessionStorage.removeItem('isAdmin');
              router.push('/admin/login');
            }}
            className="flex items-center gap-4 text-gray hover:text-danger transition-colors font-bold text-sm w-full outline-none"
          >
            <span>🚪</span> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header - High Visibility */}
        <header className="h-20 bg-[#0a0f1e]/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-end px-8 gap-6 z-30 sticky top-0">
          <div className="relative">
            <button 
              onClick={() => { setShowSent(!showSent); setShowNotifs(false); }}
              className={`p-3 rounded-xl transition-all relative ${showSent ? 'bg-gold text-navy' : 'bg-white/5 text-gray-400 hover:text-white'}`}
              title="سجل الرسائل المرسلة"
            >
              <span className="text-xl">📧</span>
              {sentMessages.length > 0 && !showSent && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-gold border-2 border-[#0a0f1e] rounded-full" />
              )}
            </button>
            {showSent && (
              <div className="absolute top-14 left-0 w-80 bg-[#1e293b] border border-gold/20 rounded-2xl shadow-2xl p-5 max-h-[450px] overflow-y-auto animate-scale-in custom-scrollbar">
                <h4 className="text-xs font-black text-white uppercase mb-4 pb-2 border-b border-white/10 tracking-widest">آخر الرسائل المرسلة</h4>
                <div className="space-y-4">
                  {sentMessages.map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                       <div className="flex justify-between items-center text-[10px] font-bold">
                         <span className="text-gold">{m.name}</span>
                         <span className="text-gray-500 font-normal">{m.time}</span>
                       </div>
                       <p className="text-[10px] text-gray-300 leading-relaxed font-medium">"{m.msg}"</p>
                    </div>
                  ))}
                  {sentMessages.length === 0 && <p className="text-[10px] text-gray text-center py-8">لا توجد سجلات.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button 
              onClick={() => { setShowNotifs(!showNotifs); setShowSent(false); }}
              className={`p-3 rounded-xl transition-all relative ${showNotifs ? 'bg-gold text-navy' : 'bg-white/5 text-gray-400 hover:text-white'}`}
              title="التنبيهات"
            >
              <span className="text-xl">🔔</span>
              {unreadNotifs > 0 && !showNotifs && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-danger border-2 border-[#0a0f1e] rounded-full" />
              )}
            </button>
            {showNotifs && (
              <div className="absolute top-14 left-0 w-80 bg-[#1e293b] border border-gold/20 rounded-2xl shadow-2xl p-5 max-h-[450px] overflow-y-auto animate-scale-in custom-scrollbar">
                <h4 className="text-xs font-black text-white uppercase mb-4 pb-2 border-b border-white/10 tracking-widest">التنبيهات الذكية</h4>
                <div className="space-y-3">
                  {notifications.map((n, i) => (
                    <div key={i} className="text-[10px] p-3 rounded-xl bg-white/5 border border-white/5 leading-relaxed font-bold">
                      {n.msg}
                    </div>
                  ))}
                  {notifications.length === 0 && <p className="text-[10px] text-gray text-center py-8">كل شيء تمام! لا تنبيهات.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="h-10 w-px bg-white/10 mx-2" />
          <div className="flex items-center gap-3">
             <div className="text-right">
               <div className="text-xs font-black text-white">مدير النظام</div>
               <div className="text-[10px] text-gold uppercase tracking-tighter">Luxury Admin</div>
             </div>
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-navy font-black">A</div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
