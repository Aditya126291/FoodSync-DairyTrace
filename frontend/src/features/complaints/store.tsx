import React, { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  complaintReducer,
  initialComplaintState,
  type ComplaintAction,
  type ComplaintState,
} from './complaintSlice';
import {
  copilotReducer,
  initialCopilotState,
  type CopilotAction,
  type CopilotState,
} from './copilotSlice';

export interface RootState {
  complaint: ComplaintState;
  copilot: CopilotState;
}

export type AppAction = ComplaintAction | CopilotAction;

const initialRootState: RootState = {
  complaint: initialComplaintState,
  copilot: initialCopilotState,
};

function rootReducer(state: RootState, action: AppAction): RootState {
  return {
    complaint: complaintReducer(state.complaint, action as ComplaintAction),
    copilot: copilotReducer(state.copilot, action as CopilotAction),
  };
}

const StateContext = createContext<RootState>(initialRootState);
const DispatchContext = createContext<Dispatch<AppAction>>(() => undefined);

export function ComplaintStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(rootReducer, initialRootState);
  return (
    <DispatchContext.Provider value={dispatch}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  );
}

export function useAppDispatch(): Dispatch<AppAction> {
  return useContext(DispatchContext);
}

export function useAppSelector<T>(selector: (state: RootState) => T): T {
  const state = useContext(StateContext);
  return selector(state);
}
