export function formatWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  let cleanPhone = phone.replace(/[^0-9]/g, '');

  // Handle double zero prefix
  if (cleanPhone.startsWith('00')) {
    cleanPhone = cleanPhone.substring(2);
  }

  // SELF-HEALING: If it starts with 20966, it's almost certainly a Saudi number 
  // that was incorrectly prefixed with Egyptian 20 (20 + 966...)
  if (cleanPhone.startsWith('20966')) {
    return cleanPhone.substring(2);
  }

  // Handle leading zero
  if (cleanPhone.startsWith('0')) {
    // Saudi Arabia numbers often start with 05... or 0966...
    if (cleanPhone.startsWith('0966')) {
      return cleanPhone.substring(1); // Remove leading 0 from 0966...
    }
    
    // Saudi mobile numbers are 10 digits starting with 05...
    if (cleanPhone.length === 10 && cleanPhone.startsWith('05')) {
      return '966' + cleanPhone.substring(1);
    }

    // Default to Egypt if starts with 0 (like 010...)
    return '20' + cleanPhone.substring(1);
  }

  // If it starts with 966, return as is (Saudi)
  if (cleanPhone.startsWith('966')) {
    return cleanPhone;
  }

  // If it starts with 20, return as is (Egypt)
  if (cleanPhone.startsWith('20')) {
    return cleanPhone;
  }

  // If phone already starts with any international code (e.g., 1, 31, 33, 44, 49, 971, 965, etc.) and is long enough
  // Don't arbitrarily prepend 20 if length is > 10
  if (cleanPhone.length > 10) {
    return cleanPhone;
  }

  // Fallback: If no known prefix and not starting with 0, assume Egypt for this application (e.g. 1012345678 -> 201012345678)
  if (cleanPhone.length >= 8 && cleanPhone.length <= 10) {
    return '20' + cleanPhone;
  }

  return cleanPhone;
}

export function normalizeDateString(dateStr: any, defaultYear = 2026): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const str = dateStr.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const partsYMD = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (partsYMD) {
    return `${partsYMD[1]}-${partsYMD[2].padStart(2, '0')}-${partsYMD[3].padStart(2, '0')}`;
  }

  const partsDMY = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (partsDMY) {
    return `${partsDMY[3]}-${partsDMY[2].padStart(2, '0')}-${partsDMY[1].padStart(2, '0')}`;
  }

  const partsDM = str.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (partsDM) {
    return `${defaultYear}-${partsDM[2].padStart(2, '0')}-${partsDM[1].padStart(2, '0')}`;
  }

  return str;
}

const UNIT_FULL_NAMES: Record<string, string> = {
  'b1-s1': 'استوديو 1 (دبل)',
  'b1-s2': 'استوديو 2 (سنجل)',
  'b1-s3': 'استوديو 3 (سنجل)',
  'b1-s4': 'استوديو 4 (تريبل)',
  'b1-s5': 'استوديو 5 (دبل)',
  'b1-s6': 'استوديو 6 (سنجل)',
  'b1-s7': 'استوديو 7 (سنجل)',
  'b1-s8': 'استوديو 8 (سنجل)',
  'b1-s9': 'استوديو 9 (دبل)',
  'b1-s10': 'استوديو 10 (دبل)',
  'b1-s11': 'استوديو 11 (دبل)',
  'b1-s12': 'استوديو 12 (دبل)',
  'b2-s1': 'استوديو بريميوم 13 (دبل - سرير كبير)',
  'b2-s2': 'استوديو بريميوم 14 (تريبل)',
  'b2-s3': 'استوديو بريميوم 15 (تريبل)',
  'b2-s4': 'استوديو بريميوم 16 (تريبل 2+1)',
  'b2-s5': 'استوديو بريميوم 17 (سنجل)',
  'b2-s6': 'استوديو بريميوم 18 (دبل)',
  'b2-s7': 'استوديو بريميوم 19 (تريبل 2+1)',
  'b2-s8': 'استوديو بريميوم 20 (دبل)',
  'b2-s9': 'استوديو بريميوم 21 (تريبل 2+1)',
  'b2-s10': 'استوديو بريميوم 22 (تريبل)',
  'b2-s11': 'استوديو بريميوم 23 (تريبل)',
  'b2-s12': 'استوديو بريميوم 24 (دبل - سرير كبير)',
  'apt-1': 'شقة فاخرة 1 - زكي رستم',
  'apt-2': 'شقة فاخرة 2 - سيتي ستارز',
  'apt-3': 'شقة فاخرة 3 - عباس الرئيسي',
  'p-s25': 'شقة غرفتين (25) - 3 سرير',
  'p-s26': 'شقة غرفتين (26) - 2 سرير',
  'p-s27': 'شقة غرفتين (27) - 2 سرير',
  'p-s28': 'شقة غرفتين (28) - 3 سرير',
  'p-s29': 'شقة غرفتين (29) - 3 سرير',
  'p-s30': 'شقة غرفتين (30) - 3 سرير',
};

