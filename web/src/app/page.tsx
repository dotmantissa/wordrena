import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CloudSun,
  Feather,
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
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-14 lg:py-16">
          <div className="max-w-xl">
            <p className="section-kicker">The living creature league</p>
            <h1 className="mt-4 max-w-md font-display text-6xl leading-[0.94] text-dusk sm:text-7xl">
              Wordrena
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-ink-soft">
              Write the move you wish existed. GenLayer gives your sentence
              numbers, limits, and a fair chance to surprise somebody.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/forge"
                className="ring-focus inline-flex min-h-11 items-center gap-2 border border-dusk bg-dusk px-5 py-2.5 text-sm font-bold text-parch hover:bg-dusk-raise"
              >
                Open the forge
                <ArrowUpRight className="size-4" />
              </Link>
              <Link
                href="/how-to-play"
                className="ring-focus inline-flex min-h-11 items-center gap-2 border border-line-strong bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:border-gold"
              >
                <BookOpen className="size-4" />
                Start here
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-ink-faint">
              <span className="size-2 rounded-full bg-gale" />
              Live contract record on chain {contracts.chainId}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-3 -top-3 z-10 hidden border border-dusk bg-bg px-3 py-2 text-[10px] uppercase tracking-[0.08em] text-dusk sm:block">
              Field note 001
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
              <div className="field-frame grid min-h-[390px] place-items-center p-8 text-center text-parch">
                <p className="max-w-sm">
                  The field is quiet. Someone has to write the first move.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {error ? (
        <section className="border-b border-ember/20 bg-ember/5">
          <div className="mx-auto max-w-[1280px] px-4 py-4 text-sm text-ember sm:px-6">
            StudioNet could not be read: {error}
          </div>
        </section>
      ) : null}

      <section className="journal-rule bg-surface">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            ["Creatures catalogued", data?.stats.bestiary.creatures ?? 0],
            ["Moves judged", data?.stats.bestiary.moves ?? 0],
            ["Duels recorded", data?.stats.arena.battles ?? 0],
            ["Appeals heard", data?.stats.tribunal.total ?? 0],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`px-4 py-6 sm:px-6 lg:py-7 ${
                index > 0 ? "border-l border-line" : ""
              }`}
            >
              <p className="font-display text-3xl text-dusk">{value}</p>
              <p className="mt-1 text-xs text-ink-faint">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1280px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:py-18">
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-kicker">From the battle ledger</p>
              <h2 className="mt-2 font-display text-3xl text-dusk">
                The latest duel
              </h2>
            </div>
            <Link
              href="/arena"
              className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-gold"
            >
              Open arena
              <ArrowUpRight className="size-4" />
            </Link>
          </div>

          {latestBattle ? (
            <Link
              href={`/arena/${latestBattle.battle_id}`}
              className="paper-cut card-hover mt-6 block p-6"
            >
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{latestBattle.battle_id}</Badge>
                  <Badge className="border-tide/30 text-tide">
                    {titleCase(latestBattle.biome_key)}
                  </Badge>
                  <span className="ml-auto text-xs text-ink-faint">
                    {formatAgo(latestBattle.created_at)}
                  </span>
                </div>
                <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div>
                    <p className="font-display text-2xl text-dusk">
                      {latestBattle.attacker_name}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">Challenger</p>
                  </div>
                  <Swords className="size-6 text-gold" />
                  <div className="text-right">
                    <p className="font-display text-2xl text-dusk">
                      {latestBattle.defender_name}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">Defender</p>
                  </div>
                </div>
                <p className="mt-7 border-t border-line pt-4 text-sm leading-6 text-ink-soft">
                  {latestBattle.summary}
                </p>
              </div>
            </Link>
          ) : (
            <div className="paper-cut mt-6 p-6 text-sm text-ink-soft">
              No fights yet. The first challenger gets an audience and very
              little useful advice.
            </div>
          )}
        </div>

        <div>
          <p className="section-kicker">Fresh from consensus</p>
          <h2 className="mt-2 font-display text-3xl text-dusk">
            New move notes
          </h2>
          <div className="mt-6 grid gap-3">
            {data?.moves.slice(-4).reverse().map((move) => (
              <Link
                href={`/bestiary/moves/${move.move_id}`}
                key={move.move_id}
                className="card card-hover grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4"
              >
                <div className="grid size-10 place-items-center border border-rune/25 bg-rune/10 text-rune">
                  <BrainCircuit className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-dusk">
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

      <section className="border-y border-line bg-dusk text-parch">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-3">
          {[
            {
              icon: Feather,
              title: "You write the instinct",
              body: "Describe a move like a trainer, poet, or menace. The words become the starting point.",
            },
            {
              icon: CloudSun,
              title: "The field has a say",
              body: "Every biome reads live weather and gives its home element a reason to feel smug.",
            },
            {
              icon: Swords,
              title: "The record remembers",
              body: "Battles, experience, verdicts, and appeals stay inspectable on the public record.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="border-l border-parch/20 pl-5">
              <Icon className="size-5 text-gold-soft" />
              <h3 className="mt-4 font-display text-xl">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-parch-dim">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
