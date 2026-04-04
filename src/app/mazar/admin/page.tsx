'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBookings, getSystemUnits, updateBookingStatus, updateUnitDetails, initializeData } from '@/lib/data-init';

export default function MazarAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentRole, setCurrentRole] = useState('admin'); // 'admin' | 'receptionist' | 'housekeeping'
  const [showSecurityAlert, setShowSecurityAlert] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDailyBrief, setShowDailyBrief] = useState(true);

  // Persistence States
  const [bookings, setBookings] = useState<any[]>([]);
  const [studiosData, setStudiosData] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [editingStudio, setEditingStudio] = useState<any>(null);

  // Role Permissions
  const rolePermissions: Record<string, string[]> = {
    admin: ['overview', 'bookings', 'studios', 'users', 'reports'],
    receptionist: ['bookings', 'studios'],
    housekeeping: ['studios'],
  };

  // Initialize and Sync Data
  useEffect(() => {
    initializeData();
    const loadData = async () => {
      const bData = await getBookings();
      const sData = await getSystemUnits();
      setBookings(bData);
      setStudiosData(sData);
    };
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const handleRoleChange = (role: string) => {
    setCurrentRole(role);
    if (!rolePermissions[role].includes(activeTab)) {
      setActiveTab(rolePermissions[role][0]);
    }
    if (role === 'admin') {
      setShowSecurityAlert(true);
      setTimeout(() => setShowSecurityAlert(false), 5000);
    }
  };

  // Derived Data
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const tomorrowArrivals = bookings.filter(b => b.checkIn === tomorrowStr && b.status === 'مؤكد');
  const tomorrowDepartures = bookings.filter(b => b.checkOut === tomorrowStr && b.status === 'مؤكد');

  const activityLogs = bookings.slice(0, 5).map(b => ({
    id: b.id,
    type: 'booking',
    text: `طلب حجز جديد من (${b.guest})`,
    time: new Date(b.timestamp).toLocaleTimeString('ar-EG'),
    icon: '📩'
  }));

  const usersData = [
    { name: 'مدير النظام', role: 'Super Admin', email: 'admin@mazar.com', lastActive: 'الآن' },
    { name: 'موظف الاستقبال', role: 'Receptionist', email: 'frontdesk@mazar.com', lastActive: 'منذ ساعتين' },
    { name: 'مسؤول النظافة', role: 'Housekeeping', email: 'cleaning@mazar.com', lastActive: 'منذ 5 ساعات' },
  ];

  // ===== WHATSAPP ADMIN NUMBER (change this to the real admin number) =====
  const ADMIN_WHATSAPP = '201000000000'; // رقم واتساب المدير (بدون +)

  const sendWhatsAppToClient = (phone: string, message: string) => {
    // Clean phone number
    const cleanPhone = phone.replace(/[\s+\-()]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const sendWhatsAppToAdmin = (message: string) => {
    const url = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleApprove = async (id: string, studioType: string, finalPrice: string) => {
    await updateBookingStatus(id, { status: 'مؤكد', studio: studioType, amount: finalPrice });
    const bData = await getBookings();
    setBookings(bData);
    
    if (selectedBooking) {
      const msg = `مرحباً ${selectedBooking.guest} 👋\n\nنُسعدنا ببشارتك بأنه تم الموافقة المبدئية على حجزك في *مزار للاستوديوهات الفندقية* 🏨\n\n📋 *تفاصيل حجزك:*\n• الوحدة: ${studioType}\n• الفترة: ${selectedBooking.dates}\n• المبلغ الإجمالي: *${finalPrice}*\n\n💳 *لتأكيد الحجز النهائي:*\nيرجى تحويل المبلغ عبر:\n• انستاباي: mazar@instapay\n• فودافون كاش: 01000000000\n\nبعد التحويل أرسل صورة الإيصال لتفعيل حجزك فورًا ✅\n\n_مزار - تجربة إقامة مختلفة_`;
      sendWhatsAppToClient(selectedBooking.phone, msg);
    }
    
    setSelectedBooking(null);
  };

  const handleReject = async (id: string) => {
    await updateBookingStatus(id, { status: 'مرفوض' });
    const bData = await getBookings();
    setBookings(bData);
    
    if (selectedBooking) {
      const msg = `مرحباً ${selectedBooking.guest} 👋\n\nنأسف لإبلاغك أنه لم يتمكن النظام من تأكيد طلب حجزك للفترة ${selectedBooking.dates} في الوقت الحالي.\n\nيمكنك اختيار تواريخ أخرى أو التواصل معنا مباشرة لمساعدتك في إيجاد بديل مناسب.\n\n_فريق مزار_ 🏨`;
      sendWhatsAppToClient(selectedBooking.phone, msg);
    }
    
    setSelectedBooking(null);
  };

  // Filter sidebar items
  const sidebarItems = [
    { id: 'overview', icon: '📊', label: 'الرئيسية' },
    { id: 'bookings', icon: '📅', label: 'إدارة الحجوزات', counter: bookings.filter(b => b.status === 'رد جديد').length },
    { id: 'studios', icon: '🏨', label: 'حالة الاستوديوهات' },
    { id: 'notifications', icon: '🔔', label: 'سجل التنبيهات' }, // Requirement Added
    { id: 'users', icon: '👥', label: 'المستخدمين والصلاحيات' },
    { id: 'reports', icon: '📈', label: 'التقارير' },
  ].filter(item => rolePermissions[currentRole].includes(item.id));

  return (
    <div dir="rtl" className="flex h-screen bg-[#F7F5F0] text-[#3E3A35] font-sans selection:bg-[#B5A898] selection:text-white overflow-hidden" style={{ fontFamily: 'Calibri, sans-serif' }}>
      
      {/* Mobile Burger Menu */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#2A2723] text-white rounded-full shadow-2xl z-[60] flex items-center justify-center md:hidden border-4 border-white"
      >
        {isSidebarOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar - Responsive */}
      <aside className={`fixed inset-y-0 right-0 z-[55] w-64 bg-[#2A2723] text-white flex flex-col shrink-0 transition-transform duration-300 md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-20 flex items-center px-6 border-b border-white/10 shrink-0">
          <span className="text-2xl font-bold tracking-tight">مزار <span className="text-sm font-normal text-[#B5A898]">لإدارة الأملاك</span></span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2 relative overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-[#EAE4D9]/20 text-[#F7F5F0] font-bold border-r-4 border-[#B5A898]' 
                  : 'text-[#B5A898] hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                 <span className="text-lg">{item.icon}</span>
                 <span className="text-sm">{item.label}</span>
              </div>
              {item.counter !== undefined && item.counter > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{item.counter}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0">
          <Link href="/mazar" className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors text-[#B5A898]">
            <span>🌐</span> عرض الموقع
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col relative w-full">
        {/* Daily Brief Modal (Automated Notification) */}
        {showDailyBrief && (
           <div className="fixed inset-0 bg-[#2A2723]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl w-full max-w-lg border border-[#EAE4D9] relative animate-in zoom-in-95 duration-300">
                 <div className="w-16 h-16 bg-[#F7F5F0] rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">📅</div>
                 <h2 className="text-xl font-bold text-[#2A2723] text-center mb-2">موجز العمليات - {new Date().toLocaleDateString('ar-EG')}</h2>
                 <p className="text-center text-[#5C554B] text-sm mb-8">إليك أهم الأحداث المطلوبة لليوم حسب النظام:</p>
                 
                 <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                       <span className="text-2xl">📥</span>
                       <div>
                          <p className="font-bold text-blue-900 text-sm">عمليات وصول اليوم (2 شقق)</p>
                          <p className="text-[10px] text-blue-800">تأكد من تسليم المفاتيح الإلكترونية للضيوف.</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                       <span className="text-2xl">🧹</span>
                       <div>
                          <p className="font-bold text-orange-900 text-sm">عمليات مغادرة (1 شقة)</p>
                          <p className="text-[10px] text-orange-800">رقم 102 - يغادر الساعة 12:00 ظهراً.</p>
                       </div>
                    </div>
                 </div>

                 <button 
                  onClick={() => setShowDailyBrief(false)} 
                  className="w-full py-4 bg-[#2A2723] text-white rounded-2xl font-bold shadow-lg hover:bg-[#3E3A35] transition-all"
                 >
                    حسناً، بدأت العمل
                 </button>
              </div>
           </div>
        )}

        <header className="h-20 bg-white border-b border-[#EAE4D9] flex items-center justify-between px-4 md:px-8 sticky top-0 z-50 shrink-0">
          <div className="flex items-center gap-4 md:gap-6">
            <h1 className="text-sm md:text-xl font-bold text-[#2A2723] truncate max-w-[120px] md:max-w-none">
              {activeTab === 'overview' && 'الرئيسية'}
              {activeTab === 'bookings' && 'الحجوزات'}
              {activeTab === 'studios' && 'الاستوديوهات'}
              {activeTab === 'users' && 'الفريق'}
              {activeTab === 'reports' && 'التقارير'}
            </h1>
            
            {/* View Mode Switcher */}
            <div className="flex bg-[#F7F5F0] p-0.5 md:p-1 rounded-lg border border-[#EAE4D9]">
              {[
                { id: 'admin', label: 'مدير' },
                { id: 'receptionist', label: 'موظف' },
                { id: 'housekeeping', label: 'نظافة' },
              ].map(role => (
                <button
                  key={role.id}
                  onClick={() => handleRoleChange(role.id)}
                  className={`px-2 md:px-3 py-1 rounded text-[10px] md:text-xs font-bold transition-all ${currentRole === role.id ? 'bg-white shadow-sm text-[#2A2723]' : 'text-[#7A7061] hover:text-[#2A2723]'}`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button className="relative p-2 text-[#5C554B] hover:bg-[#F7F5F0] rounded-full transition-colors flex md:hidden items-center justify-center">
              👤
            </button>
            <button className="relative p-2 text-[#5C554B] hover:bg-[#F7F5F0] rounded-full transition-colors hidden md:block">
              🔔
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">{bookings.filter(b => b.status === 'رد جديد').length}</span>
            </button>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#EAE4D9] flex items-center justify-center text-[#2A2723] font-bold text-xs md:text-sm">
              {currentRole[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="p-8">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Check-in / Checkout Alerts container */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-white border-r-4 border-blue-500 p-4 rounded-xl shadow-sm flex justify-between items-center">
                    <div>
                       <h3 className="font-bold text-[#2A2723] mb-1">تسجيل الدخول غداً (Check-in)</h3>
                       <p className="text-sm text-[#5C554B]">تجهيز مفاتيح وتسجيل بيانات</p>
                    </div>
                    <div className="text-2xl font-bold text-blue-500">2 شقق</div>
                 </div>
                 <div className="bg-white border-r-4 border-orange-500 p-4 rounded-xl shadow-sm flex justify-between items-center">
                    <div>
                       <h3 className="font-bold text-[#2A2723] mb-1">تسجيل الخروج غداً (Check-out)</h3>
                       <p className="text-sm text-[#5C554B]">جدولة نظافة بعد الخروج (12 ظهراً)</p>
                    </div>
                    <div className="text-2xl font-bold text-orange-500">1 شقة</div>
                 </div>
              </div>

              {/* NEW: Tomorrow's Schedule Section (Requirement 4) */}
                <div className="bg-white rounded-3xl p-8 border border-[#EAE4D9] shadow-sm mb-8">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-[#2A2723]">جدول المواعيد لغداً (Check-in / Out)</h3>
                      <span className="text-xs font-bold text-[#C1A68D] bg-[#F7F5F0] px-3 py-1 rounded-full">{new Date(Date.now() + 86400000).toLocaleDateString('ar-EG')}</span>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Arrivals */}
                      <div>
                         <h4 className="text-sm font-bold text-green-600 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            وصول (Check-in)
                         </h4>
                         <div className="space-y-4">
                            {tomorrowArrivals.map((arrival, idx) => (
                               <div key={idx} className="flex justify-between items-center p-4 bg-[#F7F5F0] rounded-2xl border border-[#EAE4D9]">
                                  <div>
                                     <div className="font-bold text-[#2A2723]">{arrival.name}</div>
                                     <div className="text-[10px] text-[#5C554B]">استوديو {arrival.studio}</div>
                                  </div>
                                  <div className="text-xs font-bold text-[#2A2723]">{arrival.time}</div>
                               </div>
                            ))}
                         </div>
                      </div>

                      {/* Departures */}
                      <div>
                         <h4 className="text-sm font-bold text-red-600 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            مغادرة (Check-out)
                         </h4>
                         <div className="space-y-4">
                            {tomorrowDepartures.map((departure, idx) => (
                               <div key={idx} className="flex justify-between items-center p-4 bg-[#F7F5F0] rounded-2xl border border-[#EAE4D9]">
                                  <div>
                                     <div className="font-bold text-[#2A2723]">{departure.name}</div>
                                     <div className="text-[10px] text-[#5C554B]">استوديو {departure.studio}</div>
                                  </div>
                                  <div className="text-xs font-bold text-[#2A2723]">{departure.time}</div>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>

              {/* Financial Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[
                  { title: 'إجمالي الإيرادات', value: '142,500 ج.م', ind: '+15%', up: true },
                  { title: 'نسبة الإشغال', value: '85%', ind: '+5%', up: true },
                  { title: 'طلبات جديدة', value: bookings.filter(b => b.status === 'رد جديد').length.toString(), ind: 'من الموقع', up: true },
                  { title: 'شقق قيد النظافة', value: '2', ind: 'يحتاج متابعة', up: false },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-[#EAE4D9]">
                    <div className="text-sm font-semibold text-[#5C554B] mb-2">{stat.title}</div>
                    <div className="text-3xl font-bold text-[#2A2723] mb-4">{stat.value}</div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${stat.up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {stat.ind}
                    </span>
                  </div>
                ))}
              </div>

              {/* Recent Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#EAE4D9] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#EAE4D9] flex justify-between items-center bg-[#F7F5F0]/50">
                  <h2 className="font-bold text-[#2A2723]">آخر الطلبات والحجوزات</h2>
                  <button onClick={() => setActiveTab('bookings')} className="text-sm text-[#5C554B] hover:underline font-bold">عرض الكل</button>
                </div>
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-[#EAE4D9] text-xs font-bold text-[#5C554B]">
                      <th className="px-6 py-4">رقم #</th>
                      <th className="px-6 py-4">الضيف</th>
                      <th className="px-6 py-4">التاريخ</th>
                      <th className="px-6 py-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.slice(0, 3).map((b, i) => (
                      <tr key={i} className="border-b border-[#EAE4D9] last:border-0 hover:bg-[#F7F5F0]/50 text-sm">
                        <td className="px-6 py-4 font-bold text-[#2A2723]">{b.id}</td>
                        <td className="px-6 py-4 text-[#5C554B]">{b.guest}</td>
                        <td className="px-6 py-4 text-[#5C554B]">{b.dates}</td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-md text-xs font-bold
                            ${b.status === 'رد جديد' ? 'bg-blue-100 text-blue-700 animate-pulse' : ''}
                            ${b.status === 'مؤكد' ? 'bg-green-100 text-green-700' : ''}
                            ${b.status === 'بانتظار التحويل' ? 'bg-yellow-100 text-yellow-700' : ''}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: BOOKINGS & APPROVAL FLOW */}
          {activeTab === 'bookings' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-[#EAE4D9]">
                <input type="text" placeholder="ابحث برقم الحجز أو اسم الضيف..." className="w-96 px-4 py-2 bg-[#F7F5F0] border-0 rounded-lg text-sm focus:ring-2 focus:ring-[#B5A898] outline-none" />
                <button className="bg-[#5C554B] text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#3E3A35]">
                  + إضافة حجز يدوي
                </button>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-[#EAE4D9] overflow-hidden">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-[#F7F5F0]/80 border-b border-[#EAE4D9] text-xs font-bold text-[#5C554B]">
                      <th className="px-6 py-4">رقم #</th>
                      <th className="px-6 py-4">صاحب الحجز</th>
                      <th className="px-6 py-4">الفئة</th>
                      <th className="px-6 py-4">فترة الإقامة</th>
                      <th className="px-6 py-4">الحالة</th>
                      <th className="px-6 py-4 text-left">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b, i) => (
                      <tr key={i} className={`border-b border-[#EAE4D9] hover:bg-[#F7F5F0]/50 text-sm text-[#2A2723] ${b.status === 'رد جديد' ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-6 py-4 font-bold">{b.id}</td>
                        <td className="px-6 py-4">
                           {b.guest} <br />
                           <span className="text-xs text-[#5C554B]">{b.phone}</span>
                        </td>
                        <td className="px-6 py-4 text-[#5C554B]">{b.studio}</td>
                        <td className="px-6 py-4 text-[#5C554B]">{b.dates}</td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-1 rounded-md text-xs font-bold
                            ${b.status === 'رد جديد' ? 'bg-blue-100 text-blue-700' : ''}
                            ${b.status === 'مؤكد' || b.status === 'مكتمل' ? 'bg-green-100 text-green-700' : ''}
                            ${b.status === 'مرفوض' || b.status === 'ملغي' ? 'bg-red-100 text-red-700' : ''}
                            ${b.status === 'بانتظار التحويل' ? 'bg-yellow-100 text-yellow-700' : ''}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-left">
                           {b.status === 'رد جديد' ? (
                              <button onClick={() => setSelectedBooking(b)} className="bg-[#2A2723] text-white px-4 py-1.5 rounded-md text-xs font-bold hover:bg-[#3E3A35] transition-colors">مراجعة والرد</button>
                           ) : (
                              <button className="text-sm font-bold text-[#B5A898] hover:text-[#5C554B] underline">عرض التفاصيل</button>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Approval Modal */}
              {selectedBooking && (
                 <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-8 border border-[#EAE4D9] shadow-2xl w-full max-w-2xl relative">
                       <button onClick={() => setSelectedBooking(null)} className="absolute top-6 left-6 text-[#5C554B] hover:text-red-500 font-bold">✕</button>
                       
                       <h2 className="text-2xl font-bold text-[#2A2723] mb-6 border-b border-[#EAE4D9] pb-4">مراجعة طلب الحجز {selectedBooking.id}</h2>
                       
                       <div className="grid grid-cols-2 gap-6 mb-8">
                          <div>
                             <p className="text-sm text-[#7A7061] mb-1">اسم الضيف</p>
                             <p className="font-bold text-[#2A2723]">{selectedBooking.guest}</p>
                          </div>
                          <div>
                             <p className="text-sm text-[#7A7061] mb-1">رقم الواتساب</p>
                             <p className="font-bold text-[#2A2723]" dir="ltr">{selectedBooking.phone}</p>
                          </div>
                          <div className="col-span-2">
                             <p className="text-sm text-[#7A7061] mb-1">تواريخ الإقامة المطلوبة</p>
                             <p className="font-bold text-blue-600">{selectedBooking.dates}</p>
                          </div>
                       </div>

                       <div className="bg-[#F7F5F0] p-6 rounded-2xl mb-8 border border-[#EAE4D9]">
                          <h3 className="font-bold text-[#2A2723] mb-4">تسكين الضيف والرد السريع</h3>
                          
                          <div className="space-y-4">
                             <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#5C554B]">اختر الاستوديو المتاح</label>
                                <select id="studio-select" className="w-full bg-white border border-[#EAE4D9] rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#B5A898] outline-none">
                                   <option value="ستوديو A (ديلوكس)">ستوديو A (ديلوكس)</option>
                                   <option value="ستوديو D (ديلوكس)">ستوديو D (ديلوكس)</option>
                                </select>
                             </div>
                             
                             <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-[#5C554B]">المبلغ الإجمالي ووسيلة الدفع المطلوبة</label>
                                <input id="price-input" type="text" defaultValue="3,000 ج.م" className="w-full bg-white border border-[#EAE4D9] rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#B5A898] outline-none" />
                             </div>
                          </div>

                          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                             <p className="text-xs text-yellow-800 font-bold mb-2">سيتم إرسال هذه الرسالة للعميل عبر الواتساب الآلي:</p>
                             <p className="text-sm text-yellow-900 leading-relaxed">
                                "مرحباً {selectedBooking.guest}، تم الموافقة المبدئية على حجزك في مزار للفترة {selectedBooking.dates} بقيمة إجمالية (3,000 ج.م). لتأكيد الحجز النهائي يرجى تحويل المبلغ عبر انستاباي إلى (mazar@instapay) أو فودافون كاش (01000000000)."
                             </p>
                          </div>
                       </div>

                       <div className="flex justify-end gap-4">
                          <button onClick={() => handleReject(selectedBooking.id)} className="px-6 py-2 rounded-lg text-red-600 font-bold hover:bg-red-50 transition-colors">رفض الطلب</button>
                          <button 
                             onClick={async () => {
                                const select = document.getElementById('studio-select') as HTMLSelectElement;
                                const priceInput = document.getElementById('price-input') as HTMLInputElement;
                                handleApprove(selectedBooking.id, select?.value || 'محدد', priceInput?.value || 'محسوب');
                             }} 
                             className="bg-green-600 text-white px-8 py-2 rounded-lg font-bold shadow-md hover:bg-green-700 transition-colors"
                          >
                             موافقة مبدئية وإرسال طلب الدفع
                          </button>
                       </div>
                    </div>
                 </div>
              )}
            </div>
          )}

          {/* TAB: STUDIOS */}
          {activeTab === 'studios' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {studiosData.map((s, i) => (
                 <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-[#EAE4D9] flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                       <div>
                          <div className="text-2xl font-bold text-[#2A2723] mb-1">ستوديو {s.id}</div>
                          <div className="text-sm font-bold text-[#B5A898]">{s.type}</div>
                       </div>
                       <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${s.status === 'متاح' ? 'bg-green-500 text-white' : s.status === 'مشغول' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>
                         {s.status}
                       </span>
                    </div>
                    
                    <div className="space-y-3 mb-6 flex-1">
                       <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                          <span className="text-[#5C554B]">حالة النظافة:</span>
                          <span className={`font-bold ${s.housekeeping === 'بحاجة للنظافة' ? 'text-orange-500' : 'text-[#2A2723]'}`}>{s.housekeeping}</span>
                       </div>
                       <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                          <span className="text-[#5C554B]">الحجز القادم:</span>
                          <span className="font-bold text-[#2A2723]">{s.nextBooking}</span>
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-auto">
                       <button onClick={() => setEditingStudio(s)} className="bg-[#EAE4D9] hover:bg-[#B5A898] hover:text-white transition-colors py-2 rounded-lg text-xs font-bold text-[#5C554B]">
                          تعديل البيانات
                       </button>
                       <button className="bg-[#5C554B] hover:bg-[#2A2723] transition-colors py-2 rounded-lg text-xs font-bold text-white">
                          تغيير الحالة
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          )}

          {/* EDIT STUDIO MODAL */}
          {editingStudio && (
            <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6 z-[100] animate-in fade-in">
               <div className="bg-white rounded-3xl p-8 border border-[#EAE4D9] shadow-2xl w-full max-w-xl relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setEditingStudio(null)} className="absolute top-6 left-6 text-[#5C554B] hover:text-red-500 font-bold">✕</button>
                  
                  <h2 className="text-2xl font-bold text-[#2A2723] mb-6 border-b border-[#EAE4D9] pb-4">تعديل بيانات {editingStudio.title?.ar || editingStudio.id}</h2>
                  
                  <div className="space-y-4">
                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-[#5C554B]">اسم الوحدة (عربي)</label>
                        <input id="edit-title-ar" type="text" defaultValue={editingStudio.title?.ar} className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#B5A898] outline-none" />
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-[#5C554B]">وصف الوحدة (عربي)</label>
                        <textarea id="edit-desc-ar" defaultValue={editingStudio.description?.ar} rows={3} className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#B5A898] outline-none" />
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-[#5C554B]">حالة الوحدة</label>
                        <select id="edit-status" defaultValue={editingStudio.status} className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#B5A898] outline-none">
                           <option value="متاح">متاح (Available)</option>
                           <option value="مشغول">مشغول (Booked)</option>
                           <option value="صيانة">صيانة (Maintenance)</option>
                        </select>
                     </div>
                     <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-[#5C554B]">السعر أو ملاحظات أخرى</label>
                        <input id="edit-price" type="text" defaultValue={editingStudio.price || ''} placeholder="مثال: 3000 ج.م" className="w-full bg-[#F7F5F0] border border-[#EAE4D9] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#B5A898] outline-none" />
                     </div>
                  </div>

                  <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-[#EAE4D9]">
                     <button onClick={() => setEditingStudio(null)} className="px-6 py-2 rounded-lg text-[#5C554B] font-bold hover:bg-[#F7F5F0] transition-colors">إلغاء</button>
                     <button 
                        onClick={async () => {
                           const newTitleAr = (document.getElementById('edit-title-ar') as HTMLInputElement).value;
                           const newDescAr = (document.getElementById('edit-desc-ar') as HTMLTextAreaElement).value;
                           const newStatus = (document.getElementById('edit-status') as HTMLSelectElement).value;
                           const newPrice = (document.getElementById('edit-price') as HTMLInputElement).value;
                           
                           await updateUnitDetails(editingStudio.id, {
                              title: { ...editingStudio.title, ar: newTitleAr },
                              description: { ...editingStudio.description, ar: newDescAr },
                              status: newStatus,
                              price: newPrice
                           });
                           
                           const sData = await getSystemUnits();
                           setStudiosData(sData);
                           setEditingStudio(null);
                        }} 
                        className="bg-[#2A2723] text-white px-8 py-2 rounded-lg font-bold shadow-md hover:bg-[#3E3A35] transition-colors"
                     >
                        حفظ التعديلات
                     </button>
                  </div>
               </div>
            </div>
          )}

           {/* TAB: NOTIFICATIONS LOG (Requirement 5) */}
           {activeTab === 'notifications' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-2xl font-bold text-[#2A2723]">سجل التنبيهات والنشاطات</h2>
                   <button className="text-sm font-bold text-[#C1A68D] hover:underline">تحديد الكل كمقروء</button>
                </div>
                
                <div className="bg-white rounded-3xl border border-[#EAE4D9] overflow-hidden shadow-sm">
                   {activityLogs.map((log, i) => (
                      <div key={log.id} className={`p-6 flex items-start gap-4 hover:bg-[#F7F5F0]/50 transition-colors border-b border-[#EAE4D9] last:border-0 ${i === 0 ? 'bg-blue-50/30' : ''}`}>
                         <div className="w-12 h-12 rounded-full bg-white border border-[#EAE4D9] flex items-center justify-center text-xl shadow-sm">
                            {log.icon}
                         </div>
                         <div className="flex-1">
                            <div className="flex justify-between mb-1">
                               <span className="font-bold text-[#2A2723]">{log.text}</span>
                               <span className="text-[10px] text-[#7A7061]">{log.time}</span>
                            </div>
                            <div className="text-xs text-[#5C554B]">تلقائي عبر النظام • الواتساب مرتبط</div>
                         </div>
                         <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 opacity-0 group-hover:opacity-100"></div>
                      </div>
                   ))}
                </div>

                <div className="text-center py-8">
                   <button className="text-[#5C554B] text-xs font-bold hover:text-[#2A2723]">تحميل المزيد من السجلات</button>
                </div>
             </div>
           )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-end mb-4">
                 <button className="bg-[#5C554B] text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#3E3A35]">
                  + إضافة مستخدم جديد
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {usersData.map((u, i) => (
                    <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-[#EAE4D9] flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full bg-[#EAE4D9]/50 flex items-center justify-center text-xl">👤</div>
                       <div className="flex-1">
                          <div className="font-bold text-[#2A2723] text-lg">{u.name}</div>
                          <div className="text-xs font-bold text-[#B5A898] mb-1">{u.role}</div>
                          <div className="text-xs text-[#5C554B]">{u.email}</div>
                       </div>
                       <div className="text-[10px] text-green-600 bg-green-100 px-2 py-1 rounded">
                          نشط {u.lastActive}
                       </div>
                    </div>
                 ))}
              </div>
            </div>
          )}
          
          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h2 className="text-2xl font-bold text-[#2A2723] mb-6">التقارير المالية والتشغيلية</h2>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-2xl border border-[#EAE4D9] shadow-sm">
                     <p className="text-[#5C554B] text-sm font-bold mb-2">إجمالي الشقق المحجوزة (هذا الشهر)</p>
                     <p className="text-3xl font-bold text-blue-600">42 إقامة</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-[#EAE4D9] shadow-sm">
                     <p className="text-[#5C554B] text-sm font-bold mb-2">قيمة المدفوعات المستلمة</p>
                     <p className="text-3xl font-bold text-green-600">142,500 ج.م</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-[#EAE4D9] shadow-sm">
                     <p className="text-[#5C554B] text-sm font-bold mb-2">تم الحجز عن طريق</p>
                     <p className="text-lg font-bold text-[#2A2723]">70% الموقع الإلكتروني</p>
                     <p className="text-lg font-bold text-[#2A2723]">30% حجوزات يدوية (واتساب)</p>
                  </div>
               </div>

               <div className="bg-[#2A2723] text-white p-8 rounded-3xl text-center">
                  <p className="text-[#B5A898] mb-4">سيتم إتاحة تصدير التقارير كملفات Excel و PDF في التحديث القادم.</p>
                  <button className="bg-[#B5A898] text-[#2A2723] px-6 py-2 rounded-lg font-bold">توليد تقرير سريع الآن</button>
               </div>
            </div>
          )}

        </div>

        {/* Security Alert Toast */}
        {showSecurityAlert && (
           <div className="fixed bottom-8 left-8 right-8 md:left-auto md:w-96 bg-[#2A2723] text-white p-4 rounded-xl shadow-2xl border-r-4 border-red-500 animate-in slide-in-from-left duration-500 z-[100] flex items-center gap-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">🛡️</div>
              <div>
                 <div className="font-bold text-sm">تنبيه أمني: تسجيل دخول مسؤول</div>
                 <div className="text-[10px] text-[#B5A898]">تم تسجيل دخولك بصلاحية (Super Admin) في {new Date().toLocaleTimeString('ar-EG')}</div>
              </div>
           </div>
        )}
      </main>
    </div>
  );
}
