// --- テーマ適用 ---
function applyTheme(themeName) {
  document.body.className = '';
  if (themeName !== 'theme-dark') {
    document.body.classList.add(themeName);
  }
  localStorage.setItem('app-theme', themeName);
}

// --- レンダリング ---
function renderList() {
  el.memoList.innerHTML = '';
  
  // フォルダ/タグフィルタ
  let filtered = state.memos;
  if (state.activeTagId) {
    filtered = state.memos.filter(m => m.tags && m.tags.some(t => t.name === state.activeTagId));
  } else if (state.activeFolderId === 'uncategorized') {
    filtered = state.memos.filter(m => !m.folder_id);
  } else if (state.activeFolderId !== 'all') {
    filtered = state.memos.filter(m => m.folder_id === state.activeFolderId);
  }

  // 検索フィルタ
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    if (q.startsWith('tag:')) {
      const tagName = q.substring(4).trim();
      filtered = filtered.filter(m => m.tags && m.tags.some(t => t.name.toLowerCase().includes(tagName)));
    } else {
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(q) || 
        m.content.toLowerCase().includes(q) ||
        (m.tags && m.tags.some(t => t.name.toLowerCase().includes(q)))
      );
    }
  }

  // ソート
  if (state.sortBy === 'updated') {
    filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  } else if (state.sortBy === 'created') {
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (state.sortBy === 'title') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (filtered.length === 0) {
    el.memoList.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">メモが見つかりません</div>';
    return;
  }

  filtered.forEach(memo => {
    const item = document.createElement('div');
    item.className = `memo-item ${memo.id === state.activeMemoId ? 'active' : ''}`;
    
    // サマリーテキスト抽出
    const plainText = memo.content.replace(/[#*`\[\]()]/g, '');
    const summary = plainText.substring(0, 60) + (plainText.length > 60 ? '...' : '');

    // オフライン未同期判定のバッジ表示
    const isOfflineDraft = typeof memo.id === 'string' && memo.id.startsWith('offline_');
    const badgeHtml = isOfflineDraft ? ` <span class="sync-badge"><i data-lucide="cloud-off" style="width:10px; height:10px; display:inline; vertical-align:middle;"></i> 未同期</span>` : '';

    item.innerHTML = `
      <div class="memo-item-title">${escape(memo.title || '無題のメモ')}${badgeHtml}</div>
      <div class="memo-item-summary">${escape(summary || '内容なし')}</div>
      <div class="memo-item-date">${new Date(memo.updated_at).toLocaleString()}</div>
    `;
    item.addEventListener('click', () => selectMemo(memo.id));
    el.memoList.appendChild(item);
  });
  lucide.createIcons();
}

function selectMemo(id) {
  state.activeMemoId = id;
  const memo = state.memos.find(m => m.id === id);
  if (!memo) return;

  // UI更新
  document.querySelectorAll('.memo-item').forEach(el => el.classList.remove('active'));
  renderList();

  el.emptyState.style.display = 'none';
  el.memoTitle.value = memo.title;
  el.memoContent.value = memo.content;
  
  // 編集可能にする
  el.memoTitle.disabled = false;
  el.memoContent.disabled = false;
  
  // 編集エリア初期表示
  el.memoTitle.style.display = 'block';
  el.memoContent.style.display = 'block';
  el.previewBtn.style.display = 'flex';
  el.deleteBtn.style.display = 'flex';
  
  // フォルダセレクトの復元
  updateFolderSelectOptions();
  el.memoFolderSelect.value = memo.folder_id || '';
  el.memoFolderContainer.style.display = 'flex';
  
  // タグ表示の復元
  el.memoTagContainer.style.display = 'flex';
  renderMemoTags(memo);
  
  el.linkCopyBtn.style.display = 'flex';

  if (state.isPreviewActive) {
    compileMarkdown();
  } else {
    el.markdownPreview.classList.remove('active');
    el.memoContent.style.display = 'block';
  }

  updateActiveDbBadge(id);

  // 評価パネルロード
  loadRatingsForMemo(id);
}

function closeWorkspace() {
  state.activeMemoId = null;
  el.emptyState.style.display = 'flex';
  el.memoTitle.style.display = 'none';
  el.memoContent.style.display = 'none';
  
  // 編集不可にする
  el.memoTitle.disabled = true;
  el.memoContent.disabled = true;
  el.previewBtn.style.display = 'none';
  el.deleteBtn.style.display = 'none';
  el.memoFolderContainer.style.display = 'none';
  el.memoTagContainer.style.display = 'none';
  el.memoTagList.innerHTML = '';
  el.linkCopyBtn.style.display = 'none';
  
  // 評価パネル非表示
  el.ratingPanel.scrollIntoView({ behavior: 'auto' });
  el.ratingAxesList.innerHTML = '';
  el.ratingSummaryRow.style.display = 'none';

  renderList();
  updateActiveDbBadge(null);
}

function createMemo() {
  const tempId = 'offline_' + Date.now();
  const nowStr = new Date().toISOString();
  
  // フォルダが選択されていれば、そのフォルダに紐付け
  const preFolderId = (state.activeFolderId !== 'all' && state.activeFolderId !== 'uncategorized') ? state.activeFolderId : null;

  const newMemo = {
    id: tempId,
    title: '新規メモ',
    content: '',
    folder_id: preFolderId,
    tags: [],
    created_at: nowStr,
    updated_at: nowStr
  };

  state.memos.unshift(newMemo);
  saveCache();
  renderList();
  selectMemo(tempId);

  // 同期キュー登録
  addQueue('CREATE', tempId, newMemo.title, newMemo.content, preFolderId);

  if (state.isOnline) {
    processSyncQueue();
  } else {
    updateStatusUI('offline');
  }
  
  setTimeout(() => el.memoTitle.focus(), 100);
}

function triggerAutosave() {
  if (!state.activeMemoId) return;
  
  setSaveMessage('saving', '自動保存中...');

  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    const title = el.memoTitle.value;
    const content = el.memoContent.value;
    const active = state.memos.find(m => m.id === state.activeMemoId);
    if (!active) return;

    const folderId = active.folder_id;
    const tagNames = active.tags ? active.tags.map(t => t.name) : [];

    // キャッシュ更新
    state.memos = state.memos.map(m => 
      m.id === state.activeMemoId 
        ? { ...m, title, content, updated_at: new Date().toISOString() } 
        : m
    );
    saveCache();
    renderList();

    // 同期キューに登録
    addQueue('UPDATE', state.activeMemoId, title, content, folderId, tagNames);

    if (state.isOnline) {
      await processSyncQueue();
      setSaveMessage('saved', 'SQLiteに保存済み');
    } else {
      updateStatusUI('offline');
    }
  }, 1000); // 1秒間入力が止まったら自動実行
}

