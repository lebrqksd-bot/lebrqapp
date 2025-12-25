#!/usr/bin/env python3

with open('migration_clean.sql', 'rb') as f:
    content = f.read()

# Find the offset of the "We keep" string
search = b'We keep'
idx = content.find(search)

if idx >= 0:
    # Print bytes around it
    start = max(0, idx - 20)
    end = min(len(content), idx + 20)
    print(f"Bytes around 'We keep': {content[start:end]}")
    print(f"Hex: {content[start:end].hex()}")
else:
    print("Not found")
