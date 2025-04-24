import { cn } from "@/lib/utils";

export function DotsLoader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn(`flex items-center space-x-1`, className)} {...props}>
      <span className="block w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.32s]"></span>
      <span className="block w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.16s]"></span>
      <span className="block w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
    </div>
  );
}
