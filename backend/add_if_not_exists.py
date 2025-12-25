#!/usr/bin/env python3
"""
Add IF NOT EXISTS to all CREATE TABLE statements
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all CREATE TABLE with CREATE TABLE IF NOT EXISTS
# Pattern: CREATE TABLE (not already IF NOT EXISTS)
pattern = r'CREATE TABLE(?!\s+IF\s+NOT\s+EXISTS)\s+'
replacement = 'CREATE TABLE IF NOT EXISTS '

new_content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)

# Count changes
original_count = len(re.findall(r'CREATE TABLE\s+\w+', content, re.IGNORECASE))
new_count = len(re.findall(r'CREATE TABLE IF NOT EXISTS', new_content, re.IGNORECASE))

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"✓ Added IF NOT EXISTS to {new_count} CREATE TABLE statements")
