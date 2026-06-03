function showToast(message, iconName = 'database') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i data-lucide="${iconName}" style="width:16px; height:16px; color:var(--success);"></i><span>${message}</span>`;
  el.toastContainer.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => toast.remove(), 3000);
}

// --- キャッシュ管理 ---
function loadCache() {
  try {
    state.memos = JSON.parse(localStorage.getItem('memos_cache') || '[]');
    state.folders = JSON.parse(localStorage.getItem('folders_cache') || '[]');
    state.tags = JSON.parse(localStorage.getItem('tags_cache') || '[]');
    state.syncQueue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
  } catch (e) {
    console.error("キャッシュ読込エラー", e);
  }
}

function saveCache() {
  try {
    localStorage.setItem('memos_cache', JSON.stringify(state.memos));
    localStorage.setItem('folders_cache', JSON.stringify(state.folders));
    localStorage.setItem('tags_cache', JSON.stringify(state.tags));
    localStorage.setItem('sync_queue', JSON.stringify(state.syncQueue));
  } catch (e) {
    console.error("キャッシュ保存エラー", e);
  }
}

// --- 同期エンジン ---
async function checkStatus() {
  try {
    const response = await fetch(`${API_URL}/memos`, { 
      method: 'GET', 
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(2500) 
    });
    if (response.ok) {
      state.isOnline = true;
      updateStatusUI('online');

      if (state.syncQueue.length > 0 && !state.syncing) {
        await processSyncQueue();
      } else if (state.syncQueue.length === 0) {
        const serverMemos = await response.json();
        mergeMemos(serverMemos);
      }
      await fetchFolders();
      await fetchTags();
    } else {
      throw new Error();
    }
  } catch (err) {
    state.isOnline = false;
    updateStatusUI('offline');
  }
}

function mergeMemos(serverMemos) {
  state.memos = serverMemos;
  saveCache();
  renderList();
  renderFolders();
  if (typeof renderTags === 'function') renderTags();

  if (state.activeMemoId) {
    const active = state.memos.find(m => m.id === state.activeMemoId);
    if (active) {
      updateActiveDbBadge(active.id);
      if (document.activeElement !== el.memoTitle && document.activeElement !== el.memoContent) {
        el.memoTitle.value = active.title;
        el.memoContent.value = active.content;
        if (state.isPreviewActive) compileMarkdown();
      }
    } else {
      closeWorkspace();
    }
  }
}

async function processSyncQueue() {
  state.syncing = true;
  updateStatusUI('syncing');

  const mapping = {};
  const failed = [];
  let hadCreate = false;

  for (const item of state.syncQueue) {
    let actualId = item.id;
    if (typeof actualId === 'string' && actualId.startsWith('offline_')) {
      if (mapping[actualId]) actualId = mapping[actualId];
    }

    try {
      if (item.type === 'CREATE') {
        const res = await fetch(`${API_URL}/memos`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ title: item.title, content: item.content, folder_id: item.folder_id, tags: item.tags || [] })
        });
        if (res.ok) {
          const resData = await res.json();
          hadCreate = true;
          if (typeof item.id === 'string' && item.id.startsWith('offline_')) {
            mapping[item.id] = resData.id;
            state.memos = state.memos.map(m => m.id === item.id ? resData : m);
            if (state.activeMemoId === item.id) {
              state.activeMemoId = resData.id;
              updateActiveDbBadge(resData.id);
            }
          }
        } else {
          failed.push(item);
        }
      }
      else if (item.type === 'UPDATE') {
        if (typeof actualId === 'string' && actualId.startsWith('offline_')) {
          failed.push(item);
          continue;
        }
        const res = await fetch(`${API_URL}/memos/${actualId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ title: item.title, content: item.content, folder_id: item.folder_id, tags: item.tags || [] })
        });
        if (!res.ok) failed.push(item);
      }
      else if (item.type === 'DELETE') {
        if (typeof actualId === 'string' && actualId.startsWith('offline_')) continue;
        const res = await fetch(`${API_URL}/memos/${actualId}`, { 
          method: 'DELETE',
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok && res.status !== 404) failed.push(item);
      }
    } catch (e) {
      failed.push(item);
    }
  }

  state.syncQueue = failed;
  saveCache();

  try {
    const res = await fetch(`${API_URL}/memos`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      state.memos = await res.json();
      saveCache();
    }
  } catch (e) {}

  state.syncing = false;
  updateStatusUI('online');
  renderList();
  
  if (hadCreate) {
    showToast("未同期データをリモートSQLiteデータベースに反映しました！");
  }
}

