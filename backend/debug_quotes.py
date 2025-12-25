#!/usr/bin/env python3

# Check what's actually in the file at line 1363
with open('migration_clean.sql', 'rb') as f:
    lines = f.readlines()

# Line 1363 (index 1362)
if len(lines) > 1362:
    line = lines[1362]
    
    # Find "We" in the line
    idx = line.find(b'We')
    if idx >= 0:
        # Get 20 bytes from there
        segment = line[idx:idx+20]
        print(f"Hex bytes: {segment.hex()}")
        print(f"Decoded: {segment.decode('utf-8', errors='replace')}")
        
        # Check for Unicode apostrophe (U+2019 = e2 80 99 in UTF-8)
        if b'\xe2\x80\x99' in segment:
            print("\n⚠ WARNING: Unicode apostrophe (U+2019) found - NOT properly escaped!")
        # Check for double quotes ('' = 27 27 in hex)
        elif b"''" in segment:
            print("\n✓ Double quotes found - properly escaped!")
        else:
            print(f"\nOther quote style found")
else:
    print("Line not found")
