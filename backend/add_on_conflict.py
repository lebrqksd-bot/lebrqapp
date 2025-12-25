#!/usr/bin/env python3
"""
Add ON CONFLICT (id) DO NOTHING to all INSERT statements to make them idempotent
This allows the migration to be run multiple times without duplicate key errors
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find INSERT statements that end with VALUES (...);
# We need to insert ON CONFLICT clause before the final semicolon

# Find all INSERT INTO statements and add ON CONFLICT
pattern = r'(INSERT INTO\s+\w+\s*\([^)]+\)\s*VALUES\s*[^;]+);'

def add_conflict_clause(match):
    insert_statement = match.group(1)
    # Add ON CONFLICT clause before the semicolon
    return f"{insert_statement}\nON CONFLICT (id) DO NOTHING;"

new_content = re.sub(pattern, add_conflict_clause, content, flags=re.DOTALL)

# Count how many INSERT statements we modified
insert_count = len(re.findall(r'INSERT INTO', content))
conflict_count = len(re.findall(r'ON CONFLICT', new_content))

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"✓ Added ON CONFLICT clause to {conflict_count} INSERT statements")
print(f"  Total INSERT statements: {insert_count}")
