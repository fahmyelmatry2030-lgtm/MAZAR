"use client";

import Link from 'next/link';

export default function RulesPage() {
  const rules = [
    { title: 'موعد تسجيل الوصول', desc: 'يتم تسجيل الوصول من الساعة 2:00 ظهراً.' },
    { title: 'موعد تسجيل المغادرة', desc: 'يتم تسجيل المغادرة بحد أقصى الساعة 12:00 ظهراً.' },
    { title: 'الهدوء والسكينة', desc: 'يرجى الحفاظ على الهدوء وعدم إزعاج الجيران، خاصة في ساعات الليل.' },
    { title: 'سياسة التدخين', desc: 'التدخين مسموح فقط في الشرفات والأماكن المفتوحة.' },
    { title: 'سياسة الإلغاء', desc: 'يمكن استرداد كامل المبلغ عند الإلغاء قبل 48 ساعة من موعد الحجز.' },
    { title: 'الحفاظ على الممتلكات', desc: 'النزيل مسؤول عن سلامة محتويات الشقة أثناء فترة إقامته.' },
  ];

  return (
    <main className="min-h-screen pt-32 pb-20 px-6">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-gold/20 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black text-gradient">مجمع النخبة</Link>
        <Link href="/" className="text-sm font-bold hover:text-gold transition-colors">العودة للرئيسية</Link>
      </nav>

      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black mb-4">قوانين <span className="text-gold">المكان</span></h1>
          <p className="text-gray">نرجو من ضيوفنا الكرام الالتزام بالتعليمات التالية لضمان إقامة مريحة للجميع</p>
        </header>

        <div className="grid gap-6">
          {rules.map((rule, i) => (
            <div key={i} className="glass-card flex gap-6 items-start">
              <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-xl font-black flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-gold-light">{rule.title}</h3>
                <p className="text-gray leading-relaxed">{rule.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link href="/booking" className="btn-gold">
            موافق، أريد الحجز الآن
          </Link>
        </div>
      </div>
    </main>
  );
}
