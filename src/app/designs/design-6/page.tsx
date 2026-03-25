'use client';

import Link from 'next/link';

export default function DesignSix() {
  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black overflow-hidden">
      
      {/* Dynamic Background Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/30 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-900/20 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />
      <div className="fixed top-[40%] left-[50%] translate-x-[-50%] w-[80%] h-[20%] bg-white/5 blur-[100px] pointer-events-none" />

      {/* Floating Glass Navbar */}
      <nav className="fixed top-6 inset-x-0 mx-auto w-[90%] max-w-5xl rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-2xl px-8 py-4 flex items-center justify-between z-50">
        <Link href="/" className="text-xl font-semibold tracking-tight text-white/90">
          Elite<span className="text-white/40">.</span>
        </Link>
        <div className="hidden md:flex gap-8 text-sm font-medium text-white/60">
          <Link href="#" className="hover:text-white transition-colors">Overview</Link>
          <Link href="#" className="hover:text-white transition-colors">Tech Specs</Link>
          <Link href="#" className="hover:text-white transition-colors">Compare</Link>
        </div>
        <button className="bg-white text-black px-5 py-2 rounded-full text-sm font-medium hover:scale-105 transition-transform">
          Buy
        </button>
      </nav>

      <section className="relative pt-48 pb-32 px-6 flex flex-col items-center text-center">
         <h1 className="text-6xl md:text-[7rem] font-semibold tracking-tighter leading-[1.1] mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
           القوة <br/> <span className="text-white/40">في الهدوء.</span>
         </h1>
         <p className="text-xl md:text-2xl text-white/50 font-medium max-w-2xl mb-12">
           نظام حجز شقق متطور، يعيد تعريف معنى الراحة. أداء فائق، حماية مطلقة، وتصميم يخطف الأنفاس.
         </p>
         
         <div className="flex flex-col sm:flex-row gap-6">
            <button className="px-8 py-4 rounded-full bg-white text-black font-semibold text-lg hover:bg-gray-200 transition-colors">
              ابدأ الحجز الآن
            </button>
            <button className="px-8 py-4 rounded-full bg-white/10 text-white font-semibold text-lg hover:bg-white/20 transition-colors border border-white/10 backdrop-blur-md">
              اكتشف المزيد &gt;
            </button>
         </div>
      </section>

      {/* Glassmorphism Feature Cards */}
      <section className="py-20 px-6 max-w-7xl mx-auto grid md:grid-cols-3 gap-6 relative z-10">
         {[
           { title: 'شاشة ريتينا', desc: 'صور فائقة الدقة لكل زاوية في الشقة لتعيش التفاصيل الحقيقية.', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
           { title: 'حماية متقدمة', desc: 'بيانات الحجز والدفع مشفرة بالكامل بتقنية من الطرف للطرف.', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
           { title: 'دعم ذكي', desc: 'مساعد افتراضي يعمل بالذكاء الاصطناعي لخدمتك على مدار الساعة.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
         ].map((feat, i) => (
            <div key={i} className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] backdrop-blur-3xl hover:bg-white/[0.04] transition-colors group">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feat.icon} />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-white/90 mb-3">{feat.title}</h3>
              <p className="text-white/50 leading-relaxed font-medium">{feat.desc}</p>
            </div>
         ))}
      </section>

      <section className="py-32 px-6 flex flex-col items-center text-center border-t border-white/[0.05] mt-20">
         <div className="w-24 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent mb-12" />
         <h2 className="text-4xl md:text-5xl font-semibold mb-6">مستعد للترقية؟</h2>
         <p className="text-xl text-white/50 mb-10">انضم لنخبة النخبة اليوم.</p>
         <Link href="#" className="text-lg font-medium text-blue-400 hover:text-blue-300 transition-colors">
           تسجيل الدخول للنظام &gt;
         </Link>
      </section>

    </main>
  );
}
