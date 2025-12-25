#!/usr/bin/env python3
"""
Add ON CONFLICT (id) DO NOTHING properly to all INSERT statements
Excluding alembic_version which doesn't have an id column that can be used for conflict detection
"""

import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Check if this is an INSERT statement
    if line.strip().startswith('INSERT INTO'):
        # Skip alembic_version inserts
        if 'alembic_version' in line:
            output_lines.append(line)
            i += 1
            continue
        
        # For other INSERT statements, collect them until we find the closing );
        insert_block = [line]
        i += 1
        
        # Collect all lines until we find the statement terminator );
        while i < len(lines):
            insert_block.append(lines[i])
            if lines[i].strip().endswith(');'):
                # Found the end, now we need to modify it
                # Replace ); with ) ON CONFLICT (id) DO NOTHING;
                last_line = insert_block[-1]
                if last_line.strip().endswith(');'):
                    # Remove the ); from the end and add ON CONFLICT
                    insert_block[-1] = last_line.rstrip()[:-1] + ' ON CONFLICT (id) DO NOTHING;\n'
                i += 1
                break
            i += 1
        
        output_lines.extend(insert_block)
    else:
        output_lines.append(line)
        i += 1

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print("✓ Added ON CONFLICT (id) DO NOTHING to INSERT statements")
