"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clipboard,
  FlaskConical,
  RefreshCw,
  Swords,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { useWordrenaAuth } from "@/components/auth/AuthProvider";
import { CreatureArt } from "@/components/game/CreatureArt";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson, runAction } from "@/lib/clientApi";
import { formatAgo, shortAddress, titleCase } from "@/lib/format";
import type {
  Creature,
  Move,
  TransactionRecord,
} from "@/lib/types";

type RosterCreature = Creature & { moves: Move[] };
type RosterResponse = {
  user: {
    userId: string;
    privyId: string;
    email: string;
    wallet: string;
  };
  creatures: RosterCreature[];
  transactions: TransactionRecord[];
};

export function RosterDashboard() {
  const { authenticated, user } = useWordrenaAuth();
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!authenticated) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await apiJson<RosterResponse>("/api/state/roster"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load roster");
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function levelUp(creatureId: string) {
    setWorking(creatureId);
    setError("");
    try {
      await runAction("levelUp", { creatureId });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Level up failed");
    } finally {
      setWorking("");
    }
  }

  async function retireMove(moveId: string) {
    if (!window.confirm("Retire this move? It leaves the active kit for good.")) {
      return;
    }
    setWorking(moveId);
    setError("");
    try {
      await runAction("retireMove", { moveId });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not retire move");
    } finally {
      setWorking("");
    }
  }

  async function copyWallet() {
    if (!user?.wallet) return;
    await navigator.clipboard.writeText(user.wallet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!authenticated) {
    return (
      <div className="grid min-h-80 place-items-center rounded-lg border border-line bg-surface p-8 text-center">
        <div className="max-w-md">
          <WalletCards className="mx-auto size-9 text-gold" />
          <h2 className="mt-4 font-display text-2xl font-bold text-parch">
            Your stable is private
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            Sign in with the email you used to craft. Your creatures are owned
            by the same quiet player wallet every time.
          </p>
          <div className="mt-6 flex justify-center">
            <AuthButton />
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="grid min-h-72 place-items-center text-ink-soft">
        <span className="flex items-center gap-3">
          <Spinner />
          Reading your on chain roster
        </span>
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      <section className="grid gap-5 rounded-lg border border-line bg-surface p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-parch">{user?.email}</p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <code className="truncate font-mono text-xs text-ink-faint">
              {user?.wallet}
            </code>
            <button
              type="button"
              onClick={() => void copyWallet()}
              className="ring-focus grid size-8 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-surface-2 hover:text-parch"
              aria-label="Copy player wallet address"
              title="Copy player wallet address"
            >
              {copied ? (
                <Check className="size-4 text-gale" />
              ) : (
                <Clipboard className="size-4" />
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Wordrena signs with this encrypted wallet on your behalf. The key
            never reaches this page.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? <Spinner /> : <RefreshCw className="size-4" />}
          Refresh roster
        </Button>
      </section>

      {error ? (
        <p className="rounded-md border border-ember/30 bg-ember/5 p-4 text-sm text-ember">
          {error}
        </p>
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase text-gold">
              Your creatures
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-parch">
              Roster
            </h2>
          </div>
          <Link
            href="/forge"
            className="ring-focus inline-flex min-h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-parch hover:border-gold/40"
          >
            <FlaskConical className="size-4" />
            Craft another
          </Link>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {data?.creatures.map((creature) => {
            const progress = Math.min(
              100,
              (creature.xp / Math.max(1, creature.xp_to_next)) * 100
            );
            const canLevel = creature.xp >= creature.xp_to_next;
            return (
              <article
                key={creature.creature_id}
                className="card overflow-hidden"
              >
                <div className="grid md:grid-cols-[190px_1fr]">
                  <Link
                    href={`/bestiary/creatures/${creature.creature_id}`}
                    className="grid min-h-52 place-items-end border-b border-line bg-dusk p-4 md:border-b-0 md:border-r"
                  >
                    <CreatureArt
                      name={creature.name}
                      element={creature.element}
                      active
                      className="h-44 w-full"
                    />
                  </Link>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{creature.element}</Badge>
                      <Badge>level {creature.level}</Badge>
                      <span className="ml-auto font-mono text-[10px] text-ink-faint">
                        {creature.creature_id}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-bold text-parch">
                      {creature.name}
                    </h3>
                    <p className="mt-1 text-xs text-ink-faint">
                      {creature.archetype} · {creature.wins} wins ·{" "}
                      {creature.losses} losses
                    </p>
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-soft">Experience</span>
                        <span className="font-mono text-ink-faint">
                          {creature.xp} / {creature.xp_to_next}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-sm bg-void">
                        <div
                          className="h-full bg-gold"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button
                        variant={canLevel ? "primary" : "secondary"}
                        onClick={() => void levelUp(creature.creature_id)}
                        disabled={!canLevel || Boolean(working)}
                      >
                        {working === creature.creature_id ? (
                          <Spinner />
                        ) : (
                          <TrendingUp className="size-4" />
                        )}
                        Level up
                      </Button>
                      <Link
                        href={`/arena?fighter=${creature.creature_id}`}
                        className="ring-focus inline-flex min-h-10 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-4 py-2 text-sm font-semibold text-parch hover:border-tide/40"
                      >
                        <Swords className="size-4" />
                        Fight
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="border-t border-line p-4">
                  <p className="text-[10px] uppercase text-ink-faint">
                    Active move kit
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {creature.moves.map((move) => (
                      <div
                        key={move.move_id}
                        className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-line bg-dusk p-3"
                      >
                        <Link
                          href={`/bestiary/moves/${move.move_id}`}
                          className="min-w-0"
                        >
                          <p className="truncate text-sm font-semibold text-parch hover:text-gold">
                            {move.name}
                          </p>
                          <p className="mt-1 text-[10px] uppercase text-ink-faint">
                            {move.power} power · {titleCase(move.effect_kind)}
                          </p>
                        </Link>
                        <button
                          type="button"
                          onClick={() => void retireMove(move.move_id)}
                          disabled={Boolean(working)}
                          className="ring-focus grid size-8 place-items-center rounded-md text-ink-faint hover:bg-ember/10 hover:text-ember disabled:opacity-40"
                          aria-label={`Retire ${move.name}`}
                          title={`Retire ${move.name}`}
                        >
                          {working === move.move_id ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      </div>
                    ))}
                    {!creature.moves.length ? (
                      <Link
                        href="/forge"
                        className="rounded-md border border-dashed border-line p-3 text-sm text-ink-soft hover:border-gold/30 hover:text-parch"
                      >
                        Write this creature a move
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          {!data?.creatures.length ? (
            <div className="rounded-lg border border-dashed border-line p-10 text-center">
              <FlaskConical className="mx-auto size-8 text-ink-faint" />
              <p className="mt-4 text-sm text-ink-soft">
                Your roster is empty. The stable is immaculate and completely
                useless.
              </p>
              <Link
                href="/forge"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold"
              >
                Craft your first creature
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <div>
          <p className="font-mono text-[11px] uppercase text-rune">
            Relayed activity
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-parch">
            Transaction history
          </h2>
        </div>
        <div className="mt-5 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-dusk text-[10px] uppercase text-ink-faint">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Contract</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {data?.transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-t border-line text-ink-soft"
                >
                  <td className="px-4 py-4 font-medium text-parch">
                    {titleCase(transaction.action)}
                  </td>
                  <td className="px-4 py-4">
                    {titleCase(transaction.contractName)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-2">
                      {transaction.status === "finalized" ? (
                        <Check className="size-4 text-gale" />
                      ) : transaction.status === "failed" ? (
                        <X className="size-4 text-ember" />
                      ) : (
                        <Spinner className="size-3.5 text-gold" />
                      )}
                      {titleCase(transaction.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs">
                    {transaction.txHash
                      ? shortAddress(transaction.txHash, 10, 8)
                      : "Waiting"}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {formatAgo(
                      Math.floor(new Date(transaction.createdAt).getTime() / 1000)
                    )}
                  </td>
                </tr>
              ))}
              {!data?.transactions.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                    No relayed actions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
