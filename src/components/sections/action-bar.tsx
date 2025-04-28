import { Settings2Icon, XIcon } from "lucide-react";
import { SETTINGS } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAiStateStore,
  usePracticeSessionsStore,
  useUiConfigStore,
} from "@/lib/store";
import { useShallow } from "zustand/shallow";
import { UserMic } from "../ui/user-mic";
import { useLiveApi } from "@/lib/hooks/use-live-api";

export function ActionBar() {
  const { setUiConfig, ...uiConfig } = useUiConfigStore(
    useShallow((s) => ({
      setUiConfig: s.setUiConfig,
      api_key: s.api_key,
      difficulty: s.difficulty,
      playback_rate: s.playback_rate,
      voice: s.voice,
      native_language: s.native_language,
      learn_language: s.learn_language,
    }))
  );
  const { isConnected, isLoading, isRecording } = useAiStateStore(
    useShallow((s) => ({
      isConnected: s.isConnected,
      isLoading: s.isLoading,
      isRecording: s.isRecording,
    }))
  );
  const currentSession = usePracticeSessionsStore((s) => s.currentSessionId);
  const addSession = usePracticeSessionsStore((s) => s.addSession);

  const { startSession, stopSession, resumeRecording, pauseRecording } =
    useLiveApi(uiConfig);

  return (
    <div className="flex justify-center gap-8 items-baseline">
      {isConnected ? (
        <Button
          variant="destructive"
          className="size-16 rounded-full"
          children={<XIcon className="size-8" />}
          onClick={() => stopSession()}
        />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              className="size-16 rounded-full"
              children={<Settings2Icon className="size-8" />}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SETTINGS.map(({ menu, value, label, disabled }) => (
              <DropdownMenuSub key={value}>
                <DropdownMenuSubTrigger disabled={disabled} className="gap-3">
                  <span className="flex-1">{label}</span>
                  <DropdownMenuShortcut>
                    {menu.find((s) => s.value === uiConfig[value])?.label}
                  </DropdownMenuShortcut>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={uiConfig[value]}
                      onValueChange={(val) =>
                        setUiConfig((p) => ({ ...p, [value]: val }))
                      }
                    >
                      {menu.map(({ value, label }) => (
                        <DropdownMenuRadioItem
                          key={value}
                          value={value}
                          children={label}
                        />
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <UserMic
        disabled={!uiConfig.api_key}
        isLoading={isLoading}
        isRecording={isRecording}
        onClick={async () => {
          if (isRecording) pauseRecording();
          else if (isConnected) await resumeRecording();
          else {
            if (!currentSession) addSession("Practice Session", true);
            await startSession();
          }
        }}
      />
    </div>
  );
}
