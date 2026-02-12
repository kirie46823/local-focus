const KEYS = {
  blocklist: "blocklist",
  focusing: "focusing",
  endsAt: "endsAt",
  sessionType: "sessionType",
  loopEnabled: "loopEnabled"
};

const ALARM_NAME = "focusEnd";
const RULE_BASE = 1000;

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get([
    KEYS.blocklist, 
    KEYS.focusing, 
    KEYS.endsAt, 
    KEYS.sessionType,
    KEYS.loopEnabled
  ]);
  
  if (!Array.isArray(cur[KEYS.blocklist])) await chrome.storage.local.set({ [KEYS.blocklist]: [] });
  if (typeof cur[KEYS.focusing] !== "boolean") await chrome.storage.local.set({ [KEYS.focusing]: false });
  if (cur[KEYS.endsAt] === undefined) await chrome.storage.local.set({ [KEYS.endsAt]: null });
  if (cur[KEYS.sessionType] === undefined) await chrome.storage.local.set({ [KEYS.sessionType]: null });
  if (cur[KEYS.loopEnabled] === undefined) await chrome.storage.local.set({ [KEYS.loopEnabled]: false });

  await syncRules();
});

// 通知音を再生
async function playNotificationSound() {
  try {
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: "PLAY_NOTIFICATION" });
  } catch (e) {
    console.error("Failed to play notification sound:", e);
  }
}

// 通知を表示
async function showNotification(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      title: title,
      message: message,
      priority: 2,
      requireInteraction: false,
      silent: true // 通知音は別途再生
    });
  } catch (e) {
    console.error("Failed to show notification:", e);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const { focusing, sessionType, loopEnabled = false } = await chrome.storage.local.get([
    KEYS.focusing, 
    KEYS.sessionType, 
    KEYS.loopEnabled
  ]);
  
  if (!focusing) return;

  // Focus終了 → Break自動開始（5分固定）
  if (sessionType === "focus") {
    await stopAmbient();

    const breakMinutes = 5;
    const endsAt = Date.now() + breakMinutes * 60 * 1000;

    await chrome.storage.local.set({
      [KEYS.focusing]: true,
      [KEYS.endsAt]: endsAt,
      [KEYS.sessionType]: "break"
    });

    // Break中はブロック解除
    await syncRules();

    await chrome.alarms.clear(ALARM_NAME);
    chrome.alarms.create(ALARM_NAME, { when: endsAt });
    
    // 通知音 + メッセージ
    await playNotificationSound();
    await showNotification(
      "☕ Time for a break!",
      "Great focus session! Take a 5-minute break."
    );
    
    return;
  }

  // Break終了
  if (sessionType === "break") {
    // ループが有効な場合：次のFocusセッションを自動開始
    if (loopEnabled) {
      const focusMinutes = 25;
      const endsAt = Date.now() + focusMinutes * 60 * 1000;

      await chrome.storage.local.set({
        [KEYS.focusing]: true,
        [KEYS.endsAt]: endsAt,
        [KEYS.sessionType]: "focus"
      });

      await chrome.alarms.clear(ALARM_NAME);
      chrome.alarms.create(ALARM_NAME, { when: endsAt });

      // Focusセッション開始：ブロック再開＆音再生
      await syncRules();
      await playAmbient();
      
      // 通知音 + メッセージ
      await playNotificationSound();
      await showNotification(
        "🔥 Ready to focus again!",
        "Starting next focus session. Let's do this!"
      );
      
      return;
    }
    
    // ループ無効：Idleへ
    await chrome.storage.local.set({
      [KEYS.focusing]: false,
      [KEYS.endsAt]: null,
      [KEYS.sessionType]: null
    });

    await syncRules();
    
    // 通知音 + メッセージ
    await playNotificationSound();
    await showNotification(
      "✓ Session completed!",
      "Great work! You can start a new session anytime."
    );
    
    return;
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_STATE") {
      const s = await chrome.storage.local.get([
        KEYS.blocklist, 
        KEYS.focusing, 
        KEYS.endsAt, 
        KEYS.sessionType
      ]);
      sendResponse({ ok: true, state: s });
      return;
    }

    if (msg?.type === "START_FOCUS") {
      const minutes = Math.max(1, Number(msg.minutes ?? 25));
      const endsAt = Date.now() + minutes * 60 * 1000;

      await chrome.storage.local.set({
        [KEYS.focusing]: true,
        [KEYS.endsAt]: endsAt,
        [KEYS.sessionType]: "focus"
      });

      await chrome.alarms.clear(ALARM_NAME);
      chrome.alarms.create(ALARM_NAME, { when: endsAt });

      await syncRules();
      await playAmbient();
      sendResponse({ ok: true, endsAt });
      return;
    }

    if (msg?.type === "STOP_FOCUS") {
      await stopAmbient();
      
      await chrome.alarms.clear(ALARM_NAME);
      await chrome.storage.local.set({ 
        [KEYS.focusing]: false, 
        [KEYS.endsAt]: null, 
        [KEYS.sessionType]: null 
      });
      await syncRules();
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === "SYNC_RULES") {
      await syncRules();
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "UNKNOWN_MESSAGE" });
  })();

  return true;
});

async function syncRules() {
  const { blocklist = [], focusing = false, sessionType = null } =
    await chrome.storage.local.get([KEYS.blocklist, KEYS.focusing, KEYS.sessionType]);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id).filter(id => id >= RULE_BASE && id < RULE_BASE + 5000);

  const shouldBlock = focusing && sessionType === "focus" && blocklist.length > 0;

  if (!shouldBlock) {
    if (removeRuleIds.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    return;
  }

  const addRules = blocklist.map((domain, idx) => {
    const d = normalizeDomain(domain);
    return {
      id: RULE_BASE + idx,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: `/blocked.html?site=${encodeURIComponent(d)}` }
      },
      condition: {
        urlFilter: d,
        resourceTypes: ["main_frame"]
      }
    };
  });

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

function normalizeDomain(input) {
  const s = String(input || "").trim().toLowerCase();
  return s
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[\/\?#]/)[0];
}

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play ambient sound during focus sessions (offline)."
  });
}

async function playAmbient() {
  await ensureOffscreen();
  await chrome.runtime.sendMessage({ type: "AUDIO_PLAY" });
}

async function stopAmbient() {
  try {
    await chrome.runtime.sendMessage({ type: "AUDIO_STOP" });
  } catch (_) {}
}
