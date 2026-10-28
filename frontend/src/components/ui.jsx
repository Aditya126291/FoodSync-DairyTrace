import React, { useEffect, useId, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  LoaderCircle,
  Milk,
  ShieldAlert,
  X,
} from 'lucide-react';
import { batchStatus } from '../utils/format';

/**
 * DairyTrace UI kit. Every screen should compose these primitives together with
 * the component classes in index.css so spacing, colour and wording stay consistent.
 */

export const cx = (...parts) => parts.filter(Boolean).join(' ');

const TONE_ICON = {
  safe: CheckCircle2,
  warn: AlertTriangle,
  danger: ShieldAlert,
  info: Info,
  neutral: Info,
};

/* ------------------------------------------------------------------ */
/* Brand                                                                */
/* ------------------------------------------------------------------ */

export function Logo({ subtitle, onClick, href, className = '' }) {
  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-800 text-white shadow-sm">
        <Milk className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 text-left leading-tight">
        <span className="block truncate font-display text-xl font-semibold text-ink-900">
          DairyTrace
        </span>
        {subtitle && <span className="block truncate text-xs text-ink-500">{subtitle}</span>}
      </span>
    </>
  );
  const classes = cx(
    'inline-flex min-w-0 items-center gap-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2',
    className
  );
  if (href || !onClick) {
    return (
      <a href={href || '/'} onClick={onClick} className={classes} aria-label="DairyTrace home">
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} aria-label="DairyTrace home">
      {content}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badges, alerts, empty/loading states                                 */
/* ------------------------------------------------------------------ */

export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={cx('badge', `badge-${tone}`, className)}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Batch lifecycle badge: Active / On hold / Recalled. */
export function StatusBadge({ status, className = '' }) {
  const info = batchStatus(status);
  return (
    <Badge tone={info.tone} icon={TONE_ICON[info.tone]} className={className}>
      {info.label}
    </Badge>
  );
}

export function Alert({ tone = 'info', title, children, icon, onClose, className = '', role }) {
  const Icon = icon || (tone === 'danger' ? AlertCircle : TONE_ICON[tone] || Info);
  return (
    <div
      role={role || (tone === 'danger' ? 'alert' : 'status')}
      className={cx('alert', `alert-${tone}`, className)}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss message"
          className="-m-1 rounded-lg p-1 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div
      role="status"
      className={cx('flex items-center justify-center gap-3 py-10 text-sm text-ink-600', className)}
    >
      <LoaderCircle className="h-5 w-5 animate-spin text-brand-700" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Info, title, children, action, className = '' }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center rounded-card border border-dashed border-ink-300 bg-ink-50/60 px-6 py-10 text-center',
        className
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink-500 shadow-sm ring-1 ring-ink-200">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink-900">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm leading-6 text-ink-600">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page structure                                                       */
/* ------------------------------------------------------------------ */

export function PageHeader({ eyebrow, title, description, actions, className = '' }) {
  return (
    <div
      className={cx(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title mt-1">{title}</h1>
        {description && <p className="muted mt-2 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SectionCard({ title, description, actions, count, children, className = '', bodyClassName = '' }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="section-title flex items-center gap-2">
              {title}
              {count !== undefined && count !== null && (
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600">
                  {count}
                </span>
              )}
            </h2>
            {description && <p className="mt-0.5 text-sm text-ink-600">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-5 sm:p-6', bodyClassName)}>{children}</div>
    </section>
  );
}

const STAT_TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  safe: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
};

export function StatTile({ icon: Icon, label, value, tone = 'neutral', hint }) {
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5">
      {Icon && (
        <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-control', STAT_TONES[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-ink-900">{value}</p>
        <p className="mt-1.5 text-sm font-medium text-ink-600">{label}</p>
        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}

/** Label + value rows. Items: [{ label, value }]. */
export function DescriptionList({ items, className = '' }) {
  return (
    <dl className={cx('divide-y divide-ink-200', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        >
          <dt className="text-sm text-ink-600">{item.label}</dt>
          <dd className="text-sm font-semibold text-ink-900 sm:text-right">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Forms                                                                */
/* ------------------------------------------------------------------ */

/** Wrap a control with a visible label, optional hint and error. */
export function Field({ label, hint, error, optional, htmlFor, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-500">(optional)</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                 */
/* ------------------------------------------------------------------ */

export function Tabs({ tabs, value, onChange, label, className = '' }) {
  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next = null;
    if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      event.preventDefault();
      onChange(next.id);
      document.getElementById(`tab-${next.id}`)?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cx('-mb-px flex gap-1 overflow-x-auto border-b border-ink-200', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className="tab"
          >
            {tab.icon && <tab.icon className="h-4 w-4" aria-hidden="true" />}
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={cx(
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  tab.alert ? 'bg-red-100 text-red-800' : 'bg-ink-100 text-ink-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, value, children, className = '' }) {
  if (id !== value) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal + confirm dialog                                               */
/* ------------------------------------------------------------------ */

const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: traps focus, closes on Escape / backdrop click, locks page scroll,
 * restores focus when closed.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  tone = 'neutral',
  size = 'lg',
  footer,
  children,
  dismissable = true,
  bodyClassName = '',
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && dismissable) {
        event.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    const focusTimer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector('[data-autofocus]') ||
        panelRef.current?.querySelector(
          'input:not([type="hidden"]), select, textarea'
        ) ||
        panelRef.current;
      target?.focus?.();
    }, 30);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open, dismissable]);

  if (!open) return null;

  const iconTone = {
    neutral: 'bg-ink-100 text-ink-700',
    safe: 'bg-emerald-100 text-emerald-800',
    warn: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-sky-100 text-sky-800',
  }[tone];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/55 backdrop-blur-[2px]">
      <div
        className="flex min-h-full items-end justify-center sm:items-center sm:p-6"
        onMouseDown={(event) => {
          if (dismissable && event.target === event.currentTarget) closeRef.current?.();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={cx(
            'animate-modal-in flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop outline-none sm:rounded-card',
            MODAL_SIZES[size]
          )}
        >
          <header className="flex items-start gap-3.5 border-b border-ink-200 px-5 py-4 sm:px-6">
            {Icon && (
              <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-control', iconTone)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-bold leading-snug text-ink-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-0.5 text-sm leading-6 text-ink-600">
                  {description}
                </p>
              )}
            </div>
            {dismissable && (
              <button
                type="button"
                onClick={() => closeRef.current?.()}
                aria-label="Close dialog"
                className="-mr-2 -mt-1 rounded-control p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </header>

          <div className={cx('min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6', bodyClassName)}>
            {children}
          </div>

          {footer && (
            <footer className="flex flex-col-reverse gap-2.5 border-t border-ink-200 bg-ink-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small yes/no dialog for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      size="sm"
      icon={tone === 'danger' ? ShieldAlert : AlertTriangle}
      tone={tone === 'danger' ? 'danger' : 'warn'}
      dismissable={!busy}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cx('btn', tone === 'danger' ? 'btn-danger' : 'btn-primary')}
            onClick={onConfirm}
            disabled={busy}
            data-autofocus
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-ink-700">{message}</p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Toast                                                                */
/* ------------------------------------------------------------------ */

export function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-4 sm:justify-end sm:p-6 no-print">
      <div
        role={isError ? 'alert' : 'status'}
        aria-live={isError ? 'assertive' : 'polite'}
        className={cx(
          'animate-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border bg-white px-4 py-3 text-sm shadow-pop',
          isError ? 'border-red-200' : 'border-emerald-200'
        )}
      >
        <Icon
          className={cx('mt-0.5 h-5 w-5 shrink-0', isError ? 'text-red-600' : 'text-emerald-700')}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 font-medium leading-6 text-ink-800">{toast.message}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="-m-1 rounded-lg p-1 text-ink-500 hover:bg-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
