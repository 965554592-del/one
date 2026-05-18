// Centralized API base URL helper.
// In dev (vite middleware + same-origin server) leave VITE_API_BASE_URL empty
// so relative paths "/api/..." and "/uploads/..." work as-is.
// In production (frontend on SiteGround, backend on Render etc.) set
// VITE_API_BASE_URL=https://your-backend.example.com at build time.
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
export const API_BASE = RAW_BASE.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}
