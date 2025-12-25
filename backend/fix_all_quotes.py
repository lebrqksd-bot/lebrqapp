#!/usr/bin/env python3

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# The simplest approach: Find all occurrences of ' that are NOT part of ''
# and replace them with ''

# Process character by character
output = []
i = 0

while i < len(content):
    if content[i] == "'":
        # Check if it's part of an already-escaped pair
        if i > 0 and content[i-1] == "'":
            # This is the second quote in '', skip it (already added)
            output.append("'")
            i += 1
        elif i + 1 < len(content) and content[i + 1] == "'":
            # This quote is followed by another - it's an escaped pair, keep as-is
            output.append("''")
            i += 2
        else:
            # Single quote that needs escaping
            output.append("''")
            i += 1
    else:
        output.append(content[i])
        i += 1

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(''.join(output))

print("Escaped all unescaped single quotes")
