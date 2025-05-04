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
  isConnected?: boolean;
  isTurnComplete?: boolean;
  aiVolume: number;
  userVolume: number;
  transcription?: string;
  currentSession?: string;
  currentQuestion?: string;
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
  // Session
  sessions: IPracticeSession[];
  addSession: (title: string, setCurrentSession?: boolean) => void;
  deleteSession: (id: string) => void;
  // Question
  getQuestions: (type?: "pending" | "answered") => IQuestion[];
  addQuestions: (questions: IQuestion[], setCurrentQuestion?: boolean) => void;
  deleteQuestion: (id: string) => void;
  deleteAllQuestions: () => void;
  addScore: (score: number) => void;
};
export const usePracticeSessionsStore = create(
  persist<IPracticeSessionsStore>(
    (set, get) => ({
      sessions: [],
      addSession: (title: string, setCurrent) =>
        set((state) => {
          const id = uuid();
          if (setCurrent) useAiStateStore.setState({ currentSession: id });
          return {
            sessions: state.sessions.concat({
              id,
              createdAt: new Date(),
              language: useUiConfigStore.getState().learn_language,
              questions: [],
              title,
            }),
          };
        }),
      deleteSession: (id: string) =>
        set((state) => {
          if (id === useAiStateStore.getState().currentSession)
            useAiStateStore.setState({ currentSession: undefined });
          return {
            sessions: state.sessions.filter((session) => session.id !== id),
          };
        }),
      getQuestions: (type?: "pending" | "answered") => {
        const { sessions } = get();
        const questions = sessions.find(
          (s) => s.id === useAiStateStore.getState().currentSession
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
        set((state) => {
          if (setCurrent)
            useAiStateStore.setState({ currentQuestion: qns[0].id });
          return {
            sessions: state.sessions.map((session) => {
              if (session.id === useAiStateStore.getState().currentSession) {
                return { ...session, questions: session.questions.concat(qns) };
              }
              return session;
            }),
          };
        }),
      addScore: (score: number) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            const aiState = useAiStateStore.getState();
            if (session.id === aiState.currentSession) {
              return {
                ...session,
                questions: session.questions
                  .map((question) => {
                    if (question.id === aiState.currentQuestion) {
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
            if (session.id === useAiStateStore.getState().currentSession) {
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
            if (session.id === useAiStateStore.getState().currentSession) {
              return { ...session, questions: [] };
            }
            return session;
          }),
        })),
    }),
    { name: "practice_sessions" }
  )
);
