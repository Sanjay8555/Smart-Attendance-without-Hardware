import jsQR from 'jsqr';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Robust, multi-engine QR Code decoder for uploaded files and images.
 * Tries:
 * 1. Native BarcodeDetector API (fastest on Chromium/Android/iOS 17+)
 * 2. jsQR on original resolution canvas (with attemptBoth inverted & normal)
 * 3. jsQR on pre-processed normalized/scaled canvas (for high-res phone camera photos)
 * 4. Html5Qrcode.scanFile fallback
 */
export async function decodeQrFromImageFile(file) {
  if (!file) {
    throw new Error('No image file selected.');
  }

  // 1. Try Native BarcodeDetector if available
  if ('BarcodeDetector' in window) {
    try {
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const barcodes = await barcodeDetector.detect(bitmap);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch (err) {
      console.warn('Native BarcodeDetector pass failed, falling back to jsQR:', err);
    }
  }

  // Helper to load file as HTMLImageElement
  const loadImage = () =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image file.'));
      };
      img.src = url;
    });

  let img;
  try {
    img = await loadImage();
  } catch (err) {
    throw new Error('Could not read image file. Please provide a valid JPG/PNG/WebP image.');
  }

  // 2. Multi-resolution Canvas scanning with jsQR
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Test resolutions: [original, 1200px max, 800px max, 500px max]
  const scales = [1.0];
  const maxDim = Math.max(img.width, img.height);
  if (maxDim > 1200) scales.push(1200 / maxDim);
  if (maxDim > 800) scales.push(800 / maxDim);
  if (maxDim > 500) scales.push(500 / maxDim);

  for (const scale of scales) {
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    // Run jsQR with both regular and inverted polarity detection
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });

    if (code && code.data && code.data.trim()) {
      return code.data.trim();
    }
  }

  // 3. Fallback: Html5Qrcode.scanFile
  try {
    let dummyContainer = document.getElementById('qr-hidden-decoder-box');
    if (!dummyContainer) {
      dummyContainer = document.createElement('div');
      dummyContainer.id = 'qr-hidden-decoder-box';
      dummyContainer.style.display = 'none';
      document.body.appendChild(dummyContainer);
    }
    const html5Qr = new Html5Qrcode('qr-hidden-decoder-box');
    const result = await html5Qr.scanFile(file, false);
    if (result && result.trim()) {
      return result.trim();
    }
  } catch (e) {
    console.warn('Html5Qrcode scanFile fallback failed:', e);
  }

  throw new Error('No QR code detected in this photo. Please ensure the QR code is clear, well-lit, and in focus.');
}
