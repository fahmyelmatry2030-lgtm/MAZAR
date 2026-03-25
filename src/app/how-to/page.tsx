"use client";

import Link from 'next/link';

export default function HowToPage() {
  const steps = [
    { title: 'اختر الموعد', desc: 'حدد تاريخ الوصول والمغادرة من خلال صفحة الحجز للتأكد من المتاح.' },
    { title: 'أدخل بياناتك', desc: 'قم بتعبئة النموذج بالبيانات المطلوبة (الاسم، الهاتف، صورة الهوية).' },
    { title: 'أرسل الطلب', desc: 'بعد التأكد من البيانات، اضغط على زر "طلب حجز" لإرسال طلبك للإدارة.' },
    { title: 'انتظر التأكيد', desc: 'ستقوم الإدارة بمراجعة طلبك وإخطارك بالموافقة عبر الهاتف أو الإيميل.' },
    { title: 'تأكيد الحجز', desc: 'بمجرد الموافقة، يمكنك تحويل العربون لتأكيد حجزك بشكل نهائي.' },
  ];

  return (
    <main className="min-h-screen pt-32 pb-20 px-6">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-gold/20 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black text-gradient">مجمع النخبة</Link>
        <Link href="/" className="text-sm font-bold hover:text-gold transition-colors">العودة للرئيسية</Link>
      </nav>

      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black mb-4">خطوات <span className="text-gold">الحجز</span></h1>
          <p className="text-gray">خطوات بسيطة وسريعة لتأمين إقامتك معنا</p>
        </header>

        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute top-0 right-6 md:right-1/2 w-0.5 h-full bg-gold/20 -translate-x-1/2 hidden md:block" />
          
          <div className="grid gap-12">
            {steps.map((step, i) => (
              <div key={i} className={`flex flex-col md:flex-row items-center gap-8 md:gap-0 ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                <div className="md:w-1/2 flex justify-center">
                  <div className="glass-card w-full max-w-sm relative z-10 hover:border-gold/50 transition-all">
                    <h3 className="text-xl font-bold mb-3 text-gold-light">{step.title}</h3>
                    <p className="text-gray leading-relaxed text-sm">{step.desc}</p>
                  </div>
                </div>
                
                {/* Number Circle */}
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-navy border-2 border-gold text-gold flex items-center justify-center font-black z-20 shadow-[0_0_20px_rgba(201,168,76,0.5)]">
                    {i + 1}
                  </div>
                </div>

                <div className="md:w-1/2" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 text-center">
          <Link href="/booking" className="btn-gold !px-12">
            جاهز؟ ابدأ الحجز الآن
          </Link>
        </div>
      </div>
    </main>
  );
}
