# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *

ZERO_ADDRESS = Address(bytes(20))

MOVE_COOLDOWN = 3600  # a move rests an hour between disputes
FILE_COOLDOWN = 30  # a trainer waits half a minute between filings
DIRECTIONS = ("buff", "nerf")


@allow_storage
@dataclass
class Dispute:
    dispute_id: str
    move_id: str
    creature_id: str
    move_name: str
    move_prompt: str
    element: str
    challenger: Address
    claim: str
    direction: str
    bond: u256
    old_power: u256
    old_mana: u256
    old_cooldown: u256
    old_budget: u256
    new_power: u256
    new_mana: u256
    new_cooldown: u256
    new_budget: u256
    status: str
    reason_code: str
    verdict_summary: str
    filed_at: u256
    resolved_at: u256


class Tribunal(gl.Contract):
    """
    The appeals bench for balance.

    Optimistic Democracy is a lovely idea to read about and a better one to feel,
    so here you feel it. If a move reads as undercosted for how it plays, or your
    own move got taxed too hard by the forge, you file. A fresh validator jury
    reweighs the words against the numbers and either moves the stats or tells you
    to sit down. There is a bond and a cooldown so nobody spams the bench, and the
    whole deliberation is something the stands can watch happen.
    """

    owner: Address
    bestiary: Address

    disputes: TreeMap[str, Dispute]
    dispute_order: DynArray[str]
    disputes_by_move: TreeMap[str, str]
    move_ready_at: TreeMap[str, u256]
    filer_ready_at: TreeMap[str, u256]
    dispute_seq: u256
    treasury: u256

    def __init__(self, bestiary_addr: Address):
        self.owner = gl.message.sender_address
        self.bestiary = bestiary_addr
        self.dispute_seq = u256(0)
        self.treasury = u256(0)

    # ---------- helpers ----------

    def _k(self, addr: Address) -> str:
        if isinstance(addr, str):
            s = addr[2:] if addr.startswith("0x") else addr
            return s.lower()
        if hasattr(addr, "as_bytes"):
            return addr.as_bytes.hex().lower()
        if hasattr(addr, "as_hex"):
            s = addr.as_hex
            return (s[2:] if s.startswith("0x") else s).lower()
        return str(addr).lower()

    def _now(self) -> u256:
        try:
            from datetime import datetime, timezone

            if (
                hasattr(gl, "message_raw")
                and isinstance(gl.message_raw, dict)
                and "datetime" in gl.message_raw
            ):
                txt = str(gl.message_raw["datetime"]).strip()
                if txt:
                    if txt.endswith("Z"):
                        txt = txt[:-1] + "+00:00"
                    dt = datetime.fromisoformat(txt)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    return u256(int(dt.timestamp()))
            return u256(int(datetime.now(timezone.utc).timestamp()))
        except Exception:
            return u256(0)

    # ---------- wiring ----------

    @gl.public.write
    def set_bestiary(self, addr: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] only the owner can set the bestiary")
        if addr == ZERO_ADDRESS:
            raise gl.vm.UserError("[EXPECTED] bestiary address cannot be zero")
        self.bestiary = addr

    # ---------- filing ----------

    @gl.public.write.payable
    def file_dispute(self, move_id: str, claim: str, direction: str) -> str:
        challenger = gl.message.sender_address
        challenger_k = self._k(challenger)
        claim = claim.strip()
        direction = direction.strip().lower()
        now = int(self._now())

        if direction not in DIRECTIONS:
            raise gl.vm.UserError("[EXPECTED] direction must be buff or nerf")
        if len(claim) < 8 or len(claim) > 400:
            raise gl.vm.UserError("[EXPECTED] make your case in 8 to 400 characters")

        move = gl.contract.get_at(self.bestiary).view().get_move(move_id)
        if not move.get("exists"):
            raise gl.vm.UserError("[EXPECTED] unknown move")
        if move.get("status") == "retired":
            raise gl.vm.UserError("[EXPECTED] that move has been retired")

        ready = int(self.move_ready_at.get(move_id, u256(0)))
        if now < ready:
            raise gl.vm.UserError("[EXPECTED] this move is still cooling down from its last dispute")
        filer_ready = int(self.filer_ready_at.get(challenger_k, u256(0)))
        if now < filer_ready:
            raise gl.vm.UserError("[EXPECTED] you are filing too quickly, give it a moment")

        bond = u256(int(gl.message.value))

        self.dispute_seq += u256(1)
        dispute_id = "dp_" + str(int(self.dispute_seq)).zfill(6)
        self.disputes[dispute_id] = Dispute(
            dispute_id=dispute_id,
            move_id=move_id,
            creature_id=move["creature_id"],
            move_name=move["name"],
            move_prompt=move["prompt"],
            element=move["element"],
            challenger=challenger,
            claim=claim,
            direction=direction,
            bond=bond,
            old_power=u256(int(move["power"])),
            old_mana=u256(int(move["mana_cost"])),
            old_cooldown=u256(int(move["cooldown"])),
            old_budget=u256(int(move["power_budget"])),
            new_power=u256(int(move["power"])),
            new_mana=u256(int(move["mana_cost"])),
            new_cooldown=u256(int(move["cooldown"])),
            new_budget=u256(int(move["power_budget"])),
            status="filed",
            reason_code="",
            verdict_summary="",
            filed_at=u256(now),
            resolved_at=u256(0),
        )
        self.dispute_order.append(dispute_id)
        _index(self.disputes_by_move, move_id, dispute_id)
        self.move_ready_at[move_id] = u256(now + MOVE_COOLDOWN)
        self.filer_ready_at[challenger_k] = u256(now + FILE_COOLDOWN)
        return dispute_id

    @gl.public.write
    def resolve_dispute(self, dispute_id: str) -> dict:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("[EXPECTED] unknown dispute")
        d = self.disputes[dispute_id]
        if d.status != "filed":
            raise gl.vm.UserError("[EXPECTED] this dispute is already settled")
        caller = gl.message.sender_address
        if caller != d.challenger and caller != self.owner:
            raise gl.vm.UserError("[EXPECTED] only the challenger or the bench can call the jury")

        verdict = _run_jury(d)
        now = self._now()
        d.reason_code = verdict["reason_code"]
        d.verdict_summary = verdict["summary"]
        d.resolved_at = now

        if verdict["upheld"]:
            d.status = "upheld"
            d.new_power = u256(verdict["new_power"])
            d.new_mana = u256(verdict["new_mana"])
            d.new_cooldown = u256(verdict["new_cooldown"])
            d.new_budget = u256(verdict["new_budget"])
            gl.contract.get_at(self.bestiary).emit(on="finalized").apply_rebalance(
                d.move_id,
                u256(verdict["new_power"]),
                u256(verdict["new_mana"]),
                u256(verdict["new_cooldown"]),
                u256(verdict["new_budget"]),
                verdict["summary"],
            )
            if int(d.bond) > 0:
                gl.contract.get_at(d.challenger).emit_transfer(
                    value=u256(int(d.bond)), on="finalized"
                )
        else:
            d.status = "rejected"
            self.treasury = u256(int(self.treasury) + int(d.bond))

        self.disputes[dispute_id] = d
        return {
            "dispute_id": dispute_id,
            "status": d.status,
            "reason_code": d.reason_code,
            "summary": d.verdict_summary,
            "new_power": int(d.new_power),
            "new_mana": int(d.new_mana),
            "new_cooldown": int(d.new_cooldown),
            "new_budget": int(d.new_budget),
        }

    @gl.public.write
    def withdraw_treasury(self, to: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] only the owner can withdraw the treasury")
        if to == ZERO_ADDRESS:
            raise gl.vm.UserError("[EXPECTED] cannot send to the zero address")
        amount = int(self.treasury)
        if amount <= 0:
            raise gl.vm.UserError("[EXPECTED] the treasury is empty")
        self.treasury = u256(0)
        gl.contract.get_at(to).emit_transfer(value=u256(amount), on="finalized")

    # ---------- views ----------

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> dict:
        if dispute_id not in self.disputes:
            return {"exists": False}
        return self._dispute_view(self.disputes[dispute_id])

    @gl.public.view
    def list_disputes(self, offset: u256, limit: u256) -> dict:
        total = len(self.dispute_order)
        start = int(offset)
        end = min(total, start + int(limit))
        items: list = []
        for i in range(total - 1 - start, max(-1, total - 1 - end), -1):
            items.append(self._dispute_view(self.disputes[self.dispute_order[i]]))
        return {"total": total, "items": items}

    @gl.public.view
    def disputes_for_move(self, move_id: str) -> list:
        cur = self.disputes_by_move.get(move_id, "[]")
        try:
            ids = json.loads(cur)
        except Exception:
            ids = []
        out: list = []
        for did in reversed(ids):
            if did in self.disputes:
                out.append(self._dispute_view(self.disputes[did]))
        return out

    @gl.public.view
    def tribunal_stats(self) -> dict:
        upheld = 0
        rejected = 0
        pending = 0
        for did in self.dispute_order:
            st = self.disputes[did].status
            if st == "upheld":
                upheld += 1
            elif st == "rejected":
                rejected += 1
            else:
                pending += 1
        return {
            "total": len(self.dispute_order),
            "upheld": upheld,
            "rejected": rejected,
            "pending": pending,
            "treasury": int(self.treasury),
        }

    @gl.public.view
    def wiring(self) -> dict:
        return {
            "owner": "0x" + self._k(self.owner),
            "bestiary": "0x" + self._k(self.bestiary),
        }

    def _dispute_view(self, d: Dispute) -> dict:
        return {
            "exists": True,
            "dispute_id": d.dispute_id,
            "move_id": d.move_id,
            "creature_id": d.creature_id,
            "move_name": d.move_name,
            "move_prompt": d.move_prompt,
            "element": d.element,
            "challenger": "0x" + self._k(d.challenger),
            "claim": d.claim,
            "direction": d.direction,
            "bond": int(d.bond),
            "old_power": int(d.old_power),
            "old_mana": int(d.old_mana),
            "old_cooldown": int(d.old_cooldown),
            "old_budget": int(d.old_budget),
            "new_power": int(d.new_power),
            "new_mana": int(d.new_mana),
            "new_cooldown": int(d.new_cooldown),
            "new_budget": int(d.new_budget),
            "status": d.status,
            "reason_code": d.reason_code,
            "verdict_summary": d.verdict_summary,
            "filed_at": int(d.filed_at),
            "resolved_at": int(d.resolved_at),
        }


