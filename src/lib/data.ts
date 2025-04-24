import { ISettings } from "./types";

export const LANGUAGES = [
  { value: "en-US", label: "English" },
  { value: "hi-IN", label: "Hindi" },
];

export const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export const SETTINGS: ISettings = [
  {
    value: "difficulty",
    label: "Difficulty Level",
    menu: [
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
    ],
  },
  {
    value: "voice",
    label: "AI Voices",
    menu: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
    ],
  },
  /* {
    value: "learn_language",
    label: "Learn Language",
    disabled: true,
    menu: LANGUAGES,
  },
  {
    value: "native_language",
    label: "Your Language",
    disabled: true,
    menu: LANGUAGES,
  },
  {
    value: "playback_rate",
    label: "Playback Speed",
    disabled: true,
    menu: [
      { value: "1.5", label: "1.5" },
      { value: "1.0", label: "1.0" },
      { value: "0.5", label: "0.5" },
    ],
  }, */
];
