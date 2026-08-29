import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CloudSun,
  Feather,
  Gavel,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BiomeScene } from "@/components/game/BiomeScene";
import { Badge } from "@/components/ui/Badge";
import { contracts } from "@/lib/addresses";
import { readContract } from "@/lib/genlayer";
import type { Biome } from "@/lib/types";

export const metadata: Metadata = {
  title: "How to play",
  description: "Learn how creatures, written moves, battles, weather, and appeals work.",
};

export const dynamic = "force-dynamic";

const elements = [
  ["Ember", "Cinderbeast", 100, 28, 12, 18, "Hits hard and dislikes subtlety."],
  ["Tide", "Deepling", 122, 18, 20, 12, "Patient, sturdy, difficult to rush."],
  ["Gale", "Skywisp", 86, 21, 12, 28, "Fast enough to make a plan feel late."],
  ["Terra", "Stonekin", 112, 16, 27, 9, "A wall that eventually hits back."],
  ["Umbra", "Nightmaw", 82, 30, 11, 24, "Fragile, vicious, fond of bad lighting."],
  ["Lumen", "Dawnward", 106, 20, 22, 15, "Balanced and annoyingly dependable."],
] as const;

const steps: Array<{
  number: string;
  title: string;
  icon: LucideIcon;
  body: string;
  note: string;
}> = [
  {
    number: "01",
    title: "Craft a creature",
    icon: Sparkles,
    body: "Choose one of six elements and give the creature a name. The element sets its basic strengths. The name adds a small deterministic wobble, so two Ember creatures do not arrive with identical numbers.",
    note: "A creature begins at level one with no moves.",
  },
  {
    number: "02",
    title: "Write what a move does",
    icon: Feather,
    body: "Describe the move in plain English. You can ask for damage, healing, shields, status effects, scaling, tradeoffs, or a combination. Clear writing helps the validators understand the bargain you intended.",
    note: "Each creature can carry four active moves.",
  },
  {
    number: "03",
    title: "Let consensus price it",
    icon: BrainCircuit,
    body: "GenLayer validators turn the description into power, mana, wait time, accuracy, one effect, one scaling rule, and a total power budget. Equivalent readings can agree even when the wording differs.",
    note: "Big effects pay with mana, accuracy, wait time, or all three.",
  },
  {
    number: "04",
    title: "Pick a biome and fight",
    icon: Swords,
    body: "Send one of your creatures against any battle ready opponent. The arena plays the whole duel from both kits. Speed decides who opens, mana returns each turn, and the biome can strengthen its home element.",
    note: "The fight stops after forty turns if neither side falls.",
  },
  {
    number: "05",
    title: "Grow through the record",
    icon: Trophy,
    body: "Both creatures earn experience. Winners earn more, with a bonus for the opponent level. Wins, losses, experience, and battle history are written back to the Bestiary.",
    note: "The first level costs sixty experience. Later levels cost forty more each.",
  },
  {
    number: "06",
    title: "Appeal a strange verdict",
    icon: Gavel,
    body: "If a move seems too weak, too strong, too cheap, or too expensive for its words, file an appeal. A fresh validator jury can uphold the claim and rebalance it, or reject the argument and keep the original numbers.",
    note: "A move rests one hour between appeals. A trainer waits thirty seconds between filings.",
  },
];

