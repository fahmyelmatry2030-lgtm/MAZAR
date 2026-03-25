'use client';

import Link from 'next/link';

export default function DesignFive() {
  return (
    <main className="min-h-screen bg-[#FDFCFB] text-[#2A2A2A] selection:bg-[#D4AF37] selection:text-white" style={{ fontFamily: '"Playfair Display", serif' }}>
      
      {/* Navbar Minimal */}
      <nav className="absolute top-0 w-full p-10 flex justify-between items-center z-50">
        <div className="text-2xl font-bold tracking-[0.2em] text-[#B89B5E]">ELITE</div>
        <div className="hidden md:flex gap-12 text-sm tracking-widest text-gray-500 font-sans uppercase">
          <Link href="#" className="hover:text-[#B89B5E] transition-colors">Villas</Link>
          <Link href="#" className="hover:text-[#B89B5E] transition-colors">Penthouses</Link>
          <Link href="#" className="hover:text-[#B89B5E] transition-colors">The Club</Link>
        </div>
        <button className="px-8 py-3 border border-[#B89B5E] text-[#B89B5E] text-sm tracking-widest uppercase hover:bg-[#B89B5E] hover:text-white transition-all duration-500 font-sans">
          Enquire
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col justify-center items-center px-6 overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#B89B5E 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="relative z-10 text-center max-w-5xl mx-auto flex flex-col items-center">
          <span className="text-sm tracking-[0.4em] text-[#B89B5E] uppercase mb-8 font-sans block">The Pinnacle of Luxury Living</span>
          <h1 className="text-6xl md:text-8xl leading-tight font-medium mb-10 text-[#1A1A1A]">
            سكن لا يليق <br/> <span className="italic text-[#B89B5E]">إلا بالنخبة</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl leading-relaxed font-sans mb-16 font-light">
            استمتع بتجربة إقامة تجمع بين أصالة التصميم ورقي الخدمات. مساحات صُممت بعناية لتعكس أسلوب حياتك الاستثنائي وفريدة من نوعها.
          </p>
          <button className="group relative px-12 py-5 bg-[#1A1A1A] text-white overflow-hidden flex items-center gap-4">
             <div className="absolute inset-0 bg-[#B89B5E] translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
             <span className="relative z-10 text-sm tracking-widest uppercase font-sans">Discover Residence</span>
             <svg className="w-4 h-4 relative z-10 transform group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
             </svg>
          </button>
        </div>
      </section>

      {/* Intro Image Split */}
      <section className="py-32 px-10 md:px-20 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div className="relative aspect-[4/5] w-full">
             <div className="absolute -inset-4 border border-[#B89B5E]/30 translate-x-4 translate-y-4" />
             <img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop" alt="Luxury Interior" className="w-full h-full object-cover relative z-10 shadow-2xl" />
          </div>
          <div className="space-y-10">
            <h2 className="text-4xl md:text-6xl text-[#1A1A1A] leading-tight">
              تفاصيل <br/> <span className="text-[#B89B5E] italic">تصنع الفارق</span>
            </h2>
            <div className="w-20 h-px bg-[#B89B5E]" />
            <p className="text-gray-500 leading-loose mx-auto font-sans font-light text-lg">
              في مجمع النخبة، نؤمن بأن الرفاهية ليست مجرد كلمة بل هي واقع ملموس في كل زاوية. تم اختيار أجود أنواع الرخام والمعادن الثمينة لتشكيل هذه التحفة المعمارية التي توفر لك الهدوء المطلق والخصوصية التامة في قلب المدينة النابض.
            </p>
            <div className="grid grid-cols-2 gap-10 pt-10 border-t border-gray-100">
              <div>
                <div className="text-4xl text-[#B89B5E] mb-2">24/7</div>
                <div className="text-xs uppercase tracking-widest text-[#1A1A1A] font-sans font-bold">Concierge Service</div>
              </div>
              <div>
                <div className="text-4xl text-[#B89B5E] mb-2">100%</div>
                <div className="text-xs uppercase tracking-widest text-[#1A1A1A] font-sans font-bold">Total Privacy</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
