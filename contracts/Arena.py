# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *

ZERO_ADDRESS = Address(bytes(20))

# One home biome per element. Coordinates feed a live weather read so the arena
# floor actually reflects the weather somewhere real right now. The buffed
# element is fixed per biome, only the intensity breathes with the forecast.
BIOME_PRESETS = {
    "emberpeak": ("Emberpeak", "ember", 33.45, -112.07, "the Phoenix desert"),
    "frostmarch": ("Frostmarch", "tide", 64.15, -21.94, "the Reykjavik coast"),
    "galecrest": ("Galecrest", "gale", -41.29, 174.78, "the Wellington straits"),
    "verdant": ("Verdant Hollow", "terra", 1.35, 103.82, "the Singapore canopy"),
    "duskmoor": ("Duskmoor", "umbra", 69.65, 18.96, "the Tromso dark"),
    "sunspire": ("Sunspire", "lumen", 30.04, 31.24, "the Cairo sun"),
}

ELEMENT_ORDER = ("ember", "gale", "terra", "tide", "umbra", "lumen")

START_MANA = 6
MANA_REGEN = 3
MANA_CAP = 12
MAX_TURNS = 40  # a hard stop so a stall cannot run forever


@allow_storage
@dataclass
class Biome:
    key: str
    name: str
    home_element: str
    theme: str
    latitude: str
    longitude: str
    buff_pct: u256
    hazard: u256
    conditions: str
    source: str
    refreshed_at: u256


@allow_storage
@dataclass
class Battle:
    battle_id: str
    attacker_id: str
    defender_id: str
    attacker_name: str
    defender_name: str
    attacker_owner: str
    defender_owner: str
    biome_key: str
    biome_conditions: str
    winner_id: str
    winner_owner: str
    turns: u256
    attacker_hp_left: u256
    defender_hp_left: u256
    xp_attacker: u256
    xp_defender: u256
    summary: str
    log: str
    created_at: u256


