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

    if (!focusing || !endsAt || endsAt <= Date.now()) {
      $("time").textContent = "25:00";
      $("status").textContent = `Idle / blocked sites: ${blocklist.length}`;
      return;
    }

    const remaining = endsAt - Date.now();
    $("time").textContent = formatMMSS(remaining);
    const label = sessionType === "break" ? "Break…" : "Focusing…";
    $("status").textContent = `${label} / blocked sites: ${blocklist.length}`;
  } catch (e) {
    $("status").textContent = `Error: ${e?.message || e}`;
  }
}

render();
setInterval(render, 500);
