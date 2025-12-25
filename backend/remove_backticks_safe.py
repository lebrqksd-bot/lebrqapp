#!/usr/bin/env python3
"""
Safely remove all backticks from migration_clean.sql
"""
import re

# Read the file
with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Count backticks before
backtick_count_before = content.count('`')
print(f"Backticks found before: {backtick_count_before}")

# Remove all backticks
content_clean = content.replace('`', '')

# Count backticks after (should be 0)
backtick_count_after = content_clean.count('`')
print(f"Backticks found after: {backtick_count_after}")

# Write the clean file
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content_clean)

print(f"Successfully removed {backtick_count_before} backticks from migration_clean.sql")
print(f"File size: {len(content_clean)} bytes")
