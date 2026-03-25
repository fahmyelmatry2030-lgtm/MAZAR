'use client';
import React from 'react';

export default function PremiumDashboardOne() {
  return (
    <div className="flex h-screen bg-[#09090b] text-gray-100 font-sans overflow-hidden antialiased">
        {/* Sidebar */}
        <aside className="w-64 bg-[#09090b] border-r border-white/5 flex flex-col">
            <div className="h-20 flex items-center px-8 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-[1px]">
                        <div className="w-full h-full bg-[#09090b] rounded-[7px] flex items-center justify-center">
                            <div className="w-3 h-3 bg-white rounded-full shadow-[0_0_10px_white]" />
                        </div>
                    </div>
                    <span className="font-semibold text-lg tracking-tight text-white">Nokba<span className="text-white/40 font-light">PMS</span></span>
                </div>
            </div>
            
            <nav className="flex-1 py-8 px-4 space-y-2">
                <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-4 mb-4">Main Menu</div>
                {[
                    { name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', active: true },
                    { name: 'Properties', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', active: false },
                    { name: 'Bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', active: false },
                    { name: 'Tenants', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', active: false },
                    { name: 'Financials', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', active: false },
                ].map((item, i) => (
                    <a key={i} href="#" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${item.active ? 'bg-white/5 text-white shadow-[inset_2px_0_0_#818cf8]' : 'text-white/40 hover:text-white hover:bg-white/[0.02]'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                        </svg>
                        <span className="text-sm font-medium">{item.name}</span>
                    </a>
                ))}
            </nav>

            <div className="p-6 border-t border-white/5">
                <div className="flex items-center gap-3">
                    <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="User" className="w-10 h-10 rounded-full border border-white/10" />
                    <div>
                        <div className="text-sm font-medium text-white">Ahmed Fahmy</div>
                        <div className="text-xs text-white/40">Super Admin</div>
                    </div>
                </div>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#09090b] relative">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
            
            {/* Header */}
            <header className="h-20 flex items-center justify-between px-10 border-b border-white/5 z-10 shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-semibold text-white tracking-tight">Overview</h1>
                    <span className="text-xs text-white/40 font-medium mt-1">Welcome back, here is your property summary.</span>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 text-white/40 group-focus-within:text-white/80 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input type="text" placeholder="Search properties..." className="bg-[#18181b] border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all w-64" />
                    </div>
                    <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors relative">
                        <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[#09090b]" />
                        <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </button>
                    <button className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                        + New Booking
                    </button>
                </div>
            </header>

            {/* Scrollable Area */}
            <div className="flex-1 overflow-auto p-10 z-10">
                <div className="max-w-7xl mx-auto space-y-8">
                    
                    {/* Metrics Grid */}
                    <div className="grid grid-cols-4 gap-6">
                        {[
                            { title: 'Total Revenue', value: '$128,450', trend: '+12.5%', isUp: true },
                            { title: 'Occupancy Rate', value: '92.4%', trend: '+2.1%', isUp: true },
                            { title: 'Pending Requests', value: '24', trend: '-5.0%', isUp: true },
                            { title: 'Active Units', value: '142', trend: '0%', isUp: true },
                        ].map((metric, i) => (
                            <div key={i} className="bg-[#18181b] border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                                <h3 className="text-sm font-medium text-white/50 mb-2">{metric.title}</h3>
                                <div className="text-3xl font-semibold text-white tracking-tight mb-4">{metric.value}</div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${metric.isUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                        {metric.trend}
                                    </span>
                                    <span className="text-xs text-white/30">vs last month</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chart and Activity */}
                    <div className="grid grid-cols-3 gap-6">
                        {/* Chart Panel */}
                        <div className="col-span-2 bg-[#18181b] border border-white/5 rounded-2xl p-6 flex flex-col h-[400px] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Revenue Overview</h2>
                                    <p className="text-xs text-white/40 mt-1">Monthly performance metric</p>
                                </div>
                                <select className="bg-[#09090b] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/70 outline-none focus:ring-2 focus:ring-indigo-500/50">
                                    <option>This Year</option>
                                    <option>Last Year</option>
                                </select>
                            </div>
                            
                            {/* SVG Chart Mockup */}
                            <div className="flex-1 relative w-full h-full flex items-end">
                                {/* Y-Axis */}
                                <div className="absolute left-0 inset-y-0 flex flex-col justify-between text-[10px] text-white/30 pb-6">
                                    <span>$150k</span><span>$100k</span><span>$50k</span><span>$0</span>
                                </div>
                                {/* Grid lines */}
                                <div className="absolute inset-x-8 inset-y-0 flex flex-col justify-between pb-6 opacity-5 pointer-events-none">
                                    <div className="w-full h-px bg-white" /><div className="w-full h-px bg-white" /><div className="w-full h-px bg-white" /><div className="w-full h-px bg-white" />
                                </div>
                                {/* Line Path */}
                                <svg className="absolute inset-x-8 inset-y-0 w-[calc(100%-2rem)] h-[calc(100%-1.5rem)]" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <defs>
                                        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
                                            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M0,80 L10,60 L20,70 L30,40 L40,50 L50,20 L60,30 L70,10 L80,25 L90,5 L100,15 L100,100 L0,100 Z" fill="url(#gradient)" />
                                    <path d="M0,80 L10,60 L20,70 L30,40 L40,50 L50,20 L60,30 L70,10 L80,25 L90,5 L100,15" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx="50" cy="20" r="2" fill="#fff" className="animate-pulse" />
                                    <circle cx="70" cy="10" r="2" fill="#fff" className="animate-pulse" />
                                    <circle cx="90" cy="5" r="2" fill="#fff" className="animate-pulse" />
                                </svg>
                                {/* X-Axis */}
                                <div className="absolute bottom-0 inset-x-8 flex justify-between text-[10px] text-white/30">
                                    <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="col-span-1 bg-[#18181b] border border-white/5 rounded-2xl p-6 flex flex-col h-[400px] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                            <h2 className="text-lg font-semibold text-white mb-6">Recent Requests</h2>
                            <div className="flex-1 overflow-auto space-y-4 pr-2 custom-scrollbar">
                                {[
                                    { name: 'Sarah Jenkins', unit: 'Apt 4B - Elite', action: 'Viewing Request', time: '10m ago', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
                                    { name: 'Michael Chen', unit: 'Penthouse 2', action: 'Maintenance', time: '1h ago', img: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
                                    { name: 'Emma Watson', unit: 'Villa 14', action: 'Payment Sent', time: '3h ago', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
                                    { name: 'David Smith', unit: 'Apt 12A', action: 'Contract Signed', time: '5h ago', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
                                ].map((req, i) => (
                                    <div key={i} className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer border border-transparent hover:border-white/5">
                                        <img src={req.img} alt={req.name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/10" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white truncate">{req.name}</div>
                                            <div className="text-xs text-indigo-400 mt-0.5">{req.action}</div>
                                            <div className="text-[10px] text-white/40 mt-1">{req.unit} • {req.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Properties Table */}
                    <div className="bg-[#18181b] border border-white/5 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-b from-white/[0.02] to-transparent">
                            <h2 className="text-lg font-semibold text-white">Active Properties</h2>
                            <button className="text-sm text-indigo-400 font-medium hover:text-indigo-300 transition-colors">View All Directory</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#09090b]/50 border-b border-white/5 text-[11px] uppercase tracking-wider text-white/40 font-medium">
                                        <th className="px-6 py-4 font-medium">Property Name</th>
                                        <th className="px-6 py-4 font-medium">Location</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium text-right">Price/Mo</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-white/5">
                                    {[
                                        { name: 'The Grand Heights', location: 'Downtown District', status: 'Occupied', sc: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', price: '$4,500' },
                                        { name: 'Azure Penthouse', location: 'Marina Bay', status: 'Available', sc: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', price: '$8,200' },
                                        { name: 'Oakwood Residences', location: 'West End', status: 'Maintenance', sc: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', price: '$3,100' },
                                        { name: 'Elite Tower V', location: 'Financial District', status: 'Occupied', sc: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', price: '$5,800' },
                                    ].map((row, i) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors group cursor-pointer">
                                            <td className="px-6 py-4 font-medium text-white/90 group-hover:text-white transition-colors">{row.name}</td>
                                            <td className="px-6 py-4 text-white/50">{row.location}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide ${row.sc}`}>{row.status}</span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-right text-white/80">{row.price}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>
        </main>
    </div>
  );
}
