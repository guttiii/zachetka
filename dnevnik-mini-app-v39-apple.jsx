import { useState, useMemo, useRef, useEffect } from "react";

// ─── ДНЕВНИК v33 · КОНСТРУКТОР + ПАНЕЛЬ ВЛАДЕЛЬЦА ────────────────────────
// Новое в v33:
// • Нажатие «Смотреть/Открыть урок» = урок уходит ученику в чат с ботом
//   и сразу помечается «Просмотрено» (владелец видит, кто смотрел).
// • Вкладка «Статистика»: прогресс каждого ученика, отстающие, разбор по урокам.
// • Вкладка «ИИ»: живой чат с советами по обучению — знает все данные курса.
// • Вкладка «Рассылка»: сообщение всем / отстающим / не посмотревшим урок.
// Вкладки владельца видны только при включённом режиме владельца.

const INITIAL_SETTINGS = {
  title: "Зачётная книжка",
  subtitle: "Легальный P2P через ИП",
  streak: "Серия: 4 дня",
  startDate: "2026-08-17",
  time: "19:00",
  interval: 2,
  graduateRank: "Выпускник",
  stamp: "зачтено",
};

const INITIAL_MODULES = [
  { id: "m1", name: "Модуль 1 · Легальный старт", rank: "Новичок" },
  { id: "m2", name: "Модуль 2 · Налоги и счёт", rank: "Практик" },
  { id: "m3", name: "Модуль 3 · Комплаенс и учёт", rank: "Опытный" },
  { id: "m4", name: "Модуль 4 · Отчётность и запуск", rank: "Профи" },
];

const INITIAL_DAYS = [
  { id: "d1", m: "m1", title: "P2P и легальный статус", desc: "Зачем работать в белую: риски, 115-ФЗ, блокировки карт", hw: "Конспект: 3 риска работы без ИП", type: "lesson", link: "" },
  { id: "d2", m: "m1", title: "Самозанятый или ИП", desc: "Сравниваем НПД и ИП: лимиты, что кому подходит", hw: "Вывод: что выбираешь и почему", type: "lesson", link: "" },
  { id: "d3", m: "m1", title: "Регистрация ИП пошагово", desc: "Через Госуслуги/банк, выбор основного ОКВЭД", hw: "Скрин поданного заявления", type: "lesson", link: "" },
  { id: "d4", m: "m1", title: "Контрольная точка", desc: "Мини-тест по модулю 1", hw: "Тест: 10 вопросов", type: "exam", link: "" },
  { id: "d5", m: "m2", title: "Налоговые режимы", desc: "УСН 6% против НПД — что выгоднее под оборот", hw: "Расчёт налога на своём примере", type: "lesson", link: "" },
  { id: "d6", m: "m2", title: "Коды ОКВЭД", desc: "Какие подходят под деятельность, риски несоответствия", hw: "Список ОКВЭД под свою работу", type: "lesson", link: "" },
  { id: "d7", m: "m2", title: "Расчётный счёт ИП", desc: "Открытие счёта, разделение личного и рабочего", hw: "Счёт открыт / заявка подана", type: "practice", link: "" },
  { id: "d8", m: "m2", title: "Контрольная точка", desc: "Мини-тест по модулю 2", hw: "Тест: 10 вопросов", type: "exam", link: "" },
  { id: "d9", m: "m3", title: "115-ФЗ на практике", desc: "Как не попасть под блокировку, признаки подозрительных операций", hw: "Чек-лист: 5 правил безопасных операций", type: "lesson", link: "" },
  { id: "d10", m: "m3", title: "Учёт доходов (КУДиР)", desc: "Фиксация каждой операции, документооборот", hw: "Заполненная строка КУДиР", type: "practice", link: "" },
  { id: "d11", m: "m3", title: "Работа с контрагентами", desc: "Чеки, договоры, подтверждение источника средств", hw: "Шаблон чека/договора", type: "practice", link: "" },
  { id: "d12", m: "m3", title: "Контрольная точка", desc: "Мини-тест по модулю 3", hw: "Тест: 10 вопросов", type: "exam", link: "" },
  { id: "d13", m: "m4", title: "Налоговая отчётность", desc: "Декларация УСН, сроки, авансовые платежи", hw: "Календарь своих платежей", type: "lesson", link: "" },
  { id: "d14", m: "m4", title: "Разбор кейса с куратором", desc: "Реальная ситуация, вопросы-ответы", hw: "Свой вопрос куратору", type: "practice", link: "" },
  { id: "d15", m: "m4", title: "Выпускной экзамен", desc: "Итоговый тест и диплом", hw: "Итоговый тест", type: "exam", link: "" },
];

const INITIAL_IMPORTANT = [
  { id: "i1", icon: "📋", title: "Правила курса", desc: "Как проходит обучение, дедлайны, дисциплина", link: "" },
  { id: "i2", icon: "💬", title: "Чат потока", desc: "Группа с созвонами и общением", link: "" },
  { id: "i3", icon: "👨‍🏫", title: "Связь с куратором", desc: "Вопросы по урокам и сдача ДЗ лично", link: "" },
  { id: "i4", icon: "🔗", title: "Полезные сервисы", desc: "Госуслуги, ФНС, банки, калькуляторы налогов", link: "" },
  { id: "i5", icon: "❓", title: "Частые вопросы", desc: "Пропустил созвон, потерял ссылку и т.д.", link: "" },
];

const INITIAL_TABS = [
  { id: "diary", icon: "📓", label: "Дневник", fixed: true },
  { id: "lessons", icon: "🎬", label: "Уроки" },
  { id: "hw", icon: "📝", label: "ДЗ" },
  { id: "practice", icon: "⚡", label: "Практика" },
  { id: "schedule", icon: "📅", label: "Расписание" },
  { id: "important", icon: "📌", label: "Важное" },
];

// Демо-ученики потока: done/viewed — сколько первых уроков зачтено/просмотрено
const DEMO_STUDENTS = [
  { id: "s1", name: "Артём К.", done: 15, viewed: 15, active: "сегодня" },
  { id: "s2", name: "Мария П.", done: 9, viewed: 11, active: "сегодня" },
  { id: "s3", name: "Иван С.", done: 8, viewed: 9, active: "вчера" },
  { id: "s4", name: "Дарья Л.", done: 7, viewed: 8, active: "вчера" },
  { id: "s5", name: "Олег Т.", done: 4, viewed: 6, active: "3 дня назад" },
  { id: "s6", name: "Нина В.", done: 2, viewed: 3, active: "5 дней назад" },
  { id: "s7", name: "Сергей М.", done: 0, viewed: 1, active: "неделю назад" },
];

const SYSTEM_TABS = ["diary", "lessons", "hw", "practice", "schedule", "important"];
const ADMIN_TABS = [
  { id: "stats", icon: "📊", label: "Статистика" },
  { id: "ai", icon: "🤖", label: "ИИ" },
  { id: "cast", icon: "📣", label: "Рассылка" },
];
const ADMIN_IDS = ADMIN_TABS.map((t) => t.id);
const EMOJIS = ["⭐", "🔥", "🎯", "💡", "🧾", "🏦", "📈", "🎓", "🛡️", "💬", "📎", "🗂️"];
const AI_QUICK = ["Кто отстаёт от программы?", "Какой урок смотрят хуже всего?", "Кому написать лично и что?", "Составь текст рассылки для отстающих"];

const uid = () => Math.random().toString(36).slice(2, 9);
const arrMove = (arr, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};
const openUrl = (url) => {
  const w = window.open(url, "_blank");
  if (!w) alert("Ссылка: " + url);
};
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

// ─── МОСТ К TELEGRAM ────────────────────────────────────────────────────
// Внутри Telegram доступен объект window.Telegram.WebApp. Вне его (в превью)
// tg === null, и всё работает в демо-режиме. Сама страница НЕ шлёт сообщения
// в чат — она сообщает боту «ученик нажал X», а бот уже пишет в личку.
const tg = typeof window !== "undefined" && window.Telegram ? window.Telegram.WebApp : null;
const inTelegram = !!(tg && tg.initData);
// Если страница подключена к серверу (боевой режим), но открыта не из Telegram —
// курс не показываем вовсе. Превью без сервера остаётся демо-режимом.
const requireTelegram = !!(typeof window !== "undefined" && window.__BOT_API__ && !inTelegram);
// Отправка события боту. Если приложение открыто reply-кнопкой — уходит через
// sendData (бот ловит web_app_data). Если есть свой backend — через fetch на /event.
const notifyBot = async (payload) => {
  const body = JSON.stringify(payload);
  // Вариант с backend (полноценное мини-приложение). URL задаётся при сборке.
  const API = (typeof window !== "undefined" && window.__BOT_API__) || "";
  if (inTelegram && API) {
    try {
      await fetch(API + "/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, initData: tg.initData }),
      });
      return true;
    } catch (e) { /* упадём в sendData ниже */ }
  }
  // Вариант без backend: мини-апп открыт reply-кнопкой. sendData закрывает окно.
  if (tg && tg.sendData && inTelegram && !API) {
    try { tg.sendData(body); return true; } catch (e) { /* демо */ }
  }
  return false;
};
const haptic = (type) => {
  try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred(type); } catch (e) {}
};

