"""Quick backend startup diagnostic"""
import sys
import traceback

print("=" * 60)
print("🔍 Backend Startup Diagnostic")
print("=" * 60)

try:
    print("\n1. Testing imports...")
    from app.core import app
    print("   ✓ App imported successfully")
    
    print("\n2. Testing database connection...")
    from app.db import get_db
    db = next(get_db())
    print("   ✓ Database connected")
    db.close()
    
    print("\n3. Starting uvicorn...")
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    
except Exception as e:
    print(f"\n✗ ERROR: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
    sys.exit(1)

