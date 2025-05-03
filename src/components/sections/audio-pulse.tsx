import { Button } from "@/components/ui/button";
import { useAiStateStore, useUiConfigStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CaptionsIcon, CaptionsOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";

const lineCount = 5;
const MIN_HEIGHT = 10; // Minimum height of each line
const MAX_HEIGHT = 56; // Maximum height of each line

export function AudioPulse() {
  const volume = useAiStateStore((s) => s.aiVolume);
  const lines = useRef<(HTMLDivElement | null)[]>([]);
  const transcription = useAiStateStore((s) => s.transcription);
  const hideTranscription = useUiConfigStore((s) => s.hideTranscription);
  const setUiConfig = useUiConfigStore((s) => s.setUiConfig);

  useEffect(() => {
    let timeout: number | null = null;
    const update = () => {
      lines.current.forEach((line, index) => {
        if (!line) return;
        const mid = Math.round(lineCount / 2);
        const multiplier = MAX_HEIGHT / (Math.abs(mid - (index + 1)) + 1);
        const height = MIN_HEIGHT + volume * multiplier * 2;
        line.style.height = `${Math.min(MAX_HEIGHT, height)}px`;
      });
      timeout = window.setTimeout(update, 250);
    };

    update();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [volume]);

  return (
    <div className={cn("flex justify-between items-center min-h-14 relative")}>
      <span className="w-10" />
      <div
        className={cn(
          "flex w-32 justify-evenly items-center transition-all duration-500"
        )}
      >
        {Array.from({ length: lineCount }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              lines.current[i] = el;
            }}
            style={{ animationDelay: `${i * 133}ms` }}
            className={cn(
              "bg-primary rounded-full w-3 min-h-1 transition-[height] duration-100"
            )}
          />
        ))}
      </div>
      <Button
        variant={"ghost"}
        size={"icon"}
        className="text-primary size-7"
        onClick={() => setUiConfig({ hideTranscription: !hideTranscription })}
      >
        {hideTranscription ? (
          <CaptionsIcon className="size-6" />
        ) : (
          <CaptionsOffIcon className="size-6" />
        )}
      </Button>
      {hideTranscription ? null : (
        <div className="w-full absolute bottom-[calc(100%+12px)] border rounded-t-md bg-background p-3 shadow-[0_-2px_6px_var(--border)]">
          <p>{transcription}</p>
        </div>
      )}
    </div>
  );
}
