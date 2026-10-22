'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { formatWhatsAppNumber, normalizeDateString } from '@/lib/utils';


// --- TELEGRAM CONFIG ---
const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

async function sendTelegramNotification(booking: any) {
  try {
    if (!TG_TOKEN || !TG_CHAT_ID) return;

    // Clean phone for WhatsApp link: Ensure international format
    const cleanPhone = formatWhatsAppNumber(booking.phone);
    
    // Using HTML format as it's more stable than Markdown for special characters
    const htmlMessage = `
<b>🔔 طلب حجز جديد في مزار!</b>
━━━━━━━━━━━━━━
<b>👤 العميل:</b> ${booking.name}
<b>📱 هاتف:</b> ${booking.phone}
<b>👥 عدد الأشخاص:</b> ${booking.guestsCount ?? 1}
<b>🏠 الوحدة:</b> ${booking.studio} (ID: ${booking.apartmentId})
<b>📅 الفترة:</b> ${booking.checkIn} إلى ${booking.checkOut}
<b>⏰ التاريخ:</b> ${new Date().toLocaleString('ar-EG')}
━━━━━━━━━━━━━━
<b>💬 تواصل مع العميل واتساب:</b>
https://wa.me/${cleanPhone}
    `.trim();

    const response = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: htmlMessage,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Telegram response error:', errorText);
    } else {
      console.log('Telegram message sent successfully!');
    }
  } catch (error) {
    console.error('Telegram network error:', error);
  }
}

export async function sendSecurityTelegramAlert(username: string, details: string) {
  try {
    if (!TG_TOKEN || !TG_CHAT_ID) return;

    const htmlMessage = `
🚨 <b>تنبيه أمني: محاولة دخول إلى لوحة التحكم!</b>
━━━━━━━━━━━━━━
<b>👤 اسم المستخدم المحاول:</b> <code>${username}</code>
<b>⚠️ النتيجة:</b> محاولة دخول غير مصرح بها / خاطئة
<b>📝 التفاصيل:</b> ${details}
<b>⏰ التوقيت:</b> ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}
━━━━━━━━━━━━━━
<i>يرجى التاكد من سلامة الحسابات وكلمات المرور.</i>
    `.trim();

    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: htmlMessage,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Security alert Telegram network error:', error);
  }
}

// --- IN-MEMORY CACHES & PROMISE COALESCING (PERFORMANCE BOOST) ---
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let cachedBookings: CacheEntry<any[]> | null = null;
let inFlightBookingsPromise: Promise<any[]> | null = null;
const BOOKINGS_CACHE_TTL_MS = 6000; // 6 seconds
let lastCleanupTime = 0;

export async function invalidateBookingsCache() {
  cachedBookings = null;
}

// --- BOOKINGS ---

export async function getFreshDbBookings(nonce?: string, forceFresh?: boolean): Promise<any[]> {
  const now = Date.now();
  if (!forceFresh && cachedBookings && (now - cachedBookings.timestamp < BOOKINGS_CACHE_TTL_MS)) {
    return cachedBookings.data;
  }

  if (inFlightBookingsPromise) {
    return await inFlightBookingsPromise;
  }

  inFlightBookingsPromise = (async () => {
    try {
      const supabase = getSupabaseServerClient();
      if (!supabase) return cachedBookings?.data || [];

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error reading bookings:', error);
        return cachedBookings?.data || [];
      }

      // --- AUTO-CLEANUP: Expired pending requests (non-blocking) ---
      const today = new Date().toISOString().split('T')[0];
      const pendingStatuses = ['جديد', 'قيد المراجعة', 'pending', 'رد جديد'];
      
      const expiredIds = (data || [])
        .filter((b: any) => pendingStatuses.includes(b.status) && normalizeDateString(b.check_in) < today)
        .map((b: any) => b.id);

      if (expiredIds.length > 0 && Date.now() - lastCleanupTime > 3600000) {
        lastCleanupTime = Date.now();
        supabase.from('bookings').delete().in('id', expiredIds).then(() => {
          cachedBookings = null;
        }).catch((err: any) => console.error('[CLEANUP] error:', err));
      }

  const detectPaymentStatus = (b: any) => {
    const noteStr = String(b.notes || '').trim().toLowerCase();
    const infoStr = String(b.payment_info || '').trim().toLowerCase();
    const combined = `${noteStr} ${infoStr}`;

    const cleanKeywords = ['حساب خالص', 'الحساب خالص', 'خالص', 'تم الدفع', 'تم السداد', 'مدفوع بالكامل'];
    const isExplicitlyClean = cleanKeywords.some(kw => combined.includes(kw));

    const debtKeywords = ['متبقي', 'باقي', 'باقى', 'علية', 'عليها', 'دين', 'مستحق', 'آجل', 'اجل', 'عقد'];
    const hasNumbers = /\d+/.test(noteStr);
    const hasDebtKeyword = debtKeywords.some(kw => combined.includes(kw));

    if (!isExplicitlyClean && (hasDebtKeyword || hasNumbers)) {
      return 'باقي';
    }

    if (isExplicitlyClean) {
      return 'خالص';
    }

    if (b.payment_status === 'خالص') return 'خالص';
    return 'باقي';
  };

  const parseArabicNumberString = (raw: string): number | null => {
    if (!raw) return null;
    let s = raw
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .trim()
      .toLowerCase();

    // التعامل مع k أو ألف (مثل: 24k أو 24 ألف)
    const kMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:k|ك|ألف|الف)/i);
    if (kMatch) {
      const base = parseFloat(kMatch[1].replace(/,/g, '.'));
      return isNaN(base) ? null : Math.round(base * 1000);
    }

    // التعامل مع فواصل الآلاف مثل 24.000 أو 24,000
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) {
      s = s.replace(/[.,]/g, '');
      const val = parseFloat(s);
      return isNaN(val) ? null : val;
    }

    s = s.replace(/,/g, '');
    const val = parseFloat(s);
    return isNaN(val) ? null : val;
  };

  const extractRemainingFromText = (text: string): number | null => {
    if (!text) return null;
    const s = text
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .toLowerCase();

    // تطابق: متبقي / باقي مع أي مسافات أو أسطر جديدة أو إشارة + أو نقط أو k
    const regex = /(?:متبقي|باقي|باقى|دين|علية|عليها|مستحق)\s*[:=+\-–—]?\s*(\+?\s*\d[\d.,]*\s*(?:k|ك|ألف|الف)?)/i;
    const match = s.match(regex);
    if (match && match[1]) {
      const rawNum = match[1].replace(/^\+/, '').trim();
      const parsed = parseArabicNumberString(rawNum);
      if (parsed !== null && parsed > 0) return parsed;
    }
    return null;
  };

  const extractPaidFromText = (text: string): number | null => {
    if (!text) return null;
    const s = text
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .toLowerCase();

    const regex = /(?:تم\s*دفع|دفع|عربون|مدفوع|واصل|سدد)\s*[:=+\-–—]?\s*(\+?\s*\d[\d.,]*\s*(?:k|ك|ألف|الف)?)/i;
    const match = s.match(regex);
    if (match && match[1]) {
      const rawNum = match[1].replace(/^\+/, '').trim();
      const parsed = parseArabicNumberString(rawNum);
      if (parsed !== null && parsed > 0) return parsed;
    }
    return null;
  };

  const extractBookingDate = (b: any): string => {
    if (b.booking_date && String(b.booking_date).trim()) {
      return normalizeDateString(b.booking_date);
    }
    const notesMatch = String(b.notes || '').match(/\[تاريخ\s*(?:الحجز|التسجيل)\s*:\s*([^\]]+)\]/);
    if (notesMatch && notesMatch[1]) {
      return normalizeDateString(notesMatch[1].trim());
    }
    if (b.created_at) {
      const d = String(b.created_at).split('T')[0];
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    }
    if (b.timestamp) {
      const d = String(b.timestamp).split('T')[0];
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    }
    return normalizeDateString(b.check_in);
  };

  const mapped = (data || [])
    .filter((b: any) => !expiredIds.includes(b.id))
    .map((b: any) => {
      const totalAmount = Number(b.total_amount || 0);
      const commission = Number(b.commission || 0);
      const targetAmount = commission > 0 ? (totalAmount - commission) : totalAmount;
      const days = Number(b.number_of_days || 0);

      // احتساب المدفوع والمتبقي بدقة لكل حجز
      const noteStr = String(b.notes || '').trim().toLowerCase();
      const infoStr = String(b.payment_info || '').trim().toLowerCase();
      const combined = `${noteStr} ${infoStr}`;

      const paidTagMatch = combined.match(/\[مدفوع:\s*([\d.]+)/) || combined.match(/مدفوع:\s*([\d.]+)/);
      const remainingTagMatch = combined.match(/\[متبقي:\s*([\d.]+)/) || combined.match(/\[باقي:\s*([\d.]+)/) || combined.match(/متبقي:\s*([\d.]+)/);

      // Check splits in payment_method
      const methodSplits = String(b.payment_method || '').match(/:\s*(\d+(?:\.\d+)?)/g);
      let splitTotal = 0;
      if (methodSplits) {
        splitTotal = methodSplits.reduce((sum: number, m: string) => sum + (parseFloat(m.replace(/[:\s]/g, '')) || 0), 0);
      }

      let calcPaid = 0;
      let calcRemaining = targetAmount;

      if (b.paid_amount !== undefined && b.paid_amount !== null && b.paid_amount !== '') {
        calcPaid = Math.min(targetAmount, Math.max(0, Number(b.paid_amount)));
        calcRemaining = Math.max(0, targetAmount - calcPaid);
      } else if (paidTagMatch && remainingTagMatch) {
        calcPaid = Number(paidTagMatch[1]) || 0;
        calcRemaining = Math.min(targetAmount, Number(remainingTagMatch[1]) || 0);
      } else if (paidTagMatch) {
        calcPaid = Math.min(targetAmount, Number(paidTagMatch[1]) || 0);
        calcRemaining = Math.max(0, targetAmount - calcPaid);
      } else if (remainingTagMatch) {
        calcRemaining = Math.min(targetAmount, Number(remainingTagMatch[1]) || 0);
        calcPaid = Math.max(0, targetAmount - calcRemaining);
      } else {
        const textRemaining = extractRemainingFromText(combined);
        const textPaid = extractPaidFromText(combined);

        if (textPaid !== null && textRemaining !== null) {
          calcPaid = textPaid;
          calcRemaining = Math.min(targetAmount, textRemaining);
        } else if (textRemaining !== null) {
          // إذا كان النص القديم يحتوي على الإجمالي القديم وكان هناك عمولة، يصحح فوراً للصافي
          if (textRemaining >= totalAmount && commission > 0) {
            calcRemaining = targetAmount;
            calcPaid = 0;
          } else {
            calcRemaining = Math.min(targetAmount, textRemaining);
            calcPaid = Math.max(0, targetAmount - calcRemaining);
          }
        } else if (textPaid !== null) {
          calcPaid = textPaid;
          calcRemaining = Math.max(0, targetAmount - textPaid);
        } else if (splitTotal > 0) {
          calcPaid = Math.min(targetAmount, splitTotal);
          calcRemaining = Math.max(0, targetAmount - calcPaid);
        } else if (detectPaymentStatus(b) === 'خالص') {
          calcPaid = targetAmount;
          calcRemaining = 0;
        } else {
          // الافتراضي الصارم لأي حجز: صفر مدفوع والمتبقي كامل الصافي المطلوب حتى يحدد يدوياً
          calcPaid = 0;
          calcRemaining = targetAmount;
        }
      }

      // ضبط نهائي صارم: في حالة وجود عمولة، المتبقي المطلوب تحصيله لا يمكن أن يتجاوز الصافي
      if (commission > 0) {
        if (calcPaid === 0 && (calcRemaining >= totalAmount || calcRemaining > targetAmount)) {
          calcRemaining = targetAmount;
        } else if (calcPaid > 0) {
          calcRemaining = Math.max(0, targetAmount - calcPaid);
        }
      }

      return {
        id: b.id,
        name: b.name,
        phone: b.phone,
        checkIn: normalizeDateString(b.check_in),
        checkOut: normalizeDateString(b.check_out),
        bookingDate: extractBookingDate(b),
        createdAt: b.created_at,
        apartmentId: b.apartment_id,
        studio: b.studio,
        status: b.status,
        paymentInfo: b.payment_info,
        paymentStatus: detectPaymentStatus(b),
        totalAmount,
        paidAmount: calcPaid,
        remainingAmount: calcRemaining,
        numberOfDays: days,
        pricePerNight: days > 0 ? (totalAmount / days) : 0,
        nationality: b.nationality,
        idNumber: b.id_number,
        commission: Number(b.commission || 0),
        brokerName: (b.broker_name && b.broker_name.trim())
          ? b.broker_name.trim()
          : (() => {
              const m = String(b.notes || '').match(/(?:\[(?:الوسيط|مكتب):\s*([^\]]+)\]|(?:الوسيط|مكتب)\s*[:=\-]?\s*([^|\n\r,\]]+))/i);
              return m ? (m[1] || m[2]).trim() : '';
            })(),
        guestsCount: Number(b.guests_count || 1),
        clientStatus: b.client_status || 'انتظار',
        bookingManager: (b.booking_manager && b.booking_manager.trim() && b.booking_manager !== b.name)
          ? b.booking_manager.trim()
          : (() => {
              const m = String(b.notes || '').match(/(?:\[(?:مسؤول|مسئول)_?الحجز:\s*([^\]]+)\]|(?:مسؤول|مسئول)\s*الحجز\s*[:=\-]?\s*([^|\n\r,\]]+))/i);
              if (m && (m[1] || m[2])) return (m[1] || m[2]).trim();
              const accMatch = String(b.notes || '').match(/\[اعتماد:\s*([^\]]+)\]/i);
              return accMatch ? accMatch[1].trim() : '';
            })(),
        paymentMethod: b.payment_method || '',
        notes: (() => {
          if (!b.notes) return '';
          return String(b.notes)
            .replace(/\[(?:الوسيط|مكتب):[^\]]*\]/gi, '')
            .replace(/\[(?:مسؤول|مسئول)_?الحجز:[^\]]*\]/gi, '')
            .replace(/\[اعتماد:[^\]]*\]/gi, '')
            .replace(/(?:مسؤول|مسئول)\s*الحجز\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
            .replace(/(?:الوسيط|مكتب)\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
            .replace(/\|\s*\|/g, '|')
            .replace(/^[\s|+,.\-]+|[\s|+,.\-]+$/g, '')
            .trim();
        })(),
        source: b.source || (String(b.payment_info || '').includes('[طلب') ? 'website' : 'manual'),
        isWebsiteBooking: b.is_website_booking ?? (String(b.payment_info || '').includes('[طلب') || b.status === 'جديد' || b.status === 'pending'),
        timestamp: b.timestamp,
      };
    });

      cachedBookings = { data: mapped, timestamp: Date.now() };
      return mapped;
    } finally {
      inFlightBookingsPromise = null;
    }
  })();

  return await inFlightBookingsPromise;
}

