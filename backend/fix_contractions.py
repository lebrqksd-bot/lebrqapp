#!/usr/bin/env python3

# Read file
with open('migration_clean.sql', 'r') as f:
    lines = f.readlines()

# Process line by line
output = []
for line in lines:
    # In a SQL INSERT line with VALUES, escape single quotes in strings
    if 'VALUES' in line:
        # For apostrophes, we need to escape them as '' (two single quotes)
        # But we only want to do this in string literals
        # This is tricky - let's use a state machine
        
        result = ""
        i = 0
        while i < len(line):
            if line[i] == "'":
                # Start of a string literal
                result += "'"
                i += 1
                # Read the string content and escape any unescaped quotes
                while i < len(line):
                    if line[i] == "'":
                        # Check if it's already escaped (preceded by another quote)
                        if result.endswith("''"):
                            # Already escaped
                            result += "'"
                            i += 1
                        elif i + 1 < len(line) and line[i + 1] == "'":
                            # This quote is followed by another - it's escaped
                            result += "''"
                            i += 2
                        else:
                            # This is the closing quote
                            result += "'"
                            i += 1
                            break
                    else:
                        # Check if this is an apostrophe that needs escaping
                        if line[i:i+2] in ["'s", "'t", "'m", "'r", "'v", "'d", "'l", "'n"]:
                            # This looks like an apostrophe in a contraction
                            result += "''"  # Double the quote
                            i += 1
                        else:
                            result += line[i]
                            i += 1
            else:
                result += line[i]
                i += 1
        
        line = result
        
    output.append(line)

# Write back
with open('migration_clean.sql', 'w') as f:
    f.writelines(output)

print("Fixed contractions with escaped quotes")
