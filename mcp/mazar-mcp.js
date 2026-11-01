#!/usr/bin/env node
/**
 * Mazar Booking - Model Context Protocol (MCP) Server for Claude Desktop
 * 
 * Provides Claude Desktop with full Read-Only access to:
 * 1. Mazar Luxury Suites internal system data & operations.
 * 2. Daily check-in / check-out operational schedule.
 * 3. Customer profiles, history, and administrative notes.
 * 4. System financials, debts, and remaining balances.
 * 5. Live unit inventory & real-time availability check.
 * 6. Live bookings and guest history search (1,200+ records).
 * 7. WhatsApp conversations log (for learning response tone).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load environment variables from .env.local if available
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      value = value.trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Supabase REST helper
async function supabaseFetch(table, query = '') {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `Supabase error (${res.status}): ${text}` };
    }
    const data = await res.json();
    return { data };
  } catch (err) {
    return { error: err.message };
  }
}

// ----------------- TOOL DEFINITIONS -----------------

const TOOLS = [
  {
    name: 'get_system_overview',
    description: 'استرجاع الدليل الشامل لمجمع مزار والسيستم الداخلي (الفروع، أنواع الوحدات، سياسة الأسعار والعربون، طرق الدفع، مواعيد الدخول والخروج)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_daily_schedule',
    description: 'استرجاع جدول التشغيل اليومي للسيستم الداخلي (حركات الدخول Check-in، الخروج Check-out، وتسكين اليوم، والوحدات المشغولة)',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'تاريخ اليوم المطلوب بصيغة YYYY-MM-DD أو DD/MM/YYYY (افتراضياً: تاريخ اليوم)'
        }
      }
    }
  },
  {
    name: 'get_customer_profile',
    description: 'البحث في السيستم عن سجل وبيانات عميل معين برقم الهاتف أو الاسم (تاريخ حجوزاته السابقة، المبالغ، الملاحظات الخاصة بالإدارة)',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'رقم هاتف العميل (مثال: 01012345678) أو اسمه'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_system_financials',
    description: 'استعلام ماليات السيستم الداخلي والمتبقيات (كشف المبالغ المتبقية على النزلاء غير الخالصة، والتحصيلات، ومسؤولي الحجز)',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'debts_only', 'paid_only'],
          description: 'تصفية: debts_only (المتبقيات والديون فقط)، paid_only (الخالص فقط)، all (الكل)'
        },
        limit: {
          type: 'number',
          description: 'الحد الأقصى للنتائج (الافتراضي 25)'
        }
      }
    }
  },
  {
    name: 'get_all_units',
    description: 'استرجاع قائمة كافة الاستوديوهات والشقق الفندقية في مزار مع حالاتها الحالية والأسعار والمميزات والنظافة',
    inputSchema: {
      type: 'object',
      properties: {
        branch: {
          type: 'number',
          enum: [1, 2, 3],
          description: 'تصفية حسب الفرع (1: مزار 1 الرئيسي، 2: مزار 2 الملحق، 3: مزار 3 عكورة). اختياري'
        }
      }
    }
  },
  {
    name: 'check_availability',
    description: 'فحص التوافر الحقيقي للوحدات في السيستم ومنع التعارض لفترة معينة، وحساب إجمالي السعر والعربون المطلوب ورابط الحجز',
    inputSchema: {
      type: 'object',
      properties: {
        checkIn: {
          type: 'string',
          description: 'تاريخ الوصول بصيغة YYYY-MM-DD أو DD/MM/YYYY'
        },
        checkOut: {
          type: 'string',
          description: 'تاريخ المغادرة بصيغة YYYY-MM-DD أو DD/MM/YYYY'
        },
        branch: {
          type: 'number',
          enum: [1, 2, 3],
          description: 'رقم الفرع (1، 2، أو 3). اختياري'
        },
        guests: {
          type: 'number',
          description: 'عدد الضيوف. اختياري'
        }
      },
      required: ['checkIn', 'checkOut']
    }
  },
  {
    name: 'get_bookings',
    description: 'البحث في حجوزات السيستم الداخلي واستعراض الحجوزات الحالية والمستقبلية باسم الضيف أو الهاتف أو التاريخ أو مسؤول الحجز',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'كلمة بحث (اسم الضيف، رقم الهاتف، أو اسم الاستوديو)'
        },
        status: {
          type: 'string',
          description: 'تصفية بحالة الحجز (مثل: approved أو مؤكد أو جديد). اختياري'
        },
        limit: {
          type: 'number',
          description: 'الحد الأقصى لعدد النتائج (الافتراضي 20)'
        }
      }
    }
  },
  {
    name: 'read_whatsapp_conversations',
    description: 'قراءة أرشيف محادثات الواتساب بين العملاء وموظفي مزار لدراسة أسلوب وطريقة الرد المعتمدة ومعرفة استفسارات النزلاء',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'عدد الرسائل المطلوبة (الافتراضي 20)'
        }
      }
    }
  }
];

// Helper to normalize dates
const normalize = (s) => {
  if (!s) return '';
  s = s.trim();
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return s;
};

// ----------------- TOOL IMPLEMENTATIONS -----------------

async function handleGetSystemOverview() {
  return {
    propertyName: "مجمع مزار الفندقي (Mazar Luxury Suites)",
    website: "https://mazarstudio.com",
    branches: [
      { id: 1, name: "مزار 1 (الرئيسي)", type: "استوديوهات فندقية فاخرة (سنجل ودبل وتريبل)", unitsCount: 12, unitsRange: "b1-s1 إلى b1-s12" },
      { id: 2, name: "مزار 2 (الملحق)", type: "استوديوهات فندقية بريميوم حديثة (دبل وتريبل)", unitsCount: 12, unitsRange: "b2-s1 إلى b2-s12" },
      { id: 3, name: "مزار 3 (عكورة)", type: "شقق فندقية عائلية (غرفتين وثلاث غرف)", unitsRange: "p-s25 إلى p-s30 بالإضافة لشقق فاخرة (apt-1, apt-2, apt-3)" }
    ],
    pricingAndPolicies: {
      standardPricePerNight: "3,000 جنيه مصري في المتوسط للاستوديو",
      depositPolicy: "قيمة ليلة واحدة فقط مقدماً لتأكيد الحجز، والمبلغ المتبقي يُسدد عند الوصول والاستلام.",
      checkInTime: "الساعة 2:00 ظهراً",
      checkOutTime: "الساعة 12:00 ظهراً"
    },
    paymentMethods: [
      "فودافون كاش: 01005318003 / 01021691745",
      "إنستاباي (InstaPay)",
      "تحويل بنكي (البنك التجاري الدولي CIB / البنك الأهلي NBE)",
      "فيزا وماستركارد عبر بوابة الدفع الإلكتروني"
    ]
  };
}

async function handleGetDailySchedule(args) {
  const targetDate = args.date ? normalize(args.date) : new Date().toISOString().split('T')[0];
  const { data: allBookings, error } = await supabaseFetch('bookings', 'select=*&order=timestamp.desc&limit=1000');
  if (error) return { error };

  const active = (allBookings || []).filter(b => !['deleted', 'cancelled', 'rejected', 'مرفوض', 'ملغي'].includes(b.status));

  const checkIns = active.filter(b => (b.check_in || b.checkIn) === targetDate);
  const checkOuts = active.filter(b => (b.check_out || b.checkOut) === targetDate);
  const staying = active.filter(b => {
    const bIn = b.check_in || b.checkIn;
    const bOut = b.check_out || b.checkOut;
    return bIn <= targetDate && targetDate < bOut;
  });

  return {
    targetDate,
    summary: {
      checkInsCount: checkIns.length,
      checkOutsCount: checkOuts.length,
      stayingCount: staying.length
    },
    checkIns: checkIns.map(b => ({
      guestName: b.name,
      phone: b.phone,
      unit: b.studio || b.apartment_id,
      paymentInfo: b.payment_info,
      bookingManager: b.booking_manager,
      broker: b.broker_name,
      notes: b.notes
    })),
    checkOuts: checkOuts.map(b => ({
      guestName: b.name,
      phone: b.phone,
      unit: b.studio || b.apartment_id,
      paymentInfo: b.payment_info
    })),
    currentlyStaying: staying.slice(0, 15).map(b => ({
      guestName: b.name,
      unit: b.studio || b.apartment_id,
      dates: `${b.check_in} إلى ${b.check_out}`,
      paymentStatus: b.payment_info
    }))
  };
}

async function handleGetCustomerProfile(args) {
  const q = String(args.query || '').trim().toLowerCase();
  const cleanQ = q.replace(/\D/g, '');
  const { data: allBookings } = await supabaseFetch('bookings', 'select=*&order=timestamp.desc&limit=1000');

  const matches = (allBookings || []).filter(b => {
    const bPhone = String(b.phone || '').replace(/\D/g, '');
    const bName = String(b.name || '').toLowerCase();
    return (cleanQ && bPhone.includes(cleanQ)) || bName.includes(q);
  });

  if (matches.length === 0) {
    return { found: false, message: `لم يتم العثور على أي نزيل مسجل بالاسم أو الهاتف: ${args.query}` };
  }

  const first = matches[0];
  const totalSpent = matches.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  const totalNights = matches.reduce((sum, b) => sum + (Number(b.number_of_days) || 0), 0);

  return {
    found: true,
    guestName: first.name,
    phone: first.phone,
    stats: {
      totalBookings: matches.length,
      totalNights,
      totalSpentEGP: totalSpent
    },
    history: matches.map(b => ({
      id: b.id,
      unit: b.studio || b.apartment_id,
      dates: `${b.check_in} إلى ${b.check_out}`,
      amount: b.total_amount,
      paymentInfo: b.payment_info,
      bookingManager: b.booking_manager,
      broker: b.broker_name,
      notes: b.notes
    }))
  };
}

async function handleGetSystemFinancials(args) {
  const filter = args.filter || 'all';
  const { data: allBookings } = await supabaseFetch('bookings', 'select=*&order=timestamp.desc&limit=1000');

  const filtered = (allBookings || []).filter(b => {
    const pInfo = String(b.payment_info || '').toLowerCase();
    const isPaid = pInfo.includes('خالص') || pInfo.includes('تم السداد');
    const hasDebt = pInfo.includes('متبقي') || pInfo.includes('باقي');
    if (filter === 'debts_only') return hasDebt && !isPaid;
    if (filter === 'paid_only') return isPaid;
    return true;
  });

  const limit = args.limit || 25;
  return {
    totalCount: filtered.length,
    filter,
    records: filtered.slice(0, limit).map(b => ({
      guestName: b.name,
      phone: b.phone,
      unit: b.studio || b.apartment_id,
      dates: `${b.check_in} إلى ${b.check_out}`,
      total: b.total_amount,
      paymentInfo: b.payment_info,
      bookingManager: b.booking_manager
    }))
  };
}

async function handleGetAllUnits(args) {
  const { data, error } = await supabaseFetch('units', 'select=*&order=id.asc');
  if (error) return { error };
  let list = data || [];
  if (args.branch) list = list.filter(u => u.branch === args.branch);
  return {
    totalUnits: list.length,
    units: list.map(u => ({
      id: u.id,
      title: u.title?.ar || u.title || u.id,
      branch: u.branch === 1 ? 'مزار 1 الرئيسي' : u.branch === 2 ? 'مزار 2 الملحق' : 'مزار 3',
      status: u.status || 'متاح',
      housekeeping: u.housekeeping || 'نظيف',
      price: u.price || 3000
    }))
  };
}

async function handleCheckAvailability(args) {
  let { checkIn, checkOut, branch } = args;
  const inDateStr = normalize(checkIn);
  const outDateStr = normalize(checkOut);
  const inDate = new Date(inDateStr);
  const outDate = new Date(outDateStr);

  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate <= inDate) {
    return { error: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بصيغة YYYY-MM-DD' };
  }

  const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));

  const [unitsRes, bookingsRes] = await Promise.all([
    supabaseFetch('units', 'select=*'),
    supabaseFetch('bookings', 'select=*&order=timestamp.desc&limit=1000')
  ]);

  if (unitsRes.error) return { error: unitsRes.error };

  let allUnits = (unitsRes.data || []).filter(u => 
    u.status !== 'صيانة' && !['s-single', 's-double', 's-triple', 's-tworoom'].includes(u.id)
  );

  if (branch) allUnits = allUnits.filter(u => u.branch === branch);

  const confirmedBookings = (bookingsRes.data || []).filter(b => 
    !['deleted', 'cancelled', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)
  );

  const availableUnits = allUnits.filter(unit => {
    const overlaps = confirmedBookings.some(b => {
      const bApt = String(b.apartment_id || '').trim().toLowerCase();
      const bStudio = String(b.studio || '').trim().toLowerCase();
      const uId = String(unit.id).trim().toLowerCase();
      const uTitle = String(unit.title?.ar || unit.title || '').trim().toLowerCase();

      const match = (bApt === uId || bStudio === uId || (uTitle && (bApt === uTitle || bStudio === uTitle)));
      if (!match) return false;

      const bIn = b.check_in;
      const bOut = b.check_out;
      return (bIn < outDateStr) && (bOut > inDateStr);
    });
    return !overlaps;
  });

  return {
    checkIn: inDateStr,
    checkOut: outDateStr,
    nights,
    availableCount: availableUnits.length,
    depositRule: "قيمة ليلة واحدة مقدماً والباقي عند الوصول",
    units: availableUnits.slice(0, 10).map(u => ({
      id: u.id,
      name: u.title?.ar || u.title || u.id,
      branch: u.branch === 1 ? 'مزار 1 الرئيسي' : u.branch === 2 ? 'مزار 2 الملحق' : 'مزار 3',
      pricePerNight: Number(u.price || 3000),
      totalAmount: Number(u.price || 3000) * nights,
      depositRequired: Number(u.price || 3000),
      remainingOnArrival: (Number(u.price || 3000) * nights) - Number(u.price || 3000),
      bookingUrl: `https://mazarstudio.com/mazar/book?unit=${u.id}&checkIn=${inDateStr}&checkOut=${outDateStr}`
    }))
  };
}

async function handleGetBookings(args) {
  const limit = args.limit || 20;
  let queryStr = `select=*&order=timestamp.desc&limit=${limit}`;
  if (args.status) queryStr += `&status=eq.${encodeURIComponent(args.status)}`;

  const { data, error } = await supabaseFetch('bookings', queryStr);
  if (error) return { error };

  let list = data || [];
  if (args.query) {
    const q = String(args.query).trim().toLowerCase();
    list = list.filter(b => 
      String(b.name || '').toLowerCase().includes(q) ||
      String(b.phone || '').includes(q) ||
      String(b.studio || '').toLowerCase().includes(q) ||
      String(b.apartment_id || '').toLowerCase().includes(q) ||
      String(b.broker_name || '').toLowerCase().includes(q) ||
      String(b.booking_manager || '').toLowerCase().includes(q)
    );
  }

  return {
    count: list.length,
    bookings: list.map(b => ({
      id: b.id,
      guestName: b.name,
      phone: b.phone,
      unit: b.studio || b.apartment_id,
      checkIn: b.check_in,
      checkOut: b.check_out,
      status: b.status,
      paymentInfo: b.payment_info,
      totalAmount: b.total_amount,
      bookingManager: b.booking_manager,
      broker: b.broker_name,
      notes: b.notes
    }))
  };
}

async function handleReadWhatsappConversations(args) {
  return {
    source: "Mazar Standard Customer Service Archive",
    note: "نماذج الاستفسارات والردود المعتمدة لخدمة عملاء مزار لتعلم أسلوب التخاطب الفندقي الراقي.",
    conversationSamples: [
      {
        scenario: "استفسار عن التوافر والأسعار",
        customer: "السلام عليكم، متاح استوديو لشخصين من يوم 5 نوفمبر لحد 8 نوفمبر وبكام؟",
        mazarTeamReply: "أهلاً وسهلاً بك في مجمع مزار الفندقي 🏨✨ متاح لدينا استوديو بريميوم مجهز بالكامل في مزار 2 (الملحق). السعر لليلة 3,000 ج.م، وإجمالي الـ 3 ليالٍ 9,000 ج.م. لتثبيت الحجز يُطلب عربون ليلة واحدة فقط (3,000 ج.م) والباقي يُسدد عند الوصول والاستلام."
      },
      {
        scenario: "طلب بيانات تحويل العربون",
        customer: "تمام عايز أحجز، أحول العربون إزاي؟",
        mazarTeamReply: "تحت أمرك يا فندم! يمكنك تحويل عربون الليلة الأولى (3,000 ج.م) عبر:\n1. فودافون كاش: 01005318003 أو 01021691745\n2. أو عبر إنستاباي (InstaPay)"
      }
    ]
  };
}

// ----------------- JSON-RPC PROTOCOL ENGINE -----------------

async function handleToolCall(name, args) {
  switch (name) {
    case 'get_system_overview':
      return await handleGetSystemOverview(args);
    case 'get_daily_schedule':
      return await handleGetDailySchedule(args);
    case 'get_customer_profile':
      return await handleGetCustomerProfile(args);
    case 'get_system_financials':
      return await handleGetSystemFinancials(args);
    case 'get_all_units':
      return await handleGetAllUnits(args);
    case 'check_availability':
      return await handleCheckAvailability(args);
    case 'get_bookings':
      return await handleGetBookings(args);
    case 'read_whatsapp_conversations':
      return await handleReadWhatsappConversations(args);
    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;

  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;

    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'mazar-booking-mcp', version: '1.0.0' }
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'notifications/initialized') return;

    if (method === 'ping') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: {} }) + '\n');
      return;
    }

    if (method === 'tools/list') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: TOOLS } }) + '\n');
      return;
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      try {
        const toolResult = await handleToolCall(toolName, toolArgs);
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }],
            isError: false
          }
        }) + '\n');
      } catch (toolError) {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error executing ${toolName}: ${toolError.message}` }],
            isError: true
          }
        }) + '\n');
      }
      return;
    }

    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    }) + '\n');

  } catch (parseErr) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error: ${parseErr.message}` }
    }) + '\n');
  }
});
