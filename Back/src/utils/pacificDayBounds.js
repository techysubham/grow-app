/**
 * Pacific (America/Los_Angeles) calendar day → exact UTC range.
 * Same algorithm as used in orders / eBay routes (DST-safe).
 *
 * @param {string} dateStr - 'YYYY-MM-DD' interpreted as a calendar date in PT
 * @returns {{ start: Date, end: Date }}
 */
export function getPTDayBoundsUTC(dateStr) {
  function getPTHour(d) {
    return parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        hour12: false,
        hourCycle: 'h23',
      }).format(d),
      10
    );
  }
  function getPTDateStr(d) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
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
