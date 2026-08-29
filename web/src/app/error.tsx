"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <WifiOff className="mx-auto size-9 text-gold" />
        <h1 className="mt-5 font-display text-3xl font-bold text-parch">
          StudioNet blinked
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          The chain did not answer this read in time. Nothing was changed. Give
          it another knock.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={reset}>
            <RefreshCw className="size-4" />
            Try the read again
          </Button>
        </div>
      </div>
    </main>
  );
}
