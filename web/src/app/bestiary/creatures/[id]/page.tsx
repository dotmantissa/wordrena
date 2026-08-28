import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Shield, Swords, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CreatureArt } from "@/components/game/CreatureArt";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { formatAgo, titleCase } from "@/lib/format";
import { readContract } from "@/lib/genlayer";
import type { Battle, Creature, Move } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CreaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [creature, moves, battles] = await Promise.all([
    readContract<Creature>(contracts.bestiary, "get_creature", [id]),
    readContract<Move[]>(contracts.bestiary, "get_creature_moves", [id]),
    readContract<Battle[]>(contracts.arena, "battles_for_creature", [id, 16]),
  ]);
  if (!creature.exists) notFound();
  const stats: Array<[string, number, LucideIcon]> = [
    ["Health", creature.hp, Shield],
    ["Attack", creature.attack, Zap],
    ["Defense", creature.defense, Shield],
    ["Speed", creature.speed, Swords],
  ];

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6">
      <Link
        href="/bestiary"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to Bestiary
      </Link>
      <section className="mt-7 grid gap-8 border-b border-line pb-10 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-line bg-dusk p-6">
          <CreatureArt
            name={creature.name}
            element={creature.element}
            active
            className="mx-auto h-64 max-w-80"
          />
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{creature.element}</Badge>
            <Badge>{creature.archetype}</Badge>
            <Badge>{creature.creature_id}</Badge>
          </div>
          <h1 className="mt-4 font-display text-5xl font-bold text-parch">
            {creature.name}
          </h1>
          <p className="mt-3 text-sm text-ink-faint">
            Level {creature.level} · born {formatAgo(creature.created_at)}
          </p>
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            {stats.map(([label, value, Icon]) => (
              <div key={label} className="bg-surface p-4">
                <Icon className="size-4 text-gold" />
                <p className="mt-3 font-display text-2xl font-bold text-parch">
                  {value}
                </p>
                <p className="mt-1 text-[10px] uppercase text-ink-faint">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-6 text-sm text-ink-soft">
            <span>{creature.wins} wins</span>
            <span>{creature.losses} losses</span>
            <span>{creature.xp} experience</span>
          </div>
        </div>
      </section>

      <section className="grid gap-10 py-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl font-bold text-parch">Move kit</h2>
          <div className="mt-5 grid gap-3">
            {moves.map((move) => (
              <Link
                href={`/bestiary/moves/${move.move_id}`}
                key={move.move_id}
                className="card card-hover p-4"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-parch">{move.name}</h3>
                  <span className="ml-auto font-mono text-sm text-gold">
                    {move.power} power
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-soft">
                  {move.verdict}
                </p>
                <p className="mt-3 font-mono text-[10px] uppercase text-ink-faint">
                  {move.mana_cost} mana · {move.cooldown} wait ·{" "}
                  {titleCase(move.effect_kind)}
                </p>
              </Link>
            ))}
            {!moves.length ? (
              <p className="rounded-lg border border-dashed border-line p-5 text-sm text-ink-soft">
                No moves yet. It can still glare at opponents, which is not
                nothing.
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-parch">
            Fight record
          </h2>
          <div className="mt-5 divide-y divide-line border-y border-line">
            {battles.map((battle) => (
              <Link
                href={`/arena/${battle.battle_id}`}
                key={battle.battle_id}
                className="grid grid-cols-[1fr_auto] gap-4 py-4 hover:text-gold"
              >
                <div>
                  <p className="text-sm font-semibold text-parch">
                    {battle.attacker_name} vs {battle.defender_name}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {titleCase(battle.biome_key)} · {formatAgo(battle.created_at)}
                  </p>
                </div>
                <Badge
                  className={
                    battle.winner_id === creature.creature_id
                      ? "border-gale/30 text-gale"
                      : "border-ember/30 text-ember"
                  }
                >
                  {battle.winner_id === creature.creature_id ? "Won" : "Lost"}
                </Badge>
              </Link>
            ))}
            {!battles.length ? (
              <p className="py-5 text-sm text-ink-soft">No fights recorded.</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
