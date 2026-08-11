"""
Бот + сервер для мини-приложения «Зачётная книжка».
Один файл делает всё:
  • отдаёт страницу приложения (index.html) по адресу /
  • ловит нажатия из приложения (POST /event) и присылает ученику
    урок или ДЗ в личный чат от имени бота
  • обслуживает ИИ-помощника владельца (POST /ai)
  • по /start ставит кнопку, открывающую приложение

Запуск:
  1) pip install fastapi uvicorn httpx
  2) впиши свои токены ниже (BOT_TOKEN, WEBAPP_URL, ANTHROPIC_API_KEY, OWNER_ID)
  3) python bot.py
Подробности — в README.md.
"""

import hmac, hashlib, json, urllib.parse, asyncio, os
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import uvicorn

# ─── НАСТРОЙКИ (заполни своими значениями) ──────────────────────────────────
BOT_TOKEN = os.getenv("BOT_TOKEN", "ВСТАВЬ_ТОКЕН_ОТ_BOTFATHER")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://твой-сайт.example")   # где лежит index.html
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")             # для ИИ-помощника (необязательно)
OWNER_ID = int(os.getenv("OWNER_ID", "0"))  # твой Telegram user_id — только тебе доступен ИИ

TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Здесь копится статистика. Для реального проекта замени на базу данных (SQLite/Postgres).
progress = {}  # { user_id: {"viewed": set(), "done": set(), "name": str} }

# Конфигурация курса, которую владелец публикует из приложения. Хранится в файле,
# поэтому переживает перезапуск сервера. Ученики получают ровно её — готовый вариант.
CONFIG_FILE = "config.json"


def load_config():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None  # ещё не опубликовано — приложение покажет встроенный курс


