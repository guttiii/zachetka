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
import time
from datetime import datetime, date
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
# Секрет для вебхука: Telegram присылает его в заголовке каждого запроса.
# Поддельные запросы на /webhook (не от Telegram) отклоняются.
WEBHOOK_SECRET = hashlib.sha256(("webhook:" + BOT_TOKEN).encode()).hexdigest()[:32]
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Здесь копится статистика. Для реального проекта замени на базу данных (SQLite/Postgres).
progress = {}  # { user_id: {"viewed": set(), "done": set(), "name": str} }

# Все данные (курс, ученики) храним на постоянном диске. На Railway подключи Volume
# с путём /data и добавь переменную DATA_DIR=/data — иначе диск стирается при пересборке.
DATA_DIR = os.getenv("DATA_DIR", ".")
os.makedirs(DATA_DIR, exist_ok=True)
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")


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

# Владелец нажал «Загрузить видео» в уроке — ждём от него следующий видеофайл.
# { owner_id: {"lessonId": "d3", "title": "..."} }
awaiting_video = {}


def set_lesson_video(lesson_id: str, file_id: str) -> bool:
    """Вписывает код видео в нужный урок опубликованного курса и сохраняет."""
    global course_config
    if not course_config or not isinstance(course_config.get("days"), list):
        return False
    for d in course_config["days"]:
        if d.get("id") == lesson_id:
            d["link"] = "tg-video:" + file_id
            save_config(course_config)
            return True
    return False

# ─── УЧЕНИКИ: постоянное хранилище (переживает перезапуск) ──────────────────
STUDENTS_FILE = os.path.join(DATA_DIR, "students.json")