export async function saveDbBooking(booking: any) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      console.warn('⚠️ Database Offline: Simulate saving booking');
      return { success: true, data: [] };
    }

    const newBookingWithId = {
      ...booking,
      id: `B-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: booking.status || 'جديد',
      timestamp: booking.timestamp || new Date().toISOString(),
    };

    // Calculate days if missing
    let numberOfDays = Number(newBookingWithId.numberOfDays) || 0;
    if ((!numberOfDays || numberOfDays <= 0) && newBookingWithId.checkIn && newBookingWithId.checkOut) {
      const s = new Date(newBookingWithId.checkIn).getTime();
      const e = new Date(newBookingWithId.checkOut).getTime();
      if (!isNaN(s) && !isNaN(e) && e > s) {
        numberOfDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
      }
    }

    let totalAmount = newBookingWithId.totalAmount !== undefined && newBookingWithId.totalAmount !== null
      ? Number(newBookingWithId.totalAmount)
      : null;
    if ((totalAmount === null || isNaN(totalAmount) || totalAmount <= 0) && numberOfDays > 0) {
      const pricePerNight = Number(newBookingWithId.pricePerNight) || 0;
      if (pricePerNight > 0) {
        totalAmount = numberOfDays * pricePerNight;
      }
    }

    const effectiveTotal = totalAmount || Number(newBookingWithId.totalAmount || 0);
    const targetRemaining = (newBookingWithId.commission && Number(newBookingWithId.commission) > 0)
      ? (effectiveTotal - Number(newBookingWithId.commission))
      : effectiveTotal;

    // Clean user notes: NEVER inject brokerName or bookingManager into notes!
    const cleanUserNotes = (() => {
      if (!newBookingWithId.notes) return '';
      return String(newBookingWithId.notes)
        .replace(/\[(?:الوسيط|مكتب):[^\]]*\]/gi, '')
        .replace(/\[(?:مسؤول|مسئول)_?الحجز:[^\]]*\]/gi, '')
        .replace(/\[اعتماد:[^\]]*\]/gi, '')
        .replace(/(?:مسؤول|مسئول)\s*الحجز\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
        .replace(/(?:الوسيط|مكتب)\s*[:=\-]?\s*[^|\n\r,\]]+/gi, '')
        .replace(/\|\s*\|/g, '|')
        .replace(/^[\s|+,.\-]+|[\s|+,.\-]+$/g, '')
        .trim();
    })();

    // Build insert object using ONLY verified existing schema columns in Supabase
    const insertData: any = {
      id: newBookingWithId.id,
      name: newBookingWithId.name,
      phone: newBookingWithId.phone,
      check_in: newBookingWithId.checkIn,
      check_out: newBookingWithId.checkOut,
      apartment_id: newBookingWithId.apartmentId ?? null,
      studio: newBookingWithId.studio ?? null,
      status: newBookingWithId.status,
      payment_info: newBookingWithId.paymentInfo || (targetRemaining > 0 ? `متبقي ${targetRemaining}` : 'باقي'),
      total_amount: totalAmount !== null && totalAmount > 0 ? totalAmount : (newBookingWithId.totalAmount ?? null),
      number_of_days: numberOfDays > 0 ? numberOfDays : (newBookingWithId.numberOfDays ?? null),
      nationality: newBookingWithId.nationality ?? null,
      id_number: newBookingWithId.idNumber ?? null,
      commission: newBookingWithId.commission ?? null,
      broker_name: newBookingWithId.brokerName || null,
      booking_manager: newBookingWithId.bookingManager || null,
      payment_method: newBookingWithId.paymentMethod || null,
      client_status: newBookingWithId.clientStatus || 'انتظار',
      guests_count: newBookingWithId.guestsCount ?? 1,
      notes: cleanUserNotes || null,
      timestamp: newBookingWithId.timestamp,
    };

    let { error } = await supabase.from('bookings').insert(insertData);

    const isSchemaError = error && (
      error.code === 'PGRST204' ||
      error.code === '42703' ||
      error.message?.toLowerCase().includes('schema cache')
    );

    if (isSchemaError) {
      console.warn('Retrying insert...', error?.message);
      if (error?.message?.toLowerCase().includes('booking_manager')) delete insertData.booking_manager;
      if (error?.message?.toLowerCase().includes('payment_method')) delete insertData.payment_method;
      if (error?.message?.toLowerCase().includes('broker_name')) delete insertData.broker_name;
      const retry = await supabase.from('bookings').insert(insertData);
      error = retry.error;
    }

    if (error) {
      console.error('Supabase Insert Error:', error);
      return { success: false, error: error.message };
    }

    // Send Telegram Alert to Admin (Awaiting to ensure delivery)
    try {
      await sendTelegramNotification(newBookingWithId);
    } catch (err) {
      console.error('Telegram notification error:', err);
    }

    revalidatePath('/admin/dashboard/reports');
    revalidatePath('/admin/dashboard/treasury');
    revalidatePath('/admin/dashboard');
    invalidateBookingsCache();
    const freshData = await getFreshDbBookings(Date.now().toString(), true);
    return { success: true, data: freshData };
  } catch (error: any) {
    console.error('Error saving booking:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function updateDbBookingStatus(id: string, updates: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn('⚠️ Database Offline: Simulate updating booking status', id);
    return await getFreshDbBookings();
  }

  const patch: any = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.checkIn !== undefined) patch.check_in = updates.checkIn;
  if (updates.checkOut !== undefined) patch.check_out = updates.checkOut;
  if (updates.studio !== undefined) patch.studio = updates.studio;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.apartmentId !== undefined) patch.apartment_id = updates.apartmentId;
  // Resolve payment info cleanly without overwriting numbers
  const p = updates.paidAmount !== undefined ? Number(updates.paidAmount) : undefined;
  const r = updates.remainingAmount !== undefined ? Number(updates.remainingAmount) : undefined;

  if (p !== undefined || r !== undefined) {
    const paidVal = p !== undefined ? p : 0;
    const remVal = r !== undefined ? r : 0;
    if (remVal === 0 && (paidVal > 0 || updates.paymentStatus === 'خالص')) {
      patch.payment_info = 'خالص';
    } else if (paidVal > 0 && remVal > 0) {
      patch.payment_info = `مدفوع: ${paidVal} | متبقي: ${remVal}`;
    } else if (remVal > 0) {
      patch.payment_info = `متبقي: ${remVal}`;
    } else if (updates.paymentInfo) {
      patch.payment_info = updates.paymentInfo;
    }
  } else if (updates.paymentInfo !== undefined) {
    patch.payment_info = updates.paymentInfo;
  } else if (updates.paymentStatus !== undefined) {
    patch.payment_info = updates.paymentStatus;
  }
  if (updates.totalAmount !== undefined) patch.total_amount = updates.totalAmount;
  if (updates.numberOfDays !== undefined) patch.number_of_days = updates.numberOfDays;
  if (updates.nationality !== undefined) patch.nationality = updates.nationality;
  if (updates.idNumber !== undefined) patch.id_number = updates.idNumber;
  if (updates.commission !== undefined) patch.commission = updates.commission;
  if (updates.brokerName !== undefined) patch.broker_name = updates.brokerName;
  if (updates.clientStatus !== undefined) patch.client_status = updates.clientStatus;
  if (updates.guestsCount !== undefined) patch.guests_count = updates.guestsCount;
  
  // booking_manager and payment_method DO exist in the schema
  if (updates.bookingManager !== undefined) patch.booking_manager = updates.bookingManager;
  if (updates.paymentMethod !== undefined) patch.payment_method = updates.paymentMethod;
  if (updates.notes !== undefined) patch.notes = updates.notes;

  if (updates.bookingDate !== undefined) {
    patch.booking_date = normalizeDateString(updates.bookingDate);
  }
  
  // ALWAYS update the timestamp on edit to ensure "Fresh First" sync logic works
  patch.timestamp = new Date().toISOString();

  let { data, error } = await supabase.from('bookings')
    .update(patch)
    .eq('id', id)
    .select();

  // Retry if schema cache reports an issue
  const isSchemaError = error && (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    error.message?.toLowerCase().includes('schema cache')
  );

  if (isSchemaError) {
    console.warn('Retrying update without optional columns...', error?.message);
    delete patch.booking_date;
    delete patch.paid_amount;
    delete patch.payment_status;
    const retry = await supabase.from('bookings')
      .update(patch)
      .eq('id', id)
      .select();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('Error updating booking:', error);
    throw error;
  }

  // If no rows were affected, the ID is probably wrong or doesn't exist in DB
  // Note: .update().eq() returns success even if 0 rows match. We must check.
  const affected = data ? data.length : 0;
  if (affected === 0) {
    console.error(`⚠️ Update FAILED: No record found with ID ${id}`);
    throw new Error(`لم يتم العثور على سجل بالرقم التعريف: ${id}`);
  }

  console.log(`✅ Successfully updated ${affected} row(s) for ID: ${id}`);
  
  // Revalidate to clear any server-side response cache
  invalidateBookingsCache();
  revalidatePath('/admin/dashboard/reports');
  revalidatePath('/admin/dashboard/treasury');
  revalidatePath('/admin/dashboard');
  
  // Return the fresh data directly
  return await getFreshDbBookings(Date.now().toString(), true);
}

export async function deleteDbBooking(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn('⚠️ Database Offline: Simulate deleting booking', id);
    return await getFreshDbBookings();
  }

  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting booking:', error);
    throw error;
  }

  console.log(`✅ Successfully deleted booking ID: ${id}`);
  
  // Revalidate to clear server-side cache
  invalidateBookingsCache();
  revalidatePath('/admin/dashboard/reports');
  revalidatePath('/admin/dashboard/treasury');
  revalidatePath('/admin/dashboard');
  
  // Return the fresh data
  return await getFreshDbBookings(Date.now().toString(), true);
}

export async function deleteAllPendingDbBookings() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const pendingStatuses = ['جديد', 'طلب جديد', 'قيد المراجعة', 'pending', 'رد جديد', 'في الانتظار', 'بانتظار التأكيد'];
  const { error } = await supabase
    .from('bookings')
    .delete()
    .in('status', pendingStatuses);

  if (error) {
    console.error('Error deleting pending bookings:', error);
  } else {
    console.log('✅ Successfully deleted all pending/dummy bookings from DB');
  }

  invalidateBookingsCache();
  revalidatePath('/admin/dashboard');
  return await getFreshDbBookings(Date.now().toString(), true);
}

export async function deleteDbBookingsByPhone(phone: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('phone', phone);

  if (error) {
    console.error('Error deleting bookings by phone:', error);
    throw error;
  }

  console.log(`✅ Successfully deleted all bookings for phone: ${phone}`);
  invalidateBookingsCache();
  revalidatePath('/admin/dashboard/customers');
  revalidatePath('/admin/dashboard/reports');
  return await getFreshDbBookings(Date.now().toString(), true);
}

// --- UNITS ---

let cachedUnits: CacheEntry<any[]> | null = null;
let inFlightUnitsPromise: Promise<any[]> | null = null;
const UNITS_CACHE_TTL_MS = 30000; // 30 seconds

export async function invalidateUnitsCache() {
  cachedUnits = null;
}

export async function getDbUnits(forceFresh?: boolean) {
  const now = Date.now();
  if (!forceFresh && cachedUnits && (now - cachedUnits.timestamp < UNITS_CACHE_TTL_MS)) {
    return cachedUnits.data;
  }

  if (inFlightUnitsPromise) {
    return await inFlightUnitsPromise;
  }

  inFlightUnitsPromise = (async () => {
    try {
      const supabase = getSupabaseServerClient();
      if (!supabase) return cachedUnits?.data || [];

      const { data, error } = await supabase.from('units').select('*').order('id', { ascending: true });
      if (error) {
        console.error('Error reading units:', error);
        return cachedUnits?.data || [];
      }

      const mapped = (data || []).map((u: any) => ({
        id: u.id,
        branch: u.branch,
        type: u.type,
        title: u.title,
        status: u.status,
        housekeeping: u.housekeeping,
        nextBooking: u.next_booking,
        description: u.description,
        images: u.images,
        video: u.video,
        features: u.features,
        originalPrice: u.original_price,
        price: u.price,
      }));

      cachedUnits = { data: mapped, timestamp: Date.now() };
      return mapped;
    } finally {
      inFlightUnitsPromise = null;
    }
  })();

  return await inFlightUnitsPromise;
}

export async function updateDbUnitDetails(id: string, updates: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn('⚠️ Database Offline: Simulate updating unit', id);
    return await getDbUnits();
  }

  const patch: any = {};

  // Accept both raw db-like keys and app keys; normalize to DB columns.
  if (updates.branch !== undefined) patch.branch = updates.branch;
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.housekeeping !== undefined) patch.housekeeping = updates.housekeeping;
  if (updates.nextBooking !== undefined) patch.next_booking = updates.nextBooking;
  if (updates.next_booking !== undefined) patch.next_booking = updates.next_booking;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.images !== undefined) patch.images = updates.images;
  if (updates.video !== undefined) patch.video = updates.video;
  if (updates.features !== undefined) patch.features = updates.features;
  if (updates.originalPrice !== undefined) patch.original_price = updates.originalPrice;
  if (updates.original_price !== undefined) patch.original_price = updates.original_price;
  if (updates.price !== undefined) patch.price = updates.price;
  patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from('units').upsert({ id, ...patch });
  if (error) {
    console.error('Error updating unit:', error);
    throw error;
  }

  invalidateUnitsCache();
  return await getDbUnits(true);
}

// --- ADMIN ---

export async function verifyAdminAuth(username: string, pass: string) {
  try {
    const cleanUsername = username.trim();
    const cleanPass = pass.trim();
    
    console.log(`Login attempt for: ${cleanUsername}`);

    // Keep the partner login independent from the admin database.
    if (['akoura', 'aura', 'أورا', 'اورا', 'koura', 'كورة', 'أكورة', 'اكورة', 'اكوره'].includes(cleanUsername.toLowerCase()) && (cleanPass === 'akoura2026' || cleanPass === 'aura2026')) {
      return {
        success: true,
        admin: {
          id: 'akoura-admin',
          username: 'Akoura',
          name: 'أكورة (مزار 3)',
          role: 'Akoura'
        }
      };
    }

    const fixedAdmins: Record<string, { username: string; name: string; role: string; password: string }> = {
      mo2men: { username: 'Mo2men', name: 'مؤمن', role: 'Owner', password: 'Mo2men50' },
      medhat: { username: 'Medhat', name: 'مدحت', role: 'Owner', password: 'Medhat55' },
      admin: { username: 'Admin', name: 'Admin', role: 'Admin', password: 'Admin220' },
      moderator: { username: 'Moderator', name: 'Moderator', role: 'Moderator', password: 'Moderator90' },
      mohsen: { username: 'Mohsen', name: 'محسن (مزار 1 و 2)', role: 'Mohsen', password: 'Mohsen55' },
      akoura: { username: 'Akoura', name: 'أكورة (مزار 3)', role: 'Akoura', password: 'akoura2026' },
      aura: { username: 'Akoura', name: 'أكورة (مزار 3)', role: 'Akoura', password: 'akoura2026' },
      koura: { username: 'Akoura', name: 'أكورة (مزار 3)', role: 'Akoura', password: 'akoura2026' },
    };
    const fixedAdmin = fixedAdmins[cleanUsername.toLowerCase()];
    if (fixedAdmin) {
      const normInput = cleanPass.toLowerCase().replace(/\s+/g, '');
      const normFixed = fixedAdmin.password.toLowerCase().replace(/\s+/g, '');
      if (fixedAdmin.password === cleanPass || normInput === normFixed || (cleanUsername.toLowerCase() === 'mohsen' && (normInput === 'mohsen55' || normInput === '55'))) {
        const { password, ...admin } = fixedAdmin;
        return { success: true, admin: { id: `fixed-${admin.role.toLowerCase()}`, ...admin } };
      }
    }
    
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      console.warn('Database offline, authentication failed');
      return { success: false };
    }

    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .ilike('username', cleanUsername);
    if (!error && data && data.length > 0) {
      const match = data.find((a: any) => {
        if (a.password === cleanPass) return true;
        const normDb = String(a.password || '').toLowerCase().replace(/\s+/g, '');
        const normIn = cleanPass.toLowerCase().replace(/\s+/g, '');
        return normDb === normIn;
      });
      if (match) return { success: true, admin: match };
    }

    // Send security alert to Telegram on failed login attempt
    await sendSecurityTelegramAlert(cleanUsername, 'محاولة دخول فاشلة - كلمة المرور أو اسم المستخدم غير صحيح.');

    return { success: false };
  } catch (error) {
    console.error('Error reading admins:', error);
    await sendSecurityTelegramAlert(username || 'غير محدد', 'خطأ أثناء فحص بيانات الدخول في النظام.');
    return { success: false };
  }
}

let cachedAdmins: CacheEntry<any[]> | null = null;
const ADMINS_CACHE_TTL_MS = 60000; // 60 seconds

export async function invalidateAdminsCache() {
  cachedAdmins = null;
}

export async function getDbAdmins(forceFresh?: boolean) {
  const now = Date.now();
  if (!forceFresh && cachedAdmins && (now - cachedAdmins.timestamp < ADMINS_CACHE_TTL_MS)) {
    return cachedAdmins.data;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return cachedAdmins?.data || [];

  const { data, error } = await supabase.from('admins').select('*').order('role', { ascending: false });
  if (error) {
    console.error('Error getting admins:', error);
    return cachedAdmins?.data || [];
  }
  const result = data || [];
  cachedAdmins = { data: result, timestamp: Date.now() };
  return result;
}

export async function addDbAdmin(admin: any) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
        console.warn('⚠️ Database Offline: Simulate adding admin');
        return { success: true, admin: { ...admin, id: `mock-${Date.now()}` } };
    }

    const newAdmin = { ...admin, id: `admin-${Date.now()}` };
    const { error } = await supabase.from('admins').insert(newAdmin);
    if (error) throw error;
    invalidateAdminsCache();
    return { success: true, admin: newAdmin };
  } catch (error) {
    console.error('Error adding admin:', error);
    return { success: false };
  }
}

export async function updateDbAdmin(id: string, updates: any) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { success: false };

    const { error } = await supabase.from('admins').update(updates).eq('id', id);
    if (error) throw error;
    invalidateAdminsCache();
    return { success: true };
  } catch (error) {
    console.error('Error updating admin:', error);
    return { success: false };
  }
}

export async function deleteDbAdmin(id: string) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { success: false };

    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (error) throw error;
    invalidateAdminsCache();
    return { success: true };
  } catch (error) {
    console.error('Error deleting admin:', error);
    return { success: false };
  }
}

// --- TRANSLATIONS (CMS) ---
import initialTranslations from '@/data/translations.json';

export async function getDbTranslations() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null; // Return null instead of old fallback

  const { data, error } = await supabase.from('translations').select('data').eq('id', 1).single();
  if (error || !data?.data) {
    if (error && error.code !== 'PGRST116') {
      console.error('Error reading translations:', error);
      return null; // Fail fast on real errors
    }
    return initialTranslations; // Only fallback if DB is empty but connected
  }
  return data.data;
}

export async function updateDbTranslations(newTranslations: any) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
        console.warn('⚠️ Database Offline: Simulate saving translations');
        return { success: true };
    }

    const { error } = await supabase
      .from('translations')
      .upsert({ id: 1, data: newTranslations, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating translations:', error);
    return { success: false, error: 'Failed to save translations' };
  }
}

export async function getDbCustody() {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase.from('translations').select('data').eq('id', 99).single();
    if (error || !data?.data) {
      return null;
    }
    return data.data;
  } catch (err) {
    console.error('Error reading custody from DB:', err);
    return null;
  }
}

export async function updateDbCustody(custodyData: any) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return { success: false };

    const { error } = await supabase
      .from('translations')
      .upsert({ id: 99, data: custodyData, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating custody in DB:', error);
    return { success: false };
  }
}

// --- HR: STAFF ---

export async function getDbStaff() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from('staff').select('*').order('name', { ascending: true });
  if (error) {
    console.error('Error reading staff:', error);
    return [];
  }

  return (data || []).map((s: any) => {
    let position = s.position || '';
    let housing = s.housing_allowance || 0;
    let transport = s.transport_allowance || 0;
    let otherAllowances = s.other_allowances || 0;
    let nationalId = s.national_id || '';
    let age = s.age || '';
    let address = s.address || '';
    let notes = s.notes || '';

    if (position.includes('[بدلات:')) {
      const match = position.match(/\[بدلات:\s*([^\]]+)\]/);
      if (match) {
        const parts = match[1].split('|');
        housing = Number(parts[0]) || 0;
        transport = Number(parts[1]) || 0;
        otherAllowances = Number(parts[2]) || 0;
        position = position.replace(/\[بدلات:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (position.includes('[قومي:')) {
      const match = position.match(/\[قومي:\s*([^\]]+)\]/);
      if (match) {
        nationalId = match[1];
        position = position.replace(/\[قومي:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (position.includes('[سن:')) {
      const match = position.match(/\[سن:\s*([^\]]+)\]/);
      if (match) {
        age = match[1];
        position = position.replace(/\[سن:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (position.includes('[عنوان:')) {
      const match = position.match(/\[عنوان:\s*([^\]]+)\]/);
      if (match) {
        address = match[1];
        position = position.replace(/\[عنوان:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (position.includes('[ملاحظات:')) {
      const match = position.match(/\[ملاحظات:\s*([^\]]+)\]/);
      if (match) {
        notes = match[1];
        position = position.replace(/\[ملاحظات:\s*([^\]]+)\]/g, '').trim();
      }
    }

    return {
      ...s,
      position,
      housing_allowance: housing,
      transport_allowance: transport,
      other_allowances: otherAllowances,
      national_id: nationalId,
      age,
      address,
      notes,
    };
  });
}

export async function saveDbStaff(staff: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return staff;

  let metaTags: string[] = [];
  if (staff.housing_allowance || staff.transport_allowance || staff.other_allowances) {
    metaTags.push(`[بدلات: ${staff.housing_allowance || 0}|${staff.transport_allowance || 0}|${staff.other_allowances || 0}]`);
  }
  if (staff.national_id && String(staff.national_id).trim()) {
    metaTags.push(`[قومي: ${String(staff.national_id).trim()}]`);
  }
  if (staff.age && String(staff.age).trim()) {
    metaTags.push(`[سن: ${String(staff.age).trim()}]`);
  }
  if (staff.address && String(staff.address).trim()) {
    metaTags.push(`[عنوان: ${String(staff.address).trim()}]`);
  }
  if (staff.notes && String(staff.notes).trim()) {
    metaTags.push(`[ملاحظات: ${String(staff.notes).trim()}]`);
  }

  // Clean raw position so we don't duplicate existing tags
  let cleanPos = String(staff.position || '')
    .replace(/\[(?:بدلات|قومي|سن|عنوان|ملاحظات):[^\]]*\]/g, '')
    .trim();

  let finalPosition = metaTags.length > 0
    ? `${metaTags.join(' ')} ${cleanPos}`.trim()
    : cleanPos;

  const dbPayload: any = {
    id: staff.id || `staff-${Date.now()}`,
    name: staff.name,
    position: finalPosition || 'موظف',
    base_salary: Number(staff.base_salary) || 0,
    phone: staff.phone || '',
    hiring_date: staff.hiring_date || new Date().toISOString().split('T')[0]
  };

  const { error } = await supabase.from('staff').upsert(dbPayload);
  if (error) {
    console.error('Error saving staff:', error);
    throw error;
  }

  revalidatePath('/admin/dashboard/hr/salaries');
  revalidatePath('/admin/dashboard/hr/staff');
  return staff;
}

export async function deleteDbStaff(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/dashboard/hr/salaries');
  revalidatePath('/admin/dashboard/hr/staff');
}

// --- HR: SALARIES ---

export async function getDbSalaries() {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const { data, error } = await supabase.from('salaries').select('*').order('year', { ascending: false }).order('month', { ascending: false });
  if (error) {
    console.error('Error reading salaries:', error);
    throw error;
  }
  return (data || []).map((sal: any) => {
    let notes = sal.notes || '';
    let payment_method = 'كاش';
    const matchMethod = notes.match(/\[طريقة:\s*([^\]]+)\]/);
    if (matchMethod) {
      payment_method = matchMethod[1];
      notes = notes.replace(/\[طريقة:\s*([^\]]+)\]/g, '').trim();
    }

    let handed_by = '';
    const matchHanded = notes.match(/\[مسلم_من:\s*([^\]]+)\]/);
    if (matchHanded) {
      handed_by = matchHanded[1];
      notes = notes.replace(/\[مسلم_من:\s*([^\]]+)\]/g, '').trim();
    }

    let entry_type = 'salary';
    if (notes.includes('[نوع: خصم]') || (sal.deductions > 0 && Number(sal.net_salary || 0) === 0) || sal.payment_status === 'deduction') {
      entry_type = 'deduction';
      notes = notes.replace(/\[نوع:\s*([^\]]+)\]/g, '').trim();
    } else if (notes.includes('[نوع: راتب]')) {
      entry_type = 'salary';
      notes = notes.replace(/\[نوع:\s*([^\]]+)\]/g, '').trim();
    }

    const cleanAmount = Number(sal.net_salary || sal.amount || sal.deductions || 0);
    return {
      ...sal,
      notes,
      payment_method,
      handed_by: handed_by || 'مؤمن',
      entry_type,
      amount: cleanAmount,
      net_salary: entry_type === 'salary' ? cleanAmount : 0,
      deductions: entry_type === 'deduction' ? cleanAmount : (Number(sal.deductions) || 0),
      payment_date: sal.payment_date || sal.date || ''
    };
  });
}

export async function saveDbSalary(salary: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return salary;

  const salaryId = salary.id || `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const paymentDate = salary.payment_date || salary.date || new Date().toISOString().split('T')[0];
  const amountVal = Number(salary.net_salary || salary.amount || salary.deductions || 0);
  const paymentMethod = salary.payment_method || 'كاش';
  const entryType = salary.entry_type || salary.type || 'salary';
  const handedBy = salary.handed_by || 'مؤمن';

  // Format notes to include payment method, handed by, and entry type
  let notesWithMeta = salary.notes || '';
  if (entryType === 'deduction') {
    if (!notesWithMeta.includes('[نوع: خصم]')) notesWithMeta = `[نوع: خصم] ${notesWithMeta}`.trim();
  } else {
    if (!notesWithMeta.includes('[نوع: راتب]')) notesWithMeta = `[نوع: راتب] ${notesWithMeta}`.trim();
    if (paymentMethod && !notesWithMeta.includes('[طريقة:')) {
      notesWithMeta = `[طريقة: ${paymentMethod}] ${notesWithMeta}`.trim();
    }
    if (handedBy && !notesWithMeta.includes('[مسلم_من:')) {
      notesWithMeta = `[مسلم_من: ${handedBy}] ${notesWithMeta}`.trim();
    }
  }

  const payload: any = {
    id: salaryId,
    staff_id: salary.staff_id,
    month: Number(salary.month) || (new Date(paymentDate).getMonth() + 1),
    year: Number(salary.year) || new Date(paymentDate).getFullYear(),
    bonuses: Number(salary.bonuses) || 0,
    deductions: entryType === 'deduction' ? amountVal : (Number(salary.deductions) || 0),
    net_salary: entryType === 'salary' ? amountVal : 0,
    payment_status: entryType === 'deduction' ? 'deduction' : (salary.payment_status || 'paid'),
    payment_date: paymentDate,
    notes: notesWithMeta
  };

  const { error } = await supabase.from('salaries').upsert(payload);
  if (error) {
    console.warn('⚠️ Standard salary insert failed. Retrying without payment_date...', error.message);
    const fallbackPayload = { ...payload };
    delete fallbackPayload.payment_date;
    const { error: retryError } = await supabase.from('salaries').upsert(fallbackPayload);
    if (retryError) throw retryError;
  }

  // Auto-deduct salary/advance payouts from treasury (only for payouts/advances, not deductions)
  if ((entryType === 'salary' || entryType === 'advance' || entryType === 'سلفة' || !entryType) && amountVal > 0) {
    try {
      const staffList = await getDbStaff();
      const staffMember = staffList.find((s: any) => s.id === salary.staff_id);
      const staffName = staffMember?.name || 'موظف';
      const cleanNote = (salary.notes || '')
        .replace(/\[(طريقة|نوع|مسلم_من):\s*[^\]]+\]/g, '')
        .trim();
      const expenseDesc = `سلفة / سحب موظف: ${staffName} - ${cleanNote || 'سلفة نقدية على الراتب'} [قيد:${salaryId}] [طريقة:${paymentMethod}] [مسلم:${handedBy}]`;

      const { data: existingExpenses } = await supabase
        .from('expenses')
        .select('id')
        .like('description', `%[قيد:${salaryId}]%`)
        .limit(1);

      const expenseData = {
        category: 'رواتب',
        amount: amountVal,
        date: paymentDate.split('T')[0],
        description: expenseDesc,
        from_entity: paymentMethod === 'كاش' ? 'الخزنة الفرعية' : (paymentMethod || 'الخزنة الفرعية'),
        to_entity: staffName,
        ordered_by: handedBy || 'إدارة الموظفين',
        branch: null
      };

      if (existingExpenses && existingExpenses.length > 0) {
        await supabase.from('expenses').update(expenseData).eq('id', existingExpenses[0].id);
      } else {
        await saveDbExpense(expenseData);
      }
    } catch (err) {
      console.error('Failed to auto-deduct salary/advance from treasury:', err);
    }
  }

  revalidatePath('/admin/dashboard/hr/staff');
  revalidatePath('/admin/dashboard/hr/salaries');
  revalidatePath('/admin/dashboard/treasury');
  revalidatePath('/admin/dashboard/finance');
  revalidatePath('/admin/dashboard/reports');
  return { ...payload, id: salaryId, amount: amountVal, payment_method: paymentMethod };
}

