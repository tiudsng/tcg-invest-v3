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
 * Specifically handles the zoom-hack for Snkrdunk thumbnails to fill the container.
 */
export function getImageClass(url?: string): string {
  const baseClass = "w-full h-full object-cover transition-transform duration-500 group-hover:scale-102";
  if (!url) return baseClass;
  
  // 1. Zoom Hack for Snkrdunk Thumbnails (usually square/round with lots of empty space)
  // We apply object-cover and a significant scale to "zoom in" on the actual card.
  if (url.includes('snkrdunk.com') && !url.includes('upload_bg_removed')) {
    return "w-full h-full object-cover scale-[1.75] md:scale-[1.85] transition-transform duration-500";
  }

  // 2. Handling TCGPlayer "fit-in" square images which often have padding
  if (url.includes('tcgplayer.com') && url.includes('fit-in')) {
    // These are often square-boxed vertical cards. object-cover will crop the horizontal padding.
    return "w-full h-full object-cover transition-transform duration-500 hover:scale-[1.05]";
  }

  // 3. High-res sources from storage or official sites should remain object-contain to show full borders
  if (url.includes('firebasestorage.app') || 
      url.includes('storage.googleapis.com') ||
      url.includes('pokemontcg.io') ||
      url.includes('limitlesstcg') || 
      url.includes('_jp.jpg') ||
      url.includes('pokellector') || 
      url.includes('pokeca-chart.com') ||
      url.includes('pokemon-card.com') ||
      url.includes('storage.googleapis.com') ||
      url.includes('upload_bg_removed')) {
    return "w-full h-auto md:h-full object-contain transition-transform duration-500 hover:scale-[1.02]";
  }

  return baseClass;
}

/**
 * Returns the best possible high-resolution image for a card.
 * Handles specific overrides and general high-res conversions.
 */
