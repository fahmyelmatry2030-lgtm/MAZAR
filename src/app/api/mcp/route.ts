import { NextRequest, NextResponse } from 'next/server';
import { getSystemUnits } from '@/lib/data-init';
import {
  getFreshDbBookings,
  getDbCustomerNotes,
  getDbExpenses,
  getDbSalaries,
  getDbCustody,
  getDbTreasuryTransfers,
  getDbStaff
} from '@/lib/actions/db';
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
    description: 'قراءة محادثات واستفسارات الواتساب الحية وتفاصيل شات عميل معين أو أحدث المحادثات ونماذج الردود الفندقية المعتمدة',
    inputSchema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'رقم هاتف العميل لقراءة محادثته بالتفصيل. اختياري'
        },
        limit: {
          type: 'number',
          description: 'عدد الرسائل أو المحادثات المطلوبة (الافتراضي 10)'
        }
      }
    }
  },
  {
    name: 'whatsapp_tour',
    description: 'عمل جولة استكشافية شاملة في واتساب مزار بالكامل: فحص أحدث المحادثات الحية، معرفة استفسارات العملاء النشطة، الشاتات الأخيرة، ونبرة الردود الفندقية',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'عدد المحادثات التي تشملها الجولة (الافتراضي 12)'
        }
      }
    }
  },
  {
    name: 'get_monthly_financial_statement',
    description: 'كشف الحساب الشهري الشامل والمالية الفندقية وأرباح الشركاء (نفس شاشة الملاك: مؤمن ومدحت). يعرض الإيرادات، العمولات، المصروفات التشغيلية، الرواتب، صافي الربح، وجدول توزيع أرباح الشركاء (محسن 35%، H.O 18%، مدحت 23.5%، مؤمن 23.5%) لمزار 1 و 2، ومزار 3، والشقق الفندقية، بالإضافة لملخص شهور السنة.',
    inputSchema: {
      type: 'object',
      properties: {
        month: {
          type: 'number',
          description: 'رقم الشهر المطلوب (1 إلى 12). افتراضياً: الشهر الحالي.'
        },
        year: {
          type: 'number',
          description: 'السنة المطلوبة (مثال: 2025 أو 2026). افتراضياً: السنة الحالية.'
        },
        includeYearlyRollup: {
          type: 'boolean',
          description: 'تضمين ملخص شهور السنة كاملة (يناير إلى ديسمبر). افتراضياً: true.'
        }
      }
    }
  },
  {
    name: 'get_expenses_and_custody',
    description: 'كشف المصروفات التشغيلية والعهدة وحالات الاعتماد (نفس صلاحيات مؤمن ومدحت). يعرض بنود المصروفات المسجلة وحالات اعتمادها (معتمد من مؤمن/مدحت، معلق، مرفوض)، وحسابات العهدة، والمصروفات حسب الفئات والوحدات.',
    inputSchema: {
      type: 'object',
      properties: {
        month: {
          type: 'number',
          description: 'رقم الشهر (1 إلى 12). اختياري'
        },
        year: {
          type: 'number',
          description: 'السنة (مثال: 2025 أو 2026). اختياري'
        },
        branch: {
          type: 'number',
          description: 'الفرع: 1 أو 2 (مزار 1 و 2)، 3 (مزار 3)، 4/5/6 (الشقق). اختياري'
        },
        status: {
          type: 'string',
          enum: ['all', 'approved', 'pending', 'rejected'],
          description: 'حالة الاعتماد (all: الكل، approved: معتمد، pending: معلق، rejected: مرفوض). الافتراضي all'
        },
        limit: {
          type: 'number',
          description: 'الحد الأقصى لعدد النتائج (الافتراضي 50)'
        }
      }
    }
  },
  {
    name: 'get_treasury_and_salaries',
    description: 'كشف الخزنة وسجل رواتب الموظفين والتحويلات المالية المسجلة في السيستم لمؤمن ومدحت.',
    inputSchema: {
      type: 'object',
      properties: {
        month: {
          type: 'number',
          description: 'رقم الشهر (1 إلى 12). اختياري'
        },
        year: {
          type: 'number',
          description: 'السنة. اختياري'
        }
      }
    }
  }
];

