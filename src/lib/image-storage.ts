import { writeFile } from 'fs/promises';
import { join } from 'path';
import { createChildLogger } from './logger.js';

const log = createChildLogger('image-storage');

const PUBLIC_DIR = process.env.NODE_ENV === 'production'
  ? '/opt/gbp-whatsapp/public/images'
  : join(process.cwd(), 'public', 'images');

const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://wa.localengine.co.uk/images'
  : 'http://localhost:3000/images';

/**
 * Save an image to the public directory and return its public URL.
 * Images are stored as: /public/images/{imageName}
 * Accessible via: https://wa.localengine.co.uk/images/{imageName}
 */
export async function saveImage(
  imageBuffer: Buffer,
  imageName: string,
): Promise<string> {
  const filePath = join(PUBLIC_DIR, imageName);

  log.info({ imageName, size: imageBuffer.length }, 'Saving image to disk');

  await writeFile(filePath, imageBuffer);

  const publicUrl = `${BASE_URL}/${imageName}`;
  log.info({ imageName, publicUrl }, 'Image saved successfully');

  return publicUrl;
}

/**
 * Generate a unique image filename from caption and date.
 */
export function generateImageName(caption: string): string {
  const date = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();
  const slug = caption
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${slug}-${date}-${timestamp}.jpg`;
}
