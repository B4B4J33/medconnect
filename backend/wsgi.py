import os

print("Starting wsgi.py...")

from app import app
from app.db import init_db
init_db()

print("Flask app imported OK.")
print("PORT =", os.environ.get("PORT", "5000"))

if __name__ == "__main__":
    print("Running Flask dev server...")
    app.run(host="127.0.0.1", port=5000, debug=True)
