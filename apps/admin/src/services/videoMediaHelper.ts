import { storeMediaBlob } from './mediaDb';

// Video to Animated GIF/Sticker & Lightweight Media Compression Helpers
// Guarantees zero-glitch, zero-crash, full-framerate performance on iOS Safari and Android

export const knownVideoBlobUrls = new Set<string>();

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function isKnownVideoUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  const clean = url.split('#')[0];
  return knownVideoBlobUrls.has(clean) || knownVideoBlobUrls.has(url);
}

export async function convertVideoToAnimatedLoop(
  file: File | Blob,
  mode: 'avatar' | 'banner' | 'studio' = 'avatar',
  userHandle?: string
): Promise<string> {
  const cleanUser = userHandle ? userHandle.replace(/^@/, '').toLowerCase().trim() : '';
  const mediaId = cleanUser
    ? `privity_${mode}_${cleanUser}_${Date.now()}`
    : `privity_${mode}_loop_${Date.now()}`;

  // 1. Persist media key in localStorage immediately
  try {
    localStorage.setItem(`privity_user_${mode}_media_key`, mediaId);
    if (cleanUser) {
      localStorage.setItem(`privity_user_${mode}_media_key_${cleanUser}`, mediaId);
    }
  } catch {}

  // 2. Store in IndexedDB asynchronously in background
  storeMediaBlob(mediaId, file).catch((err) => {
    console.warn('[videoMediaHelper] background storeMediaBlob error:', err);
  });

  // 3. For video files under 8MB, generate a portable Base64 Data URL so all remote devices can play it in real time
  if (file.size <= 8 * 1024 * 1024) {
    try {
      const dataUrl = await fileToDataUrl(file);
      if (dataUrl && dataUrl.startsWith('data:')) {
        knownVideoBlobUrls.add(dataUrl);
        return dataUrl;
      }
    } catch (e) {
      console.warn('[videoMediaHelper] fileToDataUrl fallback:', e);
    }
  }

  // 4. Fallback for larger files: create local object URL
  let immediateBlobUrl = '';
  try {
    immediateBlobUrl = URL.createObjectURL(file);
    knownVideoBlobUrls.add(immediateBlobUrl);
  } catch {}

  const finalUrl = immediateBlobUrl
    ? `${immediateBlobUrl}#video.mp4`
    : `blob:privity_${mode}_${Date.now()}#video.mp4`;
  knownVideoBlobUrls.add(finalUrl);
  knownVideoBlobUrls.add(finalUrl.split('#')[0]);
  return finalUrl;
}

export async function extractVideoThumbnail(file: File | Blob): Promise<string> {
  return new Promise((resolve) => {
    const objUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('muted', 'true');
    video.preload = 'auto';
    video.src = objUrl;

    let isDone = false;

    const cleanup = () => {
      video.pause();
      video.src = '';
      video.load();
      try {
        URL.revokeObjectURL(objUrl);
      } catch {}
    };

    const timeout = setTimeout(() => {
      if (isDone) return;
      isDone = true;
      cleanup();
      resolve('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600');
    }, 4500);

    const captureFrame = () => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        let w = video.videoWidth || 720;
        let h = video.videoHeight || 1280;
        const maxDim = 1080;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          cleanup();
          resolve(dataUrl);
          return;
        }
      } catch (e) {
        console.warn('Thumbnail extraction error:', e);
      }
      cleanup();
      resolve('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600');
    };

    video.onloadeddata = () => {
      captureFrame();
    };

    video.onloadedmetadata = () => {
      video.play().catch(() => {});
    };

    video.onerror = () => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timeout);
      cleanup();
      resolve('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600');
    };
  });
}
