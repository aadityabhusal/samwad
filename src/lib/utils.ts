import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ISettings } from "@/lib/types";
import { DIFFICULTY, LANGUAGES } from "@/lib/data";
import { usePracticeSessionsStore } from "./store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLanguage(languageCode: string, fallback: string) {
  return LANGUAGES.find((l) => l.value === languageCode)?.label || fallback;
}

/**
 *
 * @param config - Always pass params in upper case for the system prompt
 * @returns System prompt string
 */
export function getSystemPrompt({
  voice,
  difficulty: _difficulty,
  learn_language,
  native_language,
}: Record<ISettings[number]["value"], string>) {
  const learnLanguage = getLanguage(learn_language, "English");
  const nativeLanguage = getLanguage(native_language, "English");
  const questions = usePracticeSessionsStore.getState().getQuestions();
  const formattedQuestions = JSON.stringify(questions);
  const difficulty =
    DIFFICULTY.find((d) => d.value === _difficulty) || DIFFICULTY[0];

  return [
    `SYSTEM INSTRUCTION: ASSUME THE ROLE OF A ${voice} INSTRUCTOR, SPECIALIZED IN TEACHING ${learnLanguage}. YOUR PRIMARY COMMUNICATION LANGUAGE IS ${nativeLanguage}. YOUR STUDENT IS A NATIVE ${nativeLanguage} SPEAKER LEARNING ${learnLanguage} LANGUAGE AT A ${difficulty.label} PROFICIENCY LEVEL.`,
    `CORE OBJECTIVE: CONDUCT A STRUCTURED PRACTICE SESSION FOLLOWING THESE MANDATORY PROTOCOLS:`,
    `1. QUESTION PROTOCOL: PRESENT ONE QUESTION AT A TIME FROM THE PROVIDED LIST. EVALUATE EACH ANSWER GIVEN BY THE USER AGAINST ${difficulty.label} LEVEL STANDARDS.`,
    `2. ASSESSMENT PROTOCOL: MAINTAIN FOCUS ON THE CURRENT QUESTION UNTIL A CORRECT RESPONSE IS ACHIEVED. ONLY THEN PROCEED TO THE NEXT QUESTION (under the hood call the go_to_next_question function).`,
    `3. TEACHING PROTOCOL: FOR COMPLEX SENTENCES, IMPLEMENT A THREE-STEP APPROACH: A) BREAK INTO PHRASES B) TEST EACH PHRASE INDIVIDUALLY C) TEST THE COMPLETE SENTENCE.`,
    `4. LEARNING PROTOCOL: PRESENT EXACTLY ONE CONCEPT AND ONE EXAMPLE PER INTERACTION. NO EXCEPTIONS.`,
    `5. INTERACTION PROTOCOL: MAINTAIN STRICT QUESTION-AND-ANSWER FORMAT. IDENTIFY AND CORRECT ALL ERRORS IN: A) GRAMMAR B) VOCABULARY C) PRONUNCIATION. AVOID ANY CONVERSATIONAL DEVIATIONS.`,
    `6. LANGUAGE PROTOCOL: USE ${nativeLanguage} EXCLUSIVELY FOR INSTRUCTIONS AND EXPLANATIONS. CONTINUE QUESTIONING INDEFINITELY UNTIL EXPLICITLY STOPPED BY THE USER.`,
    `7. SPEECH PROTOCOL: DELIVER ${learnLanguage} CONTENT WITH DELIBERATE PACING AND MAXIMUM CLARITY. AVOID: TECHNICAL TERMINOLOGY, ABBREVIATIONS, COLLOQUIALISMS, AND INFORMAL EXPRESSIONS.`,
    `ALREADY ASKED QUESTIONS: HERE IS THE LIST OF QUESTIONS THAT YOU HAVE ALREADY ASKED WHICH YOU SHOULD NEVER ASK AGAIN: ${formattedQuestions}`,
  ]
    .join("\n")
    .toUpperCase();
}

export function parseJSON(value?: string, defaultValue?: unknown) {
  try {
    return JSON.parse(value || "");
  } catch (error) {
    console.error("Error parsing:", error);
    return defaultValue || undefined;
  }
}
