import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpRight01Icon,
  GithubIcon,
  MoreHorizontalIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { MAX_PER_ACCOUNT } from "@bb/connect-db";
import type { HandleValidationError, LabelAvailability } from "@bb/connect-db";
import appCss from "../styles.css?url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  checkAvailabilityFn,
  claimHandleFn,
  createCodeFn,
  createServerRowFn,
  disconnectFn,
  removeServerFn,
  revokeMachineFn,
  getDashboard,
} from "@/server/fns";
import type { IssuedCode, MachineSummary, ServerSummary } from "@/server/api";
import { DASHBOARD_PATH, connectReturnTo } from "@/lib/connect-return-to";
import {
  dashboardRefreshIntervalMs,
  visibleServerPanel,
  type ServerPanel,
} from "@/lib/dashboard-live-state";

interface DashboardSearch {
  returnTo?: string;
}

// Absent means absent: never surface the literal strings "null"/"undefined" (or
// empty) as a return target, and omit the key entirely when there is none so the
// router never re-serializes `?returnTo=null` back into the URL.
function validateDashboardSearch(
  search: Record<string, unknown>,
): DashboardSearch {
  const raw = search.returnTo;
  if (
    typeof raw === "string" &&
    raw !== "" &&
    raw !== "null" &&
    raw !== "undefined"
  ) {
    return { returnTo: raw };
  }
  return {};
}

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "AxeAI Remote Access" }],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  validateSearch: validateDashboardSearch,
  loader: () => getDashboard(),
  component: Home,
});

type ServerState = Extract<
  ReturnType<typeof Route.useLoaderData>,
  { authed: true }
>;

/* ── layout shell ─────────────────────────────────────────────────── */

function AxeAiLockup({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 714 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Axe AI"
      className={className}
    >
      <g transform="scale(0.761905)" color="currentColor">
        <path d="M97.1923 0.128124L196.375 164.224C196.545 164.505 196.159 164.786 195.947 164.536L97.1036 47.7897C96.9985 47.6655 96.8084 47.6646 96.7021 47.7878L68.7241 80.2122C68.5317 80.4351 68.1757 80.2248 68.2748 79.9469L96.7167 0.176713C96.792 -0.0344117 97.0765 -0.0634694 97.1923 0.128124Z" fill="currentColor" />
        <path d="M196.128 167.965L0.265052 168C-0.0615031 168 -0.0989738 167.521 0.223566 167.469L153.138 143.075C153.305 143.049 153.404 142.874 153.344 142.716L138.868 104.828C138.762 104.553 139.113 104.334 139.311 104.552L196.324 167.518C196.479 167.69 196.358 167.965 196.128 167.965Z" fill="currentColor" />
        <path d="M0.0463391 165.242L94.1125 0.500409C94.2762 0.213784 94.7089 0.423656 94.5886 0.731324L38.778 143.501C38.7144 143.663 38.8206 143.842 38.9929 143.863L83.2019 149.225C83.5024 149.262 83.517 149.695 83.2197 149.752L0.325476 165.638C0.102957 165.68 -0.066612 165.44 0.0463391 165.242Z" fill="currentColor" />
      </g>
      <g transform="translate(190 0)" color="currentColor">
        <path d="M118.551 128H101.977L88.3284 92.5091H30.0278L16.3788 128H0L50.1113 0H68.6349L118.551 128ZM35.6823 77.9636H82.6738L59.0806 14.9333L35.6823 77.9636Z" fill="currentColor" />
        <path d="M224.94 128H207.001L172.099 75.2485L137.002 128H118.868L163.91 62.8364L122.768 0H141.096L173.659 49.8424L206.611 0H223.575L181.848 62.0606L224.94 128Z" fill="currentColor" />
        <path d="M246.308 128V0H336.586V14.5455H261.907V55.8545H320.012V70.4H261.907V113.455H339.511V128H246.308Z" fill="currentColor" />
        <path d="M487.316 128H470.742L457.093 92.5091H398.792L385.143 128H368.764L418.876 0H437.399L487.316 128ZM404.447 77.9636H451.438L427.845 14.9333L404.447 77.9636Z" fill="currentColor" />
        <path d="M523.223 0V128H507.625V0H523.223Z" fill="currentColor" />
      </g>
    </svg>
  );
}

