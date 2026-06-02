// --- 一時フローティングメモ (Scratchpad) の実装 ---
function initScratchpad() {
  // LocalStorage から内容を読み込んで復元
  const savedContent = localStorage.getItem('naomemo_scratchpad_content') || '';
  el.scratchpadContent.value = savedContent;
  updateScratchpadBadge();

  // ウィジェットの位置を復元
  const savedPos = localStorage.getItem('naomemo_scratchpad_pos');
  if (savedPos) {
    try {
      const pos = JSON.parse(savedPos);
      el.scratchpadWidget.style.left = pos.left;
      el.scratchpadWidget.style.top = pos.top;
      el.scratchpadWidget.style.right = 'auto';
      el.scratchpadWidget.style.bottom = 'auto';
    } catch (e) { console.error(e); }
  }

  // ウィジェットの最小化状態を復元
  const isMin = localStorage.getItem('naomemo_scratchpad_minimized') === 'true';
  if (isMin) {
    el.scratchpadWidget.style.display = 'none';
    el.scratchpadRestoreBtn.style.display = 'flex';
  } else {
    el.scratchpadWidget.style.display = 'flex';
    el.scratchpadRestoreBtn.style.display = 'none';
  }

  // ドラッグ移動の実装
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  // マウスドラッグ
  el.scratchpadHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    const rect = el.scratchpadWidget.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    el.scratchpadHeader.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let left = e.clientX - offsetX;
    let top = e.clientY - offsetY;
    const maxX = window.innerWidth - el.scratchpadWidget.offsetWidth;
    const maxY = window.innerHeight - el.scratchpadWidget.offsetHeight;
    left = Math.max(0, Math.min(left, maxX));
    top = Math.max(0, Math.min(top, maxY));
    el.scratchpadWidget.style.left = left + 'px';
    el.scratchpadWidget.style.top = top + 'px';
    el.scratchpadWidget.style.right = 'auto';
    el.scratchpadWidget.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    el.scratchpadHeader.style.cursor = 'move';
    document.body.style.userSelect = 'auto';
    localStorage.setItem('naomemo_scratchpad_pos', JSON.stringify({
      left: el.scratchpadWidget.style.left,
      top: el.scratchpadWidget.style.top
    }));
  });

  // タッチドラッグ（モバイル対応）
  el.scratchpadHeader.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    const touch = e.touches[0];
    const rect = el.scratchpadWidget.getBoundingClientRect();
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
  });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    let left = touch.clientX - offsetX;
    let top = touch.clientY - offsetY;
    const maxX = window.innerWidth - el.scratchpadWidget.offsetWidth;
    const maxY = window.innerHeight - el.scratchpadWidget.offsetHeight;
    left = Math.max(0, Math.min(left, maxX));
    top = Math.max(0, Math.min(top, maxY));
    el.scratchpadWidget.style.left = left + 'px';
    el.scratchpadWidget.style.top = top + 'px';
    el.scratchpadWidget.style.right = 'auto';
    el.scratchpadWidget.style.bottom = 'auto';
  });

  document.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    localStorage.setItem('naomemo_scratchpad_pos', JSON.stringify({
      left: el.scratchpadWidget.style.left,
      top: el.scratchpadWidget.style.top
    }));
  });

  // 自動保存
  el.scratchpadContent.addEventListener('input', (e) => {
    localStorage.setItem('naomemo_scratchpad_content', e.target.value);
    updateScratchpadBadge();
  });

  // 最小化ボタン
  el.scratchpadMinimizeBtn.addEventListener('click', () => {
    toggleScratchpadMinimize(true);
  });

  // 閉じるボタン（非表示＝最小化と同じ扱い）
  el.scratchpadCloseBtn.addEventListener('click', () => {
    toggleScratchpadMinimize(true);
  });

  // 復元ボタン
  el.scratchpadRestoreBtn.addEventListener('click', () => {
    toggleScratchpadMinimize(false);
  });

  // リンクを挿入ボタン
  el.scratchpadInsertLinkBtn.addEventListener('click', () => {
    if (!state.activeMemoId) {
      showToast('コピー元のメモを先に選択してください', 'shield-alert');
      return;
    }
    const activeMemo = state.memos.find(m => m.id === state.activeMemoId);
    if (!activeMemo) return;
    
    const linkText = `[${activeMemo.title}](memo://${activeMemo.id})`;
    insertTextAtCursor(el.scratchpadContent, linkText);
    localStorage.setItem('naomemo_scratchpad_content', el.scratchpadContent.value);
    updateScratchpadBadge();
    showToast('一時メモにメモリンクを挿入しました', 'link');
  });

  // 通常メモへ変換
  el.scratchpadExportBtn.addEventListener('click', async () => {
    const text = el.scratchpadContent.value.trim();
    if (!text) {
      showToast('一時メモが空です', 'shield-alert');
      return;
    }

    if (!confirm('この一時メモの内容から通常の新しいメモを作成しますか？（作成後、一時メモはクリアされます）')) return;

    const lines = text.split('\n');
    const title = lines[0].replace(/^#\s*/, '').substring(0, 50) || '一時メモから変換';
    const content = text;
    const folderId = null;

    try {
      if (state.isOnline) {
        const res = await fetch(`${API_URL}/memos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({ title, content, folder_id: folderId })
        });
        if (res.ok) {
          const newMemo = await res.json();
          showToast('一時メモを新しいメモに変換・同期しました！', 'check');
          state.memos.unshift(newMemo);
          saveCache();
          renderList();
          selectMemo(newMemo.id);
          
          el.scratchpadContent.value = '';
          localStorage.setItem('naomemo_scratchpad_content', '');
          updateScratchpadBadge();
        } else {
          showToast('メモの同期保存に失敗しました', 'shield-alert');
        }
      } else {
        const tempId = 'temp_' + Date.now();
        const nowStr = new Date().toISOString();
        const newMemo = {
          id: tempId,
          title,
          content,
          folder_id: folderId,
          created_at: nowStr,
          updated_at: nowStr
        };
        state.memos.unshift(newMemo);
        saveCache();
        renderList();
        selectMemo(tempId);
        
        addQueue('CREATE', tempId, title, content, folderId);
        updateStatusUI('offline');
        showToast('オフラインで新規メモを作成しました（同期待ち）', 'clock');
        
        el.scratchpadContent.value = '';
        localStorage.setItem('naomemo_scratchpad_content', '');
        updateScratchpadBadge();
      }
    } catch (e) {
      console.error(e);
      showToast('通信エラーが発生しました', 'shield-alert');
    }
  });
}

function toggleScratchpadMinimize(minimize) {
  if (minimize) {
    el.scratchpadWidget.style.display = 'none';
    el.scratchpadRestoreBtn.style.display = 'flex';
    localStorage.setItem('naomemo_scratchpad_minimized', 'true');
  } else {
    el.scratchpadWidget.style.display = 'flex';
    el.scratchpadRestoreBtn.style.display = 'none';
    localStorage.setItem('naomemo_scratchpad_minimized', 'false');
    lucide.createIcons();
  }
}

function updateScratchpadBadge() {
  const text = el.scratchpadContent.value.trim();
  if (text) {
    el.scratchpadBadge.style.display = 'block';
  } else {
    el.scratchpadBadge.style.display = 'none';
  }
}

function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  
  const beforeText = val.substring(0, start);
  const afterText = val.substring(end);
  
  let insert = text;
  if (start > 0 && !/\s$/.test(beforeText)) {
    insert = ' ' + insert;
  }
  if (end < val.length && !/^\s/.test(afterText)) {
    insert = insert + ' ';
  }
  
  textarea.value = beforeText + insert + afterText;
  textarea.selectionStart = textarea.selectionEnd = start + insert.length;
  textarea.focus();
}