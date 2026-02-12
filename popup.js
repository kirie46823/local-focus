const KEYS = {
  loopEnabled: "loopEnabled",
  focusMinutes: "focusMinutes"
};

const $ = (id) => document.getElementById(id);

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

// ループUI更新
async function updateLoopUI(enabled) {
  const btn = $("loop-toggle");
  const indicator = $("flow-loop-indicator");
  const text = $("loop-text");
  
  if (enabled) {
    btn.classList.add("enabled");
    if (indicator) indicator.classList.add("enabled");
    text.textContent = "Loop ON";
  } else {
    btn.classList.remove("enabled");
    if (indicator) indicator.classList.remove("enabled");
    text.textContent = "Loop OFF";
  }
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
      $("status").textContent = `Idle / blocked sites: ${blocklist.length}`;
      document.body.className = "";
      return;
    }

    const remaining = endsAt - Date.now();
    $("time").textContent = formatMMSS(remaining);
    
    // 背景色とフロー表示
    if (sessionType === "break") {
      document.body.className = "break-mode";
      if (breakStep) breakStep.classList.add("active");
      $("status").textContent = `Break… / blocked sites: ${blocklist.length}`;
    } else {
      document.body.className = "focus-mode";
      if (focusStep) focusStep.classList.add("active");
      $("status").textContent = `Focusing… / blocked sites: ${blocklist.length}`;
    }
  } catch (e) {
    $("status").textContent = `Error: ${e?.message || e}`;
  }
}

render();
setInterval(render, 500);
