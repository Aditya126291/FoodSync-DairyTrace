import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle, LayoutDashboard, Milk } from 'lucide-react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Navbar from './components/Navbar';
import RequireRole from './components/RequireRole';
import RecallModal from './components/RecallModal';
import BatchCreationModal from './components/BatchCreationModal';
import FSSAINoticeModal from './components/FSSAINoticeModal';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import InspectorHub from './pages/InspectorHub';
import ConsumerPassportPage from './pages/ConsumerPassportPage';
import ComplaintWorkspace from './features/complaints/ComplaintWorkspace';
import PublicHeader from './components/PublicHeader';
import PublicFooter from './components/PublicFooter';
import { Toast } from './components/ui';
import { api } from './api';

function routeFromPath() {
  const path = window.location.pathname;

  if (/^\/login\/?$/i.test(path)) {
    return { view: 'login', batchId: '' };
  }

  const consumerReport = path.match(/^\/passport\/([^/]+)\/report\/?$/i);
  if (consumerReport) {
    return { view: 'consumer-report', batchId: decodeURIComponent(consumerReport[1]) };
  }

  const passport = path.match(/^\/passport\/([^/]+)\/?$/i);
  if (passport) {
    return { view: 'passport', batchId: decodeURIComponent(passport[1]) };
  }

  const staffReport =
    path.match(/^\/staff\/batch\/([^/]+)\/report\/?$/i) ||
    path.match(/^\/inspect\/([^/]+)\/report\/?$/i);
  if (staffReport) {
    return { view: 'staff-report', batchId: decodeURIComponent(staffReport[1]) };
  }

  const staffBatch =
    path.match(/^\/staff\/batch\/([^/]+)\/?$/i) ||
    path.match(/^\/inspect\/([^/]+)\/?$/i);
  if (staffBatch) {
    return { view: 'staff-batch', batchId: decodeURIComponent(staffBatch[1]) };
  }

  if (/^\/(?:staff|inspect)\/?$/i.test(path)) {
    return { view: 'staff-dashboard', batchId: '' };
  }

  return { view: 'home', batchId: '' };
}

