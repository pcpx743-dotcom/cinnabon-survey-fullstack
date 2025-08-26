import os
import json
from datetime import datetime, timezone
from flask import Flask, request, jsonify, Response, send_from_directory, redirect
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON as SA_JSON
from sqlalchemy.orm import sessionmaker, declarative_base
import requests


# envlar (fayl boshidagi Config bo'limiga qo'shing)
TELEGRAM_BOT_TOKEN = "8455780573:AAE9ocfjP9aQwSqT95_K9N_uiHYTqW-Cdqc"
TELEGRAM_CHAT_ID = "-4973096088"   # masalan: -100123456789 yoki @kanal_nomi
SAVE_TO_DB = os.getenv("SAVE_TO_DB", "false").lower() == "true"  # hozir DB shart emas

# ==== Config ====

def send_to_telegram(payload: dict):
    """Javoblarni Telegram guruh/kanalga jo'natadi."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return False, "TG env yo'q"

    # xabarni chiroyli formatlaymiz
    lines = []
    title_map = {
        "A1":"Kim uchun", "A2":"Holat",
        "C6":"Shirinlik (1–5)", "C7":"Dolchin (1–5)", "C8":"Yumshoqlik (1–5)",
        "C9":"O'lcham", "C10":"Berilish",
        "D11":"Ta'mlar", "D12":"Alohida karamel?",
        "G20":"Arzon deb hisoblaysiz (so'm)", "G22":"Haddan qimmat (so'm)",
        "H25":"Qayta buyurtma (0–10)", "I27":"Set tanlovi",
    }
    for k, v in payload.items():
        if k == "meta":
            continue
        if isinstance(v, list):
            v = ", ".join(map(str, v))
        lines.append(f"<b>{title_map.get(k, k)}:</b> {v}")
    meta = payload.get("meta", {}) or {}
    lines.append(f"\n<code>{meta.get('lang','')}</code> | <code>{meta.get('ua','')}</code>")
    text = "🌀 <b>Cinnabon so'rov</b>\n" + "\n".join(lines)

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    r = requests.post(url, json={
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }, timeout=10)
    ok = r.ok
    return ok, (r.text if not ok else "ok")

def _normalize_db_url(url: str) -> str:
    return url.replace("postgres://", "postgresql://", 1) if url and url.startswith("postgres://") else url

DATABASE_URL = _normalize_db_url(os.getenv("DATABASE_URL", ""))
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "change-me")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

# IMPORTANT: static papka — bu yerga React build ko'chiriladi
app = Flask(__name__, static_folder="static", static_url_path="")
origins = [o.strip() for o in CORS_ORIGINS.split(",")] if CORS_ORIGINS != "*" else "*"
CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=False)

# ==== DB ====
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./data.db"

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

def require_admin(req: request) -> bool:
    token = req.headers.get("X-Admin-Token") or req.args.get("token")
    return token == ADMIN_TOKEN


@app.get("/api/test-telegram")
def test_tg():
    ok, detail = send_to_telegram({"test":"ok", "meta":{"lang":"uz","ua":"health-check"}})
    return jsonify({"ok": ok, "detail": detail})

# mavjud create_response() ni shu tarzda yangilang:
@app.post("/api/v1/responses")
def create_response():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict) or len(payload) == 0:
        return jsonify({"ok": False, "error": "Invalid JSON"}), 400

    meta = payload.get("meta", {}) or {}
    if "ua" not in meta:
        meta["ua"] = request.headers.get("User-Agent", "")
    payload["meta"] = meta

    # 1) Telegramga yuboramiz
    sent, detail = send_to_telegram(payload)

    # 2) DB ixtiyoriy (SAVE_TO_DB=true bo'lsa saqlanadi)
    sr_id = None
    if SAVE_TO_DB:
        sr = SurveyResponse(data={k:v for k,v in payload.items() if k != "meta"},
                            ua=meta.get("ua"), lang=meta.get("lang"))
        with SessionLocal() as s:
            s.add(sr); s.commit(); s.refresh(sr)
            sr_id = sr.id

    return jsonify({
        "ok": True,
        "telegram_sent": sent,
        "id": sr_id,
        "detail": None if sent else detail
    })

# ==== API ====
@app.get("/api/health")
def health():
    return jsonify({"ok": True, "db": True})

@app.post("/api/v1/responses")
def create_response():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict) or len(payload) == 0:
        return jsonify({"ok": False, "error": "Invalid JSON"}), 400
    meta = payload.pop("meta", {}) or {}
    ua = meta.get("ua") or request.headers.get("User-Agent")
    lang = meta.get("lang")
    sr = SurveyResponse(data=payload, ua=ua, lang=lang)
    with SessionLocal() as s:
        s.add(sr)
        s.commit()
        s.refresh(sr)
        return jsonify({"ok": True, "id": sr.id, "created_at": sr.created_at.isoformat()})

@app.get("/api/v1/responses")
def list_responses():
    if not require_admin(request):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    limit = int(request.args.get("limit", 200))
    offset = int(request.args.get("offset", 0))
    with SessionLocal() as s:
        q = s.query(SurveyResponse).order_by(SurveyResponse.id.desc())
        total = q.count()
        rows = q.offset(offset).limit(limit).all()
        data = [{"id": r.id, "created_at": r.created_at.isoformat() if r.created_at else None,
                 "ua": r.ua, "lang": r.lang, "answers": r.data} for r in rows]
        return jsonify({"ok": True, "total": total, "items": data})

@app.get("/api/v1/responses.csv")
def export_csv():
    if not require_admin(request):
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    def generate():
        with SessionLocal() as s:
            q = s.query(SurveyResponse).order_by(SurveyResponse.id.asc())
            rows = q.all()
            keys = set()
            for r in rows:
                if isinstance(r.data, dict):
                    keys.update(r.data.keys())
            ordered = ["timestamp","id","ua","lang"] + sorted(keys)
            yield ",".join(ordered) + "\n"
            for r in rows:
                row = []
                row.append(r.created_at.isoformat() if r.created_at else "")
                row.append(str(r.id))
                row.append((r.ua or "").replace('"','""'))
                row.append((r.lang or ""))
                for k in sorted(keys):
                    v = r.data.get(k)
                    if isinstance(v, list): v = "|".join(map(str, v))
                    if v is None: v = ""
                    v = str(v)
                    if any(c in v for c in [",", "\n", '"']):
                        v = '"' + v.replace('"','""') + '"'
                    row.append(v)
                yield ",".join(row) + "\n"
    return Response(generate(), mimetype="text/csv")

# ==== FRONTEND (SPA) ====
def _index_or_message():
    index_path = os.path.join(app.static_folder, "index.html")
    if os.path.exists(index_path):
        return send_from_directory(app.static_folder, "index.html")
    return ("Frontend build topilmadi. Build komandasi static fayllarni "
            "`backend/static/` ga nusxalashi kerak.", 501)

@app.get("/")
def root():
    return _index_or_message()

# SPA fallback: /admin va boshqa yo‘llar — index.html
@app.get("/admin")
@app.get("/<path:path>")
def spa_fallback(path=None):
    # static fayl mavjud bo‘lsa — to‘g‘ridan beramiz
    if path:
        candidate = os.path.join(app.static_folder, path)
        if os.path.exists(candidate) and os.path.isfile(candidate):
            return send_from_directory(app.static_folder, path)
    return _index_or_message()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
