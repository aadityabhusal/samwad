import { cn } from "@/lib/utils";

export function Logo({
  className,
  withText,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <div className="flex gap-2 items-center">
      <img
        src={"/logo.png"}
        alt="Samwad Logo"
        className={cn("w-32 h-32", className)}
      />
      {withText ? <p className="text-2xl">Samwad</p> : null}
    </div>
  );
}