export function getHighResImage(url?: string, cardName?: string, setAndNumber?: string, cardId?: string): string {
  if (!url && !cardName && !cardId) return '';

  const name = (cardName || '').toLowerCase();
  const idStr = (setAndNumber || '').toLowerCase();

  // 1. Specific High-Res Overrides (Prioritize manual high-quality mappings for top cards)

  // Moonbreon (Umbreon VMAX Alt Art - S6a 095/069)
  if (
    ((name.includes('umbreon') || name.includes('月亮伊布') || name.includes('ブラッキー') || name.includes('月光')) && name.includes('vmax')) || 
    name.includes('moonbreon') ||
    (idStr.includes('s6a') && (idStr.includes('95') || idStr.includes('095'))) ||
    (cardId && (cardId.includes('93021') || cardId.includes('rank_02')))
  ) {
    // Priority: Use the custom high-res JPG uploaded for the Japanese version
    return `https://storage.googleapis.com/gen-lang-client-0326385388.firebasestorage.app/products/snkrdunk_93021_jp.jpg?v=2`;
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
  const isCharizardX = 
    (cardId && cardId.includes('704401')) || 
    (idStr.includes('sv9') && idStr.includes('110')) || 
    (name.includes('噴火龍') && name.includes('x')) ||
    (name.includes('charizard') && name.includes('x') && idStr.includes('sv9'));

  if (isCharizardX) {
    return 'https://pokeca-chart.com/wp-content/uploads/2025/09/048516_P_MRIZADONXEX-733x1024.jpg';
  }

  // Armored Mewtwo (Official Japanese Site 36987 / Promo 365)
  if ((idStr.includes('sm-p') || idStr.includes('smp')) && (idStr.includes('365') || idStr.includes('36987')) || name.includes('武裝') || name.includes('裝甲') || name.includes('装甲') || name.includes('アーマード')) {
    return 'https://www.pokemon-card.com/assets/images/card_images/large/SMP/036987_P_AMADOMYUUTSU.jpg';
  }

  // Mew ex SAR (SV4a 347/190)
  if ((idStr.includes('sv4a') && idStr.includes('347')) || 
      (idStr.includes('347/190')) || 
      (name.includes('mew') && (idStr.includes('347') || idStr.includes('sv4a')))) {
    return 'https://www.pokellector.com/Japanese-Shiny-Treasure-ex-Expansion-Set/Mew-ex-Card-347.png';
  }

  // Lillie SAR (SV9 111/080)
  if ((idStr.includes('sv9') && idStr.includes('111')) || (name.includes('莉莉艾') && name.includes('sar'))) {
    return 'https://product-images.tcgplayer.com/fit-in/437x437/575307.jpg';
  }

  // Mega Gengar ex SAR (SV9 109/080 / Pokeca Chart M2a 240/193)
  const isMegaGengar = 
    (cardId && (cardId.includes('724996') || cardId.includes('575305'))) || 
    (idStr.includes('sv9') && idStr.includes('109')) || 
    (idStr.includes('m2a') && idStr.includes('240')) ||
    (idStr.includes('240/193')) ||
    (name.includes('耿鬼') && (name.includes('mega') || idStr.includes('109') || idStr.includes('240')));

  if (isMegaGengar) {
    return 'https://pokeca-chart.com/wp-content/uploads/2025/11/050000_P_MGENGAEX-733x1024.jpg';
  }

  // Charizard ex SAR (151 - SV2a 201/165)
  if ((idStr.includes('sv2a') && idStr.includes('201')) || 
      (idStr.includes('201/165')) ||
      (name.includes('噴火龍') && name.includes('sar') && idStr.includes('sv2a')) || 
      idStr.includes('43986')) {
    return 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/043986_P_RIZADONEX.jpg';
  }

  // 2. If we ALREADY have a high-resolution URL (from Pokellector, Limitless, or Japanese Official site), return it!
  // This is what the user wants: "Read ID then image" (matching IDs in products collection)
  // We ALSO include our Firebase Storage/Google Cloud Storage URLs as they are high-res full images.
  if (url && (
    url.includes('pokemontcg.io') || 
    url.includes('limitlesstcg') || 
    url.includes('pokemon-card.com') ||
    url.includes('firebasestorage.app') ||
    url.includes('storage.googleapis.com') ||
    (url.includes('pokellector') && !url.includes('.thumb.'))
  )) {
    return url;
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
  
  const updateSrc = (newSrc: string) => {
    target.src = newSrc;
    target.className = getImageClass(newSrc);
  };
  
  // 1. If we tried Firebase Storage or GCS and it 404s, fall back to the limitlesstcg/official URL
  if (currentSrc.includes('firebasestorage.app') || currentSrc.includes('storage.googleapis.com')) {
     const overrideUrl = getHighResImage(originalUrl, name, setAndNumber); // Call without cardId to get standard manual mappings
     if (overrideUrl && overrideUrl !== currentSrc && !overrideUrl.includes('firebasestorage.app') && !overrideUrl.includes('storage.googleapis.com')) {
       updateSrc(overrideUrl);
       return;
     }

     if (originalUrl && originalUrl !== currentSrc && !originalUrl.includes('firebasestorage.app')) {
       updateSrc(originalUrl);
       return;
     }
  }

  // 2. If we tried pokemontcg.io and it fails, try a different stable set or placeholder
  if (currentSrc.includes('pokemontcg.io')) {
    if (currentSrc.includes('swsh7/215')) {
      updateSrc('https://images.pokemontcg.io/swp/215_hires.png'); // Example alternative
      return;
    }
  }

  // 3. Specific high-value card fallbacks
  if (name?.includes('伊布') || name?.includes('Umbreon') || name?.includes('ブラッキー') || name?.includes('月亮')) {
    if (currentSrc !== 'https://images.pokemontcg.io/swsh7/215_hires.png') {
      updateSrc('https://images.pokemontcg.io/swsh7/215_hires.png');
      return;
    }
  }

  if (name?.includes('梵谷') || name?.includes('Van Gogh')) {
    if (currentSrc !== 'https://images.pokemontcg.io/svp/85_hires.png') {
      updateSrc('https://images.pokemontcg.io/svp/85_hires.png');
      return;
    }
  }

  // 4. If we tried high-res override but it failed, try the original URL if available
  if (originalUrl && currentSrc !== originalUrl && !originalUrl.includes('firebasestorage.app')) {
    updateSrc(originalUrl);
    return;
  }

  // 5. Final fallback: Placeholder (Pokemon Card Back)
  if (!target.src.includes('cardback')) {
    // Use a clearer "image coming soon" or placeholder if available, 
    // but a neutral card back is better than showing the wrong card.
    updateSrc('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png');
  }
}
