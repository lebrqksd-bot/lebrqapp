#!/usr/bin/env python3
"""
Check for any remaining type mismatches in the migration file
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Patterns to check
issues = []

for i, line in enumerate(lines, 1):
    # Check for INTEGER columns with non-numeric defaults
    if re.search(r'INTEGER.*DEFAULT\s+(?!CURRENT_|NULL|[0-9])', line, re.IGNORECASE):
        if 'CURRENT_TIMESTAMP' not in line and 'NULL' not in line:
            issues.append((i, line.strip()))
    
    # Check for remaining integer defaults for boolean (0, 1)
    if re.search(r'BOOLEAN.*DEFAULT\s+[01](?!\d)', line):
        issues.append((i, line.strip()))

if issues:
    print("⚠ Potential type issues found:")
    for line_num, line_content in issues[:10]:
        print(f"  Line {line_num}: {line_content}")
else:
    print("✓ No obvious type mismatches found")
