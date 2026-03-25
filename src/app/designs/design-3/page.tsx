import Link from 'next/link';
import DesignSwitcher from '@/components/DesignSwitcher';

export default function DesignThree() {
  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#4a4a4a] font-serif">
      <DesignSwitcher />
      
      {/* Decorative Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[10%] right-[5%] w-[300px] h-[300px] bg-[#dbe1d4] rounded-full blur-[80px]" />
        <div className="absolute bottom-[20%] left-[10%] w-[400px] h-[400px] bg-[#f2e8cf] rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-6 left-6 right-6 z-50 bg-white/40 backdrop-blur-xl border border-white/60 px-10 py-4 flex items-center justify-between rounded-full shadow-sm">
        <Link href="/" className="text-2xl font-bold text-[#6b705c] font-sans">مجمع النخبة</Link>
        <div className="hidden md:flex gap-10 text-sm font-medium text-[#a5a58d]">
          <Link href="#" className="hover:text-[#6b705c] transition-colors">مساحاتنا</Link>
          <Link href="#" className="hover:text-[#6b705c] transition-colors">عن التجربة</Link>
          <Link href="#" className="hover:text-[#6b705c] transition-colors">تواصل معنا</Link>
        </div>
        <Link href="#" className="bg-[#6b705c] text-white px-8 py-2.5 rounded-full text-sm font-bold hover:shadow-lg hover:shadow-[#6b705c]/20 transition-all">احجز الآن</Link>
      </nav>

      {/* Hero */}
      <section className="pt-48 pb-32 px-6 max-w-6xl mx-auto flex flex-col items-center text-center">
        <div className="bg-[#e9edc9] px-6 py-1.5 rounded-full text-[#6b705c] text-xs font-bold mb-10 tracking-widest uppercase">سكينة الروح</div>
        <h1 className="text-5xl md:text-7xl font-bold text-[#353a2d] mb-12 leading-tight">
          مسكن دافئ <br />
          <span className="text-[#a5a58d] font-normal italic">بلمسة الطبيعة</span>
        </h1>
        <p className="max-w-xl mx-auto text-[#6b705c] text-xl leading-[1.8] mb-16">
          اكتشف الراحة في مساحات مصممة بألوان الطبيعة الهادئة، حيث يلتقي الدفء مع التطور ليوفر لك ملاذاً آمناً بعيداً عن صخب الحياة.
        </p>
        
        {/* Floating cards */}
        <div className="grid md:grid-cols-2 gap-8 w-full">
           <div className="relative aspect-[4/3] rounded-[3rem] overflow-hidden group shadow-2xl shadow-green-900/5">
              <img src="https://images.unsplash.com/photo-1594498653385-d5172c532c00?q=80&w=2070&auto=format&fit=crop" alt="Interior" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-x-8 bottom-8 p-8 bg-white/80 backdrop-blur-md rounded-3xl text-right">
                 <h3 className="text-xl font-bold mb-2">غرف معيشة مشرقة</h3>
                 <p className="text-sm text-[#a5a58d]">إضاءة طبيعية وافرة ونباتات داخلية تضفي حيوية للمكان.</p>
              </div>
           </div>
           <div className="relative aspect-[4/3] rounded-[3rem] overflow-hidden group shadow-2xl shadow-green-900/5 md:mt-12">
              <img src="https://images.unsplash.com/photo-1540518614846-7eded433c457?q=80&w=2070&auto=format&fit=crop" alt="Bedroom" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-x-8 bottom-8 p-8 bg-white/80 backdrop-blur-md rounded-3xl text-right">
                 <h3 className="text-xl font-bold mb-2">غرف نوم هادئة</h3>
                 <p className="text-sm text-[#a5a58d]">ألوان ترابية دافئة وأقمشة قطنية فاخرة للنوم العميق.</p>
              </div>
           </div>
        </div>
      </section>

      {/* Text block */}
      <section className="py-40 px-6 bg-[#f0ede5]/30">
        <div className="max-w-4xl mx-auto text-center">
           <h2 className="text-4xl font-bold text-[#353a2d] mb-10 italic">فلسفة الجمال البسيط</h2>
           <p className="text-lg text-[#6b705c] leading-relaxed">
             نؤمن أن الجمال يكمن في البساطة وفي العودة للأصل. لذا اخترنا خاماتنا بعناية من الخشب الطبيعي والأقمشة المستدامة لنصنع لك تجربة سكنية وصحية متكاملة.
           </p>
        </div>
      </section>

      <footer className="py-24 text-center border-t border-[#e9edc9] bg-white">
        <div className="text-3xl font-bold text-[#6b705c] mb-8">مجمع النخبة</div>
        <p className="text-[#a5a58d] text-sm italic">جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
