import { getLanguage, getSystemPrompt, parseJSON } from "@/lib/utils";
import {
  FunctionResponse,
  GoogleGenAI,
  LiveClientMessage,
  LiveConnectConfig,
  LiveServerMessage,
  Type,
} from "@google/genai";
import { ISettings, IUiConfig } from "../lib/types";
import { AudioTranscription } from "@/lib/audio-transcription";
import { usePracticeSessionsStore, useUiConfigStore } from "../lib/store";
import dayjs from "dayjs";
import { DIFFICULTY } from "../lib/data";

export type GeminiLiveHandlers = {
  onSetupComplete: () => void;
  onAudioData: (audioData: string) => void;
  onTranscription: (text?: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onError: (message: string) => void;
  onClose: (event: CloseEvent) => void;
  onRetry: () => void;
};

export const next_question = {
  functionDeclarations: [
    {
      name: "next_questions",
      description: "Move to the next question.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          next_question: {
            type: Type.BOOLEAN,
            description: "Move to the next question",
          },
        },
        required: ["next_question"],
      },
    },
  ],
};

export const score_tool = {
  functionDeclarations: [
    {
      name: "give_score",
      description:
        "Give score/points to the answer (उत्तर को अंक/स्कोर/पॉइंट दें)",
      parameters: {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.NUMBER,
            description:
              "The score/point given to the answer (उत्तर को दिया गया अंक/स्कोर/पॉइंट)",
          },
        },
        required: ["score"],
      },
    },
  ],
};

export const question_tool = {
  functionDeclarations: [
    {
      name: "get_question",
      description: "Get the question asked in English language",
      parameters: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: "The question asked in English language",
          },
        },
        required: ["question"],
      },
    },
  ],
};

export class GeminiLiveAPI {
  private onSetupComplete: GeminiLiveHandlers["onSetupComplete"];
  private onAudioData: GeminiLiveHandlers["onAudioData"];
  private onTranscription: GeminiLiveHandlers["onTranscription"];
  private onInterrupted: GeminiLiveHandlers["onInterrupted"];
  private onTurnComplete: GeminiLiveHandlers["onTurnComplete"];
  private onError: GeminiLiveHandlers["onError"];
  private onClose: GeminiLiveHandlers["onClose"];
  private onRetry: GeminiLiveHandlers["onRetry"];

  private audioTranscription: AudioTranscription;
  private accumulatedAudio: string[] = [];
  private ws: WebSocket | null;
  private setupConfig: LiveConnectConfig;
  private endpoint: string;
  private genAI: GoogleGenAI;

  public isConnected: boolean;

