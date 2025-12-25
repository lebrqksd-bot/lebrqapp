#!/usr/bin/env python3

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and process each INSERT statement
def fix_insert(match):
    insert_block = match.group(0)
    # Split on VALUES
    if ' VALUES' not in insert_block:
        return insert_block
    
    parts = insert_block.split(' VALUES', 1)
    prefix = parts[0]
    values_part = parts[1]
    
    # Now fix the VALUES part
    # We'll iterate through and properly handle quotes
    fixed_values = ""
    i = 0
    while i < len(values_part):
        c = values_part[i]
        
        if c == "'":
            fixed_values += c
            i += 1
            
            # Now we're inside a quoted string
            # Read until we find the closing quote
            while i < len(values_part):
                c = values_part[i]
                if c == "'":
                    # Check if next char is also a quote
                    if i + 1 < len(values_part) and values_part[i + 1] == "'":
                        # Already escaped - copy both
                        fixed_values += c + values_part[i + 1]
                        i += 2
                    else:
                        # Closing quote
                        fixed_values += c
                        i += 1
                        break
                else:
                    fixed_values += c
                    i += 1
        else:
            fixed_values += c
            i += 1
    
    return prefix + ' VALUES' + fixed_values

# Find all INSERT statements - simpler regex that just gets VALUES sections
lines = content.split('\n')
result_lines = []

i = 0
while i < len(lines):
    line = lines[i]
    
    if 'INSERT INTO' in line and 'VALUES' in line:
        # Collect full INSERT statement
        insert_stmt = [line]
        i += 1
        while i < len(lines) and not lines[i].rstrip().endswith(';'):
            insert_stmt.append(lines[i])
            i += 1
        if i < len(lines):
            insert_stmt.append(lines[i])
            i += 1
        
        full_insert = '\n'.join(insert_stmt)
        fixed = fix_insert(type('obj', (object,), {'group': lambda self, x: full_insert})())
        result_lines.extend(fixed.split('\n'))
    else:
        result_lines.append(line)
        i += 1

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(result_lines))

print("Successfully fixed single quotes in all INSERT statements")
