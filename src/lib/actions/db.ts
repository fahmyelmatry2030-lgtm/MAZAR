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

// --- BOOKINGS ---

export async function getFreshDbBookings(nonce?: string) {
  if (nonce) console.log(`[SYNC] Fetching fresh bookings with nonce: ${nonce}`);
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .not('id', 'is', null) // Bypasses exact-match caches
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error reading bookings:', error);
    return [];
  }

  // --- AUTO-CLEANUP: Delete expired pending requests ---
  // If a booking is still 'pending' and its check-in day has arrived, delete it.
  const today = new Date().toISOString().split('T')[0];
  const pendingStatuses = ['جديد', 'قيد المراجعة', 'pending', 'رد جديد'];
  
  const expiredIds = data
    .filter((b: any) => pendingStatuses.includes(b.status) && normalizeDateString(b.check_in) < today)
    .map((b: any) => b.id);

  if (expiredIds.length > 0) {
    console.log(`[CLEANUP] Automatically deleting ${expiredIds.length} expired pending requests:`, expiredIds);
    // Hard delete from DB
    await supabase.from('bookings').delete().in('id', expiredIds);
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

    if (b.payment_status === 'باقي') return 'باقي';
    return 'خالص';
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

  return data
    .filter((b: any) => !expiredIds.includes(b.id))
    .map((b: any) => {
      const totalAmount = Number(b.total_amount || 0);
      const days = Number(b.number_of_days || 0);

      // احتساب المدفوع والمتبقي بدقة لكل حجز
      const noteStr = String(b.notes || '').trim().toLowerCase();
      const infoStr = String(b.payment_info || '').trim().toLowerCase();
      const combined = `${noteStr} ${infoStr}`;

      const paidTagMatch = combined.match(/\[مدفوع:\s*([\d.]+)/);
      const remainingTagMatch = combined.match(/\[متبقي:\s*([\d.]+)/) || combined.match(/\[باقي:\s*([\d.]+)/);

      let calcPaid = totalAmount;
      let calcRemaining = 0;

      if (b.paid_amount !== undefined && b.paid_amount !== null && b.paid_amount !== '') {
        calcPaid = Math.min(totalAmount, Math.max(0, Number(b.paid_amount)));
        calcRemaining = Math.max(0, totalAmount - calcPaid);
      } else if (paidTagMatch && remainingTagMatch) {
        calcPaid = Number(paidTagMatch[1]) || 0;
        calcRemaining = Number(remainingTagMatch[1]) || 0;
      } else if (paidTagMatch) {
        calcPaid = Math.min(totalAmount, Number(paidTagMatch[1]) || 0);
        calcRemaining = Math.max(0, totalAmount - calcPaid);
      } else if (remainingTagMatch) {
        calcRemaining = Math.min(totalAmount, Number(remainingTagMatch[1]) || 0);
        calcPaid = Math.max(0, totalAmount - calcRemaining);
      } else {
        const textRemaining = extractRemainingFromText(combined);
        const textPaid = extractPaidFromText(combined);

        if (textPaid !== null && textRemaining !== null) {
          calcPaid = textPaid;
          calcRemaining = textRemaining;
        } else if (textRemaining !== null) {
          calcRemaining = textRemaining;
          calcPaid = Math.max(0, totalAmount - textRemaining);
        } else if (textPaid !== null) {
          calcPaid = textPaid;
          calcRemaining = Math.max(0, totalAmount - textPaid);
        } else if (detectPaymentStatus(b) === 'باقي') {
          // استخراج أي رقم موجود بعد فحص عدم وجود خالص
          const anyNumMatch = combined.match(/(\+?\s*\d[\d.,]*\s*(?:k|ك|ألف|الف)?)/);
          if (anyNumMatch) {
            const rawNum = anyNumMatch[1].replace(/^\+/, '').trim();
            const num = parseArabicNumberString(rawNum);
            if (num !== null && num > 0) {
              calcRemaining = num;
              calcPaid = Math.max(0, totalAmount - num);
            } else {
              calcPaid = 0;
              calcRemaining = totalAmount;
            }
          } else {
            calcPaid = 0;
            calcRemaining = totalAmount;
          }
        }
      }

      return {
        id: b.id,
        name: b.name,
        phone: b.phone,
        checkIn: normalizeDateString(b.check_in),
        checkOut: normalizeDateString(b.check_out),
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
        brokerName: b.broker_name,
        guestsCount: Number(b.guests_count || 1),
        clientStatus: b.client_status || 'انتظار',
        bookingManager: b.booking_manager || '',
        paymentMethod: b.payment_method || '',
        notes: b.notes,
        source: b.source || (String(b.payment_info || '').includes('[طلب') ? 'website' : 'manual'),
        isWebsiteBooking: b.is_website_booking ?? (String(b.payment_info || '').includes('[طلب') || b.status === 'جديد' || b.status === 'pending'),
        timestamp: b.timestamp,
      };
    });
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

    // Build insert object — exclude columns that may not exist in DB yet
    const insertData: any = {
      id: newBookingWithId.id,
      name: newBookingWithId.name,
      phone: newBookingWithId.phone,
      check_in: newBookingWithId.checkIn,
      check_out: newBookingWithId.checkOut,
      apartment_id: newBookingWithId.apartmentId ?? null,
      studio: newBookingWithId.studio ?? null,
      status: newBookingWithId.status,
      payment_info: newBookingWithId.paymentInfo ?? null,
      total_amount: newBookingWithId.totalAmount ?? null,
      number_of_days: newBookingWithId.numberOfDays ?? null,
      nationality: newBookingWithId.nationality ?? null,
      id_number: newBookingWithId.idNumber ?? null,
      commission: newBookingWithId.commission ?? null,
      broker_name: newBookingWithId.brokerName ?? null,
      client_status: newBookingWithId.clientStatus || 'انتظار',
      guests_count: newBookingWithId.guestsCount ?? 1,
      notes: newBookingWithId.notes ?? null,
      timestamp: newBookingWithId.timestamp,
    };

    // Append optional columns only if they have values (they may not exist in the DB schema yet)
    if (newBookingWithId.bookingManager) insertData.booking_manager = newBookingWithId.bookingManager;
    if (newBookingWithId.paymentMethod) insertData.payment_method = newBookingWithId.paymentMethod;

    let { error } = await supabase.from('bookings').insert(insertData);

    // Retry without optional columns if they don't exist in the schema
    const isSchemaError = error && (
      error.code === 'PGRST204' ||
      error.code === '42703' ||
      error.message?.toLowerCase().includes('schema cache') ||
      error.message?.toLowerCase().includes('booking_manager') ||
      error.message?.toLowerCase().includes('payment_method')
    );

    if (isSchemaError) {
      console.warn('Retrying insert without booking_manager/payment_method columns...');
      delete insertData.booking_manager;
      delete insertData.payment_method;
      // Preserve booking_manager/payment_method info in notes if they were provided
      const extras: string[] = [];
      if (newBookingWithId.bookingManager) extras.push(`مسئول الحجز: ${newBookingWithId.bookingManager}`);
      if (newBookingWithId.paymentMethod) extras.push(`طريقة الدفع: ${newBookingWithId.paymentMethod}`);
      if (extras.length > 0) {
        insertData.notes = [insertData.notes, ...extras].filter(Boolean).join(' | ');
      }
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
    const freshData = await getFreshDbBookings(Date.now().toString());
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
  if (updates.paymentInfo !== undefined) patch.payment_info = updates.paymentInfo;
  if (updates.paymentStatus !== undefined) {
    patch.payment_status = updates.paymentStatus;
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
  // booking_manager, payment_method, payment_status & paid_amount: try to include, will be stripped on retry if columns don't exist
  if (updates.bookingManager !== undefined) patch.booking_manager = updates.bookingManager;
  if (updates.paymentMethod !== undefined) patch.payment_method = updates.paymentMethod;
  if (updates.paidAmount !== undefined) patch.paid_amount = updates.paidAmount;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  
  // ALWAYS update the timestamp on edit to ensure "Fresh First" sync logic works
  patch.timestamp = new Date().toISOString();

  let { data, error } = await supabase.from('bookings')
    .update(patch)
    .eq('id', id)
    .select();

  // Retry without optional columns if they don't exist in the schema
  const isSchemaError = error && (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    error.message?.toLowerCase().includes('schema cache') ||
    error.message?.toLowerCase().includes('booking_manager') ||
    error.message?.toLowerCase().includes('payment_method') ||
    error.message?.toLowerCase().includes('payment_status') ||
    error.message?.toLowerCase().includes('paid_amount')
  );

  if (isSchemaError) {
    console.warn('Retrying update without optional columns...');
    delete patch.booking_manager;
    delete patch.payment_method;
    delete patch.payment_status;
    delete patch.paid_amount;
    if (updates.paymentStatus !== undefined) {
      patch.payment_info = updates.paymentStatus;
    }
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
  revalidatePath('/admin/dashboard/reports');
  
  // Return the fresh data directly
  return await getFreshDbBookings(Date.now().toString());
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
  revalidatePath('/admin/dashboard/reports');
  
  // Return the fresh data
  return await getFreshDbBookings(Date.now().toString());
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

  revalidatePath('/admin/dashboard');
  return await getFreshDbBookings(Date.now().toString());
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
  revalidatePath('/admin/dashboard/customers');
  revalidatePath('/admin/dashboard/reports');
  return await getFreshDbBookings(Date.now().toString());
}

// --- UNITS ---

export async function getDbUnits() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from('units').select('*').order('id', { ascending: true });
  if (error) {
    console.error('Error reading units:', error);
    return [];
  }

  return (data || []).map((u: any) => ({
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

  return await getDbUnits();
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
      mohsen: { username: 'Mohsen', name: 'Mohsen', role: 'Mohsen', password: 'Mohsen 55' },
      akoura: { username: 'Akoura', name: 'أكورة (مزار 3)', role: 'Akoura', password: 'akoura2026' },
      aura: { username: 'Akoura', name: 'أكورة (مزار 3)', role: 'Akoura', password: 'akoura2026' },
      koura: { username: 'Akoura', name: 'أكورة (مزار 3)', role: 'Akoura', password: 'akoura2026' },
    };
    const fixedAdmin = fixedAdmins[cleanUsername.toLowerCase()];
    if (fixedAdmin && fixedAdmin.password === cleanPass) {
      const { password, ...admin } = fixedAdmin;
      return { success: true, admin: { id: `fixed-${admin.role.toLowerCase()}`, ...admin } };
    }
    
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      console.warn('Database offline, authentication failed');
      return { success: false };
    }

    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', cleanUsername)
      .eq('password', cleanPass)
      .limit(1);
    if (error) {
      console.error('Supabase error during admin auth:', error);
      throw error;
    }

    const validAdmin = data?.[0];
    if (validAdmin) return { success: true, admin: validAdmin };

    // Send security alert to Telegram on failed login attempt
    await sendSecurityTelegramAlert(cleanUsername, 'محاولة دخول فاشلة - كلمة المرور أو اسم المستخدم غير صحيح.');

    return { success: false };
  } catch (error) {
    console.error('Error reading admins:', error);
    await sendSecurityTelegramAlert(username || 'غير محدد', 'خطأ أثناء فحص بيانات الدخول في النظام.');
    return { success: false };
  }
}

export async function getDbAdmins() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from('admins').select('*').order('role', { ascending: false });
  if (error) {
    console.error('Error getting admins:', error);
    return [];
  }
  return data || [];
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
      notes,
    };
  });
}

export async function saveDbStaff(staff: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return staff;

  const { error } = await supabase.from('staff').upsert(staff);
  if (error) {
    if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('schema')) {
      const fallbackStaff = { ...staff };
      let metaTags = [];

      if (staff.housing_allowance || staff.transport_allowance || staff.other_allowances) {
        metaTags.push(`[بدلات: ${staff.housing_allowance || 0}|${staff.transport_allowance || 0}|${staff.other_allowances || 0}]`);
        delete fallbackStaff.housing_allowance;
        delete fallbackStaff.transport_allowance;
        delete fallbackStaff.other_allowances;
      }

      if (staff.national_id) {
        metaTags.push(`[قومي: ${staff.national_id}]`);
        delete fallbackStaff.national_id;
      }

      if (staff.notes) {
        metaTags.push(`[ملاحظات: ${staff.notes}]`);
        delete fallbackStaff.notes;
      }

      if (metaTags.length > 0) {
        fallbackStaff.position = `${metaTags.join(' ')} ${staff.position || ''}`.trim();
      }

      const { error: retryError } = await supabase.from('staff').upsert(fallbackStaff);
      if (retryError) throw retryError;
      revalidatePath('/admin/dashboard/hr/salaries');
      return fallbackStaff;
    }
    throw error;
  }
  revalidatePath('/admin/dashboard/hr/salaries');
  return staff;
}

