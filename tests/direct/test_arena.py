import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from conftest import forge_reply  # noqa: E402


def _fighter(w, owner, name, element, moves):
    """Craft a creature and forge each move in `moves` (a list of stat dicts)."""
    with w.vm.prank(owner):
        cid = w.bestiary.craft_creature(name, element)
        for i, stats in enumerate(moves):
            w.vm.clear_mocks()
            w.vm.mock_llm(r"balance panel", forge_reply(**stats))
            w.bestiary.forge_move(cid, name + " move " + str(i), "a described attack number " + str(i))
    return cid


# ---------- biomes ----------


def test_seed_biomes_is_idempotent(wordrena):
    w = wordrena
    # already seeded by the fixture
    again = w.arena.seed_biomes()
    assert again == 0
    biomes = w.arena.list_biomes()
    assert len(biomes) == 6
    keys = {b["key"] for b in biomes}
    assert keys == {"emberpeak", "frostmarch", "galecrest", "verdant", "duskmoor", "sunspire"}
    # every element gets a home
    assert {b["home_element"] for b in biomes} == {
        "ember", "tide", "gale", "terra", "umbra", "lumen"
    }


def test_refresh_biome_reads_live_weather(wordrena):
    w = wordrena
    w.vm.mock_web_json(
        r"open-meteo", {"current": {"temperature_2m": 41.0, "wind_speed_10m": 3.0}}
    )
    out = w.arena.refresh_biome("emberpeak")
    assert out["source"] == "open-meteo"
    assert out["buff_pct"] == 125  # 100 + int((41-20)*1.2)
    assert out["hazard"] == 3  # (41-30)//3
    assert "41C" in out["conditions"]

    stored = w.arena.get_biome("emberpeak")
    assert stored["buff_pct"] == 125
    assert stored["refreshed_at"] > 0


def test_refresh_biome_falls_back_when_the_sky_is_silent(wordrena):
    w = wordrena
    # no web mock registered, so the fetch raises and the leader returns neutral
    out = w.arena.refresh_biome("frostmarch")
    assert out["source"] == "fallback"
    assert out["buff_pct"] == 100
    assert out["hazard"] == 0


def test_refresh_unknown_biome_reverts(wordrena):
    w = wordrena
    with w.vm.expect_revert("unknown biome"):
        w.arena.refresh_biome("atlantis")


# ---------- duels ----------


def test_duel_resolves_deterministically_and_records(wordrena):
    w = wordrena
    strong = _fighter(w, w.alice, "Blaze", "ember", [dict(power=40, accuracy=100, mana_cost=1)])
    weak = _fighter(w, w.bob, "Puddle", "tide", [dict(power=5, accuracy=100, mana_cost=1)])

    with w.vm.prank(w.alice):
        result = w.arena.duel(strong, weak, "emberpeak")

    assert result["winner_id"] == strong
    assert result["turns"] > 0
    assert result["attacker_hp_left"] > 0

    battle = w.arena.get_battle(result["battle_id"])
    assert battle["exists"] is True
    assert len(battle["log"]) > 0
    assert battle["log"][0]["kind"] in ("hit", "miss", "status", "struggle", "dot", "stun")

    # both creatures had the battle written back to the bestiary
    a = w.bestiary.get_creature(strong)
    b = w.bestiary.get_creature(weak)
    assert a["battles"] == 1 and b["battles"] == 1
    assert a["wins"] == 1 and b["losses"] == 1
    assert a["xp"] > b["xp"]


def test_same_inputs_replay_to_the_same_winner(wordrena):
    w = wordrena
    one = _fighter(w, w.alice, "Alpha", "ember", [dict(power=22, accuracy=100)])
    two = _fighter(w, w.bob, "Beta", "gale", [dict(power=22, accuracy=100)])

    with w.vm.prank(w.alice):
        r1 = w.arena.duel(one, two, "emberpeak")
        r2 = w.arena.duel(one, two, "emberpeak")
    # deterministic simulation: identical seed inputs, identical outcome
    assert r1["winner_id"] == r2["winner_id"]
    assert r1["summary"] == r2["summary"]


def test_biome_buff_can_swing_a_mirror_match(wordrena):
    w = wordrena
    # two near identical fighters, one ember one tide, same move power
    ember = _fighter(w, w.alice, "Cinder", "ember", [dict(power=18, accuracy=100)])
    tide = _fighter(w, w.bob, "Brine", "tide", [dict(power=18, accuracy=100)])

    # crank Emberpeak hot so the ember mover gets a real edge, plus heat hazard
    w.vm.mock_web_json(
        r"open-meteo", {"current": {"temperature_2m": 44.0, "wind_speed_10m": 2.0}}
    )
    w.arena.refresh_biome("emberpeak")
    with w.vm.prank(w.alice):
        result = w.arena.duel(ember, tide, "emberpeak")
    # the home element carries the day on its own scorching floor
    assert result["winner_id"] == ember


def test_duel_validations(wordrena):
    w = wordrena
    mine = _fighter(w, w.alice, "Mine", "ember", [dict(power=20)])
    naked = None
    with w.vm.prank(w.bob):
        naked = w.bestiary.craft_creature("Naked", "tide")  # no moves

    with w.vm.prank(w.alice):
        with w.vm.expect_revert("cannot duel itself"):
            w.arena.duel(mine, mine, "emberpeak")
        with w.vm.expect_revert("unknown biome"):
            w.arena.duel(mine, naked, "nowhere")
        with w.vm.expect_revert("opponent has no moves"):
            w.arena.duel(mine, naked, "emberpeak")

    # cannot send a creature you do not own
    with w.vm.prank(w.bob):
        with w.vm.expect_revert("only send your own"):
            w.arena.duel(mine, naked, "emberpeak")


def test_battles_for_creature_index(wordrena):
    w = wordrena
    a = _fighter(w, w.alice, "Aiden", "ember", [dict(power=30, accuracy=100)])
    b = _fighter(w, w.bob, "Bex", "terra", [dict(power=10, accuracy=100)])
    with w.vm.prank(w.alice):
        w.arena.duel(a, b, "emberpeak")
        w.arena.duel(a, b, "verdant")
    recent = w.arena.battles_for_creature(a, 10)
    assert len(recent) == 2
    stats = w.arena.arena_stats()
    assert stats["battles"] == 2
    assert stats["biomes"] == 6
