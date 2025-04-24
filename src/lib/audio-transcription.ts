import { GoogleGenAI } from "@google/genai";
import { getLanguage } from "@/lib/utils";
// import { usePracticeSessionsStore } from "./store";

export class AudioTranscription {
  private genAI: GoogleGenAI;
  private learn_language: string;
  private native_language: string;

  constructor(config: {
    api_key: string;
    native_language: string;
    learn_language: string;
  }) {
    this.native_language = getLanguage(config.native_language, "Hindi");
    this.learn_language = getLanguage(config.learn_language, "English");
    this.genAI = new GoogleGenAI({ apiKey: config.api_key });
  }

  async transcribeAudio(audioBase64: string): Promise<string | undefined> {
    try {
      // const questions = usePracticeSessionsStore.getState().getQuestions();
      // const _formattedQuestions = JSON.stringify(questions);

      const wavData = await this.pcmToWav(audioBase64);
      const result = await this.genAI.models.generateContent({
        model: "gemini-2.0-flash-lite-001",
        config: {
          systemInstruction: {
            role: "system",
            text: [
              `FROM THE GIVEN AUDIO, TRANSCRIBE THE QUESTIONS ASKED BY A TEACHER TO A STUDENT DURING A SPOKEN ${this.learn_language} LANGUAGE PRACTICE SESSION.`,
              `ONLY EXTRACT THE QUESTION THAT SEEMS MOST LIKELY TO HAVE BEEN ASKED AS A TEST QUESTION DURING A SPOKEN ${this.learn_language} LANGUAGE PRACTICE SESSION. DO NOT EXTRACT QUESTIONS ASKED IN ${this.native_language} LANGUAGE.`,
              `THE QUESTION WILL ALWAYS BE IN ${this.learn_language}. IF THERE ARE NO QUESTION IN ${this.learn_language} LANGUAGE, RETURN "NOT FOUND".`,
              // questions.length
              //   ? `HERE IS A LIST OF SOME EXAMPLE QUESTIONS THAT THE TEACHER HAD ASKED: ${formattedQuestions}`
              //   : "",
            ].join("\n"),
          },
        },
        contents: [
          { text: "HERE IS THE AUDIO:" },
          { inlineData: { mimeType: "audio/wav", data: wavData } },
        ],
      });
      if (result.text?.includes("NOT FOUND") && result.text.length < 15) {
        return undefined;
      }
      return result.text;
    } catch (error) {
      console.error("Transcription error:", error);
      return undefined;
    }
  }
  async pcmToWav(pcmData: string, sampleRate: number = 24000): Promise<string> {
    const toBase64 = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result?.toString().split(",")[1];
          if (result) resolve(result);
          else reject(new Error("Failed to convert WAV to base64"));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

    const pcmBytes = Uint8Array.from(atob(pcmData), (char) =>
      char.charCodeAt(0)
    );
    const samples = new Int16Array(pcmBytes.buffer);
    const pcmByteLength = samples.length * 2;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + pcmByteLength, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, pcmByteLength, true);

    const wavBytes = new Uint8Array(44 + pcmByteLength);
    wavBytes.set(new Uint8Array(header), 0);
    wavBytes.set(new Uint8Array(samples.buffer), 44);

    return toBase64(new Blob([wavBytes], { type: "audio/wav" }));
  }
}
