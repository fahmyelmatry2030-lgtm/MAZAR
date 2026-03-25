'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DesignSwitcher() {
  const pathname = usePathname();

  const designs = [
    { name: 'الأصلي', href: '/' },
    { name: 'مودرن هادئ', href: '/designs/design-1' },
    { name: 'سينمائي فخم', href: '/designs/design-2' },
    { name: 'طبيعي دافئ', href: '/designs/design-3' },
    { name: 'تقني مستقبلي', href: '/designs/design-4' },
  ];

  if (!pathname.startsWith('/designs') && pathname !== '/') return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 p-2 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl animate-fade-in ring-1 ring-white/5">
      {designs.map((design) => {
        const isActive = pathname === design.href;
        return (
          <Link
            key={design.href}
            href={design.href}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 whitespace-nowrap ${
              isActive 
                ? 'bg-gold text-navy shadow-lg shadow-gold/20 scale-105' 
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            {design.name}
          </Link>
        );
      })}
    </div>
  );
}
