"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { getPublicSystemUnits, updateUnitDetails } from '@/lib/data-init';
import { uploadImage } from '@/lib/actions/upload';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import imageCompression from 'browser-image-compression';
import Image from 'next/image';

export default function UnitsManagement() {
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'studios' | 'apartments'>('studios');
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState('Owner');
  
  // Feature management temporary states
  const [newFeatureAr, setNewFeatureAr] = useState('');
  const [newFeatureEn, setNewFeatureEn] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const info = sessionStorage.getItem('adminInfo');
    if (info) setAdminRole(JSON.parse(info).role || 'Owner');
  }, []);

  const isModerator = adminRole === 'Moderator';

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    const data = await getPublicSystemUnits();
    setAllUnits(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const getStudioRealNumber = (id: string) => {
    if (id.startsWith('b1-s')) {
      return parseInt(id.replace('b1-s', ''), 10) || 0;
    }
    if (id.startsWith('b2-s')) {
      return (parseInt(id.replace('b2-s', ''), 10) || 0) + 12;
    }
    return 999;
  };

  const getApartmentRealNumber = (id: string) => {
    if (id.startsWith('apt-')) {
      return parseInt(id.replace('apt-', ''), 10) || 0;
    }
    if (id.startsWith('p-s')) {
      return parseInt(id.replace('p-s', ''), 10) || 0;
    }
    return 999;
  };

  const filteredUnits = allUnits
    .filter(u => {
      if (activeTab === 'studios') return u.type === 'studio';
      return u.type === 'apartment';
    })
    .sort((a, b) => {
      if (activeTab === 'studios') {
        return getStudioRealNumber(a.id) - getStudioRealNumber(b.id);
      } else {
        return getApartmentRealNumber(a.id) - getApartmentRealNumber(b.id);
      }
    });

  const toggleStatus = async (id: string, currentStatus: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const nextStatus = currentStatus === 'متاح' ? 'صيانة' : 'متاح';
      await updateUnitDetails(id, { status: nextStatus });
      await refreshData();
    } catch (err) {
      console.error(err);
      setError('فشل تعديل حالة الوحدة. تأكد من إعدادات قاعدة البيانات.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (unit: any) => {
    setEditingUnit(JSON.parse(JSON.stringify(unit)));
    setIsModalOpen(true);
  };

  const saveChanges = async () => {
    if (editingUnit) {
      setIsLoading(true);
      setError(null);
      try {
        await updateUnitDetails(editingUnit.id, isModerator ? { price: editingUnit.price } : editingUnit);
        setIsModalOpen(false);
        setEditingUnit(null);
        await refreshData();
      } catch (err) {
        console.error(err);
        setError('فشل حفظ تفاصيل الوحدة.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isModerator) return;
    const file = e.target.files?.[0];
    if (!file || !editingUnit) return;

    setIsUploading(true);
    try {
      // Image Compression Logic
      const compressionOptions = {
        maxSizeMB: 0.8, // Target 800KB
        maxWidthOrHeight: 1600,
        useWebWorker: true
      };
      
      let fileToUpload = file;
      try {
          fileToUpload = await imageCompression(file, compressionOptions);
          console.log(`Compressed: ${file.size / 1024 / 1024}MB -> ${fileToUpload.size / 1024 / 1024}MB`);
      } catch (e) {
          console.warn('Compression failed, using original file', e);
      }

      let publicUrl = '';
      
      // Try Client-side upload first (to bypass Vercel limits)
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const safeName = fileToUpload.name.replace(/[^\w.\-]+/g, '-');
        const objectPath = `${Date.now()}-${safeName}`;
        
        const { error } = await supabase.storage
          .from('uploads')
          .upload(objectPath, fileToUpload, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (error) {
           const formData = new FormData();
           formData.append('file', fileToUpload);
           publicUrl = await uploadImage(formData);
        } else {
           const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(objectPath);
           publicUrl = urlData.publicUrl;
        }
      } else {
        const formData = new FormData();
        formData.append('file', fileToUpload);
        publicUrl = await uploadImage(formData);
      }
      
      setEditingUnit({
        ...editingUnit,
        images: [...(editingUnit.images || []), publicUrl]
      });
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء رفع الصورة. تأكد من اتصال الإنترنت وحجم الصورة.');
      console.error(error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const updatedImages = [...editingUnit.images];
    updatedImages.splice(index, 1);
    setEditingUnit({ ...editingUnit, images: updatedImages });
  };

  const replaceImage = async (index: number, file: File) => {
    if (isModerator) return;
    setIsUploading(true);
    try {
        // Image Compression
        const compressionOptions = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1600,
            useWebWorker: true
        };
        let fileToUpload = file;
        try {
            fileToUpload = await imageCompression(file, compressionOptions);
        } catch (e) {}

        let publicUrl = '';
        const supabase = getSupabaseBrowserClient();
        
        if (supabase) {
            const safeName = fileToUpload.name.replace(/[^\w.\-]+/g, '-');
            const objectPath = `${Date.now()}-${safeName}`;
            const { error } = await supabase.storage.from('uploads').upload(objectPath, fileToUpload);
            
            if (error) {
                const formData = new FormData();
                formData.append('file', fileToUpload);
                publicUrl = await uploadImage(formData);
            } else {
                const { data } = supabase.storage.from('uploads').getPublicUrl(objectPath);
                publicUrl = data.publicUrl;
            }
        } else {
            const formData = new FormData();
            formData.append('file', fileToUpload);
            publicUrl = await uploadImage(formData);
        }
        
        const updatedImages = [...editingUnit.images];
        updatedImages[index] = publicUrl;
        setEditingUnit({ ...editingUnit, images: updatedImages });
    } catch (error: any) {
        alert(error.message || 'خطأ في استبدال الصورة');
    } finally {
        setIsUploading(false);
    }
  };

  const addFeature = () => {
    if (isModerator) return;
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
    if (isModerator) return;
    const updatedAr = [...(editingUnit.features?.ar || [])];
    const updatedEn = [...(editingUnit.features?.en || [])];
    updatedAr.splice(index, 1);
    updatedEn.splice(index, 1);
    
    setEditingUnit({
        ...editingUnit,
        features: { ar: updatedAr, en: updatedEn }
    });
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  return (
    <>
      <div className="space-y-8 animate-fade-in relative">
        {isLoading && !isModalOpen && (
           <div className="absolute top-0 right-0 p-4 animate-pulse z-10">
              <span className="text-[10px] font-black text-[#C1A68D] uppercase tracking-[0.2em]">جاري المزامنة...</span>
           </div>
        )}

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black mb-2 text-[#2A2723]">إدارة <span className="text-[#C1A68D]">الوحدات</span></h1>
            <p className="text-[#7A7061] font-bold opacity-70 text-sm">تحكم كامل في الصور، المميزات، والبيانات الفعلية لكل وحدة.</p>
          </div>
          
          <div className="flex bg-white/50 p-1.5 rounded-2xl border border-[#EAE4D9] w-full md:w-auto shadow-sm">
            {[
              { id: 'studios', label: 'الاستوديوهات الفندقية', icon: '🏨' },
              { id: 'apartments', label: 'الشقق الفاخرة', icon: '🏠' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 md:px-6 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id 
                  ? 'bg-[#2A2723] text-white shadow-lg' 
                  : 'text-[#7A7061] hover:text-[#2A2723]'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 font-black text-xs animate-scale-in">
            ⚠️ {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredUnits.length === 0 && !isLoading ? (
             <div className="col-span-full py-32 text-center text-[#7A7061] font-black uppercase tracking-[0.3em] opacity-30 bg-white rounded-[2.5rem] border border-[#EAE4D9]/50 shadow-sm">لا توجد وحدات في هذا القسم حالياً.</div>
          ) : filteredUnits.map((unit) => (
            <div key={unit.id} className="bg-white rounded-[2rem] overflow-hidden flex flex-col group border border-[#EAE4D9]/50 hover:border-[#C1A68D]/40 transition-all duration-500 hover:-translate-y-1 shadow-sm hover:shadow-xl">
              <div className="relative aspect-video overflow-hidden bg-[#FDFBF7]">
                <Image 
                  src={unit?.images?.[0] || 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'} 
                  alt={unit.title.ar} 
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg border ${
                    unit.status === 'متاح' 
                      ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                      : 'bg-red-500/10 text-red-600 border-red-500/20'
                  }`}>
                    {unit.status}
                  </span>
                  <span className="text-[9px] font-black uppercase px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg bg-white/80 text-[#2A2723] border border-[#EAE4D9]">
                     {unit.images?.length || 0} صور 🖼️
                  </span>
                </div>
                <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black text-[#C1A68D] border border-[#EAE4D9]">
                  {unit.id}
                </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <h3 className="font-black text-sm text-[#2A2723] line-clamp-1">{unit.title.ar}</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#C1A68D] font-black uppercase tracking-tighter">
                            {unit.type === 'studio' ? 'Studio' : 'Apartment'}
                        </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {unit.originalPrice && (
                       <span className="text-[10px] text-[#7A7061] line-through decoration-red-500 mb-0.5 opacity-50">{unit.originalPrice} ج.م</span>
                    )}
                    <div className="text-[#C1A68D] font-black text-sm whitespace-nowrap">
                      {unit.price || '---'} <span className="text-[9px]">ج.م</span>
                    </div>
                  </div>
                </div>

                {unit.next_booking && unit.next_booking !== 'لا يوجد' && (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1 text-[10px] font-black text-amber-900 mb-3 flex items-center gap-1.5 shadow-2xs">
                    <span>🗓️</span>
                    <span className="truncate">{unit.next_booking}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-5">
                    {(unit.features?.ar || []).slice(0, 3).map((f: string, i: number) => (
                        <span key={i} className="text-[8px] bg-[#FDFBF7] px-2 py-1 rounded-lg text-[#7A7061] whitespace-nowrap font-black border border-[#EAE4D9]/50">{f}</span>
                    ))}
                    {(unit.features?.ar?.length || 0) > 3 && <span className="text-[8px] text-[#C1A68D] font-black">+{(unit.features?.ar?.length || 0) - 3}</span>}
                </div>
                
                <div className="mt-auto pt-4 flex gap-2">
                  {!isModerator && <button 
                    onClick={() => toggleStatus(unit.id, unit.status)}
                    className={`flex-1 py-3 rounded-xl border font-black text-[10px] transition-all outline-none ${
                      unit.status === 'متاح' 
                        ? 'border-orange-200 text-orange-600 hover:bg-orange-50' 
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {unit.status === 'متاح' ? 'تحويل للصيانة 🛠️' : 'تفعيل للجمهور ✅'}
                  </button>}
                  <button 
                    onClick={() => handleEdit(unit)}
                    className="p-3 rounded-xl border border-[#EAE4D9] hover:bg-[#FDFBF7] text-xl transition-all shadow-sm active:scale-95"
                    title="تعديل البيانات وتحكم الوسائط"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#C1A68D]/10 border border-[#C1A68D]/30 flex gap-8 p-10 rounded-[3rem] items-center shadow-sm">
          <span className="text-5xl">💡</span>
          <div>
              <h4 className="font-black text-[#2A2723] mb-2 text-lg">نصيحة للإدارة الذكية</h4>
              <p className="text-[11px] text-[#7A7061] leading-relaxed font-bold opacity-80">
                 هذا القسم يتحكم في <span className="text-[#C1A68D] font-black">العنصر البصري</span> للموقع. الصور التي ترفعها والمميزات التي تضيفها تظهر مباشرة في صفحة التفاصيل للوحدة. راعي أن تكون الصور بجودة عالية (HD) لتعزيز تجربة العميل.
              </p>
          </div>
        </div>
      </div>

      {isModalOpen && editingUnit && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-white/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-[#FDFBF7] border border-[#EAE4D9] w-full max-w-5xl h-[92vh] rounded-[3rem] shadow-[0_50px_150px_rgba(0,0,0,0.15)] overflow-hidden animate-scale-in relative flex flex-col">
            <div className="p-8 md:p-10 border-b border-[#EAE4D9]/50 flex justify-between items-center px-8 md:px-14 bg-white/50 flex-none">
              <div>
                <h2 className="text-3xl font-black text-[#2A2723]">إدارة <span className="text-[#C1A68D]">بيانات الوحدة</span></h2>
                <p className="text-[10px] text-[#7A7061] font-black uppercase tracking-widest mt-1.5 opacity-60">Ref ID: {editingUnit.id}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#7A7061] hover:text-red-500 text-4xl transition-colors">×</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 md:p-14 space-y-12 custom-scrollbar text-right" dir="rtl">
              <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">العنوان (بالعربية)</label>
                        <input 
                            type="text" 
                            value={editingUnit.title.ar}
                            readOnly={isModerator}
                            onChange={(e) => setEditingUnit({...editingUnit, title: {...editingUnit.title, ar: e.target.value}})}
                            className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-6 py-4 text-sm text-[#2A2723] focus:border-[#C1A68D] outline-none transition-all font-black shadow-sm"
                        />
                    </div>
                    <div className="space-y-3" dir="ltr">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest block text-left px-2">TITLE (ENGLISH)</label>
                        <input 
                            type="text" 
                            value={editingUnit.title.en}
                            readOnly={isModerator}
                            onChange={(e) => setEditingUnit({...editingUnit, title: {...editingUnit.title, en: e.target.value}})}
                            className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-6 py-4 text-sm text-[#2A2723] focus:border-[#C1A68D] outline-none transition-all font-black text-left shadow-sm"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">السعر لليلة (ج.م)</label>
                        <input 
                            type="text" 
                            value={editingUnit.price || ''}
                            onChange={(e) => setEditingUnit({...editingUnit, price: e.target.value})}
                            placeholder="مثال: 1500"
                            className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-6 py-4 text-sm text-[#2A2723] focus:border-[#C1A68D] outline-none transition-all font-black text-left shadow-sm"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#7A7061] uppercase tracking-widest px-2 opacity-60">السعر الأساسي (قبل الخصم) <span className="text-red-500 line-through text-[8px]">1500</span></label>
                        <input 
                            type="text" 
                            value={editingUnit.originalPrice || ''}
                            readOnly={isModerator}
                            onChange={(e) => setEditingUnit({...editingUnit, originalPrice: e.target.value})}
                            placeholder="اختياري: يعرض للزبائن وعليه خط كأنه خصم"
                            className="w-full bg-white border border-[#EAE4D9] rounded-2xl px-6 py-4 text-sm text-[#7A7061] focus:border-[#C1A68D] outline-none transition-all font-black text-left shadow-sm opacity-60"
                        />
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">الوصف (بالعربية)</label>
                        <textarea 
                            rows={4}
                            value={editingUnit.description?.ar || ''}
                            readOnly={isModerator}
                            onChange={(e) => setEditingUnit({...editingUnit, description: {...(editingUnit.description || {}), ar: e.target.value}})}
                            className="w-full bg-white border border-[#EAE4D9] rounded-3xl px-6 py-5 text-sm text-[#2A2723] focus:border-[#C1A68D] outline-none transition-all resize-none leading-relaxed font-bold shadow-sm"
                        />
                    </div>
                    <div className="space-y-3" dir="ltr">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest block text-left px-2">DESCRIPTION (ENGLISH)</label>
                        <textarea 
                            rows={4}
                            value={editingUnit.description?.en || ''}
                            readOnly={isModerator}
                            onChange={(e) => setEditingUnit({...editingUnit, description: {...(editingUnit.description || {}), en: e.target.value}})}
                            className="w-full bg-white border border-[#EAE4D9] rounded-3xl px-6 py-5 text-sm text-[#2A2723] focus:border-[#C1A68D] outline-none transition-all resize-none leading-relaxed text-left font-bold shadow-sm"
                        />
                    </div>
                </div>
              </section>

              <section className="space-y-8 pt-10 border-t border-[#EAE4D9]/50">
                <div className="bg-white p-8 rounded-[1.5rem] border border-[#EAE4D9]/50 shadow-sm space-y-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-black text-[#2A2723] uppercase tracking-widest">🖼️ معرض الصور والوسائط (Media Library)</h3>
                        <div className="flex gap-4 items-center">
                            <input 
                                type="file" 
                                accept="image/*" 
                                hidden 
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            {!isModerator && <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="bg-[#2A2723] hover:bg-black text-white text-[10px] font-black px-8 py-3 rounded-full transition-all shadow-lg shadow-black/10 flex items-center gap-2"
                            >
                                {isUploading ? 'جاري الرفع...' : 'رفع صورة إضافية من الجهاز +'}
                            </button>}
                        </div>
                    </div>

                    <div className="space-y-3 pt-5 border-t border-[#EAE4D9]/30">
                        <label className="text-[10px] font-black text-[#C1A68D] uppercase tracking-widest px-2">رابط فيديو المعاينة (Video URL)</label>
                        <input 
                            type="text" 
                            value={editingUnit.video || ''}
                            readOnly={isModerator}
                            onChange={(e) => setEditingUnit({...editingUnit, video: e.target.value})}
                            placeholder="انسخ رابط الفيديو هنا"
                            className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-2xl px-6 py-4 text-xs text-[#2A2723] focus:border-[#C1A68D] outline-none transition-all font-bold"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {editingUnit.images && editingUnit.images.length > 0 ? (
                        editingUnit.images.map((img: string, idx: number) => (
                            <div key={`unit-img-${idx}`} className="relative aspect-square rounded-[2rem] overflow-hidden border border-[#EAE4D9] group shadow-sm bg-white">
                                {img ? (
                                    <Image 
                                        src={img} 
                                        alt="Unit"
                                        fill
                                        sizes="(max-width: 768px) 50vw, 25vw"
                                        className="object-cover group-hover:scale-110 transition-transform" 
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300 text-[8px]">IMAGE_ERR</div>
                                )}
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                    {!isModerator && <label className="cursor-pointer bg-white text-[#2A2723] px-5 py-2 rounded-xl text-[10px] font-black hover:scale-105 transition-all shadow-xl">
                                        استبدال
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if(file) replaceImage(idx, file);
                                            }} 
                                        />
                                    </label>}
                                    {!isModerator && <button 
                                        onClick={() => removeImage(idx)}
                                        className="bg-red-600 text-white px-5 py-2 rounded-xl text-[10px] hover:scale-105 transition-all font-black shadow-lg shadow-red-600/20"
                                    >
                                        حذف
                                    </button>}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 border-2 border-dashed border-[#EAE4D9] rounded-[2.5rem] flex flex-col items-center justify-center text-[#7A7061] italic text-xs opacity-40">
                            لا توجد صور حالياً. اضغط للأعلى لزيادة الصور.
                        </div>
                    )}
                </div>
              </section>

              <section className="space-y-8 pt-10 border-t border-[#EAE4D9]/50">
                 <h3 className="text-sm font-black text-[#C1A68D] uppercase tracking-widest px-2">✨ مميزات هذه الوحدة (Features)</h3>
                 
                 <div className="bg-white p-8 rounded-[2.5rem] border border-[#EAE4D9]/50 space-y-8 shadow-sm">
                     <div className="flex flex-col md:flex-row gap-6 items-end">
                         <div className="flex-1 space-y-3 w-full">
                            <label className="text-[10px] font-black text-[#7A7061] uppercase px-2 opacity-60">الميزة بالعربية</label>
                            <input 
                                type="text" 
                                placeholder="مثال: تكييف مركزي"
                                value={newFeatureAr}
                                readOnly={isModerator}
                                onChange={e => setNewFeatureAr(e.target.value)}
                                className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-5 py-3 text-xs text-[#2A2723] font-bold"
                            />
                         </div>
                         <div className="flex-1 space-y-3 w-full" dir="ltr">
                            <label className="text-[10px] font-black text-[#7A7061] uppercase block text-left px-2 opacity-60">FEATURE (EN)</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Central AC"
                                value={newFeatureEn}
                                readOnly={isModerator}
                                onChange={e => setNewFeatureEn(e.target.value)}
                                className="w-full bg-[#FDFBF7] border border-[#EAE4D9] rounded-xl px-5 py-3 text-xs text-[#2A2723] text-left font-bold"
                            />
                         </div>
                         {!isModerator && <button 
                            onClick={addFeature}
                            className="bg-[#C1A68D] text-white font-black text-[10px] px-8 py-3.5 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-[#C1A68D]/20 active:scale-95"
                         >
                             إضافة +
                         </button>}
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                         <div className="space-y-3">
                             <label className="text-[10px] font-black text-[#C1A68D] block mb-4 border-b border-[#EAE4D9] pb-2">القائمة الحالية (AR)</label>
                             <div className="space-y-2">
                                {(editingUnit.features?.ar || []).map((f: string, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-[#FDFBF7] px-5 py-3 rounded-xl border border-[#EAE4D9]/50 group">
                                        <span className="text-xs font-bold text-[#2A2723]">{f}</span>
                                        {!isModerator && <button onClick={() => removeFeature(i)} className="text-red-500 hover:scale-125 transition-transform p-1 opacity-40 group-hover:opacity-100">✕</button>}
                                    </div>
                                ))}
                             </div>
                         </div>
                         <div className="space-y-3" dir="ltr">
                             <label className="text-[10px] font-black text-[#C1A68D] block mb-4 text-left border-b border-[#EAE4D9] pb-2">CURRENT LIST (EN)</label>
                             <div className="space-y-2">
                                {(editingUnit.features?.en || []).map((f: string, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-[#FDFBF7] px-5 py-3 rounded-xl border border-[#EAE4D9]/50 group">
                                        <span className="text-xs font-bold text-[#2A2723]">{f}</span>
                                        {!isModerator && <button onClick={() => removeFeature(i)} className="text-red-500 hover:scale-125 transition-transform p-1 opacity-40 group-hover:opacity-100">✕</button>}
                                    </div>
                                ))}
                             </div>
                         </div>
                     </div>
                 </div>
              </section>

            </div>

            <div className="p-10 md:p-14 border-t border-[#EAE4D9]/50 flex gap-6 px-14 bg-white/50 flex-none">
              <button 
                onClick={saveChanges}
                className="flex-[2] bg-[#2A2723] hover:bg-black text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-black/10 transition-all active:scale-95 text-lg"
              >
                تحديث وحفظ البيانات ✅
              </button>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-white border border-[#EAE4D9] text-[#7A7061] font-black rounded-[2rem] hover:bg-[#FDFBF7] transition-all"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
