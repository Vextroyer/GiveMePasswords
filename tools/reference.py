#!/usr/bin/env python3
"""Independent reference implementation of HPG-1.

This file exists to catch "two implementations of the same bug": it shares no
code with the shipped JavaScript and uses only the Python standard library.
It is not shipped to the browser.

Usage:
    python3 tools/reference.py            # verify against test-vectors.json
    python3 tools/reference.py --emit     # print the computed vectors as JSON
    python3 tools/reference.py --check    # same as the default

Exit status is non-zero if any published vector disagrees.
"""

from __future__ import annotations

import calendar
import hashlib
import hmac
import json
import sys
from pathlib import Path

VERSION = "HPG-1"
SALT = f"{VERSION}|seed".encode()
LIMIT = 4_200_000_000
MOD = 100_000_000
HASH = hashlib.sha256
HASH_LEN = HASH().digest_size
ROOT = Path(__file__).resolve().parent.parent
VECTORS = ROOT / "test-vectors.json"

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
CHECKSUM_CHARS = 2
PAYLOAD_CHARS = 26


# ---------------------------------------------------------------------------
# HKDF-SHA-256 (RFC 5869), built from hmac/hashlib
# ---------------------------------------------------------------------------


def hkdf_extract(salt: bytes, ikm: bytes) -> bytes:
    if not salt:
        salt = b"\x00" * HASH_LEN
    return hmac.new(salt, ikm, HASH).digest()


def hkdf_expand(prk: bytes, info: bytes, length: int) -> bytes:
    assert 0 < length <= 255 * HASH_LEN
    block = b""
    okm = b""
    counter = 1
    while len(okm) < length:
        block = hmac.new(prk, block + info + bytes([counter]), HASH).digest()
        okm += block
        counter += 1
    return okm[:length]


def hkdf(ikm: bytes, salt: bytes, info: bytes, length: int) -> bytes:
    return hkdf_expand(hkdf_extract(salt, ikm), info, length)


# ---------------------------------------------------------------------------
# HPG-1
# ---------------------------------------------------------------------------


def day_info(month: str, day: int, attempt: int) -> bytes:
    return f"{VERSION}|{month}|{day:02d}|{attempt}".encode()


def password8(seed: bytes, month: str, day: int, attempt: int = 0) -> str:
    while True:
        okm = hkdf(seed, SALT, day_info(month, day, attempt), 8)
        x = int.from_bytes(okm[:4], "big")
        if x < LIMIT:
            return f"{x % MOD:08d}"
        attempt += 1


def attempt_x(seed: bytes, month: str, day: int, attempt: int = 0) -> int:
    okm = hkdf(seed, SALT, day_info(month, day, attempt), 8)
    return int.from_bytes(okm[:4], "big")


def month_list(seed: bytes, month: str) -> list[str]:
    year, month_number = (int(part) for part in month.split("-"))
    days = calendar.monthrange(year, month_number)[1]
    return [password8(seed, month, day) for day in range(1, days + 1)]


# ---------------------------------------------------------------------------
# HPG1 recovery codes
# ---------------------------------------------------------------------------


def _to_base32(value: int, length: int) -> str:
    return "".join(
        ALPHABET[(value >> (5 * position)) & 31] for position in range(length - 1, -1, -1)
    )


def _from_base32(text: str) -> int:
    value = 0
    for char in text:
        value = (value << 5) | ALPHABET.index(char)
    return value


def _checksum(seed: bytes) -> int:
    digest = HASH(b"HPG1" + seed).digest()
    return (digest[0] << 2) | (digest[1] >> 6)


def encode_recovery_code(seed: bytes) -> str:
    if len(seed) != 16:
        raise ValueError("seed must be 16 bytes")
    body = _to_base32(int.from_bytes(seed, "big"), PAYLOAD_CHARS)
    body += _to_base32(_checksum(seed), CHECKSUM_CHARS)
    return "HPG1-" + "-".join(body[i : i + 4] for i in range(0, len(body), 4))