// Вспомогательные компоненты объявлены снаружи, чтобы React не пересоздавал их
// на каждый рендер (иначе поля ввода теряют фокус после каждого символа).
const Field = ({ label, children }) => (
  <div><div className="edLabel">{label}</div>{children}</div>
);
const Arrows = ({ onUp, onDown }) => (
  <span className="arrows">
    <button onClick={(e) => { e.stopPropagation(); onUp(); }} aria-label="Вверх">▲</button>
    <button onClick={(e) => { e.stopPropagation(); onDown(); }} aria-label="Вниз">▼</button>
  </span>
);
const IconInput = ({ value, onChange }) => (
  <div className="iconPick">
    <input className="iconBox" value={value} onChange={(e) => onChange(e.target.value)} maxLength={4} />
    {EMOJIS.map((e) => <button key={e} className="emoji" onClick={() => onChange(e)}>{e}</button>)}
  </div>
);
const DelBtn = ({ k, armed, armOrRun, onRun, small }) => (
  <button className={`edDel ${armed === k ? "armed" : ""}`} style={small ? { padding: "4px 8px", fontSize: 11 } : null}
    onClick={(e) => { e.stopPropagation(); armOrRun(k, onRun); }}>
    {armed === k ? "Точно?" : "Удалить"}
  </button>
);
const MiniBar = ({ value }) => (
  <div className="miniBar"><div style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
);

