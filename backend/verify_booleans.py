#!/usr/bin/env python3
"""
Final verification - check if any integer 0/1 remain in boolean column positions
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Check for remaining patterns that would indicate unconverted booleans
# Pattern: ,0, or ,1, (surrounded by commas in VALUE sections)

# Find all INSERT statements
insert_blocks = re.findall(r'INSERT INTO (\w+)[^;]+;', content, re.DOTALL)

suspicious_patterns = []

# Look for remaining 0s and 1s in value positions that should be boolean
for table_name in insert_blocks:
    # Find the insert block
    pattern = rf'INSERT INTO {table_name}[^;]+;'
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        continue
    
    insert_block = match.group(0)
    
    # Count commas in column list to understand structure
    col_pattern = rf'INSERT INTO {table_name}\s*\(([^)]+)\)'
    col_match = re.search(col_pattern, insert_block)
    if not col_match:
        continue
    
    cols = [c.strip() for c in col_match.group(1).split(',')]
    
    # Find rows with 0 or 1 values
    rows = re.findall(r'\(([^()]*(?:\'[^\']*\'[^()]*)*)\)', insert_block)
    
    for row_text in rows:
        values = []
        in_quote = False
        current = ""
        
        for char in row_text:
            if char == "'" and (not current or current[-1] != '\\'):
                in_quote = not in_quote
                current += char
            elif char == ',' and not in_quote:
                values.append(current.strip())
                current = ""
            else:
                current += char
        if current.strip():
            values.append(current.strip())
        
        # Check for standalone 0 or 1 values (not part of numbers like 10, 123, etc.)
        for i, val in enumerate(values):
            val_stripped = val.strip()
            if val_stripped in ['0', '1']:
                # This could be an unconverted boolean
                if i < len(cols):
                    col_name = cols[i]
                    if any(bool_keyword in col_name.lower() for bool_keyword in ['is_', 'active', 'verified', 'approved', 'deleted', 'read', 'sent', '_enable']):
                        suspicious_patterns.append((table_name, col_name, val_stripped, row_text[:50]))

if suspicious_patterns:
    print(f"⚠ Found {len(suspicious_patterns)} potential unconverted boolean values:")
    for table, col, val, row_preview in suspicious_patterns[:20]:
        print(f"  {table}.{col} = {val} (row: {row_preview}...)")
else:
    print("✓ No suspicious 0/1 values found in boolean column positions")
