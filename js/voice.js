let recognition = null;
let isListening = false;

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
    
    const textarea = el.memoContent;
    textarea.focus();
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    textarea.value = text.substring(0, start) + transcript + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + transcript.length;
    
    // メモリ状態を直接更新
    state.memos = state.memos.map(m => m.id === state.activeMemoId ? { ...m, content: textarea.value, updated_at: new Date().toISOString() } : m);
    saveCache();
    
    // inputイベントを発火させて自動保存とプレビュー更新をトリガーする
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
  if (!state.activeMemoId) {
    showToast("音声入力を開始するにはメモを選択してください", 'shield-alert');
    return;
  }

  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
}

function startListening() {
  isListening = true;
  recognition.start();
  el.voiceBtn.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
  el.voiceBtn.style.color = 'var(--danger)';
  el.voiceBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
  el.voiceBtn.innerHTML = '<i data-lucide="mic-off" style="width:14px; height:14px; color:var(--danger);"></i>音声入力中...';
  lucide.createIcons();
  
  if (window.location.protocol === 'file:') {
    showToast("音声入力開始（※ローカル実行のため毎回許可が必要です。GitHub Pages上では一度のみで記憶されます）", 'mic');
  } else {
    showToast("音声入力を開始しました。マイクに向かってお話しください...", 'mic');
  }
}

function stopListening() {
  isListening = false;
  recognition.stop();
  el.voiceBtn.style.backgroundColor = 'transparent';
  el.voiceBtn.style.color = 'var(--text-main)';
  el.voiceBtn.style.borderColor = 'var(--panel-border)';
  el.voiceBtn.innerHTML = '<i data-lucide="mic" style="width:14px; height:14px;"></i>音声入力';
  lucide.createIcons();
  showToast("音声入力を終了しました", 'mic');
}