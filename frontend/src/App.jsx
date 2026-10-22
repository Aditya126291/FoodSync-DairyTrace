import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Milk } from 'lucide-react';
import Navbar from './components/Navbar';
import RecallModal from './components/RecallModal';
import BatchCreationModal from './components/BatchCreationModal';
import FSSAINoticeModal from './components/FSSAINoticeModal';
import ComplaintModal from './components/ComplaintModal';
import LandingPage from './pages/LandingPage';
import InspectorHub from './pages/InspectorHub';
import ConsumerPassportPage from './pages/ConsumerPassportPage';
import { api } from './api';

function routeFromPath() {
  const path = window.location.pathname;
  const passport = path.match(/^\/passport\/([^/]+)/i);
  if (passport) return { view: 'passport', batchId: decodeURIComponent(passport[1]) };
  const inspector = path.match(/^\/inspect(?:\/([^/]+))?\/?$/i);
  if (inspector) return { view: 'inspector', batchId: inspector[1] ? decodeURIComponent(inspector[1]) : '' };
  return { view: 'home', batchId: '' };
}

export default function App() {
  const [route, setRoute] = useState(routeFromPath);
  const [role, setRole] = useState(() => sessionStorage.getItem('dairytrace.demoRole') || '');
  const [batches, setBatches] = useState([]);
  const [links, setLinks] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loadingPassport, setLoadingPassport] = useState(false);
  const [passportError, setPassportError] = useState('');
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [recallTargetBatchId, setRecallTargetBatchId] = useState('');
  const [recallTargetReason, setRecallTargetReason] = useState('');
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [complaintInitialBatchId, setComplaintInitialBatchId] = useState('');
  const [auditRefreshVersion, setAuditRefreshVersion] = useState(0);
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  const [isFssaiNoticeModalOpen, setIsFssaiNoticeModalOpen] = useState(false);
  const [activeRecallNoticeId, setActiveRecallNoticeId] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const navigate = useCallback((path, replace = false) => {
    if (window.location.pathname !== path) {
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({}, '', path);
    }
    setRoute(routeFromPath());
  }, []);

  useEffect(() => {
    const handlePopState = () => setRoute(routeFromPath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadInspectorData = useCallback(async () => {
    const batchList = await api.getBatches();
    setBatches(batchList || []);
    if (batchList?.length) {
      const lineageData = await api.getLineage(batchList[0].id);
      setLinks(lineageData?.allLinks || lineageData?.edges || []);
      setDistributions(lineageData?.allDistributions || lineageData?.distributions || []);
    } else {
      setLinks([]);
      setDistributions([]);
    }
  }, []);

  useEffect(() => {
    if (role !== 'inspector') {
      setBatches([]);
      setLinks([]);
      setDistributions([]);
      return;
    }
    loadInspectorData().catch(() => showToast('Batch records could not be loaded. Check that the API is running.', 'error'));
  }, [role, loadInspectorData, showToast]);

  useEffect(() => {
    if (route.view === 'inspector' && role !== 'inspector') {
      navigate('/', true);
      showToast('Choose Inspector access from the landing page to open audit tools.', 'error');
    }
  }, [route, role, navigate, showToast]);

  const enterInspector = () => {
    sessionStorage.setItem('dairytrace.demoRole', 'inspector');
    setRole('inspector');
    navigate('/inspect');
  };

  const exitToHome = () => {
    sessionStorage.removeItem('dairytrace.demoRole');
    sessionStorage.removeItem('dairytrace.consumerBatchId');
    setRole('');
    navigate('/');
  };

  const handleConsumerScan = async (batchId) => {
    setLoadingPassport(true);
    setPassportError('');
    try {
      const passport = await api.getPublicPassport(batchId);
      const resolvedId = passport.id || passport.batch_id || batchId;
      sessionStorage.setItem('dairytrace.demoRole', 'consumer');
      sessionStorage.setItem('dairytrace.consumerBatchId', resolvedId);
      setRole('consumer');
      navigate(`/passport/${encodeURIComponent(resolvedId)}`);
    } catch (error) {
      setPassportError(error.status === 404 || /not found/i.test(error.message)
        ? `Batch ${batchId} was not found. Check the code and scan again.`
        : 'We could not verify this product. Check your connection and try again.');
    } finally {
      setLoadingPassport(false);
    }
  };

  const openRecallModal = (batchId, reason = '') => {
    setRecallTargetBatchId(batchId);
    setRecallTargetReason(reason);
    setIsRecallModalOpen(true);
  };

  const openComplaintModal = (batchId = '') => {
    setComplaintInitialBatchId(batchId || '');
    setIsComplaintModalOpen(true);
  };

  const handleInitiateRecallFromComplaint = (batchId, reason, severity) => {
    setRecallTargetBatchId(batchId);
    setRecallTargetReason(reason || 'Reported contaminant / quality hazard');
    setIsRecallModalOpen(true);
  };

  const handleRecallExecuted = async (result) => {
    setActiveRecallNoticeId(result?.recall_event?.id || 1);
    await loadInspectorData();
    setAuditRefreshVersion((value) => value + 1);
    showToast(`Safety action recorded for ${result?.recall_event?.root_batch_id || 'batch'}.`);
  };

  const handleBatchCreated = async (newBatch) => {
    await loadInspectorData();
    showToast(`Batch ${newBatch?.id || ''} allotted with designated QR code.`);
  };

  const resetDemo = async () => {
    setIsRefreshing(true);
    try {
      await api.seedPitchScenario();
      await loadInspectorData();
      navigate('/inspect');
      showToast('Demo batches were reset to the starter scenario.');
    } catch {
      showToast('Could not reset demo data.', 'error');
    } finally { setIsRefreshing(false); }
  };

  const onSelectInspectorBatch = (batchId) => navigate(`/inspect/${encodeURIComponent(batchId)}`);
  const onViewPassport = (batchId) => navigate(`/passport/${encodeURIComponent(batchId)}`);

  return (
    <div className="min-h-screen bg-[#faf8f2] text-stone-800">
      {toast && <div role="status" className={`fixed bottom-4 right-4 z-[80] flex max-w-sm items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl ${toast.type === 'error' ? 'border-rose-200 bg-white text-rose-800' : 'border-emerald-200 bg-white text-stone-800'}`}>{toast.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" /> : <CheckCircle className="h-4 w-4 shrink-0 text-emerald-700" />}{toast.message}</div>}

      {route.view === 'home' && <LandingPage onConsumerScan={handleConsumerScan} onInspectorEnter={enterInspector} loading={loadingPassport} error={passportError} />}

      {route.view === 'passport' && <>
        <header className="border-b border-stone-200 bg-white px-4 py-3 sm:px-7"><div className="mx-auto flex max-w-7xl items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-900 text-white"><Milk className="h-4 w-4" /></span><span><strong className="block font-display text-lg text-stone-900">DairyTrace</strong><span className="text-[11px] text-stone-500">Public product passport</span></span></div></header>
        <ConsumerPassportPage initialBatchId={route.batchId} onBackToDashboard={exitToHome} onOpenComplaintModal={openComplaintModal} />
      </>}

      {route.view === 'inspector' && role === 'inspector' && <>
        <Navbar currentView="inspector" setCurrentView={exitToHome} onOpenCreateBatchModal={() => setIsCreateBatchModalOpen(true)} onOpenComplaintModal={() => openComplaintModal()} onReloadPitchScenario={resetDemo} isRefreshing={isRefreshing} />
        <InspectorHub batches={batches} links={links} distributions={distributions} initialBatchId={route.batchId} auditRefreshVersion={auditRefreshVersion} onSelectBatch={onSelectInspectorBatch} onOpenCreateBatch={() => setIsCreateBatchModalOpen(true)} onOpenRecall={openRecallModal} onOpenComplaint={openComplaintModal} onViewPassport={onViewPassport} onNotify={showToast} />
        <footer className="border-t border-stone-200 bg-white px-4 py-5 text-center text-xs text-stone-500">DairyTrace · Inspector demo workspace</footer>
      </>}

      {role === 'inspector' && <>
        <RecallModal isOpen={isRecallModalOpen} onClose={() => setIsRecallModalOpen(false)} initialBatchId={recallTargetBatchId} initialReason={recallTargetReason} batches={batches} onRecallExecuted={handleRecallExecuted} onOpenFssaiNotice={(id) => { setActiveRecallNoticeId(id); setIsFssaiNoticeModalOpen(true); }} />
        <BatchCreationModal isOpen={isCreateBatchModalOpen} onClose={() => setIsCreateBatchModalOpen(false)} existingBatches={batches} onBatchCreated={handleBatchCreated} onViewPassport={onViewPassport} />
        <FSSAINoticeModal isOpen={isFssaiNoticeModalOpen} onClose={() => setIsFssaiNoticeModalOpen(false)} recallId={activeRecallNoticeId} />
      </>}

      <ComplaintModal
        isOpen={isComplaintModalOpen}
        onClose={() => setIsComplaintModalOpen(false)}
        initialBatchId={complaintInitialBatchId}
        batches={batches}
        onComplaintSubmitted={async (complaint) => {
          showToast(`Complaint ${complaint.complaint_ref} saved to ledger.`);
          if (role === 'inspector') {
            await loadInspectorData();
            setAuditRefreshVersion((v) => v + 1);
          }
        }}
        onInitiateRecall={role === 'inspector' ? handleInitiateRecallFromComplaint : undefined}
      />
    </div>
  );
}