async function confirmDelete() {
  if (!state.activeMemoId) return;
  if (!confirm('このメモを本当に削除しますか？')) return;

  const idToDelete = state.activeMemoId;
  el.deleteModal.classList.remove('active');

  // キャッシュから削除
  state.memos = state.memos.filter(m => m.id !== idToDelete);
  saveCache();
  closeWorkspace();

  // 同期キュー登録
  addQueue('DELETE', idToDelete);

  if (state.isOnline) {
    await processSyncQueue();
    showToast('メモを削除しました！');
  } else {
    updateStatusUI('offline');
  }
}

// --- フォルダ機能 ---
async function fetchFolders() {
  if (!state.isOnline) return;
  try {
    const res = await fetch(`${API_URL}/folders`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
    if (res.ok) {
      state.folders = await res.json();
      saveCache();
      renderFolders();
      updateFolderSelectOptions();
    }
  } catch (e) {
    console.error("フォルダ取得失敗", e);
  }
}

function renderFolders() {
  el.folderList.innerHTML = '';

  // 1. すべてのメモ
  const allItem = document.createElement('div');
  allItem.className = `folder-item ${state.activeFolderId === 'all' ? 'active' : ''}`;
  allItem.innerHTML = `<i data-lucide="files" style="width:14px; height:14px;"></i><span>すべてのメモ</span><span class="count">${state.memos.length}</span>`;
  allItem.addEventListener('click', () => selectFolder('all'));
  el.folderList.appendChild(allItem);

  // 2. 未分類
  const uncatCount = state.memos.filter(m => !m.folder_id).length;
  const uncatItem = document.createElement('div');
  uncatItem.className = `folder-item ${state.activeFolderId === 'uncategorized' ? 'active' : ''}`;
  uncatItem.innerHTML = `<i data-lucide="file-warning" style="width:14px; height:14px;"></i><span>未分類</span><span class="count">${uncatCount}</span>`;
  uncatItem.addEventListener('click', () => selectFolder('uncategorized'));
  el.folderList.appendChild(uncatItem);

  // 3. ツリー描画
  // ルートフォルダを抽出 (parent_id が null/undefined または state.folders に存在しない親を指している場合)
  const roots = state.folders.filter(f => !f.parent_id || !state.folders.some(pf => pf.id === f.parent_id));
  
  function renderSubTree(foldersList, depth) {
    foldersList.forEach(folder => {
      const count = state.memos.filter(m => m.folder_id === folder.id).length;
      const item = document.createElement('div');
      item.className = `folder-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
      item.style.paddingLeft = `${0.5 + depth * 0.75}rem`; // インデント
      
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.4rem; flex:1; min-width:0;">
          <i data-lucide="folder" style="width:14px; height:14px; color:var(--accent); flex-shrink: 0;"></i>
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escape(folder.name)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <span class="count">${count}</span>
          <button class="folder-action-btn" onclick="event.stopPropagation(); openEditFolderModal(${folder.id}, '${escape(folder.name)}')"><i data-lucide="edit-2" style="width:10px; height:10px;"></i></button>
          <button class="folder-action-btn delete" onclick="event.stopPropagation(); openDeleteFolderModal(${folder.id})"><i data-lucide="trash-2" style="width:10px; height:10px;"></i></button>
        </div>
      `;
      item.addEventListener('click', () => selectFolder(folder.id));
      el.folderList.appendChild(item);
      
      // 子フォルダを再帰描画
      const children = state.folders.filter(f => f.parent_id === folder.id);
      if (children.length > 0) {
        renderSubTree(children, depth + 1);
      }
    });
  }
  
  renderSubTree(roots, 0);
  lucide.createIcons();
}

function selectFolder(folderId) {
  state.activeFolderId = folderId;
  document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
  renderFolders();
  renderList();
}

function updateFolderSelectOptions() {
  el.memoFolderSelect.innerHTML = '<option value="">📁 フォルダを選択して移動...</option>';
  
  // フラットに見せるためパス表示でオプションをソートして追加
  state.folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = getFolderSelectText(f);
    el.memoFolderSelect.appendChild(opt);
  });
}

