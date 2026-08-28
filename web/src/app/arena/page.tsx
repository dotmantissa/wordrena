import type { Metadata } from "next";
import { ArenaLobby } from "@/components/arena/ArenaLobby";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { readContract } from "@/lib/genlayer";
import type { Battle, Biome, Creature, PageResult } from "@/lib/types";

export const metadata: Metadata = {
  title: "Arena",
  description: "Challenge a creature, choose a live biome, and replay every turn.",
};

export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const [creatures, battles, biomes] = await Promise.all([
    readContract<PageResult<Creature>>(contracts.bestiary, "list_creatures", [
      0,
      100,
    ]),
    readContract<PageResult<Battle>>(contracts.arena, "list_battles", [0, 40]),
    readContract<Biome[]>(contracts.arena, "list_biomes"),
  ]);

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-10 sm:px-6 lg:py-14">
      <header className="max-w-3xl">
        <Badge className="border-tide/30 text-tide">Weather has opinions</Badge>
        <h1 className="mt-4 font-display text-4xl font-bold text-parch sm:text-5xl">
          Arena
        </h1>
        <p className="mt-4 text-base leading-7 text-ink-soft">
          Choose a fighter, choose a target, then choose which corner of the
          real world gets to interfere. The contract plays every turn and keeps
          the receipts.
        </p>
      </header>
      <div className="mt-10">
        <ArenaLobby
          creatures={creatures.items}
          battles={battles.items}
          biomes={biomes}
        />
      </div>
    </main>
  );
}
