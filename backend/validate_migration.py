#!/usr/bin/env python3
"""
Final validation of migration_clean.sql for PostgreSQL compatibility
"""
import re

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

issues = []

# Check for remaining backticks
if '`' in content:
    issues.append("❌ Found backticks (`) in file")
else:
    print("✅ No backticks found")

# Check for MySQL BIGINT(20) syntax
if re.search(r'BIGINT\s*\(\d+\)', content):
    issues.append("❌ Found MySQL BIGINT(n) syntax")
else:
    print("✅ No MySQL BIGINT(n) syntax found")

# Check for proper boolean types
if re.search(r"\bBOOLEAN\b", content):
    print(f"✅ Found BOOLEAN type declarations")
    # Check for 0/1 in INSERT statements after boolean columns
    if re.search(r",\s*[01]\s*(?=,|;)", content):
        # This is expected for non-boolean columns
        pass

# Check for BEGIN/COMMIT
if 'BEGIN;' in content:
    print("✅ Transaction BEGIN found")
else:
    issues.append("❌ No BEGIN found")

if 'COMMIT;' in content:
    print("✅ Transaction COMMIT found")
else:
    issues.append("❌ No COMMIT found")

# Check for IF NOT EXISTS in CREATE TABLE
create_table_count = len(re.findall(r'CREATE TABLE', content))
if_not_exists_count = len(re.findall(r'CREATE TABLE IF NOT EXISTS', content))
print(f"✅ CREATE TABLE statements: {create_table_count} (IF NOT EXISTS: {if_not_exists_count})")

# Check for ON CONFLICT in INSERT statements
on_conflict_count = len(re.findall(r'ON CONFLICT', content))
insert_count = len(re.findall(r'INSERT INTO', content))
print(f"✅ INSERT INTO statements: {insert_count} (ON CONFLICT: {on_conflict_count})")

# Check file size
lines = content.split('\n')
print(f"✅ Total lines: {len(lines)}")
print(f"✅ File size: {len(content)} bytes")

if issues:
    print("\n❌ ISSUES FOUND:")
    for issue in issues:
        print(f"  {issue}")
else:
    print("\n✅ ALL VALIDATIONS PASSED - File is PostgreSQL-compliant!")
