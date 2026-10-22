import { api } from '../../api';
import type { ComplaintForm, LockedBatchContext } from './types';

export interface AiResponse {
  message: string;
  patch: Partial<ComplaintForm>;
  missingFields: string[];
  risk: string | null;
  rootCause?: string | null;
  capaRecommendations?: string[];
  engine?: string;
}

export interface UploadedDocumentResponse extends AiResponse {
  sourceFile: string;
  extractedCharacters: number;
  textTruncated: boolean;
}

export interface BatchComplaintContext {
  batchId: string;
  productType: string;
  locked: LockedBatchContext;
  otherReports: number;
}

export interface SavedComplaintRecord {
  id: number;
  complaintNumber: string;
  batchId: string;
  customerName: string;
  complaintSource: string;
  productName: string;
  strengthGrade: string;
  batchLotNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  affectedQuantity: string;
  originatingSite: string;
  impactedMaterial: string;
  complaintType: string;
  complaintDate: string;
  defectSummary: string;
  detailedDescription: string;
  severity: string;
  priority: string;
  riskAssessment: string;
  rootCause?: string;
  capaRecommendations?: string[];
  status: string;
  createdAt: string;
  otherReports?: number;
  autoFlagged?: boolean;
}

export async function fetchComplaintBatchContext(batchId: string): Promise<BatchComplaintContext> {
  return api.getComplaintBatchContext(batchId);
}

export async function processComplaint(
  batchId: string,
  text: string,
  currentForm: ComplaintForm
): Promise<AiResponse> {
  return api.processComplaint(batchId, text, currentForm);
}

export async function uploadComplaint(
  batchId: string,
  file: File,
  currentForm: ComplaintForm
): Promise<UploadedDocumentResponse> {
  return api.uploadComplaint(batchId, file, currentForm);
}

export async function commitComplaintToDb(
  batchId: string,
  form: ComplaintForm,
  risk: string | null,
  rootCause?: string | null,
  capaRecommendations?: string[]
): Promise<SavedComplaintRecord> {
  return api.commitComplaint({
    batchId,
    form,
    risk,
    rootCause: rootCause || null,
    capaRecommendations: capaRecommendations || [],
  });
}

export async function updateSavedComplaintInDb(
  id: number,
  batchId: string,
  form: ComplaintForm,
  risk: string | null,
  rootCause?: string | null,
  capaRecommendations?: string[]
): Promise<SavedComplaintRecord> {
  return api.updateComplaint(id, {
    batchId,
    form,
    risk,
    rootCause: rootCause || null,
    capaRecommendations: capaRecommendations || [],
  });
}

export async function fetchSavedComplaints(batchId?: string): Promise<SavedComplaintRecord[]> {
  return api.getComplaints(batchId ? { batchId } : {});
}

export async function updateComplaintRecordStatus(
  id: number,
  status: string
): Promise<SavedComplaintRecord> {
  return api.updateComplaintStatus(id, status);
}

export async function deleteSavedComplaint(id: number): Promise<void> {
  await api.deleteComplaint(id);
}
