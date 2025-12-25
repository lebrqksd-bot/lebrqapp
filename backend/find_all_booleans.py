#!/usr/bin/env python3
"""
Find ALL boolean columns in the migration file by parsing CREATE TABLE statements
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all CREATE TABLE statements
create_table_pattern = r'CREATE TABLE\s+(\w+)\s*\((.*?)\);'

all_boolean_cols = {}

for match in re.finditer(create_table_pattern, content, re.DOTALL):
    table_name = match.group(1)
    table_def = match.group(2)
    
    # Find all BOOLEAN columns
    lines = table_def.split('\n')
    col_index = 0
    
    for line in lines:
        # Check if this line has a column definition
        if 'BOOLEAN' in line.upper():
            # Extract column name
            col_match = re.match(r'\s*(\w+)\s+BOOLEAN', line, re.IGNORECASE)
            if col_match:
                col_name = col_match.group(1)
                all_boolean_cols.setdefault(table_name, []).append((col_index, col_name))
        
        # Count columns to track index
        if re.match(r'\s*\w+\s+', line) and not line.strip().startswith('CONSTRAINT'):
            col_index += 1

print("All boolean columns found:")
for table, cols in sorted(all_boolean_cols.items()):
    print(f"{table}: {cols}")
