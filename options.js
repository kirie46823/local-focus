const KEYS = {
  blocklist: "blocklist",
  focusMinutes: "focusMinutes",
  breakMinutes: "breakMinutes"
};
const $ = (id) => document.getElementById(id);

// ========== Load settings on page load ==========
async function loadSettings() {
  const {
    focusMinutes = 25,
    breakMinutes = 5
  } = await chrome.storage.local.get([KEYS.focusMinutes, KEYS.breakMinutes]);

  $("focusMinutes").value = focusMinutes;
  $("breakMinutes").value = breakMinutes;
}

// ========== Save timer settings ==========
$("saveTimers").onclick = async () => {
  const focusMinutes = Math.max(1, Math.min(60, parseInt($("focusMinutes").value) || 25));
  const breakMinutes = Math.max(1, Math.min(30, parseInt($("breakMinutes").value) || 5));

  await chrome.storage.local.set({
    [KEYS.focusMinutes]: focusMinutes,
    [KEYS.breakMinutes]: breakMinutes
  });

  // Show confirmation
  const status = $("saveStatus");
  status.textContent = "✓ Saved!";
  setTimeout(() => {
    status.textContent = "";
  }, 2000);

  console.log("Timer settings saved:", { focusMinutes, breakMinutes });
};

// ========== Block list management ==========
$("add").onclick = async () => {
  const domain = normalize($("domain").value);
  if (!domain) return;

  const { blocklist = [] } = await chrome.storage.local.get([KEYS.blocklist]);
  const next = Array.from(new Set([...blocklist, domain]));
  await chrome.storage.local.set({ [KEYS.blocklist]: next });

  await chrome.runtime.sendMessage({ type: "SYNC_RULES" });

  $("domain").value = "";
  await render();
};

function normalize(s) {
  return String(s || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[\/\?#]/)[0];
}

async function render() {
  const { blocklist = [] } = await chrome.storage.local.get([KEYS.blocklist]);
  const ul = $("list");
  ul.innerHTML = "";

  if (blocklist.length === 0) {
    const li = document.createElement("li");
    li.textContent = "(empty)";
    li.style.color = "#999";
    ul.appendChild(li);
    return;
  }

  blocklist.forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d + " ";

    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.onclick = async () => {
      const next = blocklist.filter(x => x !== d);
      await chrome.storage.local.set({ [KEYS.blocklist]: next });
      await chrome.runtime.sendMessage({ type: "SYNC_RULES" });
      await render();
    };

    li.appendChild(btn);
    ul.appendChild(li);
  });
}

// ========== Initialize ==========
loadSettings();
render();