function BrandRow() {
  return (
    <div className="mb-6 flex flex-col items-center justify-center gap-2.5 text-center">
      <AxeAiLockup className="h-7 w-auto text-[#060AE6]" />
      <div className="leading-tight">
        <b className="block text-base font-medium tracking-[-0.025em]">
          AxeAI Remote Access
        </b>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Your AxeAI workspace, reachable anywhere
        </span>
      </div>
    </div>
  );
}

const SHELL_WIDTH = {
  sm: "max-w-[430px]",
  md: "max-w-[480px]",
  lg: "max-w-[530px]",
} as const;

function Shell({
  children,
  footer,
  top = false,
  width = "sm",
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  top?: boolean;
  width?: keyof typeof SHELL_WIDTH;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col px-5 pb-20 sm:px-8",
        top ? "justify-start pt-14" : "justify-center pt-16",
      )}
    >
      <div className={cn("mx-auto w-full", SHELL_WIDTH[width])}>
        <BrandRow />
        {children}
        {footer}
      </div>
    </main>
  );
}

function WebCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-card p-5 ring-1 ring-border/70 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── small primitives ─────────────────────────────────────────────── */

function StatusDot({ state }: { state: "online" | "offline" | "new" }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        state === "online" && "bg-success",
        state === "offline" && "bg-warning",
        state === "new" &&
          "border border-dashed border-subtle-foreground bg-transparent",
      )}
    />
  );
}

function Spinner() {
  return (
    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-border border-t-subtle-foreground" />
  );
}

function CopyButton({
  text,
  label = "Copy",
  disabled,
}: {
  text: string;
  label?: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => {
        // Copy has a failure path: locked-down / insecure contexts reject the
        // write, so fall back to asking the user to press ⌘C instead of
        // silently doing nothing.
        navigator.clipboard.writeText(text).then(
          () => {
            setState("copied");
            setTimeout(() => setState("idle"), 1400);
          },
          () => {
            setState("manual");
            setTimeout(() => setState("idle"), 2500);
          },
        );
      }}
    >
      {state === "copied" ? "Copied" : state === "manual" ? "Press ⌘C" : label}
    </Button>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2.5 rounded-lg border border-surface-destructive-border bg-surface-destructive px-3 py-2 text-xs text-destructive-text">
      {children}
    </p>
  );
}

function BigCode({ code, disabled }: { code: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-dashed border-border bg-surface-recessed px-4 py-3.5">
      <code className="select-all font-mono text-2xl font-semibold tracking-[0.18em]">
        {code}
      </code>
      <CopyButton text={code} disabled={disabled} />
    </div>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-scrim p-4"
      onClick={onClose}
    >
      <div
        className="w-[430px] max-w-full rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function GithubMark() {
  return <HugeiconsIcon icon={GithubIcon} className="size-4" aria-hidden />;
}

/* ── formatting + copy ────────────────────────────────────────────── */

function relativeTime(ms: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function minutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60000));
}

function grammarCopy(err: HandleValidationError): string {
  switch (err) {
    case "too-short":
      return "At least 3 characters.";
    case "too-long":
      return "At most 30 characters.";
    case "reserved":
      return "That name is reserved. Pick another.";
    default:
      return "Lowercase letters, numbers, and dashes only.";
  }
}

function availabilityCopy(a: LabelAvailability): string | null {
  if (a.available) return null;
  if (a.reason === "taken")
    return "That address is already taken. Pick another.";
  return grammarCopy(a.error);
}

function claimErrorCopy(err: string, max: number): string {
  switch (err) {
    case "already-claimed":
      return "You've already claimed an address on this account.";
    case "server-limit":
      return `You've reached the limit of ${max} AxeAI workspaces. Disconnect one to add another.`;
    case "taken":
      return "That address is already taken. Pick another.";
    case "no-handle":
      return "Claim your account address first.";
    case "too-short":
    case "too-long":
    case "reserved":
    case "invalid-format":
      return grammarCopy(err);
    default:
      return "Could not claim that address. Try another.";
  }
}

