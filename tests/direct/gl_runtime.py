"""An in process emulation of the GenLayer VM for direct mode tests.

It executes the real contract source against a faithful subset of the SDK:
storage containers behave live, storage dataclasses copy on read (so skipped
write backs fail here exactly like they would on chain), non deterministic
blocks evaluate eagerly with mocked LLM replies, and cross contract view or
emitted calls resolve against contracts deployed in the same runtime.
"""

import copy
import json
import re
import sys
import types as pytypes
import datetime as _dt


class UserError(Exception):
    def __init__(self, data):
        self.data = data
        super().__init__(str(data))


class VMError(Exception):
    pass


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class Lazy:
    def __init__(self, fn):
        self._fn = fn

    def get(self):
        return self._fn()


class Address:
    SIZE = 20

    __slots__ = ("_b",)

    def __init__(self, val):
        if isinstance(val, Address):
            self._b = val._b
            return
        if isinstance(val, (bytes, bytearray)):
            if len(val) != 20:
                raise ValueError("address must be 20 bytes")
            self._b = bytes(val)
            return
        if isinstance(val, str):
            s = val[2:] if val.startswith("0x") else val
            self._b = bytes.fromhex(s)
            return
        raise TypeError("cannot build an address from " + type(val).__name__)

    @property
    def as_bytes(self):
        return self._b

    @property
    def as_hex(self):
        return "0x" + self._b.hex()

    def __eq__(self, other):
        return isinstance(other, Address) and other._b == self._b

    def __hash__(self):
        return hash(self._b)

    def __lt__(self, other):
        return self._b < other._b

    def __repr__(self):
        return "Address(" + self.as_hex + ")"


Address.ZERO = Address(b"\x00" * 20)


u8 = u16 = u24 = u32 = u40 = u48 = u56 = u64 = u72 = u80 = u88 = u96 = int
u104 = u112 = u120 = u128 = u136 = u144 = u152 = u160 = u168 = u176 = int
u184 = u192 = u200 = u208 = u216 = u224 = u232 = u240 = u248 = u256 = int
i8 = i16 = i32 = i64 = i128 = i256 = bigint = int


class StorageMap(dict):
    """Live mapping container. Dataclass values copy on read."""

    def __getitem__(self, k):
        v = super().__getitem__(k)
        if getattr(v, "__gl_storage_obj__", False):
            return copy.deepcopy(v)
        return v


class DynArray(list):
    pass


def allow_storage(cls):
    cls.__gl_storage_obj__ = True
    return cls


class Contract:
    def __receive__(self):
        pass


class _WriteNS:
    def __call__(self, fn):
        fn.__gl_write__ = True
        fn.__gl_view__ = False
        return fn

    @staticmethod
    def payable(fn):
        fn.__gl_write__ = True
        fn.__gl_view__ = False
        fn.__gl_payable__ = True
        return fn


class _PublicNS:

    @staticmethod
    def view(fn):
        fn.__gl_view__ = True
        fn.__gl_write__ = False
        return fn

    write = _WriteNS()


class _PrivateNS:

    @staticmethod
    def view(fn):
        fn.__gl_view__ = True
        fn.__gl_write__ = False
        fn.__gl_private__ = True
        return fn

    write = _WriteNS()


def _now_iso(d=None):
    base = d or _dt.datetime.now(_dt.timezone.utc)
    return base.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(txt):
    t = txt.strip()
    if t.endswith("Z"):
        t = t[:-1] + "+00:00"
    d = _dt.datetime.fromisoformat(t)
    if d.tzinfo is None:
        d = d.replace(tzinfo=_dt.timezone.utc)
    return d


class MessageCtx:
    def __init__(self):
        self.sender_address = Address.ZERO
        self.contract_address = Address.ZERO
        self.origin_address = Address.ZERO
        self.value = 0
        self.is_init = False
        self.chain_id = 61999
        self.raw = {"datetime": _now_iso()}

    def reset(self, sender, value, contract_addr, when_iso):
        self.sender_address = sender
        self.contract_address = contract_addr
        self.origin_address = sender
        self.value = value
        self.is_init = False
        self.raw.clear()
        self.raw["datetime"] = when_iso


