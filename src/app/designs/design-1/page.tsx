import Link from 'next/link';
import DesignSwitcher from '@/components/DesignSwitcher';

export default function DesignOne() {
  return (
    <main className="min-h-screen bg-white text-slate-900 font-sans">
      <DesignSwitcher />
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tighter text-slate-900">مجمع النخبة</Link>
        <div className="hidden md:flex gap-10 text-sm font-medium text-slate-500">
          <Link href="#" className="hover:text-slate-900 transition-colors">عن المكان</Link>
          <Link href="#" className="hover:text-slate-900 transition-colors">قوانين المكان</Link>
          <Link href="#" className="hover:text-slate-900 transition-colors">طريقة الحجز</Link>
        </div>
        <Link href="#" className="bg-slate-900 text-white px-6 py-2.5 rounded-full text-xs font-semibold hover:bg-slate-800 transition-all">احجز الآن</Link>
      </nav>

      {/* Hero */}
      <section className="pt-44 pb-32 px-6 max-w-7xl mx-auto text-center">
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-6 block">Premium Stay Experience</span>
        <h1 className="text-5xl md:text-8xl font-light tracking-tight text-slate-900 mb-10 leading-[1.1]">
          بساطة السكن <br />
          <span className="font-serif italic text-slate-400">فخامة التفاصيل</span>
        </h1>
        <p className="max-w-xl mx-auto text-slate-500 text-lg leading-relaxed mb-12">
          نقدم لك تجربة سكنية هادئة في أرقى أحياء المدينة. بساطة التصميم تلتقي مع فخامة الخدمات لتوفر لك الراحة التي تحلم بها.
        </p>
        <div className="flex justify-center gap-4">
          <button className="bg-slate-900 text-white px-10 py-4 rounded-full font-medium hover:px-12 transition-all duration-500">استكشف الوحدات</button>
        </div>
      </section>

      {/* Featured Img */}
      <section className="px-6 pb-32 max-w-6xl mx-auto">
        <div className="aspect-[21/9] rounded-[2rem] overflow-hidden bg-slate-100 shadow-2xl shadow-slate-200/50">
          <img 
            src="https://images.unsplash.com/photo-1600607687940-467f4b6357bd?q=80&w=2070&auto=format&fit=crop" 
            alt="Interior" 
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Grid */}
      <section className="bg-slate-50 py-32 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-16">
          {[
            { title: 'هدوء تام', desc: 'تم تصميم الوحدات بعوازل صوت متطورة لتنعم بهدوء لم تشهده من قبل.' },
            { title: 'خدمات ذكية', desc: 'تحكم كامل في إضاءة وتكييف غرفتك من خلال هاتفك الذكي بكل سهولة.' },
            { title: 'موقع مميز', desc: 'على بعد دقائق من أهم المعالم الحيوية والمراكز التجارية في قلب المدينة.' },
          ].map((item, i) => (
            <div key={i} className="space-y-4">
              <div className="text-2xl font-light text-slate-300">0{i+1}</div>
              <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
              <p className="text-slate-500 leading-relaxed text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-20 text-center border-t border-slate-100 text-slate-400 text-xs tracking-widest uppercase">
        © {new Date().getFullYear()} migmaa al-nokba
      </footer>
    </main>
  );
}
