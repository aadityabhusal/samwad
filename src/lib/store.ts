import { create } from "zustand";
import { persist } from "zustand/middleware";
import { IPracticeSession, IQuestion, IUiConfig } from "@/lib/types";
import { v4 as uuid } from "uuid";

type SetUIConfig = Partial<Omit<IUiConfig, "setUiConfig">>;
type IUiConfigStore = IUiConfig & {
  setUiConfig: (
    change: SetUIConfig | ((change: SetUIConfig) => SetUIConfig)
  ) => void;
};

export const useUiConfigStore = create(
  persist<IUiConfigStore>(
    (set) => ({
      difficulty: "a1",
      playback_rate: "1.0",
      voice: "male",
      native_language: "hi-IN",
      learn_language: "en-US",
      api_key: "",
      setUiConfig: (change) =>
        set((state) => (typeof change === "function" ? change(state) : change)),
    }),
    { name: "uiConfig" }
  )
);

type SetAiState = Partial<Omit<IAiStateStore, "setAiState">>;
type IAiStateStore = {
  isRecording?: boolean;
  isLoading?: boolean;
  sessionStarted?: boolean;
  isConnected?: boolean;
  aiVolume: number;
  userVolume: number;
  setAiState: (
    change: SetAiState | ((change: SetAiState) => SetAiState)
  ) => void;
};

export const useAiStateStore = create<IAiStateStore>((set) => ({
  aiVolume: 0,
  userVolume: 0,
  setAiState: (change) =>
    set((state) => (typeof change === "function" ? change(state) : change)),
}));

type IPracticeSessionsStore = {
  sessions: IPracticeSession[];
  currentSessionId?: string;
  addSession: (title: string, setCurrentSession?: boolean) => void;
  getQuestions: () => string[];
  addQuestion: (question: Pick<IQuestion, "text">) => void;
  deleteQuestion: (id: string) => void;
  deleteAllQuestions: () => void;
};
export const usePracticeSessionsStore = create(
  persist<IPracticeSessionsStore>(
    (set, get) => ({
      sessions: [],
      addSession: (title: string, setCurrent) =>
        set((state) => {
          const id = uuid();
          return {
            ...(setCurrent ? { currentSessionId: id } : {}),
            sessions: state.sessions.concat({
              id,
              createdAt: new Date(),
              language: useUiConfigStore.getState().learn_language,
              questions: [],
              title,
            }),
          };
        }),
      getQuestions: () => {
        const { sessions, currentSessionId } = get();
        const questions = sessions.find(
          (s) => s.id === currentSessionId
        )?.questions;
        return questions?.map((q) => q.text) || [];
      },
      addQuestion: (question) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id === state.currentSessionId) {
              return {
                ...session,
                questions: session.questions.concat({
                  ...question,
                  difficulty: useUiConfigStore.getState().difficulty,
                  id: uuid(),
                  timestamp: new Date(),
                  status: "pending",
                }),
              };
            }
            return session;
          }),
        })),
      deleteQuestion: (id) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id === state.currentSessionId) {
              return {
                ...session,
                questions: session.questions?.filter((q) => q.id !== id),
              };
            }
            return session;
          }),
        })),
      deleteAllQuestions: () =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id === state.currentSessionId) {
              return { ...session, questions: [] };
            }
            return session;
          }),
        })),
    }),
    { name: "practice_sessions" }
  )
);
