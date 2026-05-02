import React, { useRef, useState } from 'react';
import { ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export const ImageCarousel: React.FC<{ images: string[], title: string, id: string, showArrows?: boolean, showImageCount?: boolean }> = ({ images, title, id, showArrows = true, showImageCount = true }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.offsetWidth;
    const index = Math.round(scrollLeft / width);
    setActiveIndex(index);
  };

  const scrollToIndex = (e: React.MouseEvent, index: number) => {
     e.stopPropagation();
     e.preventDefault();
     if (!scrollRef.current) return;
     const width = scrollRef.current.offsetWidth;
     scrollRef.current.scrollTo({ left: width * index, behavior: 'smooth' });
  };

  if (!images || images.length === 0) {
    return (
       <div className="w-full h-full bg-gray-100 dark:bg-[#111] relative">
         <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-bold text-sm">無圖片</div>
       </div>
    );
  }

  return (
    <div className="relative w-full h-full group/carousel bg-[#111] overflow-hidden">
        {/* Blurred background using the active image */}
        <div 
            className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-110 transition-all duration-500"
            style={{ backgroundImage: `url(${images[activeIndex]})` }}
        />
        
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative z-10 w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {images.map((img, i) => (
             <div key={i} className="min-w-full h-full shrink-0 snap-center flex items-center justify-center p-0">
                 <img 
                    src={img} 
                    alt={`${title} - image ${i + 1}`} 
                    className="w-full h-full object-cover drop-shadow-2xl transition-transform duration-700 group-hover:scale-[1.05]" 
                    referrerPolicy="no-referrer"
                    loading={i === 0 ? "eager" : "lazy"}
                    onError={(e) => {
                       (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${id}-${i}/600/800`;
                    }}
                 />
             </div>
          ))}
        </div>

        {images.length > 1 && showArrows && (
            <>
              {/* Arrows */}
              <button 
                 onClick={(e) => scrollToIndex(e, Math.max(0, activeIndex - 1))}
                 className={cn(
                   "absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all z-20 backdrop-blur-md", 
                   activeIndex === 0 ? "opacity-0 pointer-events-none" : "opacity-100"
                 )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                 onClick={(e) => scrollToIndex(e, Math.min(images.length - 1, activeIndex + 1))}
                 className={cn(
                   "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all z-20 backdrop-blur-md", 
                   activeIndex === images.length - 1 ? "opacity-0 pointer-events-none" : "opacity-100"
                 )}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
        )}

        {images.length > 1 && (
            <>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
                 {images.map((_, i) => (
                   <div 
                      key={i} 
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300 shadow-sm",
                        i === activeIndex ? "bg-white w-4" : "bg-white/40 w-1.5"
                      )}
                   />
                 ))}
              </div>
              {showImageCount && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded flex items-center gap-1 z-20 text-white/90">
                  <ImageIcon className="w-3 h-3" />
                  <span className="text-[10px] font-bold leading-none pt-0.5">{images.length}</span>
                </div>
              )}
            </>
        )}
        
        {/* Scoped CSS to hide scrollbar for webkit */}
        <style dangerouslySetInnerHTML={{__html: `
          .scrollbar-hide::-webkit-scrollbar {
             display: none;
          }
        `}} />
    </div>
  );
};
