import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Gavel, X } from "lucide-react";
import { ResolveButton } from "@/components/tribunal/ResolveButton";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { formatAgo, shortAddress, titleCase } from "@/lib/format";
import { readContract } from "@/lib/genlayer";
import { currentUser } from "@/lib/session";
import type { Dispute, Move } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DisputePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dispute = await readContract<Dispute>(
    contracts.tribunal,
    "get_dispute",
    [id]
  );
  if (!dispute.exists) notFound();
  const [move, user] = await Promise.all([
    readContract<Move>(contracts.bestiary, "get_move", [dispute.move_id]),
    currentUser(),
  ]);
  const canResolve =
    dispute.status === "filed" &&
    user?.wallet.toLowerCase() === dispute.challenger.toLowerCase();

  const rows = [
    ["Power", dispute.old_power, dispute.new_power],
    ["Mana", dispute.old_mana, dispute.new_mana],
    ["Wait", dispute.old_cooldown, dispute.new_cooldown],
    ["Budget", dispute.old_budget, dispute.new_budget],
  ];

  return (
    <main className="mx-auto max-w-[980px] px-4 py-10 sm:px-6">
      <Link
        href="/tribunal"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to Tribunal
      </Link>
      <header className="mt-7 border-b border-line pb-8">
        <div className="flex flex-wrap gap-2">
          <Badge>{dispute.dispute_id}</Badge>
          <Badge>{dispute.direction}</Badge>
          <Badge
            className={
              dispute.status === "upheld"
                ? "border-gale/30 text-gale"
                : dispute.status === "rejected"
                  ? "border-ember/30 text-ember"
                  : "border-gold/30 text-gold"
            }
          >
            {dispute.status}
          </Badge>
        </div>
        <h1 className="mt-5 font-display text-4xl font-bold text-parch">
          {dispute.move_name}
        </h1>
        <p className="mt-3 text-sm text-ink-faint">
          Filed {formatAgo(dispute.filed_at)} by{" "}
          {shortAddress(dispute.challenger)}
        </p>
        <blockquote className="mt-7 border-l-2 border-rune pl-5 text-lg leading-8 text-ink-soft">
          “{dispute.claim}”
        </blockquote>
      </header>

      <section className="grid gap-8 py-9 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="font-mono text-[11px] uppercase text-gold">
            Numbers before and after
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-3 bg-dusk px-4 py-3 text-[10px] uppercase text-ink-faint">
              <span>Measure</span>
              <span className="text-right">Filed</span>
              <span className="text-right">Verdict</span>
            </div>
            {rows.map(([label, oldValue, newValue]) => (
              <div
                key={String(label)}
                className="grid grid-cols-3 border-t border-line bg-surface px-4 py-4 text-sm"
              >
                <span className="text-ink-soft">{label}</span>
                <span className="text-right font-mono text-parch">{oldValue}</span>
                <span
                  className={`text-right font-mono font-bold ${
                    newValue !== oldValue ? "text-gold" : "text-ink-faint"
                  }`}
                >
                  {newValue}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-line bg-surface p-5">
          {dispute.status === "filed" ? (
            <>
              <Gavel className="size-6 text-gold" />
              <h2 className="mt-4 font-display text-xl font-bold text-parch">
                Waiting for the jury
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink-soft">
                The challenger can call a fresh validator panel. The move stays
                unchanged until the verdict reaches finality.
              </p>
              {canResolve ? (
                <div className="mt-5">
                  <ResolveButton disputeId={dispute.dispute_id} />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {dispute.status === "upheld" ? (
                <Check className="size-7 text-gale" />
              ) : (
                <X className="size-7 text-ember" />
              )}
              <h2 className="mt-4 font-display text-xl font-bold text-parch">
                Appeal {dispute.status}
              </h2>
              <p className="mt-3 text-sm leading-6 text-ink-soft">
                {dispute.verdict_summary}
              </p>
              <Badge className="mt-5">{titleCase(dispute.reason_code)}</Badge>
            </>
          )}
        </aside>
      </section>

      <section className="border-y border-line py-6">
        <p className="font-mono text-[11px] uppercase text-rune">
          Original move
        </p>
        <Link
          href={`/bestiary/moves/${move.move_id}`}
          className="mt-3 block text-lg font-semibold text-parch hover:text-gold"
        >
          {move.name}
        </Link>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{move.prompt}</p>
      </section>
    </main>
  );
}
