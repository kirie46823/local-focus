let audio;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // AUDIO関連のメッセージだけ処理
  if (msg?.type !== "AUDIO_PLAY" && msg?.type !== "AUDIO_STOP") {
    // 他のメッセージは無視（応答しない）
    return false;
  }

  (async () => {
    if (msg?.type === "AUDIO_PLAY") {
      if (!audio) {
        audio = new Audio(chrome.runtime.getURL("audio/rain.mp3"));
        audio.loop = true;
      }
      try {
        await audio.play();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return;
    }

    if (msg?.type === "AUDIO_STOP") {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      sendResponse({ ok: true });
      return;
    }
  })();

  return true; // async
});
