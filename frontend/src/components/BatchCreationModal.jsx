import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Milk,
  Package,
  Plus,
  Link as LinkIcon,
  CheckCircle,
  FileBadge,
  Sparkles,
  QrCode,
  Download,
  Printer,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import { Alert, Badge, Field, Modal, Tabs } from './ui';

export default function BatchCreationModal({
  isOpen,
  onClose,
  existingBatches = [],
  onBatchCreated,
  onViewPassport,
  onOpenBatchAudit,
}) {
  const [activeTab, setActiveTab] = useState('raw_milk'); // 'raw_milk' | 'process_paneer' | 'confirmation'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [allottedBatch, setAllottedBatch] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const submittingRef = useRef(false);

  // Raw Milk Form State
  const [milkForm, setMilkForm] = useState({
    id: `MILK-${Math.floor(104 + Math.random() * 50)}`,
    sku: '',
    serial_number: '',
    facility_name: 'Daund Village Collection Centre (Pune)',
    initial_quantity: 750,
    fat_percentage: 4.5,
    snf_percentage: 8.7,
    acidity: 0.14,
    adulterant_test: 'NEGATIVE',
    lab_name: 'Pune Regional Dairy Quality Lab',
    trust_level: 'VERIFIED',
  });

  const milkBatches = existingBatches.filter(
    (b) => b.product_type === 'MILK' && b.status === 'ACTIVE'
  );
  const defaultMilkId = milkBatches[0]?.id || 'MILK-101';
  const defaultCoInputId =
    milkBatches[1]?.id || (defaultMilkId !== 'MILK-102' ? 'MILK-102' : 'MILK-103');

  // Paneer Processing Form State
  const [paneerForm, setPaneerForm] = useState({
    id: `PAN-${Math.floor(203 + Math.random() * 50)}`,
    sku: '',
    serial_number: '',
    facility_name: 'DairyTrace Central Dairy Plant, Pune',
    initial_quantity: 80, // kg
    parent_batch_id: defaultMilkId,
    quantity_used: 400, // L
    has_co_input: false,
    co_parent_batch_id: defaultCoInputId,
    co_quantity_used: 300,
  });

  useEffect(() => {
    if (isOpen) {
      if (activeTab !== 'confirmation') {
        setMilkForm((prev) => ({
          ...prev,
          id: `MILK-${Math.floor(104 + Math.random() * 50)}`,
        }));
        setPaneerForm((prev) => ({
          ...prev,
          id: `PAN-${Math.floor(203 + Math.random() * 50)}`,
          parent_batch_id: milkBatches[0]?.id || 'MILK-101',
          co_parent_batch_id: milkBatches[1]?.id || milkBatches[0]?.id || 'MILK-102',
        }));
      }
    } else {
      setAllottedBatch(null);
      setErrorMsg('');
      setActiveTab('raw_milk');
      submittingRef.current = false;
    }
  }, [isOpen]);

  const handleCreateRawMilk = async (e) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setLoading(true);
    setErrorMsg('');
    try {
      const newBatch = await api.createBatch({
        id: milkForm.id,
        sku: milkForm.sku,
        serial_number: milkForm.serial_number,
        product_type: 'MILK',
        initial_quantity: Number(milkForm.initial_quantity),
        facility_name: milkForm.facility_name,
        trust_level: milkForm.trust_level,
      });

      await api.addQualityRecord({
        batch_id: milkForm.id,
        lab_name: milkForm.lab_name,
        fat_percentage: Number(milkForm.fat_percentage),
        snf_percentage: Number(milkForm.snf_percentage),
        acidity: Number(milkForm.acidity),
        adulterant_test: milkForm.adulterant_test,
        trust_level: milkForm.trust_level,
        contaminant_details: 'Fresh milk collection quality check passed.',
      });

      const passportUrl =
        newBatch.passport_url ||
        `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/passport/${newBatch.id}`;

      const fullAllotment = {
        ...newBatch,
        passport_url: passportUrl,
        qr_code_url: `/api/batches/${newBatch.id}/qr`,
        quality_summary: `Fat ${milkForm.fat_percentage}% · SNF ${milkForm.snf_percentage}% · Acidity ${milkForm.acidity}% · Negative Adulterant Screen`,
        lab_name: milkForm.lab_name,
        trust_level: milkForm.trust_level,
      };

      setAllottedBatch(fullAllotment);
      setActiveTab('confirmation');
      onBatchCreated?.(fullAllotment);
    } catch (err) {
      setErrorMsg(err.message || 'Could not create raw milk batch.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleCreatePaneerLink = async (e) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setLoading(true);
    setErrorMsg('');
    try {
      const newBatch = await api.createBatch({
        id: paneerForm.id,
        sku: paneerForm.sku,
        serial_number: paneerForm.serial_number,
        product_type: 'PANEER',
        initial_quantity: Number(paneerForm.initial_quantity),
        facility_name: paneerForm.facility_name,
        trust_level: 'VERIFIED',
      });

      if (paneerForm.has_co_input && paneerForm.co_parent_batch_id) {
        await api.linkBatches({
          child_batch_id: paneerForm.id,
          parents: [
            {
              parent_batch_id: paneerForm.parent_batch_id,
              quantity_used: Number(paneerForm.quantity_used),
              unit: 'L',
            },
            {
              parent_batch_id: paneerForm.co_parent_batch_id,
              quantity_used: Number(paneerForm.co_quantity_used),
              unit: 'L',
            },
          ],
        });
      } else {
        await api.linkBatches({
          parent_batch_id: paneerForm.parent_batch_id,
          child_batch_id: paneerForm.id,
          quantity_used: Number(paneerForm.quantity_used),
          unit: 'L',
        });
      }

      await api.addQualityRecord({
        batch_id: paneerForm.id,
        lab_name: 'DairyTrace Central QA Lab, Pune',
        fat_percentage: 24.0,
        snf_percentage: 28.0,
        acidity: 0.18,
        adulterant_test: 'NEGATIVE',
        trust_level: 'VERIFIED',
        contaminant_details: 'Freshly crafted paneer; moisture and milk solids compliant.',
      });

      const inputDesc = paneerForm.has_co_input
        ? `${paneerForm.parent_batch_id} (${paneerForm.quantity_used}L) + ${paneerForm.co_parent_batch_id} (${paneerForm.co_quantity_used}L)`
        : `${paneerForm.parent_batch_id} (${paneerForm.quantity_used}L)`;

      const passportUrl =
        newBatch.passport_url ||
        `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/passport/${newBatch.id}`;

      const fullAllotment = {
        ...newBatch,
        passport_url: passportUrl,
        qr_code_url: `/api/batches/${newBatch.id}/qr`,
        linked_sources: inputDesc,
        quality_summary: 'Fat 24.0% · SNF 28.0% · Acidity 0.18% · Negative Adulterant Screen (FSSAI Compliant)',
        lab_name: 'DairyTrace Central QA Lab, Pune',
        trust_level: 'VERIFIED',
      };

      setAllottedBatch(fullAllotment);
      setActiveTab('confirmation');
      onBatchCreated?.(fullAllotment);
    } catch (err) {
      setErrorMsg(err.message || 'Could not create paneer batch.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handleCopyPassportUrl = () => {
    if (!allottedBatch?.passport_url) return;
    navigator.clipboard.writeText(allottedBatch.passport_url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2200);
  };

  const handleDownloadQr = () => {
    if (!allottedBatch?.id) return;
    const downloadUrl = api.getBatchQrUrl(allottedBatch.id, 'png');
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `DairyTrace-QR-${allottedBatch.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const creationTabs = [
    { id: 'raw_milk', label: '1. Ingest Raw Milk', icon: Milk },
    { id: 'process_paneer', label: '2. Process Paneer Vat', icon: Package },
    ...(allottedBatch ? [{ id: 'confirmation', label: '3. QR Passport Allotted', icon: QrCode }] : []),
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Create Batch &amp; Allot Cryptographic QR Passport"
      description="Authorized QA Officer batch provisioning, milk blending, and laboratory quality attachment."
      icon={Plus}
      tone="safe"
      size="xl"
      dismissable={!loading}
    >
      <div className="space-y-5">
        {errorMsg && (
          <Alert tone="danger" onClose={() => setErrorMsg('')}>
            {errorMsg}
          </Alert>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-ink-200">
          <button
            type="button"
            onClick={() => setActiveTab('raw_milk')}
            className={`tab ${activeTab === 'raw_milk' ? 'border-brand-700 text-brand-800' : ''}`}
          >
            <Milk className="h-4 w-4" />
            Ingest Raw Milk Collection
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('process_paneer')}
            className={`tab ${activeTab === 'process_paneer' ? 'border-brand-700 text-brand-800' : ''}`}
          >
            <Package className="h-4 w-4" />
            Craft &amp; Link Paneer Vat
          </button>
          {allottedBatch && (
            <button
              type="button"
              onClick={() => setActiveTab('confirmation')}
              className={`tab ${activeTab === 'confirmation' ? 'border-brand-700 text-brand-800' : ''}`}
            >
              <QrCode className="h-4 w-4" />
              Passport Allotted ({allottedBatch.id})
            </button>
          )}
        </div>

        {/* TAB 1: Ingest Raw Milk */}
        {activeTab === 'raw_milk' && (
          <form onSubmit={handleCreateRawMilk} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Batch ID (Assigned Code)" htmlFor="milk-id">
                <input
                  id="milk-id"
                  required
                  value={milkForm.id}
                  onChange={(e) => setMilkForm({ ...milkForm, id: e.target.value.toUpperCase() })}
                  className="field uppercase font-mono font-bold"
                />
              </Field>

              <Field label="Collection Facility / Chilling Center" htmlFor="milk-facility">
                <input
                  id="milk-facility"
                  required
                  value={milkForm.facility_name}
                  onChange={(e) => setMilkForm({ ...milkForm, facility_name: e.target.value })}
                  className="field"
                />
              </Field>

              <Field label="Volume Ingested (Liters)" htmlFor="milk-quantity">
                <input
                  id="milk-quantity"
                  type="number"
                  required
                  min="1"
                  value={milkForm.initial_quantity}
                  onChange={(e) => setMilkForm({ ...milkForm, initial_quantity: e.target.value })}
                  className="field"
                />
              </Field>

              <Field label="Assigned Laboratory" htmlFor="milk-lab">
                <input
                  id="milk-lab"
                  required
                  value={milkForm.lab_name}
                  onChange={(e) => setMilkForm({ ...milkForm, lab_name: e.target.value })}
                  className="field"
                />
              </Field>

              <Field label="Milk Fat %" htmlFor="milk-fat">
                <input
                  id="milk-fat"
                  type="number"
                  step="0.1"
                  required
                  value={milkForm.fat_percentage}
                  onChange={(e) => setMilkForm({ ...milkForm, fat_percentage: e.target.value })}
                  className="field"
                />
              </Field>

              <Field label="Milk SNF %" htmlFor="milk-snf">
                <input
                  id="milk-snf"
                  type="number"
                  step="0.1"
                  required
                  value={milkForm.snf_percentage}
                  onChange={(e) => setMilkForm({ ...milkForm, snf_percentage: e.target.value })}
                  className="field"
                />
              </Field>

              <Field label="Acidity % (Lactic Acid)" htmlFor="milk-acidity">
                <input
                  id="milk-acidity"
                  type="number"
                  step="0.01"
                  required
                  value={milkForm.acidity}
                  onChange={(e) => setMilkForm({ ...milkForm, acidity: e.target.value })}
                  className="field"
                />
              </Field>

              <Field label="Adulterant Screen" htmlFor="milk-adulterant">
                <select
                  id="milk-adulterant"
                  value={milkForm.adulterant_test}
                  onChange={(e) => setMilkForm({ ...milkForm, adulterant_test: e.target.value })}
                  className="field font-semibold"
                >
                  <option value="NEGATIVE">NEGATIVE (No Adulterants Found)</option>
                  <option value="SUSPECTED">SUSPECTED (Flag for Secondary Test)</option>
                </select>
              </Field>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-ink-100 pt-4">
              <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? 'Creating & Allotting QR…' : 'Create Raw Milk Batch'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Process Paneer Vat */}
        {activeTab === 'process_paneer' && (
          milkBatches.length === 0 ? (
            <div className="space-y-4 py-4 text-center">
              <Alert variant="warning" title="No Active Raw Milk in Inventory">
                Paneer processing requires at least one active raw milk batch in inventory as a source. Ingest a raw milk batch first using the Ingest Raw Milk tab.
              </Alert>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('raw_milk')}
                  className="btn btn-primary"
                >
                  Ingest Raw Milk Now
                </button>
                <button type="button" onClick={onClose} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreatePaneerLink} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Finished Paneer Batch ID" htmlFor="paneer-id">
                  <input
                    id="paneer-id"
                    required
                    value={paneerForm.id}
                    onChange={(e) => setPaneerForm({ ...paneerForm, id: e.target.value.toUpperCase() })}
                    className="field uppercase font-mono font-bold"
                  />
                </Field>

                <Field label="Manufacturing Facility" htmlFor="paneer-facility">
                  <input
                    id="paneer-facility"
                    required
                    value={paneerForm.facility_name}
                    onChange={(e) => setPaneerForm({ ...paneerForm, facility_name: e.target.value })}
                    className="field"
                  />
                </Field>

                <Field label="Paneer Yield (kg)" htmlFor="paneer-yield">
                  <input
                    id="paneer-yield"
                    type="number"
                    required
                    min="1"
                    value={paneerForm.initial_quantity}
                    onChange={(e) => setPaneerForm({ ...paneerForm, initial_quantity: e.target.value })}
                    className="field"
                  />
                </Field>

                <Field label="Primary Source Milk Batch" htmlFor="paneer-parent">
                  <select
                    id="paneer-parent"
                    required
                    value={paneerForm.parent_batch_id}
                    onChange={(e) => setPaneerForm({ ...paneerForm, parent_batch_id: e.target.value })}
                    className="field font-mono font-semibold"
                  >
                    {milkBatches.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id} · {m.facility_name} ({m.remaining_quantity}L remaining)
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Primary Milk Volume Used (Liters)" htmlFor="paneer-qty-used">
                  <input
                    id="paneer-qty-used"
                    type="number"
                    required
                    min="1"
                    value={paneerForm.quantity_used}
                    onChange={(e) => setPaneerForm({ ...paneerForm, quantity_used: e.target.value })}
                    className="field"
                  />
                </Field>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-ink-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paneerForm.has_co_input}
                      onChange={(e) => setPaneerForm({ ...paneerForm, has_co_input: e.target.checked })}
                      className="h-4 w-4 rounded accent-brand-800"
                    />
                    <span>Co-blend secondary milk batch into vat</span>
                  </label>
                </div>

                {paneerForm.has_co_input && (
                  <>
                    <Field label="Co-Input Milk Batch" htmlFor="co-parent">
                      <select
                        id="co-parent"
                        value={paneerForm.co_parent_batch_id}
                        onChange={(e) => setPaneerForm({ ...paneerForm, co_parent_batch_id: e.target.value })}
                        className="field font-mono font-semibold"
                      >
                        {milkBatches.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} · {m.facility_name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Co-Input Volume (Liters)" htmlFor="co-qty">
                      <input
                        id="co-qty"
                        type="number"
                        min="1"
                        value={paneerForm.co_quantity_used}
                        onChange={(e) => setPaneerForm({ ...paneerForm, co_quantity_used: e.target.value })}
                        className="field"
                      />
                    </Field>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2.5 border-t border-ink-100 pt-4">
                <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Processing & Linking Batch…' : 'Craft & Link Paneer Batch'}
                </button>
              </div>
            </form>
          )
        )}

        {/* TAB 3: Confirmation & Passport QR */}
        {activeTab === 'confirmation' && allottedBatch && (
          <div className="card p-6 border-brand-200 bg-brand-50/20 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-800 text-white shadow-sm">
              <CheckCircle className="h-8 w-8" />
            </div>

            <div>
              <span className="badge badge-safe">Allotted to Registry</span>
              <h3 className="section-title text-2xl mt-2 font-mono font-bold text-ink-900">
                {allottedBatch.id}
              </h3>
              <p className="muted text-xs sm:text-sm mt-1 max-w-md mx-auto">
                Cryptographic passport and scannable pack QR generated. Linked to facility and verified laboratory quality standards.
              </p>
            </div>

            {/* QR Code Card */}
            <div className="mx-auto inline-flex flex-col items-center rounded-card border border-ink-200 bg-white p-4 shadow-sm">
              <QRCodeSVG value={allottedBatch.passport_url} size={140} level="H" includeMargin={false} />
              <span className="mt-2 font-mono text-xs font-bold text-brand-900">
                {allottedBatch.id}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyPassportUrl}
                className="btn btn-secondary btn-sm"
              >
                {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedUrl ? 'Copied Link' : 'Copy Passport Link'}
              </button>

              <button
                type="button"
                onClick={handleDownloadQr}
                className="btn btn-secondary btn-sm"
              >
                <Download className="h-3.5 w-3.5" />
                Download QR Code
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewPassport?.(allottedBatch.id);
                }}
                className="btn btn-primary btn-sm"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Customer Passport
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBatchAudit?.(allottedBatch.id);
                }}
                className="btn btn-secondary btn-sm"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Open in Audit Console
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
