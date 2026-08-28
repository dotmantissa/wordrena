"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { CreatureArt } from "./CreatureArt";
import { BiomeScene } from "./BiomeScene";

export type BattleLogEntry = {
  turn?: number;
  actor?: string;
  target?: string;
  move?: string;
  kind?: string;
  damage?: number;
  heal?: number;
  text?: string;
  attacker_hp?: number;
  defender_hp?: number;
  [key: string]: unknown;
};

export type BattleStageData = {
  attacker: { id: string; name: string; element: string; maxHp: number };
  defender: { id: string; name: string; element: string; maxHp: number };
  attackerHpLeft: number;
  defenderHpLeft: number;
  winnerId: string;
  biome: {
    name: string;
    homeElement: string;
    conditions: string;
    buffPct: number;
    hazard: number;
    source: string;
  };
  log: BattleLogEntry[];
};

function entryText(entry: BattleLogEntry) {
  if (entry.text) return entry.text;
  const actor = String(entry.actor || "A creature");
  const move = entry.move ? ` uses ${entry.move}` : "";
  if (entry.kind === "miss") return `${actor}${move}, and misses. Awkward.`;
  if (entry.kind === "stun") return `${actor} loses the turn to a stun.`;
  if (entry.kind === "heal") return `${actor}${move} and recovers ${entry.heal || 0} health.`;
  if (entry.damage) return `${actor}${move} for ${entry.damage} damage.`;
  return `${actor}${move}.`;
}

function HealthBar({
  name,
  value,
  max,
  align = "left",
}: {
  name: string;
  value: number;
  max: number;
  align?: "left" | "right";
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-parch">
        <span>{name}</span>
        <span className="font-mono text-[10px] text-ink-soft">
          {value} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-sm bg-void/70">
        <motion.div
          className="h-full bg-gale"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35 }}
        />
      </div>
    </div>
  );
}

export function BattleStage({ battle }: { battle: BattleStageData }) {
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const current = cursor >= 0 ? battle.log[cursor] : undefined;

  const health = useMemo(() => {
    let attacker = battle.attacker.maxHp;
    let defender = battle.defender.maxHp;
    for (let index = 0; index <= cursor; index += 1) {
      const item = battle.log[index];
      if (typeof item?.attacker_hp === "number") attacker = item.attacker_hp;
      if (typeof item?.defender_hp === "number") defender = item.defender_hp;
    }
    if (cursor === battle.log.length - 1) {
      attacker = battle.attackerHpLeft;
      defender = battle.defenderHpLeft;
    }
    return { attacker, defender };
  }, [battle, cursor]);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= battle.log.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setCursor((value) => value + 1), 1050);
    return () => window.clearTimeout(timer);
  }, [battle.log.length, cursor, playing]);

  function restart() {
    setCursor(-1);
    setPlaying(true);
  }

  return (
    <div className="grid gap-3">
      <BiomeScene {...battle.biome} className="min-h-[420px]">
        <div className="grid grid-cols-2 items-end gap-5 px-5 sm:px-10">
          <motion.div
            animate={current?.actor === battle.attacker.name ? { x: [0, 18, 0] } : {}}
            transition={{ duration: 0.42 }}
          >
            <CreatureArt
              name={battle.attacker.name}
              element={battle.attacker.element}
              active={playing}
              className="mx-auto h-36 max-w-48 sm:h-44"
            />
            <HealthBar
              name={battle.attacker.name}
              value={health.attacker}
              max={battle.attacker.maxHp}
            />
          </motion.div>
          <motion.div
            animate={current?.actor === battle.defender.name ? { x: [0, -18, 0] } : {}}
            transition={{ duration: 0.42 }}
          >
            <CreatureArt
              name={battle.defender.name}
              element={battle.defender.element}
              facing="left"
              active={playing}
              className="mx-auto h-36 max-w-48 sm:h-44"
            />
            <HealthBar
              name={battle.defender.name}
              value={health.defender}
              max={battle.defender.maxHp}
              align="right"
            />
          </motion.div>
        </div>
      </BiomeScene>

      <div className="grid min-h-24 items-center gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase text-gold">
            {cursor < 0
              ? "The bell is waiting"
              : `Exchange ${cursor + 1} of ${battle.log.length}`}
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={cursor}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-1 text-sm leading-6 text-parch"
            >
              {current
                ? entryText(current)
                : "Press play. The creatures have already fought, but they still enjoy the drama."}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1 justify-self-end">
          <Button variant="quiet" onClick={restart} title="Replay battle" aria-label="Replay battle">
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="secondary"
            onClick={() => setPlaying((value) => !value)}
            title={playing ? "Pause battle" : "Play battle"}
            aria-label={playing ? "Pause battle" : "Play battle"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            variant="quiet"
            onClick={() =>
              setCursor((value) => Math.min(battle.log.length - 1, value + 1))
            }
            disabled={cursor >= battle.log.length - 1}
            title="Next exchange"
            aria-label="Next exchange"
          >
            <SkipForward className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