export async function deleteDbStaff(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) throw error;
  revalidatePath('/admin/dashboard/hr/salaries');
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
    const cleanAmount = Number(sal.net_salary || sal.amount || 0);
    return {
      ...sal,
      notes,
      payment_method,
      amount: cleanAmount,
      net_salary: cleanAmount,
      payment_date: sal.payment_date || sal.date || ''
    };
  });
}

export async function saveDbSalary(salary: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return salary;

  const salaryId = salary.id || `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const paymentDate = salary.payment_date || salary.date || new Date().toISOString().split('T')[0];
  const amountVal = Number(salary.net_salary || salary.amount || 0);
  const paymentMethod = salary.payment_method || 'كاش';

  // Format notes to include payment method if needed
  let notesWithMeta = salary.notes || '';
  if (paymentMethod && !notesWithMeta.includes('[طريقة:')) {
    notesWithMeta = `[طريقة: ${paymentMethod}] ${notesWithMeta}`.trim();
  }

  const payload: any = {
    id: salaryId,
    staff_id: salary.staff_id,
    month: Number(salary.month) || (new Date(paymentDate).getMonth() + 1),
    year: Number(salary.year) || new Date(paymentDate).getFullYear(),
    bonuses: Number(salary.bonuses) || 0,
    deductions: Number(salary.deductions) || 0,
    net_salary: amountVal,
    payment_status: salary.payment_status || 'paid',
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

  // --- GUARANTEED DEDUCTION FROM SMALL TREASURY (الخزنة الصغيرة) ---
  // Every salary payment or advance ('إن شاء الله حتى لو جنيه') is recorded as an expense from الخزنة الصغيرة
  if (amountVal > 0) {
    try {
      const staffList = await getDbStaff();
      const staffMember = staffList.find((s: any) => s.id === salary.staff_id);
      const staffName = staffMember?.name || 'موظف';
      const cleanNote = (salary.notes || '').replace(/\[طريقة:\s*[^\]]+\]/g, '').trim();
      const expenseDesc = `صرف للموظف: ${staffName} - ${cleanNote || 'دفعة راتب'} [قيد:${salaryId}] [طريقة:${paymentMethod}]`;

      // Check if expense already exists for this payment ID
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
        from_entity: 'الخزنة الصغيرة',
        to_entity: staffName,
        ordered_by: 'إدارة الموظفين',
        notes: `طريقة الصرف: ${paymentMethod}`
      };

      if (existingExpenses && existingExpenses.length > 0) {
        await supabase.from('expenses').update(expenseData).eq('id', existingExpenses[0].id);
      } else {
        await saveDbExpense(expenseData);
      }
    } catch (err) {
      console.error('Failed to auto-deduct salary from small treasury:', err);
    }
  }

  revalidatePath('/admin/dashboard/hr/staff');
  revalidatePath('/admin/dashboard/hr/salaries');
  revalidatePath('/admin/dashboard/treasury');
  revalidatePath('/admin/dashboard/finance');
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

export async function getDbExpenses() {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }

  return (data || []).map((exp: any) => {
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
  
  revalidatePath('/admin/dashboard/reports');
  revalidatePath('/admin/dashboard/finance');
}

export async function updateDbExpense(id: string, updates: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from('expenses').update(updates).eq('id', id);
  if (error) {
    console.warn('⚠️ Standard update failed. Retrying update with robust metadata fallback...', error.message);

    try {
      // 1. Fetch current expense data from database
      const { data: existing, error: fetchErr } = await supabase.from('expenses').select('*').eq('id', id).single();
      if (fetchErr || !existing) {
        throw new Error(fetchErr?.message || 'المصروف غير موجود');
      }

      // 2. Parse existing description and tags
      let rawDesc = existing.description || '';
      let existingInvoice = existing.invoice_number || '';
      let existingFrom = existing.from_entity || '';
      let existingTo = existing.to_entity || '';
      let existingOrderedBy = existing.ordered_by || '';
      let existingNotes = existing.notes || '';
      let existingStatus = existing.status || '';
      let existingApprovedBy = existing.approved_by || '';
      let existingBranch = existing.branch || 12;

      const extractAndStrip = (regex: RegExp) => {
        const match = rawDesc.match(regex);
        if (match) {
          rawDesc = rawDesc.replace(regex, '').trim();
          return match[1];
        }
        return '';
      };

      const tInv = extractAndStrip(/\[فاتورة:\s*([^\]]+)\]/);
      if (tInv) existingInvoice = tInv;
      const tFrom = extractAndStrip(/\[من:\s*([^\]]+)\]/);
      if (tFrom) existingFrom = tFrom;
      const tTo = extractAndStrip(/\[إلى:\s*([^\]]+)\]/);
      if (tTo) existingTo = tTo;
      const tOrd = extractAndStrip(/\[بطلب:\s*([^\]]+)\]/);
      if (tOrd) existingOrderedBy = tOrd;
      const tBranch = extractAndStrip(/\[فرع:\s*([^\]]+)\]/);
      if (tBranch) existingBranch = parseInt(tBranch) || 12;
      const tNotes = extractAndStrip(/\[ملاحظات:\s*([^\]]+)\]/);
      if (tNotes) existingNotes = tNotes;
      const tStatus = extractAndStrip(/\[حالة:\s*([^\]]+)\]/);
      if (tStatus) existingStatus = tStatus;
      const tAppr = extractAndStrip(/\[اعتماد:\s*([^\]]+)\]/);
      if (tAppr) {
        existingApprovedBy = tAppr;
        existingStatus = `تم الموافقة بواسطة: ${tAppr}`;
      }

      // Base description (strip any lingering tags)
      let baseDesc = (updates.description !== undefined ? updates.description : rawDesc) || '';
      baseDesc = baseDesc
        .replace(/\[فاتورة:\s*([^\]]+)\]/g, '')
        .replace(/\[من:\s*([^\]]+)\]/g, '')
        .replace(/\[إلى:\s*([^\]]+)\]/g, '')
        .replace(/\[بطلب:\s*([^\]]+)\]/g, '')
        .replace(/\[فرع:\s*([^\]]+)\]/g, '')
        .replace(/\[ملاحظات:\s*([^\]]+)\]/g, '')
        .replace(/\[حالة:\s*([^\]]+)\]/g, '')
        .replace(/\[اعتماد:\s*([^\]]+)\]/g, '')
        .trim();

      // Resolve final field values
      const finalInvoice = updates.invoice_number !== undefined ? updates.invoice_number : existingInvoice;
      const finalFrom = updates.from_entity !== undefined ? updates.from_entity : existingFrom;
      const finalTo = updates.to_entity !== undefined ? updates.to_entity : existingTo;
      const finalOrderedBy = updates.ordered_by !== undefined ? updates.ordered_by : existingOrderedBy;
      const finalNotes = updates.notes !== undefined ? updates.notes : existingNotes;
      const finalStatus = updates.status !== undefined ? updates.status : existingStatus;
      const finalApprovedBy = updates.approved_by !== undefined ? updates.approved_by : existingApprovedBy;
      const finalBranch = updates.branch !== undefined ? updates.branch : existingBranch;
      const finalAmount = updates.amount !== undefined ? Number(updates.amount) : existing.amount;
      const finalDate = updates.date !== undefined ? updates.date : existing.date;
      const finalCategory = updates.category !== undefined ? updates.category : existing.category || 'عام';

      // 3. Assemble metadata tags
      const metaTags: string[] = [];
      if (finalInvoice) metaTags.push(`[فاتورة: ${finalInvoice}]`);
      if (finalFrom) metaTags.push(`[من: ${finalFrom}]`);
      if (finalTo) metaTags.push(`[إلى: ${finalTo}]`);
      if (finalOrderedBy) metaTags.push(`[بطلب: ${finalOrderedBy}]`);
      if (finalBranch) metaTags.push(`[فرع: ${finalBranch}]`);
      if (finalNotes) metaTags.push(`[ملاحظات: ${finalNotes}]`);
      if (finalApprovedBy) {
        metaTags.push(`[اعتماد: ${finalApprovedBy}]`);
      } else if (finalStatus) {
        metaTags.push(`[حالة: ${finalStatus}]`);
      }

      const reconstructedDesc = `${metaTags.join(' ')} ${baseDesc}`.trim();

      // 4. Try updating with safe columns
      const safePayload: any = {
        category: finalCategory,
        amount: finalAmount,
        date: finalDate,
        description: reconstructedDesc,
        branch: parseInt(finalBranch) || 12,
        from_entity: finalFrom,
        to_entity: finalTo,
        ordered_by: finalOrderedBy,
      };

      const { error: fallbackError } = await supabase.from('expenses').update(safePayload).eq('id', id);
      if (fallbackError) {
        // Minimum core fallback: category, amount, date, description
        const corePayload = {
          category: finalCategory,
          amount: finalAmount,
          date: finalDate,
          description: reconstructedDesc,
        };
        const { error: coreErr } = await supabase.from('expenses').update(corePayload).eq('id', id);
        if (coreErr) {
          console.error('CRITICAL: All expense update fallbacks failed:', coreErr);
          throw new Error('تعذر تعديل المصروف في قاعدة البيانات: ' + (coreErr.message || 'خطأ غير معروف'));
        }
      }
    } catch (fallbackCatch: any) {
      console.error('CRITICAL: Fallback execution error:', fallbackCatch);
      throw new Error(fallbackCatch.message || 'خطأ أثناء تعديل المصروف');
    }
  }

  revalidatePath('/admin/dashboard/reports');
  revalidatePath('/admin/dashboard/finance');
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

export async function getDbTreasuryTransfers() {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

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
    throw error;
  }

  return (data || []).map((t: any) => {
    let notes = t.notes || '';
    let handedBy = t.handed_by || '';
    let receivedBy = t.received_by || '';
    let type = 'deposit';
    let reason = '';
    let actor = '';

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

    if (handedBy.includes('[ملاحظة:')) {
      const match = handedBy.match(/\[ملاحظة:\s*([^\]]+)\]/);
      if (match) {
        notes = match[1];
        handedBy = handedBy.replace(/\[ملاحظة:\s*([^\]]+)\]/g, '').trim();
      }
    }

    if (handedBy.includes('[سبب:')) {
      const match = handedBy.match(/\[سبب:\s*([^\]]+)\]/);
      if (match) {
        reason = match[1];
        handedBy = handedBy.replace(/\[سبب:\s*([^\]]+)\]/g, '').trim();
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

    if (handedBy === 'الخزنة الرئيسية' || type === 'withdrawal' || type === 'سحب') {
      type = 'withdrawal';
      actor = receivedBy || 'مؤمن';
      reason = reason || notes || 'سحب من الخزنة الرئيسية';
    } else {
      type = 'deposit';
      actor = handedBy || 'مزار';
      reason = notes || reason || 'توريد للخزنة الرئيسية';
    }

    return {
      ...t,
      handed_by: handedBy,
      received_by: receivedBy,
      notes,
      type,
      reason,
      actor,
      time,
    };
  });
}

export async function saveDbTreasuryTransfer(transfer: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const type = transfer.type || (transfer.handed_by === 'الخزنة الرئيسية' ? 'withdrawal' : 'deposit');
  const metaTags: string[] = [];
  if (type === 'withdrawal') metaTags.push('[نوع: سحب]');
  if (transfer.reason) metaTags.push(`[سبب: ${transfer.reason}]`);
  if (transfer.time) metaTags.push(`[وقت: ${transfer.time}]`);
  if (transfer.notes) metaTags.push(`[ملاحظة: ${transfer.notes}]`);

  const handedByText = transfer.handed_by || (type === 'withdrawal' ? 'الخزنة الرئيسية' : 'مزار');
  const receivedByText = transfer.received_by || (type === 'withdrawal' ? (transfer.actor || 'مؤمن') : 'الخزنة الرئيسية');
  const fullNotes = transfer.notes || transfer.reason || (type === 'withdrawal' ? 'سحب من الخزنة الرئيسية' : 'توريد للخزنة الرئيسية');

  const row: any = {
    amount: Number(transfer.amount) || 0,
    handed_by: handedByText,
    received_by: receivedByText,
    transfer_date: transfer.transfer_date || new Date().toISOString().slice(0, 10),
    notes: metaTags.length > 0 ? `${metaTags.join(' ')} ${fullNotes}`.trim() : fullNotes,
  };

  const { data, error } = await supabase.from('treasury_transfers').insert([row]).select().single();
  if (error) {
    if (isTableMissingError(error)) {
      throw new Error('جدول treasury_transfers غير موجود في Supabase. يرجى تطبيقه أولاً في قاعدة البيانات.');
    }
    
    console.warn('⚠️ Standard treasury insert failed. Retrying with schema fallback...', error.message);
    const fallbackHanded = metaTags.length > 0 ? `${metaTags.join(' ')} ${handedByText}`.trim() : handedByText;
    const fallbackRow = {
      amount: Number(transfer.amount) || 0,
      handed_by: fallbackHanded,
      received_by: receivedByText,
      transfer_date: transfer.transfer_date || new Date().toISOString().slice(0, 10),
    };

    const { data: retryData, error: retryError } = await supabase
      .from('treasury_transfers')
      .insert([fallbackRow])
      .select()
      .single();

    if (retryError) {
      console.error('Error saving treasury transfer on fallback retry:', retryError);
      throw new Error(retryError.message || 'فشل حفظ حركة التحويل');
    }

    revalidatePath('/admin/dashboard/treasury');
    return retryData;
  }

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
  revalidatePath('/admin/dashboard/treasury');
}

export async function updateDbTreasuryTransfer(id: string, updates: any) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const patch: any = {};
  if (updates.amount !== undefined) patch.amount = Number(updates.amount) || 0;
  if (updates.handed_by !== undefined) patch.handed_by = updates.handed_by;
  if (updates.received_by !== undefined) patch.received_by = updates.received_by;
  if (updates.transfer_date !== undefined) patch.transfer_date = updates.transfer_date;
  if (updates.notes !== undefined) patch.notes = updates.notes;

  const { data, error } = await supabase.from('treasury_transfers').update(patch).eq('id', id).select();
  if (error) {
    console.error('Error updating treasury transfer:', error);
    throw error;
  }
  revalidatePath('/admin/dashboard/treasury');
  return data;
}

// --- TO-DO LIST DB FUNCTIONS ---

export async function getDbTodos() {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('todo_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (isTableMissingError(error)) {
      console.warn('⚠️ Table todo_items does not exist in Supabase yet.');
      return [];
    }
    console.error('Error fetching todo_items:', error);
    return [];
  }

  return data || [];
}

export async function saveDbTodo(todo: { title: string; notes?: string; created_by?: string }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('Supabase configuration missing on server');

  const row = {
    title: String(todo.title || '').trim(),
    notes: String(todo.notes || '').trim(),
    completed: false,
    created_by: String(todo.created_by || 'Admin').trim(),
  };

  const { data, error } = await supabase.from('todo_items').insert([row]).select().single();
  if (error) {
    if (isTableMissingError(error)) {
      console.warn('⚠️ Table todo_items missing in Supabase. Returning fallback object.');
      return { id: `todo-${Date.now()}`, ...row, created_at: new Date().toISOString() };
    }
    throw new Error(error.message || 'فشل حفظ المهمة');
  }

  revalidatePath('/admin/dashboard');
  return data;
}

export async function updateDbTodoStatus(id: string, completed: boolean, completed_by?: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const updateData: any = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };
  if (completed && completed_by) {
    updateData.completed_by = completed_by;
  }

  const { error } = await supabase
    .from('todo_items')
    .update(updateData)
    .eq('id', id);

  if (error) {
    if (error.code === '42703' || error.message?.includes('column')) {
      const { error: retryErr } = await supabase
        .from('todo_items')
        .update({ completed })
        .eq('id', id);
      if (retryErr) console.error('Error updating todo status fallback:', retryErr);
    } else if (!isTableMissingError(error)) {
      console.error('Error updating todo status:', error);
    }
  }
  revalidatePath('/admin/dashboard');
  revalidatePath('/admin/dashboard/tasks');
}

export async function deleteDbTodo(id: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from('todo_items').delete().eq('id', id);
  if (error && !isTableMissingError(error)) {
    console.error('Error deleting todo item:', error);
  }
  revalidatePath('/admin/dashboard');
}


