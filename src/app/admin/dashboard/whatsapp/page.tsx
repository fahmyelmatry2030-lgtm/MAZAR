"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEFAULT_WHATSAPP_SETTINGS } from '@/data/whatsappMessages';

export default function WhatsAppSettingsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [inactivityDays, setInactivityDays] = useState(30);
  const [delayBetweenMessagesMs, setDelayBetweenMessagesMs] = useState(1500);

  const [message1, setMessage1] = useState('');
  const [message2, setMessage2] = useState('');
  const [message3, setMessage3] = useState('');
  const [transferMessage, setTransferMessage] = useState('');

  // Active message editor tab
  const [activeTab, setActiveTab] = useState<'msg1' | 'msg2' | 'msg3' | 'transfer'>('msg1');
  
  // Simulator scenario preview mode
  const [simulatorMode, setSimulatorMode] = useState<'welcome' | 'handover'>('welcome');

  // 1. Authorization check: Medhat and Moamen ONLY
  useEffect(() => {
    try {
      const info = JSON.parse(sessionStorage.getItem('adminInfo') || '{}');
      const u = (info?.username || '').toLowerCase();
      const n = (info?.name || '').toLowerCase();
      const allowed = ['medhat', 'mo2men'].includes(u) || ['مدحت', 'مؤمن'].some(name => n.includes(name));

      if (!allowed) {
        setIsAuthorized(false);
        router.push('/admin/dashboard');
        return;
      }
      setIsAuthorized(true);
    } catch {
      setIsAuthorized(false);
      router.push('/admin/dashboard');
    }
  }, [router]);

  // Fetch current settings
  useEffect(() => {
    if (isAuthorized === false) return;
    async function load() {
      try {
        const res = await fetch('/api/admin/whatsapp-settings');
        const data = await res.json();
        if (data?.settings) {
          const s = data.settings;
          setEnabled(s.enabled ?? true);
          setInactivityDays(s.inactivityDays ?? 30);
          setDelayBetweenMessagesMs(s.delayBetweenMessagesMs ?? 1500);
          setMessage1(s.messages?.[0] || '');
          setMessage2(s.messages?.[1] || '');
          setMessage3(s.messages?.[2] || '');
          setTransferMessage(s.transferMessage || '');
        }
      } catch (err) {
        console.error('Failed to load whatsapp settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAuthorized]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/admin/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          inactivityDays: Number(inactivityDays) || 30,
          delayBetweenMessagesMs: Number(delayBetweenMessagesMs) || 1500,
          messages: [message1, message2, message3],
          transferMessage,
        })
      });

      const data = await res.json();
      if (data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 5000);
      } else {
        alert('حدث خطأ أثناء الحفظ: ' + (data.error || 'غير معروف'));
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('هل أنت متأكد من رغبتك في استعادة النصوص الرسمية الافتراضية؟')) {
      setMessage1(DEFAULT_WHATSAPP_SETTINGS.messages[0]);
      setMessage2(DEFAULT_WHATSAPP_SETTINGS.messages[1]);
      setMessage3(DEFAULT_WHATSAPP_SETTINGS.messages[2]);
      setTransferMessage(DEFAULT_WHATSAPP_SETTINGS.transferMessage);
      setInactivityDays(30);
      setDelayBetweenMessagesMs(1500);
    }
  };

  if (loading || isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-4 bg-white/80 backdrop-blur-xl p-10 rounded-3xl border border-[#EAE4D9]/80 shadow-xl">
          <div className="w-12 h-12 border-4 border-[#C1A68D]/20 border-t-[#C1A68D] rounded-full animate-spin" />
          <div className="text-center">
            <h3 className="text-base font-black text-[#2B2823]">جاري تحميل إعدادات الواتساب...</h3>
            <p className="text-xs text-[#7A7061] mt-1">التحقق من الصلاحيات والاتصال بـ UltraMsg</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 text-right" dir="rtl">
      
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1E1B18] via-[#2A2621] to-[#1E1B18] text-white p-6 md:p-10 border border-[#C1A68D]/30 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C1A68D]/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 bg-[#C1A68D]/25 border border-[#C1A68D]/40 text-[#EBD9C7] text-[11px] font-black rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-xs">
                <span>👑</span>
                <span>صلاحية حصرية: مدحت ومؤمن فقط (Owners)</span>
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-black rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>UltraMsg Gateway: 01108109969</span>
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <span>💬</span>
              <span>مركز التحكم في ردود الواتساب التلقائية</span>
            </h1>

            <p className="text-xs md:text-sm font-medium text-white/70 max-w-2xl leading-relaxed">
              تحكم كامل في نصوص الـ 3 رسائل الترحيبية، ورسالة التحويل البشري، مع ميزة التجميد التام بعد الرسالة الرابعة وقاعدة الـ 30 يوماً لمنع التكرار.
            </p>
          </div>

          {/* Master Switch */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xl px-5 py-4 rounded-3xl border border-white/15 shadow-inner">
            <div className="text-right">
              <p className="text-[11px] font-black uppercase tracking-wider text-white/60">حالة السيستم</p>
              <p className={`text-sm font-black ${enabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                {enabled ? '🟢 الردود تعمل حالياً' : '🔴 الردود متوقفة مؤقتاً'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors shadow-inner ${
                enabled ? 'bg-emerald-500' : 'bg-white/20'
              }`}
              title={enabled ? 'إيقاف الرد التلقائي' : 'تشغيل الرد التلقائي'}
            >
              <div
                className={`bg-white w-6 h-6 rounded-full shadow-lg transform transition-transform duration-300 ${
                  enabled ? 'translate-x-0' : '-translate-x-6'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {savedSuccess && (
        <div className="bg-emerald-50 border-2 border-emerald-500/30 text-emerald-900 px-6 py-4 rounded-3xl flex items-center justify-between gap-4 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md">✓</div>
            <div>
              <p className="font-black text-sm">تم حفظ التعديلات بنجاح في قاعدة البيانات!</p>
              <p className="text-xs text-emerald-700 mt-0.5">سيتم تطبيق النصوص والقواعد الجديدة فوراً على أي عميل يتواصل مع مزار عبر الواتساب.</p>
            </div>
          </div>
          <button 
            onClick={() => setSavedSuccess(false)}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors"
          >
            إغلاق ✕
          </button>
        </div>
      )}

      {/* Main Grid: Controls + Mobile Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* RIGHT COLUMN: Controls & Message Editors (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Smart Rules & Thresholds Bar */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/80 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#EAE4D9]/60 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[#C1A68D]/15 text-[#C1A68D] flex items-center justify-center text-sm font-black">⚙️</span>
                <h2 className="text-base font-black text-[#2B2823]">قواعد الإرسال الذكية ومنع التكرار</h2>
              </div>
              <span className="text-[11px] font-bold text-[#7A7061] bg-[#FDFBF7] px-3 py-1 rounded-full border border-[#EAE4D9]">
                حماية من الحظر والسبام
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Inactivity Threshold */}
              <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EAE4D9] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#2B2823]">فترة انقطاع المحادثة:</label>
                  <span className="px-2.5 py-1 bg-white rounded-lg text-xs font-black text-[#C1A68D] border border-[#EAE4D9] shadow-2xs">
                    {inactivityDays} يوم
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="1"
                  value={inactivityDays}
                  onChange={(e) => setInactivityDays(Number(e.target.value))}
                  className="w-full accent-[#C1A68D] cursor-pointer"
                />
                <p className="text-[11px] text-[#7A7061] leading-relaxed">
                  * لو العميل كان بيتكلم معانا خلال آخر <strong className="text-[#2B2823]">{inactivityDays} يوم</strong>، السيستم <span className="text-rose-600 font-bold">مش هيبعتله</span> الـ 3 رسائل، ويبعتها فقط لو عميل جديد أو منقطع لأكثر من {inactivityDays} يوم.
                </p>
              </div>

              {/* Natural Delay */}
              <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#EAE4D9] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#2B2823]">الفاصل الزمني بين الرسائل:</label>
                  <span className="px-2.5 py-1 bg-white rounded-lg text-xs font-black text-[#C1A68D] border border-[#EAE4D9] shadow-2xs">
                    {(delayBetweenMessagesMs / 1000).toFixed(1)} ثانية
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1000, 1500, 2000].map((ms) => (
                    <button
                      key={ms}
                      type="button"
                      onClick={() => setDelayBetweenMessagesMs(ms)}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        delayBetweenMessagesMs === ms
                          ? 'bg-[#C1A68D] text-white shadow-md'
                          : 'bg-white text-[#7A7061] border border-[#EAE4D9] hover:bg-gray-50'
                      }`}
                    >
                      {ms === 1500 ? '1.5 ث (افتراضي)' : `${(ms / 1000).toFixed(1)} ث`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#7A7061] leading-relaxed">
                  * فاصل طبيعي واقعي وكأن الموظف يكتب ويرسل وراء بعض دون أن يتعرض الرقم للحظر من خوارزميات واتساب.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Message Tabs & Editor */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE4D9]/60 pb-4">
              <div>
                <h3 className="text-base font-black text-[#2B2823]">محرر نصوص الرسائل الرسمية</h3>
                <p className="text-xs text-[#7A7061] mt-0.5">اختر الرسالة المراد تعديلها واكتب بالعامية أو الفصحى مع الإيموجي المناسب</p>
              </div>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-xs font-black text-[#7A7061] hover:text-[#2B2823] hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                <span>↺</span>
                <span>استعادة النصوص الافتراضية</span>
              </button>
            </div>

            {/* Segmented Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-[#FAF8F5] rounded-2xl border border-[#EAE4D9]">
              <button
                type="button"
                onClick={() => setActiveTab('msg1')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'msg1'
                    ? 'bg-white text-[#C1A68D] shadow-sm border border-[#EAE4D9]'
                    : 'text-[#7A7061] hover:text-[#2B2823]'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-[#C1A68D]/20 text-[#C1A68D] flex items-center justify-center text-[10px]">1</span>
                <span>الترحيب والأسعار</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('msg2')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'msg2'
                    ? 'bg-white text-[#C1A68D] shadow-sm border border-[#EAE4D9]'
                    : 'text-[#7A7061] hover:text-[#2B2823]'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-[#C1A68D]/20 text-[#C1A68D] flex items-center justify-center text-[10px]">2</span>
                <span>الخدمات والمزايا</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('msg3')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'msg3'
                    ? 'bg-white text-[#C1A68D] shadow-sm border border-[#EAE4D9]'
                    : 'text-[#7A7061] hover:text-[#2B2823]'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-[#C1A68D]/20 text-[#C1A68D] flex items-center justify-center text-[10px]">3</span>
                <span>طلب الفيديو والمدة</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('transfer')}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === 'transfer'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 hover:text-emerald-900 bg-emerald-50'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px]">4</span>
                <span>رسالة التحويل</span>
              </button>
            </div>

            {/* Tab 1 Content */}
            {activeTab === 'msg1' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#2B2823]">نص الرسالة الأولى (الترحيب، تفاصيل الوحدات، والأسعار):</span>
                  <span className="font-mono text-[#7A7061] bg-[#FAF8F5] px-2.5 py-1 rounded-md border border-[#EAE4D9]">
                    {message1.length} حرف
                  </span>
                </div>
                <textarea
                  rows={13}
                  value={message1}
                  onChange={(e) => setMessage1(e.target.value)}
                  className="w-full p-4 bg-[#FAF8F5] border-2 border-transparent focus:border-[#C1A68D] focus:bg-white rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed transition-all resize-y shadow-inner outline-hidden"
                  placeholder="اكتب نص الرسالة الأولى هنا..."
                />
                <p className="text-[11px] text-[#7A7061]">
                  💡 <strong>نصيحة:</strong> اذكر هنا سعر الليلة التقريبي (مثلاً يبدأ من 2400 جنيه) والأوراق المطلوبة للتأكيد (باسبور، تذكرة طيران).
                </p>
              </div>
            )}

            {/* Tab 2 Content */}
            {activeTab === 'msg2' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#2B2823]">نص الرسالة الثانية (الخدمات الفندقية المجانية):</span>
                  <span className="font-mono text-[#7A7061] bg-[#FAF8F5] px-2.5 py-1 rounded-md border border-[#EAE4D9]">
                    {message2.length} حرف
                  </span>
                </div>
                <textarea
                  rows={11}
                  value={message2}
                  onChange={(e) => setMessage2(e.target.value)}
                  className="w-full p-4 bg-[#FAF8F5] border-2 border-transparent focus:border-[#C1A68D] focus:bg-white rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed transition-all resize-y shadow-inner outline-hidden"
                  placeholder="اكتب نص الرسالة الثانية هنا..."
                />
                <p className="text-[11px] text-[#7A7061]">
                  💡 <strong>نصيحة:</strong> اعرض مميزات الفندق: التكييف، المطبخ المتكامل، سمارت لوك، الهاوس كيبنج، والكوفي كورنر المجاني.
                </p>
              </div>
            )}

            {/* Tab 3 Content */}
            {activeTab === 'msg3' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#2B2823]">نص الرسالة الثالثة (السؤال عن التواريخ والأفراد لإرسال الفيديو):</span>
                  <span className="font-mono text-[#7A7061] bg-[#FAF8F5] px-2.5 py-1 rounded-md border border-[#EAE4D9]">
                    {message3.length} حرف
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={message3}
                  onChange={(e) => setMessage3(e.target.value)}
                  className="w-full p-4 bg-[#FAF8F5] border-2 border-transparent focus:border-[#C1A68D] focus:bg-white rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed transition-all resize-y shadow-inner outline-hidden"
                  placeholder="اكتب نص الرسالة الثالثة هنا..."
                />
                <p className="text-[11px] text-[#7A7061]">
                  💡 <strong>نصيحة:</strong> هذه الرسالة تختم بها الـ 3 رسائل لتشجيع العميل على الرد بتواريخه وعدد أفراده فوراً.
                </p>
              </div>
            )}

            {/* Tab 4 Content (Handover) */}
            {activeTab === 'transfer' && (
              <div className="space-y-3 animate-fade-in bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-900 font-black">
                    <span>🤝</span>
                    <span>رسالة التحويل البشري (الرسالة الرابعة والأخيرة):</span>
                  </div>
                  <span className="font-mono text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-200">
                    {transferMessage.length} حرف
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={transferMessage}
                  onChange={(e) => setTransferMessage(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-emerald-300 focus:border-emerald-600 rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed transition-all resize-y shadow-inner outline-hidden"
                  placeholder="اكتب رسالة التحويل هنا..."
                />
                <div className="bg-white p-3 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed space-y-1">
                  <p className="font-black">🔒 قاعدة التجميد التام:</p>
                  <p>تُرسل هذه الرسالة فور أن يكتب العميل <em>"عايز أحجز"</em>، <em>"ابعتلي فيديو"</em>، أو يحدد عدد أفراده. <strong>وفور إرسالها يتجمد البوت تماماً ولا يرسل أي رسالة أخرى لهذا العميل نهائياً</strong> ليتولى موظف الحجز البشري المحادثة.</p>
                </div>
              </div>
            )}

          </div>

          {/* Save Action Banner */}
          <div className="bg-white p-4 md:p-6 rounded-3xl border border-[#EAE4D9]/80 shadow-md flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="text-xs font-black text-[#2B2823]">جاهز لتطبيق التعديلات؟</p>
              <p className="text-[11px] text-[#7A7061]">سيتم الحفظ فوراً دون الحاجة لإعادة تشغيل السيرفر</p>
            </div>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#C1A68D] to-[#A88B72] hover:from-[#b5987f] hover:to-[#997c63] text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-[#C1A68D]/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>جاري الحفظ في السيستم...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>حفظ التعديلات فوراً</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* LEFT COLUMN: Realistic WhatsApp Smartphone Simulator (5 Cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-[#1E1B18] p-3 rounded-[3rem] shadow-2xl border-4 border-[#2E2A24] max-w-[380px] mx-auto">
            
            {/* Phone Screen Frame */}
            <div className="bg-[#EFEAE2] rounded-[2.3rem] overflow-hidden flex flex-col h-[650px] relative font-sans shadow-inner">
              
              {/* WhatsApp App Header */}
              <div className="bg-[#075E54] text-white p-3.5 flex items-center justify-between shadow-md select-none">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-black text-xs text-white">
                    🏨
                  </div>
                  <div>
                    <h4 className="text-xs font-black leading-tight">Mazar Studios | مزار</h4>
                    <p className="text-[10px] text-emerald-200">متصل الآن • رسمي</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-white/80 text-xs">
                  <span>📹</span>
                  <span>📞</span>
                  <span>⋮</span>
                </div>
              </div>

              {/* Scenario Toggle Bar */}
              <div className="bg-[#054C44] px-3 py-2 flex items-center justify-center gap-2 text-[10px] font-black text-white select-none">
                <button
                  type="button"
                  onClick={() => setSimulatorMode('welcome')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    simulatorMode === 'welcome' ? 'bg-white text-[#075E54] shadow-xs' : 'text-white/70 hover:text-white'
                  }`}
                >
                  الترحيب (3 رسائل)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorMode('handover')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    simulatorMode === 'handover' ? 'bg-white text-[#075E54] shadow-xs' : 'text-white/70 hover:text-white'
                  }`}
                >
                  التحويل (الرسالة 4)
                </button>
              </div>

              {/* Chat Messages Body with WhatsApp Wallpaper */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5 custom-scrollbar text-[11px] leading-relaxed select-text" dir="rtl">
                
                {/* Date separator */}
                <div className="flex justify-center my-1">
                  <span className="bg-white/80 backdrop-blur-xs text-[#7A7061] text-[9px] font-bold px-2.5 py-0.5 rounded-md shadow-2xs">
                    اليوم
                  </span>
                </div>

                {/* Scenario 1: Welcome Greeting (3 Messages) */}
                {simulatorMode === 'welcome' && (
                  <>
                    {/* Customer message */}
                    <div className="flex justify-start">
                      <div className="bg-white text-[#2B2823] p-2.5 rounded-2xl rounded-tr-none shadow-xs max-w-[80%] space-y-1">
                        <p>السلام عليكم، عندكم شقق أو استوديوهات؟</p>
                        <p className="text-[8px] text-[#7A7061] text-left">10:30 ص</p>
                      </div>
                    </div>

                    {/* Bot Message 1 */}
                    <div className="flex justify-end">
                      <div className="bg-[#E7FFDB] text-[#2B2823] p-2.5 rounded-2xl rounded-tl-none shadow-xs max-w-[85%] space-y-1 border border-emerald-100">
                        <p className="whitespace-pre-wrap">{message1 || DEFAULT_WHATSAPP_SETTINGS.messages[0]}</p>
                        <div className="flex items-center justify-end gap-1 text-[8px] text-[#7A7061]">
                          <span>10:30 ص</span>
                          <span className="text-blue-500 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>

                    {/* Bot Message 2 */}
                    <div className="flex justify-end">
                      <div className="bg-[#E7FFDB] text-[#2B2823] p-2.5 rounded-2xl rounded-tl-none shadow-xs max-w-[85%] space-y-1 border border-emerald-100">
                        <p className="whitespace-pre-wrap">{message2 || DEFAULT_WHATSAPP_SETTINGS.messages[1]}</p>
                        <div className="flex items-center justify-end gap-1 text-[8px] text-[#7A7061]">
                          <span>10:30 ص</span>
                          <span className="text-blue-500 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>

                    {/* Bot Message 3 */}
                    <div className="flex justify-end">
                      <div className="bg-[#E7FFDB] text-[#2B2823] p-2.5 rounded-2xl rounded-tl-none shadow-xs max-w-[85%] space-y-1 border border-emerald-100">
                        <p className="whitespace-pre-wrap">{message3 || DEFAULT_WHATSAPP_SETTINGS.messages[2]}</p>
                        <div className="flex items-center justify-end gap-1 text-[8px] text-[#7A7061]">
                          <span>10:30 ص</span>
                          <span className="text-blue-500 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Scenario 2: Handover and Freeze (Message 4) */}
                {simulatorMode === 'handover' && (
                  <>
                    {/* Customer request */}
                    <div className="flex justify-start">
                      <div className="bg-white text-[#2B2823] p-2.5 rounded-2xl rounded-tr-none shadow-xs max-w-[80%] space-y-1">
                        <p>عايز أحجز استوديو من يوم 15 نوفمبر احنا فردين وممكن تبعتلي فيديو؟</p>
                        <p className="text-[8px] text-[#7A7061] text-left">10:32 ص</p>
                      </div>
                    </div>

                    {/* Bot Handover Message (4th message) */}
                    <div className="flex justify-end">
                      <div className="bg-[#E7FFDB] text-[#2B2823] p-2.5 rounded-2xl rounded-tl-none shadow-xs max-w-[85%] space-y-1 border border-emerald-200">
                        <p className="whitespace-pre-wrap">{transferMessage || DEFAULT_WHATSAPP_SETTINGS.transferMessage}</p>
                        <div className="flex items-center justify-end gap-1 text-[8px] text-[#7A7061]">
                          <span>10:32 ص</span>
                          <span className="text-blue-500 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>

                    {/* Customer continues speaking */}
                    <div className="flex justify-start">
                      <div className="bg-white text-[#2B2823] p-2.5 rounded-2xl rounded-tr-none shadow-xs max-w-[80%] space-y-1">
                        <p>تمام مستني حضرتك، في انتظار الفيديو</p>
                        <p className="text-[8px] text-[#7A7061] text-left">10:33 ص</p>
                      </div>
                    </div>

                    {/* Complete Silence / Frozen Indicator */}
                    <div className="flex justify-center my-3">
                      <div className="bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-black px-3 py-2 rounded-xl text-center shadow-xs space-y-0.5">
                        <p>🔒 البوت توقف وتجمد تماماً (4 رسائل فقط)</p>
                        <p className="text-[9px] font-normal text-amber-700">المحادثة الآن في يد الموظف البشري للرد وإرسال الفيديو</p>
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Fake WhatsApp Input */}
              <div className="bg-[#F0F2F5] p-2 flex items-center gap-2 border-t border-gray-200 select-none">
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[10px] text-gray-400 border border-gray-200 flex items-center justify-between">
                  <span>رسالة...</span>
                  <span>📎 📷</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#075E54] text-white flex items-center justify-center text-xs shadow-xs">
                  🎤
                </div>
              </div>

            </div>
          </div>

          <div className="text-center mt-3">
            <span className="text-[11px] font-bold text-[#7A7061]">
              📱 محاكي واتساب حقيقي يعكس تعديلاتك في نفس اللحظة
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
