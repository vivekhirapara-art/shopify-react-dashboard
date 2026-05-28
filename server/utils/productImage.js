function normalizeProductImageUrl(url) {
  if (url == null || url === '') return null;
  let normalized = String(url).trim();
  if (!normalized) return null;
  if (normalized.startsWith('//')) normalized = `https:${normalized}`;
  if (normalized.startsWith('http://')) {
    normalized = `https://${normalized.slice(7)}`;
  }
  return normalized;
}

module.exports = { normalizeProductImageUrl };