export async function deleteDbSalary(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  // 1. Delete associated expense in small treasury to return the money
  try {
    await supabase.from('expenses').delete().like('description', `%[قيد:${id}]%`);
  } catch (e) {
    console.error('Failed to delete linked expense for salary:', e);
  }

  // 2. Delete salary record
  const { error } = await supabase.from('salaries').delete().eq('id', id);
  if (error) throw error;

  revalidatePath('/admin/dashboard/hr/staff');
  revalidatePath('/admin/dashboard/hr/salaries');
  revalidatePath('/admin/dashboard/treasury');
  revalidatePath('/admin/dashboard/finance');
  revalidatePath('/admin/dashboard/reports');
}

// --- HR: VACATIONS ---

export async function getDbVacations() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from('vacations').select('*').order('start_date', { ascending: false });
  if (error) {
    console.error('Error reading vacations:', error);
    return [];
  }
  return (data || []).map((v: any) => {
    let reason = v.reason || '';
    let amount = 0;
    const match = reason.match(/\[بكام:\s*([\d\.]+)\]/) || reason.match(/\[خصم:\s*([\d\.]+)\]/);
    if (match) {
      amount = parseFloat(match[1]) || 0;
      reason = reason.replace(/\[(بكام|خصم):\s*([\d\.]+)\]/g, '').trim();
    }
    return {
      id: v.id,
      staff_id: v.staff_id,
      start_date: v.start_date,
      end_date: v.end_date,
      type: v.status || v.type || 'سنوية',
      notes: reason,
      amount: amount || Number(v.amount) || 0
    };
  });
}

