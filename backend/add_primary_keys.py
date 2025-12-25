#!/usr/bin/env python3
"""
Add PRIMARY KEY constraints to all tables that are missing them.
Handles tables with 'id' columns that should be primary keys.
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find CREATE TABLE statements
# We'll look for tables and add PRIMARY KEY to their id columns if not already there
pattern = r'(CREATE TABLE\s+(\w+)\s*\(\s*id\s+INTEGER\s+)NOT NULL([,\)])'

def replace_func(match):
    """Replace NOT NULL with PRIMARY KEY NOT NULL for id columns"""
    prefix = match.group(1)
    suffix = match.group(3)
    return f'{prefix}PRIMARY KEY NOT NULL{suffix}'

# Count matches before
matches_before = len(re.findall(pattern, content, re.IGNORECASE))
print(f"Found {matches_before} tables with id INTEGER NOT NULL (need PRIMARY KEY)")

# Apply replacement
content_new = re.sub(pattern, replace_func, content, flags=re.IGNORECASE)

# Verify changes
matches_after = len(re.findall(r'id\s+INTEGER\s+PRIMARY KEY\s+NOT NULL', content_new, re.IGNORECASE))
print(f"After fix: {matches_after} tables with PRIMARY KEY added")

# Write back
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content_new)

print("✓ Added PRIMARY KEY constraints to all tables")
