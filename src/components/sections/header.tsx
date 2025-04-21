import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { KeySquareIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUiConfigStore } from "@/lib/store";
import { Logo } from "@/components/ui/logo";

export function Header() {
  const api_key = useUiConfigStore((s) => s.api_key);
  const setUiConfig = useUiConfigStore((s) => s.setUiConfig);

  return (
    <header className="h-14 flex items-center justify-between border-b p-2">
      <ThemeToggle />
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
