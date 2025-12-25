#!/usr/bin/env python3

# Read the original migration.sql
with open('migration.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace all Unicode single quotes (U+2019 - right single quotation mark)
#    with two ASCII single quotes for PostgreSQL escaping
content = content.replace('\u2019', "''")

# 2. Replace left single quote if present (U+2018)
content = content.replace('\u2018', "'")

# 3. Remove all backticks (MySQL syntax not supported in PostgreSQL)
content = content.replace('`', '')

# 4. Fix BIGINT(20) -> BIGINT
content = content.replace('BIGINT(20)', 'BIGINT')

# Write the comprehensive fix
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Unicode quotes escaped")
print("✓ Backticks removed")
print("✓ BIGINT(20) fixed")
print("\nmigration_clean.sql ready for PostgreSQL deployment")
