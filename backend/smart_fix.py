#!/usr/bin/env python3

with open('migration.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace Unicode apostrophes (U+2019) with double ASCII quotes
content = content.replace('\u2019', "''")

# 2. Replace specific problematic ASCII contractions with escaped versions
# Only replace apostrophes that are part of common contractions (not closing quotes)
replacements = {
    "We'll": "We''ll",
    "can't": "can''t",
    "don't": "don''t",
    "won't": "won''t",
    "it's": "it''s",
    "that's": "that''s",
    "Vendor 'None None'": "Vendor ''None None''",  # Special case
}

for old, new in replacements.items():
    content = content.replace(old, new)

# 3. Remove backticks
content = content.replace('`', '')

# 4. Fix BIGINT(20)
content = content.replace('BIGINT(20)', 'BIGINT')

# Write output
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Applied targeted PostgreSQL fixes")