// フォルダのパス風の文字列表現を生成 (例: "親フォルダ / 子フォルダ")
function getFolderSelectText(folder) {
  let path = [folder.name];
  let curr = folder;
  while (curr.parent_id) {
    const parent = state.folders.find(f => f.id === curr.parent_id);
    if (parent) {
      path.unshift(parent.name);
      curr = parent;
    } else {
      break;
    }
  }
  return path.join(' / ');
}

// フォルダ作成/編集モーダル用の親フォルダ選択ドロップダウンを構築する
function populateFolderParentSelect(excludeFolderId = null) {
  el.folderParentSelect.innerHTML = '<option value="">📁 (ルートフォルダ)</option>';
  
  // 循環参照を防ぐため、excludeFolderId およびその子孫フォルダは除外する
  const excludedIds = new Set();
  if (excludeFolderId !== null) {
    const queue = [excludeFolderId];
    while (queue.length > 0) {
      const curr = queue.shift();
      excludedIds.add(curr);
      state.folders.forEach(f => {
        if (f.parent_id === curr && !excludedIds.has(f.id)) {
          queue.push(f.id);
        }
      });
    }
  }

  state.folders.forEach(f => {
    if (!excludedIds.has(f.id)) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = getFolderSelectText(f);
      el.folderParentSelect.appendChild(opt);
    }
  });
}