/* ── auth actions ─────────────────────────────────────────────────── */

async function signInWithGithub(returnTo: string | undefined) {
  const callbackURL =
    connectReturnTo(returnTo, window.location.origin) ?? DASHBOARD_PATH;
  const res = await fetch("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "github", callbackURL }),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string };
  if (data.url) window.location.href = data.url;
}

type EmailAuthMode = "sign-in" | "sign-up";

function authResponseMessage(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("message" in value) || typeof value.message !== "string") return null;
  return value.message;
}

async function authenticateWithEmail(input: {
  email: string;
  mode: EmailAuthMode;
  name: string;
  password: string;
}): Promise<string | null> {
  const body =
    input.mode === "sign-up"
      ? { email: input.email, name: input.name, password: input.password }
      : { email: input.email, password: input.password };
  const response = await fetch(`/api/auth/${input.mode}/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody: unknown = await response.json().catch(() => null);
  if (response.ok) return null;
  return authResponseMessage(responseBody) ?? "Could not authenticate";
}

async function signOut() {
  // better-auth requires the JSON content-type (else 415) and a JSON body
  // (an empty body makes it 500); the browser supplies the Origin it checks.
  await fetch("/api/auth/sign-out", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  window.location.href = "/dashboard";
}

/* ── root ─────────────────────────────────────────────────────────── */

function Home() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();

  useEffect(() => {
    if (!data.authed) return;
    const returnTo = connectReturnTo(search.returnTo, window.location.origin);
    if (returnTo) window.location.assign(returnTo);
  }, [data.authed, search.returnTo]);

  if (!data.authed)
    return (
      <SignInView
        emailPasswordEnabled={data.emailPasswordEnabled}
        returnTo={search.returnTo}
      />
    );
  if (!data.handle)
    return <ClaimView serverUrlTemplate={data.serverUrlTemplate} />;
  return <AccountDashboard state={data} />;
}

/* ── W1: sign in ──────────────────────────────────────────────────── */

function SignInView({
  emailPasswordEnabled,
  returnTo,
}: {
  emailPasswordEnabled: boolean;
  returnTo: string | undefined;
}) {
  const [mode, setMode] = useState<EmailAuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (mode === "sign-up" && !trimmedName) {
      setError("Enter your name");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const authError = await authenticateWithEmail({
        email: email.trim(),
        mode,
        name: trimmedName,
        password,
      });
      if (authError) {
        setError(authError);
        return;
      }
      window.location.href =
        connectReturnTo(returnTo, window.location.origin) ?? DASHBOARD_PATH;
    } catch {
      setError("Could not reach the authentication service");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <WebCard>
        <h3 className="text-2xl font-normal tracking-[-0.035em]">Sign in</h3>
        <p className="mt-2 mb-5 text-sm leading-6 text-muted-foreground">
          Give your AxeAI app a private URL and control it from any browser.
          Your code and data stay on your machine.
        </p>
        {emailPasswordEnabled ? (
          <>
            <form
              className="space-y-3"
              onSubmit={(event) => void submitEmail(event)}
            >
              {mode === "sign-up" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name">Name</Label>
                  <Input
                    id="auth-name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={
                    mode === "sign-up" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  minLength={8}
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                className="w-full justify-center py-[11px]"
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? "Working…"
                  : mode === "sign-up"
                    ? "Create local account"
                    : "Sign in with email"}
              </Button>
            </form>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {mode === "sign-in"
                ? "New to this local Cloud?"
                : "Already registered?"}{" "}
              <button
                className="font-medium text-foreground underline-offset-2 hover:underline"
                type="button"
                disabled={submitting}
                onClick={() => {
                  setError(null);
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                }}
              >
                {mode === "sign-in" ? "Create an account" : "Sign in"}
              </button>
            </p>
            <div className="my-4 flex items-center gap-3 text-xs text-subtle-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}
        <Button
          className="h-12 w-full justify-center rounded-2xl px-4 text-sm font-medium"
          type="button"
          onClick={() => void signInWithGithub(returnTo)}
        >
          <GithubMark />
          Continue with GitHub
        </Button>
        <p className="mt-4 text-center text-[11px] text-subtle-foreground">
          Up to {MAX_PER_ACCOUNT} servers per account
        </p>
      </WebCard>
    </Shell>
  );
}

/* ── shared claim field (W2 handle + M2 label) ────────────────────── */

function ClaimField({
  serverUrlTemplate,
  initial = "",
  autoFocus,
  previewLead = "Your AxeAI app will live at",
  buildSubmitLabel,
  onClaim,
  onCancel,
  cancelLabel = "Cancel",
  layout,
}: {
  serverUrlTemplate: string;
  initial?: string;
  autoFocus?: boolean;
  previewLead?: string;
  buildSubmitLabel: (label: string) => string;
  onClaim: (label: string) => Promise<string | null>;
  onCancel?: () => void;
  cancelLabel?: string;
  layout: "card" | "dialog";
}) {
  const [value, setValue] = useState(initial);
  const [avail, setAvail] = useState<LabelAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const label = value.trim().toLowerCase();

  useEffect(() => {
    setSubmitError(null);
    if (!label) {
      setAvail(null);
      return;
    }
    let cancelled = false;
    setAvail(null);
    const t = setTimeout(() => {
      void checkAvailabilityFn({ data: label }).then((r) => {
        if (cancelled) return;
        setAvail("available" in r ? r : null);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [label]);

  const error = submitError ?? (avail ? availabilityCopy(avail) : null);
  const canSubmit = !busy && !!label && (avail?.available ?? false);
  const preview = serverUrlTemplate.replace("{label}", label || "you");
  const addressSuffix = serverUrlTemplate.split("{label}")[1] ?? "";

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    const err = await onClaim(label);
    setBusy(false);
    if (err) setSubmitError(err);
  }

  const submitButton = (
    <Button
      disabled={!canSubmit}
      onClick={() => void submit()}
      className={
        layout === "card" ? "w-full justify-center py-[11px]" : undefined
      }
    >
      {busy ? "Claiming…" : buildSubmitLabel(label)}
    </Button>
  );

  return (
    <div>
      <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card focus-within:ring-1 focus-within:ring-ring">
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus */}
        <input
          value={value}
          autoFocus={autoFocus}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-sm outline-none placeholder:text-subtle-foreground"
          placeholder="your-axeai"
          aria-label="Address"
        />
        <span className="pr-3 font-mono text-sm text-subtle-foreground">
          {addressSuffix}
        </span>
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">
        {previewLead}{" "}
        <code className="font-mono text-foreground">{preview}</code>
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      {layout === "card" ? (
        <div className="mt-3.5">{submitButton}</div>
      ) : (
        <div className="mt-3.5 flex justify-end gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          {submitButton}
        </div>
      )}
    </div>
  );
}

/* ── W2: claim handle ─────────────────────────────────────────────── */

function ClaimView({ serverUrlTemplate }: { serverUrlTemplate: string }) {
  const router = useRouter();
  return (
    <Shell>
      <WebCard>
        <h3 className="text-[17px] font-semibold tracking-tight">
          Pick your address
        </h3>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          This becomes your AxeAI app&rsquo;s permanent URL. Lowercase letters,
          numbers, and dashes.
        </p>
        <ClaimField
          layout="card"
          serverUrlTemplate={serverUrlTemplate}
          buildSubmitLabel={(l) =>
            l
              ? `Claim ${serverUrlTemplate.replace("{label}", l).replace(/^https?:\/\//u, "")}`
              : "Claim your address"
          }
          onClaim={async (label) => {
            const r = await claimHandleFn({ data: label });
            if ("ok" in r) {
              await router.invalidate();
              return null;
            }
            return claimErrorCopy(r.error, MAX_PER_ACCOUNT);
          }}
        />
      </WebCard>
    </Shell>
  );
}

/* ── setup-mode code panel (W2b first-run + M2 beat 2) ────────────── */

function SetupCodePanel({
  serverId,
  waitingText,
  compact,
}: {
  serverId: string | undefined;
  waitingText: string;
  /** Drop the top divider above the waiting line when already inside a box (dialog / inline panel). */
  compact?: boolean;
}) {
  const [code, setCode] = useState<IssuedCode | null>(null);
  const [showCli, setShowCli] = useState(false);

  const fetchCode = useCallback(async () => {
    const r = await createCodeFn({ data: { serverId, reuse: true } });
    if ("code" in r) setCode(r);
  }, [serverId]);

  useEffect(() => {
    void fetchCode();
  }, [fetchCode]);

  // Re-mint in place when the shown code expires.
  useEffect(() => {
    if (!code) return;
    const t = setTimeout(
      () => void fetchCode(),
      Math.max(1000, code.expiresInMs),
    );
    return () => clearTimeout(t);
  }, [code, fetchCode]);

  const cli = code
    ? `npx -p bb-app@latest bb connect --code ${code.code} --server ${code.serverUrl}`
    : "";

  return (
    <div>
      <BigCode code={code?.code ?? "····–····"} disabled={!code} />
      <p className="mt-2.5 text-xs text-subtle-foreground">
        Paste in{" "}
        <span className="font-medium text-foreground">Plugins → connect</span>{" "}
        in your AxeAI app{" · "}
        <button
          className="text-foreground underline underline-offset-2 hover:text-muted-foreground"
          onClick={() => setShowCli((v) => !v)}
        >
          using a terminal?
        </button>
      </p>
      {showCli && code && (
        <div className="mt-2.5 flex flex-col gap-2">
          <pre className="overflow-x-auto whitespace-nowrap rounded-lg border border-border bg-surface-recessed px-3 py-2.5 font-mono text-xs leading-relaxed">
            {cli}
          </pre>
          <div>
            <CopyButton text={cli} label="Copy command" />
          </div>
        </div>
      )}
      <div
        className={cn(
          "mt-4 flex items-center gap-2.5 text-sm text-muted-foreground",
          !compact && "border-t border-border pt-3.5",
        )}
      >
        <Spinner />
        {waitingText}
      </div>
    </div>
  );
}

/* ── re-pair code disclosure ──────────────────────────────────────── */

function RepairCodeBlock({ serverId }: { serverId: string }) {
  const [code, setCode] = useState<IssuedCode | null>(null);
  useEffect(() => {
    // "Pair again" always mints fresh (reuse: false).
    void createCodeFn({ data: { serverId, reuse: false } }).then((r) => {
      if ("code" in r) setCode(r);
    });
  }, [serverId]);
  return (
    <div>
      <BigCode code={code?.code ?? "····–····"} disabled={!code} />
      <p className="mt-2.5 text-xs text-subtle-foreground">
        Re-pairing replaces this AxeAI app&rsquo;s credential. Paste in{" "}
        <span className="font-medium text-foreground">Plugins → connect</span>
        {code ? ` · expires in ${minutes(code.expiresInMs)} min` : ""}
      </p>
    </div>
  );
}

/* ── disconnect / remove confirm ──────────────────────────────────── */

function ConfirmServerAction({
  server,
  mode,
  onCancel,
}: {
  server: ServerSummary;
  /** "disconnect" revokes a live credential (row survives); "remove" deletes a never-paired row. */
  mode: "disconnect" | "remove";
  onCancel: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    if (mode === "remove") {
      await removeServerFn({ data: { serverId: server.id } });
    } else {
      await disconnectFn({ data: { serverId: server.id } });
    }
    await router.invalidate();
    setBusy(false);
    onCancel();
  }
  const removing = mode === "remove";
  return (
    <Overlay onClose={onCancel}>
      <h4 className="mb-1.5 text-[15px] font-semibold">
        {removing ? "Remove this address?" : "Disconnect your AxeAI app?"}
      </h4>
      <p className="mb-4 text-sm text-muted-foreground">
        <b className="font-semibold text-foreground">
          {server.serverUrl.replace(/^https?:\/\//, "")}
        </b>{" "}
        {removing
          ? "is freed up and can be claimed again. It was never paired, so nothing stops working."
          : "stops working on all devices immediately. AxeAI keeps running locally; re-pairing needs a new connect code."}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={() => void go()} disabled={busy}>
          {busy
            ? removing
              ? "Removing…"
              : "Disconnecting…"
            : removing
              ? "Remove"
              : "Disconnect"}
        </Button>
      </div>
    </Overlay>
  );
}

/* ── row overflow menu ────────────────────────────────────────────── */

function RowMenu({
  items,
}: {
  items: { label: string; danger?: boolean; onSelect: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative justify-self-center">
      <button
        className={cn(
          "flex h-[26px] w-[26px] items-center justify-center rounded-md text-subtle-foreground hover:bg-state-hover hover:text-foreground",
          open && "bg-state-hover text-foreground",
        )}
        aria-label="More"
        onClick={(e) => {
          // The row is a link / click target; keep the button's own click from
          // navigating or toggling the row's panel.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute right-0 top-8 z-20 min-w-[210px] rounded-[10px] border border-border bg-popover p-1 text-left shadow-lg">
            {items.map((item, i) => (
              <button
                key={i}
                className={cn(
                  "block w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-state-hover",
                  item.danger &&
                    "text-destructive-text hover:bg-surface-destructive",
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── server row — one row per bb, the row is the link ─────────────── */

function ServerRow({
  server,
  autoPair,
}: {
  server: ServerSummary;
  /** First-run: the sole never-paired bb opens its pair panel by default. */
  autoPair?: boolean;
}) {
  // A connected row toggles the re-pair panel; a never-paired row toggles its
  // setup panel. `panel` tracks which (if any) is showing under this row.
  const [panel, setPanel] = useState<ServerPanel>(
    autoPair && !server.connected ? "setup" : "none",
  );
  const [confirm, setConfirm] = useState<"disconnect" | "remove" | null>(null);
  const visiblePanel = visibleServerPanel(server.connected, panel);

  const url = server.serverUrl;
  const copyUrl = () => void navigator.clipboard.writeText(url).catch(() => {});

  const dot = server.online ? "online" : server.connected ? "offline" : "new";
  const menuItems = server.connected
    ? [
        { label: "Copy URL", onSelect: copyUrl },
        {
          label: "Pair again…",
          onSelect: () => setPanel((p) => (p === "repair" ? "none" : "repair")),
        },
        {
          label: "Disconnect…",
          danger: true,
          onSelect: () => setConfirm("disconnect"),
        },
      ]
    : [
        { label: "Copy URL", onSelect: copyUrl },
        // The primary bb (subdomain === handle) is the account's identity and
        // can't be removed; only never-paired secondaries offer Remove.
        ...(server.isPrimary
          ? []
          : [
              {
                label: "Remove…",
                danger: true,
                onSelect: () => setConfirm("remove"),
              },
            ]),
      ];

  const content = (
    <>
      <span className="flex justify-center">
        <StatusDot state={dot} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-sm font-medium leading-tight">
          {server.serverUrl.replace(/^https?:\/\//u, "")}
        </span>
        <span className="mt-px block text-xs text-muted-foreground">
          {server.online ? (
            "Online"
          ) : server.connected ? (
            <>
              <span className="text-warning-text">Offline</span>
              {server.lastSeenAt != null
                ? ` · last seen ${relativeTime(server.lastSeenAt)}`
                : ""}
            </>
          ) : (
            <>
              Not set up ·{" "}
              <span className="text-foreground underline underline-offset-2">
                {visiblePanel === "setup" ? "hide code" : "get connect code"}
              </span>
            </>
          )}
        </span>
      </span>
      {server.connected ? (
        <span
          className="justify-self-center text-subtle-foreground"
          aria-hidden
        >
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
        </span>
      ) : (
        <span aria-hidden />
      )}
      <RowMenu items={menuItems} />
    </>
  );

  const rowClass =
    "grid grid-cols-[14px_1fr_26px_26px] items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-state-hover";

  return (
    <>
      {server.connected ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={cn(rowClass, "cursor-pointer")}
        >
          {content}
        </a>
      ) : (
        <div
          className={cn(rowClass, "cursor-pointer")}
          role="button"
          tabIndex={0}
          onClick={() => setPanel((p) => (p === "setup" ? "none" : "setup"))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setPanel((p) => (p === "setup" ? "none" : "setup"));
            }
          }}
        >
          {content}
        </div>
      )}

      {visiblePanel !== "none" && (
        <div className="mb-2 ml-9 mr-2 rounded-[10px] border border-border bg-surface-recessed p-3.5">
          {visiblePanel === "setup" ? (
            <SetupCodePanel
              serverId={server.id}
              compact
              waitingText="Waiting for it to connect… this page updates automatically."
            />
          ) : (
            <RepairCodeBlock serverId={server.id} />
          )}
        </div>
      )}

      {confirm && (
        <ConfirmServerAction
          server={server}
          mode={confirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/* ── M2: connect another bb dialog ────────────────────────────────── */

function ConnectAnotherDialog({
  state,
  onClose,
  onServerCreated,
}: {
  state: ServerState;
  onClose: () => void;
  onServerCreated: (serverId: string) => void;
}) {
  const [server, setServer] = useState<ServerSummary | null>(null);
  const atCap = state.servers.length >= state.maxServers;

  if (atCap && !server) {
    return (
      <Overlay onClose={onClose}>
        <h4 className="mb-1.5 text-[15px] font-semibold">
          Connect another AxeAI app
        </h4>
        <p className="mb-4 text-sm text-muted-foreground">
          You&rsquo;ve reached the limit of {state.maxServers} AxeAI apps on
          this account. Disconnect one to add another.
        </p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      {!server ? (
        <>
          <h4 className="mb-1.5 text-[15px] font-semibold">
            Connect another AxeAI app
          </h4>
          <p className="mb-3 text-sm text-muted-foreground">
            Pick its address — every AxeAI app gets its own URL.
          </p>
          <ClaimField
            layout="dialog"
            autoFocus
            serverUrlTemplate={state.serverUrlTemplate}
            initial={`${state.handle}-desktop`}
            previewLead="This AxeAI app will live at"
            buildSubmitLabel={(l) => `Claim ${l || "…"}`}
            onCancel={onClose}
            onClaim={async (label) => {
              const r = await createServerRowFn({ data: label });
              if ("ok" in r) {
                setServer(r.server);
                onServerCreated(r.server.id);
                return null;
              }
              return claimErrorCopy(r.error, state.maxServers);
            }}
          />
        </>
      ) : (
        <>
          <h4 className="mb-1.5 text-[15px] font-semibold">
            Pair the new AxeAI app
          </h4>
          <p className="mb-2.5 text-sm text-muted-foreground">
            <code className="font-mono text-xs text-foreground">
              {server.serverUrl.replace(/^https?:\/\//u, "")}
            </code>{" "}
            is reserved for it.
          </p>
          <SetupCodePanel
            serverId={server.id}
            compact
            waitingText="Waiting for it to connect… this dialog closes itself."
          />
          <div className="mt-3.5 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Do this later
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
}

/* ── footer ───────────────────────────────────────────────────────── */

function AccountFooter({ state }: { state: ServerState }) {
  const gh = state.githubLogin
    ? `https://github.com/${state.githubLogin}`
    : undefined;
  const cap =
    state.servers.length >= 2
      ? ` · ${state.servers.length} of ${state.maxServers} AxeAI apps`
      : "";
  return (
    <div className="mt-3.5 flex items-center justify-between text-xs">
      <button
        className="text-subtle-foreground hover:text-foreground"
        onClick={() => void signOut()}
      >
        Sign out
      </button>
      {gh ? (
        <a
          className="text-subtle-foreground hover:text-foreground"
          href={gh}
          target="_blank"
          rel="noreferrer"
        >
          {state.handle} · GitHub{cap}
        </a>
      ) : (
        <span className="text-subtle-foreground">
          {state.handle} · GitHub{cap}
        </span>
      )}
    </div>
  );
}

/* ── account dashboard — one list for 1..N bbs ────────────────────── */

function AccountDashboard({ state }: { state: ServerState }) {
  const router = useRouter();
  const [connectOpen, setConnectOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const single = state.servers.length === 1;
  const refreshIntervalMs = dashboardRefreshIntervalMs(
    state.servers,
    pendingId,
  );

  useEffect(() => {
    const id = setInterval(() => void router.invalidate(), refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs, router]);

  // Self-close the connect dialog once the new server pairs.
  useEffect(() => {
    if (pendingId == null) return;
    if (
      state.servers.find((s: ServerSummary) => s.id === pendingId)?.connected
    ) {
      setConnectOpen(false);
      setPendingId(null);
    }
  }, [state.servers, pendingId]);

  const dialog = connectOpen && (
    <ConnectAnotherDialog
      state={state}
      onClose={() => {
        setConnectOpen(false);
        setPendingId(null);
        // A claim may have created a still-offline row; refetch so the list
        // reflects it (e.g. after "Do this later").
        void router.invalidate();
      }}
      onServerCreated={(id) => setPendingId(id)}
    />
  );
  const manageServer =
    state.servers.find((server: ServerSummary) => server.online) ??
    state.servers[0] ??
    null;

  async function revoke(machine: MachineSummary) {
    await revokeMachineFn({ data: machine.id });
    await router.invalidate();
  }

  return (
    <Shell top width="md" footer={<AccountFooter state={state} />}>
      {/* Tight padding so each row is a full-bleed, rounded hover target. */}
      <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="flex items-center px-1.5 pb-1.5 pl-3 pt-1.5">
          <h3 className="flex-1 text-[17px] font-semibold tracking-tight">
            Your AxeAI apps
          </h3>
          <button
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-recessed hover:text-foreground"
            onClick={() => setConnectOpen(true)}
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-3" />
            Add an AxeAI app
          </button>
        </div>
        {state.servers.map((s: ServerSummary) => (
          <ServerRow key={s.id} server={s} autoPair={single} />
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="flex items-center px-3 pb-1.5 pt-1.5">
          <h3 className="flex-1 text-[15px] font-semibold tracking-tight">
            Machines
          </h3>
          {manageServer !== null ? (
            <a
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-recessed hover:text-foreground"
              href={`${manageServer.serverUrl}/settings/machines`}
            >
              Manage machines in AxeAI
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
            </a>
          ) : null}
        </div>
        {state.machines.length === 0 ? (
          <p className="px-3 pb-2 text-xs text-subtle-foreground">
            Add machines from AxeAI Settings → Machines.
          </p>
        ) : (
          state.machines.map((machine: MachineSummary) => {
            const machineName =
              machine.name ?? `Machine ${machine.id.slice(0, 8)}`;
            return (
              <div
                key={machine.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              >
                <StatusDot
                  state={
                    machine.lastSeenAt === null
                      ? "new"
                      : machine.online
                        ? "online"
                        : "offline"
                  }
                />
                <span className="min-w-0 flex-1">
                  {machine.subdomain !== null ? (
                    <span className="block truncate font-mono text-sm font-medium leading-tight">
                      {state.serverUrlTemplate
                        .replace("{label}", machine.subdomain)
                        .replace(/^https?:\/\//u, "")}
                    </span>
                  ) : (
                    <span className="block truncate text-sm font-medium leading-tight">
                      {machineName}
                    </span>
                  )}
                  <span className="mt-px block truncate text-xs text-muted-foreground">
                    {machine.online ? (
                      "Online"
                    ) : machine.lastSeenAt !== null ? (
                      <>
                        <span className="text-warning-text">Offline</span>
                        {` · last seen ${relativeTime(machine.lastSeenAt)}`}
                      </>
                    ) : (
                      "Never connected"
                    )}
                    {machine.subdomain !== null && machine.name !== null
                      ? ` · ${machine.name}`
                      : ""}
                  </span>
                </span>
                <button
                  className="text-xs text-destructive-text hover:underline"
                  onClick={() => void revoke(machine)}
                >
                  Revoke
                </button>
              </div>
            );
          })
        )}
      </div>
      {dialog}
    </Shell>
  );
}
