#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
from pathlib import Path

validator, schema, example = map(Path, sys.argv[1:])


def run(text):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as f:
        f.write(text)
        f.flush()
        return subprocess.run(
            [sys.executable, str(validator), str(schema), f.name],
            text=True,
            capture_output=True,
        )


valid = example.read_text()
result = run(valid)
assert result.returncode == 0, result.stderr
request = json.loads(valid)
for invalid in (
    "{not json",
    json.dumps({**request, "width": 513}),
    json.dumps({**request, "sampler": "euler"}),
):
    result = run(invalid)
    assert result.returncode != 0, f"unexpected acceptance: {invalid}"
print("request validation checks passed")
