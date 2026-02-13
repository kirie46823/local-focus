let audio;
let notificationSound;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // AUDIO関連のメッセージだけ処理
  if (msg?.type !== "AUDIO_PLAY" && 
      msg?.type !== "AUDIO_STOP" && 
      msg?.type !== "PLAY_NOTIFICATION") {
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

    // 通知音再生
    if (msg?.type === "PLAY_NOTIFICATION") {
      try {
        // 簡単なビープ音をWeb Audio APIで生成
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 優しいチャイム音（複数の音を重ねる）
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // 2つ目の音（和音）
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
          gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.5);
        }, 100);
        
        console.log("Notification sound played");
        sendResponse({ ok: true });
      } catch (e) {
        console.error("Notification sound error:", e);
        sendResponse({ ok: false, error: String(e) });
      }
      return;
    }
  })();

  return true; // async
});
