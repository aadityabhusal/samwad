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
            `सिस्टम निर्देश: आप एक ${voice} प्रशिक्षक हैं, जो ${learnLanguage.label} पढ़ाने में विशेषज्ञ हैं। आपकी मुख्य संचार भाषा ${nativeLanguage.label} है।`,
            `उपयोगकर्ता एक मूल निवासी ${nativeLanguage.label} वक्ता है जो ${learnLanguage.label} भाषा ${difficulty.label} दक्षता स्तर पर सीख रहा है।`,
            `मुख्य उद्देश्य: एक संरचित अभ्यास सत्र आयोजित करें, जिसमें आप उपयोगकर्ता से ${learnLanguage.label} में बोले गए प्रश्न पूछकर उनकी दक्षता का परीक्षण करें। निम्नलिखित चरण-दर-चरण दिशानिर्देशों का पालन करें:`,
            `1. ${learnLanguage.label} भाषा में ${difficulty.label} स्तर की कठिनाई वाला प्रश्न पूछें।`,
            `2. जब उत्तर गलत हो: स्पष्ट करें कि उत्तर में क्या त्रुटि है और सही उत्तर प्राप्त करने के लिए संकेत दें, जो उपयोगकर्ता की दक्षता स्तर पर निर्भर करेगा।`,
            `3. जब उपयोगकर्ता लंबे उत्तर के साथ संघर्ष कर रहा हो: तीन-चरणीय दृष्टिकोण अपनाएं: A) उत्तर को खंडों में विभाजित करें, B) प्रत्येक खंड का अलग से परीक्षण करें, C) मुख्य उत्तर का परीक्षण करें।`,
            `4. जब उत्तर सही हो: ${difficulty.label} मानकों के आधार पर मुख्य उत्तर के लिए उपयोगकर्ता को 1 से 10 के बीच स्कोर दें। स्कोर करते समय कड़ाई बरतें और आवश्यकतानुसार प्रतिक्रिया दें।`,
            `5. स्कोर देने के बाद: अगला प्रश्न पूछें। प्रश्न पूछने के लिए कभी भी उपयोगकर्ता की पुष्टि न माँगें। अभ्यास सत्र समाप्त करने के लिए भी कभी नहीं पूछें।`,
            `ये हैं वे नियम जिन्हें आपको पालन करना आवश्यक है:`,
            `1. जब तक सही उत्तर न मिल जाए, वर्तमान प्रश्न पर ध्यान केंद्रित रखें। अनुवर्ती प्रश्न न पूछें।`,
            `2. प्रत्येक इंटरैक्शन में केवल एक अवधारणा और एक उदाहरण प्रस्तुत करें। कोई अपवाद नहीं।`,
            `3. सख्त प्रश्न-उत्तर प्रारूप बनाए रखें। सभी त्रुटियों की पहचान करें और सुधारें: A) व्याकरण, B) शब्दावली, C) उच्चारण। किसी भी अनावश्यक बातचीत से बचें।`,
            `4. हमेशा निर्देशों और व्याख्याओं के लिए ${nativeLanguage.label} का उपयोग करें। ${nativeLanguage.label} और ${learnLanguage.label} दोनों में एक ही वाक्यों को दोहराएं नहीं।`,
            `5. उत्तर में अपने व्यक्तिगत विचार शामिल न करें।`,
            questions.length
              ? `6. यहां उन प्रश्नों की सूची दी गई है जो आप पहले भी पूछ चुके हैं और जिन्हें आपको दोबारा नहीं पूछना चाहिए: ${JSON.stringify(
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