class Arena(gl.Contract):
    """
    The floor where written moves meet reality.

    You throw one of your creatures at any other creature in the bestiary, even
    one whose trainer is asleep, and the arena plays out the whole fight from
    both kits under a live biome. Everything is deterministic given the same
    inputs, so every validator replays the exact same brawl and agrees on who
    walked out. The biome itself is the one wild card, and even that is pinned
    down by a weather read that the validators agree on before the bell rings.
    """

    owner: Address
    bestiary: Address

    biomes: TreeMap[str, Biome]
    biome_order: DynArray[str]

    battles: TreeMap[str, Battle]
    battle_order: DynArray[str]
    battles_by_creature: TreeMap[str, str]
    battle_seq: u256

    def __init__(self, bestiary_addr: Address):
        self.owner = gl.message.sender_address
        self.bestiary = bestiary_addr
        self.battle_seq = u256(0)

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

    def _now_str(self) -> str:
        try:
            if (
                hasattr(gl, "message_raw")
                and isinstance(gl.message_raw, dict)
                and "datetime" in gl.message_raw
            ):
                return str(gl.message_raw["datetime"])
        except Exception:
            pass
        return "0"

    def _set_bestiary(self, addr: Address) -> None:
        self.bestiary = addr

    # ---------- biomes ----------

    @gl.public.write
    def set_bestiary(self, addr: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] only the owner can set the bestiary")
        if addr == ZERO_ADDRESS:
            raise gl.vm.UserError("[EXPECTED] bestiary address cannot be zero")
        self.bestiary = addr

    @gl.public.write
    def seed_biomes(self) -> int:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] only the owner can seed biomes")
        added = 0
        now = self._now()
        for key in BIOME_PRESETS:
            if key in self.biomes:
                continue
            name, home, lat, lon, theme = BIOME_PRESETS[key]
            self.biomes[key] = Biome(
                key=key,
                name=name,
                home_element=home,
                theme=theme,
                latitude=str(lat),
                longitude=str(lon),
                buff_pct=u256(100),
                hazard=u256(0),
                conditions="Calm before anyone has checked the skies.",
                source="unset",
                refreshed_at=u256(0),
            )
            self.biome_order.append(key)
            added += 1
        return added

    @gl.public.write
    def refresh_biome(self, biome_key: str) -> dict:
        biome_key = biome_key.strip().lower()
        if biome_key not in self.biomes:
            raise gl.vm.UserError("[EXPECTED] unknown biome")
        b = self.biomes[biome_key]
        lat = b.latitude
        lon = b.longitude
        home = b.home_element

        def read_weather() -> str:
            url = (
                "https://api.open-meteo.com/v1/forecast?latitude="
                + lat
                + "&longitude="
                + lon
                + "&current=temperature_2m,wind_speed_10m"
            )
            temp = 20.0
            wind = 5.0
            ok = False
            try:
                res = gl.nondet.web.get(url, headers={"Accept": "application/json"})
                if int(res.status) == 200:
                    payload = json.loads(res.body.decode("utf-8"))
                    cur = payload.get("current", {})
                    temp = float(cur.get("temperature_2m", 20.0))
                    wind = float(cur.get("wind_speed_10m", 5.0))
                    ok = True
            except Exception:
                ok = False
            buff, hazard, conditions = _biome_reading(home, temp, wind, ok)
            return json.dumps(
                {
                    "buff_pct": buff,
                    "hazard": hazard,
                    "conditions": conditions,
                    "ok": ok,
                },
                sort_keys=True,
            )

        raw = gl.eq_principle.prompt_comparative(
            read_weather,
            "Both readings describe the same biome weather: the buff_pct values"
            " are within 8 of each other and the conditions describe a similar"
            " climate. Minor wording and small number differences are fine.",
        )
        data = json.loads(raw)
        b.buff_pct = u256(_clamp(int(data.get("buff_pct", 100)), 100, 130))
        b.hazard = u256(_clamp(int(data.get("hazard", 0)), 0, 5))
        b.conditions = str(data.get("conditions", "Conditions unclear."))[:200]
        b.source = "open-meteo" if data.get("ok") else "fallback"
        b.refreshed_at = self._now()
        self.biomes[biome_key] = b
        return _biome_view(b)

    # ---------- the duel ----------

    @gl.public.write
    def duel(self, attacker_id: str, defender_id: str, biome_key: str) -> dict:
        biome_key = biome_key.strip().lower()
        if attacker_id == defender_id:
            raise gl.vm.UserError("[EXPECTED] a creature cannot duel itself")
        if biome_key not in self.biomes:
            raise gl.vm.UserError("[EXPECTED] unknown biome")

        book = gl.get_contract_at(self.bestiary)
        att = book.view().get_creature(attacker_id)
        dfn = book.view().get_creature(defender_id)
        if not att.get("exists"):
            raise gl.vm.UserError("[EXPECTED] your creature does not exist")
        if not dfn.get("exists"):
            raise gl.vm.UserError("[EXPECTED] the opponent does not exist")
        if att["owner"] != "0x" + self._k(gl.message.sender_address):
            raise gl.vm.UserError("[EXPECTED] you can only send your own creature")

        att_moves = book.view().get_creature_moves(attacker_id)
        dfn_moves = book.view().get_creature_moves(defender_id)
        if len(att_moves) == 0:
            raise gl.vm.UserError("[EXPECTED] your creature has no moves to fight with")
        if len(dfn_moves) == 0:
            raise gl.vm.UserError("[EXPECTED] the opponent has no moves yet")

        biome = self.biomes[biome_key]
        seed = _seed_int(attacker_id + defender_id + biome_key + self._now_str())
        result = _simulate(att, att_moves, dfn, dfn_moves, biome, seed)

        winner_id = result["winner_id"]
        att_won = winner_id == attacker_id
        dfn_won = winner_id == defender_id
        xp_att = 30 + int(dfn["level"]) * 6 if att_won else 12
        xp_dfn = 30 + int(att["level"]) * 6 if dfn_won else 12

        self.battle_seq += u256(1)
        battle_id = "bt_" + str(int(self.battle_seq)).zfill(6)
        now = self._now()
        winner_owner = ""
        if att_won:
            winner_owner = att["owner"]
        elif dfn_won:
            winner_owner = dfn["owner"]

        self.battles[battle_id] = Battle(
            battle_id=battle_id,
            attacker_id=attacker_id,
            defender_id=defender_id,
            attacker_name=att["name"],
            defender_name=dfn["name"],
            attacker_owner=att["owner"],
            defender_owner=dfn["owner"],
            biome_key=biome_key,
            biome_conditions=biome.conditions,
            winner_id=winner_id,
            winner_owner=winner_owner,
            turns=u256(result["turns"]),
            attacker_hp_left=u256(result["attacker_hp_left"]),
            defender_hp_left=u256(result["defender_hp_left"]),
            xp_attacker=u256(xp_att),
            xp_defender=u256(xp_dfn),
            summary=result["summary"],
            log=json.dumps(result["log"]),
            created_at=now,
        )
        self.battle_order.append(battle_id)
        _index_battle(self.battles_by_creature, attacker_id, battle_id)
        _index_battle(self.battles_by_creature, defender_id, battle_id)

        book.emit(on="finalized").record_battle(attacker_id, att_won, u256(xp_att))
        book.emit(on="finalized").record_battle(defender_id, dfn_won, u256(xp_dfn))

        return {
            "battle_id": battle_id,
            "winner_id": winner_id,
            "turns": result["turns"],
            "summary": result["summary"],
            "attacker_hp_left": result["attacker_hp_left"],
            "defender_hp_left": result["defender_hp_left"],
        }

    # ---------- views ----------

    @gl.public.view
    def get_battle(self, battle_id: str) -> dict:
        if battle_id not in self.battles:
            return {"exists": False}
        return _battle_view(self.battles[battle_id], include_log=True)

    @gl.public.view
    def list_battles(self, offset: u256, limit: u256) -> dict:
        total = len(self.battle_order)
        start = int(offset)
        end = min(total, start + int(limit))
        items: list = []
        # newest first
        for i in range(total - 1 - start, max(-1, total - 1 - end), -1):
            items.append(_battle_view(self.battles[self.battle_order[i]], include_log=False))
        return {"total": total, "items": items}

    @gl.public.view
    def battles_for_creature(self, creature_id: str, limit: u256) -> list:
        cur = self.battles_by_creature.get(creature_id, "[]")
        try:
            ids = json.loads(cur)
        except Exception:
            ids = []
        out: list = []
        cap = int(limit)
        for bid in reversed(ids):
            if bid in self.battles:
                out.append(_battle_view(self.battles[bid], include_log=False))
            if len(out) >= cap:
                break
        return out

    @gl.public.view
    def get_biome(self, biome_key: str) -> dict:
        biome_key = biome_key.strip().lower()
        if biome_key not in self.biomes:
            return {"exists": False}
        return _biome_view(self.biomes[biome_key])

    @gl.public.view
    def list_biomes(self) -> list:
        out: list = []
        for key in self.biome_order:
            out.append(_biome_view(self.biomes[key]))
        return out

    @gl.public.view
    def arena_stats(self) -> dict:
        return {
            "battles": len(self.battle_order),
            "biomes": len(self.biome_order),
        }

    @gl.public.view
    def wiring(self) -> dict:
        return {
            "owner": "0x" + self._k(self.owner),
            "bestiary": "0x" + self._k(self.bestiary),
        }


