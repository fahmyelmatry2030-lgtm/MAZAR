import { NextRequest, NextResponse } from 'next/server';
import { getSystemUnits } from '@/lib/data-init';
import { getFreshDbBookings, getDbCustomerNotes } from '@/lib/actions/db';
import { isUnitMatch, normalizeDateString, parseDateDMY, formatDateDMY } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// CORS headers for Claude Connectors
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, mcp-session-id, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
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
    description: 'استرجاع كشف كافة استوديوهات وشقق مزار من السيستم مع حالاتها اللحظية (متاح، مشغول، صيانة، نظافة)',
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
    description: 'فحص التوافر الفعلي في السيستم للوحدات المتاحة بدون أي تعارض لفترة إقامة معينة مع حساب الأسعار والعربون المطلوب',
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
    description: 'البحث الشامل في حجوزات السيستم الداخلي (1200+ حجز) باسم الضيف أو الهاتف أو الاستوديو أو الوسيط أو مسؤول الحجز',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'كلمة بحث (اسم الضيف، رقم الهاتف، اسم الاستوديو، الوسيط، أو مسؤول الحجز)'
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
    description: 'قراءة محادثات واستفسارات الواتساب ونماذج الردود الفندقية المعتمدة لتعلم أسلوب مزار',
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

// ----------------- TOOL LOGIC -----------------

