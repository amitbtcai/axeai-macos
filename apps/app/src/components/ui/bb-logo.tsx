import { cn } from "@bb/shared-ui/lib/utils";
import { AxeAiLogoMark } from "@/components/ui/axeai-logo";

/**
 * AxeAI's own mark, for rows where the app is one listed thing among others — beside a
 * provider's logo in Updates, or beside a provider's skills in the tools list.
 * Decorative in every one of those places: the row already names it.
 */
export function BbLogo({ className = "size-4" }: { className?: string }) {
  return (
    <AxeAiLogoMark
      aria-hidden="true"
      className={cn(className, "text-foreground")}
    />
  );
}
