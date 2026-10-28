/**
 * Front-end runtime switches.
 *
 * VITE_DEMO_MODE
 *   "true"  (default in development) shows sample batches and pre-seeded demo
 *           accounts to make evaluation easy.
 *   "false" (set this for a real deployment) hides every demo helper.
 */
const explicit = import.meta.env?.VITE_DEMO_MODE;

export const DEMO_MODE =
  explicit === undefined || explicit === '' ? true : explicit !== 'false';

export const DEMO_BATCHES = [
  { id: 'PAN-201', name: 'Malai Paneer', note: 'Blended batch' },
  { id: 'MILK-101', name: 'Raw Milk', note: 'Shirur collection' },
  { id: 'PAN-303', name: 'Paneer', note: 'Control batch' },
];

export const DEMO_ACCOUNTS = [
  {
    role: 'INSPECTOR',
    name: 'Priya Nair',
    title: 'Inspector',
    email: 'inspector@dairytrace.demo',
    password: 'Inspect@2026',
    summary: 'Audit batches, log inspections and review complaints.',
  },
  {
    role: 'QA_OFFICER',
    name: 'Vikram Patil',
    title: 'QA Officer',
    email: 'qa@dairytrace.demo',
    password: 'QaOfficer@2026',
    summary: 'Everything an inspector can do, plus create batches and issue recalls.',
  },
];
