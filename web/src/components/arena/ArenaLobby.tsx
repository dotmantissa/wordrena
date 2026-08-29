"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudSun, RefreshCw, Swords } from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { useWordrenaAuth } from "@/components/auth/AuthProvider";
import { BiomeScene } from "@/components/game/BiomeScene";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson, runAction } from "@/lib/clientApi";
import { titleCase } from "@/lib/format";
import type { Battle, Biome, Creature, Move } from "@/lib/types";

type RosterCreature = Creature & { moves: Move[] };
type RosterResponse = { creatures: RosterCreature[] };

export function ArenaLobby({
  creatures,
  biomes,
  battles,
}: {
  creatures: Creature[];
  biomes: Biome[];
  battles: Battle[];
}) {
  const router = useRouter();
  const { authenticated, user } = useWordrenaAuth();
  const [roster, setRoster] = useState<RosterCreature[]>([]);
  const [attackerId, setAttackerId] = useState("");
  const [defenderId, setDefenderId] = useState("");
  const [biomeKey, setBiomeKey] = useState(biomes[0]?.key || "");
  const [working, setWorking] = useState(false);
  const [refreshing, setRefreshing] = useState("");
  const [error, setError] = useState("");

  const loadRoster = useCallback(async () => {
    if (!authenticated) return;
    const data = await apiJson<RosterResponse>("/api/state/roster");
    const ready = data.creatures.filter((creature) => creature.moves.length > 0);
    setRoster(ready);
    setAttackerId((current) => current || ready[0]?.creature_id || "");
  }, [authenticated]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const opponents = useMemo(
    () =>
      creatures.filter(
        (creature) =>
          creature.creature_id !== attackerId &&
          creature.move_ids.length > 0
      ),
    [attackerId, creatures]
  );

  useEffect(() => {
    if (!opponents.some((creature) => creature.creature_id === defenderId)) {
      setDefenderId(opponents[0]?.creature_id || "");
    }
  }, [defenderId, opponents]);

  async function duel(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      await runAction("duel", { attackerId, defenderId, biomeKey });
      const detail = await apiJson<{ battles: Battle[] }>(
        `/api/state/creature/${attackerId}`
      );
      const latest = detail.battles[0];
      if (latest) router.push(`/arena/${latest.battle_id}`);
      else router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The duel failed");
    } finally {
      setWorking(false);
    }
  }

  async function refreshBiome(key: string) {
    setRefreshing(key);
    setError("");
    try {
      await runAction("refreshBiome", { biomeKey: key });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sky stayed quiet");
    } finally {
      setRefreshing("");
    }
  }

  return (
    <div className="grid gap-10">
      <section className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="font-mono text-[11px] uppercase text-gold">
            Start a fight
          </p>
          {!authenticated ? (
            <div className="mt-6 text-center">
              <Swords className="mx-auto size-8 text-gold" />
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                Sign in to send one of your creatures into the arena. Watching
                other people make choices remains free.
              </p>
              <div className="mt-5 flex justify-center">
                <AuthButton />
              </div>
            </div>
          ) : (
            <form onSubmit={duel} className="mt-5 grid gap-5">
              <FieldLabel label="Your fighter">
                <Select
                  value={attackerId}
                  onChange={(event) => setAttackerId(event.target.value)}
                  required
                >
                  {!roster.length ? (
                    <option value="">No battle ready creatures</option>
                  ) : null}
                  {roster.map((creature) => (
                    <option
                      key={creature.creature_id}
                      value={creature.creature_id}
                    >
                      {creature.name} · level {creature.level}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <FieldLabel label="Opponent">
                <Select
                  value={defenderId}
                  onChange={(event) => setDefenderId(event.target.value)}
                  required
                >
                  {!opponents.length ? (
                    <option value="">No opponents are ready</option>
                  ) : null}
                  {opponents.map((creature) => (
                    <option
                      key={creature.creature_id}
                      value={creature.creature_id}
                    >
                      {creature.name} · {titleCase(creature.element)}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <FieldLabel label="Biome">
                <Select
                  value={biomeKey}
                  onChange={(event) => setBiomeKey(event.target.value)}
                  required
                >
                  {biomes.map((biome) => (
                    <option key={biome.key} value={biome.key}>
                      {biome.name} · {biome.buff_pct}% {biome.home_element}
                    </option>
                  ))}
                </Select>
              </FieldLabel>
              <Button
                type="submit"
                disabled={working || !attackerId || !defenderId || !biomeKey}
              >
                {working ? <Spinner /> : <Swords className="size-4" />}
                {working ? "Resolving every turn" : "Begin duel"}
              </Button>
              {!roster.length ? (
                <p className="text-xs leading-5 text-ink-faint">
                  A fighter needs at least one forged move before it can enter.
                </p>
              ) : null}
            </form>
          )}
          {user ? (
            <p className="mt-5 truncate border-t border-line pt-4 font-mono text-[10px] text-ink-faint">
              Fighting as {user.wallet}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-md border border-ember/30 bg-ember/5 p-3 text-sm text-ember">
              {error}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {biomes.map((biome) => (
            <BiomeScene
              key={biome.key}
              name={biome.name}
              homeElement={biome.home_element}
              conditions={biome.conditions}
              buffPct={biome.buff_pct}
              hazard={biome.hazard}
              source={biome.source}
              selected={biomeKey === biome.key}
              onSelect={() => setBiomeKey(biome.key)}
              className="min-h-60"
            >
              <div className="flex justify-end px-3">
                <Button
                  variant="secondary"
                  className="min-h-8 bg-void/80 px-3 py-1 text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    void refreshBiome(biome.key);
                  }}
                  disabled={!authenticated || Boolean(refreshing)}
                  title="Ask the validators for a fresh weather reading"
                >
                  {refreshing === biome.key ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Refresh sky
                </Button>
              </div>
            </BiomeScene>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase text-tide">
              Public record
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-parch">
              Recent battles
            </h2>
          </div>
          <Badge className="border-tide/30 text-tide">
            <CloudSun className="mr-1 size-3" />
            Live biomes
          </Badge>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {battles.map((battle) => {
            const winner =
              battle.winner_id === battle.attacker_id
                ? battle.attacker_name
                : battle.defender_name;
            return (
              <button
                key={battle.battle_id}
                type="button"
                onClick={() => router.push(`/arena/${battle.battle_id}`)}
                className="card card-hover grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4 p-5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-parch">
                    {battle.attacker_name}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {battle.attacker_hp_left} health left
                  </p>
                </div>
                <div className="text-center">
                  <Swords className="mx-auto size-5 text-gold" />
                  <p className="mt-1 font-mono text-[9px] uppercase text-ink-faint">
                    {battle.turns} turns
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="truncate font-semibold text-parch">
                    {battle.defender_name}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {battle.defender_hp_left} health left
                  </p>
                </div>
                <p className="col-span-3 border-t border-line pt-3 text-xs text-ink-soft">
                  {winner} won in {titleCase(battle.biome_key)}.{" "}
                  {battle.summary}
                </p>
              </button>
            );
          })}
          {!battles.length ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-sm text-ink-soft">
              No battles yet. Six biomes prepared all this weather for nothing.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
