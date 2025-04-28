import { useState, useRef, useCallback } from "react";
import { AudioRecorder } from "@/lib/audio/audio-recorder";
import { GeminiLiveAPI } from "@/lib/gemini-live-api";
import { AudioStreamer } from "@/lib/audio/audio-streamer";
import { useAiStateStore, usePracticeSessionsStore } from "../store";
import VolMeterWorket from "../audio/vol-meter-worklet";
import { IUiConfig } from "../types";

function useAiAssistant(props: Omit<IUiConfig, "theme">) {
  // Refs for holding objects that live during the hook's lifetime.
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const providerRef = useRef<GeminiLiveAPI | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const setAiState = useAiStateStore((s) => s.setAiState);
  const addQuestion = usePracticeSessionsStore((s) => s.addQuestion);

  // Logger callback - can be passed in to update UI logs.
  const log = useCallback((...message: unknown[]) => {
    if (import.meta.env.PROD) return;
    console.log(...message);
  }, []);

  const handleSetupComplete = useCallback(async () => {
    try {
      setIsLoading(false);
      setAiState({ isConnected: true, sessionStarted: true });
      if ("vibrate" in window.navigator) window.navigator.vibrate(50);
      if ("wakeLock" in window.navigator) {
        wakeLockRef.current = await navigator.wakeLock.request();
      }
    } catch (e) {
      console.error(e);
    }
  }, [setAiState]);

  // Ensure that the audio context and streamer are initialized.
  const ensureAudioInitialized = useCallback(async (): Promise<void> => {
    if (!audioStreamerRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        ("webkitAudioContext" in window && window.webkitAudioContext);
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      audioStreamerRef.current = new AudioStreamer(audioContextRef.current);
      audioStreamerRef.current.addWorklet(
        "vumeter-out",
        VolMeterWorket,
        (e: any) => {
          setAiState({ aiVolume: e.data.volume });
        }
      );
      await audioContextRef.current.resume();
      log(`Audio context initialized: ${audioContextRef.current.state}`);
    }
  }, [setAiState, log]);

  // Decode base64 string to ArrayBuffer.
  const base64ToArrayBuffer = useCallback((base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, []);

  // Queue and play a chunk of audio.
  const playAudioChunk = useCallback(
    async (base64AudioChunk: string): Promise<void> => {
      try {
        await ensureAudioInitialized();
        const arrayBuffer = base64ToArrayBuffer(base64AudioChunk);
        const uint8Array = new Uint8Array(arrayBuffer);
        audioStreamerRef.current?.addPCM16(uint8Array);
        audioStreamerRef.current?.resume();
      } catch (error) {
        console.error("Error queuing audio chunk:", error);
        log("Error queuing audio chunk: " + (error as Error).message);
      }
    },
    [ensureAudioInitialized, base64ToArrayBuffer, log]
  );

  const stopSession = useCallback(() => {
    audioRecorderRef.current?.stop();
    audioStreamerRef.current?.stop();
    audioRecorderRef.current
      ?.off("data", onAudioRecorderData)
      .off("volume", (userVolume) => setAiState({ userVolume }));
    log("Recording stopped.");
    setIsRecording(false);
    setIsLoading(false);
    setAiState({ isConnected: false });
    if (providerRef.current?.isConnected) {
      providerRef.current.disconnect();
    }
    if ("vibrate" in window.navigator) window.navigator.vibrate(50);
    wakeLockRef.current?.release().then(() => {
      wakeLockRef.current = null;
    });
  }, [setAiState, log]);

  const startSession = useCallback(async () => {
    setIsLoading(true);
    try {
      await ensureAudioInitialized();
      // Reset any previous audio streaming state.
      audioStreamerRef.current?.stop();

      if (!providerRef.current || !providerRef.current.isConnected) {
        // If we had a previous connection, disconnect it
        if (providerRef.current) providerRef.current.disconnect();

        // Initialize the API.
        providerRef.current = new GeminiLiveAPI(props, {
          onSetupComplete: async () => {
            log("Setup complete");
            await handleSetupComplete();
          },
          onAudioData: async (audioData) => {
            log("Speaking...");
            await playAudioChunk(audioData);
          },
          onTranscription(text) {
            if (text) addQuestion({ text: text.replace(/\n/g, "") });
            else log("Invalid response:", text);
          },
          onInterrupted: () => {
            log("Interrupted");
            audioStreamerRef.current?.stop();
            setAiState({ aiVolume: 0 });
          },
          onTurnComplete: () => {
            log("Finished speaking");
            audioStreamerRef.current?.complete();
          },
          onError: (message) => {
            log("Error: " + message);
            stopSession();
          },
          onRetry: () => {
            setIsLoading(true);
          },
          onClose: () => {
            log("Connection closed");
            stopSession();
          },
        });
      }

      // Set up audio recorder
      const recorder = new AudioRecorder();
      audioRecorderRef.current = recorder;
      await recorder
        .on("data", onAudioRecorderData)
        .on("volume", (userVolume) => setAiState({ userVolume }))
        .start();
      setIsRecording(true);
      log("Recording started...");
    } catch (error) {
      console.error("Error starting recording:", error);
      log("Error starting recording: " + (error as Error).message);
      setIsLoading(false);
    }
  }, [
    ensureAudioInitialized,
    log,
    props,
    playAudioChunk,
    stopSession,
    setAiState,
    addQuestion,
    handleSetupComplete,
  ]);

  function onAudioRecorderData(base64Data: string) {
    if (providerRef.current?.isConnected) {
      providerRef.current?.sendAudioChunk(base64Data);
    }
  }

  return {
    startSession,
    stopSession,
    resumeRecording: async () => {
      await audioRecorderRef.current?.start();
      setIsRecording(true);
    },
    pauseRecording: () => {
      audioRecorderRef.current?.stop();
      setIsRecording(false);
    },
    isLoading,
    isRecording,
  };
}

export default useAiAssistant;
