'use server';

import fs from 'fs/promises';
import path from 'path';

const BOOKINGS_PATH = path.join(process.cwd(), 'src/data/bookings.json');
const UNITS_PATH = path.join(process.cwd(), 'src/data/units.json');
const ADMINS_PATH = path.join(process.cwd(), 'src/data/admins.json');

// --- TELEGRAM CONFIG ---
const TG_TOKEN = '8674061032:AAHTetftXiVZ_FqZ4X_inu7XKILLSZacN_8';
const TG_CHAT_ID = '6855780907';

async function sendTelegramNotification(booking: any) {
  try {
    // Clean phone for WhatsApp link
    const cleanPhone = booking.phone.replace(/[^0-9]/g, '');
    
    // Using HTML format as it's more stable than Markdown for special characters
    const htmlMessage = `
<b>🔔 طلب حجز جديد في مزار!</b>
━━━━━━━━━━━━━━
<b>👤 العميل:</b> ${booking.name}
<b>📱 هاتف:</b> ${booking.phone}
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

// --- BOOKINGS ---

export async function getDbBookings() {
  try {
    const data = await fs.readFile(BOOKINGS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading bookings:', error);
    return [];
  }
}

export async function saveDbBooking(booking: any) {
  try {
    const bookings = await getDbBookings();
    const newBooking = {
      ...booking,
      id: `#B-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'رد جديد',
      timestamp: new Date().toISOString(),
    };
    bookings.unshift(newBooking);
    await fs.writeFile(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));

    // Send Telegram Alert to Admin (Awaiting to ensure delivery)
    try {
      await sendTelegramNotification(newBooking);
    } catch (err) {
      console.error('Telegram notification error:', err);
    }

    return newBooking;
  } catch (error) {
    console.error('Error saving booking:', error);
    throw error;
  }
}

export async function updateDbBookingStatus(id: string, updates: any) {
  try {
    const bookings = await getDbBookings();
    const updated = bookings.map((b: any) => 
      b.id === id ? { ...b, ...updates } : b
    );
    await fs.writeFile(BOOKINGS_PATH, JSON.stringify(updated, null, 2));
    return updated;
  } catch (error) {
    console.error('Error updating booking:', error);
    throw error;
  }
}

// --- UNITS ---

export async function getDbUnits() {
  try {
    const data = await fs.readFile(UNITS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading units:', error);
    return [];
  }
}

export async function updateDbUnitDetails(id: string, updates: any) {
  try {
    const units = await getDbUnits();
    const updated = units.map((u: any) => 
      u.id === id ? { ...u, ...updates } : u
    );
    await fs.writeFile(UNITS_PATH, JSON.stringify(updated, null, 2));
    return updated;
  } catch (error) {
    console.error('Error updating unit:', error);
    throw error;
  }
}

// --- ADMIN ---

export async function verifyAdminAuth(username: string, pass: string) {
  try {
    const data = await fs.readFile(ADMINS_PATH, 'utf-8');
    const admins = JSON.parse(data);
    const validAdmin = admins.find((a: any) => a.username === username && a.password === pass);
    if (validAdmin) {
      return { success: true, admin: validAdmin };
    }
    return { success: false };
  } catch (error) {
    console.error('Error reading admins:', error);
    return { success: false };
  }
}

export async function getDbAdmins() {
  try {
    const data = await fs.readFile(ADMINS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting admins:', error);
    return [];
  }
}

export async function addDbAdmin(admin: any) {
  try {
    let admins = await getDbAdmins();
    admin.id = `admin-${Date.now()}`;
    admins.push(admin);
    await fs.writeFile(ADMINS_PATH, JSON.stringify(admins, null, 2));
    return { success: true, admin };
  } catch (error) {
    console.error('Error adding admin:', error);
    return { success: false };
  }
}

export async function updateDbAdmin(id: string, updates: any) {
  try {
    let admins = await getDbAdmins();
    admins = admins.map((a: any) => a.id === id ? { ...a, ...updates } : a);
    await fs.writeFile(ADMINS_PATH, JSON.stringify(admins, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error updating admin:', error);
    return { success: false };
  }
}

export async function deleteDbAdmin(id: string) {
  try {
    let admins = await getDbAdmins();
    admins = admins.filter((a: any) => a.id !== id);
    await fs.writeFile(ADMINS_PATH, JSON.stringify(admins, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error deleting admin:', error);
    return { success: false };
  }
}
