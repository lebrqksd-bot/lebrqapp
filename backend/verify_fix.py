#!/usr/bin/env python3

with open('migration_clean.sql', 'rb') as f:
    content = f.read()

# Find the line with "Your booking"
search = b'Your booking BK-A627406D08 was created successfully. We'
idx = content.find(search)

if idx >= 0:
    # Print 100 bytes from this point
    segment = content[idx:idx+100]
    print(f"Raw bytes: {segment}")
    print(f"Hex: {segment.hex()}")
    print(f"Decoded: {segment.decode('utf-8')}")
else:
    print("Not found")

# Also check for the Unicode apostrophe
unicode_apos = chr(0x2019).encode('utf-8')
count = content.count(unicode_apos)
print(f"\nUnicode apostrophes in file: {count}")
