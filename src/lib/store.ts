import { create } from "zustand";
import { persist } from "zustand/middleware";
import { IUiConfig } from "@/lib/types";

type SetUIConfig = Partial<Omit<IUiConfig, "setUiConfig">>;
type IUiConfigStore = IUiConfig & {
  setUiConfig: (
    change: SetUIConfig | ((change: SetUIConfig) => SetUIConfig)
  ) => void;
};

export const useUiConfigStore = create(
  persist<IUiConfigStore>(
    (set) => ({
      difficulty: "beginner",
      playback_rate: "1.0",
      voice: "male",
      native_language: "hi-IN",
      learn_language: "en-US",
      api_key: "",
      theme: "system",
      setUiConfig: (change) =>
        set((state) => (typeof change === "function" ? change(state) : change)),
    }),
    { name: "uiConfig" }
  )
);

type SetAiState = Partial<Omit<IAiStateStore, "setAiState">>;
type IAiStateStore = {
  isConnected?: boolean;
  volume: number;
  setAiState: (
    change: SetAiState | ((change: SetAiState) => SetAiState)
  ) => void;
};

export const useAiStateStore = create<IAiStateStore>((set) => ({
  volume: 0,
  setAiState: (change) =>
    set((state) => (typeof change === "function" ? change(state) : change)),
}));
