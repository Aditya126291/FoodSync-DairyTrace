export function extractBatchId(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  if (value.startsWith('{') && value.endsWith('}')) {
    try {
      const parsed = JSON.parse(value);
      const candidate =
        parsed.batch_id ||
        parsed.batchId ||
        parsed.id ||
        parsed.batch ||
        parsed.passport_url ||
        parsed.url;
      if (candidate) {
        const extracted = extractBatchId(candidate);
        if (extracted) return extracted;
      }
    } catch {
      // Ignore JSON parse failure and proceed
    }
  }

  try {
    const url = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
    const passportMatch = url.pathname.match(/\/(?:api\/public\/)?passport\/([^/?#]+)/i);
    if (passportMatch) return decodeURIComponent(passportMatch[1]).trim().toUpperCase();

    const batchRouteMatch = url.pathname.match(/\/api\/batches\/([^/?#]+)(?:\/qr)?/i);
    if (batchRouteMatch) return decodeURIComponent(batchRouteMatch[1]).trim().toUpperCase();

    const queryBatch = url.searchParams.get('batch_id') || url.searchParams.get('batch');
    if (queryBatch) return decodeURIComponent(queryBatch).trim().toUpperCase();
  } catch {
    // Raw batch IDs and regex fallbacks supported below.
  }

  const embeddedMatch = value.match(/(?:passport|batches)\/([a-z0-9._-]+)/i);
  if (embeddedMatch) return embeddedMatch[1].trim().toUpperCase();

  return /^[a-z0-9][a-z0-9._-]{1,63}$/i.test(value) ? value.toUpperCase() : null;
}
