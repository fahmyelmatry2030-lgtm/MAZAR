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
 * إزالة الوسوم النظامية والكلمات الروتينية (مثل: عقد، خالص، سداد، تم الدفع، إلخ)
 * واستخراج الملاحظة الحقيقية الفعلية فقط إن وجدت
 */
export function cleanManualNotes(notesStr: string | null | undefined): string {
  if (!notesStr) return '';
  let cleaned = String(notesStr)
    // إزالة الوسوم النظامية فقط بين الأقواس المربعة مثل [مدفوع: ...] [متبقي: ...] [حساب خالص]
    .replace(/\[(?:مدفوع|متبقي|باقي|باقى|حساب\s*خالص|خالص|عمولة|عموله|الوسيط|مكتب|مسؤول|مسئول|طريقة|طريقة\s*الدفع|اعتماد)[^\]]*\]/gi, '')
    .replace(/(?:مسؤول|مسئول)\s*الحجز\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
    .replace(/(?:الوسيط|مكتب)\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
    .replace(/اعتماد\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
    .replace(/\|\s*\|/g, '|')
    .replace(/^[\s|+,.\-]+|[\s|+,.\-]+$/g, '')
    .trim();

  if (!cleaned || /^[\s|+,.\-—/:]+$/.test(cleaned)) return '';

  // تصفية الكلمات الروتينية الإدارية التي ليست ملاحظات حقيقية عن العميل أو الحجز (بدون \b لدعم الحروف العربية)
  const boilerplateRegex = /(?:^|[\s,.\-—/])(?:عمل\s*عقد|متبقي\s*عقد|عقد\s*فقط|بدون\s*عقد|عقد|الحساب\s*خالص|حساب\s*خالص|خالص|تم\s*الدفع|تم\s*السداد|سداد|مدفوع|مسدد|لا\s*يوجد|لايوجد|لا\s*توجد\s*ملاحظات|لا\s*توجد)(?=$|[\s,.\-—/])/gi;

  let stripped = cleaned;
  while (boilerplateRegex.test(stripped)) {
    stripped = stripped.replace(boilerplateRegex, ' ').trim();
  }
  stripped = stripped.replace(/^[\s|+,.\-—/:]+|[\s|+,.\-—/:]+$/g, '').trim();

  if (!stripped || /^[\s|+,.\-—/:]+$/.test(stripped)) return '';
  return stripped;
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