async function executeTool(name: string, args: any) {
  // 1. System Overview
  if (name === 'get_system_overview') {
    return {
      propertyName: "مجمع مزار الفندقي (Mazar Luxury Suites)",
      website: "https://mazarstudio.com",
      systemPortal: "لوحة تحكم إدارة مزار الفندقية (Mazar Booking Management System)",
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

  // 2. Daily Schedule (Operations)
  if (name === 'get_daily_schedule') {
    let targetDate = args.date ? normalizeDateString(args.date.includes('/') ? parseDateDMY(args.date) : args.date) : new Date().toISOString().split('T')[0];
    const allBookings = await getFreshDbBookings();

    const activeBookings = allBookings.filter((b: any) => 
      !['deleted', 'cancelled', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)
    );

    const checkIns = activeBookings.filter((b: any) => (b.checkIn || b.check_in) === targetDate);
    const checkOuts = activeBookings.filter((b: any) => (b.checkOut || b.check_out) === targetDate);
    const currentlyStaying = activeBookings.filter((b: any) => {
      const bIn = b.checkIn || b.check_in;
      const bOut = b.checkOut || b.check_out;
      return bIn <= targetDate && targetDate < bOut;
    });

    return {
      targetDate: formatDateDMY(targetDate),
      summary: {
        totalCheckInsToday: checkIns.length,
        totalCheckOutsToday: checkOuts.length,
        totalCurrentlyStaying: currentlyStaying.length
      },
      checkInsToday: checkIns.map((b: any) => ({
        guestName: b.name,
        phone: b.phone,
        unit: b.studio || b.apartmentId,
        checkIn: formatDateDMY(b.checkIn || b.check_in),
        checkOut: formatDateDMY(b.checkOut || b.check_out),
        paymentInfo: b.paymentInfo || b.payment_info,
        totalAmount: b.totalAmount || b.total_amount,
        remainingAmount: b.remainingAmount,
        bookingManager: b.bookingManager,
        brokerName: b.brokerName,
        notes: b.notes
      })),
      checkOutsToday: checkOuts.map((b: any) => ({
        guestName: b.name,
        phone: b.phone,
        unit: b.studio || b.apartmentId,
        checkIn: formatDateDMY(b.checkIn || b.check_in),
        checkOut: formatDateDMY(b.checkOut || b.check_out),
        paymentInfo: b.paymentInfo || b.payment_info,
        remainingAmount: b.remainingAmount,
        notes: b.notes
      })),
      currentlyStaying: currentlyStaying.slice(0, 15).map((b: any) => ({
        guestName: b.name,
        unit: b.studio || b.apartmentId,
        checkIn: formatDateDMY(b.checkIn || b.check_in),
        checkOut: formatDateDMY(b.checkOut || b.check_out),
        paymentStatus: b.paymentStatus || (String(b.paymentInfo).includes('خالص') ? 'خالص' : 'متبقي')
      }))
    };
  }

  // 3. Customer Profile & History
  if (name === 'get_customer_profile') {
    const q = String(args.query || '').trim().toLowerCase();
    const [allBookings, notesMap] = await Promise.all([
      getFreshDbBookings(),
      getDbCustomerNotes()
    ]);

    const cleanQ = q.replace(/\D/g, '');
    const guestBookings = allBookings.filter((b: any) => {
      const bPhone = String(b.phone || '').replace(/\D/g, '');
      const bName = String(b.name || '').toLowerCase();
      if (cleanQ && bPhone.includes(cleanQ)) return true;
      if (bName.includes(q)) return true;
      return false;
    });

    if (guestBookings.length === 0) {
      return { found: false, message: `لم يتم العثور على أي نزيل مسجل بالاسم أو الهاتف: ${args.query}` };
    }

    const firstMatch = guestBookings[0];
    const customerPhone = firstMatch.phone || '';
    const adminNote = notesMap[customerPhone] || notesMap[customerPhone.replace(/^2/, '')] || null;

    const totalSpent = guestBookings.reduce((sum: number, b: any) => sum + (Number(b.totalAmount || b.total_amount) || 0), 0);
    const totalNights = guestBookings.reduce((sum: number, b: any) => sum + (Number(b.numberOfDays || b.number_of_days) || 0), 0);

    return {
      found: true,
      guestName: firstMatch.name,
      phone: customerPhone,
      adminSpecialNote: adminNote || "لا توجد ملاحظات إدارية خاصة مسجلة لهذا النزيل",
      stats: {
        totalBookingsCount: guestBookings.length,
        totalNightsStayed: totalNights,
        totalRevenueEGP: totalSpent
      },
      bookingsHistory: guestBookings.map((b: any) => ({
        id: b.id,
        unit: b.studio || b.apartmentId,
        checkIn: formatDateDMY(b.checkIn || b.check_in),
        checkOut: formatDateDMY(b.checkOut || b.check_out),
        nights: b.numberOfDays || b.number_of_days,
        status: b.status,
        totalAmount: b.totalAmount || b.total_amount,
        paymentInfo: b.paymentInfo || b.payment_info,
        bookingManager: b.bookingManager,
        notes: b.notes
      }))
    };
  }

  // 4. System Financials & Debts
  if (name === 'get_system_financials') {
    const allBookings = await getFreshDbBookings();
    const filter = args.filter || 'all';

    let debtsList = allBookings.filter((b: any) => {
      const pInfo = String(b.paymentInfo || b.payment_info || '').toLowerCase();
      const isPaid = pInfo.includes('خالص') || pInfo.includes('تم السداد') || pInfo.includes('مدفوع بالكامل');
      const hasDebt = pInfo.includes('متبقي') || pInfo.includes('باقي') || (Number(b.remainingAmount) > 0);
      
      if (filter === 'debts_only') return hasDebt && !isPaid;
      if (filter === 'paid_only') return isPaid;
      return true;
    });

    const limit = args.limit || 25;
    return {
      totalFound: debtsList.length,
      filterApplied: filter,
      records: debtsList.slice(0, limit).map((b: any) => ({
        id: b.id,
        guestName: b.name,
        phone: b.phone,
        unit: b.studio || b.apartmentId,
        dates: `${formatDateDMY(b.checkIn || b.check_in)} إلى ${formatDateDMY(b.checkOut || b.check_out)}`,
        totalAmount: b.totalAmount || b.total_amount,
        paymentInfo: b.paymentInfo || b.payment_info,
        bookingManager: b.bookingManager,
        brokerName: b.brokerName,
        status: b.status
      }))
    };
  }

  // 5. Units
  if (name === 'get_all_units') {
    const allUnits = await getSystemUnits();
    let list = allUnits.filter(u => !['s-single', 's-double', 's-triple', 's-tworoom'].includes(u.id));
    if (args.branch) {
      list = list.filter(u => u.branch === args.branch);
    }
    return {
      total: list.length,
      units: list.map(u => ({
        id: u.id,
        name: u.title?.ar || u.title?.en || u.id,
        branch: u.branch === 1 ? 'مزار 1 الرئيسي' : u.branch === 2 ? 'مزار 2 الملحق' : 'مزار 3 عكورة',
        type: u.type,
        status: u.status || 'متاح',
        housekeeping: u.housekeeping || 'نظيف',
        price: Number(u.price || 3000),
        nextBooking: u.next_booking || 'لا يوجد',
        features: u.features?.ar || ['تكييف', 'واي فاي سريع', 'شاشة سمارت']
      }))
    };
  }

  // 6. Availability Check
  if (name === 'check_availability') {
    let { checkIn, checkOut, branch } = args;
    if (!checkIn || !checkOut) {
      return { error: 'تاريخ الوصول والمغادرة مطلوبان' };
    }

    checkIn = normalizeDateString(checkIn.includes('/') ? parseDateDMY(checkIn) : checkIn);
    checkOut = normalizeDateString(checkOut.includes('/') ? parseDateDMY(checkOut) : checkOut);

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime()) || outDate <= inDate) {
      return { error: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بصيغة YYYY-MM-DD' };
    }

    const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24)));

    const [allUnits, allBookings] = await Promise.all([
      getSystemUnits(),
      getFreshDbBookings()
    ]);

    let units = allUnits.filter(u => 
      u.status !== 'صيانة' && 
      !['s-single', 's-double', 's-triple', 's-tworoom'].includes(u.id)
    );

    if (branch) {
      units = units.filter(u => u.branch === branch);
    }

    const confirmedBookings = allBookings.filter((b: any) => 
      !['deleted', 'cancelled', 'rejected', 'مرفوض', 'ملغي'].includes(b.status)
    );

    const availableUnits = units.filter(unit => {
      const overlaps = confirmedBookings.some((b: any) => {
        if (!isUnitMatch(b, unit.id, unit.title?.ar)) return false;
        const bIn = b.checkIn || b.check_in;
        const bOut = b.checkOut || b.check_out;
        return (bIn < checkOut) && (bOut > checkIn);
      });
      return !overlaps;
    });

    return {
      checkIn: formatDateDMY(checkIn),
      checkOut: formatDateDMY(checkOut),
      nights,
      availableCount: availableUnits.length,
      depositRule: 'قيمة ليلة واحدة مقدم والباقي عند الوصول',
      units: availableUnits.slice(0, 10).map(u => ({
        id: u.id,
        name: u.title?.ar || u.id,
        branch: u.branch === 1 ? 'مزار 1 الرئيسي' : u.branch === 2 ? 'مزار 2 الملحق' : 'مزار 3 عكورة',
        pricePerNight: Number(u.price || 3000),
        totalPrice: Number(u.price || 3000) * nights,
        depositAmount: Number(u.price || 3000),
        remainingOnArrival: (Number(u.price || 3000) * nights) - Number(u.price || 3000),
        features: u.features?.ar?.slice(0, 4) || ['تكييف', 'واي فاي سريع', 'شاشة سمارت'],
        bookingUrl: `https://mazarstudio.com/mazar/book?unit=${u.id}&checkIn=${checkIn}&checkOut=${checkOut}`
      }))
    };
  }

  // 7. General Bookings Search
  if (name === 'get_bookings') {
    const allBookings = await getFreshDbBookings();
    let list = allBookings;

    if (args.status) {
      const st = String(args.status).trim().toLowerCase();
      list = list.filter((b: any) => String(b.status).toLowerCase().includes(st));
    }

    if (args.query) {
      const q = String(args.query).trim().toLowerCase();
      list = list.filter((b: any) => 
        String(b.name || '').toLowerCase().includes(q) ||
        String(b.phone || '').includes(q) ||
        String(b.studio || '').toLowerCase().includes(q) ||
        String(b.apartmentId || '').toLowerCase().includes(q) ||
        String(b.brokerName || '').toLowerCase().includes(q) ||
        String(b.bookingManager || '').toLowerCase().includes(q)
      );
    }

    const limit = args.limit || 20;
    return {
      total: list.length,
      bookings: list.slice(0, limit).map((b: any) => ({
        id: b.id,
        guestName: b.name,
        phone: b.phone,
        studio: b.studio,
        checkIn: formatDateDMY(b.checkIn || b.check_in),
        checkOut: formatDateDMY(b.checkOut || b.check_out),
        status: b.status,
        paymentInfo: b.paymentInfo || b.payment_info,
        totalAmount: b.totalAmount || b.total_amount,
        bookingManager: b.bookingManager,
        brokerName: b.brokerName,
        notes: b.notes
      }))
    };
  }

  // 8. WhatsApp Conversations & Tone Learning
  if (name === 'read_whatsapp_conversations') {
    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID || 'instance195641';
    const ultraToken = process.env.ULTRAMSG_TOKEN || 'dqgr70zrc62t8lrr';
    const requestedLimit = Number(args.limit) || 10;

    let liveChatsData: any[] = [];

    try {
      // 1. Fetch real chat list from UltraMsg
      const chatsRes = await fetch(`https://api.ultramsg.com/${ultraInstance}/chats?token=${ultraToken}&limit=${Math.min(requestedLimit, 15)}`);
      const allChats = await chatsRes.json();

      if (Array.isArray(allChats)) {
        // Filter out groups, get individual customer chats
        const directChats = allChats.filter((c: any) => !c.isGroup && c.id && c.id.includes('@c.us')).slice(0, 6);

        // Fetch recent messages for these direct customer chats
        for (const c of directChats) {
          try {
            const msgRes = await fetch(`https://api.ultramsg.com/${ultraInstance}/chats/messages?token=${ultraToken}&chatId=${encodeURIComponent(c.id)}&limit=6`);
            const msgs = await msgRes.json();
            if (Array.isArray(msgs) && msgs.length > 0) {
              const formattedMsgs = msgs
                .filter((m: any) => m.body && m.body.trim().length > 0)
                .map((m: any) => ({
                  sender: m.fromMe ? 'فريق إدارة مزار (Mazar Staff)' : `العميل (${c.name || c.id.replace('@c.us', '')})`,
                  text: m.body,
                  time: m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('ar-EG') : '---'
                }));

              if (formattedMsgs.length > 0) {
                liveChatsData.push({
                  chatWith: c.name || c.id.replace('@c.us', ''),
                  phone: c.id.replace('@c.us', ''),
                  lastActivity: c.last_time ? new Date(c.last_time * 1000).toLocaleString('ar-EG') : '---',
                  messages: formattedMsgs
                });
              }
            }
          } catch (e) {
            // continue next chat
          }
        }
      }
    } catch (err: any) {
      console.warn('[MCP LIVE WHATSAPP FETCH ERROR]', err.message);
    }

    return {
      source: "محادثات وسجلات خدمة عملاء مزار الحية (UltraMsg Live WhatsApp Archive)",
      toneOfVoiceGuidance: "أسلوب مزار الفندقي يتميز بالرقي والاحترام والسرعة، واستخدام الترحيب الفندقي والرموز التعبيرية الهادئة (🏨✨🤍)، وتقديم تفاصيل الأسعار والعربون بوضوح، مع تحويل العميل لمسؤول الحجز لإرسال فيديوهات الوحدات المتاحة.",
      totalChatsAnalyzed: liveChatsData.length,
      realCustomerConversations: liveChatsData,
      officialStandardTemplates: [
        {
          title: "الرسالة الأولى: الترحيب والأنواع والأسعار",
          content: "✨ أهلًا بحضرتك في Mazar Studios 🤍🏨 متاح لدينا ستوديو وشقق فندقية تبدأ من 2400 جنيه/الليلة..."
        },
        {
          title: "الرسالة الثانية: الخدمات الفندقية المجانية",
          content: "خدمات مجمع مزار الفندقي: ستوديو مكيف، مطبخ مجهز، إنترنت سريع، أمن وكاميرات 24 ساعة، هاوس كيبنج..."
        },
        {
          title: "الرسالة الثالثة: طلب التفاصيل لإرسال الفيديو",
          content: "محتاج اعرف المدة من امتي ل امتي و عدد الافراد و انا هبعت لحضرتك فيديو للمتاح 🙏🏻"
        },
        {
          title: "رسالة التحويل البشري الفوري",
          content: "يا فندم هيتم تحويل حضرتك حالاً دلوقتي لأحد مسؤولي الحجز للرد والتأكيد مع حضرتك فوراً 🙏"
        }
      ]
    };
  }

  throw new Error(`Tool not found: ${name}`);
}

