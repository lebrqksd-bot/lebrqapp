#!/usr/bin/env python3

with open('migration_clean.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Unicode right single quotation marks with SQL-escaped ASCII quotes
# U+2019 (') should be replaced with '' (two single quotes)

# First, replace all RIGHT SINGLE QUOTATION MARK (U+2019) with double ASCII quotes
content = content.replace('\u2019', "''")

# Also handle other common Unicode quotes
content = content.replace('\u2018', "'")  # LEFT SINGLE QUOTATION MARK
content = content.replace(''', "''")  # U+2019 again (using the actual character)
content = content.replace(''', "'")   # U+2018 again

# Now handle any remaining ASCII single quotes that are unescaped
output = []
i = 0

while i < len(content):
    if content[i] == "'":
        # Check if it's part of a pair
        if i + 1 < len(content) and content[i + 1] == "'":
            # Already escaped pair
            output.append("''")
            i += 2
        else:
            # Single quote - in SQL string literals this should only appear in pairs or as string delimiters
            # For now, treat all single quotes as needing to be doubled
            output.append("''")
            i += 1
    else:
        output.append(content[i])
        i += 1

with open('migration_clean.sql', 'w', encoding='utf-8') as f:
    f.write(''.join(output))

print("Fixed all Unicode and ASCII single quotes")
