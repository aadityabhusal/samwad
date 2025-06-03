import { ISettings } from "./types";

export const LANGUAGES = [
  { value: "en-US", label: "English" },
  { value: "hi-IN", label: "Hindi" },
  { value: "cmn-CN", label: "Mandarin" },
];

export const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export const DIFFICULTY = [
  { value: "a1", label: "A1", secondaryLabel: "Beginner" },
  { value: "a2", label: "A2", secondaryLabel: "Beginner+" },
  { value: "b1", label: "B1", secondaryLabel: "Intermediate" },
  { value: "b2", label: "B2", secondaryLabel: "Intermediate+" },
  { value: "c1", label: "C1", secondaryLabel: "Advanced" },
  { value: "c2", label: "C2", secondaryLabel: "Advanced+" },
];

export const SETTINGS: ISettings = [
  {
    value: "difficulty",
    label: "Difficulty Level",
    menu: DIFFICULTY,
  },
  {
    value: "voice",
    label: "AI Voices",
    menu: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
    ],
  },
  {
    value: "native_language",
    label: "Practice Language",
    menu: LANGUAGES,
  },
  {
    value: "disable_question",
    label: "Disable Scoring",
    menu: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  /* {
    value: "learn_language",
    label: "Learn Language",
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