export function formatUnitName(rawIdOrName?: any): string {
  if (!rawIdOrName) return '—';
  const str = String(rawIdOrName).trim();
  if (UNIT_FULL_NAMES[str]) return UNIT_FULL_NAMES[str];
  return str;
}

export function formatTreasuryUnitName(rawIdOrName?: any): string {
  if (!rawIdOrName) return '—';
  const str = String(rawIdOrName).trim();
  if (str === 'apt-1' || str === 'شقة 1' || str.includes('ذكي رستم') || str.includes('زكي رستم') || str.includes('ذكي سيستم')) return 'زكي رستم';
  if (str === 'apt-2' || str === 'شقة 2' || str.includes('سيتي ستارز') || str.includes('شقة سيتي')) return 'سيتي ستارز';
  if (str === 'apt-3' || str === 'شقة 3' || str.includes('عباس الرئيسي') || str.includes('دائري التحرير')) return 'عباس الرئيسي';
  
  // b1-s1 to b1-s12 -> س 1 to س 12
  const b1Match = str.match(/^b1-s(\d+)$/i);
  if (b1Match) return `س ${b1Match[1]}`;
  
  // b2-s1 to b2-s12 -> س 13 to س 24
  const b2Match = str.match(/^b2-s(\d+)$/i);
  if (b2Match) {
    const n = parseInt(b2Match[1], 10);
    return `س ${n + 12}`;
  }
  
  // p-s25 to p-s30 -> س 25 to س 30
  const psMatch = str.match(/^p-s(\d+)$/i);
  if (psMatch) return `س ${psMatch[1]}`;

  // If already like 'س 18' -> 'س 18'
  const sMatch = str.match(/^س\s*(\d+)$/i);
  if (sMatch) return `س ${sMatch[1]}`;

  // If old format like 'استوديو 5' -> 'س 5' or 'استوديو بريميوم 14' -> 'س 14'
  const studioMatch = str.match(/^استوديو\s*(?:بريميوم\s*)?(\d+)/i);
  if (studioMatch) return `س ${studioMatch[1]}`;

  const twoRoomMatch = str.match(/^شقة\s*غرفتين\s*\((\d+)\)/i);
  if (twoRoomMatch) return `س ${twoRoomMatch[1]}`;


  return str;
}

/**
 * إزالة الوسوم النظامية التقنية فقط بين الأقواس المربعة [وسم: ...]
 * واستخراج الملاحظة اليدوية الفعلية التي كتبها المستخدم دون حذف أي كلمات
 */