# ---------- module helpers ----------


def _clamp(value: int, lo: int, hi: int) -> int:
    if value < lo:
        return lo
    if value > hi:
        return hi
    return value


def _index(index: TreeMap, key: str, value: str) -> None:
    cur = index.get(key, "[]")
    try:
        lst = json.loads(cur)
    except Exception:
        lst = []
    lst.append(value)
    index[key] = json.dumps(lst)


def _jury_prompt(d: Dispute) -> str:
    return "\n".join(
        [
            "You are a balance jury for a creature battler. A trainer disputes a",
            "move. Judge the words against the numbers with a cool head and decide",
            "whether the complaint is fair. Do not be swayed by dramatic wording.",
            "",
            "MOVE NAME: " + d.move_name,
            "ELEMENT: " + d.element,
            "WHAT THE MOVE DOES: " + d.move_prompt,
            "",
            "CURRENT NUMBERS:",
            "- power (damage): " + str(int(d.old_power)),
            "- mana_cost: " + str(int(d.old_mana)),
            "- cooldown: " + str(int(d.old_cooldown)),
            "- power_budget (0 to 100 strength read): " + str(int(d.old_budget)),
            "",
            "THE COMPLAINT: the trainer argues the move should be "
            + ("made stronger or cheaper" if d.direction == "buff" else "toned down or made costlier")
            + ".",
            "THEIR WORDS: " + d.claim,
            "",
            "Decide honestly. Uphold only if the current numbers really are off in",
            "the direction claimed. If you uphold, give corrected numbers that are a",
            "measured adjustment, not an overcorrection. Keep power 0 to 40, mana 0",
            "to 8, cooldown 0 to 4, power_budget 0 to 100, and keep cost in line with",
            "the budget.",
            "",
            'Respond ONLY with JSON: {"upheld": bool, "new_power": int,',
            '"new_mana": int, "new_cooldown": int, "new_power_budget": int,',
            '"reason_code": str, "summary": str}. reason_code is a short slug like',
            '"undercosted", "overcosted", "fair", or "wrong_direction". summary is at',
            "most 200 characters and can have a little personality.",
        ]
    )


