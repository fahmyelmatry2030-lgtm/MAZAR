import Link from 'next/link';
import DesignSwitcher from '@/components/DesignSwitcher';

export default function DesignTwo() {
  return (
    <main className="min-h-screen bg-[#02040a] text-white font-sans selection:bg-gold selection:text-black">
      <DesignSwitcher />

      {/* Cinematic Pulse Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#c9a84c]/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/5 px-8 py-6 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black tracking-widest text-[#c9a84c] uppercase">النخبة</Link>
        <div className="hidden md:flex gap-12 text-[10px] font-bold tracking-[0.3em] uppercase text-gray-400">
          <Link href="#" className="hover:text-white transition-colors">Experience</Link>
          <Link href="#" className="hover:text-white transition-colors">Amenities</Link>
          <Link href="#" className="hover:text-white transition-colors">Location</Link>
        </div>
        <Link href="#" className="border border-[#c9a84c] text-[#c9a84c] px-10 py-3 rounded-none text-[10px] font-black tracking-[0.3em] uppercase hover:bg-[#c9a84c] hover:text-black transition-all duration-700">Book Premium</Link>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1512918766671-ed6a9980a659?q=80&w=2070&auto=format&fit=crop"
            alt="bg"
            className="w-full h-full object-cover opacity-40 grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#02040a] via-transparent to-[#02040a]" />
        </div>

        <div className="relative z-10 max-w-5xl">
          <div className="h-[2px] w-20 bg-[#c9a84c] mx-auto mb-10" />
          <h1 className="text-6xl md:text-9xl font-black mb-12 leading-tight uppercase tracking-tighter">
            أعلى مستويات <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#c9a84c] to-white">الفخامة العالمية</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto mb-16 uppercase tracking-[0.2em] leading-loose">
            لا نبحث عن سكن عادي، بل نصنع تجربة فندقية استثنائية لمن يقدرون أدق التفاصيل في عالم الضيافة الفاخرة.
          </p>
          <button className="bg-white text-black px-16 py-5 font-black text-xs uppercase tracking-[0.4em] hover:bg-[#c9a84c] transition-all duration-700 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            Explore Collection
          </button>
        </div>

        {/* Floating Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[#c9a84c] animate-bounce">
          ↓
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-40 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-2">
          <div className="relative group overflow-hidden border border-white/5 aspect-[4/5]">
            <img src="https://images.unsplash.com/photo-1560185127-6ed189bf02f4?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-[3s]" />
            <div className="absolute inset-0 bg-black/60 flex flex-col justify-end p-12">
              <h2 className="text-3xl font-bold mb-4">أجنحة في آي بي</h2>
              <p className="text-gray-400 text-xs tracking-widest leading-relaxed">تصميم داخلي مستوحى من أفخم الفنادق العالمية بلمسات عصرية.</p>
            </div>
          </div>
          <div className="relative group overflow-hidden border border-white/5 aspect-[4/5]">
            <img src="https://images.unsplash.com/photo-1540518614846-7eded433c457?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-[3s]" />
            <div className="absolute inset-0 bg-black/60 flex flex-col justify-end p-12">
              <h2 className="text-3xl font-bold mb-4">خدمة الغرف 24/7</h2>
              <p className="text-gray-400 text-xs tracking-widest leading-relaxed">فريقنا جاهز لتلبية كافة احتياجاتك على مدار الساعة بأعلى جودة.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-20 text-center bg-black border-t border-white/5">
        <p className="text-[10px] tracking-[0.5em] text-gray-500 uppercase">the elite community - crafted for excellence</p>
      </footer>
    </main>
  );
}
