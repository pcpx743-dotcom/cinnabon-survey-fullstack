import os, requests
from datetime import datetime, timezone
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
SAVE_TO_DB = os.getenv("SAVE_TO_DB", "false").lower() == "true"

# SPA: React build shu papkada bo'ladi
app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- (ixtiyoriy) faqat SAVE_TO_DB=true bo'lsa SQLAlchemy ni ulaymiz ---
if SAVE_TO_DB:
    from sqlalchemy import create_engine, Column, Integer, DateTime, Text
    from sqlalchemy.orm import sessionmaker, declarative_base
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.types import JSON as SA_JSON

    def _normalize_db_url(url: str) -> str:
        return url.replace("postgres://", "postgresql://", 1) if url and url.startswith("postgres://") else url
    DATABASE_URL = _normalize_db_url(os.getenv("DATABASE_URL", "sqlite:///./data.db"))

    engine = create_engine(DATABASE_URL, future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base = declarative_base()

    class SurveyResponse(Base):
        __tablename__ = "survey_responses"
        id = Column(Integer, primary_key=True, autoincrement=True)
        created_at = Column(DateTime, default=datetime.now(timezone.utc))
        data = Column(JSONB().with_variant(SA_JSON, "sqlite"), nullable=False)
        ua = Column(Text, nullable=True)
        lang = Column(Text, nullable=True)

    Base.metadata.create_all(engine)

def send_to_telegram(payload: dict):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return False, "TELEGRAM_BOT_TOKEN/CHAT_ID yo‘q"
    title_map = {
        "A1":"Kim uchun","A2":"Holat","C6":"Shirinlik (1–5)","C7":"Dolchin (1–5)",
        "C8":"Yumshoqlik (1–5)","C9":"O‘lcham","C10":"Berilish",
        "D11":"Ta'mlar","D12":"Alohida karamel?","G20":"Arzon (so‘m)","G22":"Qimmat (so‘m)",
        "H25":"Qayta buyurtma (0–10)","I27":"Set"
    }
    lines=[]
    for k,v in payload.items():
        if k=="meta": continue
        if isinstance(v, list): v=", ".join(map(str,v))
        lines.append(f"<b>{title_map.get(k,k)}:</b> {v}")
    meta = payload.get("meta",{}) or {}
    lines.append(f"\n<code>{meta.get('lang','')}</code> | <code>{meta.get('ua','')}</code>")
    text = "🌀 <b>Cinnabon so'rov</b>\n" + "\n".join(lines)
    r = requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                      json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode":"HTML",
                            "disable_web_page_preview": True}, timeout=10)
    return r.ok, (None if r.ok else r.text)

@app.get("/api/health")
def health():
    return jsonify({"ok": True})

@app.post("/api/v1/responses")
def create_response():
    payload = request.get_json(silent=True) or {}
    meta = payload.get("meta", {}) or {}
    if "ua" not in meta:
        meta["ua"] = request.headers.get("User-Agent","")
    payload["meta"] = meta

    sent, detail = send_to_telegram(payload)

    if SAVE_TO_DB:
        # saqlash ixtiyoriy; hozir talab qilinmayapti
        with SessionLocal() as s:
            sr = SurveyResponse(data={k:v for k,v in payload.items() if k!="meta"},
                                ua=meta.get("ua"), lang=meta.get("lang"))
            s.add(sr); s.commit()

    return jsonify({"ok": True, "telegram_sent": sent, "detail": detail})

# ---- SPA servis ----
def _index_or_msg():
    index = os.path.join(app.static_folder, "index.html")
    if os.path.exists(index):
        return send_from_directory(app.static_folder, "index.html")
    return ("Frontend build topilmadi", 501)

@app.get("/")
def root(): return _index_or_msg()

@app.get("/admin")
@app.get("/<path:path>")
def spa_fallback(path=None):
    if path:
        candidate = os.path.join(app.static_folder, path)
        if os.path.isfile(candidate):
            return send_from_directory(app.static_folder, path)
    return _index_or_msg()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT","8000")))
