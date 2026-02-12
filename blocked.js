const params = new URLSearchParams(location.search);
const site = params.get("site") || "";

const siteEl = document.getElementById("site");
const remainingEl = document.getElementById("remaining");
const modeEl = document.getElementById("mode");
const backBtn = document.getElementById("back");
const openPopupBtn = document.getElementById("open-popup");

// サイト情報表示
if (site) {
  siteEl.textContent = `🚫 ${site}`;
} else {
  siteEl.textContent = "This site is currently blocked";
}

// 戻るボタン
backBtn.onclick = () => history.back();

// ポップアップを開くボタン
openPopupBtn.onclick = () => {
  // Chrome拡張のポップアップを直接開くことはできないので、
  // 新しいタブで拡張管理ページを開く、または指示を表示
  alert("Click the Local Focus extension icon in your browser toolbar to manage your session");
};

function formatMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function render() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_STATE" });
    const { focusing = false, endsAt = null, sessionType = "focus" } = res?.state || {};

    if (!focusing || !endsAt) {
      remainingEl.textContent = "00:00";
      modeEl.textContent = "No active session";
      return;
    }

    const remaining = endsAt - Date.now();
    
    if (remaining <= 0) {
      remainingEl.textContent = "00:00";
      modeEl.textContent = "Session ended";
      return;
    }

    remainingEl.textContent = formatMMSS(remaining);
    
    // モード表示をより分かりやすく
    if (sessionType === "break") {
      modeEl.textContent = "☕ Break Time";
      modeEl.style.color = "#28a745"; // 緑色
    } else {
      modeEl.textContent = "🔥 Focus Mode";
      modeEl.style.color = "#dc3545"; // 赤色
    }
  } catch (e) {
    console.error("Error in blocked.js render:", e);
    remainingEl.textContent = "--:--";
    modeEl.textContent = "Error loading session data";
  }
}

render();
setInterval(render, 500);