export default async function HowToPlayPage() {
  let biomes: Biome[] = [];
  try {
    biomes = await readContract<Biome[]>(contracts.arena, "list_biomes");
  } catch {
    biomes = [];
  }
  const liveBiome = biomes.find((biome) => biome.source === "open-meteo") ?? biomes[0];

  return (
    <main>
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:py-16">
          <Badge className="border-gale/30 text-gale">New trainer guide</Badge>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold text-parch sm:text-6xl">
            Write boldly. Read the numbers. Blame the weather only when deserved.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-soft">
            Wordrena is a turn based creature battler where your sentences
            become the move set. This is the full loop, minus the dramatic
            staring before a duel.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/forge"
              className="ring-focus inline-flex min-h-11 items-center gap-2 rounded-md border border-gold bg-gold px-5 py-2.5 text-sm font-bold text-void hover:bg-gold-soft"
            >
              Craft your first creature
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/bestiary"
              className="ring-focus inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-surface px-5 py-2.5 text-sm font-semibold text-parch"
            >
              Study live moves
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6">
        <div className="grid gap-0 border-y border-line">
          {steps.map(({ number, title, icon: Icon, body, note }) => (
            <article
              key={number}
              className="grid gap-5 border-b border-line py-8 last:border-b-0 md:grid-cols-[80px_240px_1fr]"
            >
              <p className="font-mono text-sm text-gold">{number}</p>
              <div>
                <Icon className="size-5 text-rune" />
                <h2 className="mt-3 font-display text-xl font-bold text-parch">
                  {title}
                </h2>
              </div>
              <div>
                <p className="text-sm leading-7 text-ink-soft">{body}</p>
                <p className="mt-3 border-l border-gold/40 pl-3 text-xs leading-5 text-parch">
                  {note}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-dusk">
        <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase text-gold">
              Pick your nature
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-parch">
              The six elements
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              These are the level one base spreads before the small name bonus.
              There is no perfect element, only the one that makes your next bad
              idea more interesting.
            </p>
          </div>
          <div className="mt-7 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-surface text-[10px] uppercase text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Element</th>
                  <th className="px-4 py-3">Archetype</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Attack</th>
                  <th className="px-4 py-3">Defense</th>
                  <th className="px-4 py-3">Speed</th>
                  <th className="px-4 py-3">Temperament</th>
                </tr>
              </thead>
              <tbody>
                {elements.map(
                  ([element, archetype, hp, attack, defense, speed, note]) => (
                    <tr
                      key={element}
                      className="border-t border-line text-ink-soft"
                    >
                      <td className="px-4 py-4 font-semibold text-parch">
                        {element}
                      </td>
                      <td className="px-4 py-4">{archetype}</td>
                      <td className="px-4 py-4 font-mono">{hp}</td>
                      <td className="px-4 py-4 font-mono">{attack}</td>
                      <td className="px-4 py-4 font-mono">{defense}</td>
                      <td className="px-4 py-4 font-mono">{speed}</td>
                      <td className="px-4 py-4">{note}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase text-rune">
            What the forge returns
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-parch">
            Read a move sheet
          </h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {[
              ["Power", "Zero to forty damage before combat math."],
              ["Mana", "Zero to eight. Every creature starts with six and recovers three each turn, up to twelve."],
              ["Wait", "Zero to four turns before the move is ready again."],
              ["Accuracy", "Fifty five to one hundred percent."],
              ["Effect", "One closest match such as burn, poison, stun, heal, shield, lifesteal, buff, debuff, recoil, or cleanse."],
              ["Scaling", "Optional extra force for low health, high health, opening turns, finishing, or combos."],
              ["Budget", "A one to one hundred reading of the whole package."],
            ].map(([term, detail]) => (
              <div key={term} className="grid grid-cols-[110px_1fr] gap-4 py-4">
                <dt className="font-semibold text-parch">{term}</dt>
                <dd className="text-sm leading-6 text-ink-soft">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        {liveBiome ? (
          <div>
            <p className="font-mono text-[11px] uppercase text-tide">
              Live example
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-parch">
              Weather enters the ring
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              The home element receives the biome force. Hazard levels can chip
              away at visitors after a round. The exact reading comes from the
              current sky, then validators agree it is close enough.
            </p>
            <BiomeScene
              name={liveBiome.name}
              homeElement={liveBiome.home_element}
              conditions={liveBiome.conditions}
              buffPct={liveBiome.buff_pct}
              hazard={liveBiome.hazard}
              source={liveBiome.source}
              className="mt-6 min-h-72"
            >
              <div className="flex justify-center gap-5 px-4">
                <Badge className="border-tide/30 bg-void/70 text-tide">
                  <CloudSun className="mr-1 size-3" />
                  {liveBiome.buff_pct}% home force
                </Badge>
                <Badge className="border-ember/30 bg-void/70 text-ember">
                  <Zap className="mr-1 size-3" />
                  hazard {liveBiome.hazard}
                </Badge>
              </div>
            </BiomeScene>
          </div>
        ) : null}
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div className="border-l border-line pl-5">
            <Shield className="size-5 text-tide" />
            <h3 className="mt-3 font-semibold text-parch">You own the wording</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              The move description cannot be edited after forging. Retire it
              and write a better one when the joke stops being funny.
            </p>
          </div>
          <div className="border-l border-line pl-5">
            <Swords className="size-5 text-ember" />
            <h3 className="mt-3 font-semibold text-parch">The arena owns the turn</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Creatures choose the strongest ready move they can afford. Your
              strategy begins in the kit you wrote.
            </p>
          </div>
          <div className="border-l border-line pl-5">
            <Gavel className="size-5 text-gold" />
            <h3 className="mt-3 font-semibold text-parch">The jury owns the appeal</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              A good complaint compares words to numbers. “I lost” is honest,
              but the bench has heard stronger material.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
