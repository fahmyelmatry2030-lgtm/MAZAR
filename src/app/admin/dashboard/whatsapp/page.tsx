"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        alert('حدث خطأ أثناء الحفظ: ' + (data.error || 'غير معروف'));
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#C1A68D]/20 border-t-[#C1A68D] rounded-full animate-spin" />
          <p className="text-sm font-bold text-[#7A7061]">جاري تحميل إعدادات الواتساب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="text-3xl">💬</span>
            <h1 className="text-2xl md:text-3xl font-black text-[#2B2823]">
              إعدادات ردود الواتساب التلقائية
            </h1>
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-black rounded-full flex items-center gap-1.5 shadow-xs">
              <span>👑</span>
              <span>حصرية لـ: مدحت ومؤمن فقط</span>
            </span>
          </div>
          <p className="text-sm font-medium text-[#7A7061]">
            تعديل نصوص الـ 3 رسائل الترحيبية، ورسالة التحويل، وتحديد شروط إرسالها دون الحاجة لكتابة كود.
          </p>
        </div>

        {/* Global Toggle */}
        <div className="flex items-center gap-3 bg-[#FDFBF7] px-4 py-3 rounded-2xl border border-[#EAE4D9]/80">
          <span className="text-xs font-black text-[#2B2823]">
            {enabled ? '🟢 الرد التلقائي شغال' : '🔴 الرد التلقائي متوقف'}
          </span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              enabled ? 'bg-emerald-600' : 'bg-gray-300'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                enabled ? 'translate-x-0' : '-translate-x-6'
              }`}
            />
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-sm animate-fade-in">
          <span className="text-xl">✅</span>
          <p className="font-bold text-sm">
            تم حفظ جميع التعديلات بنجاح! سيتم تطبيقها فوراً على أي رسالة واتساب قادمة لمزار.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Rules & Inactivity Configuration Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/60 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-[#EAE4D9]/60 pb-4">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-black text-[#2B2823]">قواعد وشروط الإرسال الذكية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-[#2B2823] block">
                فترة انقطاع المحادثة لإعادة إرسال الترحيب (بالأيام):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={inactivityDays}
                  onChange={(e) => setInactivityDays(Number(e.target.value))}
                  className="w-24 px-4 py-3 bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl text-center font-black text-[#2B2823] focus:outline-hidden focus:border-[#C1A68D]"
                />
                <span className="text-sm font-bold text-[#7A7061]">يوم (الافتراضي 30 يوم)</span>
              </div>
              <p className="text-[11px] text-[#7A7061] leading-relaxed">
                * لن يتم إرسال الـ 3 رسائل لأي عميل معتاد أو محادثة كان شغال فيها كلام خلال آخر {inactivityDays} يوم.
                يُرسل فقط للعملاء الجدد تماماً أو المنقطعين منذ أكثر من {inactivityDays} يوم.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-[#2B2823] block">
                الفاصل الزمني بين الرسائل الـ 3 (بالمللي ثانية):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="500"
                  max="10000"
                  step="500"
                  value={delayBetweenMessagesMs}
                  onChange={(e) => setDelayBetweenMessagesMs(Number(e.target.value))}
                  className="w-28 px-4 py-3 bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl text-center font-black text-[#2B2823] focus:outline-hidden focus:border-[#C1A68D]"
                />
                <span className="text-sm font-bold text-[#7A7061]">مللي ثانية (1.5 ثانية)</span>
              </div>
              <p className="text-[11px] text-[#7A7061] leading-relaxed">
                * فاصل زمني طبيعي بين إرسال الرسالة 1 والرسالة 2 والرسالة 3 ليظهر الإرسال طبيعياً وبدون حظر.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Messages Edit Cards */}
        <div className="space-y-6">
          {/* Message 1 */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE4D9]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#C1A68D] text-white flex items-center justify-center text-xs font-black">1</span>
                <h3 className="font-black text-sm text-[#2B2823]">الرسالة الأولى: الترحيب، أنواع الاستوديوهات، والأسعار</h3>
              </div>
              <span className="text-xs text-[#7A7061] font-mono">{message1.length} حرف</span>
            </div>
            <textarea
              rows={12}
              value={message1}
              onChange={(e) => setMessage1(e.target.value)}
              dir="rtl"
              className="w-full p-4 bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed focus:outline-hidden focus:border-[#C1A68D] transition-all resize-y"
              placeholder="اكتب نص الرسالة الأولى هنا..."
            />
          </div>

          {/* Message 2 */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE4D9]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#C1A68D] text-white flex items-center justify-center text-xs font-black">2</span>
                <h3 className="font-black text-sm text-[#2B2823]">الرسالة الثانية: تفاصيل الخدمات الفندقية المجانية</h3>
              </div>
              <span className="text-xs text-[#7A7061] font-mono">{message2.length} حرف</span>
            </div>
            <textarea
              rows={8}
              value={message2}
              onChange={(e) => setMessage2(e.target.value)}
              dir="rtl"
              className="w-full p-4 bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed focus:outline-hidden focus:border-[#C1A68D] transition-all resize-y"
              placeholder="اكتب نص الرسالة الثانية هنا..."
            />
          </div>

          {/* Message 3 */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE4D9]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#C1A68D] text-white flex items-center justify-center text-xs font-black">3</span>
                <h3 className="font-black text-sm text-[#2B2823]">الرسالة الثالثة: طلب تحديد المدة والعدد لإرسال الفيديو</h3>
              </div>
              <span className="text-xs text-[#7A7061] font-mono">{message3.length} حرف</span>
            </div>
            <textarea
              rows={3}
              value={message3}
              onChange={(e) => setMessage3(e.target.value)}
              dir="rtl"
              className="w-full p-4 bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed focus:outline-hidden focus:border-[#C1A68D] transition-all resize-y"
              placeholder="اكتب نص الرسالة الثالثة هنا..."
            />
          </div>

          {/* Handover Message */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#EAE4D9]/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE4D9]/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">🤝</span>
                <h3 className="font-black text-sm text-[#2B2823]">
                  رسالة التحويل البشري (تُرسل عند طلب الحجز، طلب فيديو، أو ذكر عدد الأفراد)
                </h3>
              </div>
              <span className="text-xs text-[#7A7061] font-mono">{transferMessage.length} حرف</span>
            </div>
            <textarea
              rows={3}
              value={transferMessage}
              onChange={(e) => setTransferMessage(e.target.value)}
              dir="rtl"
              className="w-full p-4 bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl text-xs md:text-sm font-medium text-[#2B2823] leading-relaxed focus:outline-hidden focus:border-[#C1A68D] transition-all resize-y"
              placeholder="اكتب رسالة التحويل للموظف البشري هنا..."
            />
            <p className="text-[11px] text-[#7A7061]">
              * إذا قال العميل: "عايز أحجز"، "ابعتلي فيديو"، "إحنا 3"، أو حدد تاريخ، سيرد البوت بهذه الرسالة فوراً ثم يصمت تماماً لتكملة المحادثة بشرياً.
              أما إذا كتب: "شكراً" أو "تسلم"، فلن يرد البوت بأي شيء ويسكت فوراً.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-4 sticky bottom-6 bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-[#EAE4D9] shadow-xl z-20">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-4 bg-[#C1A68D] hover:bg-[#b09378] active:scale-95 text-white font-black text-sm rounded-2xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
      </form>
    </div>
  );
}
