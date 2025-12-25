#!/usr/bin/env python3

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Simply replace the Unicode right single quotation mark (U+2019, which is what's in "We'll")
# with two ASCII single quotes '' for PostgreSQL

# The character ' (U+2019) needs to become ''
content = content.replace('\u2019', "''")

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced Unicode apostrophes with escaped ASCII quotes")
