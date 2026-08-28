import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { BattleStage, type BattleLogEntry } from "@/components/game/BattleStage";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { formatAgo, titleCase } from "@/lib/format";
import { readContract } from "@/lib/genlayer";
import type { Battle, Biome, Creature } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BattlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const battle = await readContract<Battle>(contracts.arena, "get_battle", [id]);
  if (!battle.exists) notFound();
  const [attacker, defender, biome] = await Promise.all([
    readContract<Creature>(contracts.bestiary, "get_creature", [
      battle.attacker_id,
    ]),
    readContract<Creature>(contracts.bestiary, "get_creature", [
      battle.defender_id,
    ]),
    readContract<Biome>(contracts.arena, "get_biome", [battle.biome_key]),
  ]);
  const winner =
    battle.winner_id === battle.attacker_id ? attacker.name : defender.name;

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6">
      <Link
        href="/arena"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to Arena
      </Link>
      <header className="mt-7 flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{battle.battle_id}</Badge>
            <Badge className="border-tide/30 text-tide">
              {titleCase(battle.biome_key)}
            </Badge>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold text-parch sm:text-4xl">
            {attacker.name} vs {defender.name}
          </h1>
          <p className="mt-2 text-sm text-ink-faint">
            Fought {formatAgo(battle.created_at)} · {battle.turns} turns
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3">
          <Trophy className="size-5 text-gold" />
          <div>
            <p className="text-[10px] uppercase text-ink-faint">Winner</p>
            <p className="font-semibold text-parch">{winner}</p>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <BattleStage
          battle={{
            attacker: {
              id: attacker.creature_id,
              name: attacker.name,
              element: attacker.element,
              maxHp: attacker.hp,
            },
            defender: {
              id: defender.creature_id,
              name: defender.name,
              element: defender.element,
              maxHp: defender.hp,
            },
            attackerHpLeft: battle.attacker_hp_left,
            defenderHpLeft: battle.defender_hp_left,
            winnerId: battle.winner_id,
            biome: {
              name: biome.name,
              homeElement: biome.home_element,
              conditions: battle.biome_conditions,
              buffPct: biome.buff_pct,
              hazard: biome.hazard,
              source: biome.source,
            },
            log: (battle.log || []) as BattleLogEntry[],
          }}
        />
      </section>

      <section className="mt-8 grid gap-6 border-y border-line py-6 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase text-ink-faint">Arena summary</p>
          <p className="mt-2 text-sm leading-6 text-parch">{battle.summary}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-ink-faint">
            {attacker.name} earned
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-gold">
            {battle.xp_attacker} experience
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-ink-faint">
            {defender.name} earned
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-gold">
            {battle.xp_defender} experience
          </p>
        </div>
      </section>
    </main>
  );
}
