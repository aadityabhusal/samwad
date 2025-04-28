import { useCallback, useRef } from "react";
import {
  GoogleGenAI,
  LiveServerContent,
  LiveServerToolCall,
  Modality,
  Session,
} from "@google/genai";
import { IUiConfig } from "../types";
import { useAiStateStore, useUiConfigStore } from "../store";
import { AudioStreamer } from "../audio/audio-streamer";
import { base64ToArrayBuffer, getSystemPrompt } from "../utils";
import { AudioRecorder } from "../audio/audio-recorder";
import VolMeterWorklet from "../audio/vol-meter-worklet";
import { score_tool } from "../gemini-live-api";
import dayjs from "dayjs";

export function useLiveApi(config: Omit<IUiConfig, "theme">) {
  const session = useRef<Session>(null);
  const setAiState = useAiStateStore((s) => s.setAiState);
  const wakeLockRef = useRef<WakeLockSentinel>(null);
  const audioStreamerRef = useRef<AudioStreamer>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const lastGreeted = useUiConfigStore((s) => s.lastGreeted);
  const setUiConfig = useUiConfigStore((s) => s.setUiConfig);

  const setupAudioStreamer = useCallback(async () => {
    if (audioStreamerRef.current) return;
    const audioContextRef = new AudioContext({ sampleRate: 24000 });
    audioStreamerRef.current = new AudioStreamer(audioContextRef);
    audioStreamerRef.current.addWorklet("vumeter-out", VolMeterWorklet, (e) => {
      setAiState({ aiVolume: e.data?.volume });
    });
    await audioContextRef.resume();
    console.log(`Audio context initialized: ${audioContextRef.state}`);
  }, [setAiState]);

  const setupAudioRecorder = useCallback(async () => {
    const recorder = new AudioRecorder();
    audioRecorderRef.current = recorder;
    await recorder
      .on("data", (data) => {
        session.current?.sendRealtimeInput({
          media: { mimeType: "audio/pcm", data },
        });
      })
      .on("volume", (userVolume) => setAiState({ userVolume }))
      .start();
    setAiState({ isRecording: true });
    console.log("Recording started");
  }, [setAiState]);

  const handleSetupComplete = useCallback(async () => {
    try {
      // First message and greetings
      const shouldGreet = lastGreeted
        ? dayjs().diff(lastGreeted, "day") >= 1
        : true;
      const message = shouldGreet ? "Greet and " : "";
      session.current?.sendClientContent({
        turns: { role: "user", text: message + "Ask the first question." },
        turnComplete: true,
      });
      setUiConfig({ lastGreeted: dayjs().startOf("day").toDate() });

      // Enable PWA features
      if ("wakeLock" in window.navigator) {
        wakeLockRef.current = await navigator.wakeLock.request();
      }
      if ("vibrate" in window.navigator) window.navigator.vibrate(50);

      await setupAudioRecorder();
      setAiState({ isLoading: false, isConnected: true, sessionStarted: true });
    } catch (e) {
      console.error(e);
    }
  }, [lastGreeted, setUiConfig, setupAudioRecorder, setAiState]);

  const handleToolCall = useCallback((toolCall: LiveServerToolCall) => {
    session.current?.sendToolResponse({
      functionResponses:
        toolCall.functionCalls?.map((fc) => ({
          response: { output: { success: true } },
          id: fc.id,
        })) || [],
    });
  }, []);

  const handleServerContent = useCallback(
    (serverContent: LiveServerContent) => {
      if (serverContent.interrupted) {
        console.log("Interrupted");
        audioStreamerRef.current?.stop();
        return;
      }

      if (serverContent.turnComplete) {
        console.log("turnComplete");
        audioStreamerRef.current?.complete();
      }

      if (serverContent.modelTurn?.parts) {
        if (serverContent.turnComplete) {
          // Send Continue signal
          session.current?.sendClientContent({
            turns: [{ role: "user", parts: [] }],
            turnComplete: false,
          });
        }

        serverContent.modelTurn?.parts.forEach((audioPart) => {
          if (!audioPart.inlineData?.mimeType?.startsWith("audio/pcm")) {
            console.log({ otherPart: audioPart });
          } else if (audioPart.inlineData.data) {
            const data = base64ToArrayBuffer(audioPart.inlineData.data);
            audioStreamerRef.current?.addPCM16(new Uint8Array(data));
            audioStreamerRef.current?.resume();
          }
        });
      }
      // @todo: accumulate audio
    },
    []
  );

  const stopSession = useCallback(() => {
    // Stop recorder and streamer
    audioRecorderRef.current?.stop();
    audioStreamerRef.current?.stop();
    audioRecorderRef.current
      ?.off("data", (data) => {
        session.current?.sendRealtimeInput({
          media: { mimeType: "audio/pcm", data },
        });
      })
      .off("volume", (userVolume) => setAiState({ userVolume }));

    // Disable PWA features
    if ("vibrate" in window.navigator) window.navigator.vibrate(50);
    wakeLockRef.current?.release().then(() => (wakeLockRef.current = null));

    session.current?.close();
    setAiState({ isConnected: false, isRecording: false, isLoading: false });
    console.log("Session ended");
  }, [setAiState]);

  const startSession = useCallback(async () => {
    setAiState({ isLoading: true });
    setupAudioStreamer();
    audioStreamerRef.current?.stop(); // Reset the previous audio streaming state.
    session.current?.close(); // Close the previous active connection

    const genAI = new GoogleGenAI({ apiKey: config.api_key });
    session.current = await genAI.live.connect({
      model: "models/gemini-2.0-flash-live-001",
      config: {
        systemInstruction: {
          role: "system",
          parts: [{ text: getSystemPrompt(config) }],
        },
        temperature: 0.75,
        tools: [score_tool],
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: config.voice === "male" ? "Charon" : "Aoede",
            },
          },
          languageCode: config.native_language,
        },
      },
      callbacks: {
        onopen: () => console.log("Connection opened"),
        onerror: (e) => console.error("Error:", e),
        onclose: (e) => {
          console.log("Connection closed:", e);
          stopSession();
        },
        async onmessage(response) {
          if (response.setupComplete) {
            console.log("Setup complete");
            await handleSetupComplete();
          } else if (response.toolCall) {
            console.log("Tool call", response.toolCall.functionCalls);
            handleToolCall(response.toolCall);
          } else if (response.toolCallCancellation) {
            console.log("Tool cancellation", response.toolCallCancellation);
          } else if (response.serverContent) {
            handleServerContent(response.serverContent);
          }
        },
      },
    });
  }, [
    config,
    setAiState,
    setupAudioStreamer,
    stopSession,
    handleSetupComplete,
    handleToolCall,
    handleServerContent,
  ]);

  return {
    startSession,
    stopSession,
    resumeRecording: async () => {
      await audioRecorderRef.current?.start();
      setAiState({ isRecording: true });
    },
    pauseRecording: () => {
      audioRecorderRef.current?.stop();
      setAiState({ isRecording: false });
    },
  };
}
