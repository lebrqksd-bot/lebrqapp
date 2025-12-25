#!/usr/bin/env python3
"""
Use regex to find all 0s and 1s that appear in the correct positions for boolean columns
in INSERT statements, and convert them to false/true
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all bookings INSERT blocks and the specific boolean column positions
# The bookings table has is_admin_booking at position 21 and broker_settled at position 29

# Pattern: find any (, ..., N, ..., M, ...) where N and M are 0 or 1 values
# that match the positions of boolean columns

# More direct approach: find the entire INSERT INTO bookings section and process each row

# Find all INSERT INTO bookings blocks
bookings_pattern = r'(INSERT INTO bookings[^;]+;)'
bookings_inserts = re.findall(bookings_pattern, content, re.DOTALL)

for insert_block in bookings_inserts:
    # Extract all value rows
    rows_pattern = r'\(([^)]*?(?:[\'"][^"\']*[\'"][^)]*)*[^)]*?)\)'
    rows = re.findall(r'\(\s*(\d+[^)]+)\)', insert_block)
    
    # For each row, we need to find the values at positions 20 and 28 (0-indexed)
    for row_text in rows:
        # Split by comma, but respect quoted strings
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
        
        # Check positions 20 and 28 for boolean columns
        modified = False
        if len(values) > 20:
            if values[20].strip() == '0':
                values[20] = 'false'
                modified = True
            elif values[20].strip() == '1':
                values[20] = 'true'
                modified = True
        
        if len(values) > 28:
            if values[28].strip() == '0':
                values[28] = 'false'
                modified = True
            elif values[28].strip() == '1':
                values[28] = 'true'
                modified = True
        
        if modified:
            old_row = '(' + row_text + ')'
            new_row = '(' + ', '.join(values) + ')'
            content = content.replace(old_row, new_row, 1)

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Fixed boolean columns in bookings INSERT statements")
