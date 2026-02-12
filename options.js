const KEYS = { blocklist: "blocklist" };
const $ = (id) => document.getElementById(id);

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

render();
