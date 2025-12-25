#!/usr/bin/env python3

with open('migration.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Count the occurrences before
before = content.count(chr(0x2019))  # Unicode right single quotation mark
print(f"Found {before} Unicode apostrophes")

# Replace Unicode apostrophes with double ASCII quotes for PostgreSQL
content = content.replace(chr(0x2019), "''")

# Write back
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully created migration_clean.sql with escaped apostrophes")
