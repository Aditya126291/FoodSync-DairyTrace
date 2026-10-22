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

  // Keep the journey readable by showing only the selected batch's connected path.
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
    () => rawMilkBatches.filter((batch) => visibleBatchIds.has(batch.id)),
    [rawMilkBatches, visibleBatchIds]
  );
  const visiblePaneerBatches = useMemo(
    () => finishedPaneerBatches.filter((batch) => visibleBatchIds.has(batch.id)),
    [finishedPaneerBatches, visibleBatchIds]
  );
  const visibleDistributions = useMemo(
    () => distributions.filter((record) => relatedElements.retailers.some((retailer) => retailer.id === record.id)),
    [distributions, relatedElements]
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RECALLED':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          dot: 'bg-red-600',
          label: 'Recalled',
        };
      case 'QUARANTINED':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          label: 'On Hold',
        };
      default:
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-600',
          label: 'Safe & Fresh',
        };
    }
  };

  const isHighlighted = (id) => {
    if (!activeFocus) return false;
    if (activeFocus === id) return true;
    if (relatedElements.parents.includes(id)) return true;
    if (relatedElements.children.includes(id)) return true;
    if (relatedElements.coInputs.includes(id)) return true;
    return false;
  };

  return (
    <div className={compact ? 'space-y-5' : 'space-y-5 rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm sm:p-6'}>
      {/* Header & Legend */}
      {!compact && <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Farm-to-Store Supply Chain Journey
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Select any milk collection or paneer batch to trace how fresh milk is blended, crafted into paneer, and delivered to stores.
          </p>
        </div>

        {/* Plain-Language Status Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-600" /> Safe &amp; Fresh
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> On Hold for Testing
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-600" /> Recalled
          </span>
        </div>
      </div>}

      {/* Plain-English Active Focus Summary Bar */}
      {focusedBatch && !compact && (
        <div className="px-4 py-3 rounded-xl bg-[#FAF7F2] border border-stone-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 text-stone-700 flex-wrap">
            <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
              Selected: {focusedBatch.id}
            </span>
            <span className="font-semibold text-stone-800">{focusedBatch.facility_name}</span>
            <span className="text-stone-400 hidden sm:inline">•</span>
            {focusedBatch.product_type === 'MILK' ? (
              <span className="text-stone-600">
                Used in{' '}
                <strong className="text-stone-900">
                  {relatedElements.children.length} Paneer{' '}
                  {relatedElements.children.length === 1 ? 'Batch' : 'Batches'}
                </strong>
                {relatedElements.coInputs.length > 0 && (
                  <>
                    {' '}
                    (blended with{' '}
                    <strong className="text-amber-800">
                      {relatedElements.coInputs.join(', ')}
                    </strong>
                    )
                  </>
                )}{' '}
                and delivered to{' '}
                <strong className="text-stone-900">
                  {relatedElements.retailers.length} Retail{' '}
                  {relatedElements.retailers.length === 1 ? 'Store' : 'Stores'}
                </strong>
                .
              </span>
            ) : (
              <span className="text-stone-600">
                Crafted from{' '}
                <strong className="text-stone-900">
                  {relatedElements.parents.length > 0
                    ? relatedElements.parents.join(' + ')
                    : 'Direct Dairy Supply'}
                </strong>{' '}
                and delivered to{' '}
                <strong className="text-stone-900">
                  {relatedElements.retailers.length} Retail{' '}
                  {relatedElements.retailers.length === 1 ? 'Store' : 'Stores'}
                </strong>
                .
              </span>
            )}
          </div>
          <button
            onClick={() => onViewPassport(focusedBatch.id)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 self-start sm:self-auto whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5" />
            View Customer QR
          </button>
        </div>
      )}

      {/* 3-Step Dairy Journey Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* STEP 1: Village Milk Collection */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-sky-50/70 border border-sky-200/70">
            <span className="text-xs font-bold uppercase tracking-wide text-sky-900 flex items-center gap-2">
              <Milk className="w-4 h-4 text-sky-700" />
              1. Village Milk Collection
            </span>
            <span className="text-xs font-semibold text-sky-800 bg-white px-2 py-0.5 rounded-md border border-sky-200/60">
              {visibleMilkBatches.length} {visibleMilkBatches.length === 1 ? 'Batch' : 'Batches'}
            </span>
          </div>

          <div className="space-y-3">
            {visibleMilkBatches.map((batch) => {
              const statusInfo = getStatusBadge(batch.status);
              const highlighted = isHighlighted(batch.id);
              const isSelected = activeFocus === batch.id;
              const isCoInput = relatedElements.coInputs.includes(batch.id);
              const isParentOfSelected = relatedElements.parents.includes(batch.id);

              return (
                <div
                  key={batch.id}
                  onClick={() => onSelectBatch(batch.id)}
                  onMouseEnter={() => setHoveredId(batch.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    batch.status === 'RECALLED'
                      ? 'bg-red-50/60 border-red-300 ring-2 ring-red-500/15'
                      : batch.status === 'QUARANTINED' || isCoInput
                      ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/15'
                      : isSelected
                      ? 'bg-emerald-50/40 border-emerald-600 ring-2 ring-emerald-600/15 shadow-sm'
                      : highlighted
                      ? 'bg-[#FAF7F2] border-emerald-400 shadow-sm'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-stone-900">{batch.id}</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200/80">
                          Fresh Chilled Milk
                        </span>
                        {isCoInput && batch.status === 'ACTIVE' && (
                          <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-300">
                            Blended in Same Vat
                          </span>
                        )}
                        {isParentOfSelected && (
                          <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                            Source Milk
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-stone-600 mt-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                        <span>{batch.facility_name}</span>
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 flex-shrink-0 ${statusInfo.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-stone-200/70 text-xs">
                    <div>
                      <span className="text-[11px] text-stone-500 block">Collected Volume</span>
                      <p className="font-bold text-stone-800">
                        {batch.initial_quantity.toLocaleString()} Liters
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500 block">Unprocessed Stock</span>
                      <p className="font-semibold text-stone-700">
                        {batch.remaining_quantity > 0
                          ? `${batch.remaining_quantity} L in chiller`
                          : 'Fully processed'}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-200/60">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPassport(batch.id);
                      }}
                      className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-semibold"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Customer QR
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRecallModal(batch.id);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Safety Check
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 2: Dairy Plant — Paneer Crafting */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200/80">
            <span className="text-xs font-bold uppercase tracking-wide text-amber-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-700" />
              2. Paneer Crafting (Dairy Plant)
            </span>
            <span className="text-xs font-semibold text-amber-900 bg-white px-2 py-0.5 rounded-md border border-amber-200/70">
              {visiblePaneerBatches.length} {visiblePaneerBatches.length === 1 ? 'Batch' : 'Batches'}
            </span>
          </div>

          <div className="space-y-3">
            {visiblePaneerBatches.map((batch) => {
              const statusInfo = getStatusBadge(batch.status);
              const highlighted = isHighlighted(batch.id);
              const isSelected = activeFocus === batch.id;
              const isChildOfSelected = relatedElements.children.includes(batch.id);

              // Find milk batches blended into this paneer batch
              const inputs = links.filter((l) => l.child_batch_id === batch.id);

              return (
                <div
                  key={batch.id}
                  onClick={() => onSelectBatch(batch.id)}
                  onMouseEnter={() => setHoveredId(batch.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    batch.status === 'RECALLED'
                      ? 'bg-red-50/60 border-red-300 ring-2 ring-red-500/15'
                      : batch.status === 'QUARANTINED'
                      ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/15'
                      : isSelected
                      ? 'bg-emerald-50/40 border-emerald-600 ring-2 ring-emerald-600/15 shadow-sm'
                      : highlighted
                      ? 'bg-[#FAF7F2] border-emerald-400 shadow-sm'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-stone-900">{batch.id}</span>
                        <span className="text-[11px] font-medium bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200/80">
                          Malai Paneer
                        </span>
                        {isChildOfSelected && batch.status !== 'RECALLED' && (
                          <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                            Made from {activeFocus}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-stone-600 mt-1 line-clamp-1">
                        {batch.facility_name}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 flex-shrink-0 ${statusInfo.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Milk Recipe / Blend Breakdown */}
                  <div className="mt-3 pt-2.5 border-t border-stone-200/70">
                    <span className="text-[11px] text-stone-500 font-semibold block mb-1.5">
                      Milk Blended into This Batch:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {inputs.map((inp) => (
                        <span
                          key={inp.id}
                          className="text-xs px-2.5 py-1 rounded-lg bg-[#FAF7F2] text-stone-800 border border-stone-200/90 flex items-center gap-1.5 font-medium"
                        >
                          <Milk className="w-3 h-3 text-sky-700" />
                          <span className="font-bold text-stone-900">{inp.parent_batch_id}</span>
                          <span className="text-stone-500">({inp.quantity_used} {inp.unit})</span>
                        </span>
                      ))}
                      {inputs.length === 0 && (
                        <span className="text-xs text-stone-400 italic">Direct farm milk</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-stone-200/70 text-xs">
                    <div>
                      <span className="text-[11px] text-stone-500 block">Paneer Produced</span>
                      <p className="font-bold text-stone-800">{batch.initial_quantity} kg</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500 block">Quality Clearance</span>
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
                          ? 'Withdrawn from Sale'
                          : batch.status === 'QUARANTINED'
                          ? 'Under Inspection'
                          : 'Approved for Sale'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-200/60">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPassport(batch.id);
                      }}
                      className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-semibold"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Customer QR
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenRecallModal(batch.id);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-semibold"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Safety Check
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 3: Local Retail Stores */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-900 flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-700" />
              3. Local Retail Stores
            </span>
            <span className="text-xs font-semibold text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200/70">
              {visibleDistributions.length} {visibleDistributions.length === 1 ? 'Store' : 'Stores'}
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
                  onClick={() => onSelectBatch(dist.batch_id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isRecalled
                      ? 'bg-red-50/70 border-red-300 shadow-sm'
                      : isQuarantined
                      ? 'bg-amber-50/60 border-amber-300'
                      : isRelated
                      ? 'bg-[#FAF7F2] border-emerald-400 shadow-sm'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                        {dist.destination_name}
                      </span>
                      <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        {dist.location}
                      </p>
                    </div>

                    {isRecalled ? (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-red-700" /> Recall Alert
                      </span>
                    ) : isRelated ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Receives Batch
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                        Open &amp; Safe
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-stone-200/70 text-xs">
                    <div>
                      <span className="text-[11px] text-stone-500 block">Paneer Batch</span>
                      <p className="font-bold text-stone-900">{dist.batch_id}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-stone-500 block">Quantity Delivered</span>
                      <p className="font-bold text-stone-800">{dist.quantity_dispatched} kg</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
                    <span className="text-stone-600 font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3 text-stone-400" />
                      {dist.contact_phone}
                    </span>
                    {isRecalled ? (
                      <a
                        href={`tel:${dist.contact_phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-bold text-red-700 hover:text-red-800 underline"
                      >
                        Call Store Now
                      </a>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Verified Delivery
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
