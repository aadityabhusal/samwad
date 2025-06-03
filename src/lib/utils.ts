import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DIFFICULTY, LANGUAGES } from "@/lib/data";
import { toast } from "sonner";
import { GoogleGenAI, Type } from "@google/genai";
import { IQuestion, IUiConfig } from "@/lib/types";
import { v4 as uuid } from "uuid";
import { usePracticeSessionsStore } from "@/lib/store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLanguage(
  languageCode: string,
  fallback: (typeof LANGUAGES)[number] = { label: "English", value: "en-US" }
) {
  return LANGUAGES.find((l) => l.value === languageCode) || fallback;
}

export function parseJSON(value?: string, defaultValue?: unknown) {
  try {
    return JSON.parse(value || "");
  } catch (error) {
    console.error("Error parsing:", error);
    return defaultValue || undefined;
  }
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function logError(...message: unknown[]) {
  console.error(...message);
  toast.error("An error has occured. Please try again later.", {
    position: "top-center",
  });
}

export async function getNewQuestions({
  genAI,
  difficulty,
  questions,
  learnLanguage,
}: {
  genAI: GoogleGenAI;
  difficulty: string;
  questions: string[];
  learnLanguage: string;
}): Promise<IQuestion[]> {
  const askedQuestions = JSON.stringify(questions);
  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash-preview-04-17",
    contents: [
      {
        text: [
          `GENERATE 5 QUESTIONS OF ${difficulty.toUpperCase()} PROFICIENCY LEVEL THAT WILL BE ASKED IN A SPOKEN ${learnLanguage.toUpperCase()} PRACTICE SESSION.`,
          askedQuestions.length
            ? `HERE ARE THE QUESTIONS THAT HAVE ALREADY BEEN ASKED: ${askedQuestions}. DO NOT REPEAT THESE QUESTIONS.`
            : "",
        ].join("\n"),
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        description: "List of question to be asked",
        items: {
          type: Type.STRING,
          description: "Question to be asked",
          nullable: false,
        },
      },
    },
  });
  const newQuestions: string[] = parseJSON(result.text, []);
  return newQuestions.map((text) => ({ text, difficulty, id: uuid() }));
}

export function getSystemPrompt(config: IUiConfig): string | undefined {
  const voice = config.voice;
  const learnLanguage = getLanguage(config.learn_language);
  const nativeLanguage = getLanguage(config.native_language);
  const difficulty =
    DIFFICULTY.find((d) => d.value === config.difficulty) || DIFFICULTY[0];
  const questions = usePracticeSessionsStore.getState().getQuestions();
  const qnString = JSON.stringify(questions.map((q) => q.text));

  return [
    `System instruction: You are a ${voice} instructor, specialized in teaching ${learnLanguage.label}. Your primary communication language is ${nativeLanguage.label}.`,
    `The user is a native ${nativeLanguage.label} speaker learning ${learnLanguage.label} language at a ${difficulty.label} proficiency level.`,
    `Core objective: Conduct a structured practice session where you ask questions to the user to test their spoken ${learnLanguage.label}. Follow these step-by-step guidelines:`,
    `1. Ask a question of ${difficulty.label} level difficulty. For complex questions, explain what the question is trying to ask. Always use ${nativeLanguage.label} for instructions and explanations.`,
    `2. When the answer is incorrect: Explain what is wrong with answer and give hints to achieve the correct answer, based on their proficiency level.`,
    `3. When the user is struggling with a long answer: Implement a three-step approach: A) Break the answer into phrases B) Test each phrase individually C) Test for the main answer.`,
    `4. When the answer is correct: Give a score to the user between 1 and 10 for the main answer, based on ${difficulty.label} level standards. Be strict while scoring and give feedback when necessary.`,
    `5. After giving the score: Ask the next question. Never ask for user's confirmation to ask the questions. Never ask the user to end the practice session. Never end the practice session by yourself.`,
    `Here are the rules that you must follow:`,
    `1. Maintain focus on the current question until a correct answer is given. Do not ask follow-up questions.`,
    `2. Present exactly one concept and one example per interaction. No exceptions.`,
    `3. Maintain strict question-and-answer format. Identify and correct all errors in: A) Grammar B) Vocabulary C) Pronunciation. Avoid any conversational deviations.`,
    `4. Do not include your thoughts in the response.`,
    questions.length
      ? `5. Here is the list of questions that you should never ask: ${qnString}`
      : ``,
  ].join("\n");
}
