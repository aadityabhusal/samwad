import { useCallback, useMemo, useRef } from "react";
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
import { base64ToArrayBuffer, getLanguage, logError } from "@/lib/utils";
import { AudioRecorder } from "@/lib/audio/audio-recorder";
import VolMeterWorklet from "@/lib/audio/vol-meter-worklet";
import { DIFFICULTY } from "@/lib/data";
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
            description: "The next question.",
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
  const setCurrentQuestion = usePracticeSessionsStore(
    (s) => s.setCurrentQuestion
  );

  const promptData = useMemo(() => {
    const api_key = config.api_key;
    const voice = config.voice;
    const learnLanguage = getLanguage(config.learn_language);
    const nativeLanguage = getLanguage(config.native_language);
    const difficulty =
      DIFFICULTY.find((d) => d.value === config.difficulty) || DIFFICULTY[0];
    return { api_key, voice, learnLanguage, nativeLanguage, difficulty };
  }, [config]);

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
        setCurrentQuestion(pendingQuestion.id);
        firstQn = `I will ask: ${pendingQuestion.text}`;
      }

      session.current?.sendClientContent({
        turns: [
          ...(firstQn
            ? [{ role: "model", parts: [{ text: firstQn, thought: true }] }]
            : []),
          { role: "user", parts: [{ text: "Ask me the first question." }] },
        ],
        turnComplete: true,
      });

      // Enable PWA features
      if ("wakeLock" in window.navigator) {
        wakeLockRef.current = await navigator.wakeLock.request();
      }
      if ("vibrate" in window.navigator) window.navigator.vibrate(50);

      await setupAudioRecorder();
      setAiState({ isLoading: false, isConnected: true, sessionStarted: true });
    } catch (e) {
      logError(e);
    }
  }, [getQuestions, setCurrentQuestion, setupAudioRecorder, setAiState]);

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
          const difficulty = promptData.difficulty.value;
          addQuestions(
            [{ text: args.next_question, id: uuid(), difficulty }],
            true
          );
        }
        functionResponses.push({ id, name, response: {} });
      });
      session.current?.sendToolResponse({ functionResponses });
    },
    [addQuestions, addScore, promptData.difficulty.value]
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

    const { learnLanguage, nativeLanguage, difficulty, voice } = promptData;
    const questions = getQuestions().map((q) => q.text);
    const genAI = new GoogleGenAI({ apiKey: promptData.api_key });
    try {
      session.current = await genAI.live.connect({
        model: "models/gemini-2.0-flash-live-001",
        config: {
          systemInstruction: [
            `SYSTEM INSTRUCTION: YOU ARE A ${voice} INSTRUCTOR, SPECIALIZED IN TEACHING ${learnLanguage.label}. YOUR PRIMARY COMMUNICATION LANGUAGE IS ${nativeLanguage.label}.`,
            `THE USER IS A NATIVE ${nativeLanguage.label} SPEAKER LEARNING ${learnLanguage.label} LANGUAGE AT A ${difficulty.label} PROFICIENCY LEVEL.`,
            `CORE OBJECTIVE: CONDUCT A STRUCTURED PRACTICE SESSION WHERE YOU ASK QUESTIONS TO THE USER TO TEST THEIR SPOKEN ${learnLanguage.label}. FOLLOW THESE STEP-BY-STEP GUIDELINES:`,
            `1. ASK A QUESTION OF ${difficulty.label} LEVEL DIFFICULTY. FOR COMPLEX QUESTIONS, EXPLAIN WHAT THE QUESTION IS TRYING TO ASK.`,
            `2. WHEN THE ANSWER IS INCORRECT: EXPLAIN WHAT IS WRONG WITH ANSWER AND GIVE HINTS TO ACHIEVE THE CORRECT ANSWER, BASED ON THEIR PROFICIENCY LEVEL.`,
            `3. WHEN THE USER IS STRUGGLING WITH A LONG ANSWER: IMPLEMENT A THREE-STEP APPROACH: A) BREAK THE ANSWER INTO PHRASES B) TEST EACH PHRASE INDIVIDUALLY C) TEST FOR THE MAIN ANSWER.`,
            `4. WHEN THE ANSWER IS CORRECT: GIVE A SCORE TO THE USER BETWEEN 1 AND 10 FOR THE MAIN ANSWER, BASED ON ${difficulty.label} LEVEL STANDARDS. BE STRICT WHILE SCORING AND GIVE FEEDBACK WHEN NECESSARY.`,
            `5. AFTER GIVING THE SCORE: ASK THE NEXT QUESTION. NEVER ASK FOR USER'S CONFIRMATION TO ASK THE QUESTIONS. NEVER ASK THE USER TO END THE PRACTICE SESSION.`,
            `HERE ARE THE RULES THAT YOU MUST FOLLOW:`,
            `1. MAINTAIN FOCUS ON THE CURRENT QUESTION UNTIL A CORRECT ANSWER IS GIVEN. DO NOT ASK FOLLOW-UP QUESTIONS.`,
            `2. PRESENT EXACTLY ONE CONCEPT AND ONE EXAMPLE PER INTERACTION. NO EXCEPTIONS.`,
            `3. MAINTAIN STRICT QUESTION-AND-ANSWER FORMAT. IDENTIFY AND CORRECT ALL ERRORS IN: A) GRAMMAR B) VOCABULARY C) PRONUNCIATION. AVOID ANY CONVERSATIONAL DEVIATIONS.`,
            `4. ALWAYS USE ${nativeLanguage.label} FOR INSTRUCTIONS AND EXPLANATIONS. DO NOT REPEAT THE SAME SENTENCES IN ${nativeLanguage.label} AND ${learnLanguage.label} LANGUAGE.`,
            `5. DO NOT INCLUDE YOUR THOUGHTS IN THE RESPONSE.`,
            questions.length
              ? `6. HERE IS THE LIST OF QUESTIONS THAT YOU SHOULD NEVER ASK: ${JSON.stringify(
                  questions
                )}`
              : ``,
          ].join("\n"),
          temperature: 0.6,
          tools: [score_tool, next_question_tool],
          outputAudioTranscription: {},
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice === "male" ? "Charon" : "Aoede",
              },
            },
            languageCode: nativeLanguage.value,
          },
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
    promptData,
    getQuestions,
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
