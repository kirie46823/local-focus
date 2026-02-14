const KEYS = {
  blocklist: "blocklist",     // string[]
  focusing: "focusing",       // boolean
  endsAt: "endsAt",           // number (epoch ms) | null
  sessionType: "sessionType",  // "focus" | "break" | null
  focusMinutes: "focusMinutes", // number (default 25)
  breakMinutes: "breakMinutes",  // number (default 5)
  loopEnabled: "loopEnabled"    // boolean (default false)
};


const ALARM_NAME = "focusEnd";
const RULE_BASE = 1000;

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get([KEYS.blocklist, KEYS.focusing, KEYS.endsAt, KEYS.sessionType, KEYS.loopEnabled]);
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
    console.log("Playing notification sound...");
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ type: "PLAY_NOTIFICATION" });
    console.log("Notification sound sent to offscreen");
  } catch (e) {
    console.error("Failed to play notification sound:", e);
  }
}

// 通知を表示
async function showNotification(title, message) {
  try {
    const notificationId = await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon.png"),  // 拡張機能のアイコンを使用
      title: title,
      message: message,
      priority: 2,
      requireInteraction: true,
      silent: true  // 音はoffscreenで鳴らすのでsilent
    });
    console.log("Notification created:", notificationId);
  } catch (e) {
    console.error("Failed to show notification:", e);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log("Alarm triggered:", alarm.name);
  if (alarm.name !== ALARM_NAME) return;

  const { focusing, sessionType, loopEnabled = false } = await chrome.storage.local.get([KEYS.focusing, KEYS.sessionType, KEYS.loopEnabled]);
  console.log("Session state:", { focusing, sessionType, loopEnabled });
  if (!focusing) return;

  // Focus終了 → Break自動開始（5分固定）
  if (sessionType === "focus") {
    console.log("Focus session ended, starting break...");
    await stopAmbient();

    // 設定からBreak時間を取得（デフォルト5分）
    const { breakMinutes = 5 } = await chrome.storage.local.get([KEYS.breakMinutes]);
    const endsAt = Date.now() + breakMinutes * 60 * 1000;
    await stopAmbient();

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
      const { focusMinutes = 25 } = await chrome.storage.local.get([KEYS.focusMinutes]);
      const endsAt = Date.now() + focusMinutes * 60 * 1000;

      await chrome.storage.local.set({
        [KEYS.focusing]: true,
        [KEYS.endsAt]: endsAt,
        [KEYS.sessionType]: "focus"
      });

      await syncRules();
      await chrome.alarms.clear(ALARM_NAME);
      chrome.alarms.create(ALARM_NAME, { when: endsAt });
      await playAmbient();
      
      // 通知音 + メッセージ
      await playNotificationSound();
      await showNotification(
        "🔥 Ready to focus again!",
        "Starting next focus session."
      );
      
      return;
    }

    // ループが無効な場合：Idleへ
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
  }
});


chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "GET_STATE") {
      const s = await chrome.storage.local.get([KEYS.blocklist, KEYS.focusing, KEYS.endsAt, KEYS.sessionType]);
      sendResponse({ ok: true, state: s });
      return;
    }

    if (msg?.type === "START_FOCUS") {
      // 設定からFocus時間を取得（デフォルト25分）
      const { focusMinutes = 25 } = await chrome.storage.local.get([KEYS.focusMinutes]);
      const minutes = Math.max(1, Number(msg.minutes ?? focusMinutes));
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
      await chrome.storage.local.set({ [KEYS.focusing]: false, [KEYS.endsAt]: null, [KEYS.sessionType]: null });
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

  return true; // async
});

async function syncRules() {
  const { blocklist = [], focusing = false, sessionType = null } =
    await chrome.storage.local.get([KEYS.blocklist, KEYS.focusing, KEYS.sessionType]);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id).filter(id => id >= RULE_BASE && id < RULE_BASE + 5000);

  // ★focus中だけブロック。それ以外（break/idle）は解除
  const shouldBlock = focusing && sessionType === "focus" && blocklist.length > 0;

  if (!shouldBlock) {
    if (removeRuleIds.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    return;
  }
  if (!focusing || blocklist.length === 0) {
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
        // MVP: 文字列マッチ。精度上げるのは後でOK
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
  // offscreenが無い場合でもOK
  try {
    await chrome.runtime.sendMessage({ type: "AUDIO_STOP" });
  } catch (_) {}
}
