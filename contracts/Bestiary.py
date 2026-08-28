# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *

ZERO_ADDRESS = Address(bytes(20))

# The six elements every creature belongs to, each with a level one stat spread
# of (hp, attack, defense, speed). The spreads are deliberately lopsided so a
# team feels like a set of tools rather than six flavors of the same thing.
ELEMENTS = {
    "ember": (100, 28, 12, 18),
    "tide": (122, 18, 20, 12),
    "gale": (86, 21, 12, 28),
    "terra": (112, 16, 27, 9),
    "umbra": (82, 30, 11, 24),
    "lumen": (106, 20, 22, 15),
}
ELEMENT_LIST = ("ember", "tide", "gale", "terra", "umbra", "lumen")

EFFECT_KINDS = (
    "none",
    "burn",
    "poison",
    "stun",
    "shield",
    "heal",
    "lifesteal",
    "buff_attack",
    "debuff_defense",
    "debuff_accuracy",
    "recoil",
    "cleanse",
)
SCALING_KINDS = ("none", "low_hp", "high_hp", "opening", "finisher", "combo")

MAX_KIT = 4  # a creature carries at most four moves into the arena


@allow_storage
@dataclass
class Creature:
    creature_id: str
    owner: str
    name: str
    element: str
    archetype: str
    hp: u256
    attack: u256
    defense: u256
    speed: u256
    level: u256
    xp: u256
    move_ids: str  # json list of move ids currently in the kit
    wins: u256
    losses: u256
    battles: u256
    created_at: u256
    updated_at: u256


@allow_storage
@dataclass
class Move:
    move_id: str
    creature_id: str
    owner: str
    name: str
    prompt: str
    element: str
    power: u256
    mana_cost: u256
    cooldown: u256
    accuracy: u256
    effect_kind: str
    effect_magnitude: u256
    effect_duration: u256
    scaling: str
    power_budget: u256
    verdict: str
    status: str
    disputes: u256
    forged_at: u256
    updated_at: u256


