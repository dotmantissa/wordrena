"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { runAction } from "@/lib/clientApi";

export function ResolveButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function resolve() {
    setWorking(true);
    setError("");
    try {
      await runAction("resolveDispute", { disputeId });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The jury did not answer");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <Button onClick={() => void resolve()} disabled={working}>
        {working ? <Spinner /> : <Gavel className="size-4" />}
        {working ? "Jury is deliberating" : "Call the jury"}
      </Button>
      {error ? <p className="mt-2 text-xs text-ember">{error}</p> : null}
    </div>
  );
}