// フォルダ保存（新規・編集）
async function saveFolder() {
  const name = el.folderNameInput.value.trim();
  if (!name) {
    showToast("フォルダ名を入力してください", 'shield-alert');
    return;
  }

  const parentIdVal = el.folderParentSelect.value;
  const parent_id = parentIdVal ? parseInt(parentIdVal, 10) : null;

  try {
    if (editingFolderId) {
      // 編集更新
      const res = await fetch(`${API_URL}/folders/${editingFolderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ name, parent_id })
      });
      if (res.ok) {
        showToast("フォルダを保存しました！", 'check');
        fetchFolders();
      }
    } else {
      // 新規作成
      const res = await fetch(`${API_URL}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ name, parent_id })
      });
      if (res.ok) {
        showToast("新しいフォルダを作成しました！", 'check');
        fetchFolders();
      }
    }
    el.folderModal.classList.remove('active');
  } catch (e) {
    showToast("フォルダの保存に失敗しました", 'shield-alert');
  }
}

// フォルダ削除
async function deleteFolder(deleteContent) {
  if (!deletingFolderId) return;

  try {
    const res = await fetch(`${API_URL}/folders/${deletingFolderId}?delete_content=${deleteContent}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    if (res.ok || res.status === 204) {
      showToast(deleteContent ? "フォルダと中のメモを削除しました！" : "フォルダを削除しました！", 'trash-2');
      deletingFolderId = null;
      el.deleteFolderModal.classList.remove('active');
      
      // 同時にメモ一覧とフォルダ構成を再取得してリロード
      if (state.isOnline) {
        const response = await fetch(`${API_URL}/memos`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (response.ok) {
          state.memos = await response.json();
          saveCache();
        }
      }
      fetchFolders();
      renderList();
    }
  } catch (e) {
    showToast("フォルダの削除に失敗しました", 'shield-alert');
  }
}

window.openCreateFolderModal = () => {
  editingFolderId = null;
  el.folderModalTitle.textContent = "📁 フォルダを作成";
  el.folderNameInput.value = '';
  populateFolderParentSelect(null);
  el.folderParentSelect.value = '';
  el.folderModal.classList.add('active');
  setTimeout(() => el.folderNameInput.focus(), 80);
};

window.openEditFolderModal = (id, name) => {
  editingFolderId = id;
  el.folderModalTitle.textContent = "📁 フォルダ名を編集";
  el.folderNameInput.value = name;
  populateFolderParentSelect(id);
  const folder = state.folders.find(f => f.id === id);
  el.folderParentSelect.value = (folder && folder.parent_id) ? folder.parent_id : '';
  el.folderModal.classList.add('active');
  setTimeout(() => el.folderNameInput.focus(), 80);
};

window.openDeleteFolderModal = (id) => {
  deletingFolderId = id;
  el.deleteFolderModal.classList.add('active');
};

// --- Wikiリンクコピー ---
function copyMemoLink() {
  if (!state.activeMemoId) return;
  const active = state.memos.find(m => m.id === state.activeMemoId);
  if (!active) return;

  const link = `[${active.title}](memo://${active.id})`;
  navigator.clipboard.writeText(link).then(() => {
    showToast("メモのジャンプリンクをコピーしました！", 'link');
  }).catch(() => {
    showToast("コピーに失敗しました", 'shield-alert');
  });
}

// --- 各種イベント設定 ---
function setupEvents() {
  el.themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
  el.createBtn.addEventListener('click', createMemo);
  el.deleteBtn.addEventListener('click', () => { if (state.activeMemoId) el.deleteModal.classList.add('active'); });
  
  // Tabキーインデントのサポート
  el.memoContent.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = e.target.value;
      
      e.target.value = val.substring(0, start) + '\t' + val.substring(end);
      e.target.selectionStart = e.target.selectionEnd = start + 1;
      
      triggerAutosave();
    }
  });
  
  // タブ切り替え
  el.folderTabBtn.addEventListener('click', () => switchTab('folders'));
  el.tagTabBtn.addEventListener('click', () => switchTab('tags'));
  
  // タグインライン追加
  el.memoTagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = el.memoTagInput.value.replace(/,/g, '').trim();
      if (val) {
        addMemoTag(val);
        el.memoTagInput.value = '';
      }
    }
  });
  el.memoTagInput.addEventListener('blur', () => {
    const val = el.memoTagInput.value.replace(/,/g, '').trim();
    if (val) {
      addMemoTag(val);
      el.memoTagInput.value = '';
    }
  });
  el.cancelDeleteBtn.addEventListener('click', () => el.deleteModal.classList.remove('active'));
  el.confirmDeleteBtn.addEventListener('click', confirmDelete);

  el.searchBar.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderList();
  });

  el.memoTitle.addEventListener('input', triggerAutosave);
  el.memoContent.addEventListener('input', () => {
    triggerAutosave();
    if (state.isPreviewActive) compileMarkdown();
  });

  el.previewBtn.addEventListener('click', togglePreview);

  // 設定モーダル関連
  el.settingsBtn.addEventListener('click', () => {
    const savedUrl = localStorage.getItem('naomemo_api_url');
    el.apiUrlInput.value = savedUrl ? savedUrl : '';
    el.settingsModal.classList.add('active');
  });

  el.cancelSettingsBtn.addEventListener('click', () => el.settingsModal.classList.remove('active'));

  el.saveSettingsBtn.addEventListener('click', async () => {
    let inputUrl = el.apiUrlInput.value.trim();
    if (inputUrl.endsWith('/')) {
      inputUrl = inputUrl.slice(0, -1);
    }
    if (!inputUrl) {
      localStorage.removeItem('naomemo_api_url');
      API_URL = DEFAULT_API_URL;
    } else {
      API_URL = inputUrl;
      localStorage.setItem('naomemo_api_url', API_URL);
    }
    el.settingsModal.classList.remove('active');
    
    showToast("APIサーバーアドレスを設定しました！接続確認中...", 'refresh-cw');
    await checkStatus();
  });

  el.ngrokBypassBtn.addEventListener('click', () => {
    window.open(`${API_URL}/memos`, '_blank');
  });

  el.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderList();
  });

  el.voiceBtn.addEventListener('click', toggleListening);

  el.createFolderBtn.addEventListener('click', window.openCreateFolderModal);
  el.cancelFolderBtn.addEventListener('click', () => el.folderModal.classList.remove('active'));
  el.saveFolderBtn.addEventListener('click', saveFolder);
  
  el.cancelDeleteFolderBtn.addEventListener('click', () => el.deleteFolderModal.classList.remove('active'));
  el.deleteFolderOnlyBtn.addEventListener('click', () => deleteFolder(false));
  el.deleteFolderAllBtn.addEventListener('click', () => deleteFolder(true));

  // 評価システム関連
  el.addAxisBtn.addEventListener('click', openAxisModal);
  el.cancelAxisBtn.addEventListener('click', () => el.axisModal.classList.remove('active'));
  el.saveAxisBtn.addEventListener('click', saveAxis);
  el.toggleGridBtn.addEventListener('click', openToggleGrid);
  el.closeToggleGridBtn.addEventListener('click', () => el.toggleGridModal.classList.remove('active'));
  el.axisNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAxis(); });

  // メモの所属フォルダ変更
  el.memoFolderSelect.addEventListener('change', async (e) => {
    if (!state.activeMemoId) return;
    const val = e.target.value;
    const folderId = val ? parseInt(val, 10) : null;

    state.memos = state.memos.map(m => m.id === state.activeMemoId ? { ...m, folder_id: folderId, updated_at: new Date().toISOString() } : m);
    saveCache();
    renderFolders();
    renderList();

    const active = state.memos.find(m => m.id === state.activeMemoId);
    addQueue('UPDATE', state.activeMemoId, active.title, active.content, folderId);
    if (state.isOnline) {
      await processSyncQueue();
      showToast("所属フォルダを変更しました！", 'check');
    } else {
      updateStatusUI('offline');
    }
  });

  el.linkCopyBtn.addEventListener('click', copyMemoLink);

  el.helpBtn.addEventListener('click', () => {
    el.helpModal.classList.add('active');
    lucide.createIcons();
  });
  el.closeHelpBtn.addEventListener('click', () => {
    el.helpModal.classList.remove('active');
  });

  // クリップボードからの画像貼り付け (Ctrl + V)
  el.memoContent.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        const qualitySetting = el.imageQualitySelect.value || 'standard';
        showToast("画像の貼り付けを検知しました。軽量非可逆圧縮中...", 'refresh-cw');
        processAndPasteImage(file, qualitySetting);
        break;
      }
    }
  });

  // ドラッグ＆ドロップ画像
  el.memoContent.addEventListener('dragover', (e) => e.preventDefault());
  el.memoContent.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.indexOf('image') === 0) {
        e.preventDefault();
        const qualitySetting = el.imageQualitySelect.value || 'standard';
        showToast("画像のドロップを検知しました。軽量非可逆圧縮中...", 'refresh-cw');
        processAndPasteImage(file, qualitySetting);
      }
    }
  });

  // スラッシュコマンド
  el.memoContent.addEventListener('input', (e) => {
    const value = e.target.value;
    const caretPos = e.target.selectionStart;
    if (caretPos > 0 && value.substring(caretPos - 1, caretPos) === '/') {
      openCommandPalette();
    }
  });

  // コマンドパレットキーボード操作
  el.commandPaletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedCommandIndex = (selectedCommandIndex + 1) % filteredCommands.length;
      renderCommandPalette(e.target.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedCommandIndex = (selectedCommandIndex - 1 + filteredCommands.length) % filteredCommands.length;
      renderCommandPalette(e.target.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedCommandIndex]) {
        executeCommand(filteredCommands[selectedCommandIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    }
  });

  el.commandPaletteInput.addEventListener('input', (e) => {
    selectedCommandIndex = 0;
    renderCommandPalette(e.target.value);
  });

  el.commandPaletteModal.addEventListener('click', (e) => {
    if (e.target === el.commandPaletteModal) {
      closeCommandPalette();
    }
  });

  // マークダウンプレビュー内メモリンククリック
  el.markdownPreview.addEventListener('click', (e) => {
    const anchor = e.target.closest('a.memo-link');
    if (anchor) {
      e.preventDefault();
      const memoIdStr = anchor.getAttribute('data-memo-id');
      const memoId = /^\d+$/.test(memoIdStr) ? parseInt(memoIdStr, 10) : memoIdStr;
      const exists = state.memos.some(m => m.id === memoId);
      if (exists) {
        selectMemo(memoId);
        showToast(`メモへジャンプしました！`, 'link');
      } else {
        showToast("リンク先のメモが見つかりません", 'shield-alert');
      }
    }
  });
}

