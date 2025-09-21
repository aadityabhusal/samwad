export type Settings = {
  value: string;
  label: string;
  menu?: Settings[];
};

export type IUiConfig = {
  difficulty: string;
  playback_rate: string;
  voice: string;
  native_language: string;
  learn_language: string;
  api_key: string;
  theme?: "light" | "dark";
  hideTranscription?: boolean;
  disable_question?: "yes" | "no";
  open_session_list?: boolean;
  open_settings?: boolean;
};

export type ISettings = {
  value: keyof Pick<
    IUiConfig,
    | "difficulty"
    | "playback_rate"
    | "voice"
    | "native_language"
    | "learn_language"
    | "disable_question"
  >;
  label: string;
  menu: { value: string; label: string; secondaryLabel?: string }[];
  disabled?: boolean;
}[];

/* Types for AI Conversation */
export interface IQuestion {
  id: string;
  text: string;
  difficulty: IUiConfig["difficulty"];
  score?: number;
  // status: "pending" | "answered";
  // timestamp: Date; // should be created_at and updated_at
  // priority?: number;
  // category?: string;
}

export interface IPracticeSession {
  id: string;
  questions: IQuestion[];
  title?: string;
  createdAt: Date;
  updatedAt?: Date;
  language: string;
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}
