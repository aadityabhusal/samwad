import { useAiStateStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2Icon, MicIcon, PauseIcon } from "lucide-react";

export function UserMic({
  isRecording,
  isLoading,
  disabled,
  onClick,
}: {
  disabled?: boolean;
  isRecording?: boolean;
  isLoading?: boolean;
  onClick: () => void;
}) {
  const isConnected = useAiStateStore((s) => s.isConnected);
  const userVolume = useAiStateStore((s) =>
    s.isConnected ? Math.min(80, 64 + Math.floor(s.userVolume * 175)) : 0
  );

  return (
    <div className="relative">
      <Button
        variant={isConnected ? "outline" : undefined}
        size={"lg"}
        className={cn(
          "size-16 rounded-full",
          isConnected ? "text-primary hover:text-primary !border-primary" : ""
        )}
        disabled={disabled}
        onClick={onClick}
        children={
          isLoading ? (
            <Loader2Icon className="animate-spin size-8" />
          ) : isRecording ? (
            <PauseIcon className="size-8" />
          ) : (
            <MicIcon className="size-8" />
          )
        }
      />
      <div
        className={cn(
          "absolute -z-[1] rounded-full bg-primary/60 top-8 left-8 -translate-1/2 transition-all duration-50 ease-in"
        )}
        style={{ width: userVolume, height: userVolume }}
      />
    </div>
  );
}