  constructor(config: Omit<IUiConfig, "theme">, handlers: GeminiLiveHandlers) {
    this.endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${config.api_key}`;
    this.isConnected = false;
    this.setupConfig = this.getDefaultConfig(config);
    this.audioTranscription = new AudioTranscription(config);

    this.onSetupComplete = handlers.onSetupComplete || (() => {});
    this.onAudioData = handlers.onAudioData || (() => {});
    this.onTranscription = handlers.onTranscription || (() => {});
    this.onInterrupted = handlers.onInterrupted || (() => {});
    this.onTurnComplete = handlers.onTurnComplete || (() => {});
    this.onError = handlers.onError || (() => {});
    this.onClose = handlers.onClose || (() => {});
    this.onRetry = handlers.onRetry || (() => {});
    this.genAI = new GoogleGenAI({ apiKey: config.api_key });
    this.ws = new WebSocket(this.endpoint);
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log("WebSocket connection established");
      this.sendMessage({ setup: this.setupConfig });
    };

    this.ws.onmessage = async (event: MessageEvent) => {
      try {
        let response: LiveServerMessage;
        if (event.data instanceof Blob) {
          const responseText = await event.data.text();
          response = JSON.parse(responseText);
        } else {
          response = JSON.parse(event.data);
        }

        if (response.setupComplete) {
          const questions = await this.getQuestions();
          console.log(questions);

          const lastGreeted = useUiConfigStore.getState().lastGreeted;
          const shouldGreet = lastGreeted
            ? dayjs().diff(lastGreeted, "day") >= 1
            : true;
          const message = shouldGreet ? "Greet the user and " : "";
          this.sendMessage({
            client_content: {
              turns: [
                {
                  role: "model",
                  parts: [
                    {
                      text: `QUESTION SEQUENCE: HERE IS THE LIST OF QUESTIONS THAT I WILL ASK YOU IN ORDER: ${JSON.stringify(
                        questions
                      )}`,
                    },
                  ],
                },
                {
                  role: "user",
                  parts: [{ text: message + "Start with the first question." }],
                },
              ],
              turn_complete: true,
            },
          });
          useUiConfigStore.getState().setUiConfig({
            lastGreeted: dayjs().startOf("day").toDate(),
          });
          this.onSetupComplete();
        } else if (response.toolCall) {
          console.log({ call: response.toolCall.functionCalls });
          const val = response.toolCall.functionCalls?.[0];
          this.sendContinueSignal({
            id: val?.id,
            name: val?.name,
            response: val?.args,
          });
        } else if (response.toolCallCancellation) {
          console.log({ cancled: response.toolCallCancellation });
        } else if (response.serverContent) {
          if (response.serverContent.interrupted) {
            this.onInterrupted();
            this.accumulatedAudio = [];
            return;
          }

          if (response.serverContent.modelTurn?.parts?.[0]?.inlineData?.data) {
            const audioData =
              response.serverContent.modelTurn.parts[0].inlineData.data;
            this.onAudioData(audioData);
            this.accumulatedAudio.push(audioData);

            if (!response.serverContent.turnComplete) {
              this.sendContinueSignal();
            }
          }

          if (response.serverContent.turnComplete) {
            this.onTurnComplete();
            this.audioTranscription
              .transcribeAudio(this.accumulatedAudio.join(""))
              .then(this.onTranscription);
            this.accumulatedAudio = [];
          }
        }
      } catch (error) {
        console.error("Error parsing response:", error);
        this.onError("Error parsing response: " + (error as Error).message);
      }
    };

    this.ws.onerror = (error: unknown) => {
      console.error("WebSocket Error:", error);
      this.onError(
        "WebSocket Error: " + (error as Error).message || "Unknown error"
      );
    };

    this.ws.onclose = (event: CloseEvent) => {
      console.log("WebSocket connection closed:", event);
      this.isConnected = false;
      if (event?.reason === "Internal error encountered.") {
        this.onRetry();
        console.log("Reconnecting websocket...");
        setTimeout(() => {
          this.ws = new WebSocket(this.endpoint);
          this.setupWebSocket();
        }, 1000);
      } else {
        this.onClose(event);
      }
    };
  }

  private sendMessage(message: unknown): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // console.error("WebSocket is not open. Current state:", this.ws.readyState);
      this.onError("WebSocket is not ready. Please try again.");
    }
  }

  private getDefaultConfig(config: Record<ISettings[number]["value"], string>) {
    return {
      model: "models/gemini-2.0-flash-live-001",
      systemInstruction: {
        role: "system",
        parts: [{ text: getSystemPrompt(config) }],
      },
      tools: [score_tool],
      generationConfig: {
        temperature: 0.75,
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: config.voice === "male" ? "Charon" : "Aoede",
            },
          },
          languageCode: config.native_language,
        },
      },
    } as LiveConnectConfig;
  }

  public sendAudioChunk(base64Audio: string): void {
    const message = {
      realtime_input: {
        media_chunks: [{ mime_type: "audio/pcm", data: base64Audio }],
      },
    };
    this.sendMessage(message);
  }

  private sendContinueSignal(tool?: FunctionResponse): void {
    const message: LiveClientMessage = {
      ...(tool
        ? { toolResponse: { functionResponses: [tool] } }
        : {
            clientContent: {
              turns: [{ role: "user", parts: [] }],
              turnComplete: false,
            },
          }),
    };
    this.sendMessage(message);
  }

  private async getQuestions() {
    const config = useUiConfigStore.getState();
    const difficulty =
      DIFFICULTY.find((d) => d.value === config.difficulty) || DIFFICULTY[0];

    const prevQuestions = usePracticeSessionsStore.getState().getQuestions();
    const _formattedQuestions = JSON.stringify(prevQuestions);

    const result = await this.genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: [
        {
          text: [
            `Generate 10 questions of ${difficulty.label} level to be asked in a spoken English practice session`,
            `The questions should be in ${getLanguage(
              config.learn_language,
              "English"
            )} language`,
            `Here are the questions that have already been asked: ${_formattedQuestions}. Do not repeat any of them.`,
          ]
            .join("\n")
            .toUpperCase(),
        },
      ],
      config: {
        thinkingConfig: { thinkingBudget: 1024 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "Question to be asked",
            nullable: false,
          },
        },
      },
    });
    const questions: string[] = parseJSON(result.text, []);
    return questions;
    // return questions.map((question) => ({ question, difficulty }));
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
