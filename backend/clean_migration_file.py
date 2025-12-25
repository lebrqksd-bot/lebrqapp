#!/usr/bin/env python3
"""
Remove all non-SQL lines from migration_clean.sql
"""

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    lines = f.readlines()

clean_lines = []
for line in lines:
    stripped = line.strip()
    
    # Skip PowerShell output
    if stripped.startswith('+ '):
        continue
    if stripped.startswith('CategoryInfo'):
        continue
    if stripped.startswith('FullyQualifiedErrorId'):
        continue
    if stripped.startswith('RemoteException'):
        continue
    
    # Skip alembic INFO messages
    if stripped.startswith('INFO  [alembic'):
        continue
    if stripped.startswith('At line:'):
        continue
    
    # Skip alembic : INFO lines
    if stripped.startswith('alembic : INFO'):
        continue
    
    # Skip PostgresqlImpl and related error output
    if stripped.startswith('PostgresqlImpl'):
        continue
    
    # Keep everything else including blank lines and SQL
    clean_lines.append(line)

# Remove leading blank lines
while clean_lines and clean_lines[0].strip() == '':
    clean_lines.pop(0)

# Remove trailing blank lines
while clean_lines and clean_lines[-1].strip() == '':
    clean_lines.pop()

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.writelines(clean_lines)

print(f"✅ Cleaned migration_clean.sql")
print(f"   Total lines: {len(clean_lines)}")
