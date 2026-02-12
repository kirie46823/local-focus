let audio;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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

    sendResponse({ ok: false, error: "UNKNOWN" });
  })();

  return true;
});
