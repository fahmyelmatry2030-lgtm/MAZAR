"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getBookings } from '@/lib/data-init';
import Logo from '@/components/Logo';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSent, setShowSent] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const loadData = useCallback(async () => {
    const bookings = await getBookings();

    // Notifications logic (Daily Reminders)
    let notifs: any[] = [];

    if (typeof window !== 'undefined') {
      try {
        notifs = JSON.parse(localStorage.getItem('admin_notifs') || '[]');
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
          localStorage.setItem('admin_notifs', JSON.stringify(notifs.slice(0, 50)));
          localStorage.setItem('last_notif_check', tomorrowStr);
        }
      } catch (e) {
        console.warn('Failed to handle administrative notifications');
      }
    }

    const pendingCount = bookings.filter((b: any) => b.status === 'رد جديد' || b.status === 'pending').length;
    setPendingBookingsCount(pendingCount);
    setUnreadNotifs(notifs.filter((n: any) => !n.read).length);
    setNotifications(notifs);

    // Sent Messages Log
    const sent = bookings
      .filter((b: any) => b.paymentInfo)
      .map((b: any) => ({
        id: b.id,
        name: b.name,
        msg: b.paymentInfo,
        time: b.timestamp ? new Date(b.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '---'
      }));
    setSentMessages(sent);
  }, []);

  const [adminRole, setAdminRole] = useState('Super Admin');
  const [adminName, setAdminName] = useState('مدير النظام');

  useEffect(() => {
    const auth = sessionStorage.getItem('isAdmin');
    const info = JSON.parse(sessionStorage.getItem('adminInfo') || '{}');
    if (info?.role) setAdminRole(info.role);
    if (info?.name) setAdminName(info.name);

    if (!auth && pathname !== '/admin/login') {
      router.push('/admin/login');
    } else if (auth) {
      const isBookingsAdmin = info?.role === 'مدير الحجوزات';
      const isUnitsAdmin = info?.role === 'مدير الوحدات';
      const isAkoura = info?.role === 'Akoura' || info?.role === 'Aura';
      const isAdmin = info?.role === 'Admin';
      const isModerator = info?.role === 'Moderator';
      const isMohsen = info?.role === 'Mohsen';

      const restrictedForBookings = ['/admin/dashboard/units', '/admin/dashboard/reports', '/admin/dashboard/admins'];
      const restrictedForUnits = ['/admin/dashboard/bookings', '/admin/dashboard/reports', '/admin/dashboard/admins'];
      const restrictedForAdmin = ['/admin/dashboard/finance'];
      const moderatorAllowed = ['/admin/dashboard', '/admin/dashboard/bookings', '/admin/dashboard/units', '/admin/dashboard/custody'];
      const mohsenAllowed = ['/admin/dashboard', '/admin/dashboard/bookings', '/admin/dashboard/customers', '/admin/dashboard/finance', '/admin/dashboard/custody'];
      const restrictedForAkoura = [
        '/admin/dashboard/units',
        '/admin/dashboard/hr/staff',
        '/admin/dashboard/hr/salaries',
        '/admin/dashboard/hr/vacations',
        '/admin/dashboard/content',
        '/admin/dashboard/admins'
      ];

      if (isBookingsAdmin && restrictedForBookings.includes(pathname)) {
        router.push('/admin/dashboard/bookings');
        return;
      }

      if (isUnitsAdmin && restrictedForUnits.includes(pathname)) {
        router.push('/admin/dashboard/units');
        return;
      }

      if (isAkoura && restrictedForAkoura.includes(pathname)) {
        router.push('/admin/dashboard');
        return;
      }

      if (isAdmin && restrictedForAdmin.includes(pathname)) {
        router.push('/admin/dashboard');
        return;
      }

      if (isModerator && !moderatorAllowed.includes(pathname)) {
        router.push('/admin/dashboard/bookings');
        return;
      }

      if (isMohsen && !mohsenAllowed.includes(pathname)) {
        router.push('/admin/dashboard/bookings');
        return;
      }

      setIsAuthorized(true);
      loadData();

      // REAL-TIME NOTIFICATIONS
      const supabase = getSupabaseBrowserClient();
      let channel: any;

      if (supabase) {
        channel = supabase
          .channel('realtime_bookings')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'bookings' },
            (payload: any) => {
              console.log('New booking received!', payload);
              loadData(); // Refresh all stats

              // Play sound or show browser notification if possible
              try {
                const audio = new Audio('/notification-sound.mp3');
                audio.play().catch(() => { });
              } catch (e) { }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'bookings' },
            (payload: any) => {
              console.log('Booking updated!', payload);
              loadData();
            }
          )
          .subscribe();
      } else {
        // Fallback to polling if Supabase is offline
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
      }

      return () => {
        if (channel) channel.unsubscribe();
      };
    }
  }, [pathname, router, loadData]);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const [isNavOpen, setIsNavOpen] = useState(false);

  if (!isAuthorized && pathname !== '/admin/login') return null;
  if (pathname === '/admin/login') return <>{children}</>;

  const menuItems = [
    { name: 'الاستعراض العام', href: '/admin/dashboard', icon: '📊', roles: ['Owner', 'Admin', 'Moderator', 'Mohsen', 'Super Admin', 'مدير الحجوزات', 'مدير الوحدات', 'Akoura', 'Aura'] },
    { name: 'العهدة', href: '/admin/dashboard/custody', icon: '📦', roles: ['Owner', 'Admin', 'Moderator', 'Mohsen', 'Super Admin', 'Akoura', 'Aura'] },
    { name: 'طلبات الحجز', href: '/admin/dashboard/bookings', icon: '📩', roles: ['Owner', 'Admin', 'Moderator', 'Mohsen', 'Super Admin', 'مدير الحجوزات', 'Akoura', 'Aura'] },
    { name: 'إدارة الوحدات', href: '/admin/dashboard/units', icon: '🏢', roles: ['Owner', 'Admin', 'Moderator', 'Super Admin', 'مدير الوحدات'] },
    { name: 'قاعدة العملاء', href: '/admin/dashboard/customers', icon: '📞', roles: ['Owner', 'Admin', 'Mohsen', 'Super Admin', 'Akoura', 'Aura'] },
    { name: 'الموظفين', href: '/admin/dashboard/hr/staff', icon: '👥', roles: ['Owner', 'Admin', 'Super Admin'] },
    { name: 'إدارة المحتوى', href: '/admin/dashboard/content', icon: '📝', roles: ['Owner', 'Admin', 'Super Admin'] },
    { name: 'المصروفات', href: '/admin/dashboard/reports', icon: '💰', roles: ['Owner', 'Admin', 'Super Admin', 'Akoura', 'Aura'] },
    { name: 'الخزنة', href: '/admin/dashboard/treasury', icon: '🔐', roles: ['Owner', 'Admin'] },
    { name: 'قائمة المهام', href: '/admin/dashboard/tasks', icon: '📋', roles: ['Owner', 'Admin', 'Super Admin', 'Moderator', 'Mohsen'] },
    { name: 'كشف الحساب الشهري', href: '/admin/dashboard/finance', icon: '🏛️', roles: ['Owner', 'Mohsen', 'Super Admin', 'Akoura', 'Aura'] },
    { name: 'فريق الإدارة', href: '/admin/dashboard/admins', icon: '👥', roles: ['Owner', 'Admin', 'Super Admin'] },
  ].filter(item => item.roles.includes(adminRole as string));


  return (
    <div className="min-h-screen bg-[#FDFBF7] flex custom-scrollbar relative" dir="rtl">
      {/* Backdrop overlay when navbar menu is open */}
      {isNavOpen && (
        <div
          onClick={() => setIsNavOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-300"
          title="إغلاق القائمة"
        />
      )}

      {/* Floating Sidebar Drawer (Hidden by default, opens on ☰ click, closes on link click) */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-[280px] md:w-[320px] bg-[#FDFBF7] border-l border-[#EAE4D9] shadow-2xl transform transition-transform duration-300 ease-in-out ${
        isNavOpen ? 'translate-x-0' : 'translate-x-full'
      } flex flex-col`}>
        <div className="p-6 md:p-8 flex flex-col items-center justify-between border-b border-[#EAE4D9]/50 mb-6 gap-4">
          <div className="w-full flex justify-between items-center">
            <Link href="/admin/dashboard" onClick={() => setIsNavOpen(false)} className="transition-all hover:scale-105" title="الرئيسية للوحة التحكم">
              <Logo size={25} className="!justify-start" imageClassName="max-h-[50px]" />
            </Link>
            {/* Close button */}
            <button
              onClick={() => setIsNavOpen(false)}
              className="p-2 text-[#7A7061] hover:bg-[#EAE4D9]/50 rounded-lg transition-colors"
              title="إغلاق القائمة"
            >
              ✖️
            </button>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center w-full py-3 rounded-2xl bg-[#2A2723] text-white hover:bg-black transition-all shadow-xl shadow-black/20 active:scale-95 group border border-white/10"
            title="تحديث بيانات النظام"
          >
            <span className="text-sm group-hover:rotate-180 transition-transform duration-700 ease-in-out mb-0.5">🔄</span>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] mr-2">تحديث</span>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar pb-6">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsNavOpen(false)}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black transition-all duration-300 ${isActive
                    ? 'bg-[#2A2723] text-white shadow-xl shadow-black/10'
                    : 'text-[#7A7061] hover:text-[#2A2723] hover:bg-[#FDFBF7]'
                  }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
                {item.name === 'طلبات الحجز' && pendingBookingsCount > 0 && (
                  <span className={`mr-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${isActive ? 'bg-[#C1A68D] text-[#2A2723]' : 'bg-[#C1A68D] text-white'}`}>
                    {pendingBookingsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 md:p-8 border-t border-[#EAE4D9]/50 space-y-4 bg-white/50">
          {/* Quick Action: WhatsApp Owner */}
          <a
            href="https://api.whatsapp.com/send?phone=201026107134"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-green-500/10 text-green-600 hover:bg-green-500 hover:text-white transition-all font-black text-xs"
          >
            <span>👨‍💻</span> تواصل مع المبرمج
          </a>

          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-4 px-6 py-3 rounded-2xl bg-[#C1A68D]/10 text-[#C1A68D] hover:bg-[#C1A68D] hover:text-white transition-all font-black text-xs w-full"
            >
              <span>📲</span> تثبيت التطبيق على الهاتف
            </button>
          )}

          <button
            onClick={() => {
              sessionStorage.removeItem('isAdmin');
              router.push('/admin/login');
            }}
            className="flex items-center gap-4 text-[#7A7061] hover:text-[#E63946] transition-colors font-black text-sm w-full outline-none px-6 mt-4"
          >
            <span>🚪</span> تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content Area (Takes 100% Full Width by default) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white/60 backdrop-blur-xl border-b border-[#EAE4D9]/50 flex items-center justify-between px-6 md:px-8 gap-6 z-30 sticky top-0">
          {/* Hamburger Menu ☰ Toggle Button */}
          <button
            onClick={() => setIsNavOpen(!isNavOpen)}
            className="p-2.5 md:p-3 bg-white hover:bg-[#FDFBF7] text-[#2A2723] border border-[#EAE4D9] rounded-2xl shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer shrink-0"
            title={isNavOpen ? 'إغلاق القائمة' : 'فتح القائمة الرئيسية'}
          >
            <span className="text-xl font-bold leading-none">☰</span>
            <span className="text-xs font-black">
              {isNavOpen ? 'إغلاق' : 'القائمة'}
            </span>
          </button>

          <div className="flex items-center gap-4 md:gap-6">
            <button
              onClick={() => { setShowSent(!showSent); setShowNotifs(false); }}
              className={`p-3 rounded-xl transition-all relative ${showSent ? 'bg-[#2A2723] text-white' : 'bg-[#FDFBF7] text-[#7A7061] hover:text-[#2A2723] border border-[#EAE4D9]'}`}
              title="سجل الرسائل المرسلة"
            >
              <span className="text-xl">📧</span>
              {sentMessages.length > 0 && !showSent && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#C1A68D] border-2 border-white rounded-full" />
              )}
            </button>
            {showSent && (
              <div className="absolute top-14 left-0 w-80 bg-white border border-[#EAE4D9] rounded-2xl shadow-2xl p-5 max-h-[450px] overflow-y-auto animate-scale-in custom-scrollbar">
                <h4 className="text-xs font-black text-[#2A2723] uppercase mb-4 pb-2 border-b border-[#EAE4D9] tracking-widest">آخر الرسائل المرسلة</h4>
                <div className="space-y-4">
                  {sentMessages.map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[#FDFBF7] border border-[#EAE4D9]/50 space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-black">
                        <span className="text-[#C1A68D]">{m.name}</span>
                        <span className="text-[#7A7061] font-bold">{m.time}</span>
                      </div>
                      <p className="text-[10px] text-[#2A2723] leading-relaxed font-bold italic opacity-80 group-hover:opacity-100 transition-opacity">"{m.msg}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setShowNotifs(!showNotifs); setShowSent(false); }}
              className={`p-3 rounded-xl transition-all relative ${showNotifs ? 'bg-[#2A2723] text-white' : 'bg-[#FDFBF7] text-[#7A7061] hover:text-[#2A2723] border border-[#EAE4D9]'}`}
              title="التنبيهات"
            >
              <span className="text-xl">🔔</span>
              {unreadNotifs > 0 && !showNotifs && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#E63946] border-2 border-white rounded-full" />
              )}
            </button>
            {showNotifs && (
              <div className="absolute top-14 left-0 w-80 bg-white border border-[#EAE4D9] rounded-2xl shadow-2xl p-5 max-h-[450px] overflow-y-auto animate-scale-in custom-scrollbar">
                <h4 className="text-xs font-black text-[#2A2723] uppercase mb-4 pb-2 border-b border-[#EAE4D9] tracking-widest">التنبيهات الذكية</h4>
                <div className="space-y-3">
                  {notifications.map((n, i) => (
                    <div key={i} className="text-[10px] p-4 rounded-xl bg-[#FDFBF7] border border-[#EAE4D9]/50 leading-relaxed font-bold text-[#2A2723]">
                      {n.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-10 w-px bg-[#EAE4D9] mx-2" />
          <div className="relative">
            <button
              onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); setShowSent(false); }}
              className="flex items-center gap-3 bg-[#FDFBF7] hover:bg-[#F5F2EA] px-4 py-2 rounded-2xl transition-all outline-none border border-[#EAE4D9]"
            >
              <div className="text-right hidden sm:block">
                <div className="text-xs font-black text-[#2A2723]">{adminName}</div>
                <div className="text-[10px] text-[#C1A68D] uppercase tracking-tighter font-black">{adminRole}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C1A68D] to-[#D5C5B3] flex items-center justify-center text-white font-black shadow-lg shadow-[#C1A68D]/20">
                {adminName.substring(0, 1).toUpperCase()}
              </div>
            </button>

            {showProfile && (
              <div className="absolute top-16 left-0 w-56 bg-white border border-[#EAE4D9] rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="p-4 border-b border-[#EAE4D9]/50 bg-[#FDFBF7] text-center sm:hidden">
                  <div className="text-xs font-black text-[#2A2723]">{adminName}</div>
                  <div className="text-[10px] text-[#C1A68D] uppercase font-black">{adminRole}</div>
                </div>
                {(adminRole === 'Owner' || adminRole === 'Admin' || adminRole === 'Super Admin') && (
                  <Link
                    href="/admin/dashboard/admins"
                    onClick={() => setShowProfile(false)}
                    className="block px-5 py-3.5 text-xs font-bold text-[#2A2723] hover:bg-[#FDFBF7] hover:text-[#C1A68D] transition-colors text-right border-b border-[#EAE4D9]/50"
                  >
                    إدارة الصلاحيات (Admin Roles) ⚙️
                  </Link>
                )}
                <button
                  onClick={() => {
                    sessionStorage.removeItem('isAdmin');
                    sessionStorage.removeItem('adminInfo');
                    router.push('/admin/login');
                  }}
                  className="w-full text-right px-5 py-3.5 text-xs font-bold text-[#E63946] hover:bg-[#FDFBF7] transition-colors outline-none"
                >
                  تسجيل الخروج 🚪
                </button>
              </div>
            )}
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
