import imageCompression from 'browser-image-compression';

export async function compressImage(file: File): Promise<string> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  };
  
  try {
    const compressedFile = await imageCompression(file, options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (error) => {
        reject(error);
      };
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    // Fallback to uncompressed if compression fails
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (error) => {
        reject(error);
      };
    });
  }
}

export async function compressBase64(base64Str: string): Promise<string> {
  try {
    // Convert base64 to File
    const res = await fetch(base64Str);
    const blob = await res.blob();
    const file = new File([blob], "image.jpg", { type: "image/jpeg" });
    return await compressImage(file);
  } catch (error) {
    console.error('Error converting base64 for compression:', error);
    return base64Str; // Fallback
  }
}

/**
 * Determines the CSS classes for a card image based on its source.
 * Specifically handles the zoom-hack for Snkrdunk thumbnails.
 */
export function getImageClass(url?: string): string {
  const baseClass = "w-full h-full object-contain transition-transform duration-500 group-hover:scale-105";
  if (!url) return baseClass;
  
  // If the URL is explicitly a Snkrdunk thumbnail, we apply the digital zoom hack
  // to make the circular/shoe-formatted thumbnail look like a full card.
  if (url.includes('snkrdunk_') && !url.includes('pokellector') && !url.includes('pokemon-card.com') && !url.includes('limitless')) {
    return `${baseClass} scale-[1.75] md:scale-[1.85]`;
  }
  
  // High-res sources should never be scaled/zoomed as they are full card art
  return baseClass;
}

/**
 * Returns the best possible high-resolution image for a card.
 * Handles specific overrides and general high-res conversions.
 */
export function getHighResImage(url?: string, cardName?: string, setAndNumber?: string, cardId?: string): string {
  if (!url && !cardName && !cardId) return '';

  // 1. If we ALREADY have a high-resolution URL (from Pokellector, Limitless, or Japanese Official site), return it!
  // This is what the user wants: "Read ID then image" (matching IDs in products collection)
  if (url && (
    url.includes('pokemontcg.io') || 
    url.includes('limitlesstcg') || 
    url.includes('pokemon-card.com') ||
    (url.includes('pokellector') && !url.includes('.thumb.'))
  )) {
    return url;
  }

  // 2. Specific High-Res Overrides (Prioritize manual high-quality mappings for top cards)
  const name = (cardName || '').toLowerCase();
  const idStr = (setAndNumber || '').toLowerCase();

  // Moonbreon (Umbreon VMAX Alt Art - S6a 095/069) - pokemontcg.io English set "swsh7"
  if (
    (name.includes('umbreon') && name.includes('vmax')) ||
    (name.includes('伊布') && name.includes('vmax')) ||
    (name.includes('ブラッキー') && name.includes('vmax')) ||
    name.includes('moonbreon') ||
    name.includes('月亮伊布') ||
    (idStr.includes('s6a') && (idStr.includes('95') || idStr.includes('095')))
  ) {
    return 'https://images.pokemontcg.io/swsh7/215_hires.png';
  }

  // Mew ex (SV2a 205/165)
  if ((idStr.includes('sv2a') && idStr.includes('205')) || (name.includes('夢幻') && idStr.includes('205')) || idStr.includes('43990')) {
    return 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/043990_P_MIXYUUEX.jpg';
  }

  // Pikachu with Grey Felt Hat (Vanish Pikachu - SVP 085)
  if (name.includes('戴灰') || name.includes('氈帽') || name.includes('梵谷') || (idStr.includes('svp') && idStr.includes('085'))) {
    return 'https://images.pokemontcg.io/svp/85_hires.png';
  }

  // Pikachu ex (SV8a 236/187)
  if ((idStr.includes('sv8a') && idStr.includes('236')) || (name.includes('皮卡丘') && name.includes('ex') && (idStr.includes('sv8a') || name.includes('sv8a')))) {
    return 'https://www.pokellector.com/Japanese-Terastal-Festival-ex-Expansion-Set/Pikachu-ex-Card-236.png';
  }

  // Mega Charizard X ex (SV9 110/080 SAR - Supercharged Breaker)
  if ((idStr.includes('sv9') && idStr.includes('110')) || (name.includes('噴火龍') && name.includes('x') && idStr.includes('sv9'))) {
    return 'https://www.pokellector.com/Japanese-Supercharged-Breaker-Expansion-Set/Charizard-ex-Card-110.png';
  }

  // Armored Mewtwo (Official Japanese Site 36987 / Promo 365)
  if ((idStr.includes('sm-p') || idStr.includes('smp')) && (idStr.includes('365') || idStr.includes('36987')) || name.includes('武裝') || name.includes('裝甲') || name.includes('アーマード')) {
    return 'https://www.pokemon-card.com/assets/images/card_images/large/SMP/036987_P_AMADOMYUUTSU.jpg';
  }

  // Mew ex SAR (SV4a 347/190)
  if ((idStr.includes('sv4a') && idStr.includes('347')) || (name.includes('夢幻') && idStr.includes('sv4a'))) {
    return 'https://www.pokellector.com/Japanese-Shiny-Treasure-ex-Expansion-Set/Mew-ex-Card-347.png';
  }

  // Lillie SAR (SV5a 191/170)
  if ((idStr.includes('sv9') && idStr.includes('111')) || (idStr.includes('sv5a') && idStr.includes('191')) || (name.includes('莉莉艾') && (name.includes('sar') || name.includes('sr')))) {
    return 'https://www.pokellector.com/Japanese-Battle-Boost-Expansion-Set/Lillie-Card-119.png';
  }

  // Mega Gengar ex SAR (SV9 109/080)
  if ((idStr.includes('sv9') && idStr.includes('109')) || (name.includes('耿鬼') && (idStr.includes('sv9') || name.includes('m2a')))) {
    return 'https://www.pokellector.com/Japanese-Supercharged-Breaker-Expansion-Set/Gengar-ex-Card-109.png';
  }

  // Charizard ex SAR (151 - SV2a 201/165)
  if ((idStr.includes('sv2a') && idStr.includes('201')) || (name.includes('噴火龍') && name.includes('sar') && idStr.includes('sv2a')) || idStr.includes('43986')) {
    return 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/043986_P_RIZADONEX.jpg';
  }

  // 3. Fallback to Snkrdunk ID mapping if URL is missing or low-res
  if (cardId && cardId.startsWith('snkrdunk_')) {
    // The user has uploaded webp images to firebase storage following this naming convention
    return `https://storage.googleapis.com/gen-lang-client-0326385388.firebasestorage.app/card_images/${cardId}.webp`;
  }

  // 4. Handling Pokellector Thumbnails
  if (url && url.includes('pokellector.com') && url.includes('.thumb.png')) {
    return url.replace('.thumb.png', '.png');
  }

  return url || '';
}

