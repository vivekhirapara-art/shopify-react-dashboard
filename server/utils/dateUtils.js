/** Local calendar date key YYYY-MM-DD from an order timestamp or Date. */
function toLocalDateKey(value) {
  if (value == null || value === '') return null;

  const str = String(value).trim();
  const normalized = str.includes('T') ? str : str.replace(' ', 'T');
  const d = new Date(normalized);

  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function getLocalDateKeysForLastDays(days) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    keys.push(toLocalDateKey(d));
  }
  return keys;
}

module.exports = { toLocalDateKey, getLocalDateKeysForLastDays };
