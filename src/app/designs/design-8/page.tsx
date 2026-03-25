'use client';

import Link from 'next/link';

export default function DesignEight() {
  return (
    <main className="min-h-screen bg-black text-white font-sans overflow-hidden relative selection:bg-white selection:text-black">
      
      {/* Full Screen Immersive Background */}
      <div className="absolute inset-0 z-0">
        <video 
           autoPlay 
           loop 
           muted 
           playsInline 
           className="w-full h-full object-cover opacity-70 scale-105 animate-[zoom_20s_infinite_alternate_ease-in-out]"
           poster="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto=format&fit=crop"
        >
           {/* Fallback to image if video fails or is missing, we use poster for now */}
        </video>
        {/* Gradient Overlay for Text Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
      </div>

      {/* Floating Header */}
      <header className="absolute top-0 w-full px-6 py-8 md:px-12 md:py-12 z-50 flex justify-between items-start">
         <div>
            <Link href="/" className="text-3xl font-black tracking-tighter uppercase leading-none block">
               ELITE<br/>
               <span className="text-sm font-normal tracking-[0.5em] text-white/50">RESIDENCES</span>
            </Link>
         </div>
         <div className="flex flex-col items-end gap-2">
            <button className="flex items-center gap-3 group">
               <span className="text-xs tracking-[0.2em] font-bold uppercase group-hover:text-white/70 transition-colors">Menu</span>
               <div className="w-8 flex flex-col gap-1.5 items-end">
                  <div className="w-full h-px bg-white group-hover:w-1/2 transition-all duration-300" />
                  <div className="w-full h-px bg-white group-hover:w-full transition-all duration-300" />
               </div>
            </button>
            <button className="mt-8 px-6 py-3 border border-white/20 rounded-full text-xs font-bold tracking-widest uppercase hover:bg-white hover:text-black transition-all backdrop-blur-sm">
               Book Viewing
            </button>
         </div>
      </header>

      {/* Immersive Hero Content */}
      <section className="relative z-10 h-screen flex flex-col justify-end pb-24 px-6 md:px-12 md:pb-32">
         <div className="max-w-5xl">
            <div className="flex items-center gap-4 mb-6">
               <div className="w-12 h-px bg-white/50" />
               <span className="text-xs uppercase tracking-[0.3em] font-bold text-white/70">Exclusive Living Experience</span>
            </div>
            
            <h1 className="text-5xl md:text-[8rem] font-bold leading-[0.85] tracking-tighter mb-8 group cursor-default">
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40 group-hover:from-white/50 transition-all duration-1000">قمة</span>
               <br />
               <span>الـرفـاهـيـة</span>
            </h1>
            
            <div className="flex flex-col md:flex-row gap-8 md:items-end justify-between border-t border-white/20 pt-8 mt-16 max-w-3xl">
               <p className="text-lg md:text-xl text-white/60 font-light max-w-md leading-relaxed">
                  اكتشف معنى جديداً للخصوصية في مساحات صُممت لتتجاوز التوقعات، مع إطلالات بانورامية تسلب الأنفاس.
               </p>
               <button className="flex items-center gap-4 group">
                  <span className="text-sm font-bold uppercase tracking-widest">Explore</span>
                  <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all duration-500">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                     </svg>
                  </div>
               </button>
            </div>
         </div>
         
         {/* Vertical Side Text */}
         <div className="absolute right-12 bottom-32 hidden lg:block rotate-90 origin-bottom-right">
            <span className="text-[10px] font-bold tracking-[0.5em] uppercase text-white/30">Scroll to discover</span>
         </div>
      </section>

      <style jsx global>{`
        @keyframes zoom {
          fom { transform: scale(1.05); }
          to { transform: scale(1.15); }
        }
      `}</style>
    </main>
  );
}