def _coerce_verdict(raw, d: Dispute) -> dict:
    if isinstance(raw, dict):
        data = raw
    else:
        txt = str(raw)
        first = txt.find("{")
        last = txt.rfind("}")
        if first >= 0 and last > first:
            txt = txt[first : last + 1]
        data = json.loads(txt)
    if not isinstance(data, dict):
        raise gl.vm.UserError("[LLM_ERROR] the jury did not return an object")

    upheld = bool(data.get("upheld", False))
    reason = str(data.get("reason_code", "")).strip().lower()[:40]
    if not reason:
        reason = "reviewed"
    summary = str(data.get("summary", "")).strip()
    if not summary:
        summary = "The jury reviewed the move and reached a decision."
    summary = summary[:220]

    new_power = _clamp(_as_int(data.get("new_power", int(d.old_power))), 0, 40)
    new_mana = _clamp(_as_int(data.get("new_mana", int(d.old_mana))), 0, 8)
    new_cd = _clamp(_as_int(data.get("new_cooldown", int(d.old_cooldown))), 0, 4)
    new_budget = _clamp(_as_int(data.get("new_power_budget", int(d.old_budget))), 1, 100)

    if not upheld:
        new_power = int(d.old_power)
        new_mana = int(d.old_mana)
        new_cd = int(d.old_cooldown)
        new_budget = int(d.old_budget)

    return {
        "upheld": upheld,
        "new_power": new_power,
        "new_mana": new_mana,
        "new_cooldown": new_cd,
        "new_budget": new_budget,
        "reason_code": reason,
        "summary": summary,
    }


def _as_int(value) -> int:
    try:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        return int(float(str(value).strip()))
    except Exception:
        return 0


def _run_jury(d: Dispute) -> dict:
    task = _jury_prompt(d)

    def deliberate() -> str:
        raw = gl.nondet.exec_prompt(task, response_format="json")
        return json.dumps(_coerce_verdict(raw, d), sort_keys=True)

    settled = gl.eq_principle.prompt_comparative(
        deliberate,
        "Both jurors must reach the same upheld decision, both true or both"
        " false. When upheld, the new_power values must be within 10 of each"
        " other and the new_power_budget values within 15.",
    )
    return json.loads(settled)
