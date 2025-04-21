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
  theme: "light" | "dark" | "system";
};

export type ISettings = {
  value: keyof Omit<IUiConfig, "api_key" | "theme">;
  label: string;
  menu: { value: string; label: string }[];
  disabled?: boolean;
}[];
