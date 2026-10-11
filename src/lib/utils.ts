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

  // Fallback: If no known prefix and not starting with 0, assume Egypt for this application
  if (cleanPhone.length >= 8 && cleanPhone.length <= 12) {
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

export function formatUnitName(rawIdOrName?: any): string {
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

  // If old format like 'استوديو 5' -> 'س 5' or 'استوديو بريميوم 14' -> 'س 14'
  const studioMatch = str.match(/^استوديو\s*(?:بريميوم\s*)?(\d+)/i);
  if (studioMatch) return `س ${studioMatch[1]}`;

  return str;
}

