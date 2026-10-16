"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { getDbTranslations, updateDbTranslations } from '@/lib/actions/db';
import { processAndUploadReceipt } from '@/lib/uploadHelper';

function ImageUploader({ 
    label, 
    value, 
    onUpload 
}: { 
    label: string, 
    value: string, 
    onUpload: (url: string) => void 
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const url = await processAndUploadReceipt(file);
            onUpload(url);
        } catch (error: any) {
            alert(error?.message || 'خطأ في رفع الصورة!');
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6 border-b border-[#EAE4D9]/50 pb-10 mb-10 last:border-0">
            <label className="text-sm font-black text-[#C1A68D] block mb-2">{label}</label>
            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="w-full md:w-72 aspect-video rounded-[2rem] overflow-hidden border border-[#EAE4D9]/50 bg-white relative group shadow-sm">
                    <img src={value} alt={label} className="w-full h-full object-cover transition-transform group-hover:scale-110 opacity-90 group-hover:opacity-100" />
                    {isUploading && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-[#C1A68D]/20 border-t-[#C1A68D] rounded-full animate-spin" />
                        </div>
                    )}
                </div>
                <div className="flex-1 space-y-4">
                    <p className="text-[10px] text-[#7A7061] font-black uppercase tracking-widest opacity-60">رابط الصورة الحالي:</p>
                    <code className="block p-4 bg-white rounded-2xl text-[10px] text-[#C1A68D] border border-[#EAE4D9]/50 truncate font-mono shadow-sm">{value}</code>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        hidden 
                        accept="image/*" 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="bg-[#2A2723] hover:bg-black text-white text-[10px] font-black px-8 py-3.5 rounded-full transition-all shadow-lg shadow-black/10 active:scale-95"
                    >
                        {isUploading ? 'جاري الرفع...' : 'تغيير الصورة 🖼️'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ContentManagement() {
  const [translations, setTranslations] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('common');
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatus(null);
    try {
        const data = await getDbTranslations();
        setTranslations(data);
        if (!data) {
            setStatus({ type: 'error', msg: '⚠️ فشل الاتصال بقاعدة البيانات. لا يمكنك التعديل الآن لحماية بياناتك.' });
        }
    } catch (e) {
        setStatus({ type: 'error', msg: '⚠️ حدث خطأ أثناء جلب البيانات.' });
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdate = (path: string[], value: any) => {
    const newTranslations = JSON.parse(JSON.stringify(translations));
    let current = newTranslations;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setTranslations(newTranslations);
  };

  const saveChanges = async () => {
    if (!translations) {
        alert('لا يمكن الحفظ بسبب فشل الاتصال بقاعدة البيانات!');
        return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const result = await updateDbTranslations(translations);
      if (result.success) {
        setStatus({ type: 'success', msg: 'تم حفظ التعديلات بنجاح! سيتم تحديث الموقع فوراً.' });
      } else {
        setStatus({ type: 'error', msg: result.error || 'حدث خطأ أثناء الحفظ. تأكد من إعدادات قاعدة البيانات.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: 'خطأ تقني أثناء محاولة الحفظ.' });
    } finally {
      setIsSaving(false);
    }
    
    // Clear status after 5 seconds
    setTimeout(() => setStatus(null), 5000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="w-14 h-14 border-4 border-[#C1A68D]/20 border-t-[#C1A68D] rounded-full animate-spin" />
        <p className="text-[#7A7061] font-black uppercase tracking-widest animate-pulse">جاري تحميل المحتوى...</p>
      </div>
    );
  }

  const sections = [
    { id: 'media', name: 'إدارة الصور والوسائط', icon: '🖼️' },
    { id: 'common', name: 'العامة / الهيدر', icon: '🏠' },
    { id: 'aboutPage', name: 'عن المكان', icon: 'ℹ️' },
    { id: 'rulesPage', name: 'قوانين المكان', icon: '⚖️' },
    { id: 'howToBookPage', name: 'طريقة الحجز', icon: '📑' },
    { id: 'bookingPage', name: 'صفحة الحجز', icon: '📅' },
    { id: 'unitsPage', name: 'صفحة الوحدات', icon: '🏢' },
  ];

  const renderField = (label: string, sectionKey: string, fieldKey: string, subFieldKey?: string) => {
    const arPath = ['ar', sectionKey, fieldKey];
    const enPath = ['en', sectionKey, fieldKey];
    if (subFieldKey) {
      if (subFieldKey.includes('.')) {
        const parts = subFieldKey.split('.');
        arPath.push(...parts);
        enPath.push(...parts);
      } else {
        arPath.push(subFieldKey);
        enPath.push(subFieldKey);
      }
    }

    const getNested = (obj: any, keys: string[]) => {
        return keys.reduce((xs, x) => (xs && xs[x] !== undefined) ? xs[x] : null, obj);
    };

    const arValue = getNested(translations, arPath);
    const enValue = getNested(translations, enPath);

    return (
      <div className="space-y-6 border-b border-[#EAE4D9]/30 pb-10 mb-10 last:border-0">
        <label className="text-sm font-black text-[#C1A68D] block mb-2">{label}</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <span className="text-[10px] text-[#7A7061] font-black uppercase tracking-widest px-2 opacity-50">Arabic (العربية)</span>
            {typeof arValue === 'string' && arValue.length > 50 ? (
              <textarea 
                value={arValue}
                onChange={(e) => handleUpdate(arPath, e.target.value)}
                className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-6 py-4 text-sm text-[#2A2723] font-bold focus:border-[#C1A68D] outline-none transition-all min-h-[120px] shadow-sm leading-relaxed"
                dir="rtl"
              />
            ) : (
              <input 
                type="text"
                value={arValue || ''}
                onChange={(e) => handleUpdate(arPath, e.target.value)}
                className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-6 py-4 text-sm text-[#2A2723] font-black focus:border-[#C1A68D] outline-none shadow-sm transition-all"
                dir="rtl"
              />
            )}
          </div>
          <div className="space-y-3">
            <span className="text-[10px] text-[#7A7061] font-black uppercase tracking-widest px-2 opacity-50">English Context</span>
            {typeof enValue === 'string' && enValue.length > 50 ? (
              <textarea 
                value={enValue}
                onChange={(e) => handleUpdate(enPath, e.target.value)}
                className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-6 py-4 text-sm text-[#2A2723] font-bold focus:border-[#C1A68D] outline-none transition-all min-h-[120px] shadow-sm leading-relaxed"
                dir="ltr"
              />
            ) : (
              <input 
                type="text"
                value={enValue || ''}
                onChange={(e) => handleUpdate(enPath, e.target.value)}
                className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-6 py-4 text-sm text-[#2A2723] font-black focus:border-[#C1A68D] outline-none shadow-sm transition-all"
                dir="ltr"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black mb-2 text-[#2A2723]">إدارة <span className="text-[#C1A68D]">المحتوى</span></h1>
          <p className="text-[#7A7061] text-sm font-bold opacity-70">تحكم كامل في جميع نصوص وصور الموقع بالعربية والإنجليزية.</p>
        </div>
        
        <button 
          onClick={saveChanges}
          disabled={isSaving}
          className={`px-12 py-5 rounded-2xl font-black text-white transition-all shadow-xl flex items-center gap-3 ${isSaving ? 'bg-[#D5C5B3] cursor-not-allowed' : 'bg-[#C1A68D] hover:scale-105 active:scale-95 shadow-[#C1A68D]/30'}`}
        >
          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات ✅'}
        </button>
      </header>

      {status && (
        <div className={`p-5 rounded-2xl border mb-6 animate-scale-in font-black text-sm ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
          {status.msg}
          {status.type === 'error' && (
              <button onClick={loadData} className="mr-4 underline text-xs">إعادة المحاولة 🔄</button>
          )}
        </div>
      )}

      {isLoading ? (
          <div className="py-40 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#C1A68D] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[#C1A68D] font-black text-xs uppercase tracking-widest">جاري جلب البيانات بأمان...</p>
          </div>
      ) : !translations ? (
          <div className="py-40 text-center bg-white rounded-[3rem] border border-red-100 shadow-sm">
              <span className="text-6xl block mb-6">🔌</span>
              <h3 className="text-2xl font-black text-[#2A2723] mb-2">انقطع الاتصال بالقاعدة</h3>
              <p className="text-[#7A7061] font-bold mb-8">تم إيقاف وضع التعديل مؤقتاً لضمان عدم ضياع شغلك القديم.</p>
              <button onClick={loadData} className="bg-[#2A2723] text-white px-10 py-4 rounded-full font-black hover:bg-black transition-all">إعادة المحاولة 🔄</button>
          </div>
      ) : (
        <>
        <div className="flex flex-col lg:flex-row gap-10">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-72 space-y-3">
          <div className="bg-white/50 p-2 rounded-[2.5rem] border border-[#EAE4D9] shadow-sm">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-5 px-6 py-4.5 rounded-2xl font-black transition-all text-right ${
                  activeSection === section.id 
                  ? 'bg-[#2A2723] text-white shadow-xl' 
                  : 'text-[#7A7061] hover:text-[#2A2723] hover:bg-[#FDFBF7]'
                }`}
              >
                <span className="text-xl">{section.icon}</span>
                <span className="text-sm">{section.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor Content Area */}
        <div className="flex-1 bg-white p-10 md:p-16 rounded-[3rem] border border-[#EAE4D9]/50 shadow-sm">
          
          {activeSection === 'media' && (
            <div className="animate-fade-in">
                <h3 className="text-2xl font-black text-[#2A2723] mb-10 pb-5 border-b-2 border-[#C1A68D]/20">إدارة الصور والوسائط</h3>
                
                <ImageUploader 
                    label="صورة الهيرو اليسرى (Homepage Left)" 
                    value={translations?.media?.homeHeroLeft || ''} 
                    onUpload={(url) => handleUpdate(['media', 'homeHeroLeft'], url)} 
                />
                <ImageUploader 
                    label="صورة الهيرو اليمنى (Homepage Right)" 
                    value={translations?.media?.homeHeroRight || ''} 
                    onUpload={(url) => handleUpdate(['media', 'homeHeroRight'], url)} 
                />
                
                <div className="mt-16 space-y-8">
                    <h4 className="text-[#C1A68D] font-black text-xs uppercase tracking-[0.3em] bg-[#FDFBF7] p-5 rounded-2xl border border-[#EAE4D9]/50">صور تصنيفات الفروع</h4>
                    <ImageUploader 
                        label="صورة فرع مدينة نصر 1" 
                        value={translations?.media?.branch1Image || ''} 
                        onUpload={(url) => handleUpdate(['media', 'branch1Image'], url)} 
                    />
                    <ImageUploader 
                        label="صورة فرع مدينة نصر 2" 
                        value={translations?.media?.branch2Image || ''} 
                        onUpload={(url) => handleUpdate(['media', 'branch2Image'], url)} 
                    />
                    <ImageUploader 
                        label="صورة الشقق الفاخرة" 
                        value={translations?.media?.apartmentsImage || ''} 
                        onUpload={(url) => handleUpdate(['media', 'apartmentsImage'], url)} 
                    />
                </div>
            </div>
          )}

          {activeSection === 'common' && (
            <div className="animate-fade-in">
              <h3 className="text-2xl font-black text-[#2A2723] mb-10 pb-5 border-b-2 border-[#C1A68D]/20">النصوص العامة والهيدر</h3>
              {renderField('اسم التطبيق', 'common', 'appName')}
              {renderField('زر "احجز الآن"', 'common', 'bookNow')}
              {renderField('زر "استكشف الوحدات"', 'common', 'explore')}
              {renderField('العنوان الرئيسي (Hero Title)', 'common', 'luxuryStay')}
              {renderField('العنوان الفرعي (Hero Subtitle)', 'common', 'differentExperience')}
              {renderField('وصف الهيرو (Hero Description)', 'common', 'heroSubtitle')}
              {renderField('حقوق الفوتر (Footer Rights)', 'common', 'footerRights')}
            </div>
          )}

          {activeSection === 'aboutPage' && (
            <div className="animate-fade-in">
              <h3 className="text-2xl font-black text-[#2A2723] mb-10 pb-5 border-b-2 border-[#C1A68D]/20">صفحة "عن المكان"</h3>
              {renderField('العنوان الرئيسي', 'aboutPage', 'title')}
              {renderField('عنوان فرعي', 'aboutPage', 'subtitle')}
              {renderField('فقرة الوصف الأولى', 'aboutPage', 'description1')}
              {renderField('قسم "ماذا نقدم"', 'aboutPage', 'whatWeOffer')}
              {renderField('هدفنا', 'aboutPage', 'ourGoal')}
              {renderField('وصف الهدف', 'aboutPage', 'goalDesc')}
              
              <div className="mt-16 space-y-10">
                <h4 className="text-[#C1A68D] font-black text-xs uppercase tracking-[0.3em] bg-[#FDFBF7] p-5 rounded-2xl border border-[#EAE4D9]/50">المميزات (Features)</h4>
                {renderField('تكييف (عنوان)', 'aboutPage', 'features', 'ac')}
                {renderField('تكييف (وصف)', 'aboutPage', 'features', 'acDesc')}
                {renderField('مطبخ (عنوان)', 'aboutPage', 'features', 'kitchen')}
                {renderField('مطبخ (وصف)', 'aboutPage', 'features', 'kitchenDesc')}
                {renderField('أمان (عنوان)', 'aboutPage', 'features', 'security')}
                {renderField('أمان (وصف)', 'aboutPage', 'features', 'securityDesc')}
              </div>
            </div>
          )}

          {activeSection === 'rulesPage' && (
            <div className="animate-fade-in">
              <h3 className="text-2xl font-black text-[#2A2723] mb-10 pb-5 border-b-2 border-[#C1A68D]/20">صفحة "قوانين المكان"</h3>
              {renderField('العنوان الرئيسي', 'rulesPage', 'title')}
              {renderField('عنوان فرعي', 'rulesPage', 'subtitle')}
              
              <div className="mt-16 space-y-10">
                 <h4 className="text-[#C1A68D] font-black text-xs uppercase tracking-[0.3em] bg-[#FDFBF7] p-5 rounded-2xl border border-[#EAE4D9]/50">قسم المواعيد</h4>
                 {renderField('عنوان القسم', 'rulesPage', 'sections', 'times.title')}
                 {renderField('وقت الوصول', 'rulesPage', 'sections', 'times.checkIn')}
                 {renderField('وقت المغادرة', 'rulesPage', 'sections', 'times.checkOut')}
              </div>

              <div className="mt-16 space-y-10">
                 <h4 className="text-[#C1A68D] font-black text-xs uppercase tracking-[0.3em] bg-[#FDFBF7] p-5 rounded-2xl border border-[#EAE4D9]/50">السياسة والزوار</h4>
                 {renderField('عنوان القسم', 'rulesPage', 'sections', 'visitors.title')}
                 {renderField('نهاية وقت الزوار', 'rulesPage', 'sections', 'visitors.limit')}
                 {renderField('منع المبيت للغرباء', 'rulesPage', 'sections', 'visitors.noSleepover')}
              </div>
            </div>
          )}

          {activeSection === 'howToBookPage' && (
            <div className="animate-fade-in">
              <h3 className="text-2xl font-black text-[#2A2723] mb-10 pb-5 border-b-2 border-[#C1A68D]/20">صفحة "طريقة الحجز"</h3>
              {renderField('العنوان الرئيسي', 'howToBookPage', 'title')}
              {renderField('عنوان فرعي', 'howToBookPage', 'subtitle')}
              {renderField('نص دعوة العمل (CTA)', 'howToBookPage', 'cta')}
              
              <div className="mt-16 space-y-10">
                <h4 className="text-[#C1A68D] font-black text-xs uppercase tracking-[0.3em] bg-[#FDFBF7] p-5 rounded-2xl border border-[#EAE4D9]/50">الخطوات (Steps)</h4>
                 {renderField('الخطوة 1: العنوان', 'howToBookPage', 'steps', '0.title')}
                 {renderField('الخطوة 1: الوصف', 'howToBookPage', 'steps', '0.desc')}
                 {renderField('الخطوة 2: العنوان', 'howToBookPage', 'steps', '1.title')}
                 {renderField('الخطوة 2: الوصف', 'howToBookPage', 'steps', '1.desc')}
              </div>
            </div>
          )}

          {activeSection === 'bookingPage' && (
            <div className="animate-fade-in">
              <h3 className="text-2xl font-black text-[#2A2723] mb-10 pb-5 border-b-2 border-[#C1A68D]/20">صفحة تجربة الحجز</h3>
              {renderField('عنوان الخطوة الأولى', 'bookingPage', 'step1Title')}
              {renderField('وصف الخطوة الأولى', 'bookingPage', 'step1Subtitle')}
              {renderField('نص تاريخ الوصول', 'bookingPage', 'checkIn')}
              {renderField('نص تاريخ المغادرة', 'bookingPage', 'checkOut')}
              {renderField('نص زر التحقق', 'bookingPage', 'checkAvailability')}
              {renderField('عنوان نجاح الحجز', 'bookingPage', 'successTitle')}
              {renderField('وصف نجاح الحجز', 'bookingPage', 'successDesc')}
            </div>
          )}

          {activeSection === 'unitsPage' && (
            <div className="animate-fade-in">
              <h3 className="text-2xl font-black text-[#2A2723] mb-10 pb-5 border-b-2 border-[#C1A68D]/20">صفحة عرض الوحدات</h3>
              {renderField('العنوان الرئيسي', 'unitsPage', 'title')}
              {renderField('عنوان فرعي', 'unitsPage', 'subtitle')}
              {renderField('اسم الفرع 1', 'unitsPage', 'branch1')}
              {renderField('اسم الفرع 2', 'unitsPage', 'branch2')}
              {renderField('اسم قسم الشقق', 'unitsPage', 'apartments')}
              {renderField('زر تفاصيل الوحدة', 'unitsPage', 'viewDetails')}
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-[#C1A68D]/10 border border-[#C1A68D]/30 flex gap-10 p-10 rounded-[3rem] items-center shadow-sm">
        <span className="text-5xl">💡</span>
        <div>
            <h4 className="font-black text-[#2A2723] mb-2 text-lg">تلميح ذكي</h4>
            <p className="text-[11px] text-[#7A7061] leading-relaxed font-bold opacity-80">
               تذكر أن التغييرات التي تقوم بها هنا ستؤثر على الموقع بالكامل ولجميع الزوار. تأكد من مراجعة القواعد النحوية والإملائية في اللغتين <span className="text-[#C1A68D] font-black">العربية والإنجليزية</span> لضمان مظهر احترافي أمام عملائك.
            </p>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

