export function minuteToTimeStr(m: number): string {
  const h  = Math.floor(m / 60) % 24;
  const mn = m % 60;
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(mn).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function getCurrentMinute(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

export function clockToMinute(h: number, m: number, ap: 'AM' | 'PM'): number {
  let h24 = h;
  if (h24 === 12) h24 = 0;
  if (ap === 'PM') h24 += 12;
  return Math.max(0, Math.min(1439, h24 * 60 + m));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function polarToCart(
  cx: number, cy: number, r: number, angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