export async function saveDbVacation(vacation: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return vacation;

  const cost = Number(vacation.amount) || 0;
  const reasonWithCost = cost > 0 
    ? `[بكام: ${cost}] ${vacation.notes || ''}`.trim()
    : (vacation.notes || '');

  const dbData: any = {
    id: vacation.id || `vac-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    staff_id: vacation.staff_id,
    start_date: vacation.start_date,
    end_date: vacation.end_date,
    status: vacation.type || vacation.status || 'سنوية',
    reason: reasonWithCost
  };

  const { error } = await supabase.from('vacations').upsert(dbData);
  if (error) throw error;

  revalidatePath('/admin/dashboard/hr/staff');
  revalidatePath('/admin/dashboard/hr/vacations');
  return vacation;
}

export async function deleteDbVacation(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from('vacations').delete().eq('id', id);
  if (error) throw error;

  revalidatePath('/admin/dashboard/hr/staff');
  revalidatePath('/admin/dashboard/hr/vacations');
}

// --- EXPENSES ---

let cachedExpenses: CacheEntry<any[]> | null = null;
let inFlightExpensesPromise: Promise<any[]> | null = null;
const EXPENSES_CACHE_TTL_MS = 6000; // 6 seconds

export async function invalidateExpensesCache() {
  cachedExpenses = null;
}

export async function getDbExpenses(forceFresh?: boolean) {
  const now = Date.now();
  if (!forceFresh && cachedExpenses && (now - cachedExpenses.timestamp < EXPENSES_CACHE_TTL_MS)) {
    return cachedExpenses.data;
  }

  if (inFlightExpensesPromise) {
    return await inFlightExpensesPromise;
  }

  inFlightExpensesPromise = (async () => {
    try {
      const supabase = getSupabaseServerClient();
      if (!supabase) return cachedExpenses?.data || [];

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching expenses:', error);
        return cachedExpenses?.data || [];
      }

      const mapped = (data || []).map((exp: any) => {
    let cleanDesc = exp.description || '';
    let extractedInvoice = exp.invoice_number || '';
    let extractedFrom = exp.from_entity || '';
    let extractedTo = exp.to_entity || '';
    let extractedOrderedBy = exp.ordered_by || '';
    let extractedNotes = exp.notes || '';
    let extractedStatus = exp.status || '';
    let extractedApprovedBy = exp.approved_by || '';
    let extractedBranch = exp.branch || 12;

    if (!extractedInvoice && cleanDesc.includes('[فاتورة:')) {
      const match = cleanDesc.match(/\[فاتورة:\s*([^\]]+)\]/);
      if (match) {
        extractedInvoice = match[1];
        cleanDesc = cleanDesc.replace(/\[فاتورة:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (!extractedFrom && cleanDesc.includes('[من:')) {
      const match = cleanDesc.match(/\[من:\s*([^\]]+)\]/);
      if (match) {
        extractedFrom = match[1];
        cleanDesc = cleanDesc.replace(/\[من:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (!extractedTo && cleanDesc.includes('[إلى:')) {
      const match = cleanDesc.match(/\[إلى:\s*([^\]]+)\]/);
      if (match) {
        extractedTo = match[1];
        cleanDesc = cleanDesc.replace(/\[إلى:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (!extractedOrderedBy && cleanDesc.includes('[بطلب:')) {
      const match = cleanDesc.match(/\[بطلب:\s*([^\]]+)\]/);
      if (match) {
        extractedOrderedBy = match[1];
        cleanDesc = cleanDesc.replace(/\[بطلب:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (cleanDesc.includes('[فرع:')) {
      const match = cleanDesc.match(/\[فرع:\s*([^\]]+)\]/);
      if (match) {
        extractedBranch = parseInt(match[1]) || 12;
        cleanDesc = cleanDesc.replace(/\[فرع:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (!extractedNotes && cleanDesc.includes('[ملاحظات:')) {
      const match = cleanDesc.match(/\[ملاحظات:\s*([^\]]+)\]/);
      if (match) {
        extractedNotes = match[1];
        cleanDesc = cleanDesc.replace(/\[ملاحظات:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (!extractedStatus && cleanDesc.includes('[حالة:')) {
      const match = cleanDesc.match(/\[حالة:\s*([^\]]+)\]/);
      if (match) {
        extractedStatus = match[1];
        cleanDesc = cleanDesc.replace(/\[حالة:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (!extractedApprovedBy && cleanDesc.includes('[اعتماد:')) {
      const match = cleanDesc.match(/\[اعتماد:\s*([^\]]+)\]/);
      if (match) {
        if (!extractedStatus) extractedStatus = `تم الموافقة بواسطة: ${match[1]}`;
        extractedApprovedBy = match[1];
        cleanDesc = cleanDesc.replace(/\[اعتماد:\s*([^\]]+)\]/g, '').trim();
      }
    }

    return {
      ...exp,
      description: cleanDesc,
      invoice_number: extractedInvoice,
      from_entity: extractedFrom,
      to_entity: extractedTo,
      ordered_by: extractedOrderedBy,
      branch: extractedBranch,
      notes: extractedNotes,
      status: extractedStatus,
      approved_by: extractedApprovedBy,
    };
  });

      cachedExpenses = { data: mapped, timestamp: Date.now() };
      return mapped;
    } finally {
      inFlightExpensesPromise = null;
    }
  })();

  return await inFlightExpensesPromise;
}

export async function saveDbExpense(expense: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return expense;

  // Auto-generate invoice number if empty
  if (!expense.invoice_number || expense.invoice_number.trim() === '') {
    try {
      const { count } = await supabase.from('expenses').select('*', { count: 'exact', head: true });
      const nextNum = (count || 0) + 1;
      expense.invoice_number = `INV-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;
    } catch (e) {
      expense.invoice_number = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    }
  }

  // Ensure branch is integer or null (never a string that crashes Postgres)
  const cleanBranch = (typeof expense.branch === 'number' && !isNaN(expense.branch))
    ? expense.branch
    : (!isNaN(parseInt(expense.branch, 10)) ? parseInt(expense.branch, 10) : null);
  expense.branch = cleanBranch;

  // Attempt 1: Direct insert with all properties
  const { error } = await supabase.from('expenses').insert([expense]);
  if (error) {
    console.warn('⚠️ Standard expense insert failed. Attempting level 1 fallback...', error.message);
    const fallback1 = { ...expense };
    let meta1 = [];

    if (expense.invoice_number) {
      meta1.push(`[فاتورة: ${expense.invoice_number}]`);
      delete fallback1.invoice_number;
    }
    if (expense.notes) {
      meta1.push(`[ملاحظات: ${expense.notes}]`);
      delete fallback1.notes;
    }
    if (expense.status) {
      meta1.push(`[حالة: ${expense.status}]`);
      delete fallback1.status;
    }
    if (expense.approved_by) {
      meta1.push(`[اعتماد: ${expense.approved_by}]`);
      delete fallback1.approved_by;
    }

    if (meta1.length > 0) {
      fallback1.description = `${meta1.join(' ')} ${expense.description || ''}`.trim();
    }

    const { error: retryError1 } = await supabase.from('expenses').insert([fallback1]);
    if (retryError1) {
      console.warn('⚠️ Level 1 fallback failed. Attempting level 2 ultra-safe fallback...', retryError1.message);
      
      // Level 2 Fallback: Only write guaranteed core columns (category, amount, date, description)
      let meta2 = [...meta1];
      if (expense.from_entity) meta2.push(`[من: ${expense.from_entity}]`);
      if (expense.to_entity) meta2.push(`[إلى: ${expense.to_entity}]`);
      if (expense.ordered_by) meta2.push(`[بطلب: ${expense.ordered_by}]`);
      if (expense.branch) meta2.push(`[فرع: ${expense.branch}]`);

      const fallback2 = {
        category: expense.category || 'عام',
        amount: Number(expense.amount) || 0,
        date: expense.date || new Date().toISOString().split('T')[0],
        description: `${meta2.join(' ')} ${expense.description || ''}`.trim(),
      };

      const { error: retryError2 } = await supabase.from('expenses').insert([fallback2]);
      if (retryError2) {
        console.error('CRITICAL: All expense insert fallbacks failed:', retryError2);
        throw new Error('تعذر حفظ الفاتورة في قاعدة البيانات: ' + (retryError2.message || 'خطأ في الاتصال'));
      }
    }
  }

  invalidateExpensesCache();
  revalidatePath('/admin/dashboard/reports');
  revalidatePath('/admin/dashboard/finance');
  return expense;
}

