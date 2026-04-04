"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { getSystemUnits, updateUnitDetails } from '@/lib/data-init';
import { uploadImage } from '@/lib/actions/upload';

export default function UnitsManagement() {
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'branch1' | 'branch2' | 'apartments'>('branch1');
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Feature management temporary states
  const [newFeatureAr, setNewFeatureAr] = useState('');
  const [newFeatureEn, setNewFeatureEn] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    const data = await getSystemUnits();
    setAllUnits(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const filteredUnits = allUnits.filter(u => {
    if (activeTab === 'branch1') return u.branch === 1 && u.type === 'studio';
    if (activeTab === 'branch2') return u.branch === 2 && u.type === 'studio';
    return u.type === 'apartment';
  });

  const toggleStatus = async (id: string, currentStatus: string) => {
    setIsLoading(true);
    const nextStatus = currentStatus === 'متاح' ? 'صيانة' : 'متاح';
    await updateUnitDetails(id, { status: nextStatus });
    await refreshData();
  };

  const handleEdit = (unit: any) => {
    setEditingUnit(JSON.parse(JSON.stringify(unit)));
    setIsModalOpen(true);
  };

  const saveChanges = async () => {
    if (editingUnit) {
      setIsLoading(true);
      await updateUnitDetails(editingUnit.id, editingUnit);
      setIsModalOpen(false);
      setEditingUnit(null);
      await refreshData();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingUnit) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const publicUrl = await uploadImage(formData);
      
      setEditingUnit({
        ...editingUnit,
        images: [...(editingUnit.images || []), publicUrl]
      });
    } catch (error) {
      alert('حدث خطأ أثناء رفع الصورة. تواصل مع المطور.');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = [...editingUnit.images];
    updatedImages.splice(index, 1);
    setEditingUnit({ ...editingUnit, images: updatedImages });
  };

  const addFeature = () => {
    if (!newFeatureAr.trim() || !newFeatureEn.trim()) return;
    
    const updatedFeatures = {
        ar: [...(editingUnit.features?.ar || []), newFeatureAr.trim()],
        en: [...(editingUnit.features?.en || []), newFeatureEn.trim()],
    };
    
    setEditingUnit({ ...editingUnit, features: updatedFeatures });
    setNewFeatureAr('');
    setNewFeatureEn('');
  };

  const removeFeature = (index: number) => {
    const updatedAr = [...(editingUnit.features?.ar || [])];
    const updatedEn = [...(editingUnit.features?.en || [])];
    updatedAr.splice(index, 1);
    updatedEn.splice(index, 1);
    
    setEditingUnit({
        ...editingUnit,
        features: { ar: updatedAr, en: updatedEn }
    });
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {isLoading && !isModalOpen && (
         <div className="absolute top-0 right-0 p-4 animate-pulse z-10">
            <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">جاري المزامنة...</span>
         </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black mb-2 text-white">إدارة <span className="text-gold">الوحدات</span></h1>
          <p className="text-gray-400 text-sm">تحكم كامل في الصور، المميزات، والبيانات الفعلية لكل وحدة.</p>
        </div>
        
        {/* Category Tabs */}
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full md:w-auto">
          {[
            { id: 'branch1', label: 'مزيج 1 (فرع 1)', icon: '🏢' },
            { id: 'branch2', label: 'مزيج 2 (فرع 2)', icon: '🏨' },
            { id: 'apartments', label: 'الشقق الفندقية', icon: '🏠' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 md:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === tab.id 
                ? 'bg-gold text-navy shadow-lg shadow-gold/20' 
                : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredUnits.length === 0 && !isLoading ? (
           <div className="col-span-full py-20 text-center text-gray-500 font-bold glass-card">لا توجد وحدات في هذا القسم حالياً.</div>
        ) : filteredUnits.map((unit) => (
          <div key={unit.id} className="glass-card !p-0 overflow-hidden flex flex-col group border border-white/5 hover:border-gold/40 transition-all duration-500 hover:-translate-y-1">
            <div className="relative aspect-video overflow-hidden bg-navy-light">
              <img 
                src={unit.images[0] || '/placeholder.png'} 
                alt={unit.title.ar} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100"
              />
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg border ${
                  unit.status === 'متاح' 
                    ? 'bg-success/20 text-success border-success/30' 
                    : 'bg-danger/20 text-danger border-danger/30'
                }`}>
                  {unit.status}
                </span>
                <span className="text-[9px] font-black uppercase px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg bg-black/40 text-white border border-white/10">
                   {unit.images.length} صور 🖼️
                </span>
              </div>
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold text-gold border border-gold/30">
                {unit.id}
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-white line-clamp-1">{unit.title.ar}</h3>
                  <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gold/60 font-bold uppercase tracking-tighter">
                          {unit.type === 'studio' ? 'Studio' : 'Apartment'}
                      </span>
                  </div>
                </div>
                <div className="text-gold font-black text-sm whitespace-nowrap">
                  {unit.price || '---'} <span className="text-[9px]">ج.م</span>
                </div>
              </div>

              {/* Features Preview (mini icons) */}
              <div className="flex flex-wrap gap-1 mb-4 opacity-40">
                  {unit.features?.ar.slice(0, 3).map((f: string, i: number) => (
                      <span key={i} className="text-[8px] bg-white/10 px-2 py-0.5 rounded-md text-white whitespace-nowrap font-medium">{f}</span>
                  ))}
                  {unit.features?.ar.length > 3 && <span className="text-[8px] text-gold">+{unit.features.ar.length - 3}</span>}
              </div>
              
              <div className="mt-auto pt-4 flex gap-2">
                <button 
                  onClick={() => toggleStatus(unit.id, unit.status)}
                  className={`flex-1 py-2.5 rounded-xl border font-black text-[10px] transition-all outline-none ${
                    unit.status === 'متاح' 
                      ? 'border-warning/30 text-warning hover:bg-warning/10' 
                      : 'border-success/30 text-success hover:bg-success/10'
                  }`}
                >
                  {unit.status === 'متاح' ? 'تحويل للصيانة 🛠️' : 'تفعيل للجمهور ✅'}
                </button>
                <button 
                  onClick={() => handleEdit(unit)}
                  className="p-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-white transition-colors"
                  title="تعديل البيانات وتحكم الوسائط"
                >
                  ✏️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Edit Modal */}
      {isModalOpen && editingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-[#0a0f1e] border border-white/10 w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden animate-scale-in my-8">
            <div className="p-8 border-b border-white/5 flex justify-between items-center px-10">
              <div>
                <h2 className="text-2xl font-black text-white">إدارة <span className="text-gold">بيانات الوحدة</span></h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Ref ID: {editingUnit.id}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-3xl">×</button>
            </div>
            
            <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar text-right" dir="rtl">
              
              {/* Media Section */}
              <section className="space-y-6">
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                    <h3 className="text-sm font-black text-gold uppercase tracking-widest">🖼️ معرض الصور (من الديسك)</h3>
                    <div className="flex gap-4 items-center">
                        <input 
                            type="file" 
                            accept="image/*" 
                            hidden 
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-black px-6 py-2.5 rounded-full transition-all border border-white/10 flex items-center gap-2"
                        >
                            {isUploading ? 'جاري الرفع...' : 'إضافة صورة من جهازك +'}
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
                    {editingUnit.images?.map((img: string, idx: number) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group">
                            <img src={img} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button 
                                    onClick={() => removeImage(idx)}
                                    className="bg-danger text-white p-2 rounded-xl text-xs hover:scale-110 transition-transform"
                                >
                                    حذف
                                </button>
                            </div>
                        </div>
                    ))}
                    {editingUnit.images?.length === 0 && (
                        <div className="col-span-full py-10 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-gray-500 italic text-xs">
                            لا توجد صور حالياً. اضغط لإضافة صور جديدة.
                        </div>
                    )}
                </div>
              </section>

              {/* General Data Section */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gold uppercase tracking-widest">العنوان (بالعربية)</label>
                        <input 
                            type="text" 
                            value={editingUnit.title.ar}
                            onChange={(e) => setEditingUnit({...editingUnit, title: {...editingUnit.title, ar: e.target.value}})}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-gold outline-none transition-all font-bold"
                        />
                    </div>
                    <div className="space-y-3" dir="ltr">
                        <label className="text-[10px] font-black text-gold uppercase tracking-widest block text-left">TITLE (ENGLISH)</label>
                        <input 
                            type="text" 
                            value={editingUnit.title.en}
                            onChange={(e) => setEditingUnit({...editingUnit, title: {...editingUnit.title, en: e.target.value}})}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-gold outline-none transition-all font-bold"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gold uppercase tracking-widest">السعر لليلة (ج.م)</label>
                        <input 
                            type="text" 
                            value={editingUnit.price || ''}
                            onChange={(e) => setEditingUnit({...editingUnit, price: e.target.value})}
                            placeholder="مثال: 1500"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-gold outline-none transition-all font-black text-left"
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gold uppercase tracking-widest">الوصف (بالعربية)</label>
                        <textarea 
                            rows={4}
                            value={editingUnit.description.ar}
                            onChange={(e) => setEditingUnit({...editingUnit, description: {...editingUnit.description, ar: e.target.value}})}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-gold outline-none transition-all resize-none leading-relaxed"
                        />
                    </div>
                    <div className="space-y-3" dir="ltr">
                        <label className="text-[10px] font-black text-gold uppercase tracking-widest block text-left">DESCRIPTION (ENGLISH)</label>
                        <textarea 
                            rows={4}
                            value={editingUnit.description.en}
                            onChange={(e) => setEditingUnit({...editingUnit, description: {...editingUnit.description, en: e.target.value}})}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-gold outline-none transition-all resize-none leading-relaxed text-left"
                        />
                    </div>
                </div>
              </section>

              {/* Features Section */}
              <section className="space-y-6 pt-6 border-t border-white/5">
                 <h3 className="text-sm font-black text-gold uppercase tracking-widest">✨ مميزات هذه الوحدة</h3>
                 
                 <div className="bg-white/5 p-6 rounded-[30px] border border-white/5 space-y-6">
                     {/* Add Feature Form */}
                     <div className="flex flex-col md:flex-row gap-4 items-end">
                         <div className="flex-1 space-y-2 w-full">
                            <label className="text-[9px] font-bold text-gray-500 uppercase">الميزة بالعربية</label>
                            <input 
                                type="text" 
                                placeholder="مثال: تكييف مركزي"
                                value={newFeatureAr}
                                onChange={e => setNewFeatureAr(e.target.value)}
                                className="w-full bg-navy border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white"
                            />
                         </div>
                         <div className="flex-1 space-y-2 w-full" dir="ltr">
                            <label className="text-[9px] font-bold text-gray-500 uppercase block text-left">FEATURE IN ENGLISH</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Central AC"
                                value={newFeatureEn}
                                onChange={e => setNewFeatureEn(e.target.value)}
                                className="w-full bg-navy border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white text-left"
                            />
                         </div>
                         <button 
                            onClick={addFeature}
                            className="bg-gold text-navy font-black text-[10px] px-8 py-3 rounded-xl hover:scale-105 transition-transform"
                         >
                             إضافة ميزة +
                         </button>
                     </div>

                     {/* Features List View */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-white/40 block mb-4">القائمة الحالية (AR)</label>
                             <div className="space-y-2">
                                {editingUnit.features?.ar.map((f: string, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 px-4 py-2.5 rounded-xl border border-white/5">
                                        <span className="text-xs font-bold text-white">{f}</span>
                                        <button onClick={() => removeFeature(i)} className="text-danger hover:scale-110 p-1">✕</button>
                                    </div>
                                ))}
                             </div>
                         </div>
                         <div className="space-y-2" dir="ltr">
                             <label className="text-[10px] font-black text-white/40 block mb-4 text-left">CURRENT LIST (EN)</label>
                             <div className="space-y-2">
                                {editingUnit.features?.en.map((f: string, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 px-4 py-2.5 rounded-xl border border-white/5">
                                        <span className="text-xs font-bold text-white">{f}</span>
                                        <button onClick={() => removeFeature(i)} className="text-danger hover:scale-110 p-1">✕</button>
                                    </div>
                                ))}
                             </div>
                         </div>
                     </div>
                 </div>
              </section>

            </div>

            <div className="p-10 border-t border-white/5 flex gap-6 px-14">
              <button 
                onClick={saveChanges}
                className="flex-1 bg-gold hover:bg-gold-dark text-navy font-black py-4 rounded-[30px] shadow-2xl shadow-gold/30 transition-all active:scale-95 text-lg"
              >
                تحديث وحفظ البيانات ✅
              </button>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-12 bg-white/5 hover:bg-white/10 text-white font-black rounded-[30px] transition-all"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card bg-gold/10 border-gold/30 flex gap-6 p-8 rounded-[40px] items-center">
        <span className="text-4xl">💡</span>
        <div>
            <h4 className="font-black text-white mb-1">نصيحة للإدارة الذكية</h4>
            <p className="text-[10px] text-gray-400 leading-relaxed font-bold">
               هذا القسم يتحكم في <span className="text-gold">العنصر البصري</span> للموقع. الصور التي ترفعها والمميزات التي تضيفها تظهر مباشرة في صفحة التفاصيل للوحدة. راعي أن تكون الصور بجودة عالية (HD) لتعزيز تجربة العميل.
            </p>
        </div>
      </div>
    </div>
  );
}
