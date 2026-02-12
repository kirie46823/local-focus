const params = new URLSearchParams(location.search);
const site = params.get("site") || "";

const siteEl = document.getElementById("site");
const remainingEl = document.getElementById("remaining");
const modeEl = document.getElementById("mode");
const backBtn = document.getElementById("back");

siteEl.textContent = site ? `Site: ${site}` : "";

backBtn.onclick = () => history.back();

function formatMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function render() {
  const res = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const { focusing = false, endsAt = null, sessionType = "focus" } = res.state || {};

  if (!focusing || !endsAt) {
    remainingEl.textContent = "Not in a focus session.";
    modeEl.textContent = "";
    return;
  }

  const remaining = endsAt - Date.now();
  remainingEl.textContent = `Time remaining: ${formatMMSS(remaining)}`;
  modeEl.textContent = `Mode: ${sessionType}`;
}

render();
setInterval(render, 500);
