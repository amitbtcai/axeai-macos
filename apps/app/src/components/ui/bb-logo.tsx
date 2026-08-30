import { cn } from "@bb/shared-ui/lib/utils";
import { AxeAiLogoMark } from "@/components/ui/axeai-logo";

export function BbLogo({ className = "size-4" }: { className?: string }) {
  return (
    <AxeAiLogoMark
      aria-hidden="true"
      className={cn(className, "text-foreground")}
    />
  );
}