# ---------- biome math ----------


def _clamp(value: int, lo: int, hi: int) -> int:
    if value < lo:
        return lo
    if value > hi:
        return hi
    return value


def _biome_reading(home: str, temp: float, wind: float, ok: bool):
    if not ok:
        return 100, 0, "The skies would not answer, the floor stays neutral."
    t = int(round(temp))
    w = int(round(wind))
    if home == "ember":
        buff = _clamp(100 + int((temp - 20.0) * 1.2), 100, 130)
        hazard = _clamp((t - 30) // 3, 0, 5)
        cond = "Heat shimmers at " + str(t) + "C, embers drink it in."
    elif home == "tide":
        buff = _clamp(100 + int((10.0 - temp) * 1.3), 100, 130)
        hazard = _clamp((5 - t) // 3, 0, 5)
        cond = "A raw " + str(t) + "C off the water, the tide runs strong."
    elif home == "gale":
        buff = _clamp(100 + int(wind * 1.6), 100, 130)
        hazard = _clamp((w - 20) // 4, 0, 5)
        cond = "Wind at " + str(w) + " km/h tears across the crest."
    elif home == "terra":
        buff = _clamp(130 - int(abs(temp - 24.0) * 1.5), 100, 130)
        hazard = 0
        cond = "A steady " + str(t) + "C, the canopy is thriving."
    elif home == "umbra":
        buff = _clamp(100 + int((8.0 - temp) * 1.1) + w // 6, 100, 128)
        hazard = _clamp((2 - t) // 3, 0, 4)
        cond = "Cold and dim at " + str(t) + "C, shadows grow long."
    else:  # lumen
        buff = _clamp(100 + int((temp - 18.0) * 1.0), 100, 128)
        hazard = _clamp((t - 34) // 3, 0, 4)
        cond = "Bright and dry at " + str(t) + "C, the light pours down."
    return buff, hazard, cond


# ---------- the fight ----------


def _seed_int(text: str) -> int:
    h = 2166136261
    for ch in text:
        h = (h ^ ord(ch)) * 16777619 % (2 ** 32)
    return h


def _roll(seed: int, turn: int) -> int:
    r = (seed * 1103515245 + 12345 + turn * 2654435761) % (2 ** 31)
    return r % 100


def _matchup_pct(att_el: str, def_el: str) -> int:
    if {att_el, def_el} == {"umbra", "lumen"}:
        return 120
    try:
        ai = ELEMENT_ORDER.index(att_el)
        di = ELEMENT_ORDER.index(def_el)
    except ValueError:
        return 100
    diff = (di - ai) % 6
    if diff == 1:
        return 125
    if diff == 5:
        return 80
    return 100


def _new_side(c: dict, moves: list) -> dict:
    return {
        "id": c["creature_id"],
        "name": c["name"],
        "owner": c["owner"],
        "element": c["element"],
        "level": int(c["level"]),
        "max_hp": int(c["hp"]),
        "hp": int(c["hp"]),
        "attack": int(c["attack"]),
        "defense": int(c["defense"]),
        "speed": int(c["speed"]),
        "mana": START_MANA,
        "moves": moves,
        "cooldowns": {},
        "dots": [],  # list of {kind, mag, dur}
        "stun": 0,
        "shield_pct": 0,
        "shield_turns": 0,
        "atk_buff": 0,
        "atk_buff_turns": 0,
        "def_debuff": 0,
        "def_debuff_turns": 0,
        "acc_penalty": 0,
        "acc_penalty_turns": 0,
        "last_hit": False,
    }


def _scaling_pct(kind: str, me: dict, foe: dict, turn: int) -> int:
    if kind == "low_hp":
        return 100 + (me["max_hp"] - me["hp"]) * 60 // max(1, me["max_hp"])
    if kind == "high_hp":
        return 100 + me["hp"] * 40 // max(1, me["max_hp"])
    if kind == "opening":
        return 150 if turn <= 2 else 100
    if kind == "finisher":
        return 160 if foe["hp"] * 100 < foe["max_hp"] * 35 else 100
    if kind == "combo":
        return 135 if me["last_hit"] else 100
    return 100


def _effective_attack(me: dict) -> int:
    return me["attack"] * (100 + me["atk_buff"]) // 100


def _effective_defense(me: dict) -> int:
    return me["defense"] * (100 - me["def_debuff"]) // 100


def _pick_move(me: dict) -> dict:
    best = None
    best_score = -1
    for idx, mv in enumerate(me["moves"]):
        mid = mv["move_id"]
        if me["cooldowns"].get(mid, 0) > 0:
            continue
        if me["mana"] < int(mv["mana_cost"]):
            continue
        power = int(mv["power"])
        kind = mv["effect_kind"]
        # A rough desirability so utility moves still get used sensibly.
        score = power * 10
        if kind == "heal" and me["hp"] * 100 < me["max_hp"] * 45:
            score += 260
        elif kind == "stun":
            score += 90
        elif kind == "shield" and me["hp"] * 100 < me["max_hp"] * 60:
            score += 70
        elif kind in ("burn", "poison"):
            score += 55
        elif kind in ("buff_attack", "debuff_defense", "debuff_accuracy"):
            score += 40
        elif kind == "lifesteal":
            score += 30
        score -= idx  # stable tie break toward kit order
        if score > best_score:
            best_score = score
            best = mv
    return best


def _decay_timers(me: dict) -> None:
    if me["shield_turns"] > 0:
        me["shield_turns"] -= 1
        if me["shield_turns"] == 0:
            me["shield_pct"] = 0
    if me["atk_buff_turns"] > 0:
        me["atk_buff_turns"] -= 1
        if me["atk_buff_turns"] == 0:
            me["atk_buff"] = 0
    if me["def_debuff_turns"] > 0:
        me["def_debuff_turns"] -= 1
        if me["def_debuff_turns"] == 0:
            me["def_debuff"] = 0
    if me["acc_penalty_turns"] > 0:
        me["acc_penalty_turns"] -= 1
        if me["acc_penalty_turns"] == 0:
            me["acc_penalty"] = 0


def _apply_effect(mv: dict, me: dict, foe: dict, dealt: int, log: list, turn: int) -> None:
    kind = mv["effect_kind"]
    mag = int(mv["effect_magnitude"])
    dur = max(1, int(mv["effect_duration"]))
    if kind == "burn" or kind == "poison":
        foe["dots"].append({"kind": kind, "mag": 2 + mag // 8, "dur": min(dur, 4)})
    elif kind == "stun":
        foe["stun"] = max(foe["stun"], min(dur, 2))
    elif kind == "shield":
        me["shield_pct"] = min(60, max(me["shield_pct"], mag))
        me["shield_turns"] = max(me["shield_turns"], min(dur, 3))
    elif kind == "heal":
        gain = me["max_hp"] * min(mag, 50) // 100
        me["hp"] = min(me["max_hp"], me["hp"] + gain)
    elif kind == "buff_attack":
        me["atk_buff"] = min(60, max(me["atk_buff"], mag))
        me["atk_buff_turns"] = max(me["atk_buff_turns"], min(dur, 3))
    elif kind == "debuff_defense":
        foe["def_debuff"] = min(50, max(foe["def_debuff"], mag))
        foe["def_debuff_turns"] = max(foe["def_debuff_turns"], min(dur, 3))
    elif kind == "debuff_accuracy":
        foe["acc_penalty"] = min(40, max(foe["acc_penalty"], mag))
        foe["acc_penalty_turns"] = max(foe["acc_penalty_turns"], min(dur, 3))
    elif kind == "cleanse":
        me["dots"] = []
        me["acc_penalty"] = 0
        me["acc_penalty_turns"] = 0
        me["hp"] = min(me["max_hp"], me["hp"] + me["max_hp"] * 10 // 100)


def _take_turn(me: dict, foe: dict, biome: dict, seed: int, turn: int, log: list) -> None:
    # status damage ticks first
    if me["dots"]:
        tick = 0
        surviving = []
        for st in me["dots"]:
            tick += int(st["mag"])
            st["dur"] -= 1
            if st["dur"] > 0:
                surviving.append(st)
        me["dots"] = surviving
        if tick > 0:
            me["hp"] = max(0, me["hp"] - tick)
            log.append(_event(turn, me, foe, "dot", "", tick, me["name"] + " suffers from lingering damage"))
            if me["hp"] <= 0:
                me["last_hit"] = False
                return

    if me["stun"] > 0:
        me["stun"] -= 1
        me["mana"] = min(MANA_CAP, me["mana"] + MANA_REGEN)
        me["last_hit"] = False
        log.append(_event(turn, me, foe, "stun", "", 0, me["name"] + " is stunned and cannot move"))
        _decay_timers(me)
        return

    me["mana"] = min(MANA_CAP, me["mana"] + MANA_REGEN)
    mv = _pick_move(me)
    if mv is None:
        dmg = 5
        foe["hp"] = max(0, foe["hp"] - dmg)
        me["mana"] = min(MANA_CAP, me["mana"] + 2)
        me["last_hit"] = False
        log.append(_event(turn, me, foe, "struggle", "Struggle", dmg, me["name"] + " has nothing ready and lashes out"))
        _decay_timers(me)
        return

    mid = mv["move_id"]
    me["mana"] -= int(mv["mana_cost"])
    if int(mv["cooldown"]) > 0:
        me["cooldowns"][mid] = int(mv["cooldown"]) + 1

    acc = int(mv["accuracy"]) - me["acc_penalty"]
    if _roll(seed, turn) >= max(20, acc):
        me["last_hit"] = False
        log.append(_event(turn, me, foe, "miss", mv["name"], 0, me["name"] + " misses with " + mv["name"]))
        _decay_timers(me)
        return

    dealt = 0
    power = int(mv["power"])
    if power > 0:
        raw = power * 2 + _effective_attack(me) // 2
        mitig = _effective_defense(foe) * 3 // 4
        base = raw - mitig
        if base < 1:
            base = 1
        mult = _scaling_pct(mv["scaling"], me, foe, turn)
        mult = mult * _matchup_pct(me["element"], foe["element"]) // 100
        if mv["element"] == biome["home_element"]:
            mult = mult * int(biome["buff_pct"]) // 100
        dealt = base * mult // 100
        if foe["shield_pct"] > 0:
            dealt = dealt * (100 - foe["shield_pct"]) // 100
        if dealt < 1:
            dealt = 1
        foe["hp"] = max(0, foe["hp"] - dealt)
        note = me["name"] + " lands " + mv["name"]
        if mult >= 120:
            note += " and it bites deep"
        log.append(_event(turn, me, foe, "hit", mv["name"], dealt, note))
        if mv["effect_kind"] == "lifesteal":
            heal = dealt * min(50, int(mv["effect_magnitude"])) // 100
            me["hp"] = min(me["max_hp"], me["hp"] + heal)
        if mv["effect_kind"] == "recoil":
            hurt = dealt * min(50, int(mv["effect_magnitude"])) // 100
            me["hp"] = max(0, me["hp"] - hurt)
    else:
        log.append(_event(turn, me, foe, "status", mv["name"], 0, me["name"] + " sets up " + mv["name"]))

    me["last_hit"] = power > 0 and foe["hp"] > 0
    if mv["effect_kind"] not in ("lifesteal", "recoil", "none"):
        _apply_effect(mv, me, foe, dealt, log, turn)
    _decay_timers(me)


def _event(turn: int, me: dict, foe: dict, kind: str, move: str, dmg: int, note: str) -> dict:
    return {
        "t": turn,
        "actor": me["id"],
        "actor_name": me["name"],
        "kind": kind,
        "move": move,
        "dmg": dmg,
        "note": note,
        "actor_hp": me["hp"],
        "target_hp": foe["hp"],
    }


def _cooldown_tick(me: dict) -> None:
    stale = []
    for mid in me["cooldowns"]:
        me["cooldowns"][mid] -= 1
        if me["cooldowns"][mid] <= 0:
            stale.append(mid)
    for mid in stale:
        del me["cooldowns"][mid]


def _simulate(att_c: dict, att_moves: list, dfn_c: dict, dfn_moves: list, biome: Biome, seed: int) -> dict:
    biome_d = {"home_element": biome.home_element, "buff_pct": int(biome.buff_pct), "hazard": int(biome.hazard)}
    a = _new_side(att_c, att_moves)
    d = _new_side(dfn_c, dfn_moves)
    log: list = []

    if a["speed"] >= d["speed"]:
        first, second = a, d
    else:
        first, second = d, a

    turn = 0
    hazard = int(biome.hazard)
    home = biome.home_element
    while turn < MAX_TURNS and a["hp"] > 0 and d["hp"] > 0:
        turn += 1
        _take_turn(first, second, biome_d, seed, turn, log)
        if a["hp"] <= 0 or d["hp"] <= 0:
            break
        turn += 1
        _take_turn(second, first, biome_d, seed, turn, log)
        if a["hp"] <= 0 or d["hp"] <= 0:
            break
        # end of round: biome hazard chips creatures not of the home element
        if hazard > 0:
            for side in (a, d):
                if side["element"] != home and side["hp"] > 0:
                    side["hp"] = max(0, side["hp"] - hazard)
            if a["hp"] <= 0 or d["hp"] <= 0:
                log.append({
                    "t": turn,
                    "actor": "biome",
                    "actor_name": "The biome",
                    "kind": "hazard",
                    "move": "",
                    "dmg": hazard,
                    "note": "The biome itself takes its due",
                    "actor_hp": a["hp"],
                    "target_hp": d["hp"],
                })
                break
        _cooldown_tick(a)
        _cooldown_tick(d)

    if a["hp"] <= 0 and d["hp"] <= 0:
        winner_id = att_c["creature_id"] if a["hp"] >= d["hp"] else dfn_c["creature_id"]
    elif a["hp"] <= 0:
        winner_id = dfn_c["creature_id"]
    elif d["hp"] <= 0:
        winner_id = att_c["creature_id"]
    else:
        # timed out, higher health ratio wins, defender holds a true tie
        a_ratio = a["hp"] * 100 // max(1, a["max_hp"])
        d_ratio = d["hp"] * 100 // max(1, d["max_hp"])
        if a_ratio > d_ratio:
            winner_id = att_c["creature_id"]
        else:
            winner_id = dfn_c["creature_id"]

    if winner_id == att_c["creature_id"]:
        summary = att_c["name"] + " outlasted " + dfn_c["name"] + " after " + str(turn) + " turns."
    else:
        summary = dfn_c["name"] + " turned back " + att_c["name"] + " after " + str(turn) + " turns."

    # keep the stored log bounded
    if len(log) > 80:
        log = log[:80]

    return {
        "winner_id": winner_id,
        "turns": turn,
        "attacker_hp_left": max(0, a["hp"]),
        "defender_hp_left": max(0, d["hp"]),
        "summary": summary,
        "log": log,
    }


# ---------- views ----------


def _index_battle(index: TreeMap, creature_id: str, battle_id: str) -> None:
    cur = index.get(creature_id, "[]")
    try:
        lst = json.loads(cur)
    except Exception:
        lst = []
    lst.append(battle_id)
    if len(lst) > 60:
        lst = lst[-60:]
    index[creature_id] = json.dumps(lst)


def _biome_view(b: Biome) -> dict:
    return {
        "exists": True,
        "key": b.key,
        "name": b.name,
        "home_element": b.home_element,
        "theme": b.theme,
        "buff_pct": int(b.buff_pct),
        "hazard": int(b.hazard),
        "conditions": b.conditions,
        "source": b.source,
        "refreshed_at": int(b.refreshed_at),
    }


def _battle_view(b: Battle, include_log: bool) -> dict:
    out = {
        "exists": True,
        "battle_id": b.battle_id,
        "attacker_id": b.attacker_id,
        "defender_id": b.defender_id,
        "attacker_name": b.attacker_name,
        "defender_name": b.defender_name,
        "attacker_owner": b.attacker_owner,
        "defender_owner": b.defender_owner,
        "biome_key": b.biome_key,
        "biome_conditions": b.biome_conditions,
        "winner_id": b.winner_id,
        "winner_owner": b.winner_owner,
        "turns": int(b.turns),
        "attacker_hp_left": int(b.attacker_hp_left),
        "defender_hp_left": int(b.defender_hp_left),
        "xp_attacker": int(b.xp_attacker),
        "xp_defender": int(b.xp_defender),
        "summary": b.summary,
        "created_at": int(b.created_at),
    }
    if include_log:
        try:
            out["log"] = json.loads(b.log)
        except Exception:
            out["log"] = []
    return out
