import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LANGUAGES } from "@/lib/data";
import { toast } from "sonner";
import { GoogleGenAI, Type } from "@google/genai";
import { IQuestion } from "@/lib/types";
import { v4 as uuid } from "uuid";

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
