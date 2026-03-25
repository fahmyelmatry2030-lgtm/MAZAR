'use client';

import Link from 'next/link';

export default function DesignSeven() {
  return (
    <main className="min-h-screen bg-[#EBE7DF] text-[#3E3832] selection:bg-[#7D7465] selection:text-white" style={{ fontFamily: '"Georgia", serif' }}>
      
      {/* Editorial Navbar */}
      <nav className="w-full border-b border-[#3E3832]/20 p-8 flex justify-between items-center max-w-screen-2xl mx-auto">
        <div className="text-xl tracking-[0.2em] uppercase font-bold text-[#2A2520]">Maison Elite</div>
        <div className="hidden md:flex gap-12 text-xs tracking-[0.15em] uppercase font-sans font-medium text-[#5E554D]">
          <Link href="#" className="hover:text-[#2A2520] transition-colors">Residences</Link>
          <Link href="#" className="hover:text-[#2A2520] transition-colors">Journal</Link>
          <Link href="#" className="hover:text-[#2A2520] transition-colors">Atelier</Link>
        </div>
        <button className="text-xs uppercase tracking-[0.15em] font-sans font-bold border-b-2 border-transparent hover:border-[#3E3832] transition-colors pb-1">
          Reserve
        </button>
      </nav>

      {/* Asymmetric Hero Grid */}
      <section className="max-w-screen-2xl mx-auto px-8 py-20 flex flex-col md:flex-row gap-16 items-start">
         <div className="flex-1 space-y-12 shrink-0 md:max-w-xl md:sticky md:top-32">
            <span className="block text-sm uppercase tracking-[0.3em] font-sans text-[#7D7465]">Chapter 01. The Arrival</span>
            <h1 className="text-7xl md:text-9xl font-light italic text-[#2A2520] leading-[0.9] tracking-tighter">
               ملاذ <br/>
               <span className="font-normal not-italic tracking-normal">الروح.</span>
            </h1>
            <p className="text-xl text-[#5E554D] leading-loose max-w-lg font-sans">
               استيقظ كل صباح على سيمفونية من الضوء الطبيعي وتصاميم تحتفي بالطبيعة الساحرة. 
               هنا، كل زاوية تروي قصة من الهدوء والجمال الخالص.
            </p>
            <div className="pt-8">
               <button className="text-sm font-sans uppercase tracking-[0.2em] font-bold text-[#EBE7DF] bg-[#2A2520] hover:bg-[#4A423A] transition-colors px-12 py-5 rounded-full">
                  اكتشف الوحدات
               </button>
            </div>
         </div>

         {/* Editorial Masonry Images */}
         <div className="flex-1 grid grid-cols-2 gap-6 w-full">
            <div className="col-span-2 relative aspect-[16/9] w-full group overflow-hidden">
               <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop" className="w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000 origin-center" />
               <div className="absolute inset-0 bg-blend-multiply bg-[#3E3832]/10 mix-blend-color" />
            </div>
            
            <div className="relative aspect-square w-full group overflow-hidden bg-[#7D7465]/10">
               <img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" />
            </div>
            
            <div className="relative aspect-[3/4] w-full group overflow-hidden bg-[#7D7465]/10 mt-12">
               <img src="https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" />
               <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/90 backdrop-blur-md">
                 <p className="font-sans text-xs uppercase tracking-widest text-center text-[#2A2520] font-bold">Material Study No. 4</p>
               </div>
            </div>
         </div>
      </section>

      {/* Editorial Quote Section */}
      <section className="py-40 bg-[#2A2520] text-[#EBE7DF] mt-20 px-8 text-center italic">
         <p className="text-4xl md:text-6xl font-light leading-relaxed max-w-4xl mx-auto">
            "الجمال الحقيقي لا يكمن في الزخرفة، بل في نقاء المواد <span className="text-[#AE9A80]">وصدق التفاصيل</span>."
         </p>
         <div className="w-px h-24 bg-[#AE9A80] mx-auto mt-20" />
      </section>
      
    </main>
  );
}
