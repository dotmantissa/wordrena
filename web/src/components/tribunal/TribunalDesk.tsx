"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel, Scale, ShieldQuestion } from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { useWordrenaAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  FieldLabel,
  Input,
  Select,
  Textarea,
} from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson, runAction } from "@/lib/clientApi";
import { formatAgo, titleCase } from "@/lib/format";
import type { Dispute, Move } from "@/lib/types";

export function TribunalDesk({
  moves,
  disputes,
  initialMove,
}: {
  moves: Move[];
  disputes: Dispute[];
  initialMove?: string;
}) {
  const router = useRouter();
  const { authenticated } = useWordrenaAuth();
  const [moveId, setMoveId] = useState(
    initialMove && moves.some((move) => move.move_id === initialMove)
      ? initialMove
      : moves[0]?.move_id || ""
  );
  const [direction, setDirection] = useState<"buff" | "nerf">("nerf");
  const [claim, setClaim] = useState("");
  const [bond, setBond] = useState("0");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const move = useMemo(
    () => moves.find((item) => item.move_id === moveId),
    [moveId, moves]
  );

  async function file(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      await runAction("fileDispute", { moveId, direction, claim, bond });
      const detail = await apiJson<{ disputes: Dispute[] }>(
        `/api/state/move/${moveId}`
      );
      const latest = detail.disputes[0];
      if (latest) router.push(`/tribunal/${latest.dispute_id}`);
      else router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The filing failed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[430px_1fr]">
      <section className="rounded-lg border border-line bg-surface p-5">
        <p className="font-mono text-[11px] uppercase text-gold">
          File an appeal
        </p>
        {!authenticated ? (
          <div className="mt-7 text-center">
            <ShieldQuestion className="mx-auto size-8 text-rune" />
            <h2 className="mt-4 font-display text-xl font-bold text-parch">
              The bench needs your name
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Sign in before arguing with consensus. It is only polite, and the
              cooldown needs somewhere to find you.
            </p>
            <div className="mt-5 flex justify-center">
              <AuthButton />
            </div>
          </div>
        ) : (
          <form onSubmit={file} className="mt-5 grid gap-5">
            <FieldLabel label="Move under review">
              <Select
                value={moveId}
                onChange={(event) => setMoveId(event.target.value)}
                required
              >
                {moves.map((item) => (
                  <option key={item.move_id} value={item.move_id}>
                    {item.name} · power {item.power}
                  </option>
                ))}
              </Select>
            </FieldLabel>

            <fieldset>
              <legend className="text-sm font-medium text-parch">
                What should change?
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  ["buff", "Make it stronger"],
                  ["nerf", "Tone it down"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDirection(value as "buff" | "nerf")}
                    className={`ring-focus rounded-md border px-3 py-3 text-sm font-semibold ${
                      direction === value
                        ? "border-gold/50 bg-gold/10 text-gold-soft"
                        : "border-line bg-dusk text-ink-soft"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <FieldLabel label="Make your case" hint={`${claim.length} / 400`}>
              <Textarea
                value={claim}
                onChange={(event) => setClaim(event.target.value)}
                minLength={8}
                maxLength={400}
                placeholder="Explain why the words and the numbers do not match. Losing once is not, by itself, a legal theory."
                required
              />
            </FieldLabel>

            <FieldLabel label="Appeal bond" hint="0 to 1 GEN">
              <Input
                value={bond}
                onChange={(event) => setBond(event.target.value)}
                inputMode="decimal"
                pattern="\d+(\.\d{1,6})?"
                placeholder="0"
                required
              />
            </FieldLabel>

            <Button
              type="submit"
              disabled={working || !moveId || claim.trim().length < 8}
            >
              {working ? <Spinner /> : <Gavel className="size-4" />}
              {working ? "Calling the jury" : "File appeal"}
            </Button>
          </form>
        )}

        {move ? (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-xs font-semibold text-parch">{move.name}</p>
            <p className="mt-2 text-xs leading-5 text-ink-soft">
              {move.verdict}
            </p>
            <div className="mt-4 grid grid-cols-4 divide-x divide-line text-center">
              {[
                ["Power", move.power],
                ["Mana", move.mana_cost],
                ["Wait", move.cooldown],
                ["Budget", move.power_budget],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="font-mono text-sm font-bold text-parch">
                    {value}
                  </p>
                  <p className="mt-1 text-[9px] uppercase text-ink-faint">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-ember/30 bg-ember/5 p-3 text-sm text-ember">
            {error}
          </p>
        ) : null}
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase text-rune">
              Public docket
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-parch">
              Appeals and verdicts
            </h2>
          </div>
          <Badge>{disputes.length} shown</Badge>
        </div>
        <div className="mt-5 grid gap-3">
          {disputes.map((dispute) => (
            <button
              key={dispute.dispute_id}
              type="button"
              onClick={() => router.push(`/tribunal/${dispute.dispute_id}`)}
              className="card card-hover grid w-full gap-4 p-5 text-left sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{dispute.dispute_id}</Badge>
                  <Badge
                    className={
                      dispute.direction === "buff"
                        ? "border-gale/30 text-gale"
                        : "border-ember/30 text-ember"
                    }
                  >
                    {dispute.direction}
                  </Badge>
                  <span className="text-xs text-ink-faint">
                    {formatAgo(dispute.filed_at)}
                  </span>
                </div>
                <h3 className="mt-3 truncate font-display text-lg font-bold text-parch">
                  {dispute.move_name}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">
                  {dispute.claim}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-center">
                <Scale className="size-5 text-gold" />
                <Badge
                  className={
                    dispute.status === "upheld"
                      ? "border-gale/30 text-gale"
                      : dispute.status === "rejected"
                        ? "border-ember/30 text-ember"
                        : "border-gold/30 text-gold"
                  }
                >
                  {titleCase(dispute.status)}
                </Badge>
              </div>
            </button>
          ))}
          {!disputes.length ? (
            <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-soft">
              The docket is empty. Either balance is perfect or everyone is
              still drafting their complaint.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