export function cleanManualNotes(notesStr: string | null | undefined): string {
  if (!notesStr) return '';
  let cleaned = String(notesStr)
    // إزالة الوسوم النظامية فقط بين الأقواس المربعة
    .replace(/\[[^\]]+\]/g, '')
    .replace(/(?:مسؤول|مسئول)_?الحجز\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
    .replace(/(?:الوسيط|مكتب)\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
    .replace(/\|\s*\|/g, '|')
    .replace(/^[\s|+,.\-—/:]+|[\s|+,.\-—/:]+$/g, '')
    .trim();

  if (!cleaned || /^[\s|+,.\-—/:]+$/.test(cleaned)) return '';
  return cleaned;
}

// In-memory cache for customer profile notes to allow sync across components & devices
let globalCustomerProfileNotes: Record<string, string> = {};

export function setCustomerProfileNotesCache(notes: Record<string, string>) {
  if (!notes || typeof notes !== 'object') return;
  globalCustomerProfileNotes = { ...notes };
  if (typeof window !== 'undefined') {
    try {
      Object.entries(notes).forEach(([ph, nt]) => {
        if (nt && typeof nt === 'string' && nt.trim()) {
          localStorage.setItem(`customer_note_${ph.trim()}`, nt.trim());
        }
      });
    } catch {}
  }
}

/**
 * فحص ما إذا كان النص ملاحظة مالية للحجز وليس ملاحظة للعميل (مثل: متبقي 2800، متبقي 15000، الحساب خالص)
 */
export function isBookingFinancialNote(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  if (/^(?:متبقي|باقي|باقى|مدفوع|مسدد|خالص|الحساب\s*خالص|حساب\s*خالص|عقد)\s*[:=+\-–—]?\s*[\d.,]*\s*(?:ج\.?م|الف|k)?$/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * فحص ما إذا كان العميل مسجل له ملاحظة خاصة بالعميل في ملفه الشخصي فقط
 * (مفصول تماماً عن ملاحظات الحجز وملاحظات الفلوس)
 */
export function hasCustomerProfileNote(phone?: string | null): boolean {
  if (!phone) return false;
  const note = getCustomerProfileNote(phone);
  return Boolean(note && note.trim().length > 0 && !isBookingFinancialNote(note));
}

/**
 * جلب ملاحظة العميل المسجلة في ملفه الشخصي فقط
 */
export function getCustomerProfileNote(phone?: string | null): string {
  if (!phone) return '';
  const p = phone.trim();
  const cached = globalCustomerProfileNotes[p];
  if (cached && cached.trim().length > 0 && !isBookingFinancialNote(cached)) {
    return cached.trim();
  }
  if (typeof window === 'undefined') return '';
  const note = localStorage.getItem(`customer_note_${p}`);
  if (note && !isBookingFinancialNote(note)) {
    return note.trim();
  }
  return '';
}

/**
 * جلب الملاحظة الخاصة بالحجز فقط (بدون خلطها بملاحظة بروفايل العميل)
 */
export function getBookingCleanNote(bookingNotes?: string | null): string {
  return cleanManualNotes(bookingNotes);
}

/**
 * للتوافق مع الأكواد السابقة:
 */
export function getCustomerEffectiveNote(bookingNotes?: string | null, phone?: string | null): string {
  return cleanManualNotes(bookingNotes);
}

export function hasAnyMeaningfulNote(bookingNotes?: string | null, phone?: string | null): boolean {
  return hasCustomerProfileNote(phone);
}

/**
 * توحيد وتشغيل فيديو الوحدة:
 * يحول أي مسار قديم أو به حروف عربية إلى ملفات الفيديو الإنجليزية في /images/video/studio-${num}.mp4
 */
export function resolveUnitVideo(unit: any): string | null {
  if (!unit) return null;
  const rawVideo = unit.video || unit.videoSrc;
  if (rawVideo && typeof rawVideo === 'string') {
    if (rawVideo.startsWith('http')) return rawVideo;
    if (rawVideo.startsWith('/images/video/')) return rawVideo;
    if (rawVideo.includes('mazar2-video')) return '/images/mazar2/mazar2-video.mp4';
    if (rawVideo.includes('apartment-26')) return '/images/video/apartment-26.mp4';
  }

  const idStr = String(unit.id || '').trim();

  // 1. الفئات الرئيسية المجمعة (Master categories)
  if (idStr === 's-single') return '/images/video/studio-2.mp4';
  if (idStr === 's-double') return '/images/video/studio-1.mp4';
  if (idStr === 's-triple') return '/images/video/studio-4.mp4';
  if (idStr === 's-tworoom') return '/images/video/apartment-26.mp4';

  // 2. استوديوهات الفرع الأول (b1-s1 إلى b1-s12)
  if (idStr.startsWith('b1-s')) {
    const num = parseInt(idStr.replace('b1-s', ''), 10);
    if (num >= 1 && num <= 12 && num !== 7) {
      return `/images/video/studio-${num}.mp4`;
    }
  }

  // 3. استوديوهات الفرع الثاني (b2-s1 إلى b2-s12 -> استوديوهات 13 إلى 24)
  if (idStr.startsWith('b2-s')) {
    const subNum = parseInt(idStr.replace('b2-s', ''), 10);
    const realNum = subNum + 12; // b2-s1 -> 13, b2-s2 -> 14, إلخ
    if (realNum >= 13 && realNum <= 24) {
      return `/images/video/studio-${realNum}.mp4`;
    }
  }

  // 4. شقق الفرع الثالث غرفتين (p-s25 إلى p-s30)
  if (idStr.startsWith('p-s') || idStr.includes('tworoom')) {
    return '/images/video/apartment-26.mp4';
  }

  // 5. الشقق الفندقية الخارجية (apt-1, apt-2, apt-3)
  if (idStr.startsWith('apt-') || idStr.startsWith('ext-')) {
    return '/images/video/apartment-26.mp4';
  }

  // 6. الفحص بالرقم المباشر لو كُتب studio-X أو sX
  const numMatch = idStr.match(/s?(\d+)$/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 1 && num <= 24 && num !== 7) {
      return `/images/video/studio-${num}.mp4`;
    }
    if (num >= 25 && num <= 30) {
      return '/images/video/apartment-26.mp4';
    }
  }

  if (rawVideo && typeof rawVideo === 'string') {
    return encodeURI(rawVideo);
  }

  return null;
}


