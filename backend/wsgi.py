import os
from app import app

try:
    from app.db import init_db
    init_db()
except Exception as e:
    print(str(e))

print("PORT =", os.environ.get("PORT", "5000"))
