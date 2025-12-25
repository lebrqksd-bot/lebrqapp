#!/usr/bin/env python3

# Read migration.sql (the clean original)
with open('migration.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace ALL Unicode single quotes (U+2019) with escaped ASCII quotes
# This includes: ' (right single quote) which is U+2019
content = content.replace('\u2019', "''")

# Also handle left single quote if present (U+2018)
content = content.replace('\u2018', "'")

# Write to migration_clean.sql
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("Created migration_clean.sql with all Unicode quotes properly escaped")
