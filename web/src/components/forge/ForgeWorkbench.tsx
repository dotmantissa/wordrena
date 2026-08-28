"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Check,
  ChevronRight,
  Dices,
  Feather,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { AuthButton } from "@/components/auth/AuthButton";
import { useWordrenaAuth } from "@/components/auth/AuthProvider";
import { CreatureArt } from "@/components/game/CreatureArt";
import {
  ELEMENTS,
  elementSoftTone,
  elementTone,
  type ElementName,
} from "@/components/game/elements";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  FieldLabel,
  Input,
  Select,
  Textarea,
} from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson, runAction } from "@/lib/clientApi";
import { titleCase } from "@/lib/format";
import type { Creature, Move, TransactionRecord } from "@/lib/types";

type RosterCreature = Creature & { moves: Move[] };
type RosterResponse = {
  creatures: RosterCreature[];
  transactions: TransactionRecord[];
};

const promptSeeds = [
  "A quick strike that grows stronger when my health is low",
  "A veil of mist that ruins the enemy aim for two turns",
  "A heavy blow that hurts me too, because apparently courage has no brakes",
];

export function ForgeWorkbench() {
  const { authenticated, user } = useWordrenaAuth();
  const [mode, setMode] = useState<"creature" | "move">("creature");
  const [roster, setRoster] = useState<RosterCreature[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creatureName, setCreatureName] = useState("");
  const [element, setElement] = useState<ElementName>("ember");
  const [creatureId, setCreatureId] = useState("");
  const [moveName, setMoveName] = useState("");
  const [prompt, setPrompt] = useState("");

  const loadRoster = useCallback(async () => {
    if (!authenticated) {
      setRoster([]);
      return;
    }
    setLoadingRoster(true);
    try {
      const data = await apiJson<RosterResponse>("/api/state/roster");
      setRoster(data.creatures);
      setCreatureId((current) => current || data.creatures[0]?.creature_id || "");
    } finally {
      setLoadingRoster(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const selected = useMemo(
    () => roster.find((creature) => creature.creature_id === creatureId),
    [creatureId, roster]
  );

  async function craftCreature(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setSuccess("");
    try {
      await runAction("craftCreature", { name: creatureName, element });
      setSuccess(`${creatureName} is alive and probably already judging you.`);
      setCreatureName("");
      await loadRoster();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Crafting failed");
    } finally {
      setWorking(false);
    }
  }

  async function forgeMove(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setSuccess("");
    try {
      await runAction("forgeMove", {
        creatureId,
        name: moveName,
        prompt,
      });
      setSuccess(
        "Consensus has spoken. The move is now part of your creature kit."
      );
      setMoveName("");
      setPrompt("");
      await loadRoster();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The forge went quiet");
    } finally {
      setWorking(false);
    }
  }

  if (!authenticated) {
    return (
      <Panel className="grid min-h-72 place-items-center p-8 text-center">
        <div className="max-w-md">
          <Feather className="mx-auto size-8 text-gold" />
          <h2 className="mt-4 font-display text-2xl font-bold text-parch">
            Bring an email and an idea
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            Your player wallet appears quietly after sign in. No seed phrase,
            no wallet popups, no tiny confirmation window hiding behind your
            browser.
          </p>
          <div className="mt-6 flex justify-center">
            <AuthButton />
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div>
        <div
          className="inline-grid grid-cols-2 rounded-md border border-line bg-dusk p-1"
          role="tablist"
          aria-label="Forge mode"
        >
          {[
            ["creature", "Craft creature"],
            ["move", "Write a move"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value as "creature" | "move")}
              className={clsx(
                "ring-focus rounded px-4 py-2 text-sm font-semibold",
                mode === value
                  ? "bg-surface-2 text-gold-soft"
                  : "text-ink-soft hover:text-parch"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "creature" ? (
          <form onSubmit={craftCreature} className="mt-6 grid gap-6">
            <FieldLabel label="Creature name" hint={`${creatureName.length} / 28`}>
              <Input
                value={creatureName}
                onChange={(event) => setCreatureName(event.target.value)}
                minLength={2}
                maxLength={28}
                placeholder="Cinderpaw"
                required
              />
            </FieldLabel>

            <fieldset>
              <legend className="text-sm font-medium text-parch">Element</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ELEMENTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setElement(item)}
                    className={clsx(
                      "ring-focus flex min-h-12 items-center gap-3 rounded-md border px-3 text-left text-sm font-semibold",
                      element === item
                        ? "border-current bg-white/5 text-parch"
                        : "border-line bg-dusk text-ink-soft hover:border-line-strong"
                    )}
                    style={
                      element === item ? { color: elementTone[item] } : undefined
                    }
                  >
                    <span
                      className="size-3 rounded-sm"
                      style={{ backgroundColor: elementTone[item] }}
                    />
                    <span className="text-current">{titleCase(item)}</span>
                    {element === item ? (
                      <Check className="ml-auto size-4" />
                    ) : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={working || creatureName.trim().length < 2}
              >
                {working ? <Spinner /> : <Sparkles className="size-4" />}
                {working ? "Bringing it to life" : "Craft creature"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={forgeMove} className="mt-6 grid gap-6">
            <FieldLabel label="Creature" hint="Four moves fit in a kit">
              <Select
                value={creatureId}
                onChange={(event) => setCreatureId(event.target.value)}
                disabled={loadingRoster || roster.length === 0}
                required
              >
                {roster.length === 0 ? (
                  <option value="">Craft a creature first</option>
                ) : null}
                {roster.map((creature) => (
                  <option key={creature.creature_id} value={creature.creature_id}>
                    {creature.name} · {creature.moves.length}/4 moves
                  </option>
                ))}
              </Select>
            </FieldLabel>

            <FieldLabel label="Move name" hint={`${moveName.length} / 36`}>
              <Input
                value={moveName}
                onChange={(event) => setMoveName(event.target.value)}
                minLength={2}
                maxLength={36}
                placeholder="Emberlash Pounce"
                required
              />
            </FieldLabel>

            <FieldLabel label="What does it do?" hint={`${prompt.length} / 600`}>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                minLength={12}
                maxLength={600}
                placeholder="Write it the way you would explain it to a friend who takes game balance suspiciously seriously."
                required
              />
            </FieldLabel>

            <div className="flex flex-wrap gap-2">
              <span className="w-full text-xs text-ink-faint">
                Need a nudge?
              </span>
              {promptSeeds.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  onClick={() => setPrompt(seed)}
                  className="ring-focus rounded-md border border-line px-3 py-2 text-left text-xs text-ink-soft hover:border-rune/40 hover:text-parch"
                >
                  {seed}
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  working ||
                  !creatureId ||
                  moveName.trim().length < 2 ||
                  prompt.trim().length < 12 ||
                  Boolean(selected && selected.moves.length >= 4)
                }
              >
                {working ? <Spinner /> : <BrainCircuit className="size-4" />}
                {working ? "Validators are reading" : "Ask consensus"}
              </Button>
            </div>
          </form>
        )}

        {error ? (
          <p className="mt-5 rounded-md border border-ember/30 bg-ember/5 p-4 text-sm text-ember">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-5 rounded-md border border-gale/30 bg-gale/5 p-4 text-sm text-gale">
            {success}
          </p>
        ) : null}
      </div>

      <aside className="border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        {mode === "creature" ? (
          <>
            <p className="font-mono text-[11px] uppercase text-gold">
              Creature preview
            </p>
            <div
              className="mt-4 min-h-80 overflow-hidden rounded-lg border border-line bg-dusk p-6"
              style={{
                boxShadow: `inset 0 3px 0 ${elementTone[element]}55`,
              }}
            >
              <CreatureArt
                name={creatureName || "Unnamed"}
                element={element}
                active
                className="mx-auto h-52 max-w-64"
              />
              <div className="mt-3 text-center">
                <Badge
                  style={{
                    color: elementSoftTone[element],
                    borderColor: `${elementTone[element]}55`,
                  }}
                >
                  {element}
                </Badge>
                <h2 className="mt-3 font-display text-2xl font-bold text-parch">
                  {creatureName || "Name pending"}
                </h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Stats settle on chain from its element and name. Even spelling
                  has consequences here.
                </p>
              </div>
            </div>
          </>
        ) : selected ? (
          <>
            <p className="font-mono text-[11px] uppercase text-rune">
              Current kit
            </p>
            <div className="mt-4 flex items-center gap-4">
              <CreatureArt
                name={selected.name}
                element={selected.element}
                className="h-24 w-28"
              />
              <div>
                <h2 className="font-display text-xl font-bold text-parch">
                  {selected.name}
                </h2>
                <p className="mt-1 text-xs text-ink-faint">
                  Level {selected.level} · {titleCase(selected.archetype)}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {selected.moves.map((move) => (
                <div
                  key={move.move_id}
                  className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-line bg-dusk p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-parch">
                      {move.name}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      {titleCase(move.effect_kind)} · {move.accuracy}% accurate
                    </p>
                  </div>
                  <p className="font-mono text-sm font-bold text-gold">
                    {move.power}
                  </p>
                </div>
              ))}
              {selected.moves.length === 0 ? (
                <div className="rounded-md border border-dashed border-line p-4 text-sm text-ink-soft">
                  Empty kit. A creature with no moves is mostly a complicated
                  houseplant.
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="grid min-h-72 place-items-center text-center">
            <div>
              <Dices className="mx-auto size-7 text-ink-faint" />
              <p className="mt-3 text-sm text-ink-soft">
                Craft a creature before teaching one tricks.
              </p>
              <Button
                variant="quiet"
                className="mt-3"
                onClick={() => setMode("creature")}
              >
                Start with a creature
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {user ? (
          <p className="mt-6 break-all border-t border-line pt-4 font-mono text-[10px] text-ink-faint">
            Player wallet {user.wallet}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