/**
 * Handle image loading errors by trying common fallbacks.
 * Usage: onError={(e) => handleImageError(e, originalUrl, fallbackName)}
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>, originalUrl?: string, name?: string, setAndNumber?: string) {
  const target = e.currentTarget;
  const currentSrc = target.src;
  
  // 1. If we tried Firebase Storage and it 404s, fall back to the limitlesstcg/official URL
  if (currentSrc.includes('firebasestorage.app')) {
     const overrideUrl = getHighResImage(originalUrl, name, setAndNumber); // Call without cardId to get standard manual mappings
     if (overrideUrl && overrideUrl !== currentSrc && !overrideUrl.includes('firebasestorage.app')) {
       target.src = overrideUrl;
       return;
     }

     if (originalUrl && originalUrl !== currentSrc && !originalUrl.includes('firebasestorage.app')) {
       target.src = originalUrl;
       return;
     }
  }

  // 2. If we tried pokemontcg.io and it fails, try a different stable set or placeholder
  if (currentSrc.includes('pokemontcg.io')) {
    if (currentSrc.includes('swsh7/215')) {
      target.src = 'https://images.pokemontcg.io/swp/215_hires.png'; // Example alternative
      return;
    }
  }

  // 3. Specific high-value card fallbacks
  if (name?.includes('伊布') || name?.includes('Umbreon') || name?.includes('ブラッキー') || name?.includes('月亮')) {
    if (currentSrc !== 'https://images.pokemontcg.io/swsh7/215_hires.png') {
      target.src = 'https://images.pokemontcg.io/swsh7/215_hires.png';
      return;
    }
  }

  if (name?.includes('梵谷') || name?.includes('Van Gogh')) {
    if (currentSrc !== 'https://images.pokemontcg.io/svp/85_hires.png') {
      target.src = 'https://images.pokemontcg.io/svp/85_hires.png';
      return;
    }
  }

  // 4. If we tried high-res override but it failed, try the original URL if available
  if (originalUrl && currentSrc !== originalUrl && !originalUrl.includes('firebasestorage.app')) {
    target.src = originalUrl;
    return;
  }

  // 5. Final fallback: Placeholder
  if (!target.src.includes('placehold.co')) {
    const placeholderName = name ? encodeURIComponent(name) : 'Card';
    target.src = `https://placehold.co/600x840/1a1a1a/222222?text=${placeholderName}`;
  }
}