def parse_recovery_code(code: str) -> bytes:
    text = code.upper().replace("-", "").replace(" ", "")
    if text.startswith("HPG1"):
        text = text[4:]
    text = text.replace("I", "1").replace("L", "1").replace("O", "0")
    if len(text) != PAYLOAD_CHARS + CHECKSUM_CHARS:
        raise ValueError("recovery code must contain 28 characters")
    payload, check = text[:PAYLOAD_CHARS], text[PAYLOAD_CHARS:]
    value = _from_base32(payload)
    if value >> 128:
        raise ValueError("recovery code overflows 128 bits")
    seed = value.to_bytes(16, "big")
    if _from_base32(check) != _checksum(seed):
        raise ValueError("recovery code checksum mismatch")
    return seed


def seed_fingerprint(seed: bytes) -> str:
    if len(seed) != 16:
        raise ValueError("seed must be 16 bytes")
    return HASH(b"HPG1|fingerprint" + seed).hexdigest()[:8].upper()


# ---------------------------------------------------------------------------
# Cross-check against the published vectors
# ---------------------------------------------------------------------------


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def verify(vectors: dict) -> dict:
    computed: dict = {}

    rfc = vectors["hkdf_sha256_rfc5869_a1"]
    okm = hkdf(
        bytes.fromhex(rfc["ikm_hex"]),
        bytes.fromhex(rfc["salt_hex"]),
        bytes.fromhex(rfc["info_hex"]),
        len(rfc["okm_hex"]) // 2,
    )
    if okm.hex() != rfc["okm_hex"]:
        fail(f"RFC 5869 A.1: {okm.hex()} != {rfc['okm_hex']}")

    passwords = []
    for vector in vectors["passwords"]:
        actual = password8(
            bytes.fromhex(vector["seed_hex"]),
            vector["month"],
            vector["day"],
            vector["attempt"],
        )
        if actual != vector["password8"]:
            fail(f"password vector {vector}: {actual}")
        passwords.append(actual)

    rejection = vectors["rejection"]
    actual_x = attempt_x(
        bytes.fromhex(rejection["seed_hex"]),
        rejection["month"],
        rejection["day"],
        0,
    )
    if actual_x != rejection["attempt0_x"]:
        fail(f"rejection x: {actual_x} != {rejection['attempt0_x']}")
    if actual_x < rejection["limit"]:
        fail("rejection vector does not actually fall outside the limit")

    months = []
    for vector in vectors["months"]:
        actual = month_list(bytes.fromhex(vector["seed_hex"]), vector["month"])
        if actual != vector["passwords"]:
            fail(f"month {vector['month']} / {vector['seed_hex']} does not reproduce")
        months.append(actual)

    codes = []
    for vector in vectors["recovery_codes"]:
        seed = bytes.fromhex(vector["seed_hex"])
        if encode_recovery_code(seed) != vector["code"]:
            fail(f"recovery code encode: {vector['seed_hex']}")
        if parse_recovery_code(vector["code"]) != seed:
            fail(f"recovery code decode: {vector['code']}")
        if seed_fingerprint(seed) != vector["fingerprint"]:
            fail(f"fingerprint: {vector['seed_hex']}")
        codes.append(vector["code"])

    computed["passwords"] = passwords
    computed["months"] = months
    computed["recovery_codes"] = codes
    return computed


def main(argv: list[str]) -> int:
    vectors = json.loads(VECTORS.read_text())
    computed = verify(vectors)

    if "--emit" in argv:
        print(json.dumps(computed, indent=2))
        return 0

    print(f"OK: {VECTORS.name} reproduced by the Python reference")
    print(f"  spec:            {vectors['spec']}")
    print(f"  password vectors:{len(computed['passwords'])}")
    print(f"  full months:     {len(computed['months'])}")
    print(f"  recovery codes:  {len(computed['recovery_codes'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
