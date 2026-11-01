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

  // Dynamic list of welcome messages
  const [messages, setMessages] = useState<string[]>([]);
  const [transferMessage, setTransferMessage] = useState('');

  // Active editor tab: index of message (0, 1, 2...) or 'transfer'
  const [activeTab, setActiveTab] = useState<number | 'transfer'>(0);
  
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
          setMessages(Array.isArray(s.messages) && s.messages.length > 0 ? s.messages : DEFAULT_WHATSAPP_SETTINGS.messages);
          setTransferMessage(s.transferMessage || DEFAULT_WHATSAPP_SETTINGS.transferMessage);
        }
      } catch (err) {
        console.error('Failed to load whatsapp settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAuthorized]);

  const handleUpdateMessage = (idx: number, text: string) => {
    const updated = [...messages];
    updated[idx] = text;
    setMessages(updated);
  };

  const handleAddMessage = () => {
    const newIdx = messages.length;
    const updated = [...messages, ''];
    setMessages(updated);
    setActiveTab(newIdx);
  };

  const handleDeleteMessage = (idx: number) => {
    if (messages.length <= 1) {
      alert('⚠️ يجب أن تبقى رسالة ترحيبية واحدة على الأقل في السيستم.');
      return;
    }
    if (confirm(`هل أنت متأكد من حذف الرسالة رقم (${idx + 1})؟`)) {
      const updated = messages.filter((_, i) => i !== idx);
      setMessages(updated);
      if (activeTab === idx) {
        setActiveTab(Math.max(0, idx - 1));
      } else if (typeof activeTab === 'number' && activeTab > idx) {
        setActiveTab(activeTab - 1);
      }
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      // Filter out completely empty messages (must have at least one message)
      const validMessages = messages.map(m => m.trim()).filter(m => m.length > 0);
      const messagesToSave = validMessages.length > 0 ? validMessages : messages;

      const res = await fetch('/api/admin/whatsapp-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          inactivityDays: Number(inactivityDays) || 30,
          delayBetweenMessagesMs: Number(delayBetweenMessagesMs) || 1500,
          messages: messagesToSave,
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
    if (confirm('هل أنت متأكد من استعادة الـ 3 رسائل الترحيبية ورسالة التحويل الافتراضية الرسمية؟')) {
      setMessages([...DEFAULT_WHATSAPP_SETTINGS.messages]);
      setTransferMessage(DEFAULT_WHATSAPP_SETTINGS.transferMessage);
      setInactivityDays(30);
      setDelayBetweenMessagesMs(1500);
      setActiveTab(0);
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
              تحكم كامل في رسائل الترحيب: يمكنك إضافة أي عدد من الرسائل أو حذفها أو تعديلها، مع رسالة التحويل والتجميد وقاعدة الـ 30 يوماً.
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
              <p className="text-xs text-emerald-700 mt-0.5">سيتم إرسال ({messages.length}) رسائل ترحيبية لأي عميل جديد أو منقطع منذ {inactivityDays} يوماً.</p>
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
                  * لو العميل كان بيتكلم معانا خلال آخر <strong className="text-[#2B2823]">{inactivityDays} يوم</strong>، السيستم <span className="text-rose-600 font-bold">مش هيبعتله</span> الرسائل الترحيبية، ويبعتها فقط لو عميل جديد أو منقطع لأكثر من {inactivityDays} يوم.
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

          {/* Dynamic Message Tabs & Management Bar */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE4D9]/60 pb-4">
              <div>
                <h3 className="text-base font-black text-[#2B2823]">إدارة وتعديل رسائل الرد</h3>
                <p className="text-xs text-[#7A7061] mt-0.5">يمكنك إضافة رسائل جديدة أو حذف رسائل حالية بسهولة تامة</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddMessage}
                  className="px-3.5 py-2 bg-[#C1A68D]/15 hover:bg-[#C1A68D]/25 text-[#C1A68D] rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>➕</span>
                  <span>إضافة رسالة جديدة</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-xs font-bold text-[#7A7061] hover:text-[#2B2823] px-2.5 py-2 hover:bg-gray-50 rounded-xl transition-all"
                  title="استعادة النصوص الافتراضية"
                >
                  ↺ استعادة
                </button>
              </div>
            </div>

            {/* Dynamic Segmented Tabs with Add/Delete Support */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#FAF8F5] rounded-2xl border border-[#EAE4D9]">
              {messages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === idx
                      ? 'bg-white text-[#C1A68D] shadow-sm border border-[#EAE4D9]'
                      : 'text-[#7A7061] hover:text-[#2B2823]'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    activeTab === idx ? 'bg-[#C1A68D] text-white' : 'bg-[#C1A68D]/15 text-[#C1A68D]'
                  }`}>
                    {idx + 1}
                  </span>
                  <span>الرسالة {idx + 1}</span>
                </button>
              ))}

              {/* Handover Tab */}
              <button
                type="button"
                onClick={() => setActiveTab('transfer')}
                className={`py-2 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 mr-auto ${
                  activeTab === 'transfer'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200'
                }`}
              >
                <span>🤝</span>
                <span>رسالة التحويل البشري</span>
              </button>
            </div>

            {/* Active Message Content Editor */}
            {typeof activeTab === 'number' && messages[activeTab] !== undefined && (
              <div className="space-y-4 animate-fade-in bg-white p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#C1A68D] text-white flex items-center justify-center text-xs font-black">
                      {activeTab + 1}
                    </span>
                    <span className="font-black text-sm text-[#2B2823]">
                      محتوى الرسالة رقم ({activeTab + 1}) من إجمالي ({messages.length}) رسائل ترحيبية:
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[#7A7061] bg-[#FAF8F5] px-2.5 py-1 rounded-md border border-[#EAE4D9]">
                      {messages[activeTab].length} حرف
                    </span>
                    {messages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(activeTab)}
                        className="text-xs font-black text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-rose-200"
                        title="حذف هذه الرسالة"
                      >
                        <span>🗑️</span>
                        <span>حذف هذه الرسالة</span>
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={activeTab === 0 ? 12 : activeTab === 1 ? 10 : 5}
                  value={messages[activeTab]}
                  onChange={(e) => handleUpdateMessage(activeTab, e.target.value)}
                  className="w-full p-4 bg-[#FAF8F5] border-2 border-transparent focus:border-[#C1A68D] focus:bg-white rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed transition-all resize-y shadow-inner outline-hidden"
                  placeholder={`اكتب نص الرسالة رقم ${activeTab + 1} هنا...`}
                />

                <div className="flex items-center justify-between text-[11px] text-[#7A7061] pt-1">
                  <span>💡 سيتم إرسالها بالترتيب بعد فاصل {(delayBetweenMessagesMs / 1000).toFixed(1)} ثانية.</span>
                  {activeTab < messages.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab(activeTab + 1)}
                      className="font-bold text-[#C1A68D] hover:underline"
                    >
                      التالي: تعديل الرسالة {activeTab + 2} &larr;
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Handover Content */}
            {activeTab === 'transfer' && (
              <div className="space-y-4 animate-fade-in bg-emerald-50/50 p-6 rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                    <span>🤝</span>
                    <span>رسالة التحويل لمسؤول الحجز البشري (المرحلة الختامية):</span>
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
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed space-y-1">
                  <p className="font-black">🔒 التجميد التام بعد الإرسال:</p>
                  <p>تُرسل هذه الرسالة لمرة واحدة فقط عند طلب الحجز أو طلب فيديو، <strong>وبعدها يتوقف البوت عن الرد نهائياً مع هذا العميل</strong> حتى لا يُكرر نفسه، ويتولى موظف الحجز البشري المحادثة.</p>
                </div>
              </div>
            )}

          </div>

          {/* Save Action Banner */}
          <div className="bg-white p-4 md:p-6 rounded-3xl border border-[#EAE4D9]/80 shadow-md flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <p className="text-xs font-black text-[#2B2823]">جاهز لتطبيق التعديلات؟</p>
              <p className="text-[11px] text-[#7A7061]">سيتم حفظ عدد ({messages.length}) رسائل ترحيبية فوراً في السيستم</p>
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
                  <span>حفظ التعديلات فوراً ({messages.length} رسائل)</span>
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
                  الترحيب ({messages.length} رسائل)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatorMode('handover')}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    simulatorMode === 'handover' ? 'bg-white text-[#075E54] shadow-xs' : 'text-white/70 hover:text-white'
                  }`}
                >
                  التحويل البشري
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

                {/* Scenario 1: Welcome Greeting (Dynamic Count of Messages) */}
                {simulatorMode === 'welcome' && (
                  <>
                    {/* Customer message */}
                    <div className="flex justify-start">
                      <div className="bg-white text-[#2B2823] p-2.5 rounded-2xl rounded-tr-none shadow-xs max-w-[80%] space-y-1">
                        <p>السلام عليكم، عندكم شقق أو استوديوهات متاحة؟</p>
                        <p className="text-[8px] text-[#7A7061] text-left">10:30 ص</p>
                      </div>
                    </div>

                    {/* Bot Dynamic Messages */}
                    {messages.map((msg, i) => (
                      <div key={i} className="flex justify-end">
                        <div className="bg-[#E7FFDB] text-[#2B2823] p-2.5 rounded-2xl rounded-tl-none shadow-xs max-w-[85%] space-y-1 border border-emerald-100">
                          <div className="flex items-center justify-between text-[8px] font-black text-emerald-800 pb-0.5 border-b border-emerald-200/50 mb-1">
                            <span>رسالة {i + 1}</span>
                            <span>بعد {(i * delayBetweenMessagesMs / 1000).toFixed(1)} ث</span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg || `[نص الرسالة ${i + 1}]`}</p>
                          <div className="flex items-center justify-end gap-1 text-[8px] text-[#7A7061]">
                            <span>10:30 ص</span>
                            <span className="text-blue-500 font-bold">✓✓</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Scenario 2: Handover and Freeze (Last message) */}
                {simulatorMode === 'handover' && (
                  <>
                    {/* Customer request */}
                    <div className="flex justify-start">
                      <div className="bg-white text-[#2B2823] p-2.5 rounded-2xl rounded-tr-none shadow-xs max-w-[80%] space-y-1">
                        <p>عايز أحجز استوديو من يوم 15 نوفمبر احنا فردين وممكن تبعتلي فيديو؟</p>
                        <p className="text-[8px] text-[#7A7061] text-left">10:32 ص</p>
                      </div>
                    </div>

                    {/* Bot Handover Message */}
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
                        <p>🔒 البوت توقف وتجمد تماماً</p>
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
              📱 محاكي واتساب حي يعرض الـ ({messages.length}) رسائل تزامناً مع تعديلاتك
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
