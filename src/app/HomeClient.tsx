'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AvailabilityBanner from '@/components/AvailabilityBanner';
import BranchCard from '@/components/BranchCard';
import { useLanguage } from '@/lib/LanguageContext';
import { 
  BuildingOffice2Icon, 
  DocumentTextIcon, 
  BookOpenIcon, 
  CalendarDaysIcon, 
  DevicePhoneMobileIcon,
  MapPinIcon,
  SparklesIcon,
  XMarkIcon
} from '@heroicons/react/24/solid';

// ─── Quick Nav Items ────────────────────────────────────────────────
const NAV_BOXES = [
  { icon: BuildingOffice2Icon, label: 'عن مزار',        href: '/mazar/about',        color: 'from-amber-50 to-orange-50',   border: 'border-amber-200',  text: 'text-amber-800'  },
  { icon: DocumentTextIcon,  label: 'قوانين الإقامة', href: '/mazar/rules',        color: 'from-blue-50 to-sky-50',       border: 'border-blue-200',   text: 'text-blue-800'   },
  { icon: BookOpenIcon,  label: 'كيفية الحجز',    href: '/mazar/how-to-book',  color: 'from-violet-50 to-purple-50',  border: 'border-violet-200', text: 'text-violet-800' },
  { icon: CalendarDaysIcon, label: 'ابدأ الحجز الان',      href: '/mazar/book',         color: 'from-green-50 to-emerald-50',  border: 'border-green-200',  text: 'text-green-800'  },
  { icon: DevicePhoneMobileIcon, label: 'السوشيال ميديا', href: '/social',             color: 'from-indigo-50 to-blue-50',    border: 'border-indigo-200', text: 'text-indigo-800' },
  { icon: MapPinIcon, label: 'مواقع مزار (اللوكيشن)', onClickType: 'locations', color: 'from-rose-50 to-red-50', border: 'border-rose-200', text: 'text-rose-800' },
  { icon: SparklesIcon, label: 'محتويات الغرف الفندقية', onClickType: 'amenities', color: 'from-amber-50 to-yellow-50', border: 'border-amber-200', text: 'text-amber-800' },
];

// ─── Branch 1 Images ────────────────────────────────────────────────
const BRANCH1_IMAGES = [
  '/images/mazar1/mazar1-hero.jpg',
  '/images/mazar1/2026-1.jpeg',
  '/images/mazar1/2026.jpeg',
  '/images/mazar1/WhatsApp-Image-2025-12-15-at-12.39.16_ff8ccd08.jpg',
  '/images/mazar1/WhatsApp-Image-2025-12-15-at-12.39.24_989640c4.jpg',
  '/images/mazar1/WhatsApp-Image-2025-12-15-at-12.39.25_2995ad23.jpg',
];

// ─── Branch 2 Images ────────────────────────────────────────────────
const BRANCH2_IMAGES = [
  '/images/mazar2/20260218_015423.jpg',
  '/images/mazar2/20260218_015425.jpg',
  '/images/mazar2/20260218_023924.jpg',
  '/images/mazar2/20260218_171702.jpg',
  '/images/mazar2/20260218_183029.jpg',
  '/images/mazar2/20260218_185108.jpg',
];