export default function Diary() {
  const [tab, setTab] = useState("diary");
  const [editor, setEditor] = useState(false);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [modules, setModules] = useState(INITIAL_MODULES);
  const [days, setDays] = useState(INITIAL_DAYS);
  const [tabs, setTabs] = useState(INITIAL_TABS);
  const [important, setImportant] = useState(INITIAL_IMPORTANT);
  const [blocks, setBlocks] = useState({});
  const [done, setDone] = useState(() => new Set(["d1", "d2", "d3", "d4"]));
  const [viewed, setViewed] = useState(() => new Set(["d1", "d2", "d3", "d4", "d5"]));
  const [justStamped, setJustStamped] = useState(null);
  const [armed, setArmed] = useState(null);
  const [openCard, setOpenCard] = useState(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState("");
  const [toast, setToast] = useState(null);
  const [isOwner, setIsOwner] = useState(!inTelegram && !requireTelegram); // превью — владелец; в бою решает сервер
  const [serverStudents, setServerStudents] = useState(null); // реальные ученики с сервера (для владельца)
  const [access, setAccess] = useState("approved"); // owner | approved | pending | rejected
  const [publishState, setPublishState] = useState("idle"); // idle | saving | saved | error
  const [publishedSnap, setPublishedSnap] = useState(null); // слепок последней опубликованной версии
  const [configLoaded, setConfigLoaded] = useState(false);
  const [expandLesson, setExpandLesson] = useState(null);
  // ИИ-чат
  const [aiMsgs, setAiMsgs] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  // Рассылка
  const [castText, setCastText] = useState("");
  const [castAud, setCastAud] = useState("all");
  const [castLesson, setCastLesson] = useState("");
  const [castHistory, setCastHistory] = useState([]);
  const jsonRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiMsgs, aiLoading]);

  // Инициализация Telegram Mini App: развернуть на весь экран, подхватить тему
  useEffect(() => {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor("#F2F2F7");
      } catch (e) {}
    }
  }, []);

  // Применить конфигурацию курса, пришедшую с сервера
  const loadConfig = (c) => {
    if (!c) return;
    setSettings({ ...INITIAL_SETTINGS, ...(c.settings || {}) });
    if (Array.isArray(c.modules)) setModules(c.modules);
    if (Array.isArray(c.days)) setDays(c.days);
    if (Array.isArray(c.tabs)) setTabs(c.tabs);
    if (Array.isArray(c.important)) setImportant(c.important);
    if (c.blocks && typeof c.blocks === "object") setBlocks(c.blocks);
  };

  // Загрузка курса и прав доступа при запуске.
  // Ученик получает готовую опубликованную версию; режим владельца — только владельцу.
  useEffect(() => {
    const API = (typeof window !== "undefined" && window.__BOT_API__) || "";
    if (!API) { setConfigLoaded(true); return; } // демо без сервера — на встроенных данных
    (async () => {
      try {
        if (inTelegram) {
          const r = await fetch(API + "/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: tg.initData }),
          });
          const d = await r.json();
          setIsOwner(!!d.is_owner);   // сервер сам решает, ты это или ученик
          if (d.access) setAccess(d.access);
          if (d.config) loadConfig(d.config);
          if (Array.isArray(d.students)) setServerStudents(d.students);
        }
        // в браузере (не Telegram) на боевом сервере курс не загружаем
      } catch (e) { /* оффлайн — покажем встроенный курс */ }
      finally { setConfigLoaded(true); }
    })();
  }, []);

  // Пока заявка не одобрена — курс скрыт
  const locked = requireTelegram || access === "pending" || access === "rejected";
  useEffect(() => { if (locked) setTab("locked"); }, [locked]);

  // Решение по заявке из вкладки Статистика (только владелец)
  const decide = async (studentId, decision) => {
    const API = (typeof window !== "undefined" && window.__BOT_API__) || "";
    if (!API) { showToast("Демо-режим: заявки работают на сервере"); return; }
    try {
      const r = await fetch(API + "/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: (tg && tg.initData) || "", studentId, decision }),
      });
      const d = await r.json();
      if (d.ok) {
        if (Array.isArray(d.students)) setServerStudents(d.students);
        showToast(decision === "approved" ? "✅ Доступ открыт — бот сообщил ученику" : "Заявка отклонена");
      } else showToast("Не получилось: " + (d.error || "нет прав"));
    } catch (e) { showToast("Ошибка сети"); }
  };

  // Загрузить видео к уроку: бот попросит прислать видеофайл в чат и сам впишет его
  const uploadVideo = async (day) => {
    const API = (typeof window !== "undefined" && window.__BOT_API__) || "";
    if (!API || !inTelegram) { showToast("Загрузка видео работает в Telegram после публикации курса"); return; }
    if (dirty) { showToast("Сначала опубликуй курс (кнопка 🚀), потом грузи видео"); return; }
    try {
      const r = await fetch(API + "/upload-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: (tg && tg.initData) || "", lessonId: day.id, title: day.title }),
      });
      const d = await r.json();
      if (d.ok) {
        showToast("📩 Открой чат с ботом и пришли видео — он сам впишет его в урок");
        if (tg && tg.close) setTimeout(() => tg.close(), 1200); // свернём апп к чату с ботом
      } else showToast("Не получилось: " + (d.error || "нет прав"));
    } catch (e) { showToast("Ошибка сети"); }
  };

  // Опубликовать текущую конфигурацию: ученики увидят изменения при следующем открытии
  const publish = async () => {
    const API = (typeof window !== "undefined" && window.__BOT_API__) || "";
    if (!API) { showToast("Демо-режим: подключи сервер из инструкции, чтобы публиковать ученикам"); return; }
    setPublishState("saving");
    try {
      const r = await fetch(API + "/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, initData: (tg && tg.initData) || "" }),
      });
      const d = await r.json();
      if (d.ok) { setPublishState("saved"); setPublishedSnap(JSON.stringify(config, null, 2)); showToast("✅ Опубликовано — ученики увидят изменения при открытии"); }
      else { setPublishState("error"); showToast("Не удалось опубликовать: " + (d.error || "нет прав")); }
    } catch (e) { setPublishState("error"); showToast("Ошибка сети при публикации"); }
    setTimeout(() => setPublishState("idle"), 2500);
  };

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 2400);
  };

  // ─── ПРОИЗВОДНЫЕ ДАННЫЕ ────────────────────────────────────────────────
  const num = (id) => days.findIndex((x) => x.id === id) + 1;
  const current = useMemo(() => days.find((d) => !done.has(d.id)) || null, [days, done]);
  const total = days.length;
  const doneCount = days.filter((d) => done.has(d.id)).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const rank = !modules.length ? "" : doneCount >= total && total > 0
    ? settings.graduateRank
    : modules[Math.min(modules.length - 1, Math.floor((doneCount / Math.max(1, total)) * modules.length))].rank;

  const lessonDate = (index) => {
    const day = days[index];
    // Приоритет — вручную заданная дата урока
    if (day && day.date) {
      const md = new Date(day.date + "T00:00:00");
      if (!isNaN(md)) return md;
    }
    // Иначе — авторасчёт от даты старта и интервала
    const dt = new Date(settings.startDate + "T00:00:00");
    if (isNaN(dt)) return null;
    dt.setDate(dt.getDate() + index * Math.max(1, Number(settings.interval) || 1));
    return dt;
  };
  const lessonTime = (index) => (days[index] && days[index].time) || settings.time;
  const fmtDate = (index) => {
    const dt = lessonDate(index);
    return dt ? dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" }) : "дата не задана";
  };
  const dateStatus = (index) => {
    const dt = lessonDate(index);
    if (!dt) return "future";
    const today = new Date();
    if (dt.toDateString() === today.toDateString()) return "today";
    return dt < today ? "past" : "future";
  };
  const rowState = (id) => (done.has(id) ? "done" : current && current.id === id ? "today" : "locked");

  // Сколько уроков должно быть пройдено к сегодняшнему дню по расписанию
  const expectedIdx = useMemo(() => {
    const today = new Date();
    let n = 0;
    for (let i = 0; i < days.length; i++) {
      const dt = lessonDate(i);
      if (dt && dt <= today) n++;
    }
    return n;
  }, [days, settings.startDate, settings.interval]);  // ручные даты уроков тоже учитываются через lessonDate

  // Ученики: реальные с сервера (боевой режим) или демо-поток (превью без сервера)
  const students = useMemo(() => {
    if (serverStudents) {
      return serverStudents.filter((s) => !s.status || s.status === "approved").map((s) => ({
        id: s.id, name: s.name + (s.username ? " @" + s.username : ""), active: s.active,
        doneSet: new Set(s.done || []), viewedSet: new Set(s.viewed || []),
      }));
    }
    const mk = (s) => ({
      ...s,
      doneSet: new Set(days.slice(0, s.done).map((d) => d.id)),
      viewedSet: new Set(days.slice(0, s.viewed).map((d) => d.id)),
    });
    const me = { id: "me", name: "Ты (демо-ученик)", active: "сейчас", doneSet: done, viewedSet: viewed };
    return [me, ...DEMO_STUDENTS.map(mk)];
  }, [serverStudents, days, done, viewed]);

  const studentStats = (s) => {
    const d = days.filter((x) => s.doneSet.has(x.id)).length;
    const v = days.filter((x) => s.viewedSet.has(x.id)).length;
    const lag = expectedIdx - d;
    const status = total > 0 && d >= total ? "finished" : lag >= 2 ? "lagging" : "ok";
    return { d, v, lag, status, pct: total ? Math.round((d / total) * 100) : 0 };
  };
  const laggards = students.filter((s) => studentStats(s).status === "lagging");
  const avgPct = students.length ? Math.round(students.reduce((a, s) => a + studentStats(s).pct, 0) / students.length) : 0;
  const lessonViewers = (dayId) => students.filter((s) => s.viewedSet.has(dayId));

  // ─── ДЕЙСТВИЯ УЧЕНИКА ──────────────────────────────────────────────────
  const complete = (id) => {
    setDone((prev) => new Set([...prev, id]));
    setJustStamped(id);
    setTimeout(() => setJustStamped(null), 900);
    notifyBot({ action: "complete", lessonId: id });
  };
  const uncomplete = (id) => {
    setDone((prev) => { const n = new Set(prev); n.delete(id); return n; });
    notifyBot({ action: "uncomplete", lessonId: id });
  };
  // Открыть урок = бот присылает урок в чат + отметка «Просмотрено»
  const openLesson = (day) => {
    setViewed((prev) => new Set([...prev, day.id]));
    haptic("success");
    notifyBot({ action: "lesson", lessonId: day.id, index: num(day.id), title: day.title, desc: day.desc, link: day.link });
    showToast(`📬 Урок ${num(day.id)} отправлен тебе в чат с ботом · отмечен как просмотренный`);
    if (day.link && !inTelegram && day.link.startsWith("http")) openUrl(day.link); // в Telegram контент пришлёт бот
  };
  // Нажал ДЗ = бот присылает назначенное задание в чат с ботом
  const sendHw = (day) => {
    haptic("success");
    notifyBot({ action: "homework", lessonId: day.id, index: num(day.id), title: day.title, hw: day.hw });
    showToast(`📩 ДЗ к уроку ${num(day.id)} отправлено тебе в чат с ботом`);
  };
  const openImp = (item) => {
    if (item.link) openUrl(item.link);
    else alert(`Откроется раздел «${item.title}». В режиме владельца можно привязать сюда ссылку.`);
  };

  // ─── РЕДАКТОР ──────────────────────────────────────────────────────────
  const upd = (setter) => (id, patch) => setter((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const updDay = upd(setDays);
  const updModule = upd(setModules);
  const updImp = upd(setImportant);
  const updTab = upd(setTabs);
  const updSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const armOrRun = (key, run) => {
    if (armed === key) { setArmed(null); run(); }
    else { setArmed(key); setTimeout(() => setArmed((a) => (a === key ? null : a)), 2500); }
  };

  const addDay = (moduleId) => {
    const id = "d" + uid();
    setDays((prev) => [...prev, { id, m: moduleId || (modules[0] && modules[0].id) || "", title: "Новый урок", desc: "Описание урока", hw: "Задание", type: "lesson", link: "" }]);
    setOpenCard(id);
  };
  const delDay = (id) => { setDays((prev) => prev.filter((x) => x.id !== id)); uncomplete(id); };
  const moveDay = (i, dir) => setDays((prev) => arrMove(prev, i, dir));

  const addModule = () => setModules((prev) => [...prev, { id: "m" + uid(), name: `Модуль ${prev.length + 1} · Название`, rank: "Звание" }]);
  const delModule = (id) => {
    const rest = modules.filter((x) => x.id !== id);
    setModules(rest);
    if (rest.length) setDays((prev) => prev.map((d) => (d.m === id ? { ...d, m: rest[0].id } : d)));
  };

  const addImp = () => setImportant((prev) => [...prev, { id: "i" + uid(), icon: "⭐", title: "Новый раздел", desc: "Описание", link: "" }]);

  const addTab = () => {
    const id = "t" + uid();
    setTabs((prev) => [...prev, { id, icon: "⭐", label: "Вкладка" }]);
    setBlocks((prev) => ({ ...prev, [id]: [] }));
  };
  const delTab = (id) => {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setBlocks((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (tab === id) setTab("diary");
  };
  const isCustom = (id) => !SYSTEM_TABS.includes(id) && !ADMIN_IDS.includes(id);

  const tabBlocks = (id) => blocks[id] || [];
  const setTabBlocks = (id, fn) => setBlocks((prev) => ({ ...prev, [id]: fn(prev[id] || []) }));
  const addBlock = (tabId, kind) => setTabBlocks(tabId, (b) => [...b, kind === "link"
    ? { id: "b" + uid(), kind: "link", title: "Открыть материал", url: "" }
    : { id: "b" + uid(), kind: "text", title: "Заголовок", text: "Текст блока — правила, инструкция, что угодно." }]);
  const updBlock = (tabId, id, patch) => setTabBlocks(tabId, (b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const delBlock = (tabId, id) => setTabBlocks(tabId, (b) => b.filter((x) => x.id !== id));
  const moveBlock = (tabId, i, dir) => setTabBlocks(tabId, (b) => arrMove(b, i, dir));

  const toggleOwner = () => {
    if (editor && ADMIN_IDS.includes(tab)) setTab("diary");
    setEditor((v) => !v);
  };

  // ─── ИИ-ЧАТ ВЛАДЕЛЬЦА ──────────────────────────────────────────────────
  const buildContext = () => {
    const lessons = days.map((d, i) => `Урок ${i + 1} (${d.type}): «${d.title}» — просмотрели ${lessonViewers(d.id).length} из ${students.length}`).join("\n");
    const studs = students.map((s) => {
      const st = studentStats(s);
      return `${s.name}: зачтено ${st.d}/${total}, просмотрено ${st.v}/${total}, отставание ${st.lag > 0 ? st.lag : 0} ур., активность: ${s.active}${st.status === "lagging" ? " [ОТСТАЁТ]" : st.status === "finished" ? " [ЗАКОНЧИЛ]" : ""}`;
    }).join("\n");
    return `Курс: «${settings.title} — ${settings.subtitle}». Старт: ${settings.startDate}, занятия каждые ${settings.interval} дн. в ${settings.time}. Всего уроков: ${total}. По расписанию к сегодняшнему дню должно быть пройдено: ${expectedIdx}.\n\nМодули:\n${modules.map((m) => `- ${m.name}`).join("\n")}\n\nУроки и просмотры:\n${lessons}\n\nУченики (${students.length}):\n${studs}`;
  };

  const askAI = async (question) => {
    const q = (question || aiInput).trim();
    if (!q || aiLoading) return;
    const history = [...aiMsgs, { role: "user", content: q }];
    setAiMsgs(history);
    setAiInput("");
    setAiLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            { role: "user", content: `Ты — ИИ-ассистент владельца обучающего курса, встроенный в Telegram-бот. Твоя задача — помогать владельцу вести поток: анализировать прогресс учеников, находить отстающих, советовать, как улучшить прохождение, помогать с текстами сообщений. Отвечай на русском, кратко и по делу, без Markdown-заголовков. Вот актуальные данные курса:\n\n${buildContext()}` },
            { role: "assistant", content: "Принял данные курса. Готов помогать — спрашивай про учеников, уроки и рассылки." },
            ...history,
          ],
        }),
      });
      const data = await response.json();
      const text = (data.content || []).map((c) => (c.type === "text" ? c.text : "")).join("\n").trim();
      setAiMsgs((m) => [...m, { role: "assistant", content: text || "Пустой ответ — попробуй переформулировать вопрос." }]);
    } catch (e) {
      setAiMsgs((m) => [...m, { role: "assistant", content: "Не удалось получить ответ: " + e.message + ". Проверь соединение и попробуй ещё раз." }]);
    } finally {
      setAiLoading(false);
    }
  };

  // ─── РАССЫЛКА ──────────────────────────────────────────────────────────
  const castRecipients = () => {
    if (castAud === "all") return students;
    if (castAud === "lagging") return laggards;
    if (castAud === "notviewed") {
      const dayId = castLesson || (days[0] && days[0].id);
      return students.filter((s) => !s.viewedSet.has(dayId));
    }
    return [];
  };
  const castAudLabel = () => {
    if (castAud === "all") return "Все ученики";
    if (castAud === "lagging") return "Отстающие";
    const day = days.find((d) => d.id === (castLesson || (days[0] && days[0].id)));
    return day ? `Не посмотревшие урок ${num(day.id)}` : "Не посмотревшие урок";
  };
  const sendCast = () => {
    const rec = castRecipients();
    if (!castText.trim()) return;
    setCastHistory((prev) => [{
      id: "c" + uid(),
      text: castText.trim(),
      audience: castAudLabel(),
      count: rec.length,
      time: new Date().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    }, ...prev]);
    setCastText("");
    showToast(`📣 Рассылка отправлена: ${rec.length} ${plural(rec.length, "ученик", "ученика", "учеников")} (демо)`);
  };

  // ─── ЭКСПОРТ / ИМПОРТ ──────────────────────────────────────────────────
  const config = { settings, modules, days, tabs, important, blocks };
  const exportJSON = JSON.stringify(config, null, 2);
  useEffect(() => { if (configLoaded && publishedSnap === null) setPublishedSnap(exportJSON); }, [configLoaded]);
  const dirty = publishedSnap !== null && exportJSON !== publishedSnap; // есть несохранённые правки
  const copyJSON = async () => {
    try { await navigator.clipboard.writeText(exportJSON); setCopied(true); }
    catch { if (jsonRef.current) { jsonRef.current.select(); document.execCommand("copy"); setCopied(true); } }
    setTimeout(() => setCopied(false), 1600);
  };
  const applyImport = () => {
    try {
      const c = JSON.parse(importText);
      if (!Array.isArray(c.days) || !Array.isArray(c.modules) || !Array.isArray(c.tabs)) throw new Error("нет days / modules / tabs");
      setSettings({ ...INITIAL_SETTINGS, ...(c.settings || {}) });
      setModules(c.modules); setDays(c.days); setTabs(c.tabs);
      setImportant(Array.isArray(c.important) ? c.important : []);
      setBlocks(c.blocks && typeof c.blocks === "object" ? c.blocks : {});
      setImportText(""); setImportErr(""); setTab("diary");
    } catch (e) { setImportErr("Не получилось прочитать JSON: " + e.message); }
  };

  const typeName = { lesson: "Урок", practice: "Практика", exam: "Контроль" };
  const statusBadge = { finished: ["🎓 Закончил", "bViolet"], lagging: ["Отстаёт", "bRed"], ok: ["В графике", "bGreen"] };

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; -webkit-tap-highlight-color: transparent; }
        :root {
          --bg:#F2F2F7; --cell:#FFFFFF; --sep:#E5E5EA; --fill:#E9E9EB; --fill2:#F2F2F7;
          --label:#000000; --label2:#8E8E93; --label3:#AEAEB2;
          --blue:#007AFF; --blue-tint:rgba(0,122,255,.12); --blue-tint2:rgba(0,122,255,.07);
          --green:#34C759; --green-deep:#248A3D; --green-tint:rgba(52,199,89,.15);
          --red:#FF3B30; --red-tint:rgba(255,59,48,.12);
          --orange:#B25000; --orange-tint:rgba(255,149,0,.16);
          --font:-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', Roboto, sans-serif;
          --mono:ui-monospace, 'SF Mono', 'Menlo', monospace;
        }
        .app { min-height:100vh; background:var(--bg); color:var(--label); font-family:var(--font); font-size:15px; line-height:1.45; max-width:420px; margin:0 auto; padding:20px 16px 104px; }
        /* ── шапка: крупный заголовок iOS ── */
        .head { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:16px; }
        .head h1 { font-size:30px; font-weight:700; letter-spacing:-.5px; color:var(--label); }
        .head .sub { font-size:13px; font-weight:500; color:var(--label2); margin-top:2px; }
        .streak { font-size:12px; font-weight:600; color:var(--blue); background:var(--blue-tint); border-radius:999px; padding:7px 13px; white-space:nowrap; margin-top:6px; }
        /* ── группированные карточки ── */
        .card { background:var(--cell); border-radius:16px; padding:16px; margin-bottom:14px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
        .sheet { background:var(--cell); border-radius:14px; margin-bottom:14px; box-shadow:0 1px 2px rgba(0,0,0,.04); overflow:hidden; }
        .sheet .row { border-radius:0; margin:0; box-shadow:none; position:relative; }
        .sheet .row::before { content:''; position:absolute; top:0; left:60px; right:0; height:1px; background:var(--sep); }
        .sheet .row:first-child::before { display:none; }
        .progressRow { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; }
        .progressRow b { font-size:20px; font-weight:700; letter-spacing:-.3px; }
        .rank { font-size:13px; font-weight:600; color:var(--blue); font-variant-numeric:tabular-nums; }
        .bar { height:6px; background:var(--fill); border-radius:3px; overflow:hidden; }
        .bar > div { height:100%; background:var(--blue); border-radius:3px; transition:width .55s cubic-bezier(.3,.9,.4,1); }
        .todayTag { font-size:12px; font-weight:600; color:var(--blue); background:var(--blue-tint); display:inline-block; padding:4px 11px; border-radius:999px; margin-bottom:10px; }
        .taskTitle { font-size:19px; font-weight:700; letter-spacing:-.3px; margin-bottom:3px; }
        .taskDesc { color:var(--label2); font-size:14px; margin-bottom:14px; }
        /* ── кнопки iOS ── */
        .btn { display:block; width:100%; text-align:center; border-radius:13px; padding:14px; font-family:var(--font); font-size:16px; font-weight:600; cursor:pointer; border:none; transition:opacity .12s, transform .12s; }
        .btn:active { transform:scale(.98); opacity:.85; }
        .btn:disabled { opacity:.4; cursor:default; }
        .btnDark { background:var(--blue); color:#FFF; margin-bottom:9px; }
        .btnLine { background:var(--blue-tint); color:var(--blue); }
        .btnSmall { width:auto; padding:8px 14px; font-size:14px; border-radius:999px; }
        /* ── списки ── */
        .moduleHead { font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:var(--label2); margin:22px 16px 8px; }
        .row { display:flex; align-items:center; gap:13px; background:var(--cell); border-radius:14px; padding:12px 16px; margin-bottom:9px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
        .row.lockedRow { opacity:.5; }
        .row.todayRow { background:linear-gradient(0deg,var(--blue-tint2),var(--blue-tint2)), var(--cell); }
        .num { width:31px; height:31px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:600; background:var(--fill); color:#6C6C70; font-variant-numeric:tabular-nums; }
        .row.doneRow .num { background:var(--blue); color:#FFF; }
        .rowTitle { font-weight:600; font-size:15px; letter-spacing:-.1px; }
        .rowDesc { font-size:13px; color:var(--label2); margin-top:1px; }
        /* ── отметка «зачтено» ── */
        .stamp { flex:none; font-size:12px; font-weight:600; color:var(--green-deep); background:var(--green-tint); border-radius:999px; padding:5px 11px; }
        .stamp::before { content:'✓ '; }
        .stamp.fresh { animation:popIn .4s cubic-bezier(.2,1.6,.4,1); }
        @keyframes popIn { 0%{transform:scale(.3); opacity:0;} 100%{transform:scale(1); opacity:1;} }
        @media (prefers-reduced-motion: reduce){ .stamp.fresh{animation:none;} .bar > div{transition:none;} .toast{animation:none;} }
        .muted { flex:none; font-size:13px; color:var(--label3); }
        .badge { flex:none; font-size:12px; font-weight:600; border-radius:999px; padding:5px 11px; }
        .bGreen { background:var(--green-tint); color:var(--green-deep); }
        .bAmber { background:var(--orange-tint); color:var(--orange); }
        .bGray { background:var(--fill); color:#6C6C70; }
        .bViolet { background:var(--blue-tint); color:var(--blue); }
        .bRed { background:var(--red-tint); color:var(--red); }
        .diploma { text-align:center; padding:26px 16px; }
        .diploma h2 { font-size:22px; font-weight:700; letter-spacing:-.4px; margin-bottom:6px; }
        .diploma div { color:var(--label2); font-size:14px; }
        .tabTitle { font-size:22px; font-weight:700; letter-spacing:-.4px; margin:4px 2px 14px; display:flex; justify-content:space-between; align-items:center; }
        /* ── нижняя панель: стекло ── */
        .nav { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:420px; background:rgba(249,249,251,.82); -webkit-backdrop-filter:saturate(1.8) blur(20px); backdrop-filter:saturate(1.8) blur(20px); border-top:1px solid rgba(0,0,0,.12); display:flex; padding:7px 2px calc(9px + env(safe-area-inset-bottom)); overflow-x:auto; z-index:5; }
        .nav button { flex:1 0 auto; min-width:56px; background:none; border:none; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; font-family:var(--font); font-size:10px; font-weight:500; color:var(--label2); padding:4px 2px; }
        .nav button.on { color:var(--blue); font-weight:600; }
        .nav button.adm { color:var(--label3); }
        .nav button.adm.on { color:var(--blue); }
        .nav .ic { font-size:20px; }
        .navDiv { flex:none; width:1px; background:var(--sep); margin:6px 4px; }
        .note { text-align:center; font-size:12px; color:var(--label3); margin-top:18px; }
        .impRow { display:flex; gap:13px; align-items:flex-start; }
        .impRow .ic2 { font-size:24px; flex:none; margin-top:1px; }
        /* ── режим владельца: ячейка с iOS-переключателем ── */
        .edToggle { display:flex; align-items:center; gap:8px; background:var(--cell); color:var(--label); border-radius:14px; padding:13px 16px; margin-bottom:14px; cursor:pointer; user-select:none; font-size:15px; font-weight:600; box-shadow:0 1px 2px rgba(0,0,0,.04); }
        .edToggle.on { color:var(--label); }
        .edToggle .sw { margin-left:auto; width:48px; height:29px; border-radius:999px; background:var(--fill); position:relative; flex:none; transition:background .2s; }
        .edToggle.on .sw { background:var(--green); }
        .edToggle .sw::after { content:''; position:absolute; top:2px; left:2px; width:25px; height:25px; border-radius:50%; background:#FFF; box-shadow:0 2px 5px rgba(0,0,0,.25); transition:left .2s cubic-bezier(.3,.9,.4,1); }
        .edToggle.on .sw::after { left:21px; }
        .edCard { background:var(--cell); border-radius:14px; padding:14px; margin-bottom:9px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
        .edCard input, .edCard select, .edCard textarea, .tabChip input { width:100%; font-family:var(--font); font-size:15px; border:none; border-radius:10px; padding:11px 13px; margin-top:6px; background:var(--fill2); color:var(--label); appearance:none; }
        .edCard input:focus, .edCard select:focus, .edCard textarea:focus, .tabChip input:focus, .chatRow input:focus { outline:2px solid var(--blue); outline-offset:0; }
        .edCard textarea { resize:vertical; min-height:64px; }
        .edLabel { font-size:12px; font-weight:500; color:var(--label2); margin-top:11px; margin-left:2px; }
        .edRowTop { display:flex; align-items:center; gap:10px; cursor:pointer; }
        .edRowTop .grow { flex:1; min-width:0; }
        .edRowTop .grow .rowTitle { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .edDel { margin-left:auto; flex:none; background:var(--red-tint); color:var(--red); border:none; border-radius:999px; padding:7px 12px; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--font); }
        .edDel.armed { background:var(--red); color:#FFF; }
        .edAdd { display:block; width:100%; text-align:center; background:var(--cell); color:var(--blue); border:none; border-radius:14px; padding:14px; font-weight:600; font-size:15px; cursor:pointer; margin:4px 0 10px; font-family:var(--font); box-shadow:0 1px 2px rgba(0,0,0,.04); }
        .edAdd:active { opacity:.7; }
        .edSection { font-size:17px; font-weight:700; letter-spacing:-.2px; margin:22px 2px 8px; color:var(--label); }
        .edHint { font-size:13px; color:var(--label2); margin:2px 2px 12px; }
        .edHint b { color:var(--label); font-weight:600; }
        .arrows { display:flex; flex-direction:column; gap:3px; flex:none; }
        .arrows button { background:var(--fill); border:none; border-radius:6px; width:27px; height:20px; font-size:9px; color:#6C6C70; cursor:pointer; line-height:1; }
        .arrows button:active { background:var(--sep); }
        .tabChip { display:flex; align-items:center; gap:8px; background:var(--cell); border-radius:12px; padding:9px 11px; margin-bottom:8px; box-shadow:0 1px 2px rgba(0,0,0,.04); }
        .tabChip input { margin-top:0; flex:1; }
        .tabChip .iconMini { width:52px; flex:none; text-align:center; margin-top:0; }
        .iconPick { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:6px; }
        .iconBox { width:56px !important; text-align:center; margin-top:0 !important; flex:none; }
        .emoji { background:var(--fill2); border:none; border-radius:8px; font-size:17px; padding:5px 8px; cursor:pointer; }
        .emoji:active { background:var(--blue-tint); }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
        .jsonBox { width:100%; font-family:var(--mono); font-size:11px; border:none; border-radius:10px; padding:10px; background:var(--fill2); color:var(--label); min-height:110px; margin-top:6px; }
        .okMsg { font-size:13px; color:var(--green-deep); font-weight:600; margin-top:6px; }
        .errMsg { font-size:13px; color:var(--red); font-weight:600; margin-top:6px; }
        .chevron { flex:none; font-size:11px; color:var(--label3); transition:transform .15s; }
        .chevron.open { transform:rotate(180deg); }
        /* ── панель владельца ── */
        .statGrid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:9px; margin-bottom:13px; }
        .statBox { background:var(--cell); border-radius:14px; padding:14px 8px; text-align:center; box-shadow:0 1px 2px rgba(0,0,0,.04); }
        .statBox b { display:block; font-size:24px; font-weight:700; letter-spacing:-.5px; font-variant-numeric:tabular-nums; }
        .statBox span { font-size:11px; font-weight:500; color:var(--label2); }
        .miniBar { height:5px; background:var(--fill); border-radius:3px; overflow:hidden; margin-top:6px; }
        .miniBar > div { height:100%; background:var(--blue); border-radius:3px; }
        .viewChip { font-size:12px; font-weight:500; color:#6C6C70; background:var(--fill); border-radius:999px; padding:3px 10px; margin:4px 4px 0 0; display:inline-block; }
        .toast { position:fixed; bottom:86px; left:50%; transform:translateX(-50%); max-width:380px; width:calc(100% - 44px); background:rgba(28,28,30,.94); -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); color:#FFF; font-size:13px; font-weight:500; border-radius:14px; padding:13px 16px; z-index:20; animation:toastIn .3s cubic-bezier(.3,1.2,.4,1); box-shadow:0 10px 30px rgba(0,0,0,.25); }
        @keyframes toastIn { 0%{opacity:0; transform:translate(-50%,10px) scale(.96);} 100%{opacity:1; transform:translate(-50%,0) scale(1);} }
        /* ── ИИ-чат: iMessage ── */
        .chat { display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
        .msg { max-width:82%; border-radius:18px; padding:10px 15px; font-size:15px; white-space:pre-wrap; letter-spacing:-.1px; }
        .msgU { align-self:flex-end; background:var(--blue); color:#FFF; border-bottom-right-radius:5px; }
        .msgA { align-self:flex-start; background:var(--fill); color:var(--label); border-bottom-left-radius:5px; }
        .msgA.think { color:var(--label2); font-style:italic; }
        .qchips { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:12px; }
        .qchip { background:var(--cell); border:1px solid var(--sep); border-radius:999px; font-size:13px; font-weight:500; color:var(--blue); padding:9px 14px; cursor:pointer; font-family:var(--font); }
        .qchip:active { background:var(--blue-tint); border-color:transparent; }
        .chatRow { display:flex; gap:8px; }
        .chatRow input { flex:1; font-family:var(--font); font-size:15px; border:1px solid var(--sep); border-radius:999px; padding:12px 17px; background:var(--cell); color:var(--label); }
        .chatRow input::placeholder { color:var(--label3); }
        .chatSend { flex:none; background:var(--blue); color:#FFF; border:none; border-radius:50%; width:46px; height:46px; font-size:17px; cursor:pointer; }
        .chatSend:disabled { opacity:.4; }
      `}</style>

      <div className="head">
        <div>
          <h1>{settings.title}</h1>
          <div className="sub">{settings.subtitle} · {rank}</div>
        </div>
        <div className="streak">{settings.streak}</div>
      </div>

      {/* Переключатель режима владельца — виден только владельцу (сервер выдаёт право по user_id) */}
      {isOwner && (
        <div className={`edToggle ${editor ? "on" : ""}`} onClick={toggleOwner}>
          <span>👑 Режим владельца {editor ? "включён" : "выключен"}</span>
          <div className="sw" />
        </div>
      )}
      {editor && !ADMIN_IDS.includes(tab) && <div className="edHint">Обычные вкладки теперь редактируются. Внизу появились твои: 📊 Статистика, 🤖 ИИ и 📣 Рассылка.</div>}

      {editor && dirty && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", background: "rgba(255,149,0,.1)" }}>
          <span style={{ fontSize: 19 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rowTitle" style={{ fontSize: 14 }}>Есть неопубликованные изменения</div>
            <div className="rowDesc">Ученики их не видят, пока не нажмёшь кнопку</div>
          </div>
          <button className="btn btnLine btnSmall" onClick={publish} disabled={publishState === "saving"}>
            {publishState === "saving" ? "…" : "Опубликовать"}
          </button>
        </div>
      )}

      {/* ════════ ЭКРАН ОЖИДАНИЯ (заявка не одобрена) ════════ */}
      {locked && (
        <div className="card" style={{ textAlign: "center", padding: "38px 22px" }}>
          <div style={{ fontSize: 46, marginBottom: 12 }}>{requireTelegram ? "✈️" : access === "pending" ? "⏳" : "🔒"}</div>
          <div className="taskTitle">{requireTelegram ? "Откройте через Telegram" : access === "pending" ? "Заявка отправлена" : "Доступ закрыт"}</div>
          <div className="rowDesc" style={{ marginTop: 8, fontSize: 14 }}>
            {requireTelegram
              ? "Это приложение работает только внутри Telegram. Откройте чат с ботом курса и нажмите кнопку «Открыть дневник»."
              : access === "pending"
              ? "Владелец курса рассмотрит вашу заявку. Как только доступ откроют — бот пришлёт сообщение, и здесь появятся уроки."
              : "Владелец курса не открыл вам доступ. Если это ошибка — напишите ему напрямую."}
          </div>
        </div>
      )}

      {/* ════════ ДНЕВНИК ════════ */}
      {tab === "diary" && !editor && (
        <div>
          <div className="card">
            <div className="progressRow">
              <b>Этап {Math.min(doneCount + 1, Math.max(total, 1))} из {total}</b>
              <span className="rank">{pct}%</span>
            </div>
            <div className="bar"><div style={{ width: `${pct}%` }} /></div>
          </div>

          {current ? (
            <div className="card">
              <span className="todayTag">Задача на сегодня</span>
              <div className="taskTitle">День {num(current.id)}. {current.title}</div>
              <div className="taskDesc">{current.desc}</div>
              <button className="btn btnDark" onClick={() => openLesson(current)}>Открыть урок {num(current.id)}</button>
              <button className="btn btnLine" onClick={() => complete(current.id)}>Отметить выполненной</button>
            </div>
          ) : total > 0 ? (
            <div className="card diploma">
              <h2>Курс пройден!</h2>
              <div>Все {total} этапов зачтены. Диплом отправлен вам в чат с ботом.</div>
            </div>
          ) : (
            <div className="card"><div className="rowTitle">Пока нет уроков</div><div className="rowDesc">Включи режим владельца и добавь первый урок на вкладке «Уроки».</div></div>
          )}

          {modules.map((mod) => {
            const modDays = days.filter((x) => x.m === mod.id);
            if (!modDays.length) return null;
            return (
              <div key={mod.id}>
                <div className="moduleHead">{mod.name}</div>
                <div className="sheet">
                {modDays.map((day) => {
                  const st = rowState(day.id);
                  return (
                    <div key={day.id} className={`row ${st === "done" ? "doneRow" : st === "today" ? "todayRow" : "lockedRow"}`}
                      onClick={() => (done.has(day.id) ? uncomplete(day.id) : null)} style={{ cursor: done.has(day.id) ? "pointer" : "default" }}>
                      <div className="num">{num(day.id)}</div>
                      <div style={{ flex: 1 }}>
                        <div className="rowTitle">{day.type === "exam" ? "📝 " : ""}{day.title}</div>
                        <div className="rowDesc">{day.desc}</div>
                      </div>
                      {st === "done" && <div className={`stamp ${justStamped === day.id ? "fresh" : ""}`}>{settings.stamp}</div>}
                      {st === "today" && <div className="muted">сегодня</div>}
                      {st === "locked" && <div className="muted">🔒</div>}
                    </div>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════ РЕДАКТОР: ШАПКА + МОДУЛИ ════════ */}
      {tab === "diary" && editor && (
        <div>
          <div className="edSection">Шапка приложения</div>
          <div className="edCard">
            <Field label="Название"><input value={settings.title} onChange={(e) => updSetting("title", e.target.value)} /></Field>
            <Field label="Подзаголовок"><input value={settings.subtitle} onChange={(e) => updSetting("subtitle", e.target.value)} /></Field>
            <div className="grid2">
              <Field label="Плашка справа"><input value={settings.streak} onChange={(e) => updSetting("streak", e.target.value)} /></Field>
              <Field label="Текст штампа"><input value={settings.stamp} onChange={(e) => updSetting("stamp", e.target.value)} /></Field>
            </div>
            <Field label="Звание выпускника"><input value={settings.graduateRank} onChange={(e) => updSetting("graduateRank", e.target.value)} /></Field>
          </div>

          <div className="edSection">Модули и звания</div>
          <div className="edHint">Звание ученика растёт по мере прохождения. Уроки распределяются по модулям на вкладке «Уроки».</div>
          {modules.map((mod, i) => (
            <div key={mod.id} className="edCard">
              <div className="edRowTop">
                <Arrows onUp={() => setModules((p) => arrMove(p, i, -1))} onDown={() => setModules((p) => arrMove(p, i, 1))} />
                <div className="grow"><div className="rowDesc">{days.filter((d) => d.m === mod.id).length} урок(ов)</div></div>
                <DelBtn k={`mod:${mod.id}`} armed={armed} armOrRun={armOrRun} onRun={() => delModule(mod.id)} />
              </div>
              <Field label="Название модуля"><input value={mod.name} onChange={(e) => updModule(mod.id, { name: e.target.value })} /></Field>
              <Field label="Звание за этот этап"><input value={mod.rank} onChange={(e) => updModule(mod.id, { rank: e.target.value })} /></Field>
            </div>
          ))}
          <button className="edAdd" onClick={addModule}>+ Добавить модуль</button>
        </div>
      )}

      {/* ════════ УРОКИ ════════ */}
      {tab === "lessons" && !editor && (
        <div>
          <div className="tabTitle">Уроки</div>
          <div className="sheet">
          {days.map((day) => {
            const st = rowState(day.id);
            const seen = viewed.has(day.id);
            return (
              <div key={day.id} className={`row ${st === "locked" ? "lockedRow" : ""}`}
                onClick={() => st !== "locked" && openLesson(day)} style={{ cursor: st !== "locked" ? "pointer" : "default" }}>
                <div className="num">{num(day.id)}</div>
                <div style={{ flex: 1 }}>
                  <div className="rowTitle">{day.title}</div>
                  <div className="rowDesc">{seen ? "Просмотрен ✓" : st === "locked" ? "Откроется позже" : "Нажми — бот пришлёт урок в чат"}</div>
                </div>
                {st !== "locked"
                  ? <button className="btn btnLine btnSmall" onClick={(e) => { e.stopPropagation(); openLesson(day); }}>▶ Смотреть</button>
                  : <div className="muted">🔒</div>}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* ════════ РЕДАКТОР УРОКОВ ════════ */}
      {tab === "lessons" && editor && (
        <div>
          <div className="tabTitle">Редактор уроков</div>
          <div className="edHint">Тапни по уроку, чтобы раскрыть. Стрелками меняешь порядок — номера пересчитаются сами.</div>
          {days.map((day, i) => {
            const open = openCard === day.id;
            return (
              <div key={day.id} className="edCard">
                <div className="edRowTop" onClick={() => setOpenCard(open ? null : day.id)}>
                  <Arrows onUp={() => moveDay(i, -1)} onDown={() => moveDay(i, 1)} />
                  <div className="num">{i + 1}</div>
                  <div className="grow">
                    <div className="rowTitle">{day.title}</div>
                    <div className="rowDesc">{typeName[day.type]} · {(modules.find((m) => m.id === day.m) || {}).name || "без модуля"}</div>
                  </div>
                  <span className={`chevron ${open ? "open" : ""}`}>▼</span>
                </div>
                {open && (
                  <div>
                    <div className="grid2">
                      <Field label="Модуль">
                        <select value={day.m} onChange={(e) => updDay(day.id, { m: e.target.value })}>
                          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Тип занятия">
                        <select value={day.type} onChange={(e) => updDay(day.id, { type: e.target.value })}>
                          <option value="lesson">Урок</option>
                          <option value="practice">Практика</option>
                          <option value="exam">Контроль</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Название"><input value={day.title} onChange={(e) => updDay(day.id, { title: e.target.value })} /></Field>
                    <Field label="Описание"><textarea value={day.desc} onChange={(e) => updDay(day.id, { desc: e.target.value })} /></Field>
                    <Field label="Домашнее задание"><input value={day.hw} onChange={(e) => updDay(day.id, { hw: e.target.value })} /></Field>
                    <button className="btn btnLine btnSmall" style={{ width: "100%", marginTop: 10 }} onClick={() => uploadVideo(day)}>
                      🎬 {day.link && day.link.startsWith("tg-video:") ? "Видео прикреплено · заменить" : "Загрузить видео"}
                    </button>
                    <div className="edHint" style={{ marginTop: 6 }}>Нажми — бот попросит прислать видео в чат и сам впишет его в этот урок. Ученику оно придёт с защитой от пересылки и скачивания.</div>
                    <Field label="Или ссылка на видео/пост"><input placeholder="https://… (если видео не в Telegram)" value={day.link && day.link.startsWith("tg-video:") ? "" : day.link} onChange={(e) => updDay(day.id, { link: e.target.value })} /></Field>
                    <div style={{ display: "flex", marginTop: 10 }}>
                      <DelBtn k={`day:${day.id}`} armed={armed} armOrRun={armOrRun} onRun={() => delDay(day.id)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button className="edAdd" onClick={() => addDay()}>+ Добавить урок</button>
        </div>
      )}

      {/* ════════ ДЗ ════════ */}
      {tab === "hw" && !editor && (
        <div>
          <div className="tabTitle">Домашние задания</div>
          <div className="sheet">
          {days.map((day) => {
            const st = rowState(day.id);
            const available = st !== "locked";
            return (
              <div key={day.id} className={`row ${st === "locked" ? "lockedRow" : ""}`}
                onClick={() => available && sendHw(day)} style={{ cursor: available ? "pointer" : "default" }}>
                <div className="num">{num(day.id)}</div>
                <div style={{ flex: 1 }}>
                  <div className="rowTitle">{day.hw}</div>
                  <div className="rowDesc">{st === "done" ? "Урок пройден" : available ? "Нажми — бот пришлёт ДЗ в чат" : `К уроку «${day.title}»`}</div>
                </div>
                {available
                  ? <button className="btn btnLine btnSmall" onClick={(e) => { e.stopPropagation(); sendHw(day); }}>📩 В чат</button>
                  : <span className="badge bGray">Позже</span>}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {tab === "hw" && editor && (
        <div>
          <div className="tabTitle">Редактор ДЗ</div>
          <div className="edHint">Быстрая правка заданий. Всё остальное про урок — в редакторе на вкладке «Уроки».</div>
          {days.map((day) => (
            <div key={day.id} className="edCard">
              <div className="edRowTop">
                <div className="num">{num(day.id)}</div>
                <div className="grow"><div className="rowDesc">{day.title}</div></div>
              </div>
              <input value={day.hw} onChange={(e) => updDay(day.id, { hw: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {/* ════════ ПРАКТИКА ════════ */}
      {tab === "practice" && !editor && (
        <div>
          <div className="tabTitle">Практика</div>
          <div className="sheet">
          {days.filter((x) => x.type === "practice" || x.type === "exam").map((day) => {
            const st = rowState(day.id);
            return (
              <div key={day.id} className={`row ${st === "locked" ? "lockedRow" : ""}`}>
                <div className="num">{num(day.id)}</div>
                <div style={{ flex: 1 }}>
                  <div className="rowTitle">{day.type === "exam" ? "📝 " : "⚡ "}{day.title}</div>
                  <div className="rowDesc">{day.hw}</div>
                </div>
                {st === "done" && <span className="badge bViolet">Зачтено</span>}
                {st === "today" && <span className="badge bAmber">В работе</span>}
                {st === "locked" && <span className="badge bGray">Позже</span>}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {tab === "practice" && editor && (
        <div>
          <div className="tabTitle">Редактор практики</div>
          <div className="edHint">Сюда попадают занятия с типом «Практика» и «Контроль». Переключай тип прямо здесь.</div>
          {days.map((day) => (
            <div key={day.id} className="edCard">
              <div className="edRowTop">
                <div className="num">{num(day.id)}</div>
                <div className="grow"><div className="rowTitle">{day.title}</div></div>
                <select value={day.type} onChange={(e) => updDay(day.id, { type: e.target.value })} style={{ width: "auto", marginTop: 0, flex: "none" }}>
                  <option value="lesson">Урок</option>
                  <option value="practice">Практика</option>
                  <option value="exam">Контроль</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════ РАСПИСАНИЕ ════════ */}
      {tab === "schedule" && !editor && (
        <div>
          <div className="tabTitle">Расписание созвонов</div>
          <div className="sheet">
          {days.map((day, i) => {
            const st = dateStatus(i);
            return (
              <div key={day.id} className={`row ${st === "today" ? "todayRow" : ""}`}>
                <div className="num">{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div className="rowTitle">{fmtDate(i)} · {lessonTime(i)}</div>
                  <div className="rowDesc">Тема: {day.title}</div>
                </div>
                {st === "past" && <button className="btn btnLine btnSmall" onClick={() => openLesson(day)}>Запись</button>}
                {st === "today" && <span className="badge bAmber">Сегодня</span>}
                {st === "future" && <span className="badge bGray">Скоро</span>}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {tab === "schedule" && editor && (
        <div>
          <div className="tabTitle">Редактор графика</div>
          <div className="edHint">Поставь дату и время каждому занятию вручную. Если у урока дата не задана — она посчитается автоматически от старта и интервала ниже.</div>

          {days.map((day, i) => (
            <div key={day.id} className="edCard">
              <div className="edRowTop">
                <div className="num">{i + 1}</div>
                <div className="grow"><div className="rowTitle">{day.title}</div>
                  <div className="rowDesc">{day.date ? "Дата задана вручную" : "Дата авто: " + fmtDate(i)}</div>
                </div>
              </div>
              <div className="grid2">
                <Field label="Дата занятия"><input type="date" value={day.date || ""} onChange={(e) => updDay(day.id, { date: e.target.value })} /></Field>
                <Field label="Время"><input placeholder={settings.time} value={day.time || ""} onChange={(e) => updDay(day.id, { time: e.target.value })} /></Field>
              </div>
              {(day.date || day.time) && (
                <button className="edDel" style={{ marginTop: 8 }} onClick={() => updDay(day.id, { date: "", time: "" })}>Сбросить на авто</button>
              )}
            </div>
          ))}

          <div className="edSection">Авторасчёт (для незаданных дат)</div>
          <div className="edHint">Используется только там, где ты не проставил дату вручную.</div>
          <div className="edCard">
            <div className="grid2">
              <Field label="Дата старта"><input type="date" value={settings.startDate} onChange={(e) => updSetting("startDate", e.target.value)} /></Field>
              <Field label="Время по умолчанию"><input value={settings.time} onChange={(e) => updSetting("time", e.target.value)} /></Field>
            </div>
            <Field label="Интервал между занятиями (дней)"><input type="number" min="1" value={settings.interval} onChange={(e) => updSetting("interval", e.target.value)} /></Field>
          </div>
        </div>
      )}

      {/* ════════ ВАЖНОЕ ════════ */}
      {tab === "important" && !editor && (
        <div>
          <div className="tabTitle">Важное</div>
          {important.map((item) => (
            <div key={item.id} className="card impRow" style={{ cursor: "pointer" }} onClick={() => openImp(item)}>
              <div className="ic2">{item.icon}</div>
              <div>
                <div className="rowTitle">{item.title}</div>
                <div className="rowDesc">{item.desc}</div>
              </div>
            </div>
          ))}
          {!important.length && <div className="card"><div className="rowDesc">Раздел пуст — наполни его в режиме владельца.</div></div>}
        </div>
      )}

      {tab === "important" && editor && (
        <div>
          <div className="tabTitle">Редактор «Важного»</div>
          {important.map((item, i) => (
            <div key={item.id} className="edCard">
              <div className="edRowTop">
                <Arrows onUp={() => setImportant((p) => arrMove(p, i, -1))} onDown={() => setImportant((p) => arrMove(p, i, 1))} />
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div className="grow"><div className="rowTitle">{item.title}</div></div>
                <DelBtn k={`imp:${item.id}`} armed={armed} armOrRun={armOrRun} onRun={() => setImportant((p) => p.filter((x) => x.id !== item.id))} />
              </div>
              <Field label="Иконка"><IconInput value={item.icon} onChange={(v) => updImp(item.id, { icon: v })} /></Field>
              <Field label="Заголовок"><input value={item.title} onChange={(e) => updImp(item.id, { title: e.target.value })} /></Field>
              <Field label="Описание"><input value={item.desc} onChange={(e) => updImp(item.id, { desc: e.target.value })} /></Field>
              <Field label="Ссылка (куда ведёт карточка)"><input placeholder="https://t.me/..." value={item.link} onChange={(e) => updImp(item.id, { link: e.target.value })} /></Field>
            </div>
          ))}
          <button className="edAdd" onClick={addImp}>+ Добавить раздел</button>
        </div>
      )}

      {/* ════════ 📊 СТАТИСТИКА (владелец) ════════ */}
      {tab === "stats" && editor && (
        <div>
          <div className="tabTitle">Статистика потока</div>
          <div className="statGrid">
            <div className="statBox"><b>{students.length}</b><span>{plural(students.length, "ученик", "ученика", "учеников")}</span></div>
            <div className="statBox"><b>{avgPct}%</b><span>ср. прогресс</span></div>
            <div className="statBox"><b style={{ color: laggards.length ? "#C0392B" : "#2F7D3B" }}>{laggards.length}</b><span>отстают</span></div>
          </div>
          <div className="edHint">По расписанию к сегодняшнему дню должно быть пройдено уроков: <b>{expectedIdx} из {total}</b>. Отстающим считается тот, кто позади графика на 2+ урока.</div>

          {(serverStudents || []).filter((s) => s.status === "pending").length > 0 && (
            <div>
              <div className="edSection">Заявки на доступ</div>
              {(serverStudents || []).filter((s) => s.status === "pending").map((s) => (
                <div key={s.id} className="row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rowTitle">{s.name}{s.username ? " @" + s.username : ""}</div>
                    <div className="rowDesc">Хочет присоединиться к курсу</div>
                  </div>
                  <button className="btn btnLine btnSmall" onClick={() => decide(s.id, "approved")}>Принять</button>
                  <button className="edDel" style={{ marginLeft: 0 }} onClick={() => decide(s.id, "rejected")}>Нет</button>
                </div>
              ))}
            </div>
          )}

          <div className="edSection">Ученики</div>
          {serverStudents && !serverStudents.length && (
            <div className="card"><div className="rowTitle">Пока никого</div><div className="rowDesc" style={{ marginTop: 4 }}>Отправь ученикам ссылку на бота — каждый, кто нажмёт /start, появится здесь автоматически.</div></div>
          )}
          <div className="sheet">
          {students.map((s) => {
            const st = studentStats(s);
            const [label, cls] = statusBadge[st.status];
            return (
              <div key={s.id} className="row" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="rowTitle">{s.name}</div>
                  <div className="rowDesc">Зачтено {st.d}/{total} · Просмотрено {st.v}/{total} · Был(а): {s.active}</div>
                  <MiniBar value={st.pct} />
                </div>
                <span className={`badge ${cls}`} style={{ marginTop: 2 }}>{label}</span>
              </div>
            );
          })}
          </div>

          <div className="edSection">Просмотры по урокам</div>
          <div className="edHint">Тапни по уроку — увидишь, кто ещё не посмотрел.</div>
          {days.map((day, i) => {
            const seen = lessonViewers(day.id);
            const notSeen = students.filter((s) => !s.viewedSet.has(day.id));
            const open = expandLesson === day.id;
            const p = students.length ? Math.round((seen.length / students.length) * 100) : 0;
            return (
              <div key={day.id} className="card" style={{ padding: "11px 13px", cursor: "pointer" }} onClick={() => setExpandLesson(open ? null : day.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="num">{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rowTitle" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{day.title}</div>
                    <div className="rowDesc">Посмотрели {seen.length} из {students.length} · {p}%</div>
                    <MiniBar value={p} />
                  </div>
                  <span className={`chevron ${open ? "open" : ""}`}>▼</span>
                </div>
                {open && (
                  <div style={{ marginTop: 8 }}>
                    {notSeen.length
                      ? <div><div className="edLabel">Не посмотрели</div>{notSeen.map((s) => <span key={s.id} className="viewChip">{s.name}</span>)}</div>
                      : <div className="okMsg">Все посмотрели этот урок ✓</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ════════ 🤖 ИИ-ПОМОЩНИК (владелец) ════════ */}
      {tab === "ai" && editor && (
        <div>
          <div className="tabTitle">ИИ-помощник</div>
          <div className="edHint">Ассистент видит всю статистику курса: уроки, просмотры, прогресс каждого ученика. Спрашивай своими словами.</div>

          {!aiMsgs.length && (
            <div className="qchips">
              {AI_QUICK.map((q) => <button key={q} className="qchip" onClick={() => askAI(q)}>{q}</button>)}
            </div>
          )}

          <div className="chat">
            {aiMsgs.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "msgU" : "msgA"}`}>{m.content}</div>
            ))}
            {aiLoading && <div className="msg msgA think">Анализирую данные курса…</div>}
            <div ref={chatEndRef} />
          </div>

          {aiMsgs.length > 0 && !aiLoading && (
            <div className="qchips">
              {AI_QUICK.filter((q) => !aiMsgs.some((m) => m.content === q)).slice(0, 2).map((q) => (
                <button key={q} className="qchip" onClick={() => askAI(q)}>{q}</button>
              ))}
            </div>
          )}

          <div className="chatRow">
            <input placeholder="Например: кто отстаёт и почему?" value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askAI()} />
            <button className="chatSend" onClick={() => askAI()} disabled={aiLoading || !aiInput.trim()}>➤</button>
          </div>
        </div>
      )}

      {/* ════════ 📣 РАССЫЛКА (владелец) ════════ */}
      {tab === "cast" && editor && (
        <div>
          <div className="tabTitle">Рассылка ученикам</div>
          <div className="edCard">
            <Field label="Кому отправить">
              <select value={castAud} onChange={(e) => setCastAud(e.target.value)}>
                <option value="all">Всем ученикам</option>
                <option value="lagging">Только отстающим</option>
                <option value="notviewed">Не посмотревшим урок…</option>
              </select>
            </Field>
            {castAud === "notviewed" && (
              <Field label="Какой урок">
                <select value={castLesson || (days[0] && days[0].id) || ""} onChange={(e) => setCastLesson(e.target.value)}>
                  {days.map((d, i) => <option key={d.id} value={d.id}>Урок {i + 1} · {d.title}</option>)}
                </select>
              </Field>
            )}
            <Field label="Текст сообщения">
              <textarea placeholder="Например: Напоминаю — сегодня в 19:00 созвон по уроку 5. Кто ещё не посмотрел урок 4, догоняйте!" value={castText} onChange={(e) => setCastText(e.target.value)} style={{ minHeight: 80 }} />
            </Field>
            <div className="edHint" style={{ marginTop: 8 }}>
              Получателей сейчас: <b>{castRecipients().length}</b> ({castAudLabel().toLowerCase()})
            </div>
            <button className="btn btnDark" onClick={sendCast} disabled={!castText.trim() || !castRecipients().length}>Отправить рассылку</button>
          </div>

          {castHistory.length > 0 && (
            <div>
              <div className="edSection">История рассылок</div>
              {castHistory.map((c) => (
                <div key={c.id} className="card" style={{ padding: "11px 13px" }}>
                  <div className="rowDesc" style={{ marginBottom: 4 }}>{c.time} · {c.audience} · {c.count} {plural(c.count, "получатель", "получателя", "получателей")}</div>
                  <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{c.text}</div>
                </div>
              ))}
            </div>
          )}
          <div className="note">В реальном боте сообщение уходит каждому в личный чат от имени бота.</div>
        </div>
      )}

      {/* ════════ КАСТОМНЫЕ ВКЛАДКИ ════════ */}
      {isCustom(tab) && tabs.some((t) => t.id === tab) && !editor && (
        <div>
          <div className="tabTitle">{tabs.find((t) => t.id === tab).label}</div>
          {tabBlocks(tab).map((b) => b.kind === "link" ? (
            <button key={b.id} className="btn btnLine" style={{ marginBottom: 8 }}
              onClick={() => (b.url ? openUrl(b.url) : alert("У кнопки пока нет ссылки — добавь её в режиме владельца."))}>
              {b.title}
            </button>
          ) : (
            <div key={b.id} className="card">
              <div className="rowTitle">{b.title}</div>
              <div className="rowDesc" style={{ marginTop: 4, fontSize: 13, whiteSpace: "pre-wrap" }}>{b.text}</div>
            </div>
          ))}
          {!tabBlocks(tab).length && (
            <div className="card">
              <div className="rowTitle">Пустая вкладка</div>
              <div className="rowDesc" style={{ marginTop: 6 }}>Включи режим владельца и наполни её текстами и кнопками-ссылками.</div>
            </div>
          )}
        </div>
      )}

      {isCustom(tab) && tabs.some((t) => t.id === tab) && editor && (
        <div>
          <div className="tabTitle">Контент вкладки «{tabs.find((t) => t.id === tab).label}»</div>
          {tabBlocks(tab).map((b, i) => (
            <div key={b.id} className="edCard">
              <div className="edRowTop">
                <Arrows onUp={() => moveBlock(tab, i, -1)} onDown={() => moveBlock(tab, i, 1)} />
                <div className="grow"><div className="rowDesc">{b.kind === "link" ? "Кнопка-ссылка" : "Текстовый блок"}</div></div>
                <DelBtn k={`blk:${b.id}`} armed={armed} armOrRun={armOrRun} onRun={() => delBlock(tab, b.id)} />
              </div>
              <Field label={b.kind === "link" ? "Текст кнопки" : "Заголовок"}>
                <input value={b.title} onChange={(e) => updBlock(tab, b.id, { title: e.target.value })} />
              </Field>
              {b.kind === "link"
                ? <Field label="Ссылка"><input placeholder="https://..." value={b.url} onChange={(e) => updBlock(tab, b.id, { url: e.target.value })} /></Field>
                : <Field label="Текст"><textarea value={b.text} onChange={(e) => updBlock(tab, b.id, { text: e.target.value })} /></Field>}
            </div>
          ))}
          <div className="grid2">
            <button className="edAdd" onClick={() => addBlock(tab, "text")}>+ Текст</button>
            <button className="edAdd" onClick={() => addBlock(tab, "link")}>+ Кнопка-ссылка</button>
          </div>
        </div>
      )}

      {/* ════════ РЕДАКТОР: ВКЛАДКИ + ЭКСПОРТ (не показывается на вкладках владельца) ════════ */}
      {editor && !ADMIN_IDS.includes(tab) && (
        <div style={{ marginTop: 22 }}>
          <div className="edSection">Вкладки меню</div>
          <div className="edHint">Иконка — любой эмодзи. Стрелками меняешь порядок в нижнем меню. Вкладки 📊 🤖 📣 — служебные, видишь их только ты.</div>
          {tabs.map((t, i) => (
            <div key={t.id} className="tabChip">
              <Arrows onUp={() => setTabs((p) => arrMove(p, i, -1))} onDown={() => setTabs((p) => arrMove(p, i, 1))} />
              <input className="iconMini" value={t.icon} maxLength={4} onChange={(e) => updTab(t.id, { icon: e.target.value })} />
              <input value={t.label} onChange={(e) => updTab(t.id, { label: e.target.value })} />
              {t.id === "diary"
                ? <span className="muted" style={{ fontSize: 11 }}>основная</span>
                : <DelBtn k={`tab:${t.id}`} armed={armed} armOrRun={armOrRun} onRun={() => delTab(t.id)} small />}
            </div>
          ))}
          <button className="edAdd" onClick={addTab}>+ Добавить вкладку</button>

          <div className="edSection">Публикация для учеников</div>
          <div className="edHint">Главная кнопка сохранения. Нажми — и все твои изменения станут видны ученикам при следующем открытии приложения. У них — всегда готовый вариант, без режима владельца.</div>
          <button className="btn btnDark" onClick={publish} disabled={publishState === "saving"}>
            {publishState === "saving" ? "Публикую…" : publishState === "saved" ? "Опубликовано ✓" : "🚀 Опубликовать изменения ученикам"}
          </button>

          <div className="edSection">Резервная копия (JSON)</div>
          <div className="edHint">Слепок курса на всякий случай: скопируй и храни, или вставь обратно, чтобы восстановить. Публикацию это не заменяет — ученикам уходит только «Опубликовать».</div>
          <div className="edCard">
            <Field label="Текущая конфигурация (только чтение)">
              <textarea ref={jsonRef} className="jsonBox" readOnly value={exportJSON} onFocus={(e) => e.target.select()} />
            </Field>
            <button className="btn btnDark" style={{ marginTop: 10 }} onClick={copyJSON}>{copied ? "Скопировано ✓" : "Скопировать JSON"}</button>
            <Field label="Вставить сохранённый JSON">
              <textarea className="jsonBox" placeholder='{"settings": ..., "days": ...}' value={importText} onChange={(e) => { setImportText(e.target.value); setImportErr(""); }} />
            </Field>
            {importErr && <div className="errMsg">{importErr}</div>}
            <button className="btn btnLine" style={{ marginTop: 8 }} onClick={applyImport} disabled={!importText.trim()}>Применить конфигурацию</button>
          </div>

          <div className="edSection">Демо-инструменты</div>
          <button className="btn btnLine" onClick={() => { setDone(new Set()); setViewed(new Set()); }}>Сбросить прогресс демо-ученика</button>
        </div>
      )}

      {!editor && <div className="note">Прототип · включи режим владельца, чтобы редактировать курс и видеть статистику</div>}

      {toast && <div className="toast">{toast}</div>}

      {!locked && <div className="nav">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            <span className="ic">{t.icon}</span>
            {t.label}
          </button>
        ))}
        {editor && <div className="navDiv" />}
        {editor && ADMIN_TABS.map((t) => (
          <button key={t.id} className={`adm ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
            <span className="ic">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>}
    </div>
  );
}
