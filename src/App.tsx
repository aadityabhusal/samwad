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
import { GoalIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

function App() {
  const isConnected = useAiStateStore((s) => s.isConnected);
  const currentSession = useAiStateStore((s) => s.currentSession);
  const learnLanguage = useUiConfigStore((s) => s.learn_language);
  const addSession = usePracticeSessionsStore((s) => s.addSession);
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
              <Button
                size={"lg"}
                className="items-center"
                onClick={() => addSession("New Session", true)}
              >
                <GoalIcon className="size-6" />
                <span>Start a practice session</span>
              </Button>
            </section>
          )}
        </main>
        {!currentSession ? null : (
          <div className="flex flex-col border-t p-3 gap-2">
            {isConnected ? <AudioPulse /> : null}
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
