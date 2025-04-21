import { useAiStateStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

const lineCount = 5;
const MIN_HEIGHT = 16; // Minimum height of each line
const MAX_HEIGHT = 400; // Maximum height of each line

export function AudioPulse() {
  const volume = useAiStateStore((s) => s.volume);
  const lines = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let timeout: number | null = null;
    const update = () => {
      lines.current.forEach((line, index) => {
        if (!line) return;
        const mid = Math.round(lineCount / 2);
        const multiplier = MAX_HEIGHT / (Math.abs(mid - (index + 1)) + 1);
        line.style.height = `${MIN_HEIGHT + volume * multiplier}px`;
      });
      timeout = window.setTimeout(update, 250);
    };

    update();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [volume]);

  return (
    <div
      className={
        "flex w-32 justify-evenly items-center transition-all duration-500"
      }
    >
      {Array.from({ length: lineCount }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            lines.current[i] = el;
          }}
          style={{ animationDelay: `${i * 133}ms` }}
          className={cn(
            "bg-neutral-300 rounded-full w-3 min-h-1 transition-[height] duration-100",
            volume ? "bg-primary" : "bg-neutral-800"
          )}
        />
      ))}
    </div>
  );
}
