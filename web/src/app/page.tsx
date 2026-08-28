import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CloudSun,
  Swords,
} from "lucide-react";
import { BiomeScene } from "@/components/game/BiomeScene";
import { CreatureArt } from "@/components/game/CreatureArt";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { formatAgo, titleCase } from "@/lib/format";
import { worldSnapshot } from "@/lib/indexer";

export const dynamic = "force-dynamic";

async function loadWorld() {
  try {
    return { data: await worldSnapshot(), error: "" };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "StudioNet is not answering right now",
    };
  }
}

export default async function Home() {
  const { data, error } = await loadWorld();
  const latestBattle = data?.battles[0];
  const attacker = data?.creatures.find(
    (creature) => creature.creature_id === latestBattle?.attacker_id
  );
  const defender = data?.creatures.find(
    (creature) => creature.creature_id === latestBattle?.defender_id
  );
  const biome =
    data?.biomes.find((item) => item.key === latestBattle?.biome_key) ??
    data?.biomes[0];

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line">
        <div className="arena-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid max-w-[1480px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:py-16">
          <div className="max-w-xl">
            <Badge className="border-gold/30 text-gold">
              Natural language creature battler
            </Badge>
            <h1 className="mt-5 font-display text-5xl font-bold leading-none text-parch sm:text-6xl">
              Wordrena
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-ink-soft">
              Write the move you wish existed. GenLayer turns your words into
              fair numbers. Then your creature has to live with what you wrote.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/forge"
                className="ring-focus inline-flex min-h-11 items-center gap-2 rounded-md border border-gold bg-gold px-5 py-2.5 text-sm font-bold text-void hover:bg-gold-soft"
              >
                Enter the forge
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/how-to-play"
                className="ring-focus inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-surface px-5 py-2.5 text-sm font-semibold text-parch hover:border-gold/40"
              >
                <BookOpen className="size-4" />
                Learn the ropes
              </Link>
            </div>
            <p className="mt-5 font-mono text-[11px] uppercase text-ink-faint">
              Contracts live on chain {contracts.chainId}
            </p>
          </div>

          {biome ? (
            <BiomeScene
              name={biome.name}
              homeElement={biome.home_element}
              conditions={biome.conditions}
              buffPct={biome.buff_pct}
              hazard={biome.hazard}
              source={biome.source}
              className="min-h-[390px]"
            >
              <div className="grid grid-cols-2 items-end gap-5 px-6 sm:px-12">
                {attacker ? (
                  <CreatureArt
                    name={attacker.name}
                    element={attacker.element}
                    active
                    className="mx-auto h-40 max-w-52"
                  />
                ) : null}
                {defender ? (
                  <CreatureArt
                    name={defender.name}
                    element={defender.element}
                    facing="left"
                    className="mx-auto h-40 max-w-52"
                  />
                ) : null}
              </div>
            </BiomeScene>
          ) : (
            <div className="grid min-h-[390px] place-items-center rounded-lg border border-line bg-surface">
              <p className="max-w-sm px-6 text-center text-ink-soft">
                The arena is quiet. That is usually when someone writes
                something regrettable.
              </p>
            </div>
          )}
        </div>
      </section>

      {error ? (
        <section className="border-b border-ember/20 bg-ember/5">
          <div className="mx-auto max-w-[1480px] px-4 py-4 text-sm text-ember sm:px-6">
            StudioNet could not be read: {error}
          </div>
        </section>
      ) : null}

      <section className="border-b border-line bg-dusk">
        <div className="mx-auto grid max-w-[1480px] grid-cols-2 px-4 sm:px-6 lg:grid-cols-4">
          {[
            ["Creatures", data?.stats.bestiary.creatures ?? 0],
            ["Moves judged", data?.stats.bestiary.moves ?? 0],
            ["Battles fought", data?.stats.arena.battles ?? 0],
            ["Appeals heard", data?.stats.tribunal.total ?? 0],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-b border-line px-3 py-6 even:border-l sm:px-6 lg:border-b-0 lg:border-l lg:first:border-l-0"
            >
              <p className="font-display text-3xl font-bold text-parch">{value}</p>
              <p className="mt-1 text-xs text-ink-faint">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1480px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase text-gold">
                Arena record
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-parch">
                Latest fight
              </h2>
            </div>
            <Link
              href="/arena"
              className="text-sm font-semibold text-ink-soft hover:text-gold"
            >
              See every fight
            </Link>
          </div>

          {latestBattle ? (
            <Link
              href={`/arena/${latestBattle.battle_id}`}
              className="card card-hover mt-5 block p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{latestBattle.battle_id}</Badge>
                <Badge className="border-tide/30 text-tide">
                  {titleCase(latestBattle.biome_key)}
                </Badge>
                <span className="ml-auto text-xs text-ink-faint">
                  {formatAgo(latestBattle.created_at)}
                </span>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl font-bold text-parch">
                    {latestBattle.attacker_name}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">Challenger</p>
                </div>
                <Swords className="size-6 shrink-0 text-gold" />
                <div className="min-w-0 flex-1 text-right">
                  <p className="truncate font-display text-xl font-bold text-parch">
                    {latestBattle.defender_name}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">Defender</p>
                </div>
              </div>
              <p className="mt-5 border-t border-line pt-4 text-sm leading-6 text-ink-soft">
                {latestBattle.summary}
              </p>
            </Link>
          ) : (
            <div className="card mt-5 p-6 text-sm text-ink-soft">
              No fights yet. The first challenger gets an audience with very low
              expectations.
            </div>
          )}
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase text-rune">
            Fresh from consensus
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-parch">
            Newly judged moves
          </h2>
          <div className="mt-5 grid gap-3">
            {data?.moves.slice(-4).reverse().map((move) => (
              <Link
                href={`/bestiary/moves/${move.move_id}`}
                key={move.move_id}
                className="card card-hover grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4"
              >
                <div className="grid size-10 place-items-center rounded-md bg-rune/10 text-rune">
                  <BrainCircuit className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-parch">
                    {move.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-ink-faint">
                    {move.verdict}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold text-gold">
                    {move.power}
                  </p>
                  <p className="text-[10px] uppercase text-ink-faint">power</p>
                </div>
              </Link>
            ))}
            {!data?.moves.length ? (
              <div className="card p-5 text-sm text-ink-soft">
                No moves have reached consensus yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1480px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3">
          {[
            {
              icon: BrainCircuit,
              title: "Words become rules",
              body: "Describe the move. Validators decide its damage, cost, accuracy, status, and appetite for trouble.",
            },
            {
              icon: CloudSun,
              title: "The sky meddles",
              body: "Each biome reads real weather. A warm day in Phoenix can make Emberpeak especially rude.",
            },
            {
              icon: Swords,
              title: "The record stays",
              body: "Fights resolve on chain, award experience, and leave a replay anyone can inspect.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="border-l border-line pl-5">
              <Icon className="size-5 text-gold" />
              <h3 className="mt-4 font-display text-lg font-bold text-parch">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
