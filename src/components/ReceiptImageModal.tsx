"use client";

import { useState, useEffect } from 'react';
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCw, Image as ImageIcon } from 'lucide-react';

interface ReceiptImageModalProps {
  isOpen: boolean;
  url: string | null;
  guestName?: string | null;
  title?: string;
  onClose: () => void;
}

export const toDirectImageUrl = (rawUrl: string): string => {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // Convert Google Drive view/open links to direct high-res image CDN links
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/u/0/d/${match[1]}`;
    }
  }

  // Convert Dropbox share links to direct file links
  if (url.includes('dropbox.com')) {
    return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
  }

  return url;
};

export default function ReceiptImageModal({ isOpen, url, guestName, title, onClose }: ReceiptImageModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);

  useEffect(() => {
    setScale(1);
    setRotation(0);
    setImgError(false);
    setFallbackAttempt(0);
  }, [url]);

  if (!isOpen || !url) return null;

  const isPdf = url.toLowerCase().includes('.pdf');
  const directUrl = toDirectImageUrl(url);

  // Fallback URLs if the primary image CDN fails
  const getFallbackSrc = () => {
    if (fallbackAttempt === 1 && url.includes('drive.google.com')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return directUrl;
  };

  const currentSrc = getFallbackSrc();

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="bg-[#1F1C18] border border-[#C1A68D]/40 rounded-[2.5rem] p-6 max-w-2xl w-full text-white space-y-4 shadow-2xl relative flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-2 text-[#C1A68D] font-black text-base">
            <ImageIcon size={20} className="text-[#C1A68D]" />
            <span>{title || 'معاينة المستند / الإيصال'}</span>
            {guestName && <span className="text-gray-300 text-xs font-bold">({guestName})</span>}
          </div>

          <div className="flex items-center gap-2">
            {/* Control buttons */}
            <button
              onClick={() => setScale(prev => Math.min(prev + 0.25, 3))}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all text-xs flex items-center gap-1 font-bold"
              title="تكبير الصورة"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => setScale(prev => Math.max(prev - 0.25, 0.25))}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all text-xs flex items-center gap-1 font-bold"
              title="تصغير الصورة"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={() => setRotation(prev => (prev + 90) % 360)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all text-xs flex items-center gap-1 font-bold"
              title="تدوير الصورة"
            >
              <RotateCw size={16} />
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all mr-2"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Image / Document Container */}
        <div className="relative flex-1 rounded-2xl overflow-hidden bg-black/80 border border-white/10 flex items-center justify-center min-h-[350px] max-h-[65vh] p-4">
          {isPdf ? (
            <iframe
              src={url}
              className="w-full h-[60vh] rounded-xl border-0 bg-white"
              title="معاينة ملف PDF"
            />
          ) : !imgError ? (
            <img
              src={currentSrc}
              alt="إثبات الدفع أو الهوية"
              className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-200"
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
              }}
              onError={() => {
                if (fallbackAttempt === 0) {
                  setFallbackAttempt(1);
                } else {
                  setImgError(true);
                }
              }}
            />
          ) : (
            <div className="w-full h-[55vh] min-h-[400px] flex flex-col items-center justify-center bg-white rounded-xl overflow-hidden shadow-inner">
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`}
                className="w-full h-full border-0"
                title="معاينة إثبات الدفع المباشرة"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-2 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black py-3 rounded-xl text-xs text-center transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <ExternalLink size={16} />
            <span>فتح الصورة بالحجم الكامل في نافذة مستقلة</span>
          </a>
          <a
            href={currentSrc || url}
            download="payment-receipt.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/10 hover:bg-white/20 text-white font-black px-5 py-3 rounded-xl text-xs transition-all flex items-center gap-1.5"
          >
            <Download size={16} />
            <span>تحميل</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white font-bold px-5 py-3 rounded-xl text-xs transition-all"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}
