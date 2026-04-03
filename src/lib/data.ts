export interface Unit {
  id: string;
  branch: 1 | 2;
  type: 'studio' | 'apartment';
  title: {
    ar: string;
    en: string;
  };
  description: {
    ar: string;
    en: string;
  };
  images: string[];
  features: {
    ar: string[];
    en: string[];
  };
  price?: string;
}

export const units: Unit[] = [
  // Branch 1 - Studios (1-12)
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `b1-s${i + 1}`,
    branch: 1 as const,
    type: 'studio' as const,
    title: {
      ar: `استوديو بريميوم ${i + 1}`,
      en: `Premium Studio ${i + 1}`
    },
    description: {
      ar: 'استوديو فندقي فاخر مجهز بأحدث الخدمات الذكية في قلب مدينة نصر.',
      en: 'Luxury hotel studio equipped with the latest smart services in the heart of Nasr City.'
    },
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858',
      'https://images.unsplash.com/photo-1507089947368-19c1da97753e',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688'
    ],
    features: {
      ar: ['تكييف مركزي', 'واي فاي سريع', 'دخول ذكي', 'شاشة سمارت', 'مطبخ مجهز'],
      en: ['Central AC', 'Fast WiFi', 'Smart Entry', 'Smart TV', 'Equipped Kitchen']
    }
  })),
  // Branch 2 - Studios (1-12)
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `b2-s${i + 1}`,
    branch: 2 as const,
    type: 'studio' as const,
    title: {
      ar: `استوديو بريميوم ${i + 1}`,
      en: `Premium Studio ${i + 1}`
    },
    description: {
      ar: 'استوديو فندقي فاخر مجهز بأحدث الخدمات الذكية في قلب مدينة نصر.',
      en: 'Luxury hotel studio equipped with the latest smart services in the heart of Nasr City.'
    },
    images: [
      'https://images.unsplash.com/photo-1554995207-c18c20360a59',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2',
      'https://images.unsplash.com/photo-1505693419148-ad3097f98751',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750',
      'https://images.unsplash.com/photo-1512918766775-d2fc9f184005'
    ],
    features: {
      ar: ['تكييف مركزي', 'واي فاي سريع', 'دخول ذكي', 'شاشة سمارت', 'مطبخ مجهز'],
      en: ['Central AC', 'Fast WiFi', 'Smart Entry', 'Smart TV', 'Equipped Kitchen']
    }
  })),
  // Apartments (1-3)
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `apt-${i + 1}`,
    branch: 1 as const, // For now, assume branch 1 or similar
    type: 'apartment' as const,
    title: {
      ar: `شقة فندقية فاخرة ${i + 1}`,
      en: `Luxury Hotel Apartment ${i + 1}`
    },
    description: {
      ar: 'شقة فندقية واسعة متكاملة الخدمات للعائلات والباحثين عن الرقي في مدينة نصر.',
      en: 'Spacious hotel apartment with complete services for families and luxury seekers in Nasr City.'
    },
    images: [
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688',
      'https://images.unsplash.com/photo-1507089947368-19c1da97753e',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858'
    ],
    features: {
      ar: ['غرفتين نوم', 'ريسبشن واسع', 'واي فاي فايبر', 'خدمة نظافة', 'موقف سيارات'],
      en: ['2 Bedrooms', 'Spacious Reception', 'Fiber WiFi', 'Housekeeping', 'Parking']
    }
  }))
];
