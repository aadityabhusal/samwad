import PWABadge from "@/PWABadge.tsx";
import { Header } from "@/components/sections/header";
import { ActionBar } from "@/components/sections/action-bar";
import { AudioPulse } from "@/components/ui/audio-pulse";
import { ThemeProvider } from "@/components/theme-provider";
import { useAiStateStore, useUiConfigStore } from "@/lib/store";
import { TypographyH1 } from "@/components/ui/typography";
import { LANGUAGES } from "./lib/data";

function App() {
  const isConnected = useAiStateStore((s) => s.isConnected);
  const learnLanguage = useUiConfigStore((s) => s.learn_language);
  return (
    <ThemeProvider>
      <div className="h-dvh flex flex-col justify-between">
        <Header />
        <main className="flex flex-col flex-1 justify-center items-center">
          {isConnected ? (
            <AudioPulse />
          ) : (
            <div className="flex flex-col items-center gap-12 px-4">
              <TypographyH1>Welcome to Samwad</TypographyH1>
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
            </div>
          )}
        </main>
        <ActionBar />
        <PWABadge />
      </div>
    </ThemeProvider>
  );
}

export default App;
