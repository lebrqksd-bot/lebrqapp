#!/usr/bin/env python3
"""
Fix boolean columns with integer defaults in migration_clean.sql
Convert 0 to false, 1 to true for BOOLEAN column defaults
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace BOOLEAN DEFAULT 0 with BOOLEAN DEFAULT false
content = re.sub(r'BOOLEAN\s+(?:NOT\s+NULL\s+)?DEFAULT\s+0', lambda m: m.group(0).replace(' 0', ' false'), content)

# Replace BOOLEAN DEFAULT 1 with BOOLEAN DEFAULT true
content = re.sub(r'BOOLEAN\s+(?:NOT\s+NULL\s+)?DEFAULT\s+1', lambda m: m.group(0).replace(' 1', ' true'), content)

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

# Verify changes
with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    verify_content = f.read()

# Count fixed instances
false_count = len(re.findall(r'BOOLEAN.*DEFAULT\s+false', verify_content))
true_count = len(re.findall(r'BOOLEAN.*DEFAULT\s+true', verify_content))
bad_count = len(re.findall(r'BOOLEAN.*DEFAULT\s+[01]', verify_content))

print(f"✓ Fixed boolean default values")
print(f"  BOOLEAN DEFAULT false: {false_count}")
print(f"  BOOLEAN DEFAULT true: {true_count}")
print(f"  Remaining invalid (0/1): {bad_count}")