export async function deleteDbExpense(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
  
  invalidateExpensesCache();
  revalidatePath('/admin/dashboard/reports');
  revalidatePath('/admin/dashboard/finance');
}

export async function updateDbExpense(id: string, updates: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  try {
    // 1. Fetch current expense data from database
    const { data: existing, error: fetchErr } = await supabase.from('expenses').select('*').eq('id', id).maybeSingle();

    // 2. Parse existing description and tags
    let rawDesc = (updates.description !== undefined ? updates.description : (existing?.description || '')) || '';

    let finalInvoice = updates.invoice_number !== undefined ? updates.invoice_number : undefined;
    let finalNotes = updates.notes !== undefined ? updates.notes : undefined;
    let finalStatus = updates.status !== undefined ? updates.status : undefined;
    let finalApprovedBy = updates.approved_by !== undefined ? updates.approved_by : undefined;

    // Only fallback to existing tags if the property was NOT provided in updates
    if (finalInvoice === undefined && existing?.description) {
      const m = existing.description.match(/\[فاتورة:\s*([^\]]+)\]/);
      if (m) finalInvoice = m[1];
    }
    if (finalNotes === undefined && existing?.description) {
      const m = existing.description.match(/\[ملاحظات:\s*([^\]]+)\]/);
      if (m) finalNotes = m[1];
    }

    // Approval logic:
    if (finalApprovedBy === undefined) {
      if (finalStatus !== undefined) {
        if (finalStatus.includes('تم الموافقة') || finalStatus === 'APPROVED') {
          const m = finalStatus.match(/بواسطة:\s*([^\]]+)/);
          finalApprovedBy = m ? m[1].trim() : 'مؤمن';
        } else {
          finalApprovedBy = '';
        }
      } else if (existing?.description) {
        const m = existing.description.match(/\[اعتماد:\s*([^\]]+)\]/);
        if (m) finalApprovedBy = m[1].trim();
      }
    }

    if (finalStatus === undefined && existing?.description) {
      const m = existing.description.match(/\[حالة:\s*([^\]]+)\]/);
      if (m) finalStatus = m[1].trim();
    }

    // Clean description from old tags
    let cleanDesc = rawDesc
      .replace(/\[فاتورة:\s*[^\]]+\]/g, '')
      .replace(/\[ملاحظات:\s*[^\]]+\]/g, '')
      .replace(/\[حالة:\s*[^\]]+\]/g, '')
      .replace(/\[اعتماد:\s*[^\]]+\]/g, '')
      .replace(/\[من:\s*[^\]]+\]/g, '')
      .replace(/\[إلى:\s*[^\]]+\]/g, '')
      .replace(/\[بطلب:\s*[^\]]+\]/g, '')
      .replace(/\[فرع:\s*[^\]]+\]/g, '')
      .trim();

    const metaTags: string[] = [];
    if (finalInvoice && String(finalInvoice).trim()) metaTags.push(`[فاتورة: ${String(finalInvoice).trim()}]`);
    if (finalNotes && String(finalNotes).trim()) metaTags.push(`[ملاحظات: ${String(finalNotes).trim()}]`);
    
    // Only add [اعتماد] if finalApprovedBy is NOT empty!
    if (finalApprovedBy && String(finalApprovedBy).trim()) {
      metaTags.push(`[اعتماد: ${String(finalApprovedBy).trim()}]`);
    } else if (finalStatus && finalStatus !== 'PENDING' && !finalStatus.includes('تم الموافقة')) {
      metaTags.push(`[حالة: ${String(finalStatus).trim()}]`);
    }

    const finalDescription = metaTags.length > 0 ? `${metaTags.join(' ')} ${cleanDesc}`.trim() : cleanDesc;

    // Normalize date strictly to YYYY-MM-DD
    let rawDate = updates.date !== undefined ? updates.date : existing?.date;
    let cleanDate = normalizeDateString(rawDate);
    if (!cleanDate && typeof rawDate === 'string') {
      cleanDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
    }

    // Strictly safe payload containing only valid Postgres columns
    const safePayload: any = {
      description: finalDescription,
    };

    if (updates.amount !== undefined) safePayload.amount = Number(updates.amount) || 0;
    if (cleanDate) safePayload.date = cleanDate;
    if (updates.category !== undefined) safePayload.category = updates.category;
    else if (existing?.category) safePayload.category = existing.category;

    if (updates.from_entity !== undefined) safePayload.from_entity = updates.from_entity;
    if (updates.to_entity !== undefined) safePayload.to_entity = updates.to_entity;
    if (updates.ordered_by !== undefined) safePayload.ordered_by = updates.ordered_by;
    if (updates.branch !== undefined) safePayload.branch = parseInt(updates.branch) || 12;

    const { error: updateError } = await supabase.from('expenses').update(safePayload).eq('id', id);
    if (updateError) {
      console.error('Failed to update expense:', updateError);
      throw new Error(updateError.message || 'فشل تحديث المصروف');
    }

    invalidateExpensesCache();
    revalidatePath('/admin/dashboard/reports');
    revalidatePath('/admin/dashboard/finance');
    revalidatePath('/admin/dashboard/treasury');
  } catch (err: any) {
    console.error('Error in updateDbExpense:', err);
    throw err;
  }
}

