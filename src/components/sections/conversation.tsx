import { usePracticeSessionsStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  BotMessageSquareIcon,
  EllipsisVerticalIcon,
  SearchXIcon,
  Trash2Icon,
  TrashIcon,
} from "lucide-react";
import { TypographyH4 } from "@/components/ui/typography";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function Conversation() {
  const sessionId = usePracticeSessionsStore((s) => s.currentSessionId);
  const sessions = usePracticeSessionsStore((s) => s.sessions);
  const deleteQuestion = usePracticeSessionsStore((s) => s.deleteQuestion);
  const deleteAllQuestions = usePracticeSessionsStore(
    (s) => s.deleteAllQuestions
  );
  const lastQuestionRef = useRef<HTMLDivElement>(null);
  const questionContainerRef = useRef<HTMLDivElement>(null);
  const hasInitiallyScrolled = useRef<boolean>(false);

  const questions = useMemo(
    () =>
      sessions
        .find((s) => s.id === sessionId)
        ?.questions.filter((q) => q.score) || [],
    [sessions, sessionId]
  );

  function isScrolledToBottom(div: HTMLDivElement | null) {
    if (!div) return false;
    if (!hasInitiallyScrolled.current) return true;
    return div.offsetHeight + div.scrollTop + 120 >= div.scrollHeight;
  }

  useLayoutEffect(() => {
    if (
      lastQuestionRef.current &&
      isScrolledToBottom(questionContainerRef.current)
    ) {
      lastQuestionRef.current.scrollIntoView({
        behavior: hasInitiallyScrolled.current ? "smooth" : "instant",
      });
      hasInitiallyScrolled.current = true;
    }
  }, [questions.length]);

  return (
    <ScrollArea
      className="h-full w-full"
      ref={(ref) => {
        if (!ref) return;
        questionContainerRef.current = ref.querySelector(
          '[data-slot="scroll-area-viewport"]'
        );
      }}
    >
      <div className="p-2 sticky -top-[1px] bg-background shadow border-b flex justify-between items-center">
        <TypographyH4 className="text-lg flex gap-2 items-baseline">
          <span>Questions</span>
          <span className="text-muted-foreground">
            {questions.length || undefined}
          </span>
        </TypographyH4>
        {!questions.length ? null : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="size-5"
                children={<Trash2Icon className="text-destructive size-5" />}
              />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all questions?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to permanently permanently delete all
                  the questions
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="justify-center">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive"
                  onClick={() => deleteAllQuestions()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {!questions.length ? (
        <div className="flex flex-col items-center select-none mt-[25%]">
          <SearchXIcon className="size-24 text-primary mb-4" />
          <TypographyH4>No questions found.</TypographyH4>
          <TypographyH4>Start a conversation.</TypographyH4>
        </div>
      ) : (
        <div className="flex flex-col w-full mx-auto p-3 gap-5">
          {questions.map((item, i) => (
            <div
              key={item.id}
              className={cn(
                "w-full p-2 rounded-sm self-end bg-secondary flex gap-2 items-start border shadow-sm"
              )}
              ref={i === questions.length - 1 ? lastQuestionRef : null}
            >
              <BotMessageSquareIcon className="size-5 mt-0.5 text-primary" />
              <p className="flex-1">{item.text}</p>
              <span className="text-muted-foreground flex gap-0.5">
                <span>{item.score || undefined}</span>
                <span>/</span>
                <span>10</span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="size-5 mt-0.5"
                    children={<EllipsisVerticalIcon />}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    className="text-destructive hover:!text-destructive"
                    onClick={() => deleteQuestion(item.id)}
                  >
                    Delete
                    <DropdownMenuShortcut>
                      <TrashIcon className="text-destructive" />
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
