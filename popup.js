const KEYS = {
  loopEnabled: "loopEnabled"
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
  await sendMessage({ type: "START_FOCUS", minutes: 25 });
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
    indicator.classList.add("enabled");
    text.textContent = "Loop ON";
  } else {
    btn.classList.remove("enabled");
    indicator.classList.remove("enabled");
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
    const { focusing = false, endsAt = null, blocklist = [], sessionType = null } = res?.state || {};

    // ループ設定の読み込み
    const { loopEnabled = false } = await chrome.storage.local.get([KEYS.loopEnabled]);
    await updateLoopUI(loopEnabled);

    // 背景色の変更
    document.body.className = '';
    
    // フロー表示の更新
    $("flow-focus").classList.remove("active");
    $("flow-break").classList.remove("active");
    
    if (focusing) {
      if (sessionType === "break") {
        document.body.className = 'break';
        $("flow-break").classList.add("active");
      } else {
        document.body.className = 'focusing';
        $("flow-focus").classList.add("active");
      }
    }

    // ブロック数とモード表示
    $("blocked-count").textContent = blocklist.length;
    
    // Startボタンの状態
    const startBtn = $("start");
    if (focusing && sessionType === "focus") {
      startBtn.disabled = true;
      startBtn.textContent = "In Progress...";
    } else if (focusing && sessionType === "break") {
      startBtn.disabled = true;
      startBtn.textContent = "Break Time...";
    } else {
      startBtn.disabled = false;
      startBtn.textContent = "Start 25m";
    }
    
    if (!focusing || !endsAt || endsAt <= Date.now()) {
      // Idle状態
      $("time").textContent = "25:00";
      $("status").textContent = "Ready to focus";
      $("status").className = "status-idle";
      $("mode-label").textContent = "Idle";
      return;
    }

    // タイマー更新
    const remaining = endsAt - Date.now();
    $("time").textContent = formatMMSS(remaining);
    
    // 状態に応じた表示
    if (sessionType === "break") {
      $("status").textContent = "Take a break";
      $("status").className = "status-break";
      $("mode-label").textContent = "Break";
    } else {
      $("status").textContent = "Focusing";
      $("status").className = "status-focusing";
      $("mode-label").textContent = "Focus";
    }
  } catch (e) {
    $("status").textContent = `Error: ${e?.message || e}`;
    $("status").className = "status-idle";
  }
}

render();
setInterval(render, 500);
