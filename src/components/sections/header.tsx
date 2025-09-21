import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  EllipsisVerticalIcon,
  LibraryBigIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  useAiStateStore,
  usePracticeSessionsStore,
  useUiConfigStore,
} from "@/lib/store";
import { Logo } from "@/components/ui/logo";
import { useTheme } from "../theme-provider";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { TypographyH4 } from "@/components/ui/typography";
import { useMemo } from "react";
import dayjs from "dayjs";

export function Header() {
  const { toggleTheme } = useTheme();
  const api_key = useUiConfigStore((s) => s.api_key);
  const openSessionList = useUiConfigStore((s) => s.open_session_list);
  const openSettings = useUiConfigStore((s) => s.open_settings);
  const setUiConfig = useUiConfigStore((s) => s.setUiConfig);
  const currentSession = useAiStateStore((s) => s.currentSession);
  const setAiState = useAiStateStore((s) => s.setAiState);
  const sessions = usePracticeSessionsStore((s) => s.sessions);
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
      ),
    [sessions]
  );
  const addSession = usePracticeSessionsStore((s) => s.addSession);
  const deleteSession = usePracticeSessionsStore((s) => s.deleteSession);

  return (
    <header className="h-14 flex items-center justify-between border-b p-2">
      <Drawer
        direction="left"
        open={openSettings}
        onClose={() => setUiConfig({ open_settings: false })}
      >
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            children={<SettingsIcon className="size-5" />}
            onClick={() => setUiConfig({ open_settings: true })}
          />
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Setting</DrawerTitle>
            <DrawerDescription></DrawerDescription>
            <label
              htmlFor="themeButton"
              className="py-1 flex items-center justify-between mb-2"
            >
              <span>Theme</span>
              <Button id="themeButton" variant="ghost" onClick={toggleTheme}>
                <SunIcon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </label>
            <p>Gemini API Key</p>
            <Input
              value={api_key}
              onChange={(e) => setUiConfig({ api_key: e.target.value })}
              type="password"
              placeholder="Enter your Gemini API key"
            />
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
      <Logo className="w-8 h-8" withText />
      <Drawer
        direction="right"
        open={openSessionList}
        onClose={() => setUiConfig({ open_session_list: false })}
      >
        <DrawerTrigger asChild>
          <Button
            variant={"ghost"}
            size={"icon"}
            onClick={() => setUiConfig({ open_session_list: true })}
          >
            <LibraryBigIcon className="size-5" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="flex-row gap-2 px-2 items-center border-b">
            <DrawerClose asChild>
              <Button variant="ghost" size={"icon"}>
                <XIcon className="size-5" />
              </Button>
            </DrawerClose>
            <DrawerTitle>Practice Sessions</DrawerTitle>
            <DrawerDescription></DrawerDescription>
            {!sessions.length ? null : (
              <Button
                size={"sm"}
                className="ml-auto"
                onClick={() => addSession("Practice Session", true)}
              >
                <span>New</span>
                <PlusIcon className="size-5" />
              </Button>
            )}
          </DrawerHeader>
          <ul className="p-2 h-full flex-1 overflow-y-auto flex flex-col gap-2">
            {!sessions.length ? (
              <div className="mx-auto mt-[20%] flex flex-col gap-4 items-center">
                <TypographyH4>No session found.</TypographyH4>
                <DrawerClose asChild>
                  <Button
                    className="w-fit"
                    onClick={() => addSession("Practice Session", true)}
                  >
                    <span>Create new session</span>
                    <PlusIcon className="size-5" />
                  </Button>
                </DrawerClose>
              </div>
            ) : (
              sortedSessions.map((session) => (
                <DrawerClose key={session.id} asChild>
                  <li
                    className={cn(
                      "p-2 border rounded-sm flex justify-between items-start cursor-pointer",
                      currentSession === session.id ? "bg-secondary" : ""
                    )}
                    onClick={() => setAiState({ currentSession: session.id })}
                  >
                    <div className="flex flex-col gap-1">
                      <span>{session.title}</span>
                      <span className="text-muted-foreground text-sm">
                        {dayjs(session.createdAt).format(
                          "MMMM D YYYY, hh:mm A"
                        )}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="size-5 mt-0.5"
                          children={<EllipsisVerticalIcon />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          className="text-destructive hover:!text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                        >
                          Delete
                          <DropdownMenuShortcut>
                            <TrashIcon className="text-destructive" />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                </DrawerClose>
              ))
            )}
          </ul>
        </DrawerContent>
      </Drawer>
    </header>
  );
}
