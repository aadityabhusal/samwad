import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { KeySquareIcon, MoonIcon, SunIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUiConfigStore } from "@/lib/store";
import { Logo } from "@/components/ui/logo";
import { useTheme } from "../theme-provider";

export function Header() {
  const { toggleTheme } = useTheme();
  const api_key = useUiConfigStore((s) => s.api_key);
  const setUiConfig = useUiConfigStore((s) => s.setUiConfig);

  return (
    <header className="h-14 flex items-center justify-between border-b p-2">
      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        <SunIcon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
      <Logo className="w-8 h-8" withText />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" children={<KeySquareIcon />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <Input
            autoFocus
            value={api_key}
            onChange={(e) => setUiConfig({ api_key: e.target.value })}
            type="password"
            placeholder="Enter API key"
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
