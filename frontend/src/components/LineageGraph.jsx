import React, { useState, useMemo } from 'react';
import {
  Milk,
  Package,
  Store,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  ArrowRight,
  Phone,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { Badge, StatusBadge } from './ui';
import { formatNumber, formatQuantity } from '../utils/format';

export default function LineageGraph({
  batches = [],
  links = [],
  distributions = [],
  selectedBatchId,
  onSelectBatch,
  onOpenRecallModal,
  onViewPassport,
  compact = false,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  const activeFocus = hoveredId || selectedBatchId || 'MILK-101';
  const focusedBatch = useMemo(
    () => batches.find((b) => b.id === activeFocus) || batches[0],
    [batches, activeFocus]
  );

  // Separate raw milk collections and finished paneer batches
  const rawMilkBatches = useMemo(
    () => batches.filter((b) => b.product_type === 'MILK'),
    [batches]
  );

  const finishedPaneerBatches = useMemo(
    () => batches.filter((b) => b.product_type === 'PANEER'),
    [batches]
  );

  // Determine connected batches & stores for the active selection
  const relatedElements = useMemo(() => {
    if (!activeFocus) return { parents: [], children: [], coInputs: [], retailers: [] };

    // If activeFocus is a milk batch -> find paneer batches made from it
    const directChildLinks = links.filter((l) => l.parent_batch_id === activeFocus);
    const directChildIds = directChildLinks.map((l) => l.child_batch_id);

    // Other milk batches blended into those same paneer batches
    const coInputIds = [
      ...new Set(
        links
          .filter(
            (l) => directChildIds.includes(l.child_batch_id) && l.parent_batch_id !== activeFocus
          )
          .map((l) => l.parent_batch_id)
      ),
    ];

    // Retail stores that received those paneer batches
    const retailDestinations = distributions.filter((d) => directChildIds.includes(d.batch_id));

    // If activeFocus is a paneer batch -> find milk batches that went into it
    const parentLinks = links.filter((l) => l.child_batch_id === activeFocus);
    const parentIds = parentLinks.map((l) => l.parent_batch_id);
    const directRetailers = distributions.filter((d) => d.batch_id === activeFocus);

    return {
      parents: parentIds,
      children: directChildIds,
      coInputs: coInputIds,
      retailers: [...retailDestinations, ...directRetailers],
    };
  }, [activeFocus, links, distributions]);

  // In compact mode, show only the selected batch's connected path
  const visibleBatchIds = useMemo(
    () => new Set([
      activeFocus,
      ...relatedElements.parents,
      ...relatedElements.children,
      ...relatedElements.coInputs,
    ]),
    [activeFocus, relatedElements]
  );

  const visibleMilkBatches = useMemo(
    () => (compact ? rawMilkBatches.filter((batch) => visibleBatchIds.has(batch.id)) : rawMilkBatches),
    [compact, rawMilkBatches, visibleBatchIds]
  );

  const visiblePaneerBatches = useMemo(
    () => (compact ? finishedPaneerBatches.filter((batch) => visibleBatchIds.has(batch.id)) : finishedPaneerBatches),
    [compact, finishedPaneerBatches, visibleBatchIds]
  );

  const visibleDistributions = useMemo(
    () =>
      compact
        ? distributions.filter((record) => relatedElements.retailers.some((retailer) => retailer.id === record.id))
        : distributions,
    [compact, distributions, relatedElements]
  );

  const isHighlighted = (id) => {
    if (!activeFocus) return false;
    if (activeFocus === id) return true;
    if (relatedElements.parents.includes(id)) return true;
    if (relatedElements.children.includes(id)) return true;
    if (relatedElements.coInputs.includes(id)) return true;
    return false;
  };

  return (
    <div className={compact ? 'space-y-4' : 'card card-pad space-y-5'}>
      {/* Header & Legend */}
      {!compact && (
        <div className="flex flex-col gap-4 border-b border-ink-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="eyebrow">Supply Chain Journey</span>
            <h2 className="section-title text-xl mt-0.5">
              Farm-to-Pack Dairy Lineage &amp; Retail Network
            </h2>
            <p className="muted mt-1 text-xs sm:text-sm">
              Click or hover any batch to trace milk blending, vat aggregation, and retail dispatch.
            </p>
          </div>

          {/* Status Legend */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-safe">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Active &amp; Safe
            </span>
            <span className="badge badge-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              On Quality Hold
            </span>
            <span className="badge badge-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
              Recalled
            </span>
          </div>
        </div>
      )}

      {/* Active Focus Summary Bar */}
      {focusedBatch && !compact && (
        <div className="flex flex-col gap-2 rounded-card border border-brand-200 bg-brand-50/40 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
          <div className="flex flex-wrap items-center gap-2 text-ink-700">
            <span className="rounded-control bg-brand-800 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
              Selected: {focusedBatch.id}
            </span>
            <span className="font-semibold text-ink-900">{focusedBatch.facility_name}</span>
            <span className="text-ink-400 hidden sm:inline">•</span>
            {focusedBatch.product_type === 'MILK' ? (
              <span className="text-ink-600">
                Processed into{' '}
                <strong className="text-ink-900">
                  {relatedElements.children.length} Paneer{' '}
                  {relatedElements.children.length === 1 ? 'Batch' : 'Batches'}
                </strong>
                {relatedElements.coInputs.length > 0 && (
                  <>
                    {' '}
                    (co-blended with{' '}
                    <strong className="text-amber-800">
                      {relatedElements.coInputs.join(', ')}
                    </strong>
                    )
                  </>
                )}{' '}
                and delivered to{' '}
                <strong className="text-ink-900">
                  {relatedElements.retailers.length} Retail{' '}
                  {relatedElements.retailers.length === 1 ? 'Store' : 'Stores'}
                </strong>
                .
              </span>
            ) : (
              <span className="text-ink-600">
                Crafted from{' '}
                <strong className="text-ink-900">
                  {relatedElements.parents.length > 0
                    ? relatedElements.parents.join(' + ')
                    : 'Direct Dairy Supply'}
                </strong>{' '}
                and distributed to{' '}
                <strong className="text-ink-900">
                  {relatedElements.retailers.length} Retail{' '}
                  {relatedElements.retailers.length === 1 ? 'Store' : 'Stores'}
                </strong>
                .
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onViewPassport?.(focusedBatch.id)}
            className="flex items-center gap-1 font-semibold text-brand-800 hover:text-brand-950"
          >
            <QrCode className="h-3.5 w-3.5" />
            Public Passport
          </button>
        </div>
      )}

      {/* 3 Columns: 1. Village Milk Collections -> 2. Paneer Processing -> 3. Retail Stores */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* STEP 1: Village Milk Collection */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-control border border-sky-200 bg-sky-50 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-950">
              <Milk className="h-4 w-4 text-sky-700" />
              1. Village Milk Collections
            </span>
            <span className="rounded-control bg-white px-2 py-0.5 text-xs font-bold text-sky-900 border border-sky-200">
              {visibleMilkBatches.length}
            </span>
          </div>

          <div className="space-y-3">
            {visibleMilkBatches.map((batch) => {
              const highlighted = isHighlighted(batch.id);
              const isSelected = activeFocus === batch.id;
              const isCoInput = relatedElements.coInputs.includes(batch.id);
              const isParentOfSelected = relatedElements.parents.includes(batch.id);

              return (
                <div
                  key={batch.id}
                  onClick={() => onSelectBatch?.(batch.id)}
                  onMouseEnter={() => setHoveredId(batch.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`card p-4 transition cursor-pointer ${
                    batch.status === 'RECALLED'
                      ? 'border-red-300 bg-red-50/40 ring-2 ring-red-500/10'
                      : batch.status === 'QUARANTINED' || isCoInput
                      ? 'border-amber-300 bg-amber-50/40 ring-2 ring-amber-500/10'
                      : isSelected
                      ? 'border-brand-600 ring-2 ring-brand-600/20 shadow-sm bg-brand-50/20'
                      : highlighted
                      ? 'border-brand-400 bg-canvas'
                      : 'hover:border-ink-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-ink-900">{batch.id}</span>
                        <span className="badge badge-info text-[10px] py-0 px-2">Raw Milk</span>
                        {isCoInput && batch.status === 'ACTIVE' && (
                          <span className="badge badge-warn text-[10px] py-0 px-2">Blended In Vat</span>
                        )}
                        {isParentOfSelected && (
                          <span className="badge badge-safe text-[10px] py-0 px-2">Source Milk</span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-600">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        <span className="truncate max-w-[190px]">{batch.facility_name}</span>
                      </p>
                    </div>

                    <StatusBadge status={batch.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-2 text-xs">
                    <div>
                      <span className="block text-[10px] font-semibold text-ink-500 uppercase">Volume</span>
                      <p className="font-bold text-ink-900">{formatQuantity(batch.initial_quantity, 'MILK')}</p>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-ink-500 uppercase">Remaining</span>
                      <p className="font-semibold text-ink-700">
                        {batch.remaining_quantity > 0
                          ? formatQuantity(batch.remaining_quantity, 'MILK')
                          : 'Processed'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPassport?.(batch.id);
                      }}
                      className="flex items-center gap-1 font-semibold text-brand-800 hover:text-brand-950"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Passport
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRecallModal?.(batch.id);
                      }}
                      className="flex items-center gap-1 font-semibold text-red-700 hover:text-red-900"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" /> Recall
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Paneer Crafting */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-control border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-950">
              <Package className="h-4 w-4 text-amber-700" />
              2. Paneer Processing (Dairy Plant)
            </span>
            <span className="rounded-control bg-white px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-200">
              {visiblePaneerBatches.length}
            </span>
          </div>

          <div className="space-y-3">
            {visiblePaneerBatches.map((batch) => {
              const highlighted = isHighlighted(batch.id);
              const isSelected = activeFocus === batch.id;
              const isChildOfSelected = relatedElements.children.includes(batch.id);
              const inputs = links.filter((l) => l.child_batch_id === batch.id);

              return (
                <div
                  key={batch.id}
                  onClick={() => onSelectBatch?.(batch.id)}
                  onMouseEnter={() => setHoveredId(batch.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`card p-4 transition cursor-pointer ${
                    batch.status === 'RECALLED'
                      ? 'border-red-300 bg-red-50/40 ring-2 ring-red-500/10'
                      : batch.status === 'QUARANTINED'
                      ? 'border-amber-300 bg-amber-50/40 ring-2 ring-amber-500/10'
                      : isSelected
                      ? 'border-brand-600 ring-2 ring-brand-600/20 shadow-sm bg-brand-50/20'
                      : highlighted
                      ? 'border-brand-400 bg-canvas'
                      : 'hover:border-ink-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-ink-900">{batch.id}</span>
                        <span className="badge badge-warn text-[10px] py-0 px-2">Malai Paneer</span>
                        {isChildOfSelected && batch.status !== 'RECALLED' && (
                          <span className="badge badge-safe text-[10px] py-0 px-2">From {activeFocus}</span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-600">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        <span className="truncate max-w-[190px]">{batch.facility_name}</span>
                      </p>
                    </div>

                    <StatusBadge status={batch.status} />
                  </div>

                  {/* Input Milk Batches */}
                  <div className="mt-3 border-t border-ink-100 pt-2">
                    <span className="block text-[10px] font-semibold text-ink-500 uppercase mb-1">
                      Source Milk In Vat:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {inputs.map((inp) => (
                        <span
                          key={inp.id}
                          className="inline-flex items-center gap-1 rounded bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-800"
                        >
                          <Milk className="h-3 w-3 text-sky-700" />
                          <span className="font-bold">{inp.parent_batch_id}</span>
                          <span className="text-ink-500">({inp.quantity_used} L)</span>
                        </span>
                      ))}
                      {inputs.length === 0 && (
                        <span className="text-[11px] italic text-ink-400">Direct collection</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-2 text-xs">
                    <div>
                      <span className="block text-[10px] font-semibold text-ink-500 uppercase">Yield</span>
                      <p className="font-bold text-ink-900">{formatQuantity(batch.initial_quantity, 'PANEER')}</p>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-ink-500 uppercase">Quality</span>
                      <p
                        className={`text-xs font-bold ${
                          batch.status === 'RECALLED'
                            ? 'text-red-700'
                            : batch.status === 'QUARANTINED'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {batch.status === 'RECALLED'
                          ? 'Recalled'
                          : batch.status === 'QUARANTINED'
                          ? 'On Hold'
                          : 'Approved'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPassport?.(batch.id);
                      }}
                      className="flex items-center gap-1 font-semibold text-brand-800 hover:text-brand-950"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Passport
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRecallModal?.(batch.id);
                      }}
                      className="flex items-center gap-1 font-semibold text-red-700 hover:text-red-900"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" /> Recall
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 3: Retail Stores */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-950">
              <Store className="h-4 w-4 text-emerald-700" />
              3. Local Retail Stores
            </span>
            <span className="rounded-control bg-white px-2 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-200">
              {visibleDistributions.length}
            </span>
          </div>

          <div className="space-y-3">
            {visibleDistributions.map((dist) => {
              const parentBatch = batches.find((b) => b.id === dist.batch_id);
              const isRecalled = parentBatch?.status === 'RECALLED';
              const isQuarantined = parentBatch?.status === 'QUARANTINED';
              const isRelated = relatedElements.retailers.some((r) => r.id === dist.id);

              return (
                <div
                  key={dist.id}
                  onClick={() => onSelectBatch?.(dist.batch_id)}
                  className={`card p-4 transition cursor-pointer ${
                    isRecalled
                      ? 'border-red-300 bg-red-50/50'
                      : isQuarantined
                      ? 'border-amber-300 bg-amber-50/40'
                      : isRelated
                      ? 'border-brand-400 bg-canvas'
                      : 'hover:border-ink-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="flex items-center gap-1.5 font-bold text-sm text-ink-900">
                        <Store className="h-4 w-4 text-brand-700 shrink-0" />
                        {dist.destination_name}
                      </span>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                        <MapPin className="h-3 w-3 text-ink-400 shrink-0" />
                        <span>{dist.location}</span>
                      </p>
                    </div>

                    {isRecalled ? (
                      <span className="badge badge-danger text-[10px]">
                        <ShieldAlert className="h-3 w-3" /> Recall Alert
                      </span>
                    ) : isRelated ? (
                      <span className="badge badge-safe text-[10px]">Active Recipient</span>
                    ) : (
                      <span className="badge badge-neutral text-[10px]">Clear</span>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-2 text-xs">
                    <div>
                      <span className="block text-[10px] font-semibold text-ink-500 uppercase">Batch</span>
                      <p className="font-mono font-bold text-ink-900">{dist.batch_id}</p>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold text-ink-500 uppercase">Quantity</span>
                      <p className="font-bold text-ink-800">{dist.quantity_dispatched} kg</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2 text-xs">
                    <span className="flex items-center gap-1 font-mono text-ink-600">
                      <Phone className="h-3 w-3 text-ink-400" />
                      {dist.contact_phone}
                    </span>
                    {isRecalled ? (
                      <a
                        href={`tel:${dist.contact_phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-red-700 hover:underline"
                      >
                        Notify Store
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Delivered
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
