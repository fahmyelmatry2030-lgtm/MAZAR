"use client";

import Link from 'next/link';

export default function AboutPage() {
  const features = [
    { title: "موقع استراتيجي", desc: "يقع المجمع في قلب المدينة بالقرب من كافة الخدمات والحيوية.", icon: "📍" },
    { title: "أمان 24/7", desc: "نظام أمني متكامل وحراسة على مدار الساعة لضمان راحة بالك.", icon: "🛡️" },
    { title: "تصميم عصري", desc: "شقق مصممة بأحدث الطرز المعمارية مع استغلال مثالي للمساحات.", icon: "✨" },
    { title: "خدمات فندقية", desc: "نظافة دورية وصيانة فورية لكافة مرافق الوحدات السكنية.", icon: "🧹" },
  ];

  const gallery = [
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80",
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 bg-[#060b18]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-gold/20 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black text-gradient">مجمع النخبة</Link>
        <Link href="/" className="text-sm font-bold hover:text-gold transition-colors">العودة للرئيسية</Link>
      </nav>

      <div className="max-w-6xl mx-auto space-y-24">
        {/* Luxury Hero */}
        <header className="text-center space-y-8 animate-fade-in">
          <div className="inline-block px-4 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black tracking-widest uppercase">
            هنا تبدأ الرفاهية
          </div>
          <h1 className="text-5xl md:text-8xl font-black leading-tight text-white">عالم من <br/><span className="text-gradient">الأناقة والراحة</span></h1>
          <p className="text-gray-400 max-w-2xl mx-auto leading-loose text-lg font-medium">
            اكتشف مجمع النخبة، حيث تجتمع دقة التصميم مع دفء المنزل. نوفر لك شققاً سكنية مجهزة بالكامل لتمنحك تجربة سكنية لا تُنسى.
          </p>
        </header>

        {/* Cinematic Gallery */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-6 animate-slide-up">
          {gallery.map((img, i) => (
            <div key={i} className={`rounded-[2rem] overflow-hidden glass-card p-0 border-white/5 relative group ${i % 3 === 1 ? 'md:translate-y-12' : ''}`}>
              <div className="absolute inset-0 bg-gold/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />
              <img src={img} alt={`Property ${i}`} className="w-full h-96 object-cover group-hover:scale-110 transition-transform duration-1000" />
            </div>
          ))}
        </section>

        {/* Features Container */}
        <div className="pt-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f, i) => (
              <div key={i} className="glass-card text-center space-y-6 hover:shadow-[0_20px_40px_rgba(201,168,76,0.1)] transition-all border-white/5 group">
                <div className="w-20 h-20 bg-gold/10 rounded-3xl flex items-center justify-center text-4xl mx-auto group-hover:bg-gold transition-colors group-hover:text-navy">
                  {f.icon}
                </div>
                <h3 className="text-xl font-black text-white">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Video Call to Action */}
        <section className="glass-card p-12 md:p-20 overflow-hidden relative rounded-[3rem] border-gold/20 text-center space-y-8">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-navy/60 to-navy z-0" />
           <img src="https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80" alt="Video Placeholder" className="absolute inset-0 w-full h-full object-cover opacity-20 z-[-1]" />
           
           <div className="relative z-10 space-y-8">
              <h2 className="text-3xl md:text-5xl font-black">شاهد جولة داخلية <span className="text-gold">فيديو</span></h2>
              <p className="text-gray-300 max-w-xl mx-auto">نأخذك في جولة افتراضية لنريك ملامح الرقي والاهتمام بالتفاصيل التي نضعها في كل زاوية.</p>
              <div className="inline-flex items-center gap-6">
                 <div className="w-16 h-16 bg-gold rounded-full flex items-center justify-center text-navy text-2xl cursor-pointer hover:scale-110 shadow-lg shadow-gold/40 transition-transform">▶</div>
              </div>
           </div>
        </section>

        <footer className="text-center pt-10 pb-10">
          <Link href="/booking" className="btn-gold !px-12 !py-6 text-lg font-black shadow-2xl shadow-gold/30">احجز وحدتك الآن 🔑</Link>
        </footer>
      </div>
    </div>
  );
}
