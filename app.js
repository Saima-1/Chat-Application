/* =========================================================
   1. SETUP: find elements and load saved data
   ========================================================= */
const MESSAGES_KEY = "chatapp.messages.v2";
const THEME_KEY = "chatapp.theme";

const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

let messages = loadFromStorage(MESSAGES_KEY, []);   // list of { id, text, sender, ts }

/* =========================================================
   2. STORAGE HELPERS (localStorage)
   try/catch is used because storage can be blocked in some browsers
   ========================================================= */
function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // ignore: the chat still works, it just will not be saved
  }
}

/* =========================================================
   3. SMALL HELPERS
   ========================================================= */

// Shortcut to create an element with a class and optional text
function createEl(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function scrollToBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

// Icons (simple SVG strings)
const ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
const ICON_DELETE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';

/* =========================================================
   4. BUILD ONE MESSAGE ON SCREEN
   Structure:  .row > ( .msg > p + time ) + ( .actions > copy + delete )
   ========================================================= */
function createMessageEl(msg) {
  const row = createEl("div", "row " + msg.sender);
  row.dataset.id = msg.id;

  // the bubble
  const bubble = createEl("div", "msg");
  const text = createEl("p", "", msg.text);        // textContent keeps typed HTML safe
  const time = createEl("time", "", formatTime(msg.ts));
  bubble.append(text, time);

  // the buttons
  const actions = createEl("div", "actions");

  const copyBtn = createEl("button", "action-btn copy");
  copyBtn.type = "button";
  copyBtn.title = "Copy message";
  copyBtn.setAttribute("aria-label", "Copy message");
  copyBtn.innerHTML = ICON_COPY;
  copyBtn.addEventListener("click", () => copyMessage(msg.text, copyBtn));

  const deleteBtn = createEl("button", "action-btn delete");
  deleteBtn.type = "button";
  deleteBtn.title = "Delete message";
  deleteBtn.setAttribute("aria-label", "Delete message");
  deleteBtn.innerHTML = ICON_DELETE;
  deleteBtn.addEventListener("click", () => deleteMessage(msg.id, row));

  actions.append(copyBtn, deleteBtn);
  row.append(bubble, actions);
  return row;
}

/* =========================================================
   5. SHOW / ADD / COPY / DELETE
   ========================================================= */
function showEmptyState() {
  const empty = createEl("div", "empty", "No messages yet. Say hello to start the conversation.");
  empty.id = "empty";
  messagesEl.appendChild(empty);
}

// Draw all saved messages (used on page load and after Clear)
function renderAll() {
  messagesEl.textContent = "";
  if (messages.length === 0) {
    showEmptyState();
    return;
  }
  messages.forEach((msg) => messagesEl.appendChild(createMessageEl(msg)));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Add a new message to the list, save it, and show it
function addMessage(text, sender) {
  const msg = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), text, sender, ts: Date.now() };
  messages.push(msg);
  saveToStorage(MESSAGES_KEY, messages);

  const empty = document.getElementById("empty");
  if (empty) empty.remove();

  messagesEl.appendChild(createMessageEl(msg));
  scrollToBottom();
}

// Copy text to clipboard and show a green tick for 1.5 seconds
async function copyMessage(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // fallback for browsers that block the clipboard API
    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }
  button.innerHTML = ICON_CHECK;
  button.classList.add("done");
  setTimeout(() => {
    button.innerHTML = ICON_COPY;
    button.classList.remove("done");
  }, 1500);
}

// Fade the message out, then remove it from the list and storage
function deleteMessage(id, row) {
  row.classList.add("removing");
  setTimeout(() => {
    row.remove();
    messages = messages.filter((msg) => msg.id !== id);
    saveToStorage(MESSAGES_KEY, messages);
    if (messages.length === 0) showEmptyState();
  }, 220);
}

/* =========================================================
   6. CHATBOT (predefined replies)
   To add a new reply: add one more { match, replies } below
   ========================================================= */
const RULES = [
  { match: /\b(hi|hello|hey|salam|assalam)\b/i, replies: ["Hello! How can I help you today?", "Hey there! What's on your mind?"] },
  { match: /\b(how are you|how's it going)\b/i, replies: ["Doing great, thanks for asking. How about you?"] },
  { match: /\b(name|who are you)\b/i, replies: ["I'm Beacon, a tiny chatbot that lives in your browser."] },
  { match: /\b(help|support)\b/i, replies: ["Try saying hello, asking my name, or asking for a joke or the time."] },
  { match: /\b(joke|funny)\b/i, replies: [
      "Why do programmers prefer dark mode? Because light attracts bugs.",
      "There are 10 kinds of people: those who know binary and those who don't."
  ] },
  { match: /\b(time|clock)\b/i, replies: [() => "It's " + formatTime(Date.now()) + " on your device."] },
  { match: /\b(bye|goodbye|see you)\b/i, replies: ["Goodbye! Your messages will be here when you get back."] },
  { match: /\b(thanks|thank you)\b/i, replies: ["Anytime!"] }
];

const FALLBACK_REPLIES = [
  "Interesting. Tell me more.",
  "I only know a few preset replies. Try typing \"help\".",
  "Hmm, I'm not sure how to answer that yet."
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getBotReply(userText) {
  const rule = RULES.find((r) => r.match.test(userText));
  const reply = rule ? pickRandom(rule.replies) : pickRandom(FALLBACK_REPLIES);
  return typeof reply === "function" ? reply() : reply;
}

// Show typing dots, then post the reply after a short delay
function botRespond(userText) {
  const typing = createEl("div", "row received");
  const dots = createEl("div", "msg typing");
  for (let i = 0; i < 3; i++) dots.appendChild(createEl("i"));
  typing.appendChild(dots);
  messagesEl.appendChild(typing);
  scrollToBottom();

  setTimeout(() => {
    typing.remove();
    addMessage(getBotReply(userText), "received");
  }, 700 + Math.random() * 700);
}

/* =========================================================
   7. THEMES (violet / ocean / sunset)
   ========================================================= */
function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.themeBtn === name);
  });
  saveToStorage(THEME_KEY, name);
}

document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.themeBtn));
});

/* =========================================================
   8. EVENTS: send, Enter key, input check, clear chat
   ========================================================= */
function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  addMessage(text, "sent");
  inputEl.value = "";
  sendBtn.disabled = true;
  inputEl.focus();
  botRespond(text);
}

sendBtn.addEventListener("click", sendMessage);

inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendMessage();
});

// Send button stays disabled while the input is empty
inputEl.addEventListener("input", () => {
  sendBtn.disabled = inputEl.value.trim() === "";
});

clearBtn.addEventListener("click", () => {
  messages = [];
  saveToStorage(MESSAGES_KEY, messages);
  renderAll();
});

/* =========================================================
   9. START
   ========================================================= */
applyTheme(loadFromStorage(THEME_KEY, "violet"));
renderAll();