class VMNS:
    UserError = UserError
    VMError = VMError
    Return = Return

    def run_nondet(self, leader_fn, validator_fn):
        result = leader_fn()
        ok = validator_fn(Return(result))
        if not ok:
            raise VMError("validators disagreed on the jury reply")
        return Lazy(lambda: result)

    def spawn_sandbox(self, fn):
        try:
            return Return(fn())
        except Exception as e:
            return UserError(str(e))

    def unpack_result(self, res):
        if isinstance(res, UserError):
            raise res
        if isinstance(res, VMError):
            raise UserError("vm error: " + str(res))
        return res.calldata


class WebResponse:
    """Mirror of the on chain web reply: an int status and raw bytes body."""

    def __init__(self, status, body):
        self.status = int(status)
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.body = bytes(body)


class WebError(Exception):
    pass


class WebNS:
    def __init__(self, runtime):
        self._rt = runtime

    def _lookup(self, url):
        for pat, resp in reversed(self._rt.web_mocks):
            if pat.search(url):
                return WebResponse(resp["status"], resp["body"])
        raise WebError("no web mock matched " + url)

    def get(self, url, headers=None, **kw):
        return self._lookup(url)

    def request(self, url, method="GET", headers=None, body=None, **kw):
        return self._lookup(url)

    def render(self, url, mode="text", **kw):
        return self._lookup(url).body.decode("utf-8", errors="replace")


class NondetNS:
    def __init__(self, runtime):
        self._rt = runtime
        self.web = WebNS(runtime)

    def exec_prompt(self, prompt, response_format="text", **kw):
        text = self._rt.mocked_llm(prompt)
        if response_format == "json":
            return json.loads(text)
        return text


class EqPrincipleNS:
    """
    The consensus wrappers. In a single process there is one validator, so the
    leader result is the result. Tests exercise the leader path (LLM and web
    mocks) exactly as it runs on chain; validator disagreement is a network
    concern and is out of scope for direct mode.
    """

    def __init__(self, runtime):
        self._rt = runtime

    def prompt_comparative(self, leader_fn, criteria=None, **kw):
        return leader_fn()

    def prompt_non_comparative(self, leader_fn, *a, **kw):
        return leader_fn()

    def strict_eq(self, fn, **kw):
        return fn()


class _ViewGetter:
    def __init__(self, inst):
        self._inst = inst

    def __getattr__(self, name):
        fn = getattr(self._inst, name)
        if not getattr(fn, "__gl_view__", False):
            raise AttributeError(name + " is not a view method")

        def caller(*args, **kwargs):
            return fn(*args, **kwargs)

        return caller


class _EmitGetter:
    def __init__(self, runtime, to, value, on):
        self._rt = runtime
        self._to = to
        self._value = value
        self._on = on

    def __getattr__(self, name):
        rt = self._rt
        to = self._to
        value = self._value
        on = self._on

        def caller(*args, **kwargs):
            emitter = rt.message.contract_address
            rt.pending_emits.append(("call", to, name, args, value, on, emitter))

        return caller


class ContractProxy:
    def __init__(self, runtime, addr):
        self._rt = runtime
        self._addr = addr

    def view(self):
        inst = self._rt.instances[self._addr]
        return _ViewGetter(inst)

    def emit(self, value=0, on="finalized"):
        return _EmitGetter(self._rt, self._addr, value, on)

    def emit_transfer(self, value, on="finalized"):
        if value <= 0:
            raise ValueError("emit_transfer needs a positive amount")
        emitter = self._rt.message.contract_address
        self._rt.pending_emits.append(
            ("transfer", self._addr, None, value, 0, on, emitter)
        )


GENVM_INT_NAMES = (
    "u8 u16 u24 u32 u40 u48 u56 u64 u72 u80 u88 u96 u104 u112 u120 u128 "
    "u136 u144 u152 u160 u168 u176 u184 u192 u200 u208 u216 u224 u232 "
    "u240 u248 u256 i8 i16 i32 i64 i128 i256 bigint"
).split()