// --- TREASURY TRANSFERS ---

function isTableMissingError(error: any) {
  if (!error) return false;

  const errorText = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST301' ||
    error.code === 'PGRST205' ||
    (errorText.includes('treasury_transfers') &&
      (errorText.includes('does not exist') || errorText.includes('relation') || errorText.includes('not found')))
  );
}

let cachedTransfers: CacheEntry<any[]> | null = null;
let inFlightTransfersPromise: Promise<any[]> | null = null;
const TRANSFERS_CACHE_TTL_MS = 6000; // 6 seconds

export async function invalidateTransfersCache() {
  cachedTransfers = null;
}

export async function getDbTreasuryTransfers(forceFresh?: boolean) {
  const now = Date.now();
  if (!forceFresh && cachedTransfers && (now - cachedTransfers.timestamp < TRANSFERS_CACHE_TTL_MS)) {
    return cachedTransfers.data;
  }

  if (inFlightTransfersPromise) {
    return await inFlightTransfersPromise;
  }

  inFlightTransfersPromise = (async () => {
    try {
      const supabase = getSupabaseServerClient();
      if (!supabase) return cachedTransfers?.data || [];

      const { data, error } = await supabase
        .from('treasury_transfers')
        .select('*')
        .order('transfer_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          console.warn('⚠️ Treasury table is not yet present in Supabase. Returning empty transfer list.');
          return [];
        }
        return cachedTransfers?.data || [];
      }

      const mapped = (data || []).map((t: any) => {
    let notes = t.notes || '';
    let handedBy = t.handed_by || '';
    let receivedBy = t.received_by || '';
    let type = 'deposit';
    let reason = '';
    let actor = '';
    let methodTag = '';

    if (handedBy.includes('[نوع:')) {
      const match = handedBy.match(/\[نوع:\s*([^\]]+)\]/);
      if (match) {
        type = match[1];
        handedBy = handedBy.replace(/\[نوع:\s*([^\]]+)\]/g, '').trim();
      }
    }
    if (notes.includes('[نوع:')) {
      const match = notes.match(/\[نوع:\s*([^\]]+)\]/);
      if (match) {
        type = match[1];
        notes = notes.replace(/\[نوع:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (handedBy.includes('[طريقة:')) {
      const match = handedBy.match(/\[طريقة:\s*([^\]]+)\]/);
      if (match) {
        methodTag = `[طريقة: ${match[1]}]`;
        handedBy = handedBy.replace(/\[طريقة:\s*([^\]]+)\]/g, '').trim();
      }
    }

    let targetMonthTag = '';
    if (handedBy.includes('[حساب_شهر:')) {
      const match = handedBy.match(/\[حساب_شهر:\s*([^\]]+)\]/);
      if (match) {
        targetMonthTag = `[حساب_شهر: ${match[1]}]`;
        handedBy = handedBy.replace(/\[حساب_شهر:\s*([^\]]+)\]/g, '').trim();
      }
    } else if (handedBy.includes('[شهر:')) {
      const match = handedBy.match(/\[شهر:\s*([^\]]+)\]/);
      if (match) {
        targetMonthTag = `[حساب_شهر: ${match[1]}]`;
        handedBy = handedBy.replace(/\[شهر:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (handedBy.includes('[سبب:')) {
      const match = handedBy.match(/\[سبب:\s*([^\]]+)\]/);
      if (match) {
        reason = match[1];
        handedBy = handedBy.replace(/\[سبب:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (handedBy.includes('[المستلم:')) {
      const match = handedBy.match(/\[المستلم:\s*([^\]]+)\]/);
      if (match) {
        receivedBy = match[1];
        handedBy = handedBy.replace(/\[المستلم:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (handedBy.includes('[ملاحظة:')) {
      const match = handedBy.match(/\[ملاحظة:\s*([^\]]+)\]/);
      if (match) {
        notes = match[1];
        handedBy = handedBy.replace(/\[ملاحظة:\s*([^\]]+)\]/g, '').trim();
      }
    }

    let time = '';
    if (handedBy.includes('[وقت:')) {
      const match = handedBy.match(/\[وقت:\s*([^\]]+)\]/);
      if (match) {
        time = match[1];
        handedBy = handedBy.replace(/\[وقت:\s*([^\]]+)\]/g, '').trim();
      }
    }
    if (notes.includes('[وقت:')) {
      const match = notes.match(/\[وقت:\s*([^\]]+)\]/);
      if (match) {
        time = match[1];
        notes = notes.replace(/\[وقت:\s*([^\]]+)\]/g, '').trim();
      }
    }

    let approvedBy = (t as any).approved_by || '';
    let status = (t as any).status || '';

    if (handedBy.includes('[اعتماد:')) {
      const match = handedBy.match(/\[اعتماد:\s*([^\]]+)\]/);
      if (match) {
        approvedBy = match[1].trim();
        handedBy = handedBy.replace(/\[اعتماد:\s*([^\]]+)\]/g, '').trim();
      }
    }
    if (notes.includes('[اعتماد:')) {
      const match = notes.match(/\[اعتماد:\s*([^\]]+)\]/);
      if (match) {
        approvedBy = match[1].trim();
        notes = notes.replace(/\[اعتماد:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (handedBy.includes('[حالة:')) {
      const match = handedBy.match(/\[حالة:\s*([^\]]+)\]/);
      if (match) {
        status = match[1].trim();
        handedBy = handedBy.replace(/\[حالة:\s*([^\]]+)\]/g, '').trim();
      }
    }
    if (notes.includes('[حالة:')) {
      const match = notes.match(/\[حالة:\s*([^\]]+)\]/);
      if (match) {
        status = match[1].trim();
        notes = notes.replace(/\[حالة:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (!status) {
      if (approvedBy) {
        status = `تم الموافقة بواسطة: ${approvedBy}`;
      } else {
        status = 'PENDING';
      }
    }

    const isWithdrawal = type === 'withdrawal' || type === 'سحب' || type.includes('سحب') ||
      handedBy === 'الخزنة الرئيسية' || handedBy === 'الخزنة الكبيرة' ||
      notes.includes('سحب من الرئيسية') || notes.includes('سحب');

    if (isWithdrawal) {
      type = 'withdrawal';
      actor = receivedBy || 'مؤمن';
      reason = reason || notes || 'سحب من الخزنة الكبيرة';
    } else {
      type = 'deposit';
      actor = handedBy || 'مزار';
      reason = notes || reason || 'توريد للخزنة الكبيرة';
    }

    const cleanUserNote = (notes || '')
      .replace(/\[(طريقة|نوع|سبب|المستلم|وقت|حساب_شهر|شهر|اعتماد|حالة):[^\]]+\]/g, '')
      .replace(/\[[^\]]+\]/g, '')
      .trim();

    const approvalTag = approvedBy ? `[اعتماد: ${approvedBy}]` : (status ? `[حالة: ${status}]` : '');
    const reconstructedNotes = [
      type === 'withdrawal' ? '[نوع: سحب]' : '',
      methodTag,
      targetMonthTag,
      approvalTag,
      reason ? `[سبب: ${reason}]` : '',
      cleanUserNote,
    ].filter(Boolean).join(' ');

    return {
      ...t,
      handed_by: handedBy,
      received_by: receivedBy,
      notes: reconstructedNotes,
      clean_user_note: cleanUserNote,
      type,
      reason,
      actor,
      time,
      status,
      approved_by: approvedBy,
    };
  });

      cachedTransfers = { data: mapped, timestamp: Date.now() };
      return mapped;
    } finally {
      inFlightTransfersPromise = null;
    }
  })();

  return await inFlightTransfersPromise;
}

