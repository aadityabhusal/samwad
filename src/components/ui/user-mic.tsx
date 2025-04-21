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
      variant={isConnected ? "secondary" : "outline"}
      size={"lg"}
      className={cn("size-16 rounded-full [&_svg]:!size-8")}
      disabled={disabled}
      onClick={onClick}
      children={
        isLoading ? (
          <Loader2Icon className="animate-spin" />
        ) : isRecording ? (
          <PauseIcon />
        ) : (
          <MicIcon />
        )
      }
    />
  );
}
