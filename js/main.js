// --- テーマ適用 ---
function applyTheme(themeName) {
  document.body.className = '';
  if (themeName !== 'theme-dark') {
    document.body.classList.add(themeName);
  }
  localStorage.setItem('app-theme', themeName);
}

// 子孫フォルダIDを再帰的にすべて取得する
function getAllSubfolderIds(folderId) {
  let ids = [folderId];
  const children = state.folders.filter(f => f.parent_id === folderId);
  children.forEach(child => {
    ids = ids.concat(getAllSubfolderIds(child.id));
  });
  return ids;
}

// --- レンダリング ---
function renderList() {
  if (!el.memoList) return;
  el.memoList.innerHTML = '';
  
  if (!Array.isArray(state.memos)) {
    state.memos = [];
  }
  
  // フォルダ/タグフィルタ
  let filtered = state.memos;
  if (state.activeTagId) {
    filtered = state.memos.filter(m => m && m.tags && m.tags.some(t => t && t.name === state.activeTagId));
  } else if (state.activeFolderId === 'uncategorized') {
    filtered = state.memos.filter(m => m && !m.folder_id);
  } else if (state.activeFolderId !== 'all') {
    const allowedFolderIds = getAllSubfolderIds(state.activeFolderId);
    filtered = state.memos.filter(m => m && allowedFolderIds.includes(m.folder_id));
  }

  // 検索フィルタ
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase().trim();
    if (q.startsWith('tag:')) {
      const tagName = q.substring(4).trim();
      filtered = filtered.filter(m => m && m.tags && m.tags.some(t => t && t.name && t.name.toLowerCase().includes(tagName)));
    } else if (q.startsWith('#')) {
      const tagName = q.substring(1).trim();
      filtered = filtered.filter(m => m && m.tags && m.tags.some(t => t && t.name && t.name.toLowerCase().includes(tagName)));
    } else if (q.startsWith('rating:')) {
      const val = parseFloat(q.substring(7).trim()) || 0;
      const minScore = val <= 5.0 ? val * 20.0 : val;
      filtered = filtered.filter(m => m && m.average_rating !== undefined && m.average_rating !== null && m.average_rating >= minScore);
    } else if (q.startsWith('rating>=')) {
      const val = parseFloat(q.substring(8).trim()) || 0;
      const minScore = val <= 5.0 ? val * 20.0 : val;
      filtered = filtered.filter(m => m && m.average_rating !== undefined && m.average_rating !== null && m.average_rating >= minScore);
    } else {
      filtered = filtered.filter(m => 
        m && (
          (m.title || '').toLowerCase().includes(q) || 
          (m.content || '').toLowerCase().includes(q) ||
          (m.tags && m.tags.some(t => t && t.name && t.name.toLowerCase().includes(q)))
        )
      );
    }
  }

  // ソート
  if (state.sortBy === 'updated') {
    filtered.sort((a, b) => new Date((b && b.updated_at) || 0) - new Date((a && a.updated_at) || 0));
  } else if (state.sortBy === 'created') {
    filtered.sort((a, b) => new Date((b && b.created_at) || 0) - new Date((a && a.created_at) || 0));
  } else if (state.sortBy === 'title') {
    filtered.sort((a, b) => ((a && a.title) || '').localeCompare((b && b.title) || ''));
  } else if (state.sortBy === 'rating_desc') {
    filtered.sort((a, b) => ((b && b.average_rating) || 0) - ((a && a.average_rating) || 0));
  }

  if (filtered.length === 0) {
    el.memoList.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">メモが見つかりません</div>';
    return;
  }

  filtered.forEach(memo => {
    if (!memo) return;
    const item = document.createElement('div');
    item.className = `memo-item ${memo.id === state.activeMemoId ? 'active' : ''}`;
    item.setAttribute('data-memo-id', memo.id);
    
    // サマリーテキスト抽出
    const plainText = (memo.content || '').replace(/[#*`\[\]()]/g, '');
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
  safeCreateIcons();
}

function selectMemo(id, paneId = state.activePaneId) {
  if (typeof paneId !== 'string') {
    paneId = state.activePaneId;
  }
  // 指定されたペインの開いているタブ情報を更新
  const paneState = state.panes[paneId];
  if (!paneState.openMemoIds.includes(id)) {
    paneState.openMemoIds.push(id);
  }
  paneState.activeMemoId = id;
  
  // もし指定されたペインが現在のアクティブペインなら、グローバルな activeMemoId も更新
  if (paneId === state.activePaneId) {
    state.activeMemoId = id;
  }
  
  const memo = state.memos.find(m => m && m.id === id);
  if (!memo) return;

  // リンクジャンプ時などで、現在のアクティブフォルダ/タグにこのメモが含まれていない場合、
  // メモが所属するフォルダに自動切り替え（なければ未分類）
  const allowedFolderIds = state.activeFolderId !== 'all' && state.activeFolderId !== 'uncategorized' 
    ? getAllSubfolderIds(state.activeFolderId) 
    : [];
  
  let needsFilterReset = false;
  if (state.activeTagId) {
    if (!memo.tags || !memo.tags.some(t => t.name === state.activeTagId)) {
      needsFilterReset = true;
    }
  } else if (state.activeFolderId === 'uncategorized') {
    if (memo.folder_id) {
      needsFilterReset = true;
    }
  } else if (state.activeFolderId !== 'all') {
    if (!allowedFolderIds.includes(memo.folder_id)) {
      needsFilterReset = true;
    }
  }

  if (needsFilterReset) {
    if (memo.folder_id) {
      state.activeFolderId = memo.folder_id;
    } else {
      state.activeFolderId = 'uncategorized';
    }
    state.activeTagId = null; // タグフィルタは解除
    renderFolders();
    if (typeof renderTags === 'function') renderTags();
  }

  // UI更新 (サイドバーのアクティブメモ表示を同期)
  document.querySelectorAll('.memo-item').forEach(e => e.classList.remove('active'));
  // スプリットされている場合は、左右どちらのペインにあるアクティブメモもハイライト
  const activeIds = [state.panes.left.activeMemoId, state.panes.right.activeMemoId];
  document.querySelectorAll('.memo-item').forEach(item => {
    const itemMemoId = item.getAttribute('data-memo-id');
    const mId = /^\d+$/.test(itemMemoId) ? parseInt(itemMemoId, 10) : itemMemoId;
    if (activeIds.includes(mId)) {
      item.classList.add('active');
    }
  });

  const pel = getPaneEl(paneId);
  pel.emptyState.style.display = 'none';
  pel.memoTitle.value = memo.title;
  pel.memoContent.value = memo.content;
  
  // 編集エリア初期表示
  pel.memoTitle.style.display = 'block';
  pel.memoContent.style.display = 'block';
  pel.previewBtn.style.display = 'flex';
  if (pel.linkCopyBtn) pel.linkCopyBtn.style.display = 'flex';
  if (pel.downloadBtn) pel.downloadBtn.style.display = 'flex';
  if (pel.voiceBtn) pel.voiceBtn.style.display = 'flex';
  if (pel.addAxisBtn) pel.addAxisBtn.style.display = 'flex';
  if (pel.toggleGridBtn) pel.toggleGridBtn.style.display = 'flex';
  
  // フォルダセレクトの復元
  updateFolderSelectOptions(paneId);
  pel.memoFolderSelect.value = memo.folder_id || '';
  pel.memoFolderContainer.style.display = 'flex';
  
  // タグ表示の復元
  pel.memoTagContainer.style.display = 'flex';
  renderMemoTags(memo, paneId);

  // 権限の適用
  applyMemoPermissions(memo, paneId);
  
  // 他のメモ選択時は自動でビュー（プレビュー）モードに戻る
  paneState.isEditModeExplicit = false;
  paneState.isPreviewActive = true;
  syncPreviewUI(paneId);
 
  updateActiveDbBadge(id, paneId);
 
  // 評価パネルロード
  loadRatingsForMemo(id, paneId);

  // タブリストを再描画
  renderPaneTabs(paneId);
}

function applyMemoPermissions(memo, paneId = state.activePaneId) {
  const pel = getPaneEl(paneId);
  
  // 指定されたペイン内の既存の閲覧専用バナーを削除
  const existingBanner = pel.memoTitle.parentNode.querySelector('.readonly-banner');
  if (existingBanner) existingBanner.remove();

  if (memo.permission === 'read') {
    // 閲覧のみ権限
    pel.memoTitle.disabled = true;
    pel.memoContent.disabled = true;
    pel.memoFolderSelect.disabled = true;
    pel.memoTagInput.disabled = true;
    pel.memoTagInput.placeholder = "閲覧のみのためタグを追加できません";
    if (pel.deleteBtn) pel.deleteBtn.style.display = (state.currentUser && state.currentUser.is_admin) ? 'flex' : 'none';
    if (pel.shareBtn) pel.shareBtn.style.display = 'none';
    if (pel.addAxisBtn) pel.addAxisBtn.style.display = 'none';
    
    // 指定ペイン内のタグ削除ボタンを非表示
    pel.memoTagList.querySelectorAll('.tag-chip-remove').forEach(btn => btn.style.display = 'none');

    // 閲覧専用の警告バナーを表示
    const banner = document.createElement('div');
    banner.className = 'readonly-banner';
    banner.innerHTML = `<i data-lucide="lock" style="width:14px; height:14px; margin-right:4px; vertical-align:middle;"></i><span>このメモは閲覧専用です。</span>`;
    banner.style.cssText = "font-size: 0.75rem; color: var(--danger); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.35rem 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.3rem;";
    pel.memoTitle.parentNode.insertBefore(banner, pel.memoTitle);
    safeCreateIcons();
  } else {
    // 所有者または編集可能権限
    pel.memoTitle.disabled = false;
    pel.memoContent.disabled = false;
    pel.memoFolderSelect.disabled = false;
    pel.memoTagInput.disabled = false;
    pel.memoTagInput.placeholder = "+ タグを追加...";
    if (pel.deleteBtn) pel.deleteBtn.style.display = (memo.permission === 'owner' || (state.currentUser && state.currentUser.is_admin)) ? 'flex' : 'none'; // 削除は所有者または管理者のみ
    if (pel.shareBtn) pel.shareBtn.style.display = memo.permission === 'owner' ? 'flex' : 'none'; // 共有は所有者のみ
    if (pel.addAxisBtn) pel.addAxisBtn.style.display = 'flex';
    
    pel.memoTagList.querySelectorAll('.tag-chip-remove').forEach(btn => btn.style.display = 'flex');
  }
}

function closeWorkspace() {
  // 全ペインを閉じる（ログアウト時などのフォールバック）
  state.activeMemoId = null;
  state.panes.left.activeMemoId = null;
  state.panes.left.openMemoIds = [];
  state.panes.right.activeMemoId = null;
  state.panes.right.openMemoIds = [];
  
  clearPaneEditor('left');
  clearPaneEditor('right');
  
  renderList();
}

function createMemo(paneId = state.activePaneId) {
  if (typeof paneId !== 'string') {
    paneId = state.activePaneId;
  }
  const tempId = 'offline_' + Date.now();
  const nowStr = new Date().toISOString();
  
  const preFolderId = (state.activeFolderId !== 'all' && state.activeFolderId !== 'uncategorized') ? state.activeFolderId : null;

  const shareModeToggle = document.getElementById('defaultShareModeToggle');
  const shareMode = (shareModeToggle && shareModeToggle.checked) ? 'whitelist' : 'blacklist';

  const newMemo = {
    id: tempId,
    title: '新規メモ',
    content: '',
    folder_id: preFolderId,
    tags: [],
    share_mode: shareMode,
    created_at: nowStr,
    updated_at: nowStr
  };

  state.memos.unshift(newMemo);
  saveCache();
  renderList();
  selectMemo(tempId, paneId);

  // 新規作成時は即座に編集可能にするため、明示的編集モードをオンにする
  const paneState = state.panes[paneId];
  paneState.isEditModeExplicit = true;
  paneState.isPreviewActive = false;
  syncPreviewUI(paneId);

  // 同期キュー登録
  addQueue('CREATE', tempId, newMemo.title, newMemo.content, preFolderId, [], shareMode);

  if (state.isOnline) {
    processSyncQueue();
  } else {
    updateStatusUI('offline');
  }
  
  const pel = getPaneEl(paneId);
  setTimeout(() => pel.memoTitle.focus(), 100);
}

function triggerAutosave(paneId = state.activePaneId) {
  if (typeof paneId !== 'string') {
    paneId = state.activePaneId;
  }
  const paneState = state.panes[paneId];
  const activeMemoId = paneState.activeMemoId;
  if (!activeMemoId) return;
  const active = state.memos.find(m => m && m.id === activeMemoId);
  if (!active || active.permission === 'read') return;
  
  setSaveMessage('saving', '自動保存中...', paneId);

  if (paneState.autosaveTimer) clearTimeout(paneState.autosaveTimer);
  paneState.autosaveTimer = setTimeout(async () => {
    const pel = getPaneEl(paneId);
    const title = pel.memoTitle.value;
    const content = pel.memoContent.value;
    const active = state.memos.find(m => m && m.id === activeMemoId);
    if (!active) return;

    const folderId = active.folder_id;
    const tagNames = active.tags ? active.tags.map(t => t.name) : [];

    // キャッシュ更新
    state.memos = state.memos.map(m => 
      m && m.id === activeMemoId 
        ? { ...m, title, content, updated_at: new Date().toISOString() } 
        : m
    );
    saveCache();
    renderList();
    renderPaneTabs(paneId);

    // 同期キューに登録
    addQueue('UPDATE', activeMemoId, title, content, folderId, tagNames);

    if (state.isOnline) {
      await processSyncQueue();
      setSaveMessage('saved', 'SQLiteに保存済み', paneId);
    } else {
      updateStatusUI('offline');
      setSaveMessage('saved', 'ローカルに一時保存済み', paneId);
    }
  }, 1000);
}

async function confirmDelete() {
  const paneId = state.activePaneId;
  const paneState = state.panes[paneId];
  const idToDelete = paneState.activeMemoId;
  if (!idToDelete) return;
  if (!confirm('このメモを本当に削除しますか？')) return;

  el.deleteModal.classList.remove('active');

  // キャッシュから削除
  state.memos = state.memos.filter(m => m && m.id !== idToDelete);
  saveCache();
  
  // 左右のペインからこのメモのタブを除去して画面をクリアまたは別のタブに切り替え
  closePaneTab('left', idToDelete);
  closePaneTab('right', idToDelete);
  
  renderList();

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
      updateFolderSelectOptions(null);
    }
  } catch (e) {
    console.error("フォルダ取得失敗", e);
  }
}

// フォルダとその配下の子孫フォルダのメモ合計数を再帰的に取得する
function getFolderMemoCount(folderId) {
  let count = state.memos.filter(m => m && m.folder_id === folderId).length;
  const children = state.folders.filter(f => f && f.parent_id === folderId);
  children.forEach(child => {
    if (child) count += getFolderMemoCount(child.id);
  });
  return count;
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
  const uncatCount = state.memos.filter(m => m && !m.folder_id).length;
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
      const count = getFolderMemoCount(folder.id);
      const children = state.folders.filter(f => f.parent_id === folder.id);
      const hasChildren = children.length > 0;
      const isCollapsed = !state.expandedFolderIds.includes(folder.id);
      
      const item = document.createElement('div');
      item.className = `folder-item ${state.activeFolderId === folder.id ? 'active' : ''}`;
      item.style.paddingLeft = `${0.25 + depth * 0.6}rem`; // インデントをコンパクトにしてアコーディオン矢印のスペースを確保
      
      let toggleHtml = '';
      if (hasChildren) {
        toggleHtml = `
          <button class="folder-toggle-btn" onclick="event.stopPropagation(); toggleFolderCollapse(${folder.id})">
            <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" style="width:12px; height:12px;"></i>
          </button>
        `;
      } else {
        toggleHtml = `<span class="folder-toggle-spacer"></span>`;
      }

      const canManage = (state.currentUser && (state.currentUser.is_admin || folder.user_id === state.currentUser.id));
      let actionButtonsHtml = '';
      if (canManage) {
        actionButtonsHtml = `
          <button class="folder-action-btn" onclick="event.stopPropagation(); openEditFolderModal(${folder.id}, '${escape(folder.name)}')"><i data-lucide="edit-2" style="width:10px; height:10px;"></i></button>
          <button class="folder-action-btn delete" onclick="event.stopPropagation(); openDeleteFolderModal(${folder.id})"><i data-lucide="trash-2" style="width:10px; height:10px;"></i></button>
        `;
      }

      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.3rem; flex:1; min-width:0;">
          ${toggleHtml}
          <i data-lucide="folder" style="width:14px; height:14px; color:var(--accent); flex-shrink: 0;"></i>
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escape(folder.name)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <span class="count">${count}</span>
          ${actionButtonsHtml}
        </div>
      `;
      item.addEventListener('click', () => selectFolder(folder.id));
      el.folderList.appendChild(item);
      
      // 子フォルダを再帰描画（自身が折りたたまれていない場合のみ）
      if (hasChildren && !isCollapsed) {
        renderSubTree(children, depth + 1);
      }
    });
  }
  
  renderSubTree(roots, 0);
  safeCreateIcons();
}

function toggleFolderCollapse(folderId) {
  const isExpanded = state.expandedFolderIds.includes(folderId);
  if (isExpanded) {
    state.expandedFolderIds = state.expandedFolderIds.filter(id => id !== folderId);
  } else {
    state.expandedFolderIds.push(folderId);
  }
  saveCache();
  renderFolders();
}

function selectFolder(folderId) {
  state.activeFolderId = folderId;
  document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
  renderFolders();
  renderList();
}

// フォルダをツリー親子順に平坦化した配列を返す
function getFoldersTreeSorted() {
  const sorted = [];
  const roots = state.folders.filter(f => !f.parent_id || !state.folders.some(pf => pf.id === f.parent_id));
  
  function traverse(list) {
    list.forEach(folder => {
      sorted.push(folder);
      const children = state.folders.filter(f => f.parent_id === folder.id);
      traverse(children);
    });
  }
  traverse(roots);
  return sorted;
}

function updateFolderSelectOptions(paneId = state.activePaneId) {
  if (!paneId) {
    updateFolderSelectOptions('left');
    updateFolderSelectOptions('right');
    return;
  }
  const pel = getPaneEl(paneId);
  if (!pel.memoFolderSelect) return;
  pel.memoFolderSelect.innerHTML = '<option value="">📁 フォルダを選択して移動...</option>';
  
  // フラットに見せるためパス表示でオプションをソートして追加
  getFoldersTreeSorted().forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = getFolderSelectText(f);
    pel.memoFolderSelect.appendChild(opt);
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

  getFoldersTreeSorted().forEach(f => {
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
  
  // 現在選択中のフォルダがあればそれをデフォルトの親フォルダとする
  if (state.activeFolderId && typeof state.activeFolderId === 'number') {
    el.folderParentSelect.value = state.activeFolderId;
  } else {
    el.folderParentSelect.value = '';
  }
  
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

// --- メモのZIPダウンロード ---
function downloadMemo(paneId = state.activePaneId) {
  if (typeof paneId !== 'string') {
    paneId = state.activePaneId;
  }
  const paneState = state.panes[paneId];
  const memoId = paneState.activeMemoId;
  if (!memoId) {
    showToast("ダウンロードするメモが選択されていません", 'shield-alert');
    return;
  }

  const isOfflineDraft = typeof memoId === 'string' && memoId.startsWith('offline_');
  if (isOfflineDraft) {
    showToast("未同期の新規メモはダウンロードできません。オンラインで保存してください。", 'shield-alert');
    return;
  }

  const token = state.token;
  if (!token) {
    showToast("ダウンロードするにはログインが必要です", 'shield-alert');
    return;
  }

  showToast("ダウンロードファイルを準備中...", 'refresh-cw');

  fetch(`${API_URL}/memos/${memoId}/download`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true'
    }
  })
  .then(res => {
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("このメモのダウンロード権限がありません");
      }
      throw new Error("ダウンロードに失敗しました");
    }
    const contentDisposition = res.headers.get('content-disposition');
    let filename = `memo_${memoId}.zip`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = decodeURIComponent(filenameMatch[1]);
      } else {
        const fallbackMatch = contentDisposition.match(/filename="?([^;\n"]*)"?/);
        if (fallbackMatch && fallbackMatch[1]) {
          filename = fallbackMatch[1];
        }
      }
    }
    return res.blob().then(blob => ({ blob, filename }));
  })
  .then(({ blob, filename }) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showToast("ダウンロードが完了しました！", 'check');
  })
  .catch(err => {
    console.error(err);
    showToast(err.message || "ダウンロード中にエラーが発生しました", 'shield-alert');
  });
}

// --- 各種イベント設定 ---
function setupPaneEvents(paneId) {
  const pel = getPaneEl(paneId);
  
  
  if (pel.deleteBtn) {
    pel.deleteBtn.addEventListener('click', () => {
      const paneState = state.panes[paneId];
      if (paneState.activeMemoId) {
        selectPane(paneId);
        el.deleteModal.classList.add('active');
      }
    });
  }
  
  if (pel.memoContent) {
    pel.memoContent.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const val = e.target.value;
        
        e.target.value = val.substring(0, start) + '\t' + val.substring(end);
        e.target.selectionStart = e.target.selectionEnd = start + 1;
        
        triggerAutosave(paneId);
      } else if (e.key === 'Escape') {
        const paneState = state.panes[paneId];
        if (!paneState.isEditModeExplicit) {
          paneState.isPreviewActive = true;
          syncPreviewUI(paneId);
        } else {
          pel.memoContent.blur();
        }
      }
    });

    pel.memoContent.addEventListener('paste', (e) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          e.preventDefault();
          const file = item.getAsFile();
          const qualitySetting = pel.imageQualitySelect.value || 'standard';
          showToast("画像の貼り付けを検知しました。軽量非可逆圧縮中...", 'refresh-cw');
          selectPane(paneId);
          processAndPasteImage(file, qualitySetting);
          break;
        }
      }
    });

    pel.memoContent.addEventListener('dragover', (e) => e.preventDefault());
    pel.memoContent.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.indexOf('image') === 0) {
          e.preventDefault();
          const qualitySetting = pel.imageQualitySelect.value || 'standard';
          showToast("画像のドロップを検知しました。軽量非可逆圧縮中...", 'refresh-cw');
          selectPane(paneId);
          processAndPasteImage(file, qualitySetting);
        }
      }
    });

    pel.memoContent.addEventListener('input', (e) => {
      const value = e.target.value;
      const caretPos = e.target.selectionStart;
      if (caretPos > 0 && value.substring(caretPos - 1, caretPos) === '/') {
        selectPane(paneId);
        openCommandPalette();
      }
    });

    pel.memoContent.addEventListener('input', () => {
      triggerAutosave(paneId);
      const paneState = state.panes[paneId];
      if (paneState.isPreviewActive) compileMarkdown(paneId);
    });

    pel.memoContent.addEventListener('blur', () => {
      setTimeout(() => {
        const paneState = state.panes[paneId];
        if (paneState.activeMemoId && !paneState.isEditModeExplicit && !paneState.isPreviewActive) {
          if (document.activeElement !== pel.memoContent && document.activeElement !== pel.memoTitle) {
            paneState.isPreviewActive = true;
            syncPreviewUI(paneId);
          }
        }
      }, 200);
    });
  }

  if (pel.memoTitle) {
    pel.memoTitle.addEventListener('input', () => triggerAutosave(paneId));
    
    // 題名をダブルクリックした際、閲覧専用でない場合に限り編集可能にしてフォーカスを当てる
    pel.memoTitle.addEventListener('dblclick', () => {
      const paneState = state.panes[paneId];
      if (!paneState.activeMemoId) return;
      const activeMemo = state.memos.find(m => m.id === paneState.activeMemoId);
      if (!activeMemo || activeMemo.permission === 'read') return;

      // プレビューモードであっても一時的にタイトルだけ編集できるようにする
      pel.memoTitle.readOnly = false;
      pel.memoTitle.disabled = false;
      pel.memoTitle.classList.remove('readonly-title');
      pel.memoTitle.focus();
      pel.memoTitle.select();
    });

    // Enterキー押下で編集を終了する
    pel.memoTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        pel.memoTitle.blur();
      }
    });

    // フォーカスが外れた際、プレビューモードであれば非活性（読み取り専用）に戻して自動保存
    pel.memoTitle.addEventListener('blur', () => {
      const paneState = state.panes[paneId];
      if (!paneState.activeMemoId) return;
      const activeMemo = state.memos.find(m => m.id === paneState.activeMemoId);
      if (!activeMemo || activeMemo.permission === 'read') return;

      if (paneState.isPreviewActive) {
        pel.memoTitle.readOnly = true;
        pel.memoTitle.classList.add('readonly-title');
      }
      triggerAutosave(paneId);
    });
  }
  
  if (pel.previewBtn) {
    pel.previewBtn.addEventListener('click', () => togglePreview(paneId));
  }
  
  if (pel.linkCopyBtn) {
    pel.linkCopyBtn.addEventListener('click', () => {
      selectPane(paneId);
      copyMemoLink();
    });
  }
  
  if (pel.downloadBtn) {
    pel.downloadBtn.addEventListener('click', () => {
      selectPane(paneId);
      downloadMemo(paneId);
    });
  }
  
  
  
  if (pel.shareBtn) {
    pel.shareBtn.addEventListener('click', () => {
      selectPane(paneId);
      if (typeof openShareModal === 'function') {
        openShareModal();
      } else {
        el.shareModal.classList.add('active');
        if (typeof loadShares === 'function') loadShares();
      }
    });
  }

  if (pel.memoTagInput) {
    pel.memoTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = pel.memoTagInput.value.replace(/,/g, '').trim();
        if (val) {
          addMemoTag(val, paneId);
          pel.memoTagInput.value = '';
        }
      }
    });
    pel.memoTagInput.addEventListener('blur', () => {
      const val = pel.memoTagInput.value.replace(/,/g, '').trim();
      if (val) {
        addMemoTag(val, paneId);
        pel.memoTagInput.value = '';
      }
    });
  }

  if (pel.memoFolderSelect) {
    pel.memoFolderSelect.addEventListener('change', async (e) => {
      const paneState = state.panes[paneId];
      if (!paneState.activeMemoId) return;
      const val = e.target.value;
      const folderId = val ? parseInt(val, 10) : null;

      state.memos = state.memos.map(m => m.id === paneState.activeMemoId ? { ...m, folder_id: folderId, updated_at: new Date().toISOString() } : m);
      saveCache();
      renderFolders();
      renderList();

      const active = state.memos.find(m => m.id === paneState.activeMemoId);
      addQueue('UPDATE', paneState.activeMemoId, active.title, active.content, folderId);
      if (state.isOnline) {
        await processSyncQueue();
        showToast("所属フォルダを変更しました！", 'check');
      } else {
        updateStatusUI('offline');
      }
    });
  }

  if (pel.markdownPreview) {
    pel.markdownPreview.addEventListener('click', (e) => {
      const anchor = e.target.closest('a.memo-link');
      if (anchor) {
        e.preventDefault();
        const memoIdStr = anchor.getAttribute('data-memo-id');
        const memoId = /^\d+$/.test(memoIdStr) ? parseInt(memoIdStr, 10) : memoIdStr;
        const exists = state.memos.some(m => m.id === memoId);
        if (exists) {
          selectPane(paneId);
          selectMemo(memoId, paneId);
          showToast(`メモへジャンプしました！`, 'link');
        } else {
          showToast("リンク先のメモが見つかりません", 'shield-alert');
        }
      }
    });

    pel.markdownPreview.addEventListener('dblclick', (e) => {
      if (pel.memoContent.disabled) return;
      
      const selection = window.getSelection().toString().trim();
      const paneState = state.panes[paneId];
      paneState.isPreviewActive = false;
      syncPreviewUI(paneId);
      
      pel.memoContent.focus();
      
      if (selection) {
        const text = pel.memoContent.value;
        const idx = text.indexOf(selection);
        if (idx !== -1) {
          pel.memoContent.selectionStart = idx;
          pel.memoContent.selectionEnd = idx + selection.length;
        }
      }
    });
  }

  if (pel.addAxisBtn) {
    pel.addAxisBtn.addEventListener('click', () => {
      selectPane(paneId);
      openAxisModal();
    });
  }
  if (pel.toggleGridBtn) {
    pel.toggleGridBtn.addEventListener('click', () => {
      selectPane(paneId);
      openToggleGrid();
    });
  }
}

function setupEvents() {
  if (el.themeSelect) {
    el.themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
  }
  if (el.voiceBtn) {
    el.voiceBtn.addEventListener('click', toggleListening);
  }
  el.createBtn.addEventListener('click', createMemo);
  
  const shareToggle = document.getElementById('defaultShareModeToggle');
  const shareLabel = document.getElementById('defaultShareModeLabel');
  if (shareToggle && shareLabel) {
    shareToggle.addEventListener('change', () => {
      if (shareToggle.checked) {
        shareLabel.textContent = '非公開';
        shareLabel.style.color = 'var(--danger)';
      } else {
        shareLabel.textContent = '全員公開';
        shareLabel.style.color = 'var(--text-sub)';
      }
    });
  }
  
  el.cancelDeleteBtn.addEventListener('click', () => el.deleteModal.classList.remove('active'));
  el.confirmDeleteBtn.addEventListener('click', confirmDelete);

  el.searchBar.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderList();
  });

  el.folderTabBtn.addEventListener('click', () => switchTab('folders'));
  el.tagTabBtn.addEventListener('click', () => switchTab('tags'));

  el.settingsBtn.addEventListener('click', () => {
    const savedUrl = localStorage.getItem('naomemo_api_url');
    el.apiUrlInput.value = savedUrl ? savedUrl : '';

    const currentWidth = localStorage.getItem('naomemo_editor_max_width') || '800';
    el.editorWidthSlider.value = currentWidth;
    el.editorWidthVal.textContent = currentWidth;

    el.settingsModal.classList.add('active');
  });

  el.editorWidthSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    el.editorWidthVal.textContent = value;
    document.documentElement.style.setProperty('--editor-max-width', value + 'px');
  });

  el.editorWidthSlider.addEventListener('change', (e) => {
    const value = e.target.value;
    localStorage.setItem('naomemo_editor_max_width', value);
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

  if (el.ngrokBypassBtn) {
    el.ngrokBypassBtn.addEventListener('click', () => {
      window.open(`${API_URL}/memos`, '_blank');
    });
  }

  el.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderList();
  });

  el.createFolderBtn.addEventListener('click', window.openCreateFolderModal);
  el.cancelFolderBtn.addEventListener('click', () => el.folderModal.classList.remove('active'));
  el.saveFolderBtn.addEventListener('click', saveFolder);
  
  el.cancelDeleteFolderBtn.addEventListener('click', () => el.deleteFolderModal.classList.remove('active'));
  el.deleteFolderOnlyBtn.addEventListener('click', () => deleteFolder(false));
  el.deleteFolderAllBtn.addEventListener('click', () => deleteFolder(true));

  el.cancelAxisBtn.addEventListener('click', () => el.axisModal.classList.remove('active'));
  el.saveAxisBtn.addEventListener('click', saveAxis);
  el.closeToggleGridBtn.addEventListener('click', () => el.toggleGridModal.classList.remove('active'));
  el.axisNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveAxis(); });

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

  el.helpBtn.addEventListener('click', () => {
    el.helpModal.classList.add('active');
    safeCreateIcons();
  });
  el.closeHelpBtn.addEventListener('click', () => {
    el.helpModal.classList.remove('active');
  });

  // --- スプリットビューの切り替え ---
  el.splitViewBtn.addEventListener('click', () => {
    state.isSplitView = !state.isSplitView;
    const rightPane = document.getElementById('pane-right');
    const leftPane = document.getElementById('pane-left');
    
    if (state.isSplitView) {
      rightPane.style.display = 'flex';
      leftPane.classList.add('split');
      rightPane.classList.add('split');
      el.splitViewBtnText.textContent = "分割解除 (1枚表示)";
      
      if (!state.panes.right.activeMemoId && state.panes.left.activeMemoId) {
        state.panes.right.openMemoIds = [...state.panes.left.openMemoIds];
        selectMemo(state.panes.left.activeMemoId, 'right');
      } else {
        renderPaneTabs('right');
      }
    } else {
      rightPane.style.display = 'none';
      leftPane.classList.remove('split');
      rightPane.classList.remove('split');
      el.splitViewBtnText.textContent = "画面分割 (左右)";
      selectPane('left');
    }
    safeCreateIcons();
  });

  // 縦タブアコーディオン開閉 (左ペイン)
  const leftToggleTabsBtn = document.getElementById('left-toggleTabsBtn');
  const leftOpenTabsBtn = document.getElementById('left-openTabsBtn');
  const leftTabsSidebar = document.getElementById('left-tabsSidebar');
  
  leftToggleTabsBtn.addEventListener('click', () => {
    leftTabsSidebar.classList.add('collapsed');
    leftOpenTabsBtn.style.display = 'flex';
  });
  leftOpenTabsBtn.addEventListener('click', () => {
    leftTabsSidebar.classList.remove('collapsed');
    leftOpenTabsBtn.style.display = 'none';
  });

  // 縦タブアコーディオン開閉 (右ペイン)
  const rightToggleTabsBtn = document.getElementById('right-toggleTabsBtn');
  const rightOpenTabsBtn = document.getElementById('right-openTabsBtn');
  const rightTabsSidebar = document.getElementById('right-tabsSidebar');
  
  rightToggleTabsBtn.addEventListener('click', () => {
    rightTabsSidebar.classList.add('collapsed');
    rightOpenTabsBtn.style.display = 'flex';
  });
  rightOpenTabsBtn.addEventListener('click', () => {
    rightTabsSidebar.classList.remove('collapsed');
    rightOpenTabsBtn.style.display = 'none';
  });

  // ペインクリックでアクティブペインを切り替え
  const leftPaneContainer = document.getElementById('pane-left');
  const rightPaneContainer = document.getElementById('pane-right');
  
  leftPaneContainer.addEventListener('mousedown', () => {
    selectPane('left');
  });
  rightPaneContainer.addEventListener('mousedown', () => {
    selectPane('right');
  });

  setupPaneEvents('left');
  setupPaneEvents('right');
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
  safeCreateIcons();

  // テーマ復元
  const savedTheme = localStorage.getItem('app-theme') || 'theme-light';
  applyTheme(savedTheme);
  if (el.themeSelect) {
    el.themeSelect.value = savedTheme;
  }

  // エディタ最大幅の復元
  const savedWidth = localStorage.getItem('naomemo_editor_max_width') || '800';
  document.documentElement.style.setProperty('--editor-max-width', savedWidth + 'px');

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

  // 認証の確認と初期データの読み込み
  if (typeof initAuth === 'function') {
    await initAuth();
    if (state.currentUser) {
      state.currentUserId = state.currentUser.id;
    }
  } else {
    // フォールバック
    fetchCurrentUser();
    await checkStatus();
  }

  let checkStatusTimer = null;

  function startStatusTimer() {
    if (checkStatusTimer) clearInterval(checkStatusTimer);
    checkStatusTimer = setInterval(checkStatus, 30000); // 30秒に緩和
  }

  function stopStatusTimer() {
    if (checkStatusTimer) {
      clearInterval(checkStatusTimer);
      checkStatusTimer = null;
    }
  }

  // タブの表示状態に合わせてタイマーを制御（バックグラウンド時は通信を止める）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopStatusTimer();
    } else {
      checkStatus(); // フォーカスが戻ったら即座に確認
      startStatusTimer();
    }
  });

  // 初回タイマー開始
  startStatusTimer();

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
window.toggleFolderCollapse = toggleFolderCollapse;
window.downloadMemo = downloadMemo;

// --- 縦タブ & ペイン制御ロジック ---
function renderPaneTabs(paneId) {
  const pel = getPaneEl(paneId);
  if (!pel.tabsList) return;
  
  pel.tabsList.innerHTML = '';
  const paneState = state.panes[paneId];
  
  if (paneState.openMemoIds.length === 0) {
    pel.tabsList.innerHTML = '<div class="no-tabs-text" style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.75rem;">開いているメモはありません</div>';
    return;
  }
  
  paneState.openMemoIds.forEach(memoId => {
    const memo = state.memos.find(m => m.id === memoId);
    if (!memo) return;
    
    const tab = document.createElement('div');
    tab.className = `pane-tab-item ${memoId === paneState.activeMemoId ? 'active' : ''}`;
    tab.setAttribute('data-memo-id', memoId);
    
    tab.innerHTML = `
      <span class="pane-tab-title" title="${escape(memo.title || '無題のメモ')}">${escape(memo.title || '無題のメモ')}</span>
      <button class="pane-tab-close-btn" title="閉じる">
        <i data-lucide="x" style="width:12px; height:12px;"></i>
      </button>
    `;
    
    // タブクリックでメモ選択
    tab.addEventListener('click', (e) => {
      if (e.target.closest('.pane-tab-close-btn')) return;
      selectPane(paneId);
      selectMemo(memoId, paneId);
    });
    
    // 閉じるボタンクリック
    const closeBtn = tab.querySelector('.pane-tab-close-btn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePaneTab(paneId, memoId);
    });
    
    pel.tabsList.appendChild(tab);
  });
  
  safeCreateIcons();
}

function closePaneTab(paneId, memoId) {
  const paneState = state.panes[paneId];
  paneState.openMemoIds = paneState.openMemoIds.filter(id => id !== memoId);
  
  if (paneState.activeMemoId === memoId) {
    if (paneState.openMemoIds.length > 0) {
      const nextActiveId = paneState.openMemoIds[paneState.openMemoIds.length - 1];
      selectMemo(nextActiveId, paneId);
    } else {
      clearPaneEditor(paneId);
    }
  } else {
    renderPaneTabs(paneId);
  }
}

function clearPaneEditor(paneId) {
  const paneState = state.panes[paneId];
  paneState.activeMemoId = null;
  
  if (paneId === state.activePaneId) {
    state.activeMemoId = null;
  }
  
  const pel = getPaneEl(paneId);
  pel.memoTitle.value = '';
  pel.memoContent.value = '';
  pel.markdownPreview.innerHTML = '';
  
  pel.memoTitle.style.display = 'none';
  pel.memoContent.style.display = 'none';
  pel.previewBtn.style.display = 'none';
  if (pel.linkCopyBtn) pel.linkCopyBtn.style.display = 'none';
  if (pel.downloadBtn) pel.downloadBtn.style.display = 'none';
  if (pel.voiceBtn) pel.voiceBtn.style.display = 'none';
  if (pel.deleteBtn) pel.deleteBtn.style.display = 'none';
  if (pel.shareBtn) pel.shareBtn.style.display = 'none';
  if (pel.addAxisBtn) pel.addAxisBtn.style.display = 'none';
  if (pel.toggleGridBtn) pel.toggleGridBtn.style.display = 'none';
  pel.memoFolderContainer.style.display = 'none';
  pel.memoTagContainer.style.display = 'none';
  if (pel.ratingPanel) pel.ratingPanel.style.display = 'none';
  
  pel.emptyState.style.display = 'block';
  
  const existingBanner = pel.memoTitle.parentNode.querySelector('.readonly-banner');
  if (existingBanner) existingBanner.remove();
  
  renderPaneTabs(paneId);
  
  if (!state.panes.left.activeMemoId && !state.panes.right.activeMemoId) {
    document.querySelectorAll('.memo-item').forEach(e => e.classList.remove('active'));
  }
}

function selectPane(paneId) {
  if (state.activePaneId === paneId) return;
  state.activePaneId = paneId;
  
  document.querySelectorAll('.editor-pane').forEach(el => {
    el.classList.remove('active');
  });
  const pel = getPaneEl(paneId);
  if (pel.container) {
    pel.container.classList.add('active');
  }
  
  state.activeMemoId = state.panes[paneId].activeMemoId;
  
  document.querySelectorAll('.memo-item').forEach(e => e.classList.remove('active'));
  const activeIds = [state.panes.left.activeMemoId, state.panes.right.activeMemoId];
  document.querySelectorAll('.memo-item').forEach(item => {
    const itemMemoId = item.getAttribute('data-memo-id');
    const mId = /^\d+$/.test(itemMemoId) ? parseInt(itemMemoId, 10) : itemMemoId;
    if (activeIds.includes(mId)) {
      item.classList.add('active');
    }
  });
}