// ─── External Apartments ────────────────────────────────────────────
const EXTERNAL_APARTMENTS = [
  {
    id: 'ext-1',
    title: 'شقة فاخرة 1 - زكي رستم',
    address: 'عمارة 7أ زكي رستم - متفرع من حسنين هيكل- عباس العقاد - بجوار قهوة مصر',
    mapsUrl: 'https://maps.google.com/?q=7A+Zaki+Rostom+Abbas+El+Akkad+Nasr+City+Cairo',
    price: 'يبدأ من 4000 ج.م / الليلة',
    images: [
      '/images/apt1/apt1-1.jpg',
      '/images/apt1/apt1-2.jpg',
      '/images/apt1/apt1-3.jpg',
      '/images/apt1/apt1-4.jpg',
      '/images/apt1/apt1-5.jpg',
      '/images/apt1/apt1-6.jpg',
      '/images/apt1/apt1-7.jpg',
      '/images/apt1/apt1-8.jpg',
      '/images/apt1/apt1-9.jpg',
      '/images/apt1/apt1-10.jpg',
      '/images/apt1/apt1-11.jpg',
      '/images/apt1/apt1-12.jpg',
      '/images/apt1/apt1-13.jpg',
      '/images/apt1/apt1-14.jpg',
      '/images/apt1/apt1-15.jpg',
      '/images/apt1/apt1-16.jpg',
    ],
    videoSrc: '/images/video/apartment-26.mp4',
    browseHref: '/mazar/units/apt-1',
    unitId: 'apt-1',
  },
  {
    id: 'ext-2',
    title: 'شقة فاخرة 2 - سيتي ستارز',
    address: 'عمائر المدفعية - تطل علي سيتي ستارز مباشرة',
    mapsUrl: 'https://maps.google.com/?q=City+Stars+Nasr+City+Cairo',
    price: 'يبدأ من 4000 ج.م / الليلة',
    images: [
      '/images/apt2/apt2-1.jpg',
      '/images/apt2/apt2-2.jpg',
      '/images/apt2/apt2-3.jpg',
      '/images/apt2/apt2-4.jpg',
      '/images/apt2/apt2-5.jpg',
      '/images/apt2/apt2-6.jpg',
      '/images/apt2/apt2-7.jpg',
      '/images/apt2/apt2-8.jpg',
      '/images/apt2/apt2-9.jpg',
      '/images/apt2/apt2-10.jpg',
      '/images/apt2/apt2-11.jpg',
      '/images/apt2/apt2-12.jpg',
      '/images/apt2/apt2-13.jpg',
      '/images/apt2/apt2-14.jpg',
      '/images/apt2/apt2-15.jpg',
      '/images/apt2/apt2-16.jpg',
      '/images/apt2/apt2-17.jpg',
      '/images/apt2/apt2-18.jpg',
      '/images/apt2/apt2-19.jpg',
      '/images/apt2/apt2-20.jpg',
      '/images/apt2/apt2-21.jpg',
      '/images/apt2/apt2-22.jpg',
      '/images/apt2/apt2-23.jpg',
      '/images/apt2/apt2-24.jpg',
      '/images/apt2/apt2-25.jpg',
      '/images/apt2/apt2-26.jpg',
      '/images/apt2/apt2-27.jpg',
      '/images/apt2/apt2-28.jpg',
    ],
    videoSrc: '/images/video/apartment-26.mp4',
    browseHref: '/mazar/units/apt-2',
    unitId: 'apt-2',
  },
  {
    id: 'ext-3',
    title: 'شقة فاخرة 3 - عباس الرئيسي',
    address: 'شارع محمد مصطفي حمام - امام مستشفي العقاد - مطلة علي عباس العقاد الرئيسي',
    mapsUrl: 'https://maps.google.com/?q=Mohamed+Mostafa+Hamam+Abbas+El+Akkad+Nasr+City+Cairo',
    price: 'يبدأ من 4000 ج.م / الليلة',
    images: [
      '/images/apt3/apt3-1.jpg',
      '/images/apt3/apt3-2.jpg',
      '/images/apt3/apt3-3.jpg',
      '/images/apt3/apt3-4.jpg',
      '/images/apt3/apt3-5.jpg',
      '/images/apt3/apt3-6.jpg',
      '/images/apt3/apt3-7.jpg',
      '/images/apt3/apt3-8.jpg',
      '/images/apt3/apt3-9.jpg',
      '/images/apt3/apt3-10.jpg',
    ],
    videoSrc: '/images/video/apartment-26.mp4',
    browseHref: '/mazar/units/apt-3',
    unitId: 'apt-3',
  },
];

