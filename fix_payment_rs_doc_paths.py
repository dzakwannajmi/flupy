path = "contracts/src/payment.rs"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    ("packages/flupy-core/src/recipient-hash.ts", "packages/fluppy-core/src/recipient-hash.ts"),
    ("packages/flupy-core/src/payer-hash.ts", "packages/fluppy-core/src/payer-hash.ts"),
    ("packages/flupy-browser/src/prover.ts", "packages/fluppy-browser/src/prover.ts"),
]

errors = []
for i, (old, _new) in enumerate(replacements, 1):
    count = content.count(old)
    if count != 1:
        errors.append(f"Block {i} ({old!r}): expected exactly 1 match, found {count}")

if errors:
    print("ABORTED — nothing written. Mismatches:")
    for e in errors:
        print(" -", e)
else:
    for old, new in replacements:
        content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("payment.rs updated: doc-comment paths now point to the renamed packages/fluppy-* folders.")