function AppShell() {
  const { user, isAuthenticated, isStaff, isQA, logout } = useAuth();
  const [route, setRoute] = useState(routeFromPath);
  const [postLoginPath, setPostLoginPath] = useState('/staff');
  const [batches, setBatches] = useState([]);
  const [links, setLinks] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanError, setScanError] = useState('');
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [recallTargetBatchId, setRecallTargetBatchId] = useState('');
  const [recallTargetReason, setRecallTargetReason] = useState('');
  const [auditRefreshVersion, setAuditRefreshVersion] = useState(0);
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  const [isFssaiNoticeModalOpen, setIsFssaiNoticeModalOpen] = useState(false);
  const [activeRecallNoticeId, setActiveRecallNoticeId] = useState(1);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
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

  const loadStaffData = useCallback(async () => {
    if (!isAuthenticated || !isStaff) return;
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
  }, [isAuthenticated, isStaff]);

  useEffect(() => {
    if (!isAuthenticated || !isStaff) {
      setBatches([]);
      setLinks([]);
      setDistributions([]);
      return;
    }
    loadStaffData().catch(() =>
      showToast('Batch records could not be loaded. Check that the backend server is running.', 'error')
    );
  }, [isAuthenticated, isStaff, loadStaffData, showToast]);

  const handleScanBatch = async (batchId) => {
    setLoadingScan(true);
    setScanError('');
    try {
      const passport = await api.getPublicPassport(batchId);
      const resolvedId = passport.id || passport.batch_id || batchId;
      if (isAuthenticated && isStaff) {
        navigate(`/staff/batch/${encodeURIComponent(resolvedId)}`);
      } else {
        navigate(`/passport/${encodeURIComponent(resolvedId)}`);
      }
    } catch (error) {
      setScanError(
        error.status === 404 || /not found/i.test(error.message || '')
          ? `Batch "${batchId}" was not found. Check the code and scan again.`
          : 'Could not verify this batch code. Check your connection and try again.'
      );
    } finally {
      setLoadingScan(false);
    }
  };

  const handleRequireLoginRedirect = useCallback(() => {
    const currentPath = window.location.pathname;
    if (currentPath && currentPath !== '/login' && currentPath !== '/') {
      setPostLoginPath(currentPath);
    } else {
      setPostLoginPath('/staff');
    }
    navigate('/login', true);
  }, [navigate]);

  const handleLoginSuccess = (loggedInUser) => {
    showToast(`Signed in as ${loggedInUser.full_name} (${loggedInUser.role === 'QA_OFFICER' ? 'QA Officer' : 'Inspector'}).`);
    navigate(postLoginPath || '/staff', true);
  };

  const handleLogout = async () => {
    await logout();
    showToast('Signed out of staff session.');
    navigate('/');
  };

  const openRecallModal = (batchId, reason = '') => {
    setRecallTargetBatchId(batchId);
    setRecallTargetReason(reason);
    setIsRecallModalOpen(true);
  };

  const handleRecallExecuted = async (result) => {
    setActiveRecallNoticeId(result?.recall_event?.id || 1);
    await loadStaffData();
    setAuditRefreshVersion((v) => v + 1);
    showToast(`Recall executed for ${result?.recall_event?.root_batch_id || 'batch'}.`);
  };

  const handleBatchCreated = async (newBatch) => {
    await loadStaffData();
    showToast(`Batch ${newBatch?.id || ''} created and allotted with QR passport.`);
  };

  const openFssaiNotice = (recallId = 1) => {
    setActiveRecallNoticeId(recallId || 1);
    setIsFssaiNoticeModalOpen(true);
  };

  const onSelectStaffBatch = (batchId) =>
    navigate(`/staff/batch/${encodeURIComponent(batchId)}`);

  const onClearStaffBatch = () => navigate('/staff');

  const onViewPassport = (batchId) =>
    navigate(`/passport/${encodeURIComponent(batchId)}`);

  const onOpenStaffComplaintWorkspace = (batchId) => {
    const target = batchId || route.batchId || batches[0]?.id || 'PAN-201';
    navigate(`/staff/batch/${encodeURIComponent(target)}/report`);
  };

  const isStaffView =
    route.view === 'staff-dashboard' ||
    route.view === 'staff-batch' ||
    route.view === 'staff-report';

  return (
    <div className="min-h-screen bg-canvas text-ink-800">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {route.view === 'home' && (
        <LandingPage
          onScanBatch={handleScanBatch}
          onStaffLoginClick={() => {
            setPostLoginPath('/staff');
            navigate('/login');
          }}
          onOpenStaffDashboard={() => navigate('/staff')}
          loading={loadingScan}
          error={scanError}
        />
      )}

      {route.view === 'login' && (
        <LoginPage
          onSuccess={handleLoginSuccess}
          onBackHome={() => navigate('/')}
        />
      )}

      {route.view === 'passport' && (
        <div className="flex min-h-screen flex-col justify-between">
          <div>
            <PublicHeader subtitle="Public Product Passport" onHome={() => navigate('/')}>
              {isAuthenticated && isStaff ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/staff/batch/${encodeURIComponent(route.batchId)}`)
                  }
                  className="btn btn-primary btn-sm"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Staff Workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPostLoginPath(`/staff/batch/${encodeURIComponent(route.batchId)}`);
                    navigate('/login');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Staff Portal
                </button>
              )}
            </PublicHeader>

            <ConsumerPassportPage
              initialBatchId={route.batchId}
              onBackToScanner={() => navigate('/')}
              onReportConcern={(batchId) =>
                navigate(`/passport/${encodeURIComponent(batchId || route.batchId)}/report`)
              }
            />
          </div>
          <PublicFooter />
        </div>
      )}

      {route.view === 'consumer-report' && (
        <div className="flex min-h-screen flex-col justify-between">
          <div>
            <PublicHeader subtitle="Public Quality & Safety Feedback" onHome={() => navigate('/')}>
              <button
                type="button"
                onClick={() => navigate(`/passport/${encodeURIComponent(route.batchId)}`)}
                className="btn btn-secondary btn-sm"
              >
                Back to Passport
              </button>
            </PublicHeader>

            <ComplaintWorkspace
              batchId={route.batchId}
              mode="consumer"
              onBack={() =>
                navigate(`/passport/${encodeURIComponent(route.batchId)}`)
              }
            />
          </div>
          <PublicFooter />
        </div>
      )}

      {isStaffView && (
        <RequireRole
          roles={['INSPECTOR', 'QA_OFFICER']}
          onUnauthenticated={handleRequireLoginRedirect}
        >
          <Navbar
            activeView={route.view === 'staff-dashboard' ? 'dashboard' : 'batch'}
            onNavigateDashboard={() => navigate('/staff')}
            onLogout={handleLogout}
          />

          {(route.view === 'staff-dashboard' || route.view === 'staff-batch') && (
            <>
              <InspectorHub
                batches={batches}
                links={links}
                distributions={distributions}
                initialBatchId={route.view === 'staff-batch' ? route.batchId : ''}
                auditRefreshVersion={auditRefreshVersion}
                onSelectBatch={onSelectStaffBatch}
                onClearBatch={onClearStaffBatch}
                onOpenCreateBatch={() => setIsCreateBatchModalOpen(true)}
                onOpenRecall={openRecallModal}
                onOpenComplaintWorkspace={onOpenStaffComplaintWorkspace}
                onOpenFssaiNotice={openFssaiNotice}
                onViewPassport={onViewPassport}
                onRefreshBatches={loadStaffData}
                onNotify={showToast}
              />
              <footer className="border-t border-ink-200 bg-canvas px-4 py-5 text-center text-xs text-ink-500">
                DairyTrace · Verified Staff Traceability &amp; Audit Workspace ({user?.email})
              </footer>
            </>
          )}

          {route.view === 'staff-report' && (
            <ComplaintWorkspace
              batchId={route.batchId}
              mode="staff"
              onBack={() =>
                navigate(`/staff/batch/${encodeURIComponent(route.batchId)}`)
              }
              onInitiateRecall={(targetBatchId, reason) => {
                openRecallModal(targetBatchId, reason);
              }}
            />
          )}

          <RecallModal
            isOpen={isRecallModalOpen}
            onClose={() => setIsRecallModalOpen(false)}
            initialBatchId={recallTargetBatchId}
            initialReason={recallTargetReason}
            batches={batches}
            onRecallExecuted={handleRecallExecuted}
            onOpenFssaiNotice={openFssaiNotice}
          />

          {isQA && (
            <BatchCreationModal
              isOpen={isCreateBatchModalOpen}
              onClose={() => setIsCreateBatchModalOpen(false)}
              existingBatches={batches}
              onBatchCreated={handleBatchCreated}
              onViewPassport={onViewPassport}
              onOpenBatchAudit={onSelectStaffBatch}
            />
          )}

          <FSSAINoticeModal
            isOpen={isFssaiNoticeModalOpen}
            onClose={() => setIsFssaiNoticeModalOpen(false)}
            recallId={activeRecallNoticeId}
          />
        </RequireRole>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
