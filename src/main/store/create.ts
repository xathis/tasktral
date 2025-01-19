import { createStore } from 'zustand/vanilla';
import { createDispatch } from 'zutron/main';
import { runAgent } from './runAgent';
import { AppState } from './types';

export const store = createStore<AppState>((set, get) => ({
  instructions: `- Hacker News (2H)
- Meetings (Standup , Retro) 1h
- Try mistral API in python CLI (2h)
- Ticket #26  typescript refactoring of postprocessor (4h)
- Other (1h)`,
  fullyAuto: true, // renamed and changed default to true
  running: false,
  error: null,
  runHistory: [],
  tasks: [],
  RUN_AGENT: async () => runAgent(set, get),
  STOP_RUN: () => set({ running: false }),
  SET_INSTRUCTIONS: (instructions) => set({ instructions }),
  SET_TASKS: (tasks) => set({ tasks }),
  SET_FULLY_AUTO: (fullyAuto) => {
    // renamed from SET_HUMAN_SUPERVISED
    set({ fullyAuto: fullyAuto ?? true }); // changed default to true
  },
  CLEAR_HISTORY: () => set({ runHistory: [] }),
}));

export const dispatch = createDispatch(store);