// ─── External Apartment Card ─────────────────────────────────────────
function ExternalApartmentCard({ apt }: { apt: typeof EXTERNAL_APARTMENTS[0] }) {
  const [activeMedia, setActiveMedia] = useState<'image' | 'video'>('image');
  const [activeImg, setActiveImg] = useState(0);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group bg-white border border-[#EAE4D9] rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between" dir="rtl">
      {/* Media */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F0EBE3]">
        {/* Toggle Buttons */}
        {apt.videoSrc && (
          <div className="absolute top-3 left-3 z-20 flex gap-1.5">
            <button
              onClick={() => setActiveMedia('image')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${
                activeMedia === 'image'
                  ? 'bg-white text-[#2A2723] shadow-md'
                  : 'bg-black/50 text-white backdrop-blur-sm'
              }`}
            >
              📸 صور
            </button>
            <button
              onClick={() => setActiveMedia('video')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-black transition-all ${
                activeMedia === 'video'
                  ? 'bg-white text-[#2A2723] shadow-md'
                  : 'bg-black/50 text-white backdrop-blur-sm'
              }`}
            >
              🎬 فيديو
            </button>
          </div>
        )}

        {apt.videoSrc && activeMedia === 'video' ? (
          <video
            src={encodeURI(apt.videoSrc)}
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <img
              src={!imgError ? apt.images[activeImg] : apt.images[0]}
              alt={apt.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          </>
        )}
      </div>

      {/* Thumbnail Strip */}
      {activeMedia === 'image' && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-[#FDFBF7] border-b border-[#EAE4D9]">
          {apt.images.slice(0, 8).map((img, i) => (
            <button
              key={i}
              onClick={() => { setActiveImg(i); setImgError(false); }}
              className={`flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                activeImg === i ? 'border-[#C1A68D] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="p-5 space-y-3">
        <h4 className="text-xl font-black text-[#2A2723]">{apt.title}</h4>

        <a
          href={apt.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-bold text-[#7A7061] hover:text-[#C1A68D] transition-colors mb-2"
        >
          <span>📍</span>
          <span>{apt.address}</span>
          <span className="text-[10px] underline">فتح الخريطة</span>
        </a>

        {/* Price Tag */}
        <div className="flex items-center gap-2 bg-green-50 text-green-700 font-bold px-4 py-2 rounded-xl text-sm border border-green-100">
          <span>💰</span>
          <span>{apt.price}</span>
        </div>

        <Link
          href={apt.browseHref}
          className="flex items-center justify-center gap-2 w-full bg-[#2A2723] hover:bg-black text-white font-black py-3 rounded-xl text-sm transition-all active:scale-95"
        >
          <span>عرض الشقة وحجزها</span>
          <span>←</span>
        </Link>
      </div>
    </div>
  );
}

// ─── Section Divider ─────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 w-full" dir="rtl">
      <div className="flex-1 h-px bg-gradient-to-l from-[#EAE4D9] to-transparent" />
      <div className="bg-[#2A2723] text-white text-sm font-black px-6 py-2 rounded-full shrink-0">
        {label}
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-[#EAE4D9] to-transparent" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function HomeClient() {
  const { t, isRTL } = useLanguage();
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main
      className="min-h-screen bg-[#FDFBF7] text-[#2A2723] overflow-x-hidden relative"
      dir="rtl"
    >
      {/* ── Ambient Glows ── */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-[#C1A68D]/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-[#EAE4D9]/30 rounded-full blur-[100px] -z-10 pointer-events-none" />



      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative w-full min-h-[50vh] flex flex-col items-center justify-center text-center pt-10 pb-14 px-4 overflow-hidden"
      >
        {/* Decorative rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
          <div className="w-[900px] h-[900px] rounded-full border-[3px] border-[#C1A68D]" />
          <div className="absolute w-[600px] h-[600px] rounded-full border-[2px] border-[#C1A68D]" />
        </div>

        {/* Background watermark logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
          <Logo size={500} imageClassName="w-[600px] h-auto" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          {/* Tagline pill */}
          <div className="inline-flex items-center gap-2 bg-[#C1A68D]/10 border border-[#C1A68D]/30 text-[#C1A68D] text-[11px] font-black px-5 py-2 rounded-full uppercase tracking-widest mb-6 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-[#C1A68D] animate-pulse"></span>
            مدينة نصر، القاهرة
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-[#2A2723] leading-none tracking-tighter mb-4 animate-slide-up">
            مجمع مزار
          </h1>

          {/* Sub-headline */}
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-[#5C554B] tracking-tight mb-4 max-w-3xl mx-auto leading-relaxed animate-slide-up delay-100">
            أكبر مجمع سكني فندقي في مدينة نصر
          </h2>

          {/* Descriptive text clarifying the location & luxury experience */}
          <p className="text-sm sm:text-base md:text-lg text-[#7A7061] font-bold max-w-2xl mx-auto mb-8 leading-relaxed px-2">
            إقامة فندقية متكاملة تجمع بين الفخامة والخصوصية والهدوء التام في قلب مدينة نصر، بالقرب من سيتي ستارز وأهم معالم ومطاعم العاصمة.
          </p>

          {/* Stats Box - مستطيل الوحدات الموسع والأشمل */}
          <div className="bg-white/80 backdrop-blur-md border border-[#EAE4D9] rounded-3xl p-6 md:p-8 shadow-sm animate-fade-in delay-200 max-w-4xl mx-auto w-[95%] md:w-full space-y-3.5">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <span className="bg-[#2A2723] text-white font-black text-xs sm:text-sm md:text-base px-4 py-1.5 rounded-full shadow-sm">
                🏢 2 فرع رئيسي + شقق فندقية خارجية
              </span>
              <span className="bg-[#C1A68D]/15 text-[#8C6D4F] border border-[#C1A68D]/30 font-black text-xs sm:text-sm px-4 py-1.5 rounded-full">
                🔑 أكثر من 30 وحدة فندقية مجهزة بالكامل
              </span>
            </div>
            <p className="text-sm sm:text-base md:text-lg font-black text-[#2A2723] text-center leading-relaxed">
              ستوديو فندقي فاخر (سنجل / دبل / تريبل) • شقة غرفة وصالة • شقق فندقية غرفتين • شقق عائلية 3 غرف
            </p>
            <p className="text-xs sm:text-sm text-[#7A7061] font-bold text-center">
              مفروشة بالكامل بأرقى الديكورات وأحدث الأجهزة الفندقية والشاشات السمارت والتكييفات والمطابخ
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          QUICK NAV BOXES — المستطيلات التفاعلية (7 مربعات)
      ══════════════════════════════════════════════════════════════ */}
      <section className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-wrap justify-center items-stretch gap-3 md:gap-4 w-full">
          {NAV_BOXES.map((box: any) => {
            const innerContent = (
              <>
                <div className="transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                  <box.icon className="w-14 h-14 md:w-16 md:h-16 drop-shadow-md mb-2" />
                </div>
                <span className={`text-xs md:text-sm lg:text-base font-black ${box.text} leading-tight`}>
                  {box.label}
                </span>
              </>
            );

            if (box.onClickType) {
              return (
                <button
                  key={box.label}
                  type="button"
                  onClick={() => {
                    if (box.onClickType === 'locations') setShowLocationsModal(true);
                    if (box.onClickType === 'amenities') setShowAmenitiesModal(true);
                  }}
                  className={`group flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${box.color} border ${box.border} rounded-2xl p-4 md:p-5 text-center transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer w-[calc(50%-0.5rem)] sm:w-[calc(33.33%-0.75rem)] md:w-[155px] lg:flex-1 lg:max-w-[200px]`}
                >
                  {innerContent}
                </button>
              );
            }

            return (
              <Link
                key={box.label}
                href={box.href}
                className={`group flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${box.color} border ${box.border} rounded-2xl p-4 md:p-5 text-center transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 w-[calc(50%-0.5rem)] sm:w-[calc(33.33%-0.75rem)] md:w-[155px] lg:flex-1 lg:max-w-[200px]`}
              >
                {innerContent}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          AVAILABILITY BANNER — احجز وحدتك
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-b from-white to-[#FDFBF7] border-y border-[#EAE4D9]">
        <AvailabilityBanner />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          BROWSE UNITS — تصفح وحدات المزار الفندقية
      ══════════════════════════════════════════════════════════════ */}
      <section id="browse-units" className="w-full max-w-7xl mx-auto px-4 md:px-6 py-16 space-y-12" dir="rtl">

        {/* Section Header */}
        <div className="text-center space-y-3">

          <h2 className="text-3xl md:text-5xl font-black text-[#2A2723] tracking-tight">
            تصفح وحدات مزار الفندقية
          </h2>
          <p className="text-[#7A7061] font-bold text-sm md:text-base max-w-xl mx-auto">
            فرعان رئيسيان وشقق خارجية مجهزة بالكامل في قلب مدينة نصر
          </p>
        </div>

        {/* ─── الفرع الأول ─── */}
        <SectionDivider label="🏨 الفرع الأول — مزار 1" />

        <BranchCard
          branchNumber={1}
          title="مزار 1 — الفرع الأول"
          subtitle="12 استوديو فندقي متنوع بين سنجل ودبل وتريبل، مجهزة بالكامل بأحدث التقنيات"
          address="مدينة نصر، القاهرة — الفرع الأول"
          mapsUrl="https://maps.google.com/?q=Mazar+Nasr+City+Cairo+Branch+1"
          heroImage={BRANCH1_IMAGES[0]}
          galleryImages={BRANCH1_IMAGES}
          unitCount={12}
          unitLabel="استوديو"
          videoSrc="/images/video/studio-1.mp4"
          browseHref="/mazar/units/studios?branch=1"
          accentColor="#C1A68D"
        />

        {/* ─── الفرع الثاني ─── */}
        <SectionDivider label="🏨 الفرع الثاني — مزار 2" />

        <BranchCard
          branchNumber={2}
          title="مزار 2 — الفرع الثاني"
          subtitle="12 استوديو بريميوم + 6 شقق غرفتين عائلية، مجهزة بأحدث المعايير الفندقية"
          address="مدينة نصر، القاهرة — الفرع الثاني"
          mapsUrl="https://maps.google.com/?q=Mazar+Nasr+City+Cairo+Branch+2"
          heroImage={BRANCH2_IMAGES[0]}
          galleryImages={BRANCH2_IMAGES}
          videoSrc="/images/mazar2/mazar2-video.mp4"
          unitCount={18}
          unitLabel="وحدة"
          browseHref="/mazar/units/studios?branch=2"
          accentColor="#8B7355"
        />

        {/* ─── شقق مزار الخارجية ─── */}
        <div className="mt-16">
          <SectionDivider label="🏡 شقق مزار الخارجية" />
          <div className="space-y-4 mt-8">
            <p className="text-[#7A7061] font-bold text-sm text-right">
              3 شقق خارجية فاخرة ومجهزة بالكامل — كل شقة بصور وفيديو وموقع على الخريطة
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {EXTERNAL_APARTMENTS.map((apt) => (
                <ExternalApartmentCard key={apt.id} apt={apt} />
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* ══════════════════════════════════════════════════════════════
          FOOTER CTA
      ══════════════════════════════════════════════════════════════ */}
      <section className="w-full bg-[#2A2723] text-white py-16 px-4 text-center" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="text-4xl mb-2">🌟</div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">جاهز تحجز؟</h2>
          <p className="text-white/70 font-bold text-sm md:text-base">
            احجز وحدتك الفندقية في مزار الآن واستمتع بأفضل إقامة في مدينة نصر
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href="/mazar/book"
              className="bg-[#C1A68D] hover:bg-[#A68D74] text-white font-black px-10 py-4 rounded-full text-base transition-all hover:scale-105 hover:shadow-xl active:scale-95"
            >
              احجز الآن
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          MODALS — نافذة مواقع مزار ومحتويات الغرف
      ══════════════════════════════════════════════════════════════ */}

      {/* 1. نافذة مواقع مزار (اللوكيشن والخرائط) */}
      {showLocationsModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#1C1A17] border border-[#C1A68D]/40 rounded-3xl max-w-2xl w-full p-6 text-white max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl">
                  📍
                </span>
                <div>
                  <h3 className="text-xl font-black text-white">مواقع وفروع مزار في مدينة نصر</h3>
                  <p className="text-xs text-[#C1A68D] font-bold mt-0.5">اضغط على أي فرع لفتح موقعه المباشر على Google Maps</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationsModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* فرع 1 */}
              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#C1A68D]/50 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#C1A68D] text-[#1A1815] text-[10px] font-black px-2.5 py-0.5 rounded-full">الفرع الرئيسي</span>
                    <h4 className="font-black text-base text-white">مزار 1 — الفرع الأول</h4>
                  </div>
                  <p className="text-xs text-gray-300 font-bold">مدينة نصر، القاهرة • 12 استوديو فندقي فاخر</p>
                </div>
                <a
                  href="https://maps.google.com/?q=Mazar+Nasr+City+Cairo+Branch+1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
                >
                  <span>📍 فتح في Google Maps</span>
                </a>
              </div>

              {/* فرع 2 */}
              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#C1A68D]/50 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#8B7355] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">فرع بريميوم</span>
                    <h4 className="font-black text-base text-white">مزار 2 — الفرع الثاني</h4>
                  </div>
                  <p className="text-xs text-gray-300 font-bold">مدينة نصر، القاهرة • 18 وحدة فندقية (استوديوهات وشقق غرفتين)</p>
                </div>
                <a
                  href="https://maps.google.com/?q=Mazar+Nasr+City+Cairo+Branch+2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
                >
                  <span>📍 فتح في Google Maps</span>
                </a>
              </div>

              {/* شقة 1 */}
              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#C1A68D]/50 transition-all">
                <div className="space-y-1">
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30">شقة فندقية فاخرة</span>
                  <h4 className="font-black text-base text-white">شقة 1 — زكي رستم</h4>
                  <p className="text-xs text-gray-300 font-bold">عمارة 7أ زكي رستم - متفرع من حسنين هيكل وعباس العقاد - بجوار قهوة مصر</p>
                </div>
                <a
                  href="https://maps.google.com/?q=7A+Zaki+Rostom+Abbas+El+Akkad+Nasr+City+Cairo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
                >
                  <span>📍 فتح في Google Maps</span>
                </a>
              </div>

              {/* شقة 2 */}
              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#C1A68D]/50 transition-all">
                <div className="space-y-1">
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30">شقة تطل على سيتي ستارز</span>
                  <h4 className="font-black text-base text-white">شقة 2 — سيتي ستارز</h4>
                  <p className="text-xs text-gray-300 font-bold">عمائر المدفعية - تطل على مول سيتي ستارز مباشرة</p>
                </div>
                <a
                  href="https://maps.google.com/?q=City+Stars+Nasr+City+Cairo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
                >
                  <span>📍 فتح في Google Maps</span>
                </a>
              </div>

              {/* شقة 3 */}
              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#C1A68D]/50 transition-all">
                <div className="space-y-1">
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30">شقة فندقية عائلية</span>
                  <h4 className="font-black text-base text-white">شقة 3 — عباس الرئيسي</h4>
                  <p className="text-xs text-gray-300 font-bold">شارع محمد مصطفى حمام - متفرع من شارع عباس العقاد الرئيسي</p>
                </div>
                <a
                  href="https://maps.google.com/?q=Mohamed+Mostafa+Hamam+Abbas+El+Akkad+Nasr+City+Cairo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shrink-0"
                >
                  <span>📍 فتح في Google Maps</span>
                </a>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowLocationsModal(false);
                  document.getElementById('browse-units')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-[#C1A68D] hover:bg-[#A68D74] text-[#1A1815] font-black text-xs px-6 py-2.5 rounded-xl transition-all shadow"
              >
                تصفح صور وتفاصيل الوحدات بالصفحة ↓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. نافذة محتويات وتجهيزات الغرف الفندقية */}
      {showAmenitiesModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
          <div className="bg-[#1C1A17] border border-amber-500/30 rounded-3xl max-w-3xl w-full p-6 text-white max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
                  ✨
                </span>
                <div>
                  <h3 className="text-xl font-black text-white">محتويات وتجهيزات الغرف الفندقية</h3>
                  <p className="text-xs text-[#C1A68D] font-bold mt-0.5">كافة وحدات مزار مجهزة بالكامل ومفروشة بأعلى المعايير الفندقية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAmenitiesModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 space-y-1.5">
                <div className="text-2xl mb-1">🛏️</div>
                <h4 className="font-black text-sm text-amber-200">مراتب ومفروشات فندقية معقمة</h4>
                <p className="text-xs text-gray-300 leading-relaxed">مراتب طبية مريحة جداً، وبياضات وملايات قطنية 100% معقمة ومخدات فندقية ناعمة تضمن لك نوم عميق ومريح.</p>
              </div>

              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 space-y-1.5">
                <div className="text-2xl mb-1">❄️</div>
                <h4 className="font-black text-sm text-blue-200">تكييفات هواء حديثة مستقلة</h4>
                <p className="text-xs text-gray-300 leading-relaxed">تكييفات كاريير وشارب حديثة وباردة في كل غرفة مع ريموت كنترول للتحكم الكامل وضمان الهدوء التام.</p>
              </div>

              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 space-y-1.5">
                <div className="text-2xl mb-1">📺</div>
                <h4 className="font-black text-sm text-purple-200">شاشات ذكية Smart TV</h4>
                <p className="text-xs text-gray-300 leading-relaxed">شاشات مسطحة حديثة عالية الدقة تدعم تطبيق نتفليكس، يوتيوب، والقنوات التلفزيونية الفضائية لمشاهدة ممتعة.</p>
              </div>

              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 space-y-1.5">
                <div className="text-2xl mb-1">📶</div>
                <h4 className="font-black text-sm text-emerald-200">إنترنت Wi-Fi فائق السرعة</h4>
                <p className="text-xs text-gray-300 leading-relaxed">شبكة إنترنت لاسلكية خاصة وسريعة وغير محدودة في كل وحدة تناسب العمل عن بُعد والبث المباشر.</p>
              </div>

              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 space-y-1.5">
                <div className="text-2xl mb-1">🍳</div>
                <h4 className="font-black text-sm text-orange-200">ميني كيتشن متكامل الأجهزة</h4>
                <p className="text-xs text-gray-300 leading-relaxed">مجهز بثلاجة، ميكروويف، غلاية كهربائية (كاتل)، طقم أطباق وكاسات، ومستلزمات عمل الشاي والقهوة.</p>
              </div>

              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 space-y-1.5">
                <div className="text-2xl mb-1">🚿</div>
                <h4 className="font-black text-sm text-cyan-200">حمام فندقي خاص متكامل</h4>
                <p className="text-xs text-gray-300 leading-relaxed">كابينة شاور زجاجية، مياه ساخنة فورية، طقم مناشف بيضاء معقمة، ومستلزمات عناية شخصية.</p>
              </div>

              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 space-y-1.5">
                <div className="text-2xl mb-1">🧹</div>
                <h4 className="font-black text-sm text-teal-200">خدمة نظافة وتطهير دوري</h4>
                <p className="text-xs text-gray-300 leading-relaxed">تعقيم كامل للوحدة قبل التسكين، مع إمكانية طلب نظافة وتغيير المفارش أثناء الإقامة حسب رغبتك.</p>
              </div>

              <div className="bg-[#25221E] border border-white/10 rounded-2xl p-4 space-y-1.5">
                <div className="text-2xl mb-1">🛡️</div>
                <h4 className="font-black text-sm text-rose-200">أمان وخصوصية تامة 24 ساعة</h4>
                <p className="text-xs text-gray-300 leading-relaxed">بيئة سكنية عائلية هادئة، كاميرات مراقبة للمبنى من الخارج ومداخل مؤمنة لضمان أمان النزلاء الكامل.</p>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link
                href="/mazar/book"
                onClick={() => setShowAmenitiesModal(false)}
                className="bg-[#C1A68D] hover:bg-[#A68D74] text-[#1A1815] font-black text-xs px-8 py-3 rounded-xl transition-all shadow inline-block"
              >
                احجز إقامتك الفاخرة الآن ←
              </Link>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
