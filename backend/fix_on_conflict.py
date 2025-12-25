#!/usr/bin/env python3
"""
Remove the incorrectly placed ON CONFLICT clauses and add them properly
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the incorrectly added ON CONFLICT clauses
content = re.sub(r'\nON CONFLICT \(id\) DO NOTHING;', '', content)

# Now add them correctly - they should be part of the INSERT statement
# Pattern: Find INSERT statements that have VALUES and end with );
# Replace the ); with ) ON CONFLICT (id) DO NOTHING;

# For multi-line inserts, replace the last ); with ) ON CONFLICT (id) DO NOTHING;
pattern = r'(INSERT INTO\s+\w+[^;]*VALUES[^;]*)\);'

def add_conflict_properly(match):
    statement = match.group(1)
    # Check if this is the alembic_version table (has RETURNING clause)
    if 'alembic_version' in statement or 'RETURNING' in statement:
        return f"{statement});"
    else:
        return f"{statement}) ON CONFLICT (id) DO NOTHING;"

new_content = re.sub(pattern, add_conflict_properly, content, flags=re.DOTALL)

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✓ Fixed ON CONFLICT clause placement")
