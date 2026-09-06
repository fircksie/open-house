function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (key: string) => Number(parts.find(p => p.type === key)?.value);
  return { day: Date.UTC(get('year'), get('month') - 1, get('day')), hour: get('hour') };
}
export function friendlyMatchTime(iso: string | undefined, timezone: string, now: Date) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return 'Time TBD';
  const date = new Date(iso);
  const local = localParts(date, timezone);
  const today = localParts(now, timezone);
  const days = Math.round((local.day - today.day) / 86400000);
  const day = days === 0 ? (local.hour >= 18 && date > now ? 'Tonight' : 'Today') : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' : new Intl.DateTimeFormat('en-ZA', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  const time = new Intl.DateTimeFormat('en-ZA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return day + ' · ' + time;
}
