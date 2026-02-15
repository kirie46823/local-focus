let audio;
let audio2; // セカンダリオーディオ（クロスフェード用）
let currentSound = null; // 現在再生中の音声ファイル名
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
      const soundFile = msg?.sound || "rain";
      const audioUrl = chrome.runtime.getURL(`audio/${soundFile}.mp3`);
      
      try {
        // 既存の音声を停止
        if (audio) {
          audio.pause();
          audio = null;
        }
        if (audio2) {
          audio2.pause();
          audio2 = null;
        }
        
        // 2つのオーディオインスタンスを作成（クロスフェード用）
        audio = new Audio(audioUrl);
        audio2 = new Audio(audioUrl);
        audio.volume = 1.0;
        audio2.volume = 0.0;
        
        currentSound = soundFile;
        
        // クロスフェードのタイミング（秒）
        const crossfadeDuration = 3.0; // 3秒間でクロスフェード
        let isAudio1Playing = true;
        
        // audio1 のループ処理
        const setupLoop1 = () => {
          audio.addEventListener('timeupdate', function checkLoop1() {
            if (!audio || !audio.duration || audio.paused) return;
            
            const timeLeft = audio.duration - audio.currentTime;
            if (timeLeft <= crossfadeDuration && timeLeft > 0) {
              // audio2 を開始してクロスフェード
              if (audio2.paused) {
                audio2.currentTime = 0;
                audio2.volume = 0.0;
                audio2.play().catch(e => console.error("Audio2 play error:", e));
                
                // クロスフェード処理
                const steps = 30; // フェード分割数
                const interval = (crossfadeDuration * 1000) / steps;
                let step = 0;
                
                const fadeInterval = setInterval(() => {
                  step++;
                  const progress = step / steps;
                  
                  if (audio) audio.volume = Math.max(0, 1.0 - progress);
                  if (audio2) audio2.volume = Math.min(1.0, progress);
                  
                  if (step >= steps) {
                    clearInterval(fadeInterval);
                    isAudio1Playing = false;
                    audio.removeEventListener('timeupdate', checkLoop1);
                    setupLoop2(); // audio2のループ設定
                  }
                }, interval);
              }
            }
          });
        };
        
        // audio2 のループ処理
        const setupLoop2 = () => {
          audio2.addEventListener('timeupdate', function checkLoop2() {
            if (!audio2 || !audio2.duration || audio2.paused) return;
            
            const timeLeft = audio2.duration - audio2.currentTime;
            if (timeLeft <= crossfadeDuration && timeLeft > 0) {
              // audio1 を開始してクロスフェード
              if (audio.paused) {
                audio.currentTime = 0;
                audio.volume = 0.0;
                audio.play().catch(e => console.error("Audio1 play error:", e));
                
                // クロスフェード処理
                const steps = 30;
                const interval = (crossfadeDuration * 1000) / steps;
                let step = 0;
                
                const fadeInterval = setInterval(() => {
                  step++;
                  const progress = step / steps;
                  
                  if (audio2) audio2.volume = Math.max(0, 1.0 - progress);
                  if (audio) audio.volume = Math.min(1.0, progress);
                  
                  if (step >= steps) {
                    clearInterval(fadeInterval);
                    isAudio1Playing = true;
                    audio2.removeEventListener('timeupdate', checkLoop2);
                    setupLoop1(); // audio1のループ設定
                  }
                }, interval);
              }
            }
          });
        };
        
        // 最初のループ設定と再生開始
        setupLoop1();
        await audio.play();
        
        sendResponse({ ok: true });
      } catch (e) {
        console.error("Audio play error:", e);
        sendResponse({ ok: false, error: String(e) });
      }
      return;
    }

    if (msg?.type === "AUDIO_STOP") {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1.0;
      }
      if (audio2) {
        audio2.pause();
        audio2.currentTime = 0;
        audio2.volume = 0.0;
      }
      currentSound = null;
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
