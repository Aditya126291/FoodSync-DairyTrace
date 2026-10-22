import type { ComplaintForm } from './types';

export interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

export interface CopilotState {
  messages: ChatMessage[];
  processing: boolean;
  missingFields: string[];
  risk: string | null;
  rootCause: string | null;
  capaRecommendations: string[];
  engine: string;
}

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Ready to process a dairy complaint or lab report for this scanned batch. Paste the report or drop a document (.pdf, .docx, .txt, .eml) below.',
};

export const initialCopilotState: CopilotState = {
  processing: false,
  missingFields: [],
  risk: null,
  rootCause: null,
  capaRecommendations: [],
  engine: 'rule-based',
  messages: [INITIAL_WELCOME],
};

export type CopilotAction =
  | { type: 'copilot/addMessage'; payload: ChatMessage }
  | { type: 'copilot/setProcessing'; payload: boolean }
  | {
      type: 'copilot/setAiResult';
      payload: {
        missingFields: string[];
        risk: string | null;
        rootCause?: string | null;
        capaRecommendations?: string[];
        patch?: Partial<ComplaintForm>;
        engine?: string;
      };
    }
  | { type: 'copilot/setEngine'; payload: string }
  | { type: 'copilot/clearCopilotState' }
  | { type: 'copilot/resetChat' };

export const addMessage = (payload: ChatMessage): CopilotAction => ({
  type: 'copilot/addMessage',
  payload,
});

export const setProcessing = (payload: boolean): CopilotAction => ({
  type: 'copilot/setProcessing',
  payload,
});

export const setAiResult = (payload: {
  missingFields: string[];
  risk: string | null;
  rootCause?: string | null;
  capaRecommendations?: string[];
  patch?: Partial<ComplaintForm>;
  engine?: string;
}): CopilotAction => ({
  type: 'copilot/setAiResult',
  payload,
});

export const setEngine = (payload: string): CopilotAction => ({
  type: 'copilot/setEngine',
  payload,
});

export const clearCopilotState = (): CopilotAction => ({
  type: 'copilot/clearCopilotState',
});

export const resetChat = (): CopilotAction => ({
  type: 'copilot/resetChat',
});

export function copilotReducer(
  state: CopilotState = initialCopilotState,
  action: CopilotAction
): CopilotState {
  switch (action.type) {
    case 'copilot/addMessage':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'copilot/setProcessing':
      return {
        ...state,
        processing: action.payload,
      };

    case 'copilot/setAiResult':
      return {
        ...state,
        missingFields: action.payload.missingFields || [],
        risk: action.payload.risk || null,
        rootCause: action.payload.rootCause || null,
        capaRecommendations: action.payload.capaRecommendations || [],
        engine: action.payload.engine || state.engine,
      };

    case 'copilot/setEngine':
      return {
        ...state,
        engine: action.payload,
      };

    case 'copilot/clearCopilotState':
      return {
        ...state,
        missingFields: [],
        risk: null,
        rootCause: null,
        capaRecommendations: [],
      };

    case 'copilot/resetChat':
      return {
        ...state,
        messages: [
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'Fresh chat started. Form and copilot context have been reset while preserving the scanned batch binding.',
          },
        ],
        missingFields: [],
        risk: null,
        rootCause: null,
        capaRecommendations: [],
        processing: false,
      };

    default:
      return state;
  }
}