def build_fake_module(runtime):
    fake = pytypes.ModuleType("genlayer")
    fake.Contract = Contract
    fake.public = _PublicNS()
    fake.private = _PrivateNS()
    fake.TreeMap = StorageMap
    fake.DynArray = DynArray
    fake.Array = DynArray
    fake.allow_storage = allow_storage
    fake.Address = Address
    for n in GENVM_INT_NAMES:
        setattr(fake, n, int)
    fake.message = runtime.message
    fake.message_raw = runtime.message.raw
    fake.vm = runtime.vm
    fake.nondet = runtime.nondet
    fake.eq_principle = runtime.eq_principle
    fake.get_at = lambda addr: ContractProxy(runtime, addr)
    fake.get_contract_at = lambda addr: ContractProxy(runtime, addr)
    fake.contract = pytypes.SimpleNamespace(
        get_at=lambda addr: ContractProxy(runtime, addr),
        Contract=Contract,
        deploy=runtime.deploy,
        interface=lambda d: (lambda addr: ContractProxy(runtime, addr)),
    )
    fake.__all__ = [
        "gl",
        "Contract",
        "contract",
        "public",
        "private",
        "TreeMap",
        "DynArray",
        "Array",
        "allow_storage",
        "Address",
        "u8",
        "u16",
        "u32",
        "u64",
        "u128",
        "u256",
        "bigint",
    ]
    fake.gl = fake
    return fake


def init_storage_fields(inst):
    """Real GenVM materializes annotated storage slots automatically."""
    import typing

    for klass in reversed(type(inst).__mro__):
        anns = getattr(klass, "__annotations__", {})
        for fname, ftype in anns.items():
            if fname.startswith("_") or hasattr(inst, fname):
                continue
            origin = typing.get_origin(ftype)
            is_map = origin is not None and (
                origin is StorageMap or (isinstance(origin, type) and issubclass(origin, dict))
            )
            is_list = origin is not None and (
                origin is list or (isinstance(origin, type) and issubclass(origin, list))
            )
            if is_map:
                setattr(inst, fname, StorageMap())
            elif is_list:
                setattr(inst, fname, DynArray())


def load_contract_class(path, runtime):
    src = open(path).read()
    mod_name = "_contract_" + re.sub(r"[^A-Za-z0-9]", "_", path)
    mod = pytypes.ModuleType(mod_name)
    sys.modules[mod_name] = mod
    prev_gl = sys.modules.get("genlayer")
    sys.modules["genlayer"] = build_fake_module(runtime)
    try:
        code = compile(src, path, "exec")
        exec(code, mod.__dict__)
    finally:
        if prev_gl is None:
            sys.modules.pop("genlayer", None)
        else:
            sys.modules["genlayer"] = prev_gl
    found = []
    for name in dir(mod):
        obj = getattr(mod, name)
        if isinstance(obj, type) and issubclass(obj, Contract) and obj is not Contract:
            found.append(obj)
    if len(found) != 1:
        raise RuntimeError("expected exactly one contract class in " + path)
    runtime.loaded_modules[path] = mod
    return found[0]


class ExpectRevert:
    def __init__(self, vm, fragment):
        self._vm = vm
        self._fragment = fragment

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            raise AssertionError(
                "expected revert containing "
                + repr(self._fragment)
                + " but the call succeeded"
            )
        if exc_type is UserError:
            msg = str(exc.data) if hasattr(exc, "data") else str(exc)
            if self._fragment in msg:
                return True
            raise AssertionError(
                "revert message " + repr(msg) + " does not contain " + repr(self._fragment)
            )
        return False


class Prank:
    def __init__(self, vm, who):
        self._vm = vm
        self._who = who

    def __enter__(self):
        prev = self._vm.sender
        self._vm.sender = self._who
        self._prev = prev
        return self._who

    def __exit__(self, *a):
        self._vm.sender = self._prev
        return False


