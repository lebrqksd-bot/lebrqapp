#!/usr/bin/env python3
"""
More aggressive approach: For bookings table, find all rows with integer 0 or 1
at positions 20 and 28 (the boolean columns) and convert them directly
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the INSERT INTO bookings section
# Pattern to find complete INSERT INTO bookings ... VALUES (...)...; block
bookings_insert_pattern = r'(INSERT INTO bookings[^;]+;)'
match = re.search(bookings_insert_pattern, content, re.DOTALL)

if match:
    insert_block = match.group(1)
    original_block = insert_block
    
    # Find all rows (patterns like (...), (...), (...) etc.)
    # More reliable: find patterns of (number, 'string', ... , number, ...) 
    
    # For each row, we want to convert patterns like:
    # ..., NULL, 0, NULL, ... to ..., NULL, false, NULL, ...
    # ..., NULL, 1, NULL, ... to ..., NULL, true, NULL, ...
    # where the 0/1 is at position 20 (is_admin_booking)
    
    # And ..., NULL, 0, NULL, ... to ..., NULL, false, NULL, ...
    # where the 0/1 is at position 28 (broker_settled)
    
    # Strategy: Use regex to match the specific patterns around those columns
    # Pattern for position 20 (is_admin_booking): NULL, 0, NULL, (or similar)
    # Pattern for position 28 (broker_settled): NULL, 0, NULL, (or similar)
    
    # More direct approach: Find all remaining 0s and 1s in the specific column positions
    
    rows = re.findall(r'\((\d+[^)]*)\)', insert_block)
    
    changed = 0
    for row_text in rows:
        # Split by comma, handling quoted strings
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
        
        # Only process if we have enough values
        if len(values) < 29:
            continue
        
        modified = False
        
        # Position 20: is_admin_booking
        if values[20].strip() == '0':
            values[20] = 'false'
            modified = True
            changed += 1
        elif values[20].strip() == '1':
            values[20] = 'true'
            modified = True
            changed += 1
        
        # Position 28: broker_settled
        if values[28].strip() == '0':
            values[28] = 'false'
            modified = True
            changed += 1
        elif values[28].strip() == '1':
            values[28] = 'true'
            modified = True
            changed += 1
        
        if modified:
            old_row = '(' + row_text + ')'
            new_row = '(' + ', '.join(values) + ')'
            content = content.replace(old_row, new_row, 1)
    
    print(f"✓ Fixed {changed} boolean values in bookings table")
else:
    print("⚠ Could not find bookings INSERT block")

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)
