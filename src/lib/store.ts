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
  isTurnComplete?: boolean;
  aiVolume: number;
  userVolume: number;
  transcription?: string;
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
  currentQuestionId?: string;
  addSession: (title: string, setCurrentSession?: boolean) => void;
  getQuestions: (type?: "pending" | "answered") => IQuestion[];
  addQuestions: (questions: IQuestion[], setCurrentQuestion?: boolean) => void;
  addScore: (score: number) => void;
  deleteQuestion: (id: string) => void;
  deleteAllQuestions: () => void;
  setCurrentQuestion: (questionId: string) => void;
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
      getQuestions: (type?: "pending" | "answered") => {
        const { sessions, currentSessionId } = get();
        const questions = sessions.find(
          (s) => s.id === currentSessionId
        )?.questions;
        return (
          questions?.filter((question) => {
            if (type === "pending") return !question.score;
            if (type === "answered") return question.score;
            return true;
          }) || []
        );
      },
      addQuestions: (qns, setCurrent) =>
        set((state) => ({
          ...(setCurrent ? { currentQuestionId: qns[0].id } : {}),
          sessions: state.sessions.map((session) => {
            if (session.id === state.currentSessionId) {
              return { ...session, questions: session.questions.concat(qns) };
            }
            return session;
          }),
        })),
      setCurrentQuestion: (currentQuestionId) =>
        set(() => ({ currentQuestionId })),
      addScore: (score: number) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id === state.currentSessionId) {
              return {
                ...session,
                questions: session.questions
                  .map((question) => {
                    if (question.id === state.currentQuestionId) {
                      return { ...question, score };
                    }
                    return question;
                  })
                  .filter((q) => q.score),
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