def save_config(cfg: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


course_config = load_config()


# ─── ПРОВЕРКА ПОДЛИННОСТИ (что запрос реально из Telegram) ──────────────────
def verify_init_data(init_data: str) -> dict | None:
    """Проверяет подпись initData по алгоритму Telegram. Возвращает данные юзера или None."""
    try:
        parsed = dict(urllib.parse.parse_qsl(init_data))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calc_hash = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
        if calc_hash != received_hash:
            return None
        return json.loads(parsed.get("user", "{}"))
    except Exception:
        return None


async def send_message(chat_id: int, text: str, buttons: list | None = None):
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if buttons:
        payload["reply_markup"] = {"inline_keyboard": buttons}
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(f"{TG_API}/sendMessage", json=payload)


# ─── СТРАНИЦА ПРИЛОЖЕНИЯ ────────────────────────────────────────────────────
@app.get("/")
async def index():
    return FileResponse("index.html")


# ─── ЗАГРУЗКА КУРСА И ПРАВ ДОСТУПА ──────────────────────────────────────────
@app.post("/init")
async def init(request: Request):
    """Приложение спрашивает при открытии: кто я и какой курс показать."""
    data = await request.json()
    user = verify_init_data(data.get("initData", ""))
    is_owner = bool(user and OWNER_ID and user["id"] == OWNER_ID)
    return JSONResponse({"is_owner": is_owner, "config": course_config})


@app.get("/config")
async def get_config():
    """Готовый опубликованный курс для ученика (читать может кто угодно)."""
    return JSONResponse({"config": course_config})


@app.post("/config")
async def set_config(request: Request):
    """Публикация курса. Разрешено только владельцу."""
    global course_config
    data = await request.json()
    user = verify_init_data(data.get("initData", ""))
    if not user or not OWNER_ID or user["id"] != OWNER_ID:
        return JSONResponse({"ok": False, "error": "нет прав"}, status_code=403)
    cfg = data.get("config")
    if not isinstance(cfg, dict):
        return JSONResponse({"ok": False, "error": "плохой формат"}, status_code=400)
    course_config = cfg
    save_config(cfg)
    return JSONResponse({"ok": True})


# ─── НАЖАТИЯ ИЗ ПРИЛОЖЕНИЯ: урок / ДЗ → в личный чат ученику ────────────────
@app.post("/event")
async def event(request: Request):
    data = await request.json()
    user = verify_init_data(data.get("initData", ""))
    if not user:
        return JSONResponse({"ok": False, "error": "bad initData"}, status_code=403)

    uid = user["id"]
    name = user.get("first_name", "Ученик")
    rec = progress.setdefault(uid, {"viewed": set(), "done": set(), "name": name})
    action = data.get("action")
    idx = data.get("index")

    if action == "lesson":
        rec["viewed"].add(data.get("lessonId"))
        title = data.get("title", "")
        desc = data.get("desc", "")
        link = data.get("link", "")
        text = f"🎬 <b>Урок {idx}. {title}</b>\n\n{desc}"
        buttons = [[{"text": "▶ Смотреть урок", "url": link}]] if link else None
        await send_message(uid, text, buttons)

    elif action == "homework":
        title = data.get("title", "")
        hw = data.get("hw", "")
        text = (f"📝 <b>Домашнее задание к уроку {idx}</b>\n«{title}»\n\n"
                f"{hw}\n\nВыполни и пришли результат сюда в ответном сообщении.")
        await send_message(uid, text)

    return JSONResponse({"ok": True})


# ─── ИИ-ПОМОЩНИК ВЛАДЕЛЬЦА ──────────────────────────────────────────────────
@app.post("/ai")
async def ai(request: Request):
    data = await request.json()
    user = verify_init_data(data.get("initData", ""))
    # ИИ отвечает только владельцу
    if not user or (OWNER_ID and user["id"] != OWNER_ID):
        return JSONResponse({"text": "ИИ-помощник доступен только владельцу курса."})
    if not ANTHROPIC_API_KEY:
        return JSONResponse({"text": "ИИ не подключён: не задан ANTHROPIC_API_KEY на сервере."})

    context = data.get("context", "")
    history = data.get("history", [])
    system = ("Ты — ИИ-ассистент владельца обучающего курса в Telegram-боте. "
              "Помогаешь анализировать прогресс учеников, находить отстающих, советовать по обучению "
              "и составлять тексты рассылок. Отвечай по-русски, кратко, без Markdown-заголовков.\n\n"
              f"Данные курса:\n{context}")
    messages = [{"role": "user", "content": system},
                {"role": "assistant", "content": "Принял данные курса. Готов помогать."}] + history
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": ANTHROPIC_API_KEY,
                         "anthropic-version": "2023-06-01",
                         "content-type": "application/json"},
                json={"model": "claude-sonnet-4-6", "max_tokens": 1000, "messages": messages},
            )
            body = r.json()
            text = "".join(c.get("text", "") for c in body.get("content", []) if c.get("type") == "text")
            return JSONResponse({"text": text or "Пустой ответ."})
    except Exception as e:
        return JSONResponse({"text": f"Ошибка ИИ: {e}"})


# ─── МИНИМАЛЬНЫЙ ВЕБХУК БОТА: /start открывает приложение ───────────────────
@app.post("/webhook")
async def webhook(request: Request):
    update = await request.json()
    msg = update.get("message")
    if msg and msg.get("text", "").startswith("/start"):
        chat_id = msg["chat"]["id"]
        await send_message(
            chat_id,
            "Привет! Это твоя зачётная книжка. Жми кнопку — откроются уроки, ДЗ и расписание.",
            buttons=[[{"text": "📓 Открыть дневник", "web_app": {"url": WEBAPP_URL}}]],
        )
    return {"ok": True}


# ─── АВТОНАСТРОЙКА КНОПКИ-МЕНЮ ПРИ СТАРТЕ ───────────────────────────────────
@app.on_event("startup")
async def on_startup():
    if BOT_TOKEN.startswith("ВСТАВЬ"):
        print("⚠️  Впиши BOT_TOKEN и WEBAPP_URL перед запуском.")
        return
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(f"{TG_API}/setChatMenuButton", json={
                "menu_button": {"type": "web_app", "text": "Дневник",
                                "web_app": {"url": WEBAPP_URL}}})
        print("✅ Кнопка-меню настроена. Приложение открывается из чата с ботом.")
    except Exception as e:
        print("Не удалось настроить кнопку:", e)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
