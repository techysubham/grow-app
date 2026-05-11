/** Pacific timezone for Payoneer / finance date alignment. */
export const PT_TIMEZONE = 'America/Los_Angeles';

/**
 * @param {string} dateStr - 'YYYY-MM-DD' (calendar date in PT)
 * @returns {{ start: Date, end: Date }}
 */
export function getPTDayBoundsUTC(dateStr) {
  function getPTHour(d) {
    return parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: PT_TIMEZONE,
        hour: 'numeric',
        hour12: false,
        hourCycle: 'h23',
      }).format(d),
      10
    );
  }
  function getPTDateStr(d) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: PT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  function findMidnightUTC(ds) {
    const pst = new Date(`${ds}T08:00:00.000Z`);
    if (getPTDateStr(pst) === ds && getPTHour(pst) === 0) return pst;
    const pdt = new Date(`${ds}T07:00:00.000Z`);
    if (getPTDateStr(pdt) === ds && getPTHour(pdt) === 0) return pdt;
    return pst;
  }

  const start = findMidnightUTC(dateStr);
  const tmp = new Date(`${dateStr}T12:00:00.000Z`);
  tmp.setUTCDate(tmp.getUTCDate() + 1);
  const nextDateStr = tmp.toISOString().split('T')[0];
  const nextStart = findMidnightUTC(nextDateStr);
  const end = new Date(nextStart.getTime() - 1);
  return { start, end };
}

export function getTodayPtDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** YYYY-MM-DD for the instant `value` in Pacific (for dedupe + date inputs). */
export function formatYyyyMmDdPt(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatPaymentDateDisplayPt(value) {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    timeZone: PT_TIMEZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** `<input type="date">` value (YYYY-MM-DD) → UTC instant = start of that PT calendar day. */
export function ptYyyyMmDdToIsoString(yyyyMmDd) {
  const s = String(yyyyMmDd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const { start } = getPTDayBoundsUTC(s);
  return start.toISOString();
}
