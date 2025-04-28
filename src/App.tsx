import PWAAlert from "@/components/sections/pwa-alert";
import { Header } from "@/components/sections/header";
import { ActionBar } from "@/components/sections/action-bar";
import { AudioPulse } from "@/components/sections/audio-pulse";
import { ThemeProvider } from "@/components/theme-provider";
import { useAiStateStore, useUiConfigStore } from "@/lib/store";
import { TypographyH1, TypographyH4 } from "@/components/ui/typography";
import { LANGUAGES } from "@/lib/data";
import { Conversation } from "@/components/sections/conversation";
import { MicIcon } from "lucide-react";

function App() {
  const isConnected = useAiStateStore((s) => s.isConnected);
  const firstSessionStarted = useAiStateStore((s) => s.sessionStarted);
  const learnLanguage = useUiConfigStore((s) => s.learn_language);
  return (
    <ThemeProvider>
      <div className="h-dvh flex flex-col justify-between">
        <Header />
        <main className="flex flex-col justify-center flex-1 h-[calc(100dvh-56px-152px)] relative">
          {firstSessionStarted ? (
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
              <TypographyH4 className="flex gap-2 items-center">
                <span>Click on the</span>
                <MicIcon className="size-7 text-primary-foreground border-primary bg-primary p-1 rounded-full" />
                <span>button to start.</span>
              </TypographyH4>
            </section>
          )}
        </main>
        <div className="flex flex-col border-t p-3 gap-2">
          {isConnected ? <AudioPulse /> : null}
          <ActionBar />
        </div>
        <PWAAlert />
      </div>
    </ThemeProvider>
  );
}

export default App;
