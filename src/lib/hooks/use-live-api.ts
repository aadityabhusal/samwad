import { useCallback, useRef } from "react";
import {
  FunctionCall,
  FunctionResponse,
  GoogleGenAI,
  LiveServerContent,
  Modality,
  Session,
  Tool,
  Type,
} from "@google/genai";
import { IUiConfig } from "@/lib/types";
import { useAiStateStore, usePracticeSessionsStore } from "@/lib/store";
import { AudioStreamer } from "../audio/audio-streamer";
import { base64ToArrayBuffer, getSystemPrompt, logError } from "@/lib/utils";
import { AudioRecorder } from "@/lib/audio/audio-recorder";
import VolMeterWorklet from "@/lib/audio/vol-meter-worklet";
import { v4 as uuid } from "uuid";

const score_tool: Tool = {
  functionDeclarations: [
    {
      name: "give_score",
      description:
        "Call this function when giving any kind of score or points to the user. उपयोगकर्ता को किसी भी प्रकार का स्कोर या अंक देते समय इस फ़ंक्शन को कॉल करें|",
      parameters: {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.NUMBER,
            description:
              "The score or points given to the user. उपयोगकर्ता को दिया गया स्कोर या अंक|",
          },
        },
        required: ["score"],
      },
    },
  ],
};

const next_question_tool = {
  functionDeclarations: [
    {
      name: "next_questions",
      description:
        "Call this function when the next question is asked. अगला प्रश्न पूछे जाने पर इस फ़ंक्शन को कॉल करें|",
      parameters: {
        type: Type.OBJECT,
        properties: {
          next_question: {
            type: Type.STRING,
            description: "The next question. अगला प्रश्न",
          },
        },
        required: ["next_question"],
      },
    },
  ],
};

export function useLiveApi(config: Omit<IUiConfig, "theme">) {
  const session = useRef<Session>(null);
  const wakeLockRef = useRef<WakeLockSentinel>(null);
  const audioStreamerRef = useRef<AudioStreamer>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const setAiState = useAiStateStore((s) => s.setAiState);
  const getQuestions = usePracticeSessionsStore((s) => s.getQuestions);
  const addQuestions = usePracticeSessionsStore((s) => s.addQuestions);
  const addScore = usePracticeSessionsStore((s) => s.addScore);

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
      let firstQn = "";
      const pendingQuestion = getQuestions("pending")?.[0];
      if (pendingQuestion) {
        setAiState({ currentQuestion: pendingQuestion.id });
        firstQn = `मैं यह प्रश्न पूछूंगा: ${pendingQuestion.text}`;
      }

      session.current?.sendClientContent({
        turns: [
          ...(firstQn
            ? [{ role: "model", parts: [{ text: firstQn, thought: true }] }]
            : []),
          { role: "user", parts: [{ text: "पहला प्रश्न पूछो" }] },
        ],
        turnComplete: true,
      });

      // Enable PWA features
      if ("wakeLock" in window.navigator) {
        wakeLockRef.current = await navigator.wakeLock.request();
      }
      if ("vibrate" in window.navigator) window.navigator.vibrate(50);

      await setupAudioRecorder();
      setAiState({ isLoading: false, isConnected: true });
    } catch (e) {
      logError(e);
    }
  }, [getQuestions, setupAudioRecorder, setAiState]);

  const handleToolCall = useCallback(
    (functionCalls: FunctionCall[]) => {
      const functionResponses: FunctionResponse[] = [];
      functionCalls.forEach(({ id, name, args }) => {
        if (name === "give_score" && typeof args?.score === "number") {
          addScore(args.score);
        } else if (
          name === "next_questions" &&
          typeof args?.next_question === "string"
        ) {
          const difficulty = config.difficulty;
          addQuestions(
            [{ text: args.next_question, id: uuid(), difficulty }],
            true
          );
        }
        functionResponses.push({ id, name, response: {} });
      });
      session.current?.sendToolResponse({ functionResponses });
    },
    [addQuestions, addScore, config.difficulty]
  );

  const handleServerContent = useCallback(
    (serverContent: LiveServerContent) => {
      if (serverContent.interrupted) {
        console.log("Interrupted");
        audioStreamerRef.current?.stop();
        return;
      }

      if (serverContent.outputTranscription) {
        const transcription = serverContent.outputTranscription?.text || "";
        setAiState((s) => ({
          isTurnComplete: false,
          transcription:
            ((!s.isTurnComplete && s.transcription) || "") + transcription,
        }));
      }

      if (serverContent.modelTurn?.parts) {
        serverContent.modelTurn?.parts.forEach((audioPart) => {
          if (!audioPart.inlineData?.mimeType?.startsWith("audio/pcm")) {
            // console.log({ otherPart: audioPart });
          } else if (audioPart.inlineData.data) {
            const data = base64ToArrayBuffer(audioPart.inlineData.data);
            audioStreamerRef.current?.addPCM16(new Uint8Array(data));
            audioStreamerRef.current?.resume();
          }
        });
      }

      if (serverContent.turnComplete) {
        console.log("turnComplete");
        audioStreamerRef.current?.complete();
        setAiState({ isTurnComplete: true });
      }

      // @todo-maybe: Send Continue signal
    },
    [setAiState]
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
    session.current = null;
    setAiState({
      isConnected: false,
      isRecording: false,
      isLoading: false,
      transcription: "",
    });
    console.log("Session ended");
  }, [setAiState]);

  const startSession = useCallback(async () => {
    setAiState({ isLoading: true });
    setupAudioStreamer();
    audioStreamerRef.current?.stop(); // Reset the previous audio streaming state.
    session.current?.close(); // Close the previous active connection

    const genAI = new GoogleGenAI({ apiKey: config.api_key });
    try {
      session.current = await genAI.live.connect({
        model: "models/gemini-2.0-flash-live-001",
        config: {
          systemInstruction: getSystemPrompt(config),
          temperature: 0.6,
          outputAudioTranscription: {},
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: config.voice === "male" ? "Charon" : "Aoede",
              },
            },
            languageCode: config.native_language,
          },
          ...(config.disable_question === "yes"
            ? {}
            : { tools: [score_tool, next_question_tool] }),
        },
        callbacks: {
          onopen: () => console.log("Connection opened"),
          onerror: (e) => {
            logError(e);
            stopSession();
          },
          onclose: (e) => {
            console.log("Connection closed:", e);
            stopSession();
          },
          async onmessage(response) {
            if (response.setupComplete) {
              console.log("Setup complete");
              await handleSetupComplete();
            }
            if (response.serverContent) {
              handleServerContent(response.serverContent);
            }
            if (response.toolCall?.functionCalls) {
              console.log("Tool call", response.toolCall.functionCalls);
              handleToolCall(response.toolCall.functionCalls);
            }
            if (response.toolCallCancellation) {
              console.log("Tool cancellation", response.toolCallCancellation);
            }
          },
        },
      });
    } catch (e) {
      logError(e);
      stopSession();
    }
  }, [
    config,
    setAiState,
    setupAudioStreamer,
    stopSession,
    handleSetupComplete,
    handleServerContent,
    handleToolCall,
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
