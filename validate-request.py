#!/usr/bin/env python3
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError


def main(args):
    if len(args) != 2:
        print("usage: validate-request.py <schema.json> <request.json>", file=sys.stderr)
        return 2

    try:
        schema = json.loads(Path(args[0]).read_text())
        request = json.loads(Path(args[1]).read_text())
        Draft202012Validator.check_schema(schema)
        error = next(Draft202012Validator(schema).iter_errors(request), None)
    except (OSError, json.JSONDecodeError, SchemaError) as exc:
        print(f"invalid request: {exc}", file=sys.stderr)
        return 1

    if error:
        print(f"invalid request at {error.json_path}: {error.message}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
