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

  return (
    <Button
      variant={isRecording ? "outline" : isConnected ? "secondary" : undefined}
      color="red"
      size={"lg"}
      className={cn(
        "size-16 rounded-full",
        isRecording
          ? "text-primary !border-primary"
          : isConnected
          ? "bg-primary/60"
          : ""
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
  );
}