// ----------------- REQUEST HANDLERS -----------------

export async function GET(req: NextRequest) {
  const acceptHeader = req.headers.get('accept') || '';

  // 1. If SSE is requested (Claude Connectors SSE transport)
  if (acceptHeader.includes('text/event-stream')) {
    const sessionId = `mcp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const postEndpoint = `https://mazarstudio.com/api/mcp?sessionId=${sessionId}`;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial endpoint event as required by MCP SSE specification
        const initialEvent = `event: endpoint\ndata: ${postEndpoint}\n\n`;
        controller.enqueue(new TextEncoder().encode(initialEvent));

        // Keep-alive ping every 15 seconds
        const interval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
          } catch {
            clearInterval(interval);
          }
        }, 15000);

        req.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });
  }

  // 2. Normal GET (Status & Schema info)
  return NextResponse.json({
    status: 'online',
    protocol: 'Model Context Protocol (MCP)',
    version: '2024-11-05',
    server: 'mazar-booking-mcp',
    transport: 'HTTP / SSE (Remote MCP)',
    mcpServerUrl: 'https://mazarstudio.com/api/mcp',
    systemConnected: true,
    toolsCount: TOOLS.length,
    tools: TOOLS.map(t => ({ name: t.name, description: t.description }))
  }, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support single request or batch requests
    const isBatch = Array.isArray(body);
    const requests = isBatch ? body : [body];
    const responses: any[] = [];

    for (const r of requests) {
      const { id, method, params } = r || {};

      if (method === 'initialize') {
        responses.push({
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
        });
      } else if (method === 'notifications/initialized') {
        if (id !== undefined) {
          responses.push({ jsonrpc: '2.0', id, result: {} });
        }
      } else if (method === 'ping') {
        responses.push({ jsonrpc: '2.0', id, result: {} });
      } else if (method === 'tools/list') {
        responses.push({
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS
          }
        });
      } else if (method === 'tools/call') {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        try {
          const toolResult = await executeTool(toolName, toolArgs);
          responses.push({
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
          });
        } catch (err: any) {
          responses.push({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Error executing ${toolName}: ${err.message}`
                }
              ],
              isError: true
            }
          });
        }
      } else {
        if (id !== undefined) {
          responses.push({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          });
        }
      }
    }

    const finalResponse = isBatch ? responses : responses[0];
    return NextResponse.json(finalResponse || { success: true }, { headers: CORS_HEADERS });

  } catch (err: any) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `Parse error: ${err.message}` }
    }, { status: 400, headers: CORS_HEADERS });
  }
}
