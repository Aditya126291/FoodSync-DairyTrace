import React from 'react';
import { DEMO_MODE } from '../config';

export default function PublicFooter({ className = '' }) {
  return (
    <footer className={`no-print border-t border-ink-200 bg-white ${className}`}>
      <div className="container-page flex flex-col gap-1 py-6 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-ink-700">DairyTrace</span> · Farm-to-pack dairy traceability
        </p>
        <p>
          {DEMO_MODE
            ? 'Demo build — all batches shown are sample data.'
            : 'Food safety information is provided by the manufacturer and verified laboratories.'}
        </p>
      </div>
    </footer>
  );
}
