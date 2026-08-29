import type { Metadata } from "next";
import { TribunalDesk } from "@/components/tribunal/TribunalDesk";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { readContract } from "@/lib/genlayer";
import type { Dispute, Move, PageResult } from "@/lib/types";

export const metadata: Metadata = {
  title: "Tribunal",
  description: "Challenge a move interpretation and watch the validator jury decide.",
};

export const dynamic = "force-dynamic";

export default async function TribunalPage({
  searchParams,
}: {
  searchParams: Promise<{ move?: string }>;
}) {
  const query = await searchParams;
  let moves: PageResult<Move> = { total: 0, items: [] };
  let disputes: PageResult<Dispute> = { total: 0, items: [] };
  let stats = { total: 0, upheld: 0, rejected: 0, pending: 0 };
  let readFailed = false;
  try {
    [moves, disputes, stats] = await Promise.all([
      readContract<PageResult<Move>>(contracts.bestiary, "list_moves", [0, 100]),
      readContract<PageResult<Dispute>>(contracts.tribunal, "list_disputes", [
        0,
        60,
      ]),
      readContract<{
        total: number;
        upheld: number;
        rejected: number;
        pending: number;
      }>(contracts.tribunal, "tribunal_stats"),
    ]);
  } catch {
    readFailed = true;
  }

  return (
    <main className="mx-auto max-w-[1380px] px-4 py-10 sm:px-6 lg:py-14">
      <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <Badge className="border-gold/30 text-gold">Optimistic democracy</Badge>
          <h1 className="mt-4 font-display text-4xl font-bold text-parch sm:text-5xl">
            Tribunal
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
            Think the forge got a move wrong? Make the argument, put up a bond
            if you mean it, and ask a fresh validator jury to read the words
            again.
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface">
          {[
            ["Pending", stats.pending],
            ["Upheld", stats.upheld],
            ["Rejected", stats.rejected],
          ].map(([label, value]) => (
            <div key={label} className="min-w-24 px-4 py-4 text-center">
              <p className="font-display text-2xl font-bold text-parch">{value}</p>
              <p className="mt-1 text-[10px] uppercase text-ink-faint">{label}</p>
            </div>
          ))}
        </div>
      </header>
      {readFailed ? (
        <p className="mt-7 rounded-md border border-gold/25 bg-gold/5 p-4 text-sm text-gold-soft">
          The docket could not be read just now. No verdicts were lost; the
          chain only needs another moment.
        </p>
      ) : null}
      <div className="mt-10">
        <TribunalDesk
          moves={[...moves.items].reverse()}
          disputes={disputes.items}
          initialMove={query.move}
        />
      </div>
    </main>
  );
}
