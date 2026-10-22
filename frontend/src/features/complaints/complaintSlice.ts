import { emptyComplaint, LOCKED_FIELD_KEYS, type ComplaintForm, type LockedBatchContext } from './types';
import type { SavedComplaintRecord } from './api';

export interface ComplaintState {
  form: ComplaintForm;
  lockedContext: LockedBatchContext;
  status: 'Draft' | 'Pending Triage' | 'Saved';
  changedFields: string[];
  lastSavedNumber: string | null;
  activeSavedDbId: number | null;
}

const emptyLocked: LockedBatchContext = {
  productName: '',
  batchLotNumber: '',
  manufacturingDate: '',
  expiryDate: '',
  originatingSite: '',
};

export const initialComplaintState: ComplaintState = {
  form: { ...emptyComplaint },
  lockedContext: { ...emptyLocked },
  status: 'Pending Triage',
  changedFields: [],
  lastSavedNumber: null,
  activeSavedDbId: null,
};

export type ComplaintAction =
  | { type: 'complaint/updateField'; payload: { field: keyof ComplaintForm; value: string } }
  | { type: 'complaint/applyPatch'; payload: Partial<ComplaintForm> }
  | { type: 'complaint/setLockedContext'; payload: { locked: LockedBatchContext; defaultSource?: string; defaultCustomerName?: string } }
  | { type: 'complaint/resetForm' }
  | { type: 'complaint/markSaved'; payload: { id: number; complaintNumber: string } }
  | { type: 'complaint/loadSavedComplaintForEditing'; payload: SavedComplaintRecord };

export const updateField = (payload: { field: keyof ComplaintForm; value: string }): ComplaintAction => ({
  type: 'complaint/updateField',
  payload,
});

export const applyPatch = (payload: Partial<ComplaintForm>): ComplaintAction => ({
  type: 'complaint/applyPatch',
  payload,
});

export const setLockedContext = (payload: {
  locked: LockedBatchContext;
  defaultSource?: string;
  defaultCustomerName?: string;
}): ComplaintAction => ({
  type: 'complaint/setLockedContext',
  payload,
});

export const resetForm = (): ComplaintAction => ({
  type: 'complaint/resetForm',
});

export const markSaved = (payload: { id: number; complaintNumber: string }): ComplaintAction => ({
  type: 'complaint/markSaved',
  payload,
});

export const loadSavedComplaintForEditing = (payload: SavedComplaintRecord): ComplaintAction => ({
  type: 'complaint/loadSavedComplaintForEditing',
  payload,
});

export function complaintReducer(
  state: ComplaintState = initialComplaintState,
  action: ComplaintAction
): ComplaintState {
  switch (action.type) {
    case 'complaint/updateField': {
      const { field, value } = action.payload;
      if (LOCKED_FIELD_KEYS.includes(field as keyof LockedBatchContext)) {
        return state;
      }
      const nextChanged = state.changedFields.includes(field)
        ? state.changedFields
        : [...state.changedFields, field];
      return {
        ...state,
        form: {
          ...state.form,
          [field]: value,
        },
        changedFields: nextChanged,
      };
    }

    case 'complaint/applyPatch': {
      const nextForm = { ...state.form };
      const nextChanged = [...state.changedFields];
      Object.entries(action.payload || {}).forEach(([field, value]) => {
        if (LOCKED_FIELD_KEYS.includes(field as keyof LockedBatchContext)) {
          return;
        }
        if (value !== undefined && value !== '') {
          (nextForm as Record<string, string>)[field] = String(value);
          if (!nextChanged.includes(field)) {
            nextChanged.push(field);
          }
        }
      });
      // Always enforce locked fields from batch context
      Object.assign(nextForm, state.lockedContext);
      return {
        ...state,
        form: nextForm,
        changedFields: nextChanged,
      };
    }

    case 'complaint/setLockedContext': {
      const { locked, defaultSource, defaultCustomerName } = action.payload;
      return {
        ...state,
        lockedContext: { ...locked },
        form: {
          ...state.form,
          ...locked,
          complaintSource: state.form.complaintSource || defaultSource || '',
          customerName: state.form.customerName || defaultCustomerName || '',
        },
      };
    }

    case 'complaint/resetForm': {
      return {
        ...initialComplaintState,
        lockedContext: { ...state.lockedContext },
        form: {
          ...emptyComplaint,
          ...state.lockedContext,
        },
      };
    }

    case 'complaint/markSaved': {
      return {
        ...state,
        status: 'Saved',
        changedFields: [],
        activeSavedDbId: action.payload.id,
        lastSavedNumber: action.payload.complaintNumber,
      };
    }

    case 'complaint/loadSavedComplaintForEditing': {
      const r = action.payload;
      const lockedForRecord: LockedBatchContext = {
        productName: r.productName || state.lockedContext.productName,
        batchLotNumber: r.batchLotNumber || r.batchId || state.lockedContext.batchLotNumber,
        manufacturingDate: r.manufacturingDate || state.lockedContext.manufacturingDate,
        expiryDate: r.expiryDate || state.lockedContext.expiryDate,
        originatingSite: r.originatingSite || state.lockedContext.originatingSite,
      };
      return {
        ...state,
        lockedContext: lockedForRecord,
        form: {
          customerName: r.customerName || '',
          complaintSource: r.complaintSource || '',
          productName: lockedForRecord.productName,
          strengthGrade: r.strengthGrade || '',
          batchLotNumber: lockedForRecord.batchLotNumber,
          manufacturingDate: lockedForRecord.manufacturingDate,
          expiryDate: lockedForRecord.expiryDate,
          affectedQuantity: r.affectedQuantity || '',
          originatingSite: lockedForRecord.originatingSite,
          impactedMaterial: r.impactedMaterial || '',
          complaintType: r.complaintType || '',
          complaintDate: r.complaintDate || '',
          defectSummary: r.defectSummary || '',
          detailedDescription: r.detailedDescription || '',
          severity: (r.severity as ComplaintForm['severity']) || '',
          priority: (r.priority as ComplaintForm['priority']) || '',
          riskAssessment: r.riskAssessment || '',
        },
        status: 'Saved',
        activeSavedDbId: r.id,
        lastSavedNumber: r.complaintNumber,
        changedFields: [],
      };
    }

    default:
      return state;
  }
}
