"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Search, Shield, Sparkles, Swords, Zap } from "lucide-react";
import clsx from "clsx";
import { CreatureArt } from "@/components/game/CreatureArt";
import {
  ELEMENTS,
  elementTone,
  type ElementName,
} from "@/components/game/elements";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { formatAgo, titleCase } from "@/lib/format";
import type { Creature, Move } from "@/lib/types";

function CreatureCard({ creature }: { creature: Creature }) {
  return (
    <Link
      href={`/bestiary/creatures/${creature.creature_id}`}
      className="card card-hover group grid min-h-52 grid-cols-[120px_1fr] overflow-hidden"
    >
      <div
        className="relative grid place-items-end border-r border-line bg-dusk p-2"
        style={{ boxShadow: `inset 0 3px 0 ${elementTone[creature.element as ElementName] || "#ffcb52"}55` }}
      >
        <CreatureArt
          name={creature.name}
          element={creature.element}
          className="h-32 w-full transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 p-4">
        <div className="flex items-center gap-2">
          <Badge>{creature.element}</Badge>
          <span className="ml-auto font-mono text-[10px] text-ink-faint">
            {creature.creature_id}
          </span>
        </div>
        <h3 className="mt-3 truncate font-display text-xl font-bold text-parch">
          {creature.name}
        </h3>
        <p className="mt-1 text-xs text-ink-faint">
          Level {creature.level} {creature.archetype}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <span className="flex items-center gap-2 text-ink-soft">
            <Activity className="size-3.5 text-ember" />
            {creature.hp} health
          </span>
          <span className="flex items-center gap-2 text-ink-soft">
            <Zap className="size-3.5 text-gold" />
            {creature.attack} attack
          </span>
          <span className="flex items-center gap-2 text-ink-soft">
            <Shield className="size-3.5 text-tide" />
            {creature.defense} defense
          </span>
          <span className="flex items-center gap-2 text-ink-soft">
            <Swords className="size-3.5 text-gale" />
            {creature.wins} wins
          </span>
        </div>
      </div>
    </Link>
  );
}

function MoveCard({ move }: { move: Move }) {
  return (
    <Link
      href={`/bestiary/moves/${move.move_id}`}
      className="card card-hover block p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{move.element}</Badge>
        <Badge className="border-rune/30 text-rune">
          {titleCase(move.effect_kind)}
        </Badge>
        {move.scaling !== "none" ? (
          <Badge className="border-gale/30 text-gale">
            {titleCase(move.scaling)}
          </Badge>
        ) : null}
        <span className="ml-auto font-mono text-[10px] text-ink-faint">
          {move.move_id}
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl font-bold text-parch">
        {move.name}
      </h3>
      <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-ink-soft">
        “{move.prompt}”
      </p>
      <div className="mt-5 grid grid-cols-4 divide-x divide-line border-y border-line py-3 text-center">
        {[
          ["Power", move.power],
          ["Mana", move.mana_cost],
          ["Wait", move.cooldown],
          ["Aim", `${move.accuracy}%`],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="font-mono text-sm font-bold text-parch">{value}</p>
            <p className="mt-1 text-[10px] uppercase text-ink-faint">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 line-clamp-2 text-xs leading-5 text-ink-faint">
        {move.verdict}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-ink-faint">
          Forged {formatAgo(move.forged_at)}
        </span>
        <span className="flex items-center gap-1 font-mono text-xs text-gold">
          <Sparkles className="size-3.5" />
          budget {move.power_budget}
        </span>
      </div>
    </Link>
  );
}

export function BestiaryBrowser({
  creatures,
  moves,
}: {
  creatures: Creature[];
  moves: Move[];
}) {
  const [tab, setTab] = useState<"creatures" | "moves">("creatures");
  const [query, setQuery] = useState("");
  const [element, setElement] = useState<"all" | ElementName>("all");

  const filteredCreatures = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return creatures.filter(
      (creature) =>
        (element === "all" || creature.element === element) &&
        (!needle ||
          creature.name.toLowerCase().includes(needle) ||
          creature.archetype.toLowerCase().includes(needle))
    );
  }, [creatures, element, query]);

  const filteredMoves = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...moves]
      .reverse()
      .filter(
        (move) =>
          (element === "all" || move.element === element) &&
          (!needle ||
            move.name.toLowerCase().includes(needle) ||
            move.prompt.toLowerCase().includes(needle) ||
            move.effect_kind.toLowerCase().includes(needle))
      );
  }, [element, moves, query]);

  return (
    <div>
      <div className="flex flex-col gap-4 border-y border-line py-4 lg:flex-row lg:items-center">
        <div className="inline-grid w-fit grid-cols-2 rounded-md border border-line bg-dusk p-1">
          {[
            ["creatures", `Creatures ${creatures.length}`],
            ["moves", `Moves ${moves.length}`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as "creatures" | "moves")}
              className={clsx(
                "ring-focus rounded px-4 py-2 text-sm font-semibold",
                tab === value
                  ? "bg-surface-2 text-parch"
                  : "text-ink-soft hover:text-parch"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "creatures" ? "Find a creature" : "Find a move"}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...ELEMENTS] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setElement(item)}
              className={clsx(
                "ring-focus rounded-md border px-3 py-2 text-xs font-semibold",
                element === item
                  ? "border-line-strong bg-surface-2 text-parch"
                  : "border-transparent text-ink-faint hover:bg-surface hover:text-parch"
              )}
            >
              {titleCase(item)}
            </button>
          ))}
        </div>
      </div>

      {tab === "creatures" ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCreatures.map((creature) => (
            <CreatureCard key={creature.creature_id} creature={creature} />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMoves.map((move) => (
            <MoveCard key={move.move_id} move={move} />
          ))}
        </div>
      )}

      {(tab === "creatures" ? filteredCreatures : filteredMoves).length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line p-10 text-center text-sm text-ink-soft">
          Nothing matches. Either the filter is fussy or the creatures are
          hiding.
        </div>
      ) : null}
    </div>
  );
}
