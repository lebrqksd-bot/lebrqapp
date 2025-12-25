#!/usr/bin/env python3

# Read migration.sql
with open('migration.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# First, replace all problematic Unicode apostrophes (U+2019) with double-quoted versions
content = content.replace('\u2019', "''")

# Now handle regular ASCII apostrophes that appear in string literals
# We need to escape them by doubling
# Strategy: process line by line and look for apostrophes inside quoted strings

lines = content.split('\n')
fixed_lines = []

for line in lines:
    # For lines with VALUES (INSERT statements), we need to escape apostrophes in strings
    if 'VALUES' in line or (fixed_lines and 'VALUES' in fixed_lines[-1]):
        # Process this line character by character
        result = []
        in_string = False
        i = 0
        
        while i < len(line):
            char = line[i]
            
            if char == "'":
                if in_string:
                    # We're inside a string
                    # Check if next char is also a quote (already escaped)
                    if i + 1 < len(line) and line[i + 1] == "'":
                        # Already a doubled quote, keep both
                        result.append("''")
                        i += 2
                    else:
                        # Single quote - check if this closes the string or is an apostrophe
                        # To be safe, double it (escape it)
                        result.append("''")
                        i += 1
                        in_string = False
                else:
                    # Starting a string
                    result.append("'")
                    in_string = True
                    i += 1
            else:
                result.append(char)
                i += 1
        
        fixed_lines.append(''.join(result))
    else:
        fixed_lines.append(line)

content = '\n'.join(fixed_lines)

# Remove backticks
content = content.replace('`', '')

# Fix BIGINT(20)
content = content.replace('BIGINT(20)', 'BIGINT')

# Write output
with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Comprehensive PostgreSQL fixes applied:")
print("  - ASCII apostrophes in strings escaped")
print("  - Unicode characters handled")
print("  - Backticks removed")
print("  - BIGINT(20) fixed")
