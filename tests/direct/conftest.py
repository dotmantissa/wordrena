import os
import sys
import types

import pytest

sys_path = os.path.dirname(os.path.abspath(__file__))
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)

import gl_runtime  # noqa: E402
from gl_runtime import DirectVM, Address  # noqa: E402

CONTRACTS = os.path.abspath(os.path.join(sys_path, "..", "..", "contracts"))

ATTO = 10**18


def gen(amount) -> int:
    return int(amount * ATTO)


def _addr(seed: int) -> Address:
    return Address(bytes([0xA0]) + seed.to_bytes(19, "big"))


@pytest.fixture()
def direct_vm():
    return DirectVM()


@pytest.fixture()
def direct_deploy(direct_vm):
    def _deploy(filename, *args):
        path = os.path.join(CONTRACTS, filename)
        if not os.path.exists(path):
            raise FileNotFoundError(path)
        return direct_vm.deploy(path, *args)

    return _deploy


@pytest.fixture()
def direct_alice():
    return _addr(1)


@pytest.fixture()
def direct_bob():
    return _addr(2)


@pytest.fixture()
def direct_carol():
    return _addr(3)


@pytest.fixture()
def direct_dave():
    return _addr(4)


@pytest.fixture()
def wordrena(direct_vm):
    """A fully wired game: bestiary, arena and tribunal deployed and linked,
    biomes seeded, owned by the default deployer. Actor keys are attached for
    convenience so a test can prank straight into a trainer."""
    bestiary = direct_vm.deploy(os.path.join(CONTRACTS, "Bestiary.py"))
    arena = direct_vm.deploy(os.path.join(CONTRACTS, "Arena.py"), bestiary.address)
    tribunal = direct_vm.deploy(os.path.join(CONTRACTS, "Tribunal.py"), bestiary.address)

    # owner wiring (default sender is the deployer)
    bestiary.set_arena(arena.address)
    bestiary.set_tribunal(tribunal.address)
    arena.seed_biomes()

    return types.SimpleNamespace(
        vm=direct_vm,
        bestiary=bestiary,
        arena=arena,
        tribunal=tribunal,
        alice=_addr(1),
        bob=_addr(2),
        carol=_addr(3),
        dave=_addr(4),
    )


# A well formed forge reply the LLM mock can return for a plain damage move.
def forge_reply(
    power=15,
    mana_cost=2,
    cooldown=0,
    accuracy=100,
    effect_kind="none",
    effect_magnitude=0,
    effect_duration=0,
    scaling="none",
    power_budget=25,
    verdict="A clean, honest hit.",
):
    import json

    return json.dumps(
        {
            "power": power,
            "mana_cost": mana_cost,
            "cooldown": cooldown,
            "accuracy": accuracy,
            "effect_kind": effect_kind,
            "effect_magnitude": effect_magnitude,
            "effect_duration": effect_duration,
            "scaling": scaling,
            "power_budget": power_budget,
            "verdict": verdict,
        }
    )


def jury_reply(
    upheld=True,
    new_power=10,
    new_mana=4,
    new_cooldown=2,
    new_power_budget=40,
    reason_code="undercosted",
    summary="The numbers did not match the words, adjusted.",
):
    import json

    return json.dumps(
        {
            "upheld": upheld,
            "new_power": new_power,
            "new_mana": new_mana,
            "new_cooldown": new_cooldown,
            "new_power_budget": new_power_budget,
            "reason_code": reason_code,
            "summary": summary,
        }
    )
