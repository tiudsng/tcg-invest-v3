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
 * Returns the high-resolution version of an image URL.
 * Specifically converts Pokellector .thumb.png to .png.
 */
export function getHighResImage(url?: string): string {
  if (!url) return '';
  // Check if it's a pokellector URL containing .thumb.png
  if (url.includes('pokellector.com') && url.includes('.thumb.png')) {
    return url.replace('.thumb.png', '.png');
  }
  return url;
}