function escape(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- アプリケーション初期化 (DOMContentLoaded) ---
window.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();

  // テーマ復元
  const savedTheme = localStorage.getItem('app-theme') || 'theme-light';
  applyTheme(savedTheme);
  el.themeSelect.value = savedTheme;

  // 接続URL表示を同期
  const savedUrl = localStorage.getItem('naomemo_api_url');
  el.statusUrl.textContent = savedUrl ? savedUrl : 'クラウド同期 (デフォルト)';

  // ローカルキャッシュ読込
  loadCache();
  renderFolders();
  renderTags();
  renderList();
  renderHelpCommands();

  // リスナー登録
  setupEvents();

  // ユーザーID取得（評価システム用）
  fetchCurrentUser();

  // 初回接続確認と同期開始
  await checkStatus();
  setInterval(checkStatus, 8000);

  // ウインドウフォーカス時に自動再疎通確認
  window.addEventListener('focus', async () => {
    await checkStatus();
  });

  // 一時フローティングメモ (Scratchpad) の初期化
  initScratchpad();
});

// グローバルバインド（HTML onclick など連携用）
window.switchHelpTab = (tabId) => {
  const tabBtns = document.querySelectorAll('.help-tab-btn');
  const tabContents = document.querySelectorAll('.help-tab-content');
  
  tabBtns.forEach(btn => btn.classList.remove('active'));
  tabContents.forEach(content => content.classList.remove('active'));
  
  const targetBtn = Array.from(tabBtns).find(btn => btn.getAttribute('onclick').includes(tabId));
  if (targetBtn) targetBtn.classList.add('active');
  
  const targetContent = document.getElementById(tabId);
  if (targetContent) targetContent.classList.add('active');
};
window.executeCommand = executeCommand;
window.openCreateFolderModal = window.openCreateFolderModal; // ratings.js 内で定義されている
window.openEditFolderModal = window.openEditFolderModal;
window.openDeleteFolderModal = window.openDeleteFolderModal;