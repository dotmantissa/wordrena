import type { Metadata } from "next";
import { BestiaryBrowser } from "@/components/bestiary/BestiaryBrowser";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { readContract } from "@/lib/genlayer";
import type { Creature, Move, PageResult } from "@/lib/types";

export const metadata: Metadata = {
  title: "Bestiary",
  description: "Browse the creatures and validator judged moves living on StudioNet.",
};

export const dynamic = "force-dynamic";

export default async function BestiaryPage() {
  const [creaturePage, movePage] = await Promise.all([
    readContract<PageResult<Creature>>(contracts.bestiary, "list_creatures", [
      0,
      100,
    ]),
    readContract<PageResult<Move>>(contracts.bestiary, "list_moves", [0, 100]),
  ]);
  const averagePower = movePage.items.length
    ? Math.round(
        movePage.items.reduce((total, move) => total + move.power, 0) /
          movePage.items.length
      )
    : 0;
  const rebalanced = movePage.items.filter(
    (move) => move.status === "rebalanced"
  ).length;

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-10 sm:px-6 lg:py-14">
      <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <Badge className="border-rune/30 text-rune">The living meta</Badge>
          <h1 className="mt-4 font-display text-4xl font-bold text-parch sm:text-5xl">
            Bestiary
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
            Every creature and every strange sentence that survived the forge.
            Browse the record, steal a clever idea, then write something the
            record has not seen yet.
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface">
          {[
            ["Creatures", creaturePage.total],
            ["Avg power", averagePower],
            ["Rebalanced", rebalanced],
          ].map(([label, value]) => (
            <div key={label} className="min-w-24 px-4 py-4 text-center">
              <p className="font-display text-2xl font-bold text-parch">{value}</p>
              <p className="mt-1 text-[10px] uppercase text-ink-faint">{label}</p>
            </div>
          ))}
        </div>
      </header>
      <div className="mt-9">
        <BestiaryBrowser
          creatures={creaturePage.items}
          moves={movePage.items}
        />
      </div>
    </main>
  );
}