export async function saveDbTreasuryTransfer(transfer: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const rawType = transfer.type || '';
  const isWithdrawal = rawType === 'withdrawal' || rawType === 'سحب' ||
    transfer.handed_by === 'الخزنة الرئيسية' || transfer.handed_by === 'الخزنة الكبيرة' ||
    (transfer.notes && (transfer.notes.includes('سحب') || transfer.notes.includes('withdrawal')));
  const type = isWithdrawal ? 'withdrawal' : 'deposit';

  const metaTags: string[] = [];
  if (type === 'withdrawal') metaTags.push('[نوع: سحب]');
  if (transfer.reason) metaTags.push(`[سبب: ${transfer.reason}]`);
  if (transfer.time) metaTags.push(`[وقت: ${transfer.time}]`);

  if (transfer.approved_by) {
    metaTags.push(`[اعتماد: ${transfer.approved_by}]`);
  } else if (transfer.status) {
    if (transfer.status.includes('موافقة') || transfer.status === 'APPROVED') {
      const match = transfer.status.match(/بواسطة:\s*([^\]]+)/);
      const appBy = match ? match[1].trim() : 'مؤمن';
      metaTags.push(`[اعتماد: ${appBy}]`);
    } else if (transfer.status === 'PENDING' || transfer.status === 'غير معتمد') {
      metaTags.push('[حالة: غير معتمد]');
    }
  }

  const notesText = transfer.notes || '';
  if (notesText) {
    if (notesText.includes('[طريقة:')) {
      const m = notesText.match(/\[طريقة:\s*([^\]]+)\]/);
      if (m && !metaTags.some(t => t.startsWith('[طريقة:'))) metaTags.push(`[طريقة: ${m[1]}]`);
    }
    if (notesText.includes('[المستلم:')) {
      const m = notesText.match(/\[المستلم:\s*([^\]]+)\]/);
      if (m && !metaTags.some(t => t.startsWith('[المستلم:'))) metaTags.push(`[المستلم: ${m[1]}]`);
    }
    if (notesText.includes('[سبب:')) {
      const m = notesText.match(/\[سبب:\s*([^\]]+)\]/);
      if (m && !metaTags.some(t => t.startsWith('[سبب:'))) metaTags.push(`[سبب: ${m[1]}]`);
    }

    if (notesText.includes('[حساب_شهر:')) {
      const m = notesText.match(/\[حساب_شهر:\s*([^\]]+)\]/);
      if (m && !metaTags.some(t => t.startsWith('[حساب_شهر:'))) metaTags.push(`[حساب_شهر: ${m[1]}]`);
    } else if (notesText.includes('[شهر:')) {
      const m = notesText.match(/\[شهر:\s*([^\]]+)\]/);
      if (m && !metaTags.some(t => t.startsWith('[حساب_شهر:'))) metaTags.push(`[حساب_شهر: ${m[1]}]`);
    }

    if (notesText.includes('[اعتماد:') && !metaTags.some(t => t.startsWith('[اعتماد:'))) {
      const m = notesText.match(/\[اعتماد:\s*([^\]]+)\]/);
      if (m) metaTags.push(`[اعتماد: ${m[1]}]`);
    }

    const plain = notesText.replace(/\[[^\]]+\]/g, '').trim();
    if (plain && !metaTags.some(t => t.startsWith('[ملاحظة:'))) {
      metaTags.push(`[ملاحظة: ${plain}]`);
    }
  }

  const handedByBase = transfer.handed_by || (type === 'withdrawal' ? 'الخزنة الكبيرة' : 'مزار');
  const receivedByText = transfer.received_by || (type === 'withdrawal' ? (transfer.actor || 'مؤمن') : 'الخزنة الكبيرة');
  const encodedHandedBy = metaTags.length > 0 ? `${metaTags.join(' ')} ${handedByBase}`.trim() : handedByBase;

  const row: any = {
    amount: Number(transfer.amount) || 0,
    handed_by: encodedHandedBy,
    received_by: receivedByText,
    transfer_date: transfer.transfer_date || new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await supabase.from('treasury_transfers').insert([row]).select().single();
  if (error) {
    if (isTableMissingError(error)) {
      throw new Error('جدول treasury_transfers غير موجود في Supabase.');
    }
    console.error('Error saving treasury transfer:', error);
    throw new Error(error.message || 'فشل حفظ حركة التحويل');
  }

  invalidateTransfersCache();
  revalidatePath('/admin/dashboard/treasury');
  return data;
}

