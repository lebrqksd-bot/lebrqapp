#!/usr/bin/env python3

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove all backticks (MySQL identifier quotes not supported in PostgreSQL)
content = content.replace('`', '')

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed all backticks from migration_clean.sql")
