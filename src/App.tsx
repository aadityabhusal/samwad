import PWAAlert from "@/components/sections/pwa-alert";
import { Header } from "@/components/sections/header";
import { ActionBar } from "@/components/sections/action-bar";
import { AudioPulse } from "@/components/sections/audio-pulse";
import { ThemeProvider } from "@/components/theme-provider";
import {
  useAiStateStore,
  usePracticeSessionsStore,
  useUiConfigStore,
} from "@/lib/store";
import { TypographyH1 } from "@/components/ui/typography";
import { LANGUAGES } from "@/lib/data";
import { Conversation } from "@/components/sections/conversation";
import { LibraryBigIcon, PlusIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

function App() {
  const isConnected = useAiStateStore((s) => s.isConnected);
  const currentSession = useAiStateStore((s) => s.currentSession);
  const learnLanguage = useUiConfigStore((s) => s.learn_language);
  const apiKey = useUiConfigStore((s) => s.api_key);
  const sessions = usePracticeSessionsStore((s) => s.sessions);
  const addSession = usePracticeSessionsStore((s) => s.addSession);
  const setUiConfig = useUiConfigStore((s) => s.setUiConfig);

  return (
    <ThemeProvider>
      <Header />
      <div className="h-[calc(100dvh-56px)] flex flex-col justify-between">
        <main className="flex flex-col justify-center flex-1 h-[calc(100dvh-56px-152px)] relative">
          {currentSession ? (
            <Conversation />
          ) : (
            <section className="flex flex-col items-center gap-12 px-4">
              <TypographyH1 className="text-center">
                Welcome to Samwad
              </TypographyH1>
              <ul className="custom-check-icon">
                <li>
                  Practice{" "}
                  {LANGUAGES.find((l) => l.value === learnLanguage)?.label ||
                    "language"}{" "}
                  with AI
                </li>
                <li>In your native language</li>
                <li>Without fear of mistakes</li>
              </ul>
              <div className="flex flex-col gap-4">
                <Button
                  size={"lg"}
                  className="items-center"
                  onClick={() => addSession("Practice Session", true)}
                >
                  <PlusIcon className="size-6" />
                  <span>Create new session</span>
                </Button>
                {!sessions.length ? null : (
                  <Button
                    size={"lg"}
                    variant={"secondary"}
                    className="items-center"
                    onClick={() => setUiConfig({ open_session_list: true })}
                  >
                    <LibraryBigIcon className="size-6" />
                    <span>View past sessions</span>
                  </Button>
                )}
              </div>
            </section>
          )}
        </main>
        {!currentSession ? null : (
          <div className="flex flex-col border-t p-3 gap-2">
            {!apiKey ? (
              <div className="flex gap-1 justify-center items-center">
                <p className="text-destructive text-sm pb-px">
                  Missing Gemini API key.
                </p>
                <Button
                  variant={"link"}
                  className="px-0 underline"
                  onClick={() => setUiConfig({ open_settings: true })}
                >
                  Click here
                </Button>
              </div>
            ) : isConnected ? (
              <AudioPulse />
            ) : null}
            <ActionBar />
          </div>
        )}
        <PWAAlert />
      </div>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
