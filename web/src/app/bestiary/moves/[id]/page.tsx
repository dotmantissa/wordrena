import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gauge, Gavel, Sparkles, Target, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { formatAgo, titleCase } from "@/lib/format";
import { readContract } from "@/lib/genlayer";
import type { Dispute, Move } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MovePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [move, disputes] = await Promise.all([
    readContract<Move>(contracts.bestiary, "get_move", [id]),
    readContract<Dispute[]>(contracts.tribunal, "disputes_for_move", [id]),
  ]);
  if (!move.exists) notFound();
  const stats: Array<[string, string | number, LucideIcon]> = [
    ["Power", move.power, Sparkles],
    ["Mana", move.mana_cost, Gauge],
    ["Wait", move.cooldown, Timer],
    ["Accuracy", `${move.accuracy}%`, Target],
    ["Budget", move.power_budget, Gavel],
  ];

  return (
    <main className="mx-auto max-w-[980px] px-4 py-10 sm:px-6">
      <Link
        href="/bestiary"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to Bestiary
      </Link>
      <section className="mt-8 border-b border-line pb-10">
        <div className="flex flex-wrap gap-2">
          <Badge>{move.element}</Badge>
          <Badge>{move.status}</Badge>
          <Badge>{move.move_id}</Badge>
        </div>
        <h1 className="mt-5 font-display text-4xl font-bold text-parch sm:text-5xl">
          {move.name}
        </h1>
        <blockquote className="mt-6 border-l-2 border-gold pl-5 text-lg leading-8 text-ink-soft">
          “{move.prompt}”
        </blockquote>
        <p className="mt-6 text-sm leading-6 text-parch">{move.verdict}</p>
      </section>

      <section className="grid gap-px overflow-hidden border-b border-line bg-line sm:grid-cols-5">
        {stats.map(([label, value, Icon]) => (
          <div key={label} className="bg-dusk p-5">
            <Icon className="size-4 text-gold" />
            <p className="mt-4 font-display text-2xl font-bold text-parch">
              {value}
            </p>
            <p className="mt-1 text-[10px] uppercase text-ink-faint">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-8 py-10 md:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase text-rune">
            Validator reading
          </p>
          <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
            {[
              ["Effect", titleCase(move.effect_kind)],
              ["Effect strength", move.effect_magnitude],
              ["Effect length", `${move.effect_duration} turns`],
              ["Scaling", titleCase(move.scaling)],
              ["Forged", formatAgo(move.forged_at)],
            ].map(([term, detail]) => (
              <div
                key={String(term)}
                className="flex items-center justify-between gap-5 py-3"
              >
                <dt className="text-ink-faint">{term}</dt>
                <dd className="text-right font-medium text-parch">
                  {String(detail)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase text-gold">
                Tribunal history
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-parch">
                {disputes.length} appeals
              </h2>
            </div>
            <Link
              href={`/tribunal?move=${move.move_id}`}
              className="text-sm font-semibold text-ink-soft hover:text-gold"
            >
              Challenge it
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {disputes.map((dispute) => (
              <Link
                href={`/tribunal/${dispute.dispute_id}`}
                key={dispute.dispute_id}
                className="card card-hover p-4"
              >
                <div className="flex items-center gap-2">
                  <Badge>{dispute.direction}</Badge>
                  <Badge>{dispute.status}</Badge>
                  <span className="ml-auto text-xs text-ink-faint">
                    {formatAgo(dispute.filed_at)}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-ink-soft">
                  {dispute.claim}
                </p>
              </Link>
            ))}
            {!disputes.length ? (
              <p className="rounded-lg border border-dashed border-line p-5 text-sm text-ink-soft">
                Nobody has complained about this move yet. Suspiciously peaceful.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
