import imageCompression from 'browser-image-compression';
import { uploadImage } from '@/lib/actions/upload';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * دالة مساعدة ذكية لضغط ورفع إيصالات التحويل والصور:
 * 1. تقوم بضغط الصورة تلقائياً في المتصفح لتقليل حجمها (من 10-20 ميجا إلى أقل من 1 ميجا) مع الحفاظ على أعلى وضوح.
 * 2. تحاول الرفع المباشر إلى Supabase Storage لتجاوز قيود حجم الخادم وVercel وتوفير سرعة فائقة.
 * 3. في حالة فشل الرفع المباشر، تلجأ تلقائياً إلى Server Action المحدث لرفعها بأمان.
 */
export async function processAndUploadReceipt(file: File): Promise<string> {
  if (!file) {
    throw new Error('لم يتم اختيار ملف للرفع.');
  }

  let fileToUpload = file;

  // ضغط الصورة تلقائياً إذا كانت من نوع صورة
  if (file.type.startsWith('image/')) {
    try {
      const options = {
        maxSizeMB: 1, // الهدف 1 ميجا كحد أقصى لتكون سريعة جداً
        maxWidthOrHeight: 2048, // دقة عالية جداً كافية لقراءة أي إيصال أو تفاصيل بنكية
        useWebWorker: true,
        initialQuality: 0.85,
      };
      fileToUpload = await imageCompression(file, options);
    } catch (compressErr) {
      console.warn('Receipt compression fallback to original file:', compressErr);
    }
  }

  // المحاولة الأولى: رفع مباشر من المتصفح إلى Supabase Storage (سريع جداً وبدون حدود Vercel)
  try {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const safeName = (fileToUpload.name || 'receipt.jpg').replace(/[^\w.\-]+/g, '-');
      const objectPath = `receipts/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(objectPath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
          contentType: fileToUpload.type || 'image/jpeg',
        });

      if (!uploadError) {
        const { data } = supabase.storage.from('uploads').getPublicUrl(objectPath);
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      } else {
        console.warn('Client-side storage direct upload failed, fallback to server action:', uploadError.message);
      }
    }
  } catch (clientErr) {
    console.warn('Direct upload exception, fallback to server action:', clientErr);
  }

  // المحاولة الثانية: عبر Server Action
  const formData = new FormData();
  formData.append('file', fileToUpload);
  return await uploadImage(formData);
}
