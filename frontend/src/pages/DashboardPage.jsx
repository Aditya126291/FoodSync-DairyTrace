import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  MapPin,
  Milk,
  Package,
  Plus,
  QrCode,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
} from 'lucide-react';
import LineageGraph from '../components/LineageGraph';
import { api } from '../api';

const statusPresentation = {
  ACTIVE: {
    label: 'Safe & fresh',
    tone: 'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    dot: 'bg-emerald-600',
  },
  QUARANTINED: {
    label: 'On hold',
    tone: 'bg-amber-50 text-amber-900 ring-amber-700/10',
    dot: 'bg-amber-500',
  },
  RECALLED: {
    label: 'Recalled',
    tone: 'bg-rose-50 text-rose-800 ring-rose-700/10',
    dot: 'bg-rose-600',
  },
};

const trustPresentation = {
  SUPPLIER_ENTERED: { label: 'Collection centre recorded', step: 1 },
  DOCUMENT_CHECKED: { label: 'Lab report attached', step: 2 },
  VERIFIED: { label: 'Lab verified', step: 3 },
};

const formatQuantity = (value) => Number(value || 0).toLocaleString();

export default function DashboardPage({
  batches = [],
  links = [],
  distributions = [],
  onSelectBatch,
  selectedBatchId,
  onOpenRecallModal,
  onOpenComplaintModal,
  onOpenCreateBatchModal,
  onViewPassport,
  onOpenFssaiNotice,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [qualityRecords, setQualityRecords] = useState([]);
  const [loadingQuality, setLoadingQuality] = useState(false);

  const activeBatch = useMemo(
    () => batches.find((batch) => batch.id === selectedBatchId) || batches[0] || null,
    [batches, selectedBatchId]
  );

  // Keep the workspace selection valid when data is reloaded or reset.
  useEffect(() => {
    if (batches.length && !batches.some((batch) => batch.id === selectedBatchId)) {
      onSelectBatch(batches[0].id);
    }
  }, [batches, onSelectBatch, selectedBatchId]);

  useEffect(() => {
    let mounted = true;
    const loadQuality = async () => {
      if (!activeBatch?.id) {
        setQualityRecords([]);
        setLoadingQuality(false);
        return;
      }

      setLoadingQuality(true);
      try {
        const records = await api.getQualityRecords(activeBatch.id);
        if (mounted) setQualityRecords(records || []);
      } catch {
        if (mounted) setQualityRecords([]);
      } finally {
        if (mounted) setLoadingQuality(false);
      }
    };

    loadQuality();
    return () => {
      mounted = false;
    };
  }, [activeBatch?.id]);

  const stats = useMemo(() => {
    const active = batches.filter((batch) => batch.status === 'ACTIVE').length;
    const quarantined = batches.filter((batch) => batch.status === 'QUARANTINED').length;
    const recalled = batches.filter((batch) => batch.status === 'RECALLED').length;
    const milkCollected = batches
      .filter((batch) => batch.product_type === 'MILK')
      .reduce((sum, batch) => sum + Number(batch.initial_quantity || 0), 0);
    const paneerPrepared = batches
      .filter((batch) => batch.product_type === 'PANEER')
      .reduce((sum, batch) => sum + Number(batch.initial_quantity || 0), 0);

    return { active, quarantined, recalled, milkCollected, paneerPrepared };
  }, [batches]);

  const filteredBatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return batches.filter((batch) => {
      const matchSearch =
        !query ||
        String(batch.id || '').toLowerCase().includes(query) ||
        String(batch.facility_name || '').toLowerCase().includes(query);
      const matchProduct = productFilter === 'ALL' || batch.product_type === productFilter;
      const matchStatus = statusFilter === 'ALL' || batch.status === statusFilter;
      return matchSearch && matchProduct && matchStatus;
    });
  }, [batches, productFilter, searchTerm, statusFilter]);

  const activeConnections = useMemo(() => {
    if (!activeBatch) return { parents: [], children: [], stores: [] };
    const parents = links.filter((link) => link.child_batch_id === activeBatch.id);
    const children = links.filter((link) => link.parent_batch_id === activeBatch.id);
    const relatedBatchIds = activeBatch.product_type === 'MILK'
      ? children.map((link) => link.child_batch_id)
      : [activeBatch.id];
    const stores = distributions.filter((record) => relatedBatchIds.includes(record.batch_id));
    return { parents, children, stores };
  }, [activeBatch, distributions, links]);

  const primaryQuality = qualityRecords[0] || null;
  const trustInfo = trustPresentation[
    primaryQuality?.trust_level || activeBatch?.trust_level || 'VERIFIED'
  ] || trustPresentation.VERIFIED;
  const statusInfo = statusPresentation[activeBatch?.status] || statusPresentation.ACTIVE;
  const activeSafetyCount = stats.quarantined + stats.recalled;
  const journeyBatchIds = useMemo(() => {
    if (!activeBatch) return [];
    const childIds = links
      .filter((link) => link.parent_batch_id === activeBatch.id)
      .map((link) => link.child_batch_id);
    const parentIds = links
      .filter((link) => link.child_batch_id === activeBatch.id)
      .map((link) => link.parent_batch_id);
    const coInputIds = links
      .filter((link) => childIds.includes(link.child_batch_id))
      .map((link) => link.parent_batch_id);
    return [...new Set([activeBatch.id, ...childIds, ...parentIds, ...coInputIds])];
  }, [activeBatch, links]);
  const journeyBatches = useMemo(
    () => batches.filter((batch) => journeyBatchIds.includes(batch.id)),
    [batches, journeyBatchIds]
  );
  const journeyDistributions = useMemo(
    () => distributions.filter((record) => journeyBatchIds.includes(record.batch_id)),
    [distributions, journeyBatchIds]
  );

  const selectBatch = (batchId) => onSelectBatch(batchId);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">
              Dairy workspace
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
              Follow a batch from farm to store
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-stone-600">
              Choose a batch to see where it came from, how it was checked, and where it went.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold text-stone-600 sm:min-w-64">
              Choose a batch
              <select
                value={activeBatch?.id || ''}
                onChange={(event) => selectBatch(event.target.value)}
                disabled={batches.length === 0}
                className="min-h-11 w-full rounded-xl border border-stone-300 bg-[#fffdf9] px-3.5 text-sm font-semibold text-stone-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {batches.length === 0 ? (
                  <option value="">No batches yet</option>
                ) : (
                  batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.id} · {batch.product_type === 'MILK' ? 'Milk' : 'Paneer'}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 divide-y divide-stone-200 border-t border-stone-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 py-3 sm:py-2 sm:pr-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight text-stone-900">{stats.active} <span className="text-sm font-medium text-stone-500">of {batches.length}</span></p>
              <p className="text-xs text-stone-500">Batches safe and fresh</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3 sm:px-5 sm:py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
              <Milk className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight text-stone-900">{formatQuantity(stats.milkCollected)} <span className="text-sm font-medium text-stone-500">L</span></p>
              <p className="text-xs text-stone-500">Milk collected</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3 sm:pl-5 sm:py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight text-stone-900">{formatQuantity(stats.paneerPrepared)} <span className="text-sm font-medium text-stone-500">kg</span></p>
              <p className="text-xs text-stone-500">Paneer prepared</p>
            </div>
          </div>
        </div>
      </section>

      {activeSafetyCount > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold text-amber-950">Some batches need attention</p>
              <p className="mt-0.5 text-sm text-amber-900">
                {stats.recalled} recalled · {stats.quarantined} on hold
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenFssaiNotice?.(1)}
            className="min-h-10 self-start rounded-xl px-3 text-sm font-semibold text-amber-900 underline decoration-amber-400 underline-offset-4 hover:bg-amber-100 sm:self-auto"
          >
            View safety notice
          </button>
        </div>
      )}

      {activeBatch ? (
        <section aria-labelledby="selected-batch-heading" className="space-y-4">
          <div className="batch-context sticky top-[4.25rem] z-30 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur-xl sm:top-[5.25rem] sm:flex sm:items-center sm:justify-between sm:gap-5 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                {activeBatch.product_type === 'MILK' ? <Milk className="h-5 w-5" /> : <Package className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="selected-batch-heading" className="font-bold text-stone-950">{activeBatch.id}</h2>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusInfo.tone}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                    {statusInfo.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-stone-600">
                  {activeBatch.product_type === 'MILK' ? 'Fresh milk' : 'Malai paneer'}
                  <span className="mx-1.5 text-stone-300">·</span>
                  <MapPin className="mr-1 inline h-3.5 w-3.5" />
                  {activeBatch.facility_name || 'Origin not recorded'}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:shrink-0">
              <button
                type="button"
                onClick={() => onViewPassport(activeBatch.id)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-800 px-3.5 text-sm font-bold text-white transition hover:bg-emerald-900"
              >
                <QrCode className="h-4 w-4" />
                Check product
              </button>
              <button
                type="button"
                onClick={() => onOpenComplaintModal?.(activeBatch.id)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-300 px-3.5 text-sm font-semibold text-stone-700 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-950"
              >
                <FlaskConical className="h-4 w-4 text-emerald-800" />
                Report issue / lab check
              </button>
              <button
                type="button"
                onClick={() => onOpenRecallModal(activeBatch.id)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-300 px-3.5 text-sm font-semibold text-stone-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
              >
                <ShieldAlert className="h-4 w-4" />
                Safety check
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <details className="workspace-section group rounded-2xl border border-stone-200 bg-white shadow-sm">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800"><Milk className="h-4 w-4" /></span>
                  <span>
                    <span className="block font-bold text-stone-900">Journey</span>
                    <span className="mt-0.5 block text-xs text-stone-500">Farm, processing, and stores connected to this batch</span>
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-stone-100 p-3 sm:p-5">
                {journeyBatches.length ? (
                  <LineageGraph
                    compact
                    batches={journeyBatches}
                    links={links}
                    distributions={journeyDistributions}
                    selectedBatchId={activeBatch.id}
                    onSelectBatch={selectBatch}
                    onOpenRecallModal={onOpenRecallModal}
                    onViewPassport={onViewPassport}
                  />
                ) : (
                  <EmptyMessage message="Journey details are not available for this batch yet." />
                )}
              </div>
            </details>

            <details className="workspace-section group rounded-2xl border border-stone-200 bg-white shadow-sm">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><FlaskConical className="h-4 w-4" /></span>
                  <span>
                    <span className="block font-bold text-stone-900">Quality checks</span>
                    <span className="mt-0.5 block text-xs text-stone-500">Lab results and how they were checked</span>
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-5 border-t border-stone-100 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                    <Award className="h-4 w-4 text-emerald-700" />
                    {trustInfo.label}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {['Centre recorded', 'Lab report', 'Lab verified'].map((label, index) => {
                      const complete = index + 1 <= trustInfo.step;
                      return (
                        <div key={label} className={`rounded-lg px-2.5 py-2 font-semibold ${complete ? 'bg-emerald-800 text-white' : 'bg-stone-100 text-stone-400'}`}>
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {loadingQuality ? (
                  <div className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">Loading lab results…</div>
                ) : primaryQuality ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        ['Milk fat', primaryQuality.fat_percentage, '%'],
                        ['Milk solids (SNF)', primaryQuality.snf_percentage, '%'],
                        ['Acidity', primaryQuality.acidity, '%'],
                      ].map(([label, value, unit]) => (
                        <div key={label} className="rounded-xl bg-[#f7f8f4] p-3.5">
                          <p className="text-xs text-stone-500">{label}</p>
                          <p className="mt-1 text-lg font-bold text-stone-900">{value ?? '—'}{value != null && unit}</p>
                        </div>
                      ))}
                    </div>
                    <div className={`flex flex-col gap-2 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between ${primaryQuality.adulterant_test === 'POSITIVE' || activeBatch.status === 'RECALLED' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-900'}`}>
                      <span className="inline-flex items-center gap-2 font-semibold">
                        {primaryQuality.adulterant_test === 'POSITIVE' || activeBatch.status === 'RECALLED' ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {primaryQuality.adulterant_test === 'POSITIVE' || activeBatch.status === 'RECALLED' ? 'Safety alert flagged' : 'No adulteration detected'}
                      </span>
                      <span className="text-sm">Tested by {primaryQuality.lab_name || 'dairy quality lab'}</span>
                    </div>
                    {primaryQuality.contaminant_details && (
                      <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{primaryQuality.contaminant_details}</p>
                    )}
                  </div>
                ) : (
                  <EmptyMessage message="No lab results are recorded for this batch yet." />
                )}
              </div>
            </details>

            <details className="workspace-section group rounded-2xl border border-stone-200 bg-white shadow-sm">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><Store className="h-4 w-4" /></span>
                  <span>
                    <span className="block font-bold text-stone-900">Deliveries</span>
                    <span className="mt-0.5 block text-xs text-stone-500">Related batches and nearby stores</span>
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-stone-100 p-4 sm:p-5">
                {activeBatch.product_type === 'MILK' ? (
                  <ConnectionGroup
                    title="Paneer made with this milk"
                    emptyMessage="This milk has not been used in another batch yet."
                    items={activeConnections.children.map((link) => ({
                      id: link.child_batch_id,
                      detail: `${formatQuantity(link.quantity_used)} ${link.unit || 'L'} used`,
                      type: 'PANEER',
                    }))}
                    onSelect={selectBatch}
                  />
                ) : (
                  <ConnectionGroup
                    title="Milk used to make this paneer"
                    emptyMessage="Source milk batches are not recorded yet."
                    items={activeConnections.parents.map((link) => ({
                      id: link.parent_batch_id,
                      detail: `${formatQuantity(link.quantity_used)} ${link.unit || 'L'} used`,
                      type: 'MILK',
                    }))}
                    onSelect={selectBatch}
                  />
                )}

                <div>
                  <h3 className="mb-2 text-sm font-bold text-stone-800">
                    Sent to {activeConnections.stores.length} {activeConnections.stores.length === 1 ? 'store' : 'stores'}
                  </h3>
                  {activeConnections.stores.length ? (
                    <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                      {activeConnections.stores.map((store, index) => (
                        <div key={store.id || `${store.batch_id}-${store.destination_name}-${index}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-stone-900">{store.destination_name || 'Local store'}</p>
                            <p className="text-sm text-stone-500">{store.location || 'Location not recorded'} · {store.batch_id}</p>
                          </div>
                          <p className="text-sm font-semibold text-stone-700">{formatQuantity(store.quantity_dispatched)} kg</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyMessage message="No store deliveries are recorded for this batch yet." />
                  )}
                </div>

                {onOpenFssaiNotice && activeSafetyCount === 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenFssaiNotice(1)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
                  >
                    <CircleHelp className="h-4 w-4" />
                    View food safety notice
                  </button>
                )}
              </div>
            </details>
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-12 text-center">
          <Package className="mx-auto h-8 w-8 text-stone-400" />
          <h2 className="mt-3 font-bold text-stone-900">No batches to show yet</h2>
          <p className="mt-1 text-sm text-stone-500">Add a batch to start following its journey and checks.</p>
          <button type="button" onClick={onOpenCreateBatchModal} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-900">
            <Plus className="h-4 w-4" /> Add batch
          </button>
        </div>
      )}

      <details className="workspace-section group rounded-2xl border border-stone-200 bg-white shadow-sm">
        <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-bold text-stone-900">Browse batches</span>
            <span className="mt-0.5 block text-xs text-stone-500">Search the full list and choose another batch</span>
          </span>
          <span className="flex items-center gap-2 text-sm font-semibold text-stone-500">
            {filteredBatches.length} of {batches.length}
            <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-4 border-t border-stone-100 p-4 sm:p-5">
          <label className="relative block">
            <span className="sr-only">Search batches by code or collection centre</span>
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by batch code or collection centre"
              className="min-h-11 w-full rounded-xl border border-stone-300 bg-[#fffdf9] pl-10 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div aria-label="Filter by product" className="flex gap-1 rounded-xl bg-stone-100 p-1">
              {[
                ['ALL', 'All products'],
                ['MILK', 'Milk'],
                ['PANEER', 'Paneer'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={productFilter === value}
                  onClick={() => setProductFilter(value)}
                  className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${productFilter === value ? 'bg-white text-emerald-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-stone-600">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Safe &amp; fresh</option>
                <option value="QUARANTINED">On hold</option>
                <option value="RECALLED">Recalled</option>
              </select>
            </label>
          </div>

          {filteredBatches.length ? (
            <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
              {filteredBatches.map((batch) => {
                const itemStatus = statusPresentation[batch.status] || statusPresentation.ACTIVE;
                const selected = activeBatch?.id === batch.id;
                return (
                  <button
                    key={batch.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectBatch(batch.id)}
                    className={`flex w-full flex-col gap-2 px-4 py-3 text-left transition hover:bg-emerald-50/60 sm:flex-row sm:items-center sm:justify-between ${selected ? 'bg-emerald-50/70' : 'bg-white'}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                        {batch.product_type === 'MILK' ? <Milk className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-stone-900">{batch.id} · {batch.product_type === 'MILK' ? 'Fresh milk' : 'Malai paneer'}</span>
                        <span className="mt-0.5 block truncate text-sm text-stone-500">{batch.facility_name || 'Origin not recorded'}</span>
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-12 text-sm sm:pl-0">
                      <span className="text-stone-600">{formatQuantity(batch.initial_quantity)} {batch.product_type === 'MILK' ? 'L' : 'kg'}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${itemStatus.tone}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${itemStatus.dot}`} /> {itemStatus.label}
                      </span>
                      <ChevronRight className="hidden h-4 w-4 text-stone-400 sm:block" />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyMessage message="No batches match these search and filter choices." />
          )}
        </div>
      </details>

    </div>
  );
}

function ConnectionGroup({ title, emptyMessage, items, onSelect }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-stone-800">{title}</h3>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              {item.type === 'MILK' ? <Milk className="h-4 w-4 text-sky-700" /> : <Package className="h-4 w-4 text-amber-700" />}
              <span>{item.id}</span>
              <span className="text-xs font-medium text-stone-500">{item.detail}</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyMessage message={emptyMessage} />
      )}
    </div>
  );
}

function EmptyMessage({ message }) {
  return <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-500">{message}</p>;
}
