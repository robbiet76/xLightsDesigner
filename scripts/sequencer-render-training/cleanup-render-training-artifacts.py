#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def byte_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except FileNotFoundError:
        return 0


def list_sorted(directory: Path, pattern: str):
    return sorted(
        directory.glob(pattern),
        key=lambda p: (p.stat().st_mtime, p.name),
        reverse=True,
    )


def protected(path: Path, protected_prefixes: list[str]) -> bool:
    name = path.name
    return any(name.startswith(prefix) for prefix in protected_prefixes)


def plan_removals(root: Path, keep_working_xsq: int, keep_manifests: int, protected_prefixes: list[str]):
    working = root / "working"
    fseq = root / "fseq"
    manifests = root / "manifests"

    removals = []

    if working.exists():
        for path in sorted(working.glob("*.fseq")):
            removals.append(
                {
                    "path": str(path),
                    "kind": "working_fseq_duplicate",
                    "sizeBytes": byte_size(path),
                }
            )

        xsq_candidates = [
            p for p in list_sorted(working, "*.xsq") if not protected(p, protected_prefixes)
        ]
        for path in xsq_candidates[keep_working_xsq:]:
            removals.append(
                {
                    "path": str(path),
                    "kind": "working_xsq_old",
                    "sizeBytes": byte_size(path),
                }
            )

    if manifests.exists():
        manifest_candidates = [
            p for p in list_sorted(manifests, "*.json") if not protected(p, protected_prefixes)
        ]
        for path in manifest_candidates[keep_manifests:]:
            removals.append(
                {
                    "path": str(path),
                    "kind": "manifest_old",
                    "sizeBytes": byte_size(path),
                }
            )

    sizes = {}
    for name in ["working", "fseq", "manifests", "records", "derived"]:
        folder = root / name
        total = 0
        count = 0
        if folder.exists():
            for child in folder.iterdir():
                if child.is_file():
                    total += byte_size(child)
                    count += 1
        sizes[name] = {"fileCount": count, "sizeBytes": total}

    return {"root": str(root), "sizes": sizes, "removals": removals}


def execute_removals(removals: list[dict]):
    deleted = []
    for item in removals:
        path = Path(item["path"])
        if path.exists():
            path.unlink()
            deleted.append(item)
    return deleted


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--keep-working-xsq", type=int, default=40)
    parser.add_argument("--keep-manifests", type=int, default=40)
    parser.add_argument("--protect-prefix", action="append", default=[])
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--out-file")
    args = parser.parse_args()

    root = Path(args.root)
    plan = plan_removals(root, args.keep_working_xsq, args.keep_manifests, args.protect_prefix)
    result = {
        "version": "1.0",
        "root": plan["root"],
        "dryRun": not args.apply,
        "keepWorkingXsq": args.keep_working_xsq,
        "keepManifests": args.keep_manifests,
        "protectedPrefixes": args.protect_prefix,
        "sizesBefore": plan["sizes"],
        "plannedRemovalCount": len(plan["removals"]),
        "plannedRemovalBytes": sum(item["sizeBytes"] for item in plan["removals"]),
        "plannedRemovals": plan["removals"],
    }

    if args.apply:
        deleted = execute_removals(plan["removals"])
        result["deletedCount"] = len(deleted)
        result["deletedBytes"] = sum(item["sizeBytes"] for item in deleted)
        result["deleted"] = deleted

    text = json.dumps(result, indent=2) + "\n"
    if args.out_file:
        Path(args.out_file).write_text(text)
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
