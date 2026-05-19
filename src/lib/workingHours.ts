// Working hours helper.
// Configure via env (build-time) or window.__WORKING_HOURS__ (runtime override).
//
// Format: "MON-FRI 09:00-18:00;SAT 10:00-14:00" (timezone via VITE_WORKING_HOURS_TZ).
// Days: MON TUE WED THU FRI SAT SUN, also accepts ranges like MON-FRI.

export interface WorkingHoursStatus {
  isOpen: boolean;
  /** Human-readable schedule string. */
  schedule: string;
  /** IANA timezone, e.g. Asia/Shanghai */
  timezone: string;
}

const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Slot {
  days: Set<number>; // 0=Sun..6=Sat
  startMin: number;
  endMin: number;
}

function parseTime(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

function parseDayPart(part: string): number[] {
  const p = part.trim().toUpperCase();
  if (p.includes('-')) {
    const [a, b] = p.split('-');
    const ai = DAY_KEYS.indexOf(a);
    const bi = DAY_KEYS.indexOf(b);
    if (ai < 0 || bi < 0) return [];
    const out: number[] = [];
    let i = ai;
    while (true) {
      out.push(i);
      if (i === bi) break;
      i = (i + 1) % 7;
      if (out.length > 7) break;
    }
    return out;
  }
  const idx = DAY_KEYS.indexOf(p);
  return idx >= 0 ? [idx] : [];
}

function parseSchedule(raw: string): Slot[] {
  return raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      // "MON-FRI 09:00-18:00"
      const m = entry.match(/^([A-Za-z,\-]+)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
      if (!m) return null;
      const dayPart = m[1];
      const days = new Set<number>();
      dayPart.split(',').forEach((d) => parseDayPart(d).forEach((n) => days.add(n)));
      return { days, startMin: parseTime(m[2]), endMin: parseTime(m[3]) } as Slot;
    })
    .filter((x): x is Slot => !!x);
}

function getNowInTz(tz: string): { day: number; minutes: number } {
  // Use Intl to extract weekday/hour/minute in given TZ.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hh = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const mm = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { day: map[wd] ?? 0, minutes: (hh % 24) * 60 + mm };
}

/** Allow runtime override from Firestore siteSettings. */
export function setWorkingHoursOverride(hours?: string, tz?: string) {
  if (typeof window === 'undefined') return;
  if (hours) (window as any).__WORKING_HOURS__ = hours;
  if (tz) (window as any).__WORKING_HOURS_TZ__ = tz;
}

export function getWorkingHoursStatus(): WorkingHoursStatus {
  const w: any = typeof window !== 'undefined' ? window : {};
  const raw =
    (w.__WORKING_HOURS__ as string | undefined) ||
    (import.meta.env.VITE_WORKING_HOURS as string | undefined) ||
    'MON-FRI 09:00-18:00';
  const tz =
    (w.__WORKING_HOURS_TZ__ as string | undefined) ||
    (import.meta.env.VITE_WORKING_HOURS_TZ as string | undefined) ||
    'Asia/Shanghai';

  const slots = parseSchedule(raw);
  const now = getNowInTz(tz);
  const isOpen = slots.some(
    (s) => s.days.has(now.day) && now.minutes >= s.startMin && now.minutes < s.endMin
  );
  return { isOpen, schedule: raw, timezone: tz };
}