// ----------------- FINANCIAL & DATE HELPERS (MATCHING OWNER DASHBOARD) -----------------

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const parseDateYM = (dateStr: any): { year: number; month: number } | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return { year: +ymd[1], month: +ymd[2] - 1 };
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) return { year: +dmy[3], month: +dmy[2] - 1 };
  const d = new Date(s);
  if (!isNaN(d.getTime())) return { year: d.getFullYear(), month: d.getMonth() };
  return null;
};

const isMohsenBookingMatch = (b: any, units: any[]) => {
  const aptId = String(b?.apartmentId || b?.apartment_id || '').toLowerCase().trim();
  const studio = String(b?.studio || '').toLowerCase().trim();
  if (aptId.startsWith('apt-') || aptId.startsWith('ext-') || aptId.startsWith('p-s') || aptId.includes('tworoom')) return false;
  if (studio.includes('شقة') || studio.includes('غرفتين') || studio.includes('شاليه') || studio.includes('مزار 3') || studio.includes('3 غرف') || studio.includes('ثلاث') || studio.includes('زكي رستم') || studio.includes('سيتي ستارز') || studio.includes('عباس')) return false;
  const u = units.find((unit: any) => unit.id === (b.apartmentId || b.apartment_id));
  if (u) {
    const uId = String(u.id || '').toLowerCase();
    return (uId.startsWith('b1-s') || uId.startsWith('b2-s')) && (u.branch === 1 || u.branch === 2);
  }
  const match = studio.match(/(?:استوديو|studio)\s*(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return num >= 1 && num <= 24;
  }
  return false;
};

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
      ],
      ownerClearanceContext: {
        activePersona: "Super Admin / Owner (مؤمن ومدحت)",
        authorizationLevel: "صلاحيات الملاك الكاملة (Full Owner Clearance)",
        monthlyStatementAccess: "متاح بالكامل عبر أداة get_monthly_financial_statement (نفس شاشة كشف الحساب الشهري المعروضة لمؤمن ومدحت)",
        partnersMazar12: "M.H (محسن): 35% | H.O: 18% | M.E (مدحت): 23.5% | H.M (مؤمن): 23.5%",
        partnersMazar3: "Koura (عكورة): 50% | M.M: 25% | M.E (مدحت): 25%"
      }
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

  // 8. WhatsApp Conversations & Specific Phone Query
  if (name === 'read_whatsapp_conversations') {
    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID || 'instance195641';
    const ultraToken = process.env.ULTRAMSG_TOKEN || 'dqgr70zrc62t8lrr';
    const targetPhone = args.phone ? String(args.phone).replace(/\D/g, '') : null;
    const requestedLimit = Number(args.limit) || 10;

    let liveChatsData: any[] = [];

    try {
      if (targetPhone) {
        // Query specific customer chat history
        const chatId = `${targetPhone}@c.us`;
        const msgRes = await fetch(`https://api.ultramsg.com/${ultraInstance}/chats/messages?token=${ultraToken}&chatId=${encodeURIComponent(chatId)}&limit=${Math.min(requestedLimit, 25)}`);
        const msgs = await msgRes.json();
        if (Array.isArray(msgs)) {
          const formatted = msgs.map((m: any) => ({
            sender: m.fromMe ? 'فريق إدارة مزار' : `العميل (${targetPhone})`,
            text: m.body || (m.type === 'image' ? '[صورة]' : m.type === 'ptt' ? '[رسالة صوتية]' : `[${m.type}]`),
            time: m.timestamp ? new Date(m.timestamp * 1000).toLocaleString('ar-EG') : '---'
          }));
          liveChatsData.push({ phone: targetPhone, messages: formatted });
        }
      } else {
        // Fetch recent customer chats
        const chatsRes = await fetch(`https://api.ultramsg.com/${ultraInstance}/chats?token=${ultraToken}&limit=${Math.min(requestedLimit, 20)}`);
        const allChats = await chatsRes.json();

        if (Array.isArray(allChats)) {
          const directChats = allChats.filter((c: any) => !c.isGroup && c.id && c.id.includes('@c.us')).slice(0, 8);
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
            } catch (e) {}
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
      realCustomerConversations: liveChatsData
    };
  }

  // 9. Full WhatsApp Tour (جولة شاملة في واتساب مزار)
  if (name === 'whatsapp_tour') {
    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID || 'instance195641';
    const ultraToken = process.env.ULTRAMSG_TOKEN || 'dqgr70zrc62t8lrr';
    const requestedLimit = Number(args.limit) || 12;

    try {
      const chatsRes = await fetch(`https://api.ultramsg.com/${ultraInstance}/chats?token=${ultraToken}&limit=${requestedLimit}`);
      const chats = await chatsRes.json();

      if (!Array.isArray(chats)) {
        return { success: false, message: "تعذر الاتصال بـ WhatsApp Gateway حالياً" };
      }

      const directChats = chats.filter((c: any) => !c.isGroup && c.id && c.id.includes('@c.us'));
      const groupChats = chats.filter((c: any) => c.isGroup);

      const recentOverview = [];

      for (const c of directChats.slice(0, 10)) {
        try {
          const msgRes = await fetch(`https://api.ultramsg.com/${ultraInstance}/chats/messages?token=${ultraToken}&chatId=${encodeURIComponent(c.id)}&limit=3`);
          const msgs = await msgRes.json();
          const lastMsg = Array.isArray(msgs) && msgs.length > 0 ? msgs[msgs.length - 1] : null;

          recentOverview.push({
            customerName: c.name || 'عميل غير مسجل',
            phone: c.id.replace('@c.us', ''),
            lastInteraction: c.last_time ? new Date(c.last_time * 1000).toLocaleString('ar-EG') : '---',
            lastMessage: lastMsg ? {
              from: lastMsg.fromMe ? 'فريق مزار' : 'العميل',
              text: lastMsg.body || `[ملف/ميديا: ${lastMsg.type}]`,
              time: lastMsg.timestamp ? new Date(lastMsg.timestamp * 1000).toLocaleString('ar-EG') : '---'
            } : null
          });
        } catch (e) {}
      }

      return {
        summary: `جولة شاملة في واتساب مزار: تم فحص أحدث ${recentOverview.length} محادثة مع العملاء. إجمالي الشاتات المسجلة على الرقم: ${chats.length} محادثة.`,
        totalRecordedChats: chats.length,
        directCustomerChatsCount: directChats.length,
        internalGroupsCount: groupChats.length,
        recentConversations: recentOverview,
        systemContext: "رقم واتساب مزار الرسمي هو 01108109969. الرد التلقائي يرسل 3 رسائل ترحيبية للعملاء الجدد ثم يتوقف البوت تماماً ليترك الشات للموظف البشري."
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // 10. Monthly Financial Statement (كشف الحساب الشهري وأرباح الشركاء - صلاحيات مؤمن ومدحت)
  if (name === 'get_monthly_financial_statement') {
    const now = new Date();
    const targetMonth = args.month !== undefined ? Number(args.month) - 1 : now.getMonth();
    const targetYear = args.year !== undefined ? Number(args.year) : now.getFullYear();
    const includeYearlyRollup = args.includeYearlyRollup !== false;

    const [allBookings, allExpenses, allSalaries, units] = await Promise.all([
      getFreshDbBookings(),
      getDbExpenses(),
      getDbSalaries(),
      getSystemUnits(),
    ]);

    const isApprovedExpense = (e: any) => {
      if (!e) return false;
      if (e.status === 'REJECTED' || e.status === 'مرفوض') return false;
      return true;
    };

    // Filter confirmed/approved bookings for target month & year
    const monthlyBookings = (allBookings || []).filter((b: any) => {
      if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected' || b.status === 'ملغي' || b.status === 'مرفوض') return false;
      if (b.status !== 'approved' && b.status !== 'مؤكد') return false;
      const parsed = parseDateYM(b.checkIn || b.check_in);
      return parsed && parsed.month === targetMonth && parsed.year === targetYear;
    });

    // Filter monthly expenses
    const monthlyExpenses = (allExpenses || []).filter((e: any) => {
      if (!isApprovedExpense(e) || !e.date) return false;
      const parsed = parseDateYM(e.date);
      return parsed && parsed.month === targetMonth && parsed.year === targetYear;
    });

    // Salaries for this month
    const monthlySalaries = (allSalaries || []).filter((s: any) =>
      Number(s.month) - 1 === targetMonth && Number(s.year) === targetYear
    );
    const salariesFromExpenses = monthlyExpenses
      .filter((e: any) => e.category === 'رواتب' || e.category === 'مرتبات' || e.category === 'مرتب')
      .reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);
    const salariesTotal = monthlySalaries.reduce((sum: number, s: any) => sum + (parseFloat(s.amount) || 0), 0) + salariesFromExpenses;

    // --- SECTION 1: Mazar 1 & 2 (Studios 1-24) ---
    const mazar12Bookings = monthlyBookings.filter((b: any) => isMohsenBookingMatch(b, units));
    const mazar12Revenue = mazar12Bookings.reduce((sum: number, b: any) => sum + (parseFloat(b.totalAmount || b.total_amount) || 0), 0);
    const mazar12Commissions = mazar12Bookings.reduce((sum: number, b: any) => sum + (parseFloat(b.commission) || 0), 0);
    const mazar12TotalNights = mazar12Bookings.reduce((sum: number, b: any) => sum + (Number(b.numberOfDays || b.number_of_days) || 0), 0);
    const mazar12AvgNight = mazar12TotalNights > 0 ? Math.round(mazar12Revenue / mazar12TotalNights) : 0;

    const mazar12Expenses = monthlyExpenses
      .filter((e: any) =>
        (e.branch === 1 || e.branch === 2 || e.branch === '1' || e.branch === '2' || e.branch === 12 || e.branch === '12' || !e.branch) &&
        e.category !== 'رواتب' &&
        e.category !== 'مرتبات' &&
        e.category !== 'مرتب'
      )
      .reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

    const mazar12TotalExpensesAndSalaries = mazar12Expenses + salariesTotal;
    const mazar12NetProfit = mazar12Revenue - mazar12Commissions - mazar12Expenses - salariesTotal;

    const partnersMazar12 = [
      { key: 'MH', label: 'M.H (محسن)', percentage: 35, shareAmountEGP: Math.round((mazar12NetProfit * 35) / 100) },
      { key: 'HO', label: 'H.O', percentage: 18, shareAmountEGP: Math.round((mazar12NetProfit * 18) / 100) },
      { key: 'ME', label: 'M.E (مدحت)', percentage: 23.5, shareAmountEGP: Math.round((mazar12NetProfit * 23.5) / 100) },
      { key: 'HM', label: 'H.M (مؤمن)', percentage: 23.5, shareAmountEGP: Math.round((mazar12NetProfit * 23.5) / 100) },
    ];

    // --- SECTION 2: Mazar 3 (Units 25-30 / Koura) ---
    const mazar3Bookings = monthlyBookings.filter((b: any) => {
      const u = units.find((unit: any) => unit.id === (b.apartmentId || b.apartment_id));
      return u?.branch === 3 || String(b.apartmentId || b.apartment_id).startsWith('p-s');
    });
    const mazar3Revenue = mazar3Bookings.reduce((sum: number, b: any) => sum + (parseFloat(b.totalAmount || b.total_amount) || 0), 0);
    const mazar3Commissions = mazar3Bookings.reduce((sum: number, b: any) => sum + (parseFloat(b.commission) || 0), 0);
    const mazar3TotalNights = mazar3Bookings.reduce((sum: number, b: any) => sum + (Number(b.numberOfDays || b.number_of_days) || 0), 0);
    const mazar3AvgNight = mazar3TotalNights > 0 ? Math.round(mazar3Revenue / mazar3TotalNights) : 0;

    const mazar3Expenses = monthlyExpenses
      .filter((e: any) =>
        (e.branch === 3 || e.branch === '3') &&
        e.category !== 'رواتب' &&
        e.category !== 'مرتبات' &&
        e.category !== 'مرتب'
      )
      .reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

    const mazar3NetProfit = mazar3Revenue - mazar3Commissions - mazar3Expenses;

    const partnersMazar3 = [
      { key: 'Koura', label: 'Koura (عكورة)', percentage: 50, shareAmountEGP: Math.round((mazar3NetProfit * 50) / 100) },
      { key: 'MM', label: 'M.M', percentage: 25, shareAmountEGP: Math.round((mazar3NetProfit * 25) / 100) },
      { key: 'ME', label: 'M.E (مدحت)', percentage: 25, shareAmountEGP: Math.round((mazar3NetProfit * 25) / 100) },
    ];

    // --- SECTION 3: Hotel Apartments (apt-1, apt-2, apt-3) ---
    const getAptFinancials = (aptId: string, branchNum: number, aptName: string) => {
      const aptBookings = monthlyBookings.filter((b: any) => (b.apartmentId || b.apartment_id) === aptId);
      const rev = aptBookings.reduce((sum: number, b: any) => sum + (parseFloat(b.totalAmount || b.total_amount) || 0), 0);
      const comm = aptBookings.reduce((sum: number, b: any) => sum + (parseFloat(b.commission) || 0), 0);
      const exp = monthlyExpenses.filter((e: any) => e.branch === branchNum || e.branch === String(branchNum)).reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
      const net = rev - comm - exp;
      return {
        apartmentId: aptId,
        apartmentName: aptName,
        bookingsCount: aptBookings.length,
        revenueEGP: rev,
        commissionsEGP: comm,
        expensesEGP: exp,
        netProfitEGP: net
      };
    };

    const apartments = [
      getAptFinancials('apt-1', 4, 'شقة 1 (زكي رستم)'),
      getAptFinancials('apt-2', 5, 'شقة 2 (سيتي ستارز)'),
      getAptFinancials('apt-3', 6, 'شقة 3 (عباس الرئيسي)'),
    ];

    // Expenses by category
    const expensesByCategory: Record<string, number> = {};
    monthlyExpenses.forEach((e: any) => {
      const cat = e.category || 'عام';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    // Yearly Rollup
    let yearlyRollupData: any[] = [];
    if (includeYearlyRollup) {
      for (let m = 0; m < 12; m++) {
        const mBookings = (allBookings || []).filter((b: any) => {
          if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected' || b.status === 'ملغي' || b.status === 'مرفوض') return false;
          if (b.status !== 'approved' && b.status !== 'مؤكد') return false;
          const parsed = parseDateYM(b.checkIn || b.check_in);
          return parsed && parsed.month === m && parsed.year === targetYear;
        });

        const mExpenses = (allExpenses || []).filter((e: any) => {
          if (!isApprovedExpense(e) || !e.date) return false;
          const parsed = parseDateYM(e.date);
          return parsed && parsed.month === m && parsed.year === targetYear;
        });

        const rev = mBookings.reduce((acc: number, b: any) => acc + (parseFloat(b.totalAmount || b.total_amount) || 0) - (parseFloat(b.commission) || 0), 0);
        const exp = mExpenses.reduce((acc: number, e: any) => acc + (parseFloat(e.amount) || 0), 0);
        const profit = rev - exp;

        yearlyRollupData.push({
          monthNumber: m + 1,
          monthName: MONTHS_AR[m],
          bookingsCount: mBookings.length,
          revenueNetOfCommissionEGP: Math.round(rev),
          expensesEGP: Math.round(exp),
          netProfitEGP: Math.round(profit),
          hasData: rev > 0 || exp > 0 || mBookings.length > 0
        });
      }
    }

    return {
      statementType: "كشف الحساب الشهري الرسمي (صلاحيات الملاك: مؤمن ومدحت)",
      period: {
        monthNumber: targetMonth + 1,
        monthName: MONTHS_AR[targetMonth],
        year: targetYear
      },
      mazar1And2: {
        title: "مزار (1) + مزار (2) — استوديوهات 1 إلى 24",
        bookingsCount: mazar12Bookings.length,
        totalNightsStayed: mazar12TotalNights,
        averagePricePerNightEGP: mazar12AvgNight,
        totalRevenueEGP: mazar12Revenue,
        totalCommissionsEGP: mazar12Commissions,
        operatingExpensesEGP: mazar12Expenses,
        salariesTotalEGP: salariesTotal,
        totalExpensesWithSalariesEGP: mazar12TotalExpensesAndSalaries,
        netProfitEGP: mazar12NetProfit,
        profitDistribution: partnersMazar12,
        medhatShareEGP: partnersMazar12.find(p => p.key === 'ME')?.shareAmountEGP,
        moamenShareEGP: partnersMazar12.find(p => p.key === 'HM')?.shareAmountEGP
      },
      mazar3: {
        title: "مزار (3) — شقق 25 إلى 30 (عكورة)",
        bookingsCount: mazar3Bookings.length,
        totalNightsStayed: mazar3TotalNights,
        averagePricePerNightEGP: mazar3AvgNight,
        totalRevenueEGP: mazar3Revenue,
        totalCommissionsEGP: mazar3Commissions,
        operatingExpensesEGP: mazar3Expenses,
        netProfitEGP: mazar3NetProfit,
        profitDistribution: partnersMazar3
      },
      hotelApartments: apartments,
      expensesBreakdownByCategory: expensesByCategory,
      recordedExpensesCount: monthlyExpenses.length,
      yearlyRollup: includeYearlyRollup ? yearlyRollupData : undefined
    };
  }

  // 11. Expenses & Custody (كشف المصروفات والعهدة - صلاحيات مؤمن ومدحت)
  if (name === 'get_expenses_and_custody') {
    const [allExpenses, custodyData] = await Promise.all([
      getDbExpenses(),
      getDbCustody(),
    ]);

    let list = allExpenses || [];

    if (args.year !== undefined) {
      list = list.filter((e: any) => {
        const parsed = parseDateYM(e.date);
        return parsed && parsed.year === Number(args.year);
      });
    }

    if (args.month !== undefined) {
      list = list.filter((e: any) => {
        const parsed = parseDateYM(e.date);
        return parsed && parsed.month === Number(args.month) - 1;
      });
    }

    if (args.branch !== undefined) {
      list = list.filter((e: any) => Number(e.branch) === Number(args.branch));
    }

    if (args.status && args.status !== 'all') {
      if (args.status === 'approved') {
        list = list.filter((e: any) => e.status === 'APPROVED' || e.status === 'معتمد' || !e.status);
      } else if (args.status === 'pending') {
        list = list.filter((e: any) => e.status === 'PENDING' || e.status === 'معلق');
      } else if (args.status === 'rejected') {
        list = list.filter((e: any) => e.status === 'REJECTED' || e.status === 'مرفوض');
      }
    }

    const limit = args.limit || 50;
    const totalAmount = list.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

    return {
      accessGrantedAs: "Owner (مؤمن ومدحت)",
      custodyOverview: custodyData || {},
      totalExpensesCount: list.length,
      totalExpensesAmountEGP: totalAmount,
      expenses: list.slice(0, limit).map((e: any) => ({
        id: e.id,
        date: e.date,
        title: e.title || e.description,
        amountEGP: parseFloat(e.amount) || 0,
        category: e.category,
        branch: e.branch,
        unitId: e.unitId,
        status: e.status || 'معتمد',
        approvedBy: e.approvedBy || 'مؤمن / مدحت',
        notes: e.notes
      }))
    };
  }

  // 12. Treasury & Salaries (الخزنة والرواتب - صلاحيات مؤمن ومدحت)
  if (name === 'get_treasury_and_salaries') {
    const [transfers, salaries, staff] = await Promise.all([
      getDbTreasuryTransfers(),
      getDbSalaries(),
      getDbStaff(),
    ]);

    let salList = salaries || [];
    if (args.year !== undefined) {
      salList = salList.filter((s: any) => Number(s.year) === Number(args.year));
    }
    if (args.month !== undefined) {
      salList = salList.filter((s: any) => Number(s.month) === Number(args.month));
    }

    return {
      accessGrantedAs: "Owner (مؤمن ومدحت)",
      treasuryTransfers: (transfers || []).slice(0, 30),
      staffList: (staff || []).map((st: any) => ({
        id: st.id,
        name: st.name,
        role: st.role,
        phone: st.phone,
        baseSalary: st.salary
      })),
      salariesRecords: salList.map((s: any) => ({
        id: s.id,
        employeeName: s.name,
        month: s.month,
        year: s.year,
        amountEGP: s.amount,
        type: s.type || 'راتب',
        notes: s.notes
      }))
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