class Bestiary(gl.Contract):
    """
    Where creatures are crafted and their moves are written in plain English.

    Crafting is deterministic, you pick an element and get a fair stat spread.
    The interesting part is forging a move: the player types a sentence like
    "a vine lash that hits harder the closer I am to fainting" and a validator
    panel turns that into concrete, budgeted numbers through the equivalence
    principle. No move database, no dev picking damage values, just language in
    and a balanced move out that everyone can then try to break in the arena.
    """

    owner: Address
    arena: Address
    tribunal: Address

    creatures: TreeMap[str, Creature]
    creature_order: DynArray[str]
    creatures_by_owner: TreeMap[str, str]
    creature_seq: u256

    moves: TreeMap[str, Move]
    move_order: DynArray[str]
    move_seq: u256

    total_forged: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.arena = ZERO_ADDRESS
        self.tribunal = ZERO_ADDRESS
        self.creature_seq = u256(0)
        self.move_seq = u256(0)
        self.total_forged = u256(0)

    # ---------- internal helpers ----------

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

    def _name_seed(self, name: str) -> int:
        total = 0
        for ch in name:
            total += ord(ch)
        return total

    def _push_owner_creature(self, owner_k: str, creature_id: str) -> None:
        cur = self.creatures_by_owner.get(owner_k, "[]")
        try:
            lst = json.loads(cur)
        except Exception:
            lst = []
        lst.append(creature_id)
        self.creatures_by_owner[owner_k] = json.dumps(lst)

    # ---------- wiring ----------

    @gl.public.write
    def set_arena(self, arena_addr: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] only the owner can wire the arena")
        if arena_addr == ZERO_ADDRESS:
            raise gl.vm.UserError("[EXPECTED] arena address cannot be zero")
        self.arena = arena_addr

    @gl.public.write
    def set_tribunal(self, tribunal_addr: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] only the owner can wire the tribunal")
        if tribunal_addr == ZERO_ADDRESS:
            raise gl.vm.UserError("[EXPECTED] tribunal address cannot be zero")
        self.tribunal = tribunal_addr

    # ---------- crafting ----------

    @gl.public.write
    def craft_creature(self, name: str, element: str) -> str:
        owner_k = self._k(gl.message.sender_address)
        name = name.strip()
        element = element.strip().lower()
        if len(name) < 2 or len(name) > 28:
            raise gl.vm.UserError("[EXPECTED] creature name needs 2 to 28 characters")
        if element not in ELEMENTS:
            raise gl.vm.UserError(
                "[EXPECTED] element must be ember, tide, gale, terra, umbra or lumen"
            )

        base_hp, base_atk, base_def, base_spd = ELEMENTS[element]
        seed = self._name_seed(name)
        # A small, deterministic wobble so two ember creatures are not identical.
        hp = base_hp + (seed % 11)
        attack = base_atk + (seed // 7) % 5
        defense = base_def + (seed // 13) % 5
        speed = base_spd + (seed // 17) % 5

        self.creature_seq += u256(1)
        creature_id = "cr_" + str(int(self.creature_seq)).zfill(6)
        now = self._now()
        self.creatures[creature_id] = Creature(
            creature_id=creature_id,
            owner="0x" + owner_k,
            name=name,
            element=element,
            archetype=_archetype_for(element),
            hp=u256(hp),
            attack=u256(attack),
            defense=u256(defense),
            speed=u256(speed),
            level=u256(1),
            xp=u256(0),
            move_ids="[]",
            wins=u256(0),
            losses=u256(0),
            battles=u256(0),
            created_at=now,
            updated_at=now,
        )
        self.creature_order.append(creature_id)
        self._push_owner_creature(owner_k, creature_id)
        return creature_id

    @gl.public.write
    def level_up(self, creature_id: str) -> None:
        if creature_id not in self.creatures:
            raise gl.vm.UserError("[EXPECTED] unknown creature")
        c = self.creatures[creature_id]
        if c.owner != "0x" + self._k(gl.message.sender_address):
            raise gl.vm.UserError("[EXPECTED] only the trainer can level this creature")
        need = xp_to_level(int(c.level))
        if int(c.xp) < need:
            raise gl.vm.UserError("[EXPECTED] not enough experience for the next level")
        c.xp = u256(int(c.xp) - need)
        c.level = u256(int(c.level) + 1)
        # Growth is weighted toward the element's strengths.
        c.hp = u256(int(c.hp) + 9)
        c.attack = u256(int(c.attack) + 3)
        c.defense = u256(int(c.defense) + 3)
        c.speed = u256(int(c.speed) + 2)
        c.updated_at = self._now()
        self.creatures[creature_id] = c

    # ---------- the forge (natural language -> balanced move) ----------

    @gl.public.write
    def forge_move(self, creature_id: str, name: str, prompt: str) -> str:
        if creature_id not in self.creatures:
            raise gl.vm.UserError("[EXPECTED] unknown creature")
        c = self.creatures[creature_id]
        if c.owner != "0x" + self._k(gl.message.sender_address):
            raise gl.vm.UserError("[EXPECTED] only the trainer can forge for this creature")
        name = name.strip()
        prompt = prompt.strip()
        if len(name) < 2 or len(name) > 40:
            raise gl.vm.UserError("[EXPECTED] move name needs 2 to 40 characters")
        if len(prompt) < 12 or len(prompt) > 600:
            raise gl.vm.UserError(
                "[EXPECTED] describe the move in 12 to 600 characters"
            )
        try:
            kit = json.loads(c.move_ids)
        except Exception:
            kit = []
        if len(kit) >= MAX_KIT:
            raise gl.vm.UserError(
                "[EXPECTED] this creature already carries four moves, retire one first"
            )

        element = c.element
        stats = _forge_stats(name, prompt, element)

        self.move_seq += u256(1)
        move_id = "mv_" + str(int(self.move_seq)).zfill(6)
        now = self._now()
        self.moves[move_id] = Move(
            move_id=move_id,
            creature_id=creature_id,
            owner=c.owner,
            name=name,
            prompt=prompt,
            element=element,
            power=u256(stats["power"]),
            mana_cost=u256(stats["mana_cost"]),
            cooldown=u256(stats["cooldown"]),
            accuracy=u256(stats["accuracy"]),
            effect_kind=stats["effect_kind"],
            effect_magnitude=u256(stats["effect_magnitude"]),
            effect_duration=u256(stats["effect_duration"]),
            scaling=stats["scaling"],
            power_budget=u256(stats["power_budget"]),
            verdict=stats["verdict"],
            status="forged",
            disputes=u256(0),
            forged_at=now,
            updated_at=now,
        )
        self.move_order.append(move_id)
        kit.append(move_id)
        c.move_ids = json.dumps(kit)
        c.updated_at = now
        self.creatures[creature_id] = c
        self.total_forged += u256(1)
        return move_id

    @gl.public.write
    def retire_move(self, move_id: str) -> None:
        if move_id not in self.moves:
            raise gl.vm.UserError("[EXPECTED] unknown move")
        m = self.moves[move_id]
        if m.owner != "0x" + self._k(gl.message.sender_address):
            raise gl.vm.UserError("[EXPECTED] only the trainer can retire this move")
        c = self.creatures[m.creature_id]
        try:
            kit = json.loads(c.move_ids)
        except Exception:
            kit = []
        kit = [x for x in kit if x != move_id]
        c.move_ids = json.dumps(kit)
        c.updated_at = self._now()
        self.creatures[m.creature_id] = c
        m.status = "retired"
        m.updated_at = self._now()
        self.moves[move_id] = m

    # ---------- authorized cross contract writes ----------

    @gl.public.write
    def record_battle(self, creature_id: str, won: bool, xp_gain: u256) -> None:
        if gl.message.sender_address != self.arena:
            raise gl.vm.UserError("[EXPECTED] only the arena can record battles")
        if creature_id not in self.creatures:
            raise gl.vm.UserError("[EXPECTED] unknown creature")
        c = self.creatures[creature_id]
        c.battles = u256(int(c.battles) + 1)
        if won:
            c.wins = u256(int(c.wins) + 1)
        else:
            c.losses = u256(int(c.losses) + 1)
        c.xp = u256(int(c.xp) + int(xp_gain))
        c.updated_at = self._now()
        self.creatures[creature_id] = c

    @gl.public.write
    def apply_rebalance(
        self,
        move_id: str,
        power: u256,
        mana_cost: u256,
        cooldown: u256,
        power_budget: u256,
        verdict: str,
    ) -> None:
        if gl.message.sender_address != self.tribunal:
            raise gl.vm.UserError("[EXPECTED] only the tribunal can rebalance moves")
        if move_id not in self.moves:
            raise gl.vm.UserError("[EXPECTED] unknown move")
        m = self.moves[move_id]
        m.power = u256(_clamp(int(power), 0, 60))
        m.mana_cost = u256(_clamp(int(mana_cost), 0, 10))
        m.cooldown = u256(_clamp(int(cooldown), 0, 5))
        m.power_budget = u256(_clamp(int(power_budget), 1, 100))
        m.verdict = verdict[:280]
        m.status = "rebalanced"
        m.disputes = u256(int(m.disputes) + 1)
        m.updated_at = self._now()
        self.moves[move_id] = m

    # ---------- views ----------

    @gl.public.view
    def get_creature(self, creature_id: str) -> dict:
        if creature_id not in self.creatures:
            return {"exists": False}
        c = self.creatures[creature_id]
        try:
            kit = json.loads(c.move_ids)
        except Exception:
            kit = []
        return {
            "exists": True,
            "creature_id": c.creature_id,
            "owner": c.owner,
            "name": c.name,
            "element": c.element,
            "archetype": c.archetype,
            "hp": int(c.hp),
            "attack": int(c.attack),
            "defense": int(c.defense),
            "speed": int(c.speed),
            "level": int(c.level),
            "xp": int(c.xp),
            "xp_to_next": xp_to_level(int(c.level)),
            "move_ids": kit,
            "wins": int(c.wins),
            "losses": int(c.losses),
            "battles": int(c.battles),
            "created_at": int(c.created_at),
            "updated_at": int(c.updated_at),
        }

    @gl.public.view
    def get_move(self, move_id: str) -> dict:
        if move_id not in self.moves:
            return {"exists": False}
        return _move_view(self.moves[move_id])

    @gl.public.view
    def get_creature_moves(self, creature_id: str) -> list:
        if creature_id not in self.creatures:
            return []
        c = self.creatures[creature_id]
        try:
            kit = json.loads(c.move_ids)
        except Exception:
            kit = []
        out: list = []
        for mid in kit:
            if mid in self.moves:
                out.append(_move_view(self.moves[mid]))
        return out

    @gl.public.view
    def list_creatures(self, offset: u256, limit: u256) -> dict:
        total = len(self.creature_order)
        start = int(offset)
        end = min(total, start + int(limit))
        items: list = []
        for i in range(start, end):
            items.append(self.get_creature(self.creature_order[i]))
        return {"total": total, "items": items}

    @gl.public.view
    def list_moves(self, offset: u256, limit: u256) -> dict:
        total = len(self.move_order)
        start = int(offset)
        end = min(total, start + int(limit))
        items: list = []
        for i in range(start, end):
            items.append(_move_view(self.moves[self.move_order[i]]))
        return {"total": total, "items": items}

    @gl.public.view
    def list_creatures_by_owner(self, owner: Address) -> list:
        owner_k = self._k(owner)
        cur = self.creatures_by_owner.get(owner_k, "[]")
        try:
            ids = json.loads(cur)
        except Exception:
            ids = []
        out: list = []
        for cid in ids:
            if cid in self.creatures:
                out.append(self.get_creature(cid))
        return out

    @gl.public.view
    def bestiary_stats(self) -> dict:
        return {
            "creatures": len(self.creature_order),
            "moves": len(self.move_order),
            "total_forged": int(self.total_forged),
        }

    @gl.public.view
    def creature_count(self) -> int:
        return len(self.creature_order)

    @gl.public.view
    def wiring(self) -> dict:
        return {
            "owner": "0x" + self._k(self.owner),
            "arena": "0x" + self._k(self.arena),
            "tribunal": "0x" + self._k(self.tribunal),
        }


# ---------- module level helpers ----------


def _archetype_for(element: str) -> str:
    names = {
        "ember": "Cinderbeast",
        "tide": "Deepling",
        "gale": "Skywisp",
        "terra": "Stonekin",
        "umbra": "Nightmaw",
        "lumen": "Dawnward",
    }
    return names.get(element, "Wildling")


def xp_to_level(level: int) -> int:
    if level < 1:
        level = 1
    return 60 + (level - 1) * 40


def _clamp(value: int, lo: int, hi: int) -> int:
    if value < lo:
        return lo
    if value > hi:
        return hi
    return value


def _forge_prompt(name: str, prompt: str, element: str) -> str:
    return "\n".join(
        [
            "You are a game balance panel for a creature battler.",
            "A trainer wrote a move in plain English. Turn it into concrete,",
            "fair numbers for a level one move. Do not reward walls of text or",
            "grand wording, judge only the actual effect described.",
            "",
            "ELEMENT OF THE MOVE: " + element,
            "MOVE NAME: " + name,
            "DESCRIPTION: " + prompt,
            "",
            "Number ranges you must stay inside:",
            "- power: 0 to 40 damage. A plain hit is around 12 to 16.",
            "- mana_cost: 0 to 8. Stronger effects must cost more.",
            "- cooldown: 0 to 4 turns. Big swings need a rest.",
            "- accuracy: 55 to 100. Only lower it for very strong hits.",
            "- effect_kind: one of none, burn, poison, stun, shield, heal,",
            "  lifesteal, buff_attack, debuff_defense, debuff_accuracy, recoil,",
            "  cleanse. Pick the closest single category.",
            "- effect_magnitude: 0 to 50 (percent or points for that effect).",
            "- effect_duration: 0 to 4 turns.",
            "- scaling: one of none, low_hp, high_hp, opening, finisher, combo.",
            "  Use low_hp if it grows as the user's health drops, high_hp if it",
            "  needs health, opening for a first turn spike, finisher against a",
            "  weakened foe, combo when chained after another move.",
            "- power_budget: 0 to 100, your honest read of how strong the whole",
            "  package is. A cheap high damage move with a status rider is a high",
            "  budget. Keep cost and cooldown in line with this number.",
            "- verdict: at most 200 characters, a punchy read on the move that a",
            "  player would enjoy reading. Have a little fun with it.",
            "",
            "Balance rule: a move that both hits hard and applies a strong status",
            "for cheap is not allowed, raise its cost, cooldown, or drop accuracy.",
            "",
            'Respond ONLY with JSON: {"power": int, "mana_cost": int,',
            '"cooldown": int, "accuracy": int, "effect_kind": str,',
            '"effect_magnitude": int, "effect_duration": int, "scaling": str,',
            '"power_budget": int, "verdict": str}',
        ]
    )


def _coerce_stats(raw) -> dict:
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
        raise gl.vm.UserError("[LLM_ERROR] the forge did not return an object")

    effect_kind = str(data.get("effect_kind", "none")).strip().lower()
    if effect_kind not in EFFECT_KINDS:
        effect_kind = "none"
    scaling = str(data.get("scaling", "none")).strip().lower()
    if scaling not in SCALING_KINDS:
        scaling = "none"
    verdict = str(data.get("verdict", "")).strip()
    if len(verdict) == 0:
        verdict = "A serviceable move with no obvious tricks."
    if len(verdict) > 240:
        verdict = verdict[:240]

    return {
        "power": _clamp(_as_int(data.get("power", 0)), 0, 40),
        "mana_cost": _clamp(_as_int(data.get("mana_cost", 0)), 0, 8),
        "cooldown": _clamp(_as_int(data.get("cooldown", 0)), 0, 4),
        "accuracy": _clamp(_as_int(data.get("accuracy", 100)), 55, 100),
        "effect_kind": effect_kind,
        "effect_magnitude": _clamp(_as_int(data.get("effect_magnitude", 0)), 0, 50),
        "effect_duration": _clamp(_as_int(data.get("effect_duration", 0)), 0, 4),
        "scaling": scaling,
        "power_budget": _clamp(_as_int(data.get("power_budget", 20)), 1, 100),
        "verdict": verdict,
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


def _forge_stats(name: str, prompt: str, element: str) -> dict:
    task = _forge_prompt(name, prompt, element)

    def interpret() -> str:
        raw = gl.nondet.exec_prompt(task, response_format="json")
        return json.dumps(_coerce_stats(raw), sort_keys=True)

    forged = gl.eq_principle.prompt_comparative(
        interpret,
        "Both readings must land in the same balance tier: the effect_kind"
        " matches, the power values are within 10 of each other, and the"
        " power_budget values are within 15 of each other.",
    )
    return json.loads(forged)


def _move_view(m: Move) -> dict:
    return {
        "exists": True,
        "move_id": m.move_id,
        "creature_id": m.creature_id,
        "owner": m.owner,
        "name": m.name,
        "prompt": m.prompt,
        "element": m.element,
        "power": int(m.power),
        "mana_cost": int(m.mana_cost),
        "cooldown": int(m.cooldown),
        "accuracy": int(m.accuracy),
        "effect_kind": m.effect_kind,
        "effect_magnitude": int(m.effect_magnitude),
        "effect_duration": int(m.effect_duration),
        "scaling": m.scaling,
        "power_budget": int(m.power_budget),
        "verdict": m.verdict,
        "status": m.status,
        "disputes": int(m.disputes),
        "forged_at": int(m.forged_at),
        "updated_at": int(m.updated_at),
    }
