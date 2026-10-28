/**
 * Shared formatting + labelling helpers so every screen speaks the same language.
 */

const LOCALE = 'en-IN';

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 22 Oct 2026 */
export function formatDate(value, fallback = 'Not recorded') {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
    : fallback;
}

/** 22 Oct 2026, 4:30 pm */
export function formatDateTime(value, fallback = 'Not recorded') {
  const date = toDate(value);
  return date
    ? date.toLocaleString(LOCALE, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : fallback;
}

/** 1,250 */
export function formatNumber(value, fallback = '—') {
  const n = Number(value);
  return value === null || value === undefined || value === '' || Number.isNaN(n)
    ? fallback
    : n.toLocaleString(LOCALE, { maximumFractionDigits: 2 });
}

/** The unit a batch is measured in: litres for milk, kilograms for paneer. */
export const unitFor = (productType) => (productType === 'MILK' ? 'L' : 'kg');

/** 1,000 L / 120 kg */
export function formatQuantity(value, productType) {
  return `${formatNumber(value)} ${unitFor(productType)}`;
}

export const PRODUCT_LABELS = {
  MILK: 'Raw milk',
  PANEER: 'Paneer',
};

export const productLabel = (productType) => PRODUCT_LABELS[productType] || 'Dairy product';

/** Batch lifecycle status, with the tone used by <StatusBadge />. */
export const BATCH_STATUS = {
  ACTIVE: { label: 'Active', tone: 'safe' },
  QUARANTINED: { label: 'On hold', tone: 'warn' },
  RECALLED: { label: 'Recalled', tone: 'danger' },
};

export const batchStatus = (status) =>
  BATCH_STATUS[status] || { label: humanize(status || 'Unknown'), tone: 'neutral' };

/** SUPPLIER_ENTERED -> Supplier entered */
export function humanize(value) {
  if (!value) return '';
  const text = String(value).replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ROLE_LABELS = {
  INSPECTOR: 'Inspector',
  QA_OFFICER: 'QA Officer',
};

export const roleLabel = (role) => ROLE_LABELS[role] || humanize(role) || 'Staff';

/** Two-letter initials for avatars. */
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Evidence tiers shown to consumers and staff. */
export const TRUST_TIERS = {
  VERIFIED: {
    label: 'Lab verified',
    detail: 'Signed off by an accredited laboratory chemist.',
    tone: 'safe',
  },
  DOCUMENT_CHECKED: {
    label: 'Certificate checked',
    detail: 'A laboratory certificate is attached and was checked.',
    tone: 'info',
  },
  SUPPLIER_ENTERED: {
    label: 'Supplier reported',
    detail: 'Entered by the supplier and not yet independently verified.',
    tone: 'warn',
  },
  UNVERIFIED: {
    label: 'Not verified',
    detail: 'No supporting evidence is attached to this record.',
    tone: 'neutral',
  },
};

export const trustTier = (tier) => TRUST_TIERS[tier] || TRUST_TIERS.UNVERIFIED;
