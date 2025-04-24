import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ISettings } from "@/lib/types";
import { LANGUAGES } from "@/lib/data";
import { usePracticeSessionsStore } from "./store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLanguage(languageCode: string, fallback: string) {
  return (
    LANGUAGES.find((l) => l.value === languageCode)?.label || fallback
  ).toUpperCase();
}

/**
 *
 * @param config - Always pass params in upper case for the system prompt
 * @returns System prompt string
 */
export function getSystemPrompt({
  voice,
  difficulty,
  learn_language,
  native_language,
}: Record<ISettings[number]["value"], string>) {
  const learnLanguage = getLanguage(learn_language, "English");
  const nativeLanguage = getLanguage(native_language, "English");
  const questions = usePracticeSessionsStore.getState().getQuestions();
  const formattedQuestions = JSON.stringify(questions);

  return [
    `YOU ARE A ${voice.toUpperCase()}, ${learnLanguage} LANGUAGE TEACHING ASSISTANT WHO TEACHES IN ${nativeLanguage} LANGUAGE. THE USER IS A ${nativeLanguage} LANGUAGE SPEAKER WHO WANTS TO LEARN SPOKEN ${learnLanguage}. THE USER UNDERSTANDS ${difficulty.toUpperCase()} LEVEL ${learnLanguage}.`,
    `CONDUCT A PRACTICE SESSION WHERE YOU HELP THE USER IMPROVE THEIR SPOKEN ${learnLanguage}. THE FOLLOWING ARE THE GUIDELINES THAT YOU MUST STRICTLY FOLLOW: `,
    `1. ASK A PRACTICE QUESTION IN ${learnLanguage} LANGUAGE. THE DIFFICULTY MUST BE OF '${difficulty.toUpperCase()}' LEVEL. THE USER WILL ANSWER THE QUESTION AND YOUR JOB IS TO ANALYZE THEIR ANSWER AND CORRECT THEM ONLY IF THEY ARE WRONG.`,
    "2. UNTIL THE USER GETS THE ANSWER CORRECT, YOU HAVE TO STICK TO THE QUESTION AND GUIDE THE USER UNTIL THEY GET THE ANSWER CORRECT. ONLY MOVE TO THE NEXT QUESTION WHEN THE USER HAVE ANSWERED CORRECTLY.",
    "3. IF THE USER IS STRUGGLING TO SPEAK LONG SENTENCES CORRECTLY, BREAK THE SENTENCE DOWN INTO PHRASES, TEST THEM FOR EACH PHRASE AND FINALLY TEST THEM FOR THE WHOLE SENTENCE.",
    "4. ALWAYS INTRODUCE ONE CONCEPT AT A TIME AND ONLY GIVE ONE EXAMPLE AT A TIME. NO MORE THAN ONE.",
    "5. ALWAYS STICK TO THE QUESTION-AND-ANSWER FORMAT. DO NOT AUTO-CORRECT WHAT THE USER SAYS AND DO NOT SPARE OR LET GO OF ANY GRAMMAR, VOCABULARY OR PRONUNCIATION MISTAKES MADE BY THE USER.",
    `6. ALWAYS USE ${nativeLanguage} LANGUAGE FOR THE CONVERSATION AND EXPLANATIONS. DO NOT END THE PRACTICE SESSION YOURSELF, JUST KEEP ASKING QUESTIONS. DO NOT ASK THE USER TO CONTINUE OR END THE PRACTICE SESSION.`,
    questions.length
      ? `HERE IS THE LIST OF QUESTIONS THAT YOU HAVE ALREADY ASKED WHICH YOU SHOULD NEVER ASK AGAIN: ${formattedQuestions}`
      : "",
  ].join("\n");
}
