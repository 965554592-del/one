import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Uploads a file to Firebase Storage under the given folder and returns
 * its public download URL. Files persist across server restarts (unlike
 * the Render-hosted /api/upload endpoint).
 */
export async function uploadFileToStorage(file: File, folder: string): Promise<string> {
  // Sanitize folder + generate a unique filename to avoid collisions.
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'uploads';
  const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const objectRef = ref(storage, `${safeFolder}/${filename}`);
  await uploadBytes(objectRef, file, { contentType: file.type || undefined });
  return await getDownloadURL(objectRef);
}

/**
 * Best-effort deletion of a Firebase Storage object by download URL.
 * Silently ignores objects hosted elsewhere (e.g. legacy /uploads/ URLs)
 * or already-missing objects.
 */
export async function deleteFileFromStorage(url: string): Promise<void> {
  if (!url || typeof url !== 'string') return;
  if (!url.includes('firebasestorage.googleapis.com')) return;
  try {
    const objectRef = ref(storage, url);
    await deleteObject(objectRef);
  } catch (err) {
    console.warn('[storage] delete skipped:', (err as Error)?.message || err);
  }
}
