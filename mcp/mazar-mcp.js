#!/usr/bin/env node
/**
 * Mazar Booking - Model Context Protocol (MCP) Server for Claude Desktop
 * 
 * Provides Claude Desktop with full Read-Only access to:
 * 1. Mazar Luxury Suites system knowledge & policies.
 * 2. Live unit inventory & real-time availability check.
 * 3. Live bookings and guest history search.
 * 4. WhatsApp conversations log (for learning response tone & customer inquiries).
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
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE_ID || '';
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || '';

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
    description: 'استرجاع الدليل الشامل لمجمع مزار الفندقي (الفروع، أنواع الوحدات، سياسة الأسعار والعربون، طرق الدفع، مواعيد الدخول والخروج)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_all_units',
    description: 'استرجاع قائمة كافة الاستوديوهات والشقق الفندقية في مزار مع حالاتها الحالية والأسعار والمميزات',
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
    description: 'فحص التوافر الحقيقي للوحدات ومنع التعارض لفترة معينة، وحساب إجمالي السعر والعربون المطلوب ورابط الحجز',
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
    description: 'البحث في حجوزات مزار واستعراض الحجوزات الحالية والمستقبلية باسم الضيف أو الهاتف أو التاريخ',
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
          description: 'الحد الأقصى لعدد النتائج (الافتراضي 15)'
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
        phone: {
          type: 'string',
          description: 'رقم هاتف العميل للتصفية. اختياري'
        },
        limit: {
          type: 'number',
          description: 'عدد الرسائل المطلوبة (الافتراضي 20)'
        }
      }
    }
  }
];

// ----------------- TOOL IMPLEMENTATIONS -----------------

async function handleGetSystemOverview() {
  return {
    propertyName: "مجمع مزار الفندقي (Mazar Luxury Suites)",
    website: "https://mazarstudio.com",
    branches: [
      {
        id: 1,
        name: "مزار 1 (الرئيسي)",
        type: "استوديوهات فندقية فاخرة (سنجل ودبل وتريبل)",
        unitsCount: 12,
        unitsRange: "b1-s1 إلى b1-s12"
      },
      {
        id: 2,
        name: "مزار 2 (الملحق)",
        type: "استوديوهات فندقية بريميوم حديثة (دبل وتريبل)",
        unitsCount: 12,
        unitsRange: "b2-s1 إلى b2-s12"
      },
      {
        id: 3,
        name: "مزار 3 (عكورة)",
        type: "شقق فندقية عائلية (غرفتين وثلاث غرف)",
        unitsRange: "p-s25 إلى p-s30 بالإضافة لشقق فاخرة (apt-1, apt-2, apt-3)"
      }
    ],
    pricingAndPolicies: {
      standardPricePerNight: "3,000 جنيه مصري في المتوسط للاستوديو",
      depositPolicy: "قيمة ليلة واحدة فقط مقدماً لتأكيد الحجز، والمبلغ المتبقي يُسدد عند الوصول والاستلام.",
      checkInTime: "الساعة 2:00 ظهراً",
      checkOutTime: "الساعة 12:00 ظهراً",
      cancellationPolicy: "إلغاء مجاني قبل موعد الوصول بـ 48 ساعة"
    },
    paymentMethods: [
      "فودافون كاش: 01005318003 / 01021691745",
      "إنستاباي (InstaPay)",
      "تحويل بنكي (البنك التجاري الدولي CIB / البنك الأهلي NBE)",
      "فيزا وماستركارد عبر بوابة الدفع الإلكتروني"
    ],
    featuresIncluded: [
      "تكييف سبليت حديث في كل وحدة",
      "واي فاي عالي السرعة فندقي مجاني",
      "شاشة سمارت TV مسطحة",
      "مطبخ مجهز (ثلاجة، ميكروويف، غلاية، أواني)",
      "حمام خاص ومستلزمات فندقية معقمة",
      "خدمة نظافة فندقية دورية ومصعد وأمن 24 ساعة"
    ],
    importantInstructionsForClaude: [
      "أنت المساعد الإداري الذكي لمزار، وظيفتك الإجابة والتحليل ومساعدة الإدارة والنزلاء بدقة تامة.",
      "عند الاستعلام عن التوافر، استخدم أداة check_availability لمنع أي تعارض في الحجوزات.",
      "لا تقم بتأكيد أو خصم مبالغ نهائية تلقائياً؛ التثبيت يتطلب سداد عربون الليلة الأولى بمعرفة الإدارة."
    ]
  };
}

async function handleGetAllUnits(args) {
  const { data, error } = await supabaseFetch('units', 'select=*&order=id.asc');
  if (error) return { error };
  
  let list = data || [];
  if (args.branch) {
    list = list.filter(u => u.branch === args.branch);
  }

  return {
    totalUnits: list.length,
    units: list.map(u => ({
      id: u.id,
      title: u.title?.ar || u.title || u.id,
      branch: u.branch === 1 ? 'مزار 1 الرئيسي' : u.branch === 2 ? 'مزار 2 الملحق' : 'مزار 3',
      type: u.type,
      status: u.status || 'متاح',
      price: u.price || 3000,
      features: u.features?.ar || ['تكييف', 'واي فاي', 'شاشة سمارت']
    }))
  };
}

async function handleCheckAvailability(args) {
  let { checkIn, checkOut, branch } = args;

  // Normalize date formats
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

  const inDateStr = normalize(checkIn);
  const outDateStr = normalize(checkOut);

  const inDate = new Date(inDateStr);
  const outDate = new Date(outDateStr);

  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate <= inDate) {
    return { error: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بصيغة صحيحة YYYY-MM-DD' };
  }

  const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Fetch all units and confirmed bookings
  const [unitsRes, bookingsRes] = await Promise.all([
    supabaseFetch('units', 'select=*'),
    supabaseFetch('bookings', 'select=*&order=timestamp.desc')
  ]);

  if (unitsRes.error) return { error: unitsRes.error };

  let allUnits = (unitsRes.data || []).filter(u => 
    u.status !== 'صيانة' && 
    !['s-single', 's-double', 's-triple', 's-tworoom'].includes(u.id)
  );

  if (branch) {
    allUnits = allUnits.filter(u => u.branch === branch);
  }

  const allBookings = bookingsRes.data || [];
  const confirmedBookings = allBookings.filter(b => 
    !['deleted', 'cancelled', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)
  );

  const availableUnits = allUnits.filter(unit => {
    const overlaps = confirmedBookings.some(b => {
      const bApt = String(b.apartment_id || b.apartmentId || '').trim().toLowerCase();
      const bStudio = String(b.studio || '').trim().toLowerCase();
      const uId = String(unit.id).trim().toLowerCase();
      const uTitle = String(unit.title?.ar || unit.title || '').trim().toLowerCase();

      const match = (bApt === uId || bStudio === uId || (uTitle && (bApt === uTitle || bStudio === uTitle)));
      if (!match) return false;

      const bIn = b.check_in || b.checkIn;
      const bOut = b.check_out || b.checkOut;
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
      features: u.features?.ar || ['تكييف', 'واي فاي فندقي', 'شاشة سمارت TV'],
      bookingUrl: `https://mazarstudio.com/mazar/book?unit=${u.id}&checkIn=${inDateStr}&checkOut=${outDateStr}`
    }))
  };
}

async function handleGetBookings(args) {
  const limit = args.limit || 15;
  let queryStr = `select=*&order=timestamp.desc&limit=${limit}`;

  if (args.status) {
    queryStr += `&status=eq.${encodeURIComponent(args.status)}`;
  }

  const { data, error } = await supabaseFetch('bookings', queryStr);
  if (error) return { error };

  let list = data || [];
  if (args.query) {
    const q = String(args.query).trim().toLowerCase();
    list = list.filter(b => 
      String(b.name || '').toLowerCase().includes(q) ||
      String(b.phone || '').includes(q) ||
      String(b.studio || '').toLowerCase().includes(q) ||
      String(b.apartment_id || '').toLowerCase().includes(q)
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
      notes: b.notes
    }))
  };
}

async function handleReadWhatsappConversations(args) {
  const limit = args.limit || 20;

  // Try fetching from UltraMsg messages API if active
  try {
    const url = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages?token=${ULTRAMSG_TOKEN}&limit=${limit}`;
    const res = await fetch(url);
    const result = await res.json();

    if (result && Array.isArray(result.messages)) {
      let msgs = result.messages;
      if (args.phone) {
        const cleanP = args.phone.replace(/\D/g, '');
        msgs = msgs.filter(m => String(m.from || '').includes(cleanP) || String(m.to || '').includes(cleanP));
      }

      return {
        source: "UltraMsg Live WhatsApp Log",
        total: msgs.length,
        messages: msgs.map(m => ({
          direction: m.fromMe ? "outbound (رد موظف مزار)" : "inbound (رسالة العميل)",
          from: m.from,
          to: m.to,
          body: m.body,
          timestamp: m.created_at ? new Date(m.created_at * 1000).toLocaleString('ar-EG') : null
        }))
      };
    }
  } catch (err) {
    // UltraMsg API not reachable or subscription pending
  }

  // Fallback: Read stored sample conversations and guidelines for customer communication
  return {
    source: "Mazar Standard Customer Service Archive",
    note: "تم جلب نماذج المحادثات والأسلوب المعتمد لخدمة عملاء مزار لتعلم طريقة الرد.",
    conversationSamples: [
      {
        scenario: "استفسار عن التوافر والأسعار",
        customer: "السلام عليكم، متاح استوديو لشخصين من يوم 5 نوفمبر لحد 8 نوفمبر وبكام؟",
        mazarTeamReply: "أهلاً وسهلاً بك في مجمع مزار الفندقي 🏨✨ متاح لدينا استوديو بريميوم مجهز بالكامل في مزار 2 (الملحق). السعر لليلة 3,000 ج.م، وإجمالي الـ 3 ليالٍ 9,000 ج.م. لتثبيت الحجز يُطلب عربون ليلة واحدة فقط (3,000 ج.م) والباقي يُسدد عند الوصول والاستلام. هل تحب أرسل لحضرتك رابط الحجز وصور الاستوديو؟"
      },
      {
        scenario: "طلب بيانات تحويل العربون",
        customer: "تمام عايز أحجز، أحول العربون إزاي؟",
        mazarTeamReply: "تحت أمرك يا فندم! يمكنك تحويل عربون الليلة الأولى (3,000 ج.م) عبر:\n1. فودافون كاش: 01005318003 أو 01021691745\n2. أو عبر إنستاباي (InstaPay)\nبعد التحويل يرجى إرسال إيصال السداد هنا لتسجيل وتأكيد حجزك رسمياً في السيستم."
      },
      {
        scenario: "استفسار عن مواعيد الدخول والخروج والمميزات",
        customer: "مواعيد الدخول والخروج إيه؟ وهل في واي فاي ومطبخ؟",
        mazarTeamReply: "مواعيدنا الفندقية:\n- تسجيل الدخول: بدءاً من الساعة 2:00 ظهراً\n- تسجيل الخروج: حتى الساعة 12:00 ظهراً\nجميع استوديوهاتنا مكيفة ومجهزة بواي فاي فندقي مجاني فائق السرعة، شاشة سمارت، ومطبخ متكامل (ثلاجة، ميكروويف، غلاية، أواني). نتشرف باستضافتك دائماً!"
      }
    ]
  };
}

// ----------------- JSON-RPC 2.0 PROTOCOL ENGINE -----------------

async function handleToolCall(name, args) {
  switch (name) {
    case 'get_system_overview':
      return await handleGetSystemOverview(args);
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

    // 1. Initialize Handshake
    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'mazar-booking-mcp',
            version: '1.0.0'
          }
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    // 2. Initialized Notification (no response required by spec)
    if (method === 'notifications/initialized') {
      return;
    }

    // 3. Ping
    if (method === 'ping') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: {} }) + '\n');
      return;
    }

    // 4. List Tools
    if (method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS
        }
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    // 5. Call Tool
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      try {
        const toolResult = await handleToolCall(toolName, toolArgs);
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult, null, 2)
              }
            ],
            isError: false
          }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (toolError) {
        const errorResponse = {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error executing tool ${toolName}: ${toolError.message}`
              }
            ],
            isError: true
          }
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
      return;
    }

    // Unknown method
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
