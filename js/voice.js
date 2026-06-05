let recognition = null;
let isListening = false;
let listeningPaneId = 'left';

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }

    if (!transcript.trim()) return;
    
    const pel = getPaneEl(listeningPaneId);
    const textarea = pel.memoContent;
    if (!textarea) return;
    textarea.focus();
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + transcript + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + transcript.length;
    
    const paneState = state.panes[listeningPaneId];
    if (paneState.activeMemoId) {
      state.memos = state.memos.map(m => m.id === paneState.activeMemoId ? { ...m, content: textarea.value, updated_at: new Date().toISOString() } : m);
    }
    saveCache();
    
    textarea.dispatchEvent(new Event('input'));
    showToast("音声をテキストに変換しました！", 'mic');
  };

  recognition.onerror = (event) => {
    console.error("音声認識エラー", event.error);
    stopListening();
  };

  recognition.onend = () => {
    if (isListening) stopListening();
  };
}

function toggleListening() {
  if (!recognition) {
    showToast("音声入力はこのブラウザに対応していません", 'shield-alert');
    return;
  }
  const paneId = state.activePaneId;
  const paneState = state.panes[paneId];
  if (!paneState.activeMemoId) {
    showToast("音声入力を開始するにはメモを選択してください", 'shield-alert');
    return;
  }

  if (isListening) {
    stopListening();
  } else {
    startListening(paneId);
  }
}

function startListening(paneId = state.activePaneId) {
  isListening = true;
  listeningPaneId = paneId;
  recognition.start();
  
  const pel = getPaneEl(listeningPaneId);
  if (pel.voiceBtn) {
    pel.voiceBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
    pel.voiceBtn.style.color = 'var(--danger)';
    pel.voiceBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    pel.voiceBtn.innerHTML = '<i data-lucide="mic-off" style="width:14px; height:14px; color:var(--danger);"></i>音声入力中...';
    lucide.createIcons();
  }
  
  if (window.location.protocol === 'file:') {
    showToast("音声入力開始（※ローカル実行のため毎回許可が必要です。GitHub Pages上では一度のみで記憶されます）", 'mic');
  } else {
    showToast("音声入力を開始しました。マイクに向かってお話しください...", 'mic');
  }
}

function stopListening() {
  isListening = false;
  recognition.stop();
  
  const pel = getPaneEl(listeningPaneId);
  if (pel.voiceBtn) {
    pel.voiceBtn.style.backgroundColor = 'transparent';
    pel.voiceBtn.style.color = 'var(--text-main)';
    pel.voiceBtn.style.borderColor = 'var(--panel-border)';
    pel.voiceBtn.innerHTML = '<i data-lucide="mic" style="width:14px; height:14px;"></i>音声入力';
    lucide.createIcons();
  }
  showToast("音声入力を終了しました", 'mic');
}