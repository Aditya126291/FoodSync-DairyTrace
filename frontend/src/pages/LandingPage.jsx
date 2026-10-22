import React, { useState } from 'react';
import { ArrowRight, Check, Clock3, Leaf, Milk, Search, ShieldCheck, Sparkles } from 'lucide-react';
import QrScanner from '../components/QrScanner';
import { extractBatchId } from '../utils/qr';

export default function LandingPage({ onConsumerScan, onInspectorEnter, loading, error }) {
  const [scanError, setScanError] = useState('');

  const handleScan = (value) => {
    const batchId = extractBatchId(value);
    if (!batchId) {
      setScanError('That QR code is not a DairyTrace product code. Please try another code.');
      return;
    }
    setScanError('');
    onConsumerScan(batchId);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#faf8f2] text-stone-800">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8 lg:px-12">
        <a href="/" className="flex items-center gap-3" aria-label="DairyTrace home">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-900 text-white shadow-lg shadow-emerald-950/10"><Milk className="h-5 w-5" /></span>
          <span><strong className="block font-display text-xl font-semibold tracking-tight text-stone-900">DairyTrace</strong><span className="text-xs font-medium text-stone-500">Know what’s in your dairy</span></span>
        </a>
        <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-900 sm:inline-flex"><ShieldCheck className="h-4 w-4" /> Trusted from farm to table</span>
      </header>

      <main className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-4 sm:px-8 md:grid-cols-[.9fr_1.1fr] md:gap-14 md:pb-24 md:pt-10 lg:px-12">
        <section className="panel-enter order-1 md:order-1">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-lime-100 px-3 py-1.5 text-xs font-bold text-emerald-950"><Sparkles className="h-3.5 w-3.5" /> Product transparency, made simple</div>
          <h1 className="max-w-xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-stone-950 sm:text-5xl lg:text-[3.65rem]">A little more trust in <span className="text-emerald-800">every sip.</span></h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-stone-600 sm:text-lg">Scan the code on your dairy product to see where it came from, how it was checked, and whether it’s safe to enjoy.</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-stone-200/80 bg-white/80 p-3 text-sm font-semibold text-stone-700"><Leaf className="h-4 w-4 shrink-0 text-emerald-700" /> Clear origins</div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-stone-200/80 bg-white/80 p-3 text-sm font-semibold text-stone-700"><Check className="h-4 w-4 shrink-0 text-emerald-700" /> Quality checked</div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-stone-200/80 bg-white/80 p-3 text-sm font-semibold text-stone-700"><Clock3 className="h-4 w-4 shrink-0 text-emerald-700" /> Freshness info</div>
          </div>

          <button type="button" onClick={onInspectorEnter} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-emerald-900 transition hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><Search className="h-4 w-4" /> Inspector access <ArrowRight className="h-4 w-4" /></button>
          <p className="ml-2 mt-1 text-xs text-stone-500">For product checks, audits, and detailed batch lookups.</p>
        </section>

        <section className="order-2 panel-enter md:order-2" aria-label="Scan a dairy product">
          <div className="mb-3 flex items-center justify-between px-1">
            <div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">Start here</p><h2 className="mt-1 font-display text-2xl font-semibold text-stone-900">Scan your product</h2></div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500 shadow-sm">About 10 seconds</span>
          </div>
          <QrScanner title="Find your product passport" description="Hold the QR code steady in the frame, or upload a photo of the code." onScan={handleScan} />
          {(scanError || error) && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{scanError || error}</p>}
          {loading && <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">Checking this product’s details…</div>}
          <p className="mt-3 text-center text-xs leading-5 text-stone-500">We’ll only show information for the product code you scan.</p>
        </section>
      </main>
      <footer className="border-t border-stone-200/70 bg-white/60 px-4 py-5 text-center text-xs text-stone-500">DairyTrace • Clear product journeys for everyone</footer>
    </div>
  );
}
