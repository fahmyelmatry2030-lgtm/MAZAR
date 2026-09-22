"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getBookings, getSystemUnits } from '@/lib/data-init';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { updateDbBookingStatus, deleteDbBooking, deleteAllPendingDbBookings, getDbTodos, saveDbTodo, updateDbTodoStatus, deleteDbTodo } from '@/lib/actions/db';
import CustomerProfileModal from '@/components/CustomerProfileModal';
import ReceiptImageModal, { toDirectImageUrl } from '@/components/ReceiptImageModal';
import { User, Phone, MessageSquare, FileText, Calendar, CheckCircle2, Home, X, Trash2, ChevronDown, ChevronUp, ZoomIn, ZoomOut, RotateCcw, Clock } from 'lucide-react';
import { formatWhatsAppNumber } from '@/lib/utils';

const CONFIRMED_STATUSES = ['مؤكد', 'approved', 'مؤكد/دخول', 'مغادر/تنظيف', 'مغادر/تم'];
const PENDING_STATUSES = ['جديد', 'قيد المراجعة', 'pending', 'رد جديد'];

export default function DashboardOverview() {
  const [newBookingToast, setNewBookingToast] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [overviewZoom, setOverviewZoom] = useState<number>(100);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setOverviewZoom(75); // Initial auto zoom out on mobile screens for full table visibility
    }
  }, []);

  useEffect(() => {
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
  }, []);

  const [todaySchedule, setTodaySchedule] = useState<{in: any[], out: any[]}>({ in: [], out: [] });
  const [tomorrowPlans, setTomorrowPlans] = useState<{in: any[], out: any[]}>({ in: [], out: [] });
  const [nextDayPlans, setNextDayPlans] = useState<{in: any[], out: any[]}>({ in: [], out: [] });
  const [apartmentMap, setApartmentMap] = useState<any[]>([]);
  const [fullMap, setFullMap] = useState<any[]>([]);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [inventoryStats, setInventoryStats] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [adminRole, setAdminRole] = useState<string>('Admin');
  const router = useRouter();

  // 🔮 Smart Accommodation Assistant States
  const [units, setUnits] = useState<any[]>([]);
  const [selectedWebUnits, setSelectedWebUnits] = useState<Record<string, { id: string; studio: string }>>({});
  const [smartAssistantOpen, setSmartAssistantOpen] = useState(false);
  const [smartCheckIn, setSmartCheckIn] = useState('');
  const [smartCheckOut, setSmartCheckOut] = useState('');
  const [smartCategory, setSmartCategory] = useState('all');
  const [smartSuggestions, setSmartSuggestions] = useState<any[]>([]);
  const [hasSearchedSmart, setHasSearchedSmart] = useState(false);
  const [conflictDays, setConflictDays] = useState<string[]>([]);
  const [isPendingRequestsExpanded, setIsPendingRequestsExpanded] = useState(false);
  const [isDailyScheduleExpanded, setIsDailyScheduleExpanded] = useState(false);

  // 📝 To-Do List States
  const [todos, setTodos] = useState<any[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoNotes, setNewTodoNotes] = useState('');
  const [isSavingTodo, setIsSavingTodo] = useState(false);
  const [isTodoExpanded, setIsTodoExpanded] = useState(true);

  // Customer Profile Modal State
  const [profileModal, setProfileModal] = useState<{ isOpen: boolean; name: string | null; phone?: string | null }>({
    isOpen: false,
    name: null,
    phone: null,
  });

  // Note Viewer Modal State
  const [activeNoteModal, setActiveNoteModal] = useState<{ isOpen: boolean; text: string; title?: string }>({
    isOpen: false,
    text: '',
  });

  useEffect(() => {
    const info = sessionStorage.getItem('adminInfo');
    if (info) {
      const admin = JSON.parse(info);
      setAdminRole(admin.role);
    }
  }, []);

  const isPartner = adminRole === 'Partner';
  const isAkoura = adminRole === 'Akoura';
  const canManageTodo = adminRole === 'Owner' || adminRole === 'Super Admin' || adminRole === 'Admin';

  const loadOverviewData = useCallback(async () => {
    setIsLoading(true);
    let [bookings, apts, todoData] = await Promise.all([
      getBookings(Date.now().toString()),
      getSystemUnits(),
      getDbTodos(),
    ]);
    setTodos(todoData || []);

    const currentRole = typeof window !== 'undefined'
      ? (JSON.parse(sessionStorage.getItem('adminInfo') || '{}')?.role || adminRole)
      : adminRole;
    const isCurrentAkoura = currentRole === 'Akoura';
    const isCurrentPartner = currentRole === 'Partner';
    const isCurrentMohsen = currentRole === 'Mohsen';

    if (isCurrentPartner || isCurrentAkoura) {
      apts = apts.filter((u: any) => u.branch === 3);
      const branch3Ids = apts.map((u: any) => u.id);
      bookings = bookings.filter((b: any) => branch3Ids.includes(b.apartmentId) || String(b.apartmentId).startsWith('p-s') || String(b.apartmentId).startsWith('apt-'));
    } else if (isCurrentMohsen) {
      apts = apts.filter((u: any) => u.branch === 1 || u.branch === 2);
      const mazar12Ids = new Set(apts.map((u: any) => u.id));
      bookings = bookings.filter((b: any) => mazar12Ids.has(b.apartmentId) || (!String(b.apartmentId).startsWith('p-s') && !String(b.apartmentId).startsWith('apt-')));
    }

    apts = apts.filter((u: any) => !['s-single', 's-double', 's-triple', 's-tworoom'].includes(u.id));
    setUnits(apts);

    const targetDateStr = selectedDate;
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    const dayAfter = new Date(selectedDate);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];

    const confirmed = bookings.filter((b: any) => CONFIRMED_STATUSES.includes(b.status));

const isUnitMatch = (b: any, unitId: string, unitTitleAr?: string) => {
  if (!b || !unitId) return false;
  const targetId = String(unitId).trim().toLowerCase();
  const bAptId = String(b.apartmentId || b.apartment_id || '').trim().toLowerCase();
  const bStudio = String(b.studio || '').trim().toLowerCase();
  const bUnitId = String(b.unitId || b.unit_id || '').trim().toLowerCase();
  const titleAr = String(unitTitleAr || '').trim();

  // Prevent cross-building false matches (e.g. b2-s5 matching b1-s5)
  if (targetId.startsWith('b1-') && (bAptId.startsWith('b2-') || bUnitId.startsWith('b2-'))) return false;
  if (targetId.startsWith('b2-') && (bAptId.startsWith('b1-') || bUnitId.startsWith('b1-'))) return false;

  if (bAptId === targetId || bStudio === targetId || bUnitId === targetId) return true;
  if (titleAr && (bAptId === titleAr || bStudio === titleAr || bUnitId === titleAr)) return true;

  if (targetId === 'b1-s5') {
    if (['s5', '5', 'b1-s5', 'استوديو 5', 'استوديو 5 (دبل)'].some(alias => 
      bAptId === alias || bStudio === alias || bUnitId === alias
    )) return true;
  }
  
  if (targetId.startsWith('b1-s')) {
    const num = targetId.replace('b1-s', '');
    if (bAptId === num || bStudio === num || bAptId === `استوديو ${num}` || bStudio === `استوديو ${num}`) return true;
  }

  if (targetId.startsWith('b2-s')) {
    const num = targetId.replace('b2-s', '');
    if (bAptId === `b2-s${num}` || bStudio === `b2-s${num}`) return true;
  }

  return false;
};

    const map = apts.map((apt: any) => {
      const targetDateStr = selectedDate;
      const aptBookings = confirmed.filter((b: any) => isUnitMatch(b, apt.id, apt.title?.ar));
      
      const activeBooking = aptBookings.find((b: any) => targetDateStr >= b.checkIn && targetDateStr < b.checkOut);
      const outToday = aptBookings.find((b: any) => b.checkOut === targetDateStr);
      const inToday = aptBookings.find((b: any) => b.checkIn === targetDateStr);
      const outTomorrow = aptBookings.find((b: any) => b.checkOut === nextDayStr);
      
      const pastBookings = aptBookings
        .filter((b: any) => b.checkOut <= targetDateStr)
        .sort((a: any, b: any) => b.checkOut.localeCompare(a.checkOut));
      const lastBooking = pastBookings[0];

      const upcomingBookings = aptBookings
        .filter((b: any) => b.checkIn > targetDateStr)
        .sort((a: any, b: any) => a.checkIn.localeCompare(b.checkIn));
      const nextBooking = upcomingBookings[0];

      const currentAndFutureBookings = aptBookings
        .filter((b: any) => b.checkOut >= targetDateStr)
        .sort((a: any, b: any) => a.checkIn.localeCompare(b.checkIn));
      const latestFutureBooking = [...currentAndFutureBookings].sort((a: any, b: any) => b.checkOut.localeCompare(a.checkOut))[0];
      const finalCheckOut = latestFutureBooking ? latestFutureBooking.checkOut : (activeBooking?.checkOut || lastBooking?.checkOut || null);
      const upcomingThree = currentAndFutureBookings.slice(0, 3);

      let daysUntilNextBooking: number | null = null;
      if (nextBooking) {
        const nextCheckInDate = nextBooking.checkIn;
        const refDate = activeBooking ? activeBooking.checkOut : targetDateStr;
        const diffTime = new Date(nextCheckInDate).getTime() - new Date(refDate).getTime();
        daysUntilNextBooking = Math.round(diffTime / (1000 * 3600 * 24));
      }

      let isTurnover = !!outToday && !!inToday;
      // تمديد: نفس الضيف خارج وداخل في نفس اليوم (تمديد الإقامة)
      const sameGuestName = outToday?.name && inToday?.name &&
        outToday.name.trim().toLowerCase() === inToday.name.trim().toLowerCase();
      const sameApartment = outToday?.apartmentId && inToday?.apartmentId &&
        outToday.apartmentId === inToday.apartmentId;
      let isExtension = isTurnover && (sameGuestName || sameApartment);
      let isCheckingOut = !!outToday && !inToday;
      let isCheckingIn = !!inToday && !outToday;
      let isCheckingOutTomorrow = !isCheckingOut && !isTurnover && (!!outTomorrow || (!!activeBooking && activeBooking.checkOut === nextDayStr));

      const getUnitCategory = (unitId: string, currentType: string) => {
        if (unitId.startsWith('apt-')) return 'apartment';
        if (unitId.startsWith('p-s')) return 'apartment';
        const mapping: { [key: string]: string } = {
          'b1-s1': 'double', 'b1-s2': 'single', 'b1-s3': 'single', 'b1-s4': 'triple', 'b1-s5': 'double',
          'b1-s6': 'single', 'b1-s7': 'single', 'b1-s8': 'single', 'b1-s9': 'double', 'b1-s10': 'double',
          'b1-s11': 'double', 'b1-s12': 'double',
          'b2-s1': 'double', 'b2-s2': 'triple', 'b2-s3': 'triple', 'b2-s4': 'triple', 'b2-s5': 'single',
          'b2-s6': 'double', 'b2-s7': 'triple', 'b2-s8': 'double', 'b2-s9': 'triple', 'b2-s10': 'triple',
          'b2-s11': 'triple', 'b2-s12': 'double',
        };
        return mapping[unitId] || currentType || 'single';
      };

      const cat = getUnitCategory(apt.id, apt.type);

      return {
        ...apt,
        category: cat,
        isOccupied: !!activeBooking || apt.status === 'مشغول',
        guest: activeBooking?.name,
        bookingId: activeBooking?.id,
        phone: activeBooking?.phone,
        clientStatus: activeBooking?.clientStatus || 'انتظار',
        checkOut: activeBooking?.checkOut,
        finalCheckOut,
        upcomingThree,
        guestsCount: activeBooking?.guestsCount,
        lastCheckOut: lastBooking?.checkOut,
        upcomingBookingsCount: upcomingBookings.length,
        daysUntilNextBooking,
        isTurnover,
        isExtension,
        notes: activeBooking?.notes || (outToday?.notes ? outToday.notes : inToday?.notes ? inToday.notes : ''),
        leavingNotes: outToday?.notes || '',
        arrivingNotes: inToday?.notes || '',
        leavingGuest: outToday?.name,
        leavingPhone: outToday?.phone,
        leavingBookingId: outToday?.id,
        leavingClientStatus: outToday?.clientStatus || 'انتظار',
        leavingCheckOut: outToday?.checkOut,
        arrivingGuest: inToday?.name,
        arrivingPhone: inToday?.phone,
        arrivingBookingId: inToday?.id,
        arrivingClientStatus: inToday?.clientStatus || 'انتظار',
        arrivingCheckOut: inToday?.checkOut,
        isCheckingOut,
        isCheckingOutTomorrow,
        isCheckingIn,
      };
    });

    setFullMap(map);
    setUnits(apts);
    if (selectedCategory === 'all') {
      setApartmentMap(map);
    } else {
      setApartmentMap(map.filter((u: any) => u.category === selectedCategory));
    }

    setInventoryStats([
      { id: 'single',   label: 'سنجل',    count: map.filter((u: any) => u.category === 'single' && !u.isOccupied).length, total: map.filter((u: any) => u.category === 'single').length, color: 'text-green-500'  },
      { id: 'double',   label: 'دبل',      count: map.filter((u: any) => u.category === 'double' && !u.isOccupied).length, total: map.filter((u: any) => u.category === 'double').length, color: 'text-blue-400'   },
      { id: 'triple',   label: 'تريبل',    count: map.filter((u: any) => u.category === 'triple' && !u.isOccupied).length, total: map.filter((u: any) => u.category === 'triple').length, color: 'text-orange-400' },
      { id: 'two-room', label: 'غرفتين',   count: map.filter((u: any) => u.category === 'two-room' && !u.isOccupied).length, total: map.filter((u: any) => u.category === 'two-room').length, color: 'text-purple-400' },
      { id: 'apartment', label: 'شقق',    count: map.filter((u: any) => u.category === 'apartment' && !u.isOccupied).length, total: map.filter((u: any) => u.category === 'apartment').length, color: 'text-amber-500' },
    ]);

    setAllBookings(bookings);

    // Hard delete mock test records from DB
    const mockBookings = bookings.filter((b: any) => {
      const name = String(b.name || '').trim();
      return ['مراد لاغا', 'مينا صبرى', 'عاصم بن صالح', 'محمد عبدالحفيظ', 'عبدالحفيظ', 'حسني معمر', 'صبرى يوسف', 'MFl', 'mfl', 'احمد الحسنى', 'احمد فارس شيخو', 'رعد سلمان', 'مصطفي احمد', 'Ahmed', 'ahmed', 'محمد خليل', 'ابودراز', 'أبودراز'].some(m => name.toLowerCase().includes(m.toLowerCase()));
    });
    if (mockBookings.length > 0) {
      Promise.all(mockBookings.map((b: any) => deleteDbBooking(b.id)))
        .catch(() => {});
    }

    setTodaySchedule({
      in:  confirmed.filter((b: any) => b.checkIn  === targetDateStr),
      out: confirmed.filter((b: any) => b.checkOut === targetDateStr),
    });
    setTomorrowPlans({
      in:  confirmed.filter((b: any) => b.checkIn  === nextDayStr),
      out: confirmed.filter((b: any) => b.checkOut === nextDayStr),
    });
    setNextDayPlans({
      in:  confirmed.filter((b: any) => b.checkIn  === dayAfterStr),
      out: confirmed.filter((b: any) => b.checkOut === dayAfterStr),
    });

    setLastUpdated(new Date());
    setIsLoading(false);
  }, [selectedDate, selectedCategory, adminRole]);

  const [activeReceiptModal, setActiveReceiptModal] = useState<{ isOpen: boolean; url: string | null; name?: string }>({ isOpen: false, url: null });

  const getReceiptUrl = (req: any) => {
    if (!req) return null;
    if (req.receiptUrl && typeof req.receiptUrl === 'string' && req.receiptUrl.startsWith('http')) {
      return toDirectImageUrl(req.receiptUrl);
    }
    if (req.receipt && typeof req.receipt === 'string' && req.receipt.startsWith('http')) {
      return toDirectImageUrl(req.receipt);
    }
    if (req.paymentProof && typeof req.paymentProof === 'string' && req.paymentProof.startsWith('http')) {
      return toDirectImageUrl(req.paymentProof);
    }
    
    const text = `${req.paymentInfo || ''} ${req.notes || ''} ${req.paymentProof || ''}`;
    const match = text.match(/(https?:\/\/[^\s"']+)/i);
    if (match && match[0]) {
      const extractedUrl = match[0].replace(/[.,;)]+$/, '');
      return toDirectImageUrl(extractedUrl);
    }
    return null;
  };

  const getLoggedInAdminName = () => {
    if (typeof window === 'undefined') return 'قائد الشيفت';
    try {
      const info = sessionStorage.getItem('adminInfo') || localStorage.getItem('adminInfo');
      if (info) {
        const parsed = JSON.parse(info);
        if (parsed.name) return parsed.name;
        if (parsed.username) return parsed.username;
      }
    } catch (e) {}
    return 'قائد الشيفت';
  };

  const handleConfirmWebBooking = async (req: any) => {
    try {
      const shiftLead = getLoggedInAdminName();
      const customUnit = selectedWebUnits[req.id];
      const finalAptId = customUnit?.id || req.apartmentId || req.apartment_id;
      const finalStudio = customUnit?.studio || req.studio;

      await updateDbBookingStatus(req.id, { 
        status: 'مؤكد', 
        apartmentId: finalAptId,
        studio: finalStudio,
        approvedByAdmin: true,
        bookingManager: 'فهد',
        notes: req.notes 
          ? `${req.notes} [مسئول الحجز: فهد - اعتماد: ${shiftLead} - الوحدة: ${finalStudio}]` 
          : `[مسئول الحجز: فهد - اعتماد: ${shiftLead} - الوحدة: ${finalStudio}]`
      });
      loadOverviewData();
    } catch {
      alert('حدث خطأ أثناء تأكيد الحجز.');
    }
  };

  const handleRejectWebBooking = async (reqId: string) => {
    if (!confirm('هل أنت تأكد من مسح وحذف هذا الطلب نهائياً؟')) return;
    try {
      await deleteDbBooking(reqId);
      loadOverviewData();
    } catch {
      alert('حدث خطأ أثناء حذف الطلب.');
    }
  };

  const handleClearAllPendingWebRequests = async () => {
    if (!confirm('هل تريد مسح كافة الطلبات الوهمية والتجريبية نهائياً من قاعدة البيانات؟')) return;
    try {
      await deleteAllPendingDbBookings();
      loadOverviewData();
    } catch {
      alert('حدث خطأ أثناء مسح الطلبات.');
    }
  };

  const mockNames = ['test-mock-dummy-only'];
  
  const isMockRequest = (b: any) => {
    return String(b.id || '').startsWith('mock-');
  };

  const pendingWebRequests = (allBookings || []).filter((b: any) => {
    if (isMockRequest(b)) return false;

    const isFromWebsite = 
      b.source === 'website' || 
      b.isWebsiteBooking === true || 
      b.is_website_booking === true || 
      String(b.paymentInfo || '').includes('[طلب') || 
      String(b.payment_info || '').includes('[طلب') ||
      String(b.notes || '').includes('[طلب') ||
      b.status === 'جديد' ||
      b.status === 'pending' ||
      b.status === 'رد جديد';

    if (!isFromWebsite) return false;

    const st = String(b.status || '').trim();
    const isConfirmed = CONFIRMED_STATUSES.some(cs => st === cs || st.includes('مؤكد') || st === 'approved');
    return !isConfirmed && st !== 'ملغى' && st !== 'deleted';
  });

  useEffect(() => {
    loadOverviewData();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings' }, (payload: any) => {
        if (audioRef.current) audioRef.current.play().catch(() => {});
        setNewBookingToast(payload.new);
        loadOverviewData();
        setTimeout(() => setNewBookingToast(null), 8000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOverviewData]);

  // 🔮 Smart Booking Assistant Algorithm for Overview Page
  const handleSmartSearch = () => {
    if (!smartCheckIn || !smartCheckOut) {
      alert('يرجى تحديد تاريخ الدخول وتاريخ الخروج أولاً.');
      return;
    }
    if (new Date(smartCheckIn) >= new Date(smartCheckOut)) {
      alert('تاريخ الخروج يجب أن يكون بعد تاريخ الدخول.');
      return;
    }

    setHasSearchedSmart(true);

    const checkInDate = new Date(smartCheckIn);
    const checkOutDate = new Date(smartCheckOut);
    const totalNights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Filter units matching category
    let targetUnits = units;
    if (smartCategory !== 'all') {
      targetUnits = units.filter((u: any) => u.category === smartCategory);
    }

    const suggestionsList: any[] = [];

    // 1. Find Fully Available Units
    targetUnits.forEach((unit: any) => {
      // Find all bookings for this unit to check gaps and overlap
      const unitBookings = allBookings.filter((b: any) => {
        if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected') return false;
        const bUnitId = b.apartmentId || b.studio;
        return bUnitId === unit.id;
      });

      const overlaps = unitBookings.filter((b: any) => {
        return (b.checkIn < smartCheckOut) && (b.checkOut > smartCheckIn);
      });

      if (overlaps.length === 0) {
        // Find previous booking (closest ending on or before smartCheckIn)
        const prevBooking = unitBookings
          .filter((b: any) => b.checkOut <= smartCheckIn)
          .sort((a: any, b: any) => b.checkOut.localeCompare(a.checkOut))[0];
        
        // Find next booking (closest starting on or after smartCheckOut)
        const nextBooking = unitBookings
          .filter((b: any) => b.checkIn >= smartCheckOut)
          .sort((a: any, b: any) => a.checkIn.localeCompare(b.checkIn))[0];

        const gapBefore = prevBooking 
          ? Math.round((new Date(smartCheckIn).getTime() - new Date(prevBooking.checkOut).getTime()) / (1000 * 60 * 60 * 24))
          : 99;

        const gapAfter = nextBooking
          ? Math.round((new Date(nextBooking.checkIn).getTime() - new Date(smartCheckOut).getTime()) / (1000 * 60 * 60 * 24))
          : 99;

        // Gap score (lower is better, 0 is perfect)
        const score = gapBefore + gapAfter;

        let efficiencyLabel = '';
        if (gapBefore === 0 && gapAfter === 0) {
          efficiencyLabel = ' (مثالي! يسد الفجوة بالكامل 🌟)';
        } else if (gapBefore === 0 || gapAfter === 0) {
          efficiencyLabel = ` (ممتاز! متصل بحجز آخر ➔)`;
        } else if (gapBefore < 99 || gapAfter < 99) {
          efficiencyLabel = ` (فجوة: ${gapBefore < 99 ? gapBefore + ' يوم قبل' : ''} ${gapAfter < 99 ? gapAfter + ' يوم بعد' : ''})`;
        }

        suggestionsList.push({
          type: 'full',
          unit,
          score,
          gapBefore,
          gapAfter,
          label: `${unit.title?.ar || unit.id} (${unit.category === 'single' ? 'سنجل' : unit.category === 'double' ? 'دبل' : unit.category === 'triple' ? 'تريبل' : unit.category === 'two-room' ? 'غرفتين' : 'شقة'})${efficiencyLabel}`
        });
      }
    });

    // Sort full suggestions by gap score (ascending: closest fit first to fill gaps)
    suggestionsList.sort((a, b) => a.score - b.score);

    // 2. If no unit is fully available, suggest split-stays!
    if (suggestionsList.length === 0 && totalNights >= 2) {
      // Check every split point (e.g. splitting after 'splitNights' nights)
      for (let splitNights = 1; splitNights < totalNights; splitNights++) {
        const splitDate = new Date(checkInDate);
        splitDate.setDate(checkInDate.getDate() + splitNights);
        const splitDateStr = splitDate.toISOString().split('T')[0];

        // Part 1: [smartCheckIn, splitDateStr)
        const part1Available = targetUnits.filter((unit: any) => {
          return !allBookings.some((b: any) => {
            if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected') return false;
            const bUnitId = b.apartmentId || b.studio;
            return bUnitId === unit.id && (b.checkIn < splitDateStr) && (b.checkOut > smartCheckIn);
          });
        });

        // Part 2: [splitDateStr, smartCheckOut)
        const part2Available = targetUnits.filter((unit: any) => {
          return !allBookings.some((b: any) => {
            if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected') return false;
            const bUnitId = b.apartmentId || b.studio;
            return bUnitId === unit.id && (b.checkIn < smartCheckOut) && (b.checkOut > splitDateStr);
          });
        });

        if (part1Available.length > 0 && part2Available.length > 0) {
          const u1 = part1Available[0];
          const u2 = part2Available[0];
          
          suggestionsList.push({
            type: 'split',
            u1,
            u2,
            splitDateStr,
            splitNights,
            totalNights,
            label: `تسكين مجزأ: الاستوديو (${u1.title?.ar || u1.id}) لمدة ${splitNights} ليالي، ثم الانتقال للاستوديو (${u2.title?.ar || u2.id}) لمدة ${totalNights - splitNights} ليالي.`
          });
          
          if (suggestionsList.length >= 2) break;
        }
      }
    }

    // 3. If still no suggestions, find the specific "problem days" where ALL units are fully booked
    const problemDays: string[] = [];
    if (suggestionsList.length === 0) {
      const cursor = new Date(checkInDate);
      while (cursor < checkOutDate) {
        const dayStr = cursor.toISOString().split('T')[0];
        const nextDay = new Date(cursor);
        nextDay.setDate(cursor.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        // Is there at least one unit free on this specific day?
        const anyFree = targetUnits.some((unit: any) => {
          return !allBookings.some((b: any) => {
            if (b.status === 'deleted' || b.status === 'cancelled' || b.status === 'rejected') return false;
            const bUnitId = b.apartmentId || b.studio;
            return bUnitId === unit.id && (b.checkIn < nextDayStr) && (b.checkOut > dayStr);
          });
        });

        if (!anyFree) problemDays.push(dayStr);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    setConflictDays(problemDays);
    setSmartSuggestions(suggestionsList);
  };

  const applyFullSuggestion = (unitId: string) => {
    // Redirect to reports page with parameters to auto-fill
    router.push(`/admin/dashboard/reports?unit=${unitId}&checkIn=${smartCheckIn}&checkOut=${smartCheckOut}&tab=operational`);
  };

  const applySplitPart = (unitId: string, checkIn: string, checkOut: string) => {
    // Redirect to reports page with parameters to auto-fill segment
    router.push(`/admin/dashboard/reports?unit=${unitId}&checkIn=${checkIn}&checkOut=${checkOut}&tab=operational`);
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
    if (!bookingId) return;
    try {
      await updateDbBookingStatus(bookingId, { clientStatus: newStatus });
      loadOverviewData();
    } catch (err) {
      alert('فشل تحديث الحالة.');
    }
  };

  const handleUnitClick = (apt: any) => {
    const d = new Date(selectedDate);
    const m = d.getMonth();
    const y = d.getFullYear();
    router.push(`/admin/dashboard/reports?unit=${apt.id}&month=${m}&year=${y}&tab=operational`);
  };

  const openCustomerProfile = (name: string, phone?: string) => {
    if (!name || name === '—') return;
    setProfileModal({
      isOpen: true,
      name,
      phone
    });
  };

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">

      {/* ── HEADER ── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black mb-1 tracking-tight text-[#2A2723]">
            الاستعراض <span className="text-[#C1A68D]">العام</span>
          </h1>
          <p className="text-[#7A7061] font-bold opacity-80 text-sm">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/admin/dashboard/customers"
            className="bg-[#2A2723] hover:bg-black text-[#C1A68D] hover:text-white px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border border-[#C1A68D]/40 shadow-md"
          >
            👥 قاعدة بيانات العملاء
          </a>
          <div className="flex items-center gap-2 bg-white border border-[#EAE4D9]/50 px-4 py-2 rounded-full shadow-sm">
            <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? 'bg-amber-400 animate-ping' : 'bg-green-500'}`} />
            <span className="text-xs font-black uppercase tracking-widest text-[#7A7061]">
              {isLoading ? 'جاري التحديث...' : `آخر تحديث: ${lastUpdated.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
          <button
            onClick={loadOverviewData}
            className="w-10 h-10 bg-[#C1A68D]/10 hover:bg-[#C1A68D] text-[#C1A68D] hover:text-white rounded-full flex items-center justify-center transition-all border border-[#C1A68D]/30 shadow-sm"
            title="تحديث البيانات"
          >🔄</button>
        </div>
      </header>

      {/* 🔮 Smart Booking Assistant Widget (Large Crimson Card) */}
      {/* ── SECTION 1: SMART ACCOMMODATION ASSISTANT (قسم 1: مساعد التسكين الذكي - لون ذهبي دافئ) ── */}
      <div className="bg-gradient-to-br from-[#231710] via-[#1A110B] to-[#231710] p-6 md:p-8 rounded-[2.5rem] border-2 border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.15)] hover:border-amber-400 text-white space-y-4 animate-fade-in relative overflow-hidden transition-all">
        {/* Decorative background glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-600/10 rounded-full blur-3xl" />

        <button
          type="button"
          onClick={() => setSmartAssistantOpen(!smartAssistantOpen)}
          className="w-full flex items-center justify-between text-right relative z-10"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0 border border-amber-400/30">
              🔮
            </div>
            <div>
              <h3 className="text-lg font-black text-amber-200">مساعد التسكين الذكي واقتراح الغرف والتقسيم المتاح</h3>
              <p className="text-xs text-gray-400 font-bold mt-0.5">
                أدخل تواريخ إقامة العميل المقترحة ونوع الغرفة لنقوم باقتراح الغرفة المناسبة أو توليد خطة تسكين مقسمة (Split-Stay) تلقائياً.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              {smartAssistantOpen ? 'إغلاق المساعد ▲' : 'بدء البحث عن مقترح حجز جديد 🔍'}
            </span>
          </div>
        </button>

        {smartAssistantOpen && (
          <div className="pt-5 border-t border-red-500/20 space-y-6 relative z-10 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-red-300 uppercase px-1">تاريخ الدخول المقترح</label>
                <input
                  type="date"
                  value={smartCheckIn}
                  onChange={e => setSmartCheckIn(e.target.value)}
                  className="w-full bg-[#1A0E0E] border border-red-500/20 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-red-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-red-300 uppercase px-1">تاريخ الخروج المقترح</label>
                <input
                  type="date"
                  value={smartCheckOut}
                  onChange={e => setSmartCheckOut(e.target.value)}
                  className="w-full bg-[#1A0E0E] border border-red-500/20 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-red-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-red-300 uppercase px-1">نوع الغرفة المطلوب</label>
                <select
                  value={smartCategory}
                  onChange={e => setSmartCategory(e.target.value)}
                  className="w-full bg-[#1A0E0E] border border-red-500/20 rounded-xl px-4 py-2.5 text-xs font-black text-red-300 outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="single">سنجل (Single)</option>
                  <option value="double">دبل (Double)</option>
                  <option value="triple">تريبل (Triple)</option>
                  <option value="two-room">غرفتين (Double Room)</option>
                  <option value="apartment">شقق (Apartment)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSmartSearch}
                className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black px-8 py-3.5 rounded-xl text-xs transition-all shadow-lg flex items-center gap-2"
              >
                🔮 ابحث واقترح الغرف والتقسيم المتاح
              </button>
            </div>

            {hasSearchedSmart && (
              <div className="space-y-3 pt-4 border-t border-red-500/20">
                <h4 className="text-xs font-black text-red-300 uppercase tracking-wider">💡 التسكين المقترح من النظام:</h4>
                
                {smartSuggestions.length === 0 ? (
                  <div className="bg-[#1A0E0E] p-4 rounded-2xl border border-red-500/10 space-y-3">
                    <p className="text-xs text-gray-400 font-bold text-center">
                      ⚠️ لم نجد أي وحدات متاحة لهذه الفترة والمواصفات.
                    </p>
                    {conflictDays.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-red-400 text-center uppercase tracking-wider">🔴 الأيام المشكلة (كل الغرف محجوزة فيها):</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {conflictDays.map(day => (
                            <span key={day} className="bg-red-500/15 text-red-300 border border-red-500/30 text-[10px] font-black px-3 py-1.5 rounded-full">
                              🔴 {new Date(day + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'long' })}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold text-center">يجب إما تعديل التواريخ لتتجنب هذه الأيام، أو مراجعة الحجوزات الموجودة.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {smartSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                          s.type === 'full' ? 'bg-green-500/5 border-green-500/30' : 'bg-amber-500/5 border-amber-500/30'
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              s.type === 'full' ? 'bg-green-500/25 text-green-300' : 'bg-amber-500/25 text-amber-300'
                            }`}>
                              {s.type === 'full' ? 'متاح بالكامل 🟢' : 'خطة تسكين مجزأة 🔀'}
                            </span>
                            <span className="font-bold text-xs text-white">
                              {s.type === 'full'
                                ? `${s.unit.title?.ar || s.unit.id} (${s.unit.category === 'single' ? 'سنجل' : s.unit.category === 'double' ? 'دبل' : s.unit.category === 'triple' ? 'تريبل' : s.unit.category === 'two-room' ? 'غرفتين' : 'شقة'})`
                                : s.label}
                            </span>
                          </div>
                          {s.type === 'split' && (
                            <p className="text-[10px] text-gray-400 font-bold">
                              💡 هذه الفترة تتطلب تسجيل حجزين متتاليين للعميل لكي تكتمل إقامته بالكامل.
                            </p>
                          )}
                        </div>

                        {s.type === 'full' ? (
                          <button
                            type="button"
                            onClick={() => applyFullSuggestion(s.unit.id)}
                            className="bg-green-600 hover:bg-green-500 text-white font-black px-5 py-2.5 rounded-xl text-[10px] transition-all flex items-center gap-1.5 shrink-0 self-stretch md:self-auto text-center justify-center shadow-md"
                          >
                            تسكين وتعبئة الحجز فوراً 📝
                          </button>
                        ) : (
                          <div className="flex gap-2 w-full md:w-auto">
                            <button
                              type="button"
                              onClick={() => applySplitPart(s.u1.id, smartCheckIn, s.splitDateStr)}
                              className="flex-1 md:flex-none bg-amber-600 hover:bg-amber-500 text-white font-black px-3.5 py-2 rounded-xl text-[10px] transition-all shadow-md"
                            >
                              تعبئة حجز الجزء الأول 📝
                            </button>
                            <button
                              type="button"
                              onClick={() => applySplitPart(s.u2.id, s.splitDateStr, smartCheckOut)}
                              className="flex-1 md:flex-none bg-gradient-to-r from-red-600 to-rose-700 hover:opacity-90 text-white font-black px-3.5 py-2 rounded-xl text-[10px] transition-all shadow-md"
                            >
                              تعبئة حجز الجزء الثاني 📝
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── WEBSITE INCOMING BOOKING REQUESTS SECTION (قسم طلبات الحجز القادمة من الويب سايت) ── */}
      <div className="bg-gradient-to-br from-[#1F1C18] to-[#2A241F] p-6 md:p-8 rounded-[2.5rem] shadow-2xl border border-amber-500/30 text-white relative overflow-hidden space-y-6">
        <div
          onClick={() => setIsPendingRequestsExpanded(!isPendingRequestsExpanded)}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5 cursor-pointer group/accordion"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-xl shadow-inner group-hover/accordion:scale-105 transition-transform">
              🌐
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl font-black text-white group-hover/accordion:text-amber-400 transition-colors">
                  طلبات الحجز
                </h3>
                {pendingWebRequests.length > 0 && (
                  <span className="w-8 h-8 rounded-full bg-rose-500 text-white text-sm font-black flex items-center justify-center animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.6)] border-2 border-white/20">
                    {pendingWebRequests.length}
                  </span>
                )}
                <span className="text-xs text-gray-400 font-bold bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {isPendingRequestsExpanded ? 'انقر للطي' : 'انقر لعرض الطلبات'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-bold mt-0.5">
                طلبات الحجوزات المرسلة مباشرة من العملاء عبر الموقع الإلكتروني للمعاينة والتأكيد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {pendingWebRequests.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAllPendingWebRequests();
                }}
                className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-black px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0"
                title="مسح وتفريغ الطلبات المعلقة"
              >
                <span>🧹 مسح الطلبات ({pendingWebRequests.length})</span>
              </button>
            )}

            <div className="w-10 h-10 rounded-xl bg-white/10 group-hover/accordion:bg-amber-500 group-hover/accordion:text-black text-white flex items-center justify-center transition-all duration-300 shadow-md">
              {isPendingRequestsExpanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </div>
          </div>
        </div>

        {isPendingRequestsExpanded && (
          <div className="animate-fade-in space-y-6">
            {pendingWebRequests.length === 0 ? (
              <div className="bg-[#2A2723]/60 p-6 rounded-2xl border border-white/5 text-center space-y-1.5">
                <p className="text-sm font-black text-gray-300">
                  ✨ لا يوجد طلبات حجز معلقة من الويب سايت حالياً
                </p>
                <p className="text-xs text-gray-500 font-bold">
                  جميع الحجوزات المرفوعة عبر الموقع تم التأكد منها ومراجعتها بنجاح.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingWebRequests.map((req: any, idx: number) => {
              const cleanP = formatWhatsAppNumber(req.phone);
              return (
                <div key={req.id || idx} className="bg-[#0B132B] border-2 border-blue-500/80 hover:border-cyan-400 rounded-2xl p-5 space-y-4 shadow-[0_0_25px_rgba(59,130,246,0.18)] hover:shadow-[0_0_35px_rgba(6,182,212,0.35)] transition-all duration-300 relative group">
                  {/* Header with Fahd Agent Badge */}
                  <div className="flex items-start justify-between gap-2 border-b border-blue-500/20 pb-3">
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => openCustomerProfile(req.name, req.phone)}
                        className="text-base font-black text-white hover:text-cyan-300 transition-colors text-right flex items-center gap-1.5"
                      >
                        <User size={16} className="text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{req.name || 'عميل جديد'}</span>
                      </button>
                      <p className="text-[10px] text-blue-300/80 font-bold">
                        📞 {req.phone || 'بدون رقم'}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-blue-900/90 text-cyan-200 border border-blue-400/40 text-[10px] font-black px-3 py-1 rounded-lg shadow-sm flex items-center gap-1">
                        👤 مسئول الحجوزات: فهد
                      </span>
                      <span className="text-[9px] text-cyan-400 font-bold">طلب جديد 🆕</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-bold text-gray-200">
                    {/* RECEIPT / PAY PROOF BADGE AT THE VERY TOP */}
                    {(() => {
                      const receipt = getReceiptUrl(req);
                      return receipt ? (
                        <button
                          type="button"
                          onClick={() => setActiveReceiptModal({ isOpen: true, url: receipt, name: req.name })}
                          className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 border-2 border-emerald-400 text-emerald-200 px-3.5 py-3 rounded-xl text-xs font-black flex items-center justify-between transition-all shadow-lg animate-pulse"
                        >
                          <span className="flex items-center gap-1.5 text-xs">🧾 صورة إيصال التحويل المرفوع</span>
                          <span className="text-[10px] bg-emerald-400 text-black px-3 py-1 rounded-full font-black shadow-md">معاينة وتكبير 📸</span>
                        </button>
                      ) : (
                        <div className="text-[10px] text-blue-300/60 font-bold text-center bg-blue-950/40 py-1.5 rounded-xl border border-blue-500/10">
                          ⚠️ لم يرفق إيصال تحويل
                        </div>
                      );
                    })()}

                    {/* 🔄 EDIT / ASSIGN UNIT DROPDOWN BEFORE CONFIRMING */}
                    <div className="bg-[#1C2541] p-3 rounded-xl border border-blue-500/30 space-y-1.5 shadow-sm">
                      <div className="flex justify-between items-center text-[10px] font-black text-cyan-300">
                        <span>🏠 الوحدة المطلوبة من الموقع:</span>
                        <span className="text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          {req.studio || req.apartmentId || 'غير محدد'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <label className="text-[9.5px] font-bold text-blue-200 shrink-0">
                          🔄 تغيير الوحدة قبل التأكيد:
                        </label>
                        <select
                          value={selectedWebUnits[req.id]?.id || req.apartmentId || ''}
                          onChange={(e) => {
                            const chosenId = e.target.value;
                            const foundUnit = units.find((u: any) => u.id === chosenId);
                            const chosenTitle = foundUnit?.title?.ar || foundUnit?.title?.en || chosenId;
                            setSelectedWebUnits(prev => ({
                              ...prev,
                              [req.id]: { id: chosenId, studio: chosenTitle }
                            }));
                          }}
                          className="bg-[#0B132B] text-amber-300 font-black text-[11px] px-2.5 py-1.5 rounded-lg border border-cyan-400/50 focus:border-cyan-300 outline-none w-full max-w-[170px] cursor-pointer shadow-inner"
                        >
                          <option value={req.apartmentId || ''} className="bg-[#0B132B] text-amber-300">
                            {req.studio || req.apartmentId || 'اختر وحدة أخرى...'}
                          </option>
                          {units.map((u: any) => (
                            <option key={u.id} value={u.id} className="bg-[#0B132B] text-white">
                              {u.title?.ar || u.title?.en || u.id} ({u.id})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-between bg-[#1C2541] p-2.5 rounded-xl border border-blue-500/20">
                      <span className="text-blue-300/80">📅 فترة الإقامة:</span>
                      <span className="text-cyan-300 font-black">{req.checkIn || req.check_in} ➔ {req.checkOut || req.check_out}</span>
                    </div>
                    {req.totalAmount && (
                      <div className="flex justify-between bg-[#1C2541] p-2.5 rounded-xl border border-blue-500/20">
                        <span className="text-blue-300/80">💰 المبلغ المقدر:</span>
                        <span className="text-emerald-400 font-black">{req.totalAmount} ج.م</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-blue-500/20">
                    <button
                      type="button"
                      onClick={() => handleConfirmWebBooking(req)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <span>تأكيد الحجز 🟢</span>
                    </button>
                    {cleanP && (
                      <a
                        href={`https://wa.me/${cleanP}?text=${encodeURIComponent(
                          `أهلاً بك أستاذ ${req.name}، بخصوص طلب حجزك في مزار للوحدة (${
                            selectedWebUnits[req.id]?.studio || req.studio
                          }) للفترة من ${req.checkIn || req.check_in} إلى ${req.checkOut || req.check_out}...`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 p-2.5 rounded-xl text-xs font-black flex items-center justify-center transition-all"
                        title="تواصل واتساب"
                      >
                        <MessageSquare size={16} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRejectWebBooking(req.id)}
                      className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 p-2.5 rounded-xl text-xs font-black transition-all"
                      title="رفض / حذف الطلب"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}
  </div>

      {/* ── REALTIME TOAST ── */}
      {newBookingToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-[#2A2723] border-2 border-green-400 p-5 rounded-2xl shadow-2xl animate-fade-in w-80">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-400/20 text-green-400 rounded-full flex items-center justify-center text-xl shrink-0 animate-pulse">🔔</div>
            <div>
              <h4 className="font-black text-white mb-1">طلب حجز جديد!</h4>
              <p className="text-xs text-gray-300 font-bold">من: {newBookingToast.name}</p>
              <p className="text-[10px] text-[#C1A68D] font-black mt-1">{newBookingToast.check_in} ← {newBookingToast.check_out}</p>
            </div>
          </div>
          <button onClick={() => setNewBookingToast(null)} className="absolute top-3 left-3 text-gray-500 hover:text-white text-xs font-bold">✕</button>
        </div>
      )}

      {/* ── SECTION 3: FULL-WIDTH DAILY OPERATIONS SCHEDULE (قسم 3: جدول خطة الدخول والخروج اليومية - لون زمردي فاخر) ── */}
      <div className="bg-gradient-to-br from-[#042018] via-[#021812] to-[#042018] p-6 md:p-8 rounded-[2.5rem] shadow-[0_0_25px_rgba(16,185,129,0.18)] border-2 border-emerald-500/70 hover:border-emerald-400 text-white relative overflow-hidden space-y-6 transition-all">
        <div
          onClick={() => setIsDailyScheduleExpanded(!isDailyScheduleExpanded)}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-5 cursor-pointer group/accordion"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/90 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-inner group-hover/accordion:scale-105 transition-transform">
              <Calendar size={22} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl font-black text-emerald-200 group-hover/accordion:text-emerald-300 transition-colors">
                  جدول وخطة حركة الدخول والخروج اليومية
                </h3>
                <span className="text-xs text-gray-300 font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10">
                  {isDailyScheduleExpanded ? 'انقر للطي' : 'انقر لعرض الجدول'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-bold mt-0.5">التفاصيل الكاملة لعملاء اليوم وغداً اضغط على اسم العميل لعرض السجل الكامل</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs font-black">
                🛬 وصول اليوم: {todaySchedule.in.length}
              </span>
              <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3.5 py-1.5 rounded-full text-xs font-black">
                🛫 مغادرة اليوم: {todaySchedule.out.length}
              </span>
            </div>

            <div className="w-10 h-10 rounded-xl bg-white/10 group-hover/accordion:bg-emerald-500 group-hover/accordion:text-black text-white flex items-center justify-center transition-all duration-300 shadow-md">
              {isDailyScheduleExpanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </div>
          </div>
        </div>

        {/* Detailed Operations Grid (Collapsible) */}
        {isDailyScheduleExpanded && (
          <div className="animate-fade-in grid lg:grid-cols-2 gap-6">

            {/* CHECK-INS TODAY */}
            <div className="bg-[#2A2723] rounded-2xl p-5 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-black text-sm text-emerald-400 flex items-center gap-2">
                  🛬 حركات وصول اليوم ({todaySchedule.in.length})
                </span>
                <span className="text-[10px] text-gray-400 font-bold">سياسة الدخول: 02:00 ظهراً</span>
              </div>

              {todaySchedule.in.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6 font-bold">لا يوجد حالات وصول مسجلة لليوم</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar-horizontal pr-1">
                  {todaySchedule.in.map((b: any, i: number) => {
                    const cleanP = formatWhatsAppNumber(b.phone);
                    return (
                      <div key={`in-${i}`} className="bg-[#1F1C18] p-4 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-emerald-500/40 transition-all">
                        <div className="space-y-1">
                          <button
                            onClick={() => openCustomerProfile(b.name, b.phone)}
                            className="text-base font-black text-white hover:text-[#C1A68D] transition-colors text-right flex items-center gap-1.5"
                          >
                            <User size={16} className="text-[#C1A68D]" />
                            <span>{b.name}</span>
                          </button>
                          <div className="flex items-center gap-3 text-xs text-gray-300 font-bold flex-wrap">
                            <span>🏠 الوحدة: <strong className="text-amber-400">{b.studio || b.apartmentId}</strong></span>
                            <span>📅 الفترة: <strong className="text-blue-300">{b.checkIn} ← {b.checkOut}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {b.totalAmount && (
                            <span className="bg-emerald-500/20 text-emerald-300 font-black text-xs px-3 py-1.5 rounded-xl border border-emerald-500/30">
                              {b.totalAmount} ج.م
                            </span>
                          )}
                          {b.phone && (
                            <a
                              href={`https://wa.me/${cleanP}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl text-xs font-black flex items-center justify-center shadow"
                              title="تواصل واتساب"
                            >
                              <MessageSquare size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CHECK-OUTS TODAY */}
            <div className="bg-[#2A2723] rounded-2xl p-5 border border-rose-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-black text-sm text-rose-400 flex items-center gap-2">
                  🛫 حركات مغادرة اليوم ({todaySchedule.out.length})
                </span>
                <span className="text-[10px] text-gray-400 font-bold">سياسة المغادرة: 12:00 ظهراً</span>
              </div>

              {todaySchedule.out.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6 font-bold">لا يوجد حالات مغادرة مسجلة لليوم</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar-horizontal pr-1">
                  {todaySchedule.out.map((b: any, i: number) => {
                    const cleanP = formatWhatsAppNumber(b.phone);
                    return (
                      <div key={`out-${i}`} className="bg-[#1F1C18] p-4 rounded-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-rose-500/40 transition-all">
                        <div className="space-y-1">
                          <button
                            onClick={() => openCustomerProfile(b.name, b.phone)}
                            className="text-base font-black text-white hover:text-[#C1A68D] transition-colors text-right flex items-center gap-1.5"
                          >
                            <User size={16} className="text-[#C1A68D]" />
                            <span>{b.name}</span>
                          </button>
                          <div className="flex items-center gap-3 text-xs text-gray-300 font-bold flex-wrap">
                            <span>🏠 الوحدة: <strong className="text-amber-400">{b.studio || b.apartmentId}</strong></span>
                            <span>📅 خروج: <strong className="text-rose-300">{b.checkOut}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {b.totalAmount && (
                            <span className="bg-rose-500/20 text-rose-300 font-black text-xs px-3 py-1.5 rounded-xl border border-rose-500/30">
                              {b.totalAmount} ج.م
                            </span>
                          )}
                          {b.phone && (
                            <a
                              href={`https://wa.me/${cleanP}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl text-xs font-black flex items-center justify-center shadow"
                              title="تواصل واتساب"
                            >
                              <MessageSquare size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── SECTION 4: TO-DO LIST & NOTES (جدول قائمة المهام والملاحظات) ── */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-[#EAE4D9] shadow-sm space-y-6 animate-fade-in">
        <div
          onClick={() => setIsTodoExpanded(!isTodoExpanded)}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EAE4D9]/60 pb-5 cursor-pointer group/todo"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2A2723] text-[#C1A68D] flex items-center justify-center font-black shadow-md group-hover/todo:scale-105 transition-transform">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl font-black text-[#2A2723]">
                  ملاحظات - To-Do List
                </h3>
                <span className="text-xs text-gray-500 font-bold bg-[#FDFBF7] px-3 py-1 rounded-full border border-[#EAE4D9]">
                  {isTodoExpanded ? 'انقر للطي' : 'انقر لعرض المهام'}
                </span>
              </div>
              <p className="text-xs text-[#7A7061] font-bold mt-0.5">
                قائمة المهام والملاحظات الخاصة بشيفتات الأدمين والأونر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
            <button
              onClick={() => router.push('/admin/dashboard/tasks')}
              className="bg-[#2A2723] hover:bg-[#C1A68D] hover:text-[#2A2723] text-white text-xs font-black px-3.5 py-1.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>📋 صفحة المهام الشاملة</span>
            </button>
            <span className="bg-emerald-50 text-emerald-700 border border-green-200 px-3 py-1.5 rounded-full text-xs font-black">
              🟢 تم التنفيذ: {todos.filter((t: any) => t.completed).length}
            </span>
            <span className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full text-xs font-black">
              🔴 لم يتم التنفيذ: {todos.filter((t: any) => !t.completed).length}
            </span>
            <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover/todo:bg-[#2A2723] group-hover/todo:text-white text-[#2A2723] flex items-center justify-center transition-all shadow-sm">
              {isTodoExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>

        {isTodoExpanded && (
          <div className="space-y-6 animate-fade-in">
            {/* Add New Todo Form (Allowed for Admin and Owner) */}
            {canManageTodo && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newTodoTitle.trim()) return;
                  setIsSavingTodo(true);
                  try {
                    const createdBy = getLoggedInAdminName();
                    const newTodo = await saveDbTodo({
                      title: newTodoTitle,
                      notes: newTodoNotes,
                      created_by: createdBy,
                    });
                    setTodos((current) => [newTodo, ...current]);
                    setNewTodoTitle('');
                    setNewTodoNotes('');
                  } catch (err: any) {
                    alert('فشل إضافة الملاحظة: ' + (err.message || 'خطأ غير معروف'));
                  } finally {
                    setIsSavingTodo(false);
                  }
                }}
                className="bg-[#FDFBF7] border border-[#EAE4D9] p-5 rounded-2xl space-y-4"
              >
                <div className="flex items-center gap-2 text-xs font-black text-[#2A2723]">
                  <span>➕ إضافة ملاحظة أو مهمة جديدة إلى القائمة</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="المهمة / الملاحظة بخط رفيع (مثلاً: الساعة 5 يتم تسليم استضافات للمهمات)..."
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    className="md:col-span-7 bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-xs font-normal text-[#2A2723] outline-none focus:border-[#C1A68D] transition-all"
                  />
                  <input
                    type="text"
                    placeholder="ملاحظة إضافية (اختياري)..."
                    value={newTodoNotes}
                    onChange={(e) => setNewTodoNotes(e.target.value)}
                    className="md:col-span-3 bg-white border border-[#EAE4D9] rounded-xl px-4 py-3 text-xs font-normal text-[#2A2723] outline-none focus:border-[#C1A68D] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isSavingTodo}
                    className="md:col-span-2 bg-[#2A2723] hover:bg-[#C1A68D] hover:text-[#2A2723] text-white font-black text-xs px-4 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>{isSavingTodo ? 'جاري الحفظ...' : '+ إضافة'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Todo List Table (Active / Pending Shift Tasks) */}
            <div className="overflow-x-auto rounded-2xl border border-[#EAE4D9]/80">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-[#2A2723] text-white font-black text-xs">
                    <th className="p-4 w-12 text-center">#</th>
                    <th className="p-4 w-36 text-center">حالة المهمة</th>
                    <th className="p-4">الملاحظة / المهمة (نشطة)</th>
                    <th className="p-4">ملاحظات إضافية</th>
                    <th className="p-4 w-28 text-center">بواسطة</th>
                    {canManageTodo && <th className="p-4 w-20 text-center">حذف</th>}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {todos.filter((t: any) => !t.completed).length === 0 ? (
                    <tr>
                      <td colSpan={canManageTodo ? 6 : 5} className="p-10 text-center text-gray-400 font-bold">
                        <div className="space-y-2">
                          <p className="text-sm font-black text-[#2A2723]">🎉 لا توجد مهام أو ملاحظات معلقة اليوم</p>
                          <p className="text-xs text-gray-400">جميع المهام تم تنفيذها بنجاح ومُرَحَّلَة تلقائياً إلى <button type="button" onClick={() => router.push('/admin/dashboard/tasks')} className="text-emerald-600 underline font-black">صفحة المهام الكاملة</button></p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    todos.filter((t: any) => !t.completed).map((item: any, idx: number) => (
                      <tr
                        key={item.id || idx}
                        className="border-t border-[#EAE4D9]/60 transition-colors hover:bg-[#FDFBF7]"
                      >
                        <td className="p-4 text-center font-bold text-[#7A7061]">{idx + 1}</td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            disabled={!canManageTodo}
                            onClick={async () => {
                              const newStatus = !item.completed;
                              const currentAdmin = getLoggedInAdminName();
                              setTodos((prev) =>
                                prev.map((t) => (t.id === item.id ? { ...t, completed: newStatus, completed_by: currentAdmin } : t))
                              );
                              await updateDbTodoStatus(item.id, newStatus, currentAdmin);
                            }}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                              item.completed
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95'
                            } ${!canManageTodo ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                          >
                            {item.completed ? (
                              <>
                                <CheckCircle2 size={14} />
                                <span>🟢 تم التنفيذ</span>
                              </>
                            ) : (
                              <>
                                <Clock size={14} />
                                <span>🔴 لم يتم التنفيذ</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-4">
                          <span className="text-xs md:text-sm font-normal text-[#2A2723]">
                            {item.title}
                          </span>
                        </td>
                        <td className="p-4 text-[#7A7061] font-normal text-xs">
                          {item.notes || '—'}
                        </td>
                        <td className="p-4 text-center text-gray-500 font-medium text-xs">
                          {item.created_by || 'Admin'}
                        </td>
                        {canManageTodo && (
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('هل تريد حذف هذه الملاحظة؟')) return;
                                setTodos((prev) => prev.filter((t) => t.id !== item.id));
                                await deleteDbTodo(item.id);
                              }}
                              title="حذف الملاحظة"
                              className="text-red-500 hover:text-red-700 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── UNIT INVENTORY TABLE & QUICK FILTERS ── */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-[#EAE4D9]/50 shadow-sm space-y-6">
        
        {/* Header Filters & Date Picker */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#EAE4D9]/40">
          <div className="space-y-1">
            <h4 className="font-black text-base text-[#2A2723]">
              {selectedCategory === 'all' ? '🗺️ جميع الوحدات والاستديوهات' : `🟢 وحدات ${inventoryStats.find(i => i.id === selectedCategory)?.label} المتاحة`}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="بحث عن ضيف أو وحدة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#F8F5F0] border border-[#EAE4D9] rounded-xl px-9 py-2 text-xs font-black text-[#2A2723] focus:ring-2 focus:ring-[#C1A68D] transition-all outline-none w-48"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            </div>

            {/* Smart Date Navigator */}
            <div className="flex items-center gap-2 bg-white border border-[#EAE4D9] rounded-2xl px-3 py-1.5 shadow-sm">
              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-lg"
              >◀️</button>
              
              <div className="relative group">
                <div className="flex flex-col items-center px-3 cursor-pointer">
                  <span className="text-[9px] font-black text-[#C1A68D] uppercase leading-none">تاريخ العرض</span>
                  <span className="text-xs font-black text-[#2A2723]">
                    {new Date(selectedDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
              </div>

              <button 
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-lg"
              >▶️</button>
            </div>

            {/* Category filters & Zoom In / Zoom Out Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 overflow-x-auto">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${selectedCategory === 'all' ? 'bg-[#2A2723] text-white shadow-md' : 'bg-gray-50 text-[#7A7061] hover:bg-gray-100'}`}
                >الكل</button>
                {inventoryStats.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedCategory(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${selectedCategory === item.id ? 'bg-[#C1A68D] text-white shadow-md' : 'bg-gray-50 text-[#7A7061] hover:bg-gray-100'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Table Zoom Controls */}
              <div className="flex items-center gap-1 bg-[#FDFBF7] p-1 rounded-xl border border-[#EAE4D9] shrink-0">
                <button
                  type="button"
                  onClick={() => setOverviewZoom((prev) => Math.max(50, prev - 15))}
                  className="bg-white hover:bg-rose-50 text-rose-600 border border-gray-200 p-1.5 rounded-lg font-black transition-all flex items-center gap-1 active:scale-90 text-[10px]"
                  title="تصغير جدول الاستعراض العام"
                >
                  <ZoomOut size={14} />
                  <span>زوم اوت (-)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOverviewZoom(75)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${
                    overviewZoom === 75
                      ? 'bg-[#2A2723] text-white border-[#2A2723]'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200'
                  }`}
                  title="عرض مصغر 75% للموبايل"
                >
                  75% (موبايل)
                </button>

                <button
                  type="button"
                  onClick={() => setOverviewZoom(100)}
                  className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${
                    overviewZoom === 100
                      ? 'bg-[#2A2723] text-white border-[#2A2723]'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border-gray-200'
                  }`}
                  title="عرض طبيعي 100%"
                >
                  100%
                </button>

                <button
                  type="button"
                  onClick={() => setOverviewZoom((prev) => Math.min(150, prev + 15))}
                  className="bg-white hover:bg-emerald-50 text-emerald-600 border border-gray-200 p-1.5 rounded-lg font-black transition-all flex items-center gap-1 active:scale-90 text-[10px]"
                  title="تكبير جدول الاستعراض العام"
                >
                  <ZoomIn size={14} />
                  <span>زوم ان (+)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Unit Table */}
        {(() => {
          const formatMiniDate = (d: string) => {
            if (!d || !d.includes('-')) return '—';
            const [y, m, day] = d.split('-');
            return `${day}/${m}`;
          };

          const displayList = apartmentMap.filter(apt => {
            if (!searchTerm) return true;
            const s = searchTerm.toLowerCase();
            const guestMatch = String(apt.guest || '').toLowerCase().includes(s);
            const idMatch = String(apt.id || '').toLowerCase().includes(s);
            const titleMatch = String(apt.title?.ar || '').toLowerCase().includes(s);
            const dateMatch = apt.checkOut?.includes(s) || (apt.checkOut && (() => {
              const [y, m, d] = apt.checkOut.split('-');
              return `${d}/${m}`.includes(s);
            })());
            return guestMatch || idMatch || titleMatch || dateMatch;
          });

          if (displayList.length === 0) {
            return <div className="h-40 flex items-center justify-center text-gray-300 animate-pulse font-black text-sm italic">لا يوجد وحدات مطابقة للبحث...</div>;
          }

          return (
            <div
              className="overflow-x-auto custom-scrollbar-horizontal pb-4 transition-all duration-300 origin-top-right"
              style={{
                fontSize: `${overviewZoom}%`,
                zoom: overviewZoom / 100,
                transform: `scale(${overviewZoom / 100})`,
                transformOrigin: 'right top',
                width: overviewZoom < 100 ? `${(100 / overviewZoom) * 100}%` : '100%',
              }}
            >
              <table className="w-full min-w-[650px] md:min-w-[1100px] border-collapse text-right">
                <thead>
                  <tr className="bg-[#2A2723] text-white text-xs font-black">
                    <th className="px-4 py-4 text-center w-12">#</th>
                    <th className="px-4 py-4">اسم الوحدة</th>
                    <th className="px-4 py-4 min-w-[180px]">اسم الضيف (اضغط للتفاصيل)</th>
                    <th className="px-4 py-4 min-w-[180px]">الملاحظات</th>
                    <th className="px-4 py-4 text-center">الحالة</th>
                    <th className="px-4 py-4 text-center">حجوزات قادمة</th>
                    <th className="px-4 py-4 text-center">تاريخ خروج آخر حجز</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4D9]/40 text-xs">
                  {[...displayList]
                    .sort((a, b) => {
                      const n = (u: any) => {
                        const id = String(u.id);
                        if (id.startsWith('b1-s')) return parseInt(id.replace('b1-s',''),10);
                        if (id.startsWith('b2-s')) return parseInt(id.replace('b2-s',''),10)+12;
                        if (id.startsWith('p-s')) return parseInt(id.replace('p-s',''),10);
                        if (id.startsWith('apt-')) return parseInt(id.replace('apt-',''),10)+30;
                        return 999;
                      };
                      return n(a) - n(b);
                    })
                    .map((apt) => {
                      const isB1 = String(apt.id).startsWith('b1-s');
                      const isB2 = String(apt.id).startsWith('b2-s');
                      const isPs = String(apt.id).startsWith('p-s');
                      const isExt = String(apt.id).startsWith('apt-');

                      const num = isB1 
                         ? parseInt(apt.id.replace('b1-s',''),10) 
                         : isB2 
                           ? parseInt(apt.id.replace('b2-s',''),10)+12 
                           : isPs 
                             ? parseInt(apt.id.replace('p-s',''),10) 
                             : isExt
                               ? parseInt(apt.id.replace('apt-',''),10)
                               : 0;

                      // 1) 24 Studios (Units 1 - 24): Soft Light Cream Beige
                      // 2) 6 Two-room Apartments (Units 25 - 30): Slightly Darker Warm Beige
                      // 3) 3 External Apartments: Muted Soft Café Light
                      const isStudio24 = isB1 || isB2 || (num >= 1 && num <= 24 && !isPs && !isExt);
                      const isApt6 = isPs || (num >= 25 && num <= 30 && !isExt);

                      const rowBg = isStudio24
                        ? 'bg-[#FAF6F0] hover:bg-[#F4ECE2] border-r-4 border-r-[#C1A68D]'
                        : isApt6
                        ? 'bg-[#EFE6D8] hover:bg-[#E6DAC7] border-r-4 border-r-[#A3866A]'
                        : 'bg-[#E2D4C3] hover:bg-[#D7C6B2] border-r-4 border-r-[#8C6D53]';

                      const badgeColor = isStudio24
                        ? 'bg-[#C1A68D] text-white font-black shadow-sm'
                        : isApt6
                        ? 'bg-[#A3866A] text-white font-black shadow-sm'
                        : 'bg-[#8C6D53] text-white font-black shadow-sm';

                      return (
                        <tr key={apt.id} className={`${rowBg} transition-colors`}>
                          <td className="px-4 py-3 text-center">
                            <button 
                              onClick={() => handleUnitClick(apt)}
                              className={`${badgeColor} w-8 h-8 rounded-full flex items-center justify-center text-xs font-black mx-auto hover:scale-110 transition-transform shadow-sm`}
                              title="عرض التقرير المالي"
                            >
                              {num}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-black text-[#2A2723] text-xs md:text-sm">
                            <button 
                              onClick={() => handleUnitClick(apt)}
                              className="hover:text-[#C1A68D] transition-colors"
                            >
                              {apt.title?.ar || apt.id}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-black text-sm text-[#2A2723]">
                            {apt.isTurnover ? (
                              <div className="flex flex-col gap-1.5 items-start justify-center">
                                <button
                                  onClick={() => openCustomerProfile(apt.leavingGuest, apt.leavingPhone)}
                                  className="text-rose-600 hover:underline font-black text-xs text-right truncate max-w-[160px]"
                                >
                                  🛫 {apt.leavingGuest}
                                </button>
                                <button
                                  onClick={() => openCustomerProfile(apt.arrivingGuest, apt.arrivingPhone)}
                                  className="text-blue-600 hover:underline font-black text-xs text-right truncate max-w-[160px]"
                                >
                                  🛬 {apt.arrivingGuest}
                                </button>
                              </div>
                            ) : apt.guest ? (
                              <button
                                onClick={() => openCustomerProfile(apt.guest, apt.phone)}
                                className="hover:text-[#C1A68D] text-[#2A2723] transition-colors flex items-center gap-1.5 font-black text-sm text-right"
                              >
                                <User size={15} className="text-[#C1A68D] shrink-0" />
                                <span>{apt.guest}</span>
                              </button>
                            ) : (
                              <span className="text-gray-300 font-normal">—</span>
                            )}
                          </td>

                          {/* NOTES COLUMN */}
                          <td className="px-4 py-3 text-xs font-bold text-[#7A7061] max-w-[220px]">
                            {apt.notes ? (
                              <button
                                onClick={() => setActiveNoteModal({ isOpen: true, text: apt.notes, title: `ملاحظات ${apt.title?.ar || apt.id}` })}
                                className="truncate block w-full text-right bg-amber-100/80 border border-amber-300/60 px-3 py-1.5 rounded-xl text-amber-900 font-bold hover:bg-amber-200/80 transition-all shadow-sm"
                                title="اضغط لقراءة الملاحظة كاملة"
                              >
                                📝 {apt.notes}
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>

                          {/* STATUS COLUMN (RIGHT AFTER NOTES) */}
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-black px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap ${
                              apt.isExtension ? 'bg-purple-600 text-white' :
                              apt.isTurnover ? 'bg-orange-500 text-white animate-pulse' :
                              apt.isCheckingOut ? 'bg-rose-600 text-white font-black' :
                              apt.isCheckingOutTomorrow ? 'bg-amber-500 text-white font-black' :
                              apt.isCheckingIn ? 'bg-blue-600 text-white font-black' :
                              apt.status === 'صيانة' ? 'bg-gray-100 text-gray-500' : 
                              apt.isOccupied ? 'bg-red-100 text-red-700' : 
                              'bg-emerald-100 text-emerald-800'
                            }`}>
                              {apt.isExtension ? '🔁 تمديد اليوم' :
                               apt.isTurnover ? '🔄 تبادل اليوم' : 
                               apt.isCheckingOut ? '🛫 خروج اليوم' :
                               apt.isCheckingOutTomorrow ? `🛫 خروج غداً (${formatMiniDate(apt.checkOut || apt.leavingCheckOut)})` :
                               apt.isCheckingIn ? '🛬 وصول اليوم' :
                               apt.isOccupied ? (apt.checkOut ? `مشغول (خروج: ${formatMiniDate(apt.checkOut)})` : 'مشغول') : 
                               apt.status === 'صيانة' ? 'صيانة' : 
                               'متاح'}
                            </span>
                          </td>

                          {/* UPCOMING BOOKINGS COUNT */}
                          <td className="px-4 py-3 text-center">
                            {apt.upcomingBookingsCount > 0 ? (
                              <span className="text-xs font-black text-white bg-blue-500 shadow-sm px-3 py-1 rounded-lg">
                                {apt.upcomingBookingsCount}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-gray-400">—</span>
                            )}
                          </td>

                          {/* LAST BOOKING CHECK-OUT DATE (VERY LAST COLUMN) */}
                          <td className="px-4 py-3 text-xs text-center text-[#2A2723] font-black">
                            {apt.finalCheckOut ? (
                              <div className="flex flex-col items-center gap-1 min-w-[150px]">
                                <span className="bg-amber-100 border border-amber-300 text-amber-950 font-black px-2.5 py-1 rounded-lg text-xs shadow-sm whitespace-nowrap">
                                  🗓️ آخر خروج: {formatMiniDate(apt.finalCheckOut)}
                                </span>
                                {apt.upcomingThree && apt.upcomingThree.length > 0 && (
                                  <div className="flex flex-col gap-1 w-full text-[10px] font-bold mt-0.5">
                                    {apt.upcomingThree.map((b: any, idx: number) => (
                                      <div 
                                        key={b.id || idx} 
                                        className="bg-white/90 border border-gray-200 px-2 py-0.5 rounded text-gray-700 flex items-center justify-between gap-1 shadow-2xs"
                                        title={`حجز ${idx + 1}: ${b.name || 'ضيف'} (${b.checkIn} ➔ ${b.checkOut})`}
                                      >
                                        <span className="text-[#C1A68D] font-black">#{idx + 1}</span>
                                        <span>{formatMiniDate(b.checkIn)} ➔ {formatMiniDate(b.checkOut)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {apt.daysUntilNextBooking !== null && apt.daysUntilNextBooking > 0 && (
                                  <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md mt-0.5 whitespace-nowrap shadow-sm">
                                    متاح {apt.daysUntilNextBooking} يوم حتى الحجز القادم
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                {apt.lastCheckOut ? <span className="text-gray-400 font-bold opacity-60">آخر: {formatMiniDate(apt.lastCheckOut)}</span> : <span>—</span>}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* ── CUSTOMER PROFILE MODAL ── */}
      <CustomerProfileModal
        isOpen={profileModal.isOpen}
        customerName={profileModal.name}
        customerPhone={profileModal.phone}
        bookings={allBookings}
        onClose={() => setProfileModal({ isOpen: false, name: null })}
        onRefresh={loadOverviewData}
      />

      {/* ── FULL NOTE VIEWER MODAL ── */}
      {activeNoteModal.isOpen && (
        <div className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#1F1C18] border border-[#C1A68D]/40 rounded-[2rem] p-6 max-w-lg w-full text-white space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActiveNoteModal({ isOpen: false, text: '' })}
              className="absolute top-4 left-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[#C1A68D] font-black text-sm">
              <FileText size={18} />
              <span>{activeNoteModal.title || 'الملاحظات الكاملة'}</span>
            </div>

            <div className="bg-[#2A2723] p-4 rounded-xl border border-white/10 text-xs md:text-sm font-bold leading-relaxed text-amber-200 max-h-60 overflow-y-auto">
              {activeNoteModal.text}
            </div>

            <button
              onClick={() => setActiveNoteModal({ isOpen: false, text: '' })}
              className="w-full bg-[#C1A68D] text-white font-black py-2.5 rounded-xl hover:opacity-90 transition-all text-xs"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ── RECEIPT VIEWER MODAL ── */}
      <ReceiptImageModal
        isOpen={activeReceiptModal.isOpen}
        url={activeReceiptModal.url}
        guestName={activeReceiptModal.name}
        onClose={() => setActiveReceiptModal({ isOpen: false, url: null })}
      />

    </div>
  );
}
