import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from conftest import forge_reply, jury_reply, gen  # noqa: E402


def _move(w, owner, power=30, budget=70):
    with w.vm.prank(owner):
        cid = w.bestiary.craft_creature("Scorch", "ember")
        w.vm.clear_mocks()
        w.vm.mock_llm(r"balance panel", forge_reply(power=power, power_budget=budget, mana_cost=1))
        mid = w.bestiary.forge_move(cid, "Overtuned Blast", "a blast that feels far too cheap for the pain it deals")
    return cid, mid


def _transfers_without_calls(w):
    return [t for t in w.vm.executed_transfers if "call" not in t]


# ---------- filing ----------


def test_file_dispute_snapshots_the_move(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice, power=30, budget=70)
    with w.vm.prank(w.bob):
        did = w.tribunal.file_dispute(mid, "this hits like a truck for one mana, nerf it", "nerf")
    d = w.tribunal.get_dispute(did)
    assert d["exists"] is True
    assert d["status"] == "filed"
    assert d["direction"] == "nerf"
    assert d["old_power"] == 30
    assert d["old_budget"] == 70
    assert d["challenger"] == "0x" + w.bob.as_bytes.hex()


def test_file_dispute_validations(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice)
    with w.vm.prank(w.bob):
        with w.vm.expect_revert("direction must be"):
            w.tribunal.file_dispute(mid, "a perfectly long enough complaint here", "sideways")
        with w.vm.expect_revert("8 to 400 characters"):
            w.tribunal.file_dispute(mid, "short", "nerf")
        with w.vm.expect_revert("unknown move"):
            w.tribunal.file_dispute("mv_999999", "this move does not exist at all", "nerf")


def test_retired_move_cannot_be_disputed(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice)
    with w.vm.prank(w.alice):
        w.bestiary.retire_move(mid)
    with w.vm.prank(w.bob):
        with w.vm.expect_revert("has been retired"):
            w.tribunal.file_dispute(mid, "trying to dispute a move that is gone", "buff")


def test_move_cooldown_blocks_a_second_filing(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice)
    with w.vm.prank(w.bob):
        w.tribunal.file_dispute(mid, "first dispute against this move here", "nerf")
    with w.vm.prank(w.carol):
        with w.vm.expect_revert("still cooling down"):
            w.tribunal.file_dispute(mid, "second dispute far too soon after first", "nerf")
    # after the cooldown elapses it is allowed again
    w.vm.advance(3601)
    with w.vm.prank(w.carol):
        did = w.tribunal.file_dispute(mid, "trying again now the move has rested", "nerf")
    assert w.tribunal.get_dispute(did)["status"] == "filed"


def test_filer_cooldown_between_moves(wordrena):
    w = wordrena
    _, m1 = _move(w, w.alice)
    _, m2 = _move(w, w.carol)
    with w.vm.prank(w.bob):
        w.tribunal.file_dispute(m1, "disputing the first move right now", "nerf")
        with w.vm.expect_revert("filing too quickly"):
            w.tribunal.file_dispute(m2, "immediately disputing a second move too", "nerf")
    w.vm.advance(31)
    with w.vm.prank(w.bob):
        did = w.tribunal.file_dispute(m2, "now enough time has passed to file again", "nerf")
    assert w.tribunal.get_dispute(did)["status"] == "filed"


# ---------- resolving ----------


def test_upheld_dispute_rebalances_and_refunds(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice, power=30, budget=70)
    bond = gen(0.1)
    with w.vm.prank(w.bob):
        w.vm.value = bond
        did = w.tribunal.file_dispute(mid, "one mana for thirty power is absurd, tone it down", "nerf")

    with w.vm.prank(w.bob):
        w.vm.mock_llm(
            r"balance jury",
            jury_reply(upheld=True, new_power=12, new_mana=4, new_cooldown=2, new_power_budget=42, reason_code="undercosted"),
        )
        out = w.tribunal.resolve_dispute(did)

    assert out["status"] == "upheld"
    assert out["new_power"] == 12
    # the rebalance reached the bestiary
    m = w.bestiary.get_move(mid)
    assert m["power"] == 12
    assert m["mana_cost"] == 4
    assert m["status"] == "rebalanced"
    assert m["disputes"] == 1
    # the bond came back to the challenger
    refunds = [t for t in _transfers_without_calls(w) if t["value"] == bond]
    assert len(refunds) == 1


def test_rejected_dispute_forfeits_bond_to_treasury(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice, power=14, budget=25)
    bond = gen(0.1)
    with w.vm.prank(w.bob):
        w.vm.value = bond
        did = w.tribunal.file_dispute(mid, "i simply do not like losing to this move at all", "nerf")

    with w.vm.prank(w.bob):
        w.vm.mock_llm(r"balance jury", jury_reply(upheld=False, reason_code="fair"))
        out = w.tribunal.resolve_dispute(did)

    assert out["status"] == "rejected"
    # move is untouched
    m = w.bestiary.get_move(mid)
    assert m["power"] == 14
    assert m["status"] == "forged"
    # bond is now in the treasury, and was not refunded
    assert w.tribunal.tribunal_stats()["treasury"] == bond
    assert [t for t in _transfers_without_calls(w) if t["value"] == bond] == []


def test_resolve_permissions_and_state(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice)
    with w.vm.prank(w.bob):
        did = w.tribunal.file_dispute(mid, "a genuine complaint about this move here", "nerf")

    with w.vm.expect_revert("unknown dispute"):
        w.tribunal.resolve_dispute("dp_999999")

    # a bystander who is neither challenger nor owner cannot summon the jury
    with w.vm.prank(w.carol):
        with w.vm.expect_revert("only the challenger or the bench"):
            w.tribunal.resolve_dispute(did)

    with w.vm.prank(w.bob):
        w.vm.mock_llm(r"balance jury", jury_reply(upheld=True))
        w.tribunal.resolve_dispute(did)
        with w.vm.expect_revert("already settled"):
            w.tribunal.resolve_dispute(did)


def test_withdraw_treasury_is_owner_only(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice, power=14, budget=25)
    with w.vm.prank(w.bob):
        w.vm.value = gen(0.1)
        did = w.tribunal.file_dispute(mid, "grumbling about a move that is actually fine", "nerf")
    with w.vm.prank(w.bob):
        w.vm.mock_llm(r"balance jury", jury_reply(upheld=False))
        w.tribunal.resolve_dispute(did)

    # non owner cannot withdraw
    with w.vm.prank(w.bob):
        with w.vm.expect_revert("only the owner"):
            w.tribunal.withdraw_treasury(w.bob)

    # owner (default deployer) can
    w.tribunal.withdraw_treasury(w.carol)
    assert w.tribunal.tribunal_stats()["treasury"] == 0


def test_tribunal_stats_and_move_index(wordrena):
    w = wordrena
    _, mid = _move(w, w.alice)
    with w.vm.prank(w.bob):
        did = w.tribunal.file_dispute(mid, "a first complaint that will be upheld today", "nerf")
    with w.vm.prank(w.bob):
        w.vm.mock_llm(r"balance jury", jury_reply(upheld=True))
        w.tribunal.resolve_dispute(did)

    forced = w.tribunal.disputes_for_move(mid)
    assert len(forced) == 1
    assert forced[0]["dispute_id"] == did

    stats = w.tribunal.tribunal_stats()
    assert stats["total"] == 1
    assert stats["upheld"] == 1
    assert stats["pending"] == 0
