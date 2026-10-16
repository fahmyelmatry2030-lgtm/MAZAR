"use server";

import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function uploadImage(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('لم يتم اختيار ملف للرفع.');
  }

  // Check file size (allowing up to 15MB)
  const MAX_SIZE = 15 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('حجم الصورة كبير جداً. الحد الأقصى هو 15 ميجابايت.');
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new Error('قاعدة البيانات غير متصلة، لا يمكن رفع الملفات حالياً.');
    
    const safeName = file.name.replace(/[^\w.\-]+/g, '-');
    const objectPath = `${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(objectPath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
        console.error('Supabase Storage Error:', uploadError);
        throw new Error(`فشل رفع الملف: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from('uploads').getPublicUrl(objectPath);
    if (!data?.publicUrl) throw new Error('فشل في إنشاء رابط الصورة العام.');

    return data.publicUrl;
  } catch (error: any) {
    console.error('Upload Action Error:', error);
    throw new Error(error.message || 'حدث خطأ غير متوقع أثناء حفظ الملف.');
  }
}