def load_students() -> dict:
    try:
        with open(STUDENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_students():
    with open(STUDENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(students_db, f, ensure_ascii=False, indent=2)


students_db = load_students()  # { "user_id": {name, username, status, joined, last_active, viewed:[], done:[]} }
for _rec in students_db.values():
    _rec.setdefault("status", "approved")  # кто был до системы заявок — уже одобрен


def register_student(user: dict) -> bool:
    """Регистрирует человека. Новый попадает со статусом «заявка». Возвращает True, если он новый."""
    uid = str(user["id"])
    if uid == str(OWNER_ID):
        return False  # владелец — не ученик
    rec = students_db.get(uid)
    now = datetime.now().isoformat(timespec="seconds")
    if not rec:
        students_db[uid] = {
            "name": (user.get("first_name", "") + " " + user.get("last_name", "")).strip() or "Ученик",
            "username": user.get("username", ""),
            "status": "pending",
            "joined": now, "last_active": now, "viewed": [], "done": [],
        }
        save_students()
        return True
    rec["last_active"] = now
    if user.get("first_name"):
        rec["name"] = (user.get("first_name", "") + " " + user.get("last_name", "")).strip()
    save_students()
    return False


async def notify_owner_request(uid: str):
    """Карточка заявки владельцу с кнопками Принять/Отклонить."""
    rec = students_db.get(uid)
    if not rec or not OWNER_ID:
        return
    text = f"📥 <b>Новая заявка на курс</b>\n{rec['name']}" + (f" @{rec['username']}" if rec.get("username") else "")
    buttons = [[{"text": "✅ Принять", "callback_data": f"req:ok:{uid}"},
                {"text": "❌ Отклонить", "callback_data": f"req:no:{uid}"}]]
    await send_message(OWNER_ID, text, buttons)


async def decide_request(uid: str, status: str):
    """Меняет статус заявки и сообщает человеку результат."""
    rec = students_db.get(uid)
    if not rec:
        return
    rec["status"] = status
    save_students()
    if status == "approved":
        await send_message(int(uid), "🎉 Ваша заявка одобрена — доступ к курсу открыт!",
                           buttons=[[{"text": "📓 Открыть дневник", "web_app": {"url": WEBAPP_URL}}]])
    else:
        await send_message(int(uid), "К сожалению, владелец курса не открыл вам доступ. Если это ошибка — напишите ему напрямую.")


def active_label(iso: str) -> str:
    """'сегодня' / 'вчера' / 'N дн. назад' для вкладки статистики."""
    try:
        d = (date.today() - datetime.fromisoformat(iso).date()).days
        return "сегодня" if d <= 0 else "вчера" if d == 1 else f"{d} дн. назад"
    except Exception:
        return "—"


def students_for_owner() -> list:
    return [{"id": uid, "name": rec["name"], "username": rec.get("username", ""),
             "status": rec.get("status", "approved"),
             "viewed": rec.get("viewed", []), "done": rec.get("done", []),
             "active": active_label(rec.get("last_active", ""))}
            for uid, rec in students_db.items()]


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
        # Подпись свежая? Старше суток — не принимаем (защита от перехваченных подписей)
        auth_date = int(parsed.get("auth_date", "0") or 0)
        if not auth_date or (time.time() - auth_date) > 86400:
            return None
        return json.loads(parsed.get("user", "{}"))
    except Exception:
        return None


async def send_message(chat_id: int, text: str, buttons: list | None = None, protect: bool = True):
    # protect=True по умолчанию: у ВСЕХ сообщений бота нет «Переслать» и «Сохранить»
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "protect_content": protect}
    if buttons:
        payload["reply_markup"] = {"inline_keyboard": buttons}
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(f"{TG_API}/sendMessage", json=payload)


async def send_video(chat_id: int, file_id: str, caption: str = ""):
    """Отправляет видео с защитой: без «Переслать» и «Сохранить»."""
    payload = {"chat_id": chat_id, "video": file_id, "caption": caption[:1024],
               "parse_mode": "HTML", "protect_content": True}
    async with httpx.AsyncClient(timeout=60) as client:
        await client.post(f"{TG_API}/sendVideo", json=payload)


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
    access = "owner"
    if user and not is_owner:
        is_new = register_student(user)
        if is_new:
            await notify_owner_request(str(user["id"]))
        access = students_db.get(str(user["id"]), {}).get("status", "pending")
    resp = {"is_owner": is_owner, "access": access, "config": course_config}
    if is_owner:
        resp["students"] = students_for_owner()
    return JSONResponse(resp)


@app.get("/config")
async def get_config():
    """Курс больше не отдаётся публично — только через подписанный /init из Telegram."""
    return JSONResponse({"config": None})


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
    register_student(user)
    srec = students_db.get(str(uid))
    if srec and srec.get("status") != "approved":
        return JSONResponse({"ok": False, "error": "not approved"}, status_code=403)
    action = data.get("action")
    idx = data.get("index")
    lesson_id = data.get("lessonId")

    def mark(field, add=True):
        if not srec or not lesson_id: return
        arr = srec.setdefault(field, [])
        if add and lesson_id not in arr: arr.append(lesson_id)
        if not add and lesson_id in arr: arr.remove(lesson_id)
        save_students()

    if action == "complete":
        mark("done", True)
        return JSONResponse({"ok": True})
    if action == "uncomplete":
        mark("done", False)
        return JSONResponse({"ok": True})

    if action == "lesson":
        mark("viewed", True)
        title = data.get("title", "")
        desc = data.get("desc", "")
        link = data.get("link", "")
        if link.startswith("tg-video:"):
            # Видео из хранилища Telegram: приходит лично, защищено от пересылки/скачивания
            await send_video(uid, link.split(":", 1)[1], caption=f"🎬 <b>Урок {idx}. {title}</b>\n\n{desc}")
        else:
            text = f"🎬 <b>Урок {idx}. {title}</b>\n\n{desc}"
            buttons = [[{"text": "▶ Смотреть урок", "url": link}]] if link and link.startswith("http") else None
            await send_message(uid, text, buttons, protect=True)

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


# ─── ЗАПРОС НА ЗАГРУЗКУ ВИДЕО ИЗ ПРИЛОЖЕНИЯ (только владелец) ───────────────
@app.post("/upload-video")
async def upload_video(request: Request):
    data = await request.json()
    user = verify_init_data(data.get("initData", ""))
    if not user or not OWNER_ID or user["id"] != OWNER_ID:
        return JSONResponse({"ok": False, "error": "нет прав"}, status_code=403)
    lesson_id = str(data.get("lessonId", ""))
    title = data.get("title", "")
    awaiting_video[OWNER_ID] = {"lessonId": lesson_id, "title": title}
    await send_message(OWNER_ID,
        f"🎬 Пришли сюда видео для урока «{title}» — следующим сообщением.\n\n"
        "Как только загрузится, я сам впишу его в урок. Чтобы отменить — напиши /cancel.")
    return JSONResponse({"ok": True})


# ─── РЕШЕНИЕ ПО ЗАЯВКЕ ИЗ ПРИЛОЖЕНИЯ (только владелец) ──────────────────────
@app.post("/decide")
async def decide(request: Request):
    data = await request.json()
    user = verify_init_data(data.get("initData", ""))
    if not user or not OWNER_ID or user["id"] != OWNER_ID:
        return JSONResponse({"ok": False, "error": "нет прав"}, status_code=403)
    sid = str(data.get("studentId", ""))
    decision = data.get("decision")
    if sid not in students_db or decision not in ("approved", "rejected"):
        return JSONResponse({"ok": False, "error": "плохой запрос"}, status_code=400)
    await decide_request(sid, decision)
    return JSONResponse({"ok": True, "students": students_for_owner()})


# ─── МИНИМАЛЬНЫЙ ВЕБХУК БОТА: /start открывает приложение ───────────────────
@app.post("/webhook")
async def webhook(request: Request):
    # Запрос точно от Telegram? Иначе отбрасываем (защита от поддельных «нажатий»)
    if request.headers.get("x-telegram-bot-api-secret-token") != WEBHOOK_SECRET:
        return JSONResponse({"ok": False}, status_code=403)
    update = await request.json()

    # Кнопки «Принять/Отклонить» под карточкой заявки в чате владельца
    cb = update.get("callback_query")
    if cb:
        cb_data = cb.get("data", "")
        if cb_data.startswith("req:") and cb["from"]["id"] == OWNER_ID:
            _, verdict, sid = cb_data.split(":", 2)
            await decide_request(sid, "approved" if verdict == "ok" else "rejected")
            rec = students_db.get(sid, {})
            label = "✅ Принят" if verdict == "ok" else "❌ Отклонён"
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(f"{TG_API}/answerCallbackQuery", json={"callback_query_id": cb["id"], "text": label})
                await client.post(f"{TG_API}/editMessageText", json={
                    "chat_id": cb["message"]["chat"]["id"], "message_id": cb["message"]["message_id"],
                    "text": f"{label}: {rec.get('name', '')}", "parse_mode": "HTML"})
        return {"ok": True}

    msg = update.get("message")

    # Отмена ожидания видео
    if msg and OWNER_ID and (msg.get("from") or {}).get("id") == OWNER_ID and msg.get("text", "").strip() == "/cancel":
        if awaiting_video.pop(OWNER_ID, None):
            await send_message(OWNER_ID, "Отменил. Видео не прикреплял.")
            return {"ok": True}

    # Владелец прислал боту видео
    if msg and OWNER_ID and (msg.get("from") or {}).get("id") == OWNER_ID:
        vid = msg.get("video") or msg.get("video_note")
        doc = msg.get("document")
        if not vid and doc and str(doc.get("mime_type", "")).startswith("video/"):
            vid = doc
        if vid:
            pending = awaiting_video.pop(OWNER_ID, None)
            if pending:
                # Мы ждали видео для конкретного урока — вписываем и публикуем сразу
                ok = set_lesson_video(pending["lessonId"], vid["file_id"])
                if ok:
                    await send_message(OWNER_ID,
                        f"✅ Видео прикреплено к уроку «{pending['title']}» и опубликовано.\n\n"
                        "Ученики уже могут его открыть — видео придёт им в чат с защитой "
                        "от пересылки и скачивания.")
                else:
                    await send_message(OWNER_ID,
                        "Не нашёл этот урок в опубликованном курсе. Сначала опубликуй курс "
                        "(кнопка 🚀), потом снова нажми «Загрузить видео» у урока.")
                return {"ok": True}
            # Видео прислали просто так — выдаём код на случай ручной вставки
            code = "tg-video:" + vid["file_id"]
            await send_message(OWNER_ID,
                "🎬 <b>Видео принято!</b>\n\nЧтобы прикрепить его к уроку, удобнее нажать "
                "«Загрузить видео» прямо в редакторе урока. Либо вставь этот код вручную "
                "в поле «Видео или ссылка»:\n\n"
                f"<code>{code}</code>")
            return {"ok": True}

    if msg and msg.get("text", "").startswith("/start"):
        chat_id = msg["chat"]["id"]
        u = msg.get("from") or {}
        if OWNER_ID and u.get("id") == OWNER_ID:
            await send_message(chat_id, "Привет, владелец! Открывай дневник — редактор и статистика внутри.",
                               buttons=[[{"text": "📓 Открыть дневник", "web_app": {"url": WEBAPP_URL}}]])
            return {"ok": True}
        is_new = register_student(u) if u else False
        status = students_db.get(str(u.get("id")), {}).get("status", "pending")
        if status == "approved":
            await send_message(chat_id, "Привет! Это твоя зачётная книжка. Жми кнопку — откроются уроки, ДЗ и расписание.",
                               buttons=[[{"text": "📓 Открыть дневник", "web_app": {"url": WEBAPP_URL}}]])
        elif status == "rejected":
            await send_message(chat_id, "Доступ к курсу не открыт. Если это ошибка — напишите владельцу курса.")
        else:
            if is_new:
                await notify_owner_request(str(u["id"]))
                await send_message(chat_id, "📝 Заявка на доступ к курсу отправлена владельцу. Как только он её одобрит — бот пришлёт вам сообщение.")
            else:
                await send_message(chat_id, "⏳ Ваша заявка ещё на рассмотрении. Бот напишет, как только доступ откроют.")
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
            await client.post(f"{TG_API}/setWebhook", json={
                "url": WEBAPP_URL + "/webhook", "secret_token": WEBHOOK_SECRET})
        print("✅ Кнопка-меню и защищённый вебхук настроены автоматически.")
    except Exception as e:
        print("Не удалось настроить кнопку:", e)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
