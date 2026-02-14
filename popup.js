const KEYS = {
  loopEnabled: "loopEnabled",
  focusMinutes: "focusMinutes",
  darkMode: "darkMode"
};

const $ = (id) => document.getElementById(id);
const i18n = (key, substitutions) => chrome.i18n.getMessage(key, substitutions);

function sendMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(res);
    });
  });
}

$("start").onclick = async () => {
  // 設定から Focus 時間を取得
  const { focusMinutes = 25 } = await chrome.storage.local.get(["focusMinutes"]);
  await sendMessage({ type: "START_FOCUS", minutes: focusMinutes });
  await render();
};

$("stop").onclick = async () => {
  await sendMessage({ type: "STOP_FOCUS" });
  await render();
};

$("settings").onclick = () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
};

// ループトグル
$("loop-toggle").onclick = async () => {
  const { loopEnabled = false } = await chrome.storage.local.get([KEYS.loopEnabled]);
  const newValue = !loopEnabled;
  await chrome.storage.local.set({ [KEYS.loopEnabled]: newValue });
  await updateLoopUI(newValue);
};

// ダークモードトグル
$("dark-mode-toggle").onclick = async () => {
  const { darkMode = false } = await chrome.storage.local.get([KEYS.darkMode]);
  const newValue = !darkMode;
  await chrome.storage.local.set({ [KEYS.darkMode]: newValue });
  await updateDarkModeUI(newValue);
};

// ダークモードUI更新
async function updateDarkModeUI(enabled) {
  const icon = $("dark-mode-icon");
  
  if (enabled) {
    document.body.classList.add("dark-mode");
    icon.textContent = "☀️";
  } else {
    document.body.classList.remove("dark-mode");
    icon.textContent = "🌙";
  }
}

// ダークモード初期化（最初に1回だけ実行）
async function initDarkMode() {
  const { darkMode = false } = await chrome.storage.local.get([KEYS.darkMode]);
  await updateDarkModeUI(darkMode);
}

// ループUI更新
async function updateLoopUI(enabled) {
  const btn = $("loop-toggle");
  const indicator = $("flow-loop-indicator");
  const text = $("loop-text");
  
  if (enabled) {
    btn.classList.add("enabled");
    if (indicator) indicator.classList.add("enabled");
    text.textContent = i18n("loopOn");
  } else {
    btn.classList.remove("enabled");
    if (indicator) indicator.classList.remove("enabled");
    text.textContent = i18n("loopOff");
  }
}

// Start button更新
function updateStartButton(focusMinutes) {
  $("start").textContent = i18n("startButton", [String(focusMinutes)]);
}


function formatMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function render() {
  try {
    const res = await sendMessage({ type: "GET_STATE" });

    // ループ設定の読み込み
    const { loopEnabled = false } = await chrome.storage.local.get([KEYS.loopEnabled]);
    await updateLoopUI(loopEnabled);
    const { focusing = false, endsAt = null, blocklist = [], sessionType = null } = res?.state || {};

    // フロー表示の更新
    const focusStep = $("flow-focus");
    const breakStep = $("flow-break");
    if (focusStep) focusStep.classList.remove("active");
    if (breakStep) breakStep.classList.remove("active");

    if (!focusing || !endsAt || endsAt <= Date.now()) {
      // 設定から Focus 時間を取得して表示
      const { focusMinutes = 25 } = await chrome.storage.local.get(["focusMinutes"]);
      $("time").textContent = formatMMSS(focusMinutes * 60 * 1000);
      $("status").textContent = `${i18n("statusIdle")} / ${i18n("blockedSites")}: ${blocklist.length}`;
      $("mode-label").textContent = i18n("statusIdle");
      $("blocked-count").textContent = String(blocklist.length);
      
      // Start button更新
      updateStartButton(focusMinutes);
      
      // フロー表示更新
      if (focusStep) focusStep.textContent = i18n("flowFocus", [String(focusMinutes)]);
      
      // ダークモードを保持しながらfocus/breakクラスを削除
      document.body.classList.remove("focusing", "break");
      return;
    }

    const remaining = endsAt - Date.now();
    $("time").textContent = formatMMSS(remaining);
    $("blocked-count").textContent = String(blocklist.length);
    
    // 背景色とフロー表示
    if (sessionType === "break") {
      // ダークモードを保持しながらbreakクラスを追加
      document.body.classList.remove("focusing");
      document.body.classList.add("break");
      if (breakStep) breakStep.classList.add("active");
      $("status").textContent = `${i18n("statusBreak")} / ${i18n("blockedSites")}: ${blocklist.length}`;
      $("mode-label").textContent = i18n("statusBreak").replace("…", "");
    } else {
      // ダークモードを保持しながらfocusingクラスを追加
      document.body.classList.remove("break");
      document.body.classList.add("focusing");
      if (focusStep) focusStep.classList.add("active");
      $("status").textContent = `${i18n("statusFocusing")} / ${i18n("blockedSites")}: ${blocklist.length}`;
      $("mode-label").textContent = i18n("statusFocusing").replace("…", "");
    }
  } catch (e) {
    $("status").textContent = `Error: ${e?.message || e}`;
  }
}

// 初期化
initDarkMode();
render();
setInterval(render, 500);
