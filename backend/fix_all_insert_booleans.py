#!/usr/bin/env python3
"""
Find and convert ALL remaining integer 0/1 values to boolean false/true in INSERT statements
This is a more aggressive approach - we'll convert all 0s and 1s in VALUES sections
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# First, let's identify which columns are boolean by examining CREATE TABLE statements
# Pattern: tablename: [col1, col2, ...]
boolean_cols = {}

# Find all CREATE TABLE statements and extract boolean columns
create_table_pattern = r'CREATE TABLE\s+(\w+)\s*\([^)]+\)'
for match in re.finditer(create_table_pattern, content, re.DOTALL):
    table_name = match.group(1)
    table_def = match.group(0)
    
    # Find all boolean columns in this table
    bool_pattern = r'(\w+)\s+BOOLEAN'
    bool_matches = re.findall(bool_pattern, table_def, re.IGNORECASE)
    if bool_matches:
        boolean_cols[table_name] = bool_matches

print(f"Found {len(boolean_cols)} tables with boolean columns:")
for table, cols in sorted(boolean_cols.items()):
    print(f"  {table}: {cols}")

# Now find all INSERT statements and convert 0/1 to false/true for boolean columns
insert_pattern = r'INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES'

replacements = []

for match in re.finditer(insert_pattern, content, re.IGNORECASE):
    table_name = match.group(1)
    col_list = match.group(2)
    
    if table_name not in boolean_cols:
        continue
    
    # Parse column names
    columns = [col.strip() for col in col_list.split(',')]
    
    # Find indices of boolean columns
    bool_indices = []
    for bool_col in boolean_cols[table_name]:
        if bool_col in columns:
            bool_indices.append(columns.index(bool_col))
    
    if not bool_indices:
        continue
    
    # Find the VALUES section for this INSERT
    values_start = match.end()
    semi_pos = content.find(';', values_start)
    
    values_section = content[values_start:semi_pos]
    
    # Process each row - split by ), ( to identify separate rows
    # Then within each row, replace the 0/1 at the boolean column indices
    
    # This is complex because we need to track quoted strings
    # Use a more targeted approach: find VALUE literals at specific positions
    
    # Extract all the actual value tuples
    rows = re.findall(r'\(([^)]+)\)', values_section)
    
    for row_text in rows:
        # Split values considering quoted strings
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
        
        # Check if any boolean columns have integer values
        for idx in bool_indices:
            if idx < len(values):
                val = values[idx].strip()
                if val == '0':
                    old_row = '(' + row_text + ')'
                    # Replace the specific value
                    values[idx] = 'false'
                    new_row = '(' + ', '.join(values) + ')'
                    
                    # Find and replace this specific row in the content
                    if old_row in content:
                        replacements.append((old_row, new_row))
                        break  # Only replace once per row
                elif val == '1':
                    old_row = '(' + row_text + ')'
                    # Replace the specific value
                    values[idx] = 'true'
                    new_row = '(' + ', '.join(values) + ')'
                    
                    # Find and replace this specific row in the content
                    if old_row in content:
                        replacements.append((old_row, new_row))
                        break  # Only replace once per row

print(f"\nFound {len(replacements)} rows to fix")

# Apply replacements
for old, new in replacements:
    content = content.replace(old, new, 1)

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Converted all remaining integer boolean values to false/true")
