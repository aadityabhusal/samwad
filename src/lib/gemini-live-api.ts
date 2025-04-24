import { getSystemPrompt } from "@/lib/utils";
import { LiveConnectConfig, LiveServerMessage } from "@google/genai";
import { ISettings, IUiConfig } from "./types";
import { AudioTranscription } from "@/lib/audio-transcription";

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
          this.onSetupComplete();
          this.sendMessage({
            client_content: {
              turns: [
                { role: "user", parts: [{ text: "Start with a greeting." }] },
              ],
              turn_complete: true,
            },
          });
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

  private sendContinueSignal(): void {
    const message = {
      client_content: {
        turns: [{ role: "user", parts: [] }],
        turn_complete: false,
      },
    };
    this.sendMessage(message);
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