export async function deleteDbTreasuryTransfer(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const { error } = await supabase.from('treasury_transfers').delete().eq('id', id);
  if (error) {
    if (isTableMissingError(error)) {
      throw new Error('جدول treasury_transfers غير موجود في Supabase. يرجى تطبيقه أولاً في قاعدة البيانات.');
    }
    throw error;
  }
  invalidateTransfersCache();
  revalidatePath('/admin/dashboard/treasury');
}

export async function updateDbTreasuryTransfer(id: string, updates: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const patch: any = {};
  if (updates.amount !== undefined) patch.amount = Number(updates.amount) || 0;
  if (updates.received_by !== undefined) patch.received_by = updates.received_by;
  if (updates.transfer_date !== undefined) patch.transfer_date = updates.transfer_date;

  if (
    updates.notes !== undefined ||
    updates.handed_by !== undefined ||
    updates.approved_by !== undefined ||
    updates.status !== undefined
  ) {
    let currentHanded = updates.handed_by;
    if (currentHanded === undefined) {
      const { data: current } = await supabase.from('treasury_transfers').select('handed_by').eq('id', id).single();
      currentHanded = current?.handed_by || '';
    }

    const isWithdrawal = currentHanded.includes('[نوع: سحب]') || currentHanded.includes('الخزنة الكبيرة') || currentHanded.includes('الخزنة الرئيسية');
    const baseName = currentHanded
      .replace(/\[نوع:[^\]]+\]/g, '')
      .replace(/\[طريقة:[^\]]+\]/g, '')
      .replace(/\[ملاحظة:[^\]]+\]/g, '')
      .replace(/\[حساب_شهر:[^\]]+\]/g, '')
      .replace(/\[شهر:[^\]]+\]/g, '')
      .replace(/\[سبب:[^\]]+\]/g, '')
      .replace(/\[المستلم:[^\]]+\]/g, '')
      .replace(/\[وقت:[^\]]+\]/g, '')
      .replace(/\[اعتماد:[^\]]+\]/g, '')
      .replace(/\[حالة:[^\]]+\]/g, '')
      .trim();

    const tags: string[] = [];
    if (isWithdrawal) tags.push('[نوع: سحب]');

    const noteToCheck = updates.notes !== undefined ? updates.notes : currentHanded;
    if (noteToCheck.includes('[طريقة:')) {
      const m = noteToCheck.match(/\[طريقة:\s*([^\]]+)\]/);
      if (m) tags.push(`[طريقة: ${m[1]}]`);
    }

    if (noteToCheck.includes('[حساب_شهر:')) {
      const m = noteToCheck.match(/\[حساب_شهر:\s*([^\]]+)\]/);
      if (m) tags.push(`[حساب_شهر: ${m[1]}]`);
    } else if (noteToCheck.includes('[شهر:')) {
      const m = noteToCheck.match(/\[شهر:\s*([^\]]+)\]/);
      if (m) tags.push(`[حساب_شهر: ${m[1]}]`);
    }

    if (noteToCheck.includes('[سبب:')) {
      const m = noteToCheck.match(/\[سبب:\s*([^\]]+)\]/);
      if (m) tags.push(`[سبب: ${m[1]}]`);
    }

    // Approval handling
    let finalApprovedBy = updates.approved_by;
    if (finalApprovedBy === undefined) {
      if (updates.status !== undefined) {
        if (updates.status.includes('موافقة') || updates.status === 'APPROVED') {
          const match = updates.status.match(/بواسطة:\s*([^\]]+)/);
          finalApprovedBy = match ? match[1].trim() : 'مؤمن';
        } else {
          finalApprovedBy = '';
        }
      } else {
        const match = currentHanded.match(/\[اعتماد:\s*([^\]]+)\]/);
        if (match) finalApprovedBy = match[1].trim();
      }
    }

    if (finalApprovedBy && finalApprovedBy.trim() !== '') {
      tags.push(`[اعتماد: ${finalApprovedBy.trim()}]`);
    } else if (updates.approved_by !== undefined || updates.status !== undefined) {
      tags.push('[حالة: غير معتمد]');
    } else if (currentHanded.includes('[حالة:')) {
      const m = currentHanded.match(/\[حالة:\s*([^\]]+)\]/);
      if (m) tags.push(`[حالة: ${m[1]}]`);
    }

    // Notes
    if (updates.notes !== undefined) {
      const plainNote = updates.notes.replace(/\[[^\]]+\]/g, '').trim();
      if (plainNote) {
        tags.push(`[ملاحظة: ${plainNote}]`);
      }
    } else {
      const m = currentHanded.match(/\[ملاحظة:\s*([^\]]+)\]/);
      if (m) tags.push(`[ملاحظة: ${m[1]}]`);
    }

    patch.handed_by = `${tags.join(' ')} ${baseName || (isWithdrawal ? 'الخزنة الكبيرة' : 'مزار')}`.trim();
  }

  const { data, error } = await supabase.from('treasury_transfers').update(patch).eq('id', id).select().single();
  if (error) {
    console.error('Error updating treasury transfer:', error);
    throw error;
  }
  invalidateTransfersCache();
  revalidatePath('/admin/dashboard/treasury');
  return data;
}

// --- TO-DO LIST DB FUNCTIONS (Persisted with DB & fallback storage in translations id: 101) ---

async function getTodosFromStorage(supabase: any): Promise<any[]> {
  try {
    const { data, error } = await supabase.from('translations').select('data').eq('id', 101).single();
    if (error || !data?.data) return [];
    return Array.isArray(data.data) ? data.data : [];
  } catch (err) {
    console.error('Error fetching fallback todos:', err);
    return [];
  }
}

async function saveTodosToStorage(supabase: any, todos: any[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('translations')
      .upsert({ id: 101, data: todos, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Error saving todos to fallback storage:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveTodosToStorage:', err);
    return false;
  }
}

export async function getDbTodos(_cacheBuster?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const fallbackTodos = await getTodosFromStorage(supabase);
  return fallbackTodos.sort(
    (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

export async function saveDbTodo(todo: { title: string; notes?: string; created_by?: string }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const row = {
    id: `todo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: String(todo.title || '').trim(),
    notes: String(todo.notes || '').trim(),
    completed: false,
    created_by: String(todo.created_by || 'Admin').trim(),
    created_at: new Date().toISOString(),
  };

  const currentList = await getTodosFromStorage(supabase);
  const updatedList = [row, ...currentList];
  const ok = await saveTodosToStorage(supabase, updatedList);
  if (!ok) {
    throw new Error('فشل حفظ المهمة في قاعدة البيانات.');
  }

  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/dashboard/tasks');
  return row;
}

export async function updateDbTodoStatus(id: string, completed: boolean, completed_by?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const currentList = await getTodosFromStorage(supabase);
  const updatedList = currentList.map((t: any) => {
    if (t.id === id) {
      return {
        ...t,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? (completed_by || t.completed_by || 'Admin') : null,
      };
    }
    return t;
  });
  await saveTodosToStorage(supabase, updatedList);

  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/dashboard/tasks');
}

export async function deleteDbTodo(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const currentList = await getTodosFromStorage(supabase);
  const updatedList = currentList.filter((t: any) => t.id !== id);
  await saveTodosToStorage(supabase, updatedList);

  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/dashboard/tasks');
}

// --- CUSTOMER PROFILE NOTES (Isolated from bookings, persisted in translations id: 102) ---

export async function getDbCustomerNotes(): Promise<Record<string, string>> {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return {};
    const { data, error } = await supabase.from('translations').select('data').eq('id', 102).single();
    if (error || !data?.data) return {};
    return typeof data.data === 'object' && data.data !== null ? data.data : {};
  } catch (err) {
    console.error('Error fetching customer profile notes:', err);
    return {};
  }
}

export async function saveDbCustomerNote(phone: string, note: string): Promise<boolean> {
  if (!phone) return false;
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return false;
    const cleanPhone = phone.trim();
    const currentNotes = await getDbCustomerNotes();
    const trimmed = (note || '').trim();
    if (trimmed) {
      currentNotes[cleanPhone] = trimmed;
    } else {
      delete currentNotes[cleanPhone];
    }
    const { error } = await supabase
      .from('translations')
      .upsert({ id: 102, data: currentNotes, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Error saving customer profile note:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error in saveDbCustomerNote:', err);
    return false;
  }
}




