#!/usr/bin/env python3
"""Working-tree secret regression guard (CI).

Fails if the credential that was previously leaked returns in the repository's
working tree (any tracked file). This catches the literal being re-introduced
in a pushed commit, in any path/string/URL context.

History coverage is provided separately:
  * the gitleaks job already scans the full git history for generic secrets;
  * the GIT-SECRET-HISTORY-REPORT.md documents the manual purge step for the
    previously-leaked credential (history deletion is ALWAYS a human decision,
    never a CI/logic decision).

The PLAINTEXT of the leaked credential is intentionally not stored in this
repo. Only its SHA-256 fingerprint lives here, so CI can block reuse without
embedding or printing the secret. Alphanumeric tokens are hashed (not whole
lines) so the literal is caught even when embedded inside longer strings,
paths, or URLs.

Exit status: 0 = clean, 1 = previously-leaked credential detected.
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys

# SHA-256 of the known previously-leaked credential (plaintext never stored).
KNOWN_LEAKED_SHA256 = "1bd500720e1c665268604f7ffa42cb13599a5bd2b36a35f0d4ca7c5ea0a5084e"

TOKEN_RE = re.compile(rb"[A-Za-z0-9]+")

# Skip git tracked internals and binary/artifacts that can't contain it.
SKIP_DIRS = {".git"}


def _find_leaks(data: bytes) -> int:
    hits = 0
    for tok in TOKEN_RE.findall(data):
        if hashlib.sha256(tok).hexdigest() == KNOWN_LEAKED_SHA256:
            hits += 1
    return hits


def main() -> int:
    files = subprocess.check_output(
        ["git", "ls-files"], stderr=subprocess.DEVNULL, text=True
    ).splitlines()
    leaks = 0
    scanned = 0
    for rel in files:
        if not rel or any(part in SKIP_DIRS for part in rel.split("/")):
            continue
        path = os.path.join(".", rel)
        try:
            with open(path, "rb") as fh:
                data = fh.read()
        except OSError:
            continue
        scanned += 1
        leaks += _find_leaks(data)

    if leaks:
        print(
            "ERROR: previously-leaked credential is present in the working tree.",
            file=sys.stderr,
        )
        return 1
    print(
        "OK: scanned %d tracked files, no known-leaked credential found." % scanned
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())