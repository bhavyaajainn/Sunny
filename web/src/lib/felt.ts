// "I feel it" count, per local day, kept only on this device.
const KEY = 'sunny.felt';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function readFelt(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const v = JSON.parse(raw) as { date?: unknown; count?: unknown };
    return v.date === today() && typeof v.count === 'number' ? v.count : 0;
  } catch {
    return 0;
  }
}

export function addFelt(): number {
  const n = readFelt() + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify({ date: today(), count: n }));
  } catch {
    // Storage unavailable (private mode): the count just won't persist.
  }
  return n;
}

export function feltText(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? 'Felt once today. Keep it glowing.' : `Felt ${n} times today. You're on fire.`;
}
