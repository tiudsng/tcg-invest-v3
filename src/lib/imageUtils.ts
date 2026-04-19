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
export function getHighResImage(url?: string, cardName?: string, setAndNumber?: string): string {
  if (!url && !cardName) return '';

  // 1. Specific High-Res Overrides (Prioritize manual high-quality mappings)
  const name = (cardName || '').toLowerCase();
  const idStr = (setAndNumber || '').toLowerCase();

  // Moonbreon (Umbreon VMAX Alt Art - S6a 095/069)
  if (
    (name.includes('umbreon') && name.includes('vmax')) || 
    (name.includes('伊布') && name.includes('vmax')) || 
    (name.includes('ブラッキー') && name.includes('vmax')) ||
    name.includes('moonbreon') ||
    (idStr.includes('s6a') && (idStr.includes('95') || idStr.includes('095')))
  ) {
    // Official high-res JP image - highly stable
    return 'https://www.pokemon-card.com/assets/images/card_images/large/S6a/039433_P_BURAKKIVMAX.jpg';
  }

  // Mew ex (SV2a 205/165)
  if (idStr.includes('sv2a') && idStr.includes('205')) {
    return 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/044195_P_MIYYUUEX.jpg';
  }

  // Pikachu with Grey Felt Hat (SVP 085)
  if (name.includes('戴灰') || name.includes('氈帽') || (idStr.includes('svp') && idStr.includes('085'))) {
    return 'https://images.pokemontcg.io/svp/85_hires.png';
  }

  // Pikachu ex (SV8a 236/187)
  if ((idStr.includes('sv8a') && idStr.includes('236')) || (name.includes('皮卡丘') && name.includes('ex') && idStr.includes('sv8a'))) {
    return 'https://www.pokemon-card.com/assets/images/card_images/large/SV8a/047101_P_PIKAOCHYUUEX.jpg';
  }

  // Mega Charizard X ex (SV9 110/080 SAR)
  if ((idStr.includes('sv9') && idStr.includes('110')) || (name.includes('噴火龍') && name.includes('x') && idStr.includes('sv9'))) {
    // Top-tier high-res source from Limitless
    return 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV9/110.png';
  }

  // 2. Handling Pokellector Thumbnails - Try both .png and .jpg
  if (url && url.includes('pokellector.com') && url.includes('.thumb.png')) {
    return url.replace('.thumb.png', '.png');
  }

  // 3. Fallback to provided URL
  return url || '';
}

/**
 * Handle image loading errors by trying common fallbacks.
 * Usage: onError={(e) => handleImageError(e, originalUrl, fallbackName)}
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>, originalUrl?: string, name?: string) {
  const target = e.currentTarget;
  const currentSrc = target.src;
  
  // 1. If we tried high-res Pokellector (.png), fall back to official JP large JPG or Limitless
  if (currentSrc.includes('pokellector.com') && currentSrc.endsWith('.png')) {
    // Try Limitless TCG pattern if we can guess the set from URL
    if (currentSrc.includes('S6a')) {
      target.src = 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/S6a/S6a_095.png';
      return;
    }
  }

  // 2. If it's a known high-value card that failed, try official JP large path
  if (name?.includes('伊布') || name?.includes('Umbreon') || name?.includes('ブラッキー')) {
    if (currentSrc !== 'https://www.pokemon-card.com/assets/images/card_images/large/S6a/039433_P_BURAKKIVMAX.jpg') {
      target.src = 'https://www.pokemon-card.com/assets/images/card_images/large/S6a/039433_P_BURAKKIVMAX.jpg';
      return;
    }
  }

  // 3. If we tried high-res override but it failed, try the original URL if available
  if (originalUrl && currentSrc !== originalUrl) {
    target.src = originalUrl;
    return;
  }

  // 4. Final fallback: Placeholder
  if (!target.src.includes('placehold.co')) {
    const placeholderName = name ? encodeURIComponent(name) : 'Card';
    target.src = `https://placehold.co/600x840/1a1a1a/ffffff?text=${placeholderName}`;
  }
}