class DirectVM:
    """One fresh blockchain per test."""

    def __init__(self):
        now = _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0)
        self.now = now
        self.message = MessageCtx()
        self.message.raw["datetime"] = _now_iso(now)
        self.vm = VMNS()
        self.nondet = NondetNS(self)
        self.eq_principle = EqPrincipleNS(self)
        self.instances = {}
        self.pending_emits = []
        self.executed_transfers = []
        self.llm_mocks = []
        self.web_mocks = []
        self.native_balances = {}
        self.deploy_counter = 0
        self.loaded_modules = {}
        self.sender = Address(b"\x11" * 20)
        self.value = 0

    # ----- test facing controls -----

    def warp(self, when):
        if isinstance(when, _dt.datetime):
            self.now = when.replace(microsecond=0)
        elif isinstance(when, (int, float)):
            self.now = _dt.datetime.fromtimestamp(when, _dt.timezone.utc)
        else:
            self.now = _parse_iso(str(when))
        self.message.raw["datetime"] = _now_iso(self.now)

    def advance(self, seconds):
        self.warp(self.now + _dt.timedelta(seconds=int(seconds)))

    def deal(self, account, amount):
        self.native_balances[account.as_hex] = int(amount)

    def mock_llm(self, pattern, reply):
        self.llm_mocks.append((re.compile(pattern), reply))

    def clear_mocks(self):
        self.llm_mocks = []

    def mock_web(self, pattern, status=200, body=""):
        self.web_mocks.append((re.compile(pattern), {"status": status, "body": body}))

    def mock_web_json(self, pattern, obj, status=200):
        self.web_mocks.append(
            (re.compile(pattern), {"status": status, "body": json.dumps(obj)})
        )

    def clear_web_mocks(self):
        self.web_mocks = []

    def mocked_llm(self, prompt):
        for pat, reply in reversed(self.llm_mocks):
            if pat.search(prompt):
                if isinstance(reply, list):
                    if not reply:
                        raise UserError("[LLM_ERROR] mock reply queue exhausted")
                    return reply.pop(0)
                return reply
        raise UserError("[LLM_ERROR] no mock matched this prompt")

    def expect_revert(self, fragment):
        return ExpectRevert(self, fragment)

    def prank(self, who):
        return Prank(self, who)

    # ----- deployment -----

    def deploy(self, path, *args):
        deployer = self.sender
        cls = load_contract_class(path, self)
        self.deploy_counter += 1
        addr = Address(bytes([0xC0]) + self.deploy_counter.to_bytes(19, "big"))
        if addr in self.instances:
            raise RuntimeError("address collision while deploying")
        self.message.reset(deployer, 0, addr, _now_iso(self.now))
        self.message.is_init = True
        try:
            inst = cls.__new__(cls)
            init_storage_fields(inst)
            inst.__init__(*args)
        finally:
            self.message.is_init = False
        self.instances[addr] = inst
        return ContractHandle(self, addr, inst)

    # ----- transaction execution -----

    def run_write(self, target_addr, fn, args, kwargs):
        self.message.reset(
            self.sender, int(self.value), target_addr, _now_iso(self.now)
        )
        try:
            result = fn(*args, **kwargs)
        finally:
            self.value = 0
        self.flush_emits()
        return result

    def flush_emits(self):
        guard = 0
        while self.pending_emits:
            guard += 1
            if guard > 500:
                raise RuntimeError("emit flush ran away, possible loop")
            item = self.pending_emits.pop(0)
            kind = item[0]
            if kind == "transfer":
                _, to, _m, value, _v, _on, _em = item
                self.executed_transfers.append({"to": to, "value": int(value)})
                bal = self.native_balances.get(to.as_hex)
                if bal is not None:
                    self.native_balances[to.as_hex] = bal + int(value)
                continue
            _, to, method, args, value, _on, emitter = item
            inst = self.instances.get(to)
            if inst is None:
                raise UserError("[EXPECTED] emit targeted an unknown contract")
            self.executed_transfers.append(
                {"to": to, "value": int(value), "call": method}
            )
            prev = (
                self.message.sender_address,
                self.message.contract_address,
                self.message.value,
                dict(self.message.raw),
            )
            self.message.reset(emitter, int(value), to, _now_iso(self.now))
            try:
                fn = getattr(inst, method)
                fn(*args)
            finally:
                (
                    self.message.sender_address,
                    self.message.contract_address,
                    self.message.value,
                ) = (prev[0], prev[1], prev[2])
                self.message.raw.clear()
                self.message.raw.update(prev[3])


class ContractHandle:
    def __init__(self, runtime, addr, inst):
        object.__setattr__(self, "_rt", runtime)
        object.__setattr__(self, "_addr", addr)
        object.__setattr__(self, "_inst", inst)

    @property
    def address(self):
        return self._addr

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        inst = object.__getattribute__(self, "_inst")
        rt = object.__getattribute__(self, "_rt")
        addr = object.__getattribute__(self, "_addr")
        raw = getattr(inst, name)
        if getattr(raw, "__gl_view__", False):

            def call_view(*args, **kwargs):
                return raw(*args, **kwargs)

            return call_view

        def call_write(*args, **kwargs):
            if not getattr(raw, "__gl_write__", False):
                raise AttributeError(name + " is neither marked view nor write")
            return rt.run_write(addr, raw, args, kwargs)

        return call_write
