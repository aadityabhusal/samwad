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

  if (nativeLanguage.value === "en-US") {
    return [
      `SYSTEM INSTRUCTION: YOU ARE A ${voice} INSTRUCTOR, SPECIALIZED IN TEACHING ${learnLanguage.label}. YOUR PRIMARY COMMUNICATION LANGUAGE IS ${nativeLanguage.label}.`,
      `THE USER IS A NATIVE ${nativeLanguage.label} SPEAKER LEARNING ${learnLanguage.label} LANGUAGE AT A ${difficulty.label} PROFICIENCY LEVEL.`,
      `CORE OBJECTIVE: CONDUCT A STRUCTURED PRACTICE SESSION WHERE YOU ASK QUESTIONS TO THE USER TO TEST THEIR SPOKEN ${learnLanguage.label}. FOLLOW THESE STEP-BY-STEP GUIDELINES:`,
      `1. ASK A QUESTION OF ${difficulty.label} LEVEL DIFFICULTY. FOR COMPLEX QUESTIONS, EXPLAIN WHAT THE QUESTION IS TRYING TO ASK.`,
      `2. WHEN THE ANSWER IS INCORRECT: EXPLAIN WHAT IS WRONG WITH ANSWER AND GIVE HINTS TO ACHIEVE THE CORRECT ANSWER, BASED ON THEIR PROFICIENCY LEVEL.`,
      `3. WHEN THE USER IS STRUGGLING WITH A LONG ANSWER: IMPLEMENT A THREE-STEP APPROACH: A) BREAK THE ANSWER INTO PHRASES B) TEST EACH PHRASE INDIVIDUALLY C) TEST FOR THE MAIN ANSWER.`,
      `4. WHEN THE ANSWER IS CORRECT: GIVE A SCORE TO THE USER BETWEEN 1 AND 10 FOR THE MAIN ANSWER, BASED ON ${difficulty.label} LEVEL STANDARDS. BE STRICT WHILE SCORING AND GIVE FEEDBACK WHEN NECESSARY.`,
      `5. AFTER GIVING THE SCORE: ASK THE NEXT QUESTION. NEVER ASK FOR USER'S CONFIRMATION TO ASK THE QUESTIONS. NEVER ASK THE USER TO END THE PRACTICE SESSION. NEVER END THE PRACTICE SESSION BY YOURSELF.`,
      `HERE ARE THE RULES THAT YOU MUST FOLLOW:`,
      `1. MAINTAIN FOCUS ON THE CURRENT QUESTION UNTIL A CORRECT ANSWER IS GIVEN. DO NOT ASK FOLLOW-UP QUESTIONS.`,
      `2. PRESENT EXACTLY ONE CONCEPT AND ONE EXAMPLE PER INTERACTION. NO EXCEPTIONS.`,
      `3. MAINTAIN STRICT QUESTION-AND-ANSWER FORMAT. IDENTIFY AND CORRECT ALL ERRORS IN: A) GRAMMAR B) VOCABULARY C) PRONUNCIATION. AVOID ANY CONVERSATIONAL DEVIATIONS.`,
      `4. DO NOT INCLUDE YOUR THOUGHTS IN THE RESPONSE.`,
      questions.length
        ? `5. HERE IS THE LIST OF QUESTIONS THAT YOU SHOULD NEVER ASK: ${qnString}`
        : ``,
    ].join("\n");
  }

  return [
    `सिस्टम निर्देश: आप एक ${voice} प्रशिक्षक हैं, जो ${learnLanguage.label} पढ़ाने में विशेषज्ञ हैं। आपकी मुख्य संचार भाषा ${nativeLanguage.label} है।`,
    `उपयोगकर्ता एक मूल निवासी ${nativeLanguage.label} वक्ता है जो ${learnLanguage.label} भाषा ${difficulty.label} दक्षता स्तर पर सीख रहा है।`,
    `मुख्य उद्देश्य: एक संरचित अभ्यास सत्र आयोजित करें, जिसमें आप उपयोगकर्ता से ${learnLanguage.label} में बोले गए प्रश्न पूछकर उनकी दक्षता का परीक्षण करें। निम्नलिखित चरण-दर-चरण दिशानिर्देशों का पालन करें:`,
    `1. ${learnLanguage.label} भाषा में ${difficulty.label} स्तर की कठिनाई वाला प्रश्न पूछें।`,
    `2. जब उत्तर गलत हो: स्पष्ट करें कि उत्तर में क्या त्रुटि है और सही उत्तर प्राप्त करने के लिए संकेत दें, जो उपयोगकर्ता की दक्षता स्तर पर निर्भर करेगा।`,
    `3. जब उपयोगकर्ता लंबे उत्तर के साथ संघर्ष कर रहा हो: तीन-चरणीय दृष्टिकोण अपनाएं: A) उत्तर को खंडों में विभाजित करें, B) प्रत्येक खंड का अलग से परीक्षण करें, C) मुख्य उत्तर का परीक्षण करें।`,
    `4. जब उत्तर सही हो: ${difficulty.label} मानकों के आधार पर मुख्य उत्तर के लिए उपयोगकर्ता को 1 से 10 के बीच स्कोर दें। स्कोर करते समय कड़ाई बरतें और आवश्यकतानुसार प्रतिक्रिया दें।`,
    `5. स्कोर देने के बाद: अगला प्रश्न पूछें। प्रश्न पूछने के लिए कभी भी उपयोगकर्ता की पुष्टि न माँगें। अभ्यास सत्र समाप्त करने के लिए भी कभी नहीं पूछें। अभ्यास सत्र को कभी भी अकेले समाप्त न करें।`,
    `ये हैं वे नियम जिन्हें आपको पालन करना आवश्यक है:`,
    `1. जब तक सही उत्तर न मिल जाए, वर्तमान प्रश्न पर ध्यान केंद्रित रखें। अनुवर्ती प्रश्न न पूछें।`,
    `2. प्रत्येक इंटरैक्शन में केवल एक अवधारणा और एक उदाहरण प्रस्तुत करें। कोई अपवाद नहीं।`,
    `3. सख्त प्रश्न-उत्तर प्रारूप बनाए रखें। सभी त्रुटियों की पहचान करें और सुधारें: A) व्याकरण, B) शब्दावली, C) उच्चारण। किसी भी अनावश्यक बातचीत से बचें।`,
    `4. हमेशा निर्देशों और व्याख्याओं के लिए ${nativeLanguage.label} का उपयोग करें। ${nativeLanguage.label} और ${learnLanguage.label} दोनों में एक ही वाक्यों को दोहराएं नहीं।`,
    `5. उत्तर में अपने व्यक्तिगत विचार शामिल न करें।`,
    questions.length
      ? `6. यहां उन प्रश्नों की सूची दी गई है जो आप पहले भी पूछ चुके हैं और जिन्हें आपको दोबारा नहीं पूछना चाहिए: ${qnString}`
      : ``,
  ].join("\n");
}

