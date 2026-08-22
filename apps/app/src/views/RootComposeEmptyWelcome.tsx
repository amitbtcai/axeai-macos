import { Icon, type IconName } from "@bb/shared-ui/icon";
import { AxeAiLogoLockup } from "@/components/ui/axeai-logo";
import { useNavigate } from "react-router-dom";

interface RootComposeEmptyWelcomeProps {
  onCompose: (prompt?: string) => void;
}

interface StarterAction {
  icon: IconName;
  prompt?: string;
  route?: string;
  title: string;
}

const STARTER_ACTIONS: readonly StarterAction[] = [
  {
    icon: "Puzzle",
    title: "Explore Plugins",
    route: "/extensions/plugins?view=browse",
  },
  {
    icon: "Explore",
    title: "Explore Skills",
    route: "/extensions/skills?view=browse",
  },
  {
    icon: "TimeSchedule",
    title: "Create an automation",
    prompt:
      "Identify useful recurring work in this project and help me create an Axe AI automation for it.",
  },
  {
    icon: "SecurityCheck",
    title: "Review this project",
    prompt:
      "Review this project for important failures, risks, and quality improvements, then help me address them.",
  },
];

function StarterCard({
  icon,
  prompt,
  title,
  onCompose,
  route,
}: StarterAction & Pick<RootComposeEmptyWelcomeProps, "onCompose">) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        if (route) {
          navigate(route);
          return;
        }
        onCompose(prompt);
      }}
      className="group flex min-h-14 items-center gap-3 rounded-xl bg-surface-raised-solid px-4 py-3 text-left transition-colors hover:bg-state-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-recessed text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon name={icon} aria-hidden className="size-4" />
      </span>
      <span className="text-sm font-medium leading-none text-foreground">
        {title}
      </span>
    </button>
  );
}

export function RootComposeEmptyWelcome({
  onCompose,
}: RootComposeEmptyWelcomeProps) {
  return (
    <section className="flex w-full flex-col items-center px-2 duration-500 animate-in fade-in-0 slide-in-from-bottom-2">
      <AxeAiLogoLockup
        role="img"
        aria-label="Axe AI"
        className="h-auto w-32 select-none text-foreground"
      />
      <div className="mt-7 grid w-full max-w-[620px] grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTER_ACTIONS.map((action) => (
          <StarterCard key={action.title} {...action} onCompose={onCompose} />
        ))}
      </div>
    </section>
  );
}
