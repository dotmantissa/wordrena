"use client";

import { useCallback, useState } from "react";
import { LogIn, LogOut, Mail, ShieldCheck, X } from "lucide-react";
import { useLoginWithEmail } from "@privy-io/react-auth";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useWordrenaAuth } from "./AuthProvider";

export function AuthButton({ compact = false }: { compact?: boolean }) {
  const { authenticated, ready, syncing, user, logout } = useWordrenaAuth();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");

  const start = useCallback(() => {
    setError("");
    setCode("");
    setCodeSent(false);
    setOpen(true);
  }, []);

  const submitEmail = useCallback(async () => {
    setError("");
    try {
      await sendCode({ email: email.trim() });
      setCodeSent(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Wordrena could not send the sign in code"
      );
    }
  }, [email, sendCode]);

  const submitCode = useCallback(async () => {
    setError("");
    try {
      await loginWithCode({ code: code.trim() });
      setOpen(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "That code could not be verified"
      );
    }
  }, [code, loginWithCode]);

  if (syncing) {
    return (
      <Button variant="secondary" disabled aria-label="Checking your session">
        <Spinner />
        {compact ? null : "Checking the gate"}
      </Button>
    );
  }

  if (authenticated && user) {
    return (
      <Button
        variant="quiet"
        onClick={() => void logout()}
        title={`Signed in as ${user.email}`}
      >
        <LogOut className="size-4" />
        {compact ? null : "Sign out"}
      </Button>
    );
  }

  return (
    <>
      <Button onClick={start}>
        <LogIn className="size-4" />
        Sign in with email
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-login-title"
        >
          <div className="w-full max-w-md border border-line-strong bg-surface p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
                  Trainer access
                </p>
                <h2
                  id="email-login-title"
                  className="mt-2 font-display text-2xl font-bold text-parch"
                >
                  Enter the arena
                </h2>
              </div>
              <button
                type="button"
                className="grid size-9 place-items-center text-ink-soft hover:text-parch"
                onClick={() => setOpen(false)}
                aria-label="Close email sign in"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-ink-soft">
              {codeSent
                ? `We sent a six digit code to ${email.trim()}.`
                : "Use your email. Your creatures will know it is you."}
            </p>

            <div className="mt-6 grid gap-4">
              {!codeSent ? (
                <label className="grid gap-2 text-sm font-semibold text-parch">
                  Email address
                  <div className="flex items-center gap-3 border border-line-strong bg-bg px-3">
                    <Mail className="size-4 shrink-0 text-gold" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                      className="min-h-12 w-full bg-transparent text-sm text-parch outline-none placeholder:text-ink-faint"
                    />
                  </div>
                </label>
              ) : (
                <label className="grid gap-2 text-sm font-semibold text-parch">
                  Sign in code
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                    placeholder="123456"
                    autoComplete="one-time-code"
                    autoFocus
                    className="min-h-12 border border-line-strong bg-bg px-3 font-mono text-lg tracking-[0.35em] text-parch outline-none placeholder:text-ink-faint"
                  />
                </label>
              )}

              {error ? (
                <p className="border border-ember/30 bg-ember/10 px-3 py-3 text-sm leading-5 text-ember">
                  {error}
                </p>
              ) : null}

              {!ready ? (
                <p className="flex items-center gap-2 text-xs text-ink-faint">
                  <Spinner />
                  Connecting to the email service
                </p>
              ) : null}

              <Button
                type="button"
                onClick={() => void (codeSent ? submitCode() : submitEmail())}
                disabled={
                  !ready ||
                  state.status === "sending-code" ||
                  state.status === "submitting-code" ||
                  (codeSent ? code.trim().length !== 6 : !email.trim())
                }
              >
                {state.status === "sending-code" ||
                state.status === "submitting-code" ? (
                  <Spinner />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {codeSent ? "Verify code" : "Send code"}
              </Button>

              {codeSent ? (
                <button
                  type="button"
                  className="text-left text-xs text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-parch"
                  onClick={() => {
                    setCode("");
                    setError("");
                    setCodeSent(false);
                  }}
                >
                  Use a different email
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
