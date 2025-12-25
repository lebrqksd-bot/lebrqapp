#!/usr/bin/env python3
"""
Reorganize migration_clean.sql to have all CREATE TABLE first, then ALTER TABLE, then INSERT, then UPDATE
"""

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

create_tables = []
alter_tables = []
inserts = []
updates = []
other = []

i = 0
while i < len(lines):
    line = lines[i]
    
    if line.strip().startswith('CREATE TABLE'):
        # Collect entire CREATE TABLE block
        create_block = [line]
        i += 1
        while i < len(lines) and not lines[i].strip().startswith('CREATE TABLE') and not lines[i].strip().startswith('ALTER TABLE') and not lines[i].strip().startswith('INSERT') and not lines[i].strip().startswith('UPDATE'):
            create_block.append(lines[i])
            if lines[i].strip().endswith(');'):
                i += 1
                break
            i += 1
        create_tables.extend(create_block)
    elif line.strip().startswith('ALTER TABLE'):
        # Collect entire ALTER TABLE block
        alter_block = [line]
        i += 1
        while i < len(lines) and not lines[i].strip().startswith('CREATE TABLE') and not lines[i].strip().startswith('ALTER TABLE') and not lines[i].strip().startswith('INSERT') and not lines[i].strip().startswith('UPDATE'):
            alter_block.append(lines[i])
            if lines[i].strip().endswith(';'):
                i += 1
                break
            i += 1
        alter_tables.extend(alter_block)
    elif line.strip().startswith('INSERT INTO'):
        # Collect entire INSERT block
        insert_block = [line]
        i += 1
        while i < len(lines) and not lines[i].strip().startswith('CREATE TABLE') and not lines[i].strip().startswith('ALTER TABLE') and not lines[i].strip().startswith('INSERT INTO') and not lines[i].strip().startswith('UPDATE'):
            insert_block.append(lines[i])
            if lines[i].strip().endswith(';'):
                i += 1
                break
            i += 1
        inserts.extend(insert_block)
    elif line.strip().startswith('UPDATE'):
        # Collect entire UPDATE block
        update_block = [line]
        i += 1
        while i < len(lines) and not lines[i].strip().startswith('CREATE TABLE') and not lines[i].strip().startswith('ALTER TABLE') and not lines[i].strip().startswith('INSERT') and not lines[i].strip().startswith('UPDATE'):
            update_block.append(lines[i])
            if lines[i].strip().endswith(';'):
                i += 1
                break
            i += 1
        updates.extend(update_block)
    else:
        other.append(line)
        i += 1

# Reorganize: BEGIN, CREATE TABLE, ALTER TABLE, INSERT, UPDATE, COMMIT
organized = []
organized.extend([l for l in other if l.strip().startswith('BEGIN')])
organized.extend(create_tables)
organized.extend(alter_tables)
organized.extend(inserts)
organized.extend(updates)
organized.extend([l for l in other if l.strip().startswith('COMMIT')])

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.writelines(organized)

print(f"✓ Reorganized migration file")
print(f"  CREATE TABLE statements: {len([l for l in create_tables if l.strip().startswith('CREATE')])}")
print(f"  ALTER TABLE statements: {len([l for l in alter_tables if l.strip().startswith('ALTER')])}")
print(f"  INSERT statements: {len([l for l in inserts if l.strip().startswith('INSERT')])}")
print(f"  UPDATE statements: {len([l for l in updates if l.strip().startswith('UPDATE')])}")