function addQueue(type, id, title = '', content = '', folderId = null, tags = []) {
  if (type === 'UPDATE') {
    const idx = state.syncQueue.findIndex(q => q.id === id && q.type === 'UPDATE');
    if (idx !== -1) {
      state.syncQueue[idx].title = title;
      state.syncQueue[idx].content = content;
      state.syncQueue[idx].folder_id = folderId;
      state.syncQueue[idx].tags = tags;
      saveCache();
      return;
    }
  }
  state.syncQueue.push({ type, id, title, content, folder_id: folderId, tags: tags });
  saveCache();
}

// --- UI更新 ---
function updateStatusUI(status) {
  el.statusDot.className = 'status-dot';
  const savedUrl = localStorage.getItem('naomemo_api_url');
  el.statusUrl.textContent = savedUrl ? savedUrl : 'クラウド同期 (デフォルト)';
  
  if (status === 'online') {
    el.statusDot.classList.add('online');
    el.statusText.textContent = '同期完了 (SQLite)';
    setSaveMessage('saved', 'SQLiteに保存済み');
    el.ngrokWarningBanner.style.display = 'none';
  } else if (status === 'offline') {
    el.statusDot.classList.add('offline');
    el.statusText.textContent = 'オフライン（ローカル保存中）';
    setSaveMessage('saved', 'ローカル保存済み');
    if (API_URL.includes('ngrok-free.dev')) {
      el.ngrokWarningBanner.style.display = 'flex';
    } else {
      el.ngrokWarningBanner.style.display = 'none';
    }
  } else if (status === 'syncing') {
    el.statusDot.classList.add('syncing');
    el.statusText.textContent = '同期処理中...';
    setSaveMessage('saving', 'SQLiteに保存中...');
  }
}

function setSaveMessage(status, text) {
  el.saveIndicator.querySelector('span:last-child').textContent = text;
  const iconName = status === 'saving' ? 'refresh-cw' : 'check';
  document.getElementById('saveIconContainer').innerHTML = `<i data-lucide="${iconName}" style="width:14px; height:14px;"></i>`;
  lucide.createIcons();
}

function updateActiveDbBadge(id) {
  if (!id) {
    el.activeDbBadge.style.display = 'none';
    return;
  }
  el.activeDbBadge.style.display = 'inline-block';
  if (typeof id === 'string' && id.startsWith('offline_')) {
    el.activeDbBadge.innerHTML = `<i data-lucide="cloud-off" style="width:10px; height:10px; display:inline; vertical-align:middle; margin-right:2px;"></i>未同期下書き`;
    el.activeDbBadge.style.background = 'rgba(245, 158, 11, 0.1)';
    el.activeDbBadge.style.color = 'var(--warning)';
    el.activeDbBadge.style.borderColor = 'rgba(245, 158, 11, 0.2)';
  } else {
    el.activeDbBadge.innerHTML = `<i data-lucide="database" style="width:10px; height:10px; display:inline; vertical-align:middle; margin-right:2px;"></i>SQLite ID: ${id}`;
    el.activeDbBadge.style.background = 'rgba(16, 185, 129, 0.1)';
    el.activeDbBadge.style.color = 'var(--success)';
    el.activeDbBadge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
  }
  lucide.createIcons();
}

async function fetchTags() {
  if (!state.isOnline) return;
  try {
    const res = await fetch(`${API_URL}/tags`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
    if (res.ok) {
      state.tags = await res.json();
      saveCache();
      if (typeof renderTags === 'function') renderTags();
    }
  } catch (e) {
    console.error("タグ取得失敗", e);
  }
}