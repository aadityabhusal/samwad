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
};

export type ISettings = {
  value: keyof Omit<IUiConfig, "api_key" | "theme">;
  label: string;
  menu: { value: string; label: string }[];
  disabled?: boolean;
}[];

/* Types for AI Conversation */
export interface IQuestion {
  id: string;
  status: "pending" | "answered" | "incorrect";
  text: string;
  timestamp: Date;
  difficulty: IUiConfig["difficulty"];
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
