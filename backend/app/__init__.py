from flask import Flask

# Basic Flask app (expand later with DB, blueprints, etc.)
app = Flask(__name__)

@app.route("/api/health")
def health():
    return {"status": "ok"}
