export type Language = 'ar' | 'en';

export const translations = {
  ar: {
    common: {
      appName: 'مزار',
      bookNow: 'احجز الآن',
      explore: 'استكشف الوحدات',
      about: 'عن المكان',
      rules: 'قوانين المكان',
      howToBook: 'طريقة الحجز',
      footerRights: 'جميع الحقوق محفوظة © 2026 لمشروع مزار.',
      luxuryStay: 'إقامة فندقية فاخرة',
      differentExperience: 'بتجربة مختلفة',
      heroSubtitle: 'في مزار بنقدملك تجربة إقامة متكاملة مش مكان مفروش. ستوديوهات مجهزة بالكامل، دخول ذكي بدون مفاتيح، وخدمة ريسيبشن 24 ساعة… علشان تعيش راحتك فعلاً.',
      features: {
        quiet: 'هدوء تام',
        quietDesc: 'تم تصميم الوحدات بعوازل صوت متطورة لتنعم بهدوء لم تشهده من قبل.',
        smart: 'خدمات ذكية',
        smartDesc: 'تحكم كامل في إضاءة وتكييف غرفتك من خلال هاتفك الذكي بكل سهولة.',
        location: 'موقع مميز',
        locationDesc: 'على بعد دقائق من أهم المعالم الحيوية والمراكز التجارية في قلب المدينة.'
      }
    },
    nav: {
      experience: 'التجربة',
      amenities: 'المرافق',
      location: 'الموقع',
      premiumBook: 'حجز بريميوم'
    },
    aboutPage: {
      title: 'عن مزار',
      subtitle: 'تعرف أكثر على فكرتنا وما يميز تجربة الإقامة لدينا.',
      description1: 'مزار، مجمع ستوديوهات فندقية راقية في قلب مدينة نصر، صممنا المكان ليجمع بين راحة البيت وفخامة الإقامة الفندقية. بنقدم تجربة إقامة متكاملة تناسب الباحثين عن الخصوصية، الراحة، والخدمة عالية المستوى.',
      whatWeOffer: 'ماذا نقدّم',
      features: {
        ac: 'ستوديوهات مكيفة',
        acDesc: 'تكييف بالكامل لتضمن راحتك.',
        kitchen: 'مطبخ مجهز',
        kitchenDesc: 'بجميع الأجهزة الأساسية.',
        wifi: 'إنترنت سريع',
        wifiDesc: 'واي فاي فائق السرعة مجاناً.',
        clean: 'خدمة نظافة',
        cleanDesc: 'متوفرة على مدار 24 ساعة.',
        smart: 'دخول ذكي',
        smartDesc: 'نظام إلكتروني بدون مفاتيح.',
        security: 'أمان تام',
        securityDesc: 'كاميرات وحراسة 24 ساعة.',
        coffee: 'كوفي كورنر',
        coffeeDesc: 'مشروبات مجانية طوال اليوم.',
        hotel: 'خدمة فندقية',
        hotelDesc: 'ريسبشن لخدمتك في أي وقت.'
      },
      ourGoal: 'هدفنا',
      goalDesc: 'هدفنا في مزار هو تقديم تجربة إقامة مختلفة في مصر، تعتمد على الجودة، الراحة، والثقة. بنسعى إن كل عميل يخرج من عندنا وهو حابب يرجع تاني.'
    },
    rulesPage: {
      title: 'قوانين الإقامة في مزار',
      subtitle: 'نرجو من ضيوفنا الكرام الالتزام بهذه القوانين لضمان إقامة مريحة وآمنة للجميع.',
      sections: {
        times: {
          title: '🕒 مواعيد الوصول والمغادرة',
          checkIn: 'وقت الوصول (Check-in) يبدأ من الساعة 2:00 ظهراً.',
          checkOut: 'وقت المغادرة (Check-out) بحد أقصى الساعة 12:00 ظهراً.',
          late: 'يتم احتساب رسوم إضافية في حالة التأخير في المغادرة بدون تنسيق مسبق.'
        },
        visitors: {
          title: '👨‍👩‍👧‍👦 سياسة الزوار والضيوف',
          limit: 'يُسمح بتواجد الزوار في الاستوديو حتى الساعة 10:00 مساءً فقط.',
          noSleepover: 'يمنع منعاً باتاً استضافة أي شخص غير مسجل في الحجز للمبيت.',
          id: 'يجب تقديم بطاقة الهوية لجميع المقيمين عند تسجيل الدخول.'
        },
        forbidden: {
          title: '🚫 الممنوعات',
          smoking: 'يمنع التدخين تماماً داخل الاستوديوهات (التدخين مسموح في البلكونات فقط).',
          pets: 'يمنع اصطحاب الحيوانات الأليفة.',
          parties: 'يمنع إقامة الحفلات أو التجمعات المزعجة.',
          plumbing: 'يمنع إلقاء أي مواد صلبة في دورات المياه.'
        },
        security: {
          title: '🔑 الدخول الذكي والأمان',
          code: 'سيتم إرسال رمز الدخول الذكي قبل وصولك بساعتين.',
          private: 'الرمز شخصي ويمنع مشاركته مع أي شخص غير مصرح له.',
          cameras: 'المكان مراقب بالكاميرات لضمان أمنكم على مدار 24 ساعة.'
        }
      }
    },
    howToBookPage: {
      title: 'طريقة الحجز والدفع',
      subtitle: 'خطوات بسيطة وسريعة لتأكيد إقامتك معنا في مزار.',
      steps: [
        { title: 'اختر التواريخ المناسبة', desc: 'ادخل على صفحة "تجربة الحجز"، وحدد تاريخ الوصول والمغادرة.' },
        { title: 'سجل بياناتك ومراجعة الطلب', desc: 'قم بتعبئة نموذج الحجز ببياناتك. سيتم مراجعة الطلب خلال دقائق.' },
        { title: 'الموافقة والدفع', desc: 'بمجرد الموافقة، ستصلك أرقام تحويل القيمة عبر InstaPay أو Vodafone Cash.' },
        { title: 'التأكيد وإرسال الرمز السري', desc: 'بعد التأكيد، سيتم إرسال رقم الاستوديو والرمز السري لفتح الباب.' }
      ],
      cta: 'ابدأ رحلة الحجز الآن'
    },
    bookingPage: {
      step1Title: 'خطوتك الأولى نحو الراحة',
      step1Subtitle: 'حدد تواريخ إقامتك لنعرض لك الاستوديوهات المتاحة في مزار.',
      checkIn: 'تاريخ الوصول',
      checkOut: 'تاريخ المغادرة',
      checkAvailability: 'التحقق من التوفر الآن',
      instantConfirm: 'تأكيد فوري',
      service24h: 'خدمة 24 ساعة',
      smartSecurity: 'أمان ذكي',
      step2Title: 'استكمال عملية الحجز',
      backToDates: '← العودة لتعديل التاريخ',
      availableNow: 'متاح الآن',
      guestName: 'اسم الضيف',
      phoneWhatsapp: 'رقم الواتساب للتواصل',
      selectedStudio: 'رقم الاستوديو المختار',
      confirmBooking: 'تأكيد طلب الحجز المبدئي',
      submitting: 'جاري الحجز...',
      policyAgreement: 'بالضغط على تأكيد، أنت توافق على سياسات الإقامة.',
      successTitle: 'تم إرسال طلبك بنجاح!',
      successDesc: 'طلب الحجز المبدئي قيد المراجعة. سيتم التواصل معك قريباً عبر الواتساب.',
      backToHome: 'العودة للرئيسية'
    },
    design4: {
      heroTitleTop: 'سكـن',
      heroTitleBottom: 'المستـقبـل',
      heroSubtitle: 'نستخدم أحدث تقنيات الأنظمة الذكية لتوفير تجربة سكنية غير مسبوقة. تفاعل مع منزلك كما لم تفعل من قبل.',
      stats: {
        smartControl: 'تحكم ذكي',
        uptime: 'وقت التشغيل',
        latency: 'الاستجابة'
      },
      featuresTitle: 'تجربة مُشفـرة بالفخامة',
      features: [
        'هوية رقمية لكل مستخدم للحجز وخدمات النظافة.',
        'نظام مراقبة ذكي يعتمد على الذكاء الاصطناعي للأمان.',
        'تحكم صوتي وحركي في جميع مرافق الشقة الذكية.',
        'خدمة إنترنت فضائي فائق السرعة مدمج في كل الوحدات.'
      ],
      cta: 'بدء الحجز الان',
      copyright: 'نظام جميع الحقوق محفوظة © 2026 للنخبة'
    }
  },
  en: {
    common: {
      appName: 'Mazar',
      bookNow: 'Book Now',
      explore: 'Explore Units',
      about: 'About Us',
      rules: 'House Rules',
      howToBook: 'How to Book',
      footerRights: 'All rights reserved © 2026 Mazar Project.',
      luxuryStay: 'A Luxury Hotel Stay',
      differentExperience: 'Like No Other',
      heroSubtitle: 'At Mazar, we provide a holistic residential experience, far beyond conventional furnished apartments. Enjoy fully-equipped studios, seamless keyless entry, and a 24/7 concierge service—crafted entirely for your absolute comfort.',
      features: {
        quiet: 'Absolute Tranquility',
        quietDesc: 'Our units feature state-of-the-art soundproofing, promising you unprecedented peace and quiet.',
        smart: 'Smart Living',
        smartDesc: 'Effortlessly control your room lighting and climate directly from your smartphone.',
        location: 'Prime Location',
        locationDesc: 'Situated just minutes away from major landmarks and premier shopping destinations in the heart of the city.'
      }
    },
    nav: {
      experience: 'Experience',
      amenities: 'Amenities',
      location: 'Location',
      premiumBook: 'Book Premium'
    },
    aboutPage: {
      title: 'About Mazar',
      subtitle: 'Learn more about our philosophy and what makes our stay experience uniquely luxurious.',
      description1: 'Mazar is a premium hotel-style studio complex in the heart of Nasr City. We designed our spaces to combine the warmth of a home with the elite luxury of a hotel stay. We provide a comprehensive experience tailored for those who value privacy, unparalleled comfort, and top-tier service.',
      whatWeOffer: 'Our Offerings',
      features: {
        ac: 'Air Conditioned Studios',
        acDesc: 'Climate-controlled environments to guarantee your comfort.',
        kitchen: 'Fully-Equipped Kitchen',
        kitchenDesc: 'Fitted with all essential modern appliances.',
        wifi: 'High-speed Internet',
        wifiDesc: 'Complimentary ultra-fast Wi-Fi.',
        clean: 'Housekeeping Service',
        cleanDesc: 'Premium cleaning available 24 hours a day.',
        smart: 'Smart Access',
        smartDesc: 'Secure and seamless keyless electronic entry.',
        security: 'Uncompromised Security',
        securityDesc: 'Round-the-clock surveillance and on-site security personnel.',
        coffee: 'Coffee Corner',
        coffeeDesc: 'Complimentary premium beverages throughout the day.',
        hotel: 'Concierge Service',
        hotelDesc: 'Our reception desk is always ready to assist you.'
      },
      ourGoal: 'Our Vision',
      goalDesc: 'Our vision at Mazar is to redefine the hospitality experience in Egypt, founded on Quality, Comfort, and Trust. We strive to ensure every guest departs with the desire to return.'
    },
    rulesPage: {
      title: 'Mazar Stay Rules',
      subtitle: 'We kindly ask our guests to adhere to these rules to ensure a comfortable and safe stay for everyone.',
      sections: {
        times: {
          title: '🕒 Arrival and Departure',
          checkIn: 'Check-in time starts from 2:00 PM.',
          checkOut: 'Check-out time is by 12:00 PM at the latest.',
          late: 'Additional fees apply for late departures without prior coordination.'
        },
        visitors: {
          title: '👨‍👩‍👧‍👦 Visitor Policy',
          limit: 'Visitors are allowed in the studio until 10:00 PM only.',
          noSleepover: 'Hosting unregistered guests for overnight stays is strictly prohibited.',
          id: 'ID cards must be presented for all residents upon check-in.'
        },
        forbidden: {
          title: '🚫 Forbidden',
          smoking: 'Smoking is strictly prohibited inside studios (allowed only on balconies).',
          pets: 'Pets are not allowed.',
          parties: 'Parties or noisy gatherings are prohibited.',
          plumbing: 'Disposing of solid materials in bathrooms is prohibited.'
        },
        security: {
          title: '🔑 Smart Entry and Security',
          code: 'The Smart Lock Code will be sent 2 hours before your arrival.',
          private: 'The code is personal and sharing it with unauthorized persons is prohibited.',
          cameras: 'The premises are monitored by cameras 24/7 for your security.'
        }
      }
    },
    howToBookPage: {
      title: 'Booking and Payment Method',
      subtitle: 'Simple and fast steps to confirm your stay with us at Mazar.',
      steps: [
        { title: 'Choose Suitable Dates', desc: 'Go to the "Booking Experience" page and select arrival and departure dates.' },
        { title: 'Register Details and Review', desc: 'Fill out the booking form. The request will be reviewed within minutes.' },
        { title: 'Approval and Payment', desc: 'Once approved, you will receive payment numbers via InstaPay or Vodafone Cash.' },
        { title: 'Confirmation and Smart Code', desc: 'After confirmation, you will receive the studio number and Smart Lock code.' }
      ],
      cta: 'Start Booking Journey Now'
    },
    bookingPage: {
      step1Title: 'Your First Step Towards Comfort',
      step1Subtitle: 'Select your preferred dates to discover available studios at Mazar.',
      checkIn: 'Check-in Date',
      checkOut: 'Check-out Date',
      checkAvailability: 'Check Availability Now',
      instantConfirm: 'Instant Confirmation',
      service24h: '24/7 Concierge Service',
      smartSecurity: 'Smart Security',
      step2Title: 'Finalize Your Booking',
      backToDates: '← Modify Dates',
      availableNow: 'Available Now',
      guestName: 'Guest Full Name',
      phoneWhatsapp: 'WhatsApp Contact Number',
      selectedStudio: 'Selected Studio',
      confirmBooking: 'Confirm Preliminary Reservation',
      submitting: 'Processing...',
      policyAgreement: 'By confirming, you agree to our stay policies and terms.',
      successTitle: 'Reservation Request Received!',
      successDesc: 'Your preliminary request is under review. Our team will contact you shortly via WhatsApp.',
      backToHome: 'Return to Homepage'
    },
    design4: {
      heroTitleTop: 'URBAN',
      heroTitleBottom: 'FUTURE',
      heroSubtitle: 'We use the latest smart system technologies to provide an unprecedented residential experience. Interact with your home like never before.',
      stats: {
        smartControl: 'Smart Control',
        uptime: 'Uptime',
        latency: 'Latency'
      },
      featuresTitle: 'ENCRYPTED Luxury Experience',
      features: [
        'Digital ID for every user for booking and cleaning services.',
        'AI-based smart monitoring system for security.',
        'Voice and gesture control in all smart apartment facilities.',
        'Integrated high-speed satellite internet in all units.'
      ],
      cta: 'INITIALIZE BOOKING',
      copyright: 'System Copyright © 2026 ELITE_NOKBA'
    }
  }
};