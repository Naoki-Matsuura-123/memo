// --- タグ機能モジュール ---

// エディタ内のタグチップを描画する
function renderMemoTags(memo) {
  el.memoTagList.innerHTML = '';
  const tags = memo.tags || [];
  tags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip';
    chip.innerHTML = `
      <span>${escape(tag.name)}</span>
      <button class="tag-chip-remove" onclick="removeMemoTag('${escape(tag.name)}')">
        <i data-lucide="x" style="width:10px; height:10px;"></i>
      </button>
    `;
    el.memoTagList.appendChild(chip);
  });
  lucide.createIcons();
}

// 現在選択されているメモにタグを追加する
function addMemoTag(tagName) {
  if (!state.activeMemoId) return;
  const memo = state.memos.find(m => m.id === state.activeMemoId);
  if (!memo) return;
  
  if (!memo.tags) memo.tags = [];
  const name = tagName.trim();
  if (!name) return;
  
  // 重複チェック
  if (memo.tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    showToast("既に同じタグが追加されています", "shield-alert");
    return;
  }
  
  // メモリ上の状態を更新
  memo.tags.push({ id: -Date.now(), name: name });
  renderMemoTags(memo);
  
  // 自動保存を発火
  triggerAutosave();
  
  // オンラインならタグ一覧をサーバーから再取得
  if (state.isOnline) {
    setTimeout(fetchTags, 1500);
  }
}

// 現在選択されているメモからタグを削除する
window.removeMemoTag = (tagName) => {
  if (!state.activeMemoId) return;
  const memo = state.memos.find(m => m.id === state.activeMemoId);
  if (!memo) return;
  
  if (!memo.tags) return;
  memo.tags = memo.tags.filter(t => t.name !== tagName);
  renderMemoTags(memo);
  
  // 自動保存を発火
  triggerAutosave();
  
  // オンラインならタグ一覧をサーバーから再取得
  if (state.isOnline) {
    setTimeout(fetchTags, 1500);
  }
};

// サイドバーのタグ一覧を描画する
function renderTags() {
  el.tagList.innerHTML = '';
  
  if (state.tags.length === 0) {
    el.tagList.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem;">タグがありません</div>';
    return;
  }
  
  state.tags.forEach(tag => {
    const item = document.createElement('div');
    item.className = `tag-item ${state.activeTagId === tag.name ? 'active' : ''}`;
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.4rem; flex:1; min-width:0;">
        <i data-lucide="tag" style="width:14px; height:14px; color:var(--accent); flex-shrink:0;"></i>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escape(tag.name)}</span>
      </div>
      <span class="count" style="font-size: 0.7rem; background: rgba(128,128,128,0.1); color: var(--text-muted); padding: 0.05rem 0.35rem; border-radius: 10px; font-weight: 500;">${tag.memo_count}</span>
    `;
    item.addEventListener('click', () => selectTag(tag.name));
    el.tagList.appendChild(item);
  });
  
  lucide.createIcons();
}

// サイドバーでタグを選択した際の処理
function selectTag(tagName) {
  if (state.activeTagId === tagName) {
    state.activeTagId = null;
  } else {
    state.activeTagId = tagName;
    state.activeFolderId = 'all'; // フォルダ選択をクリア
  }
  
  document.querySelectorAll('.tag-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
  renderTags();
  renderFolders();
  renderList();
}

// フォルダ表示とタグ表示のタブ切り替え
function switchTab(tab) {
  state.activeTab = tab;
  
  if (tab === 'folders') {
    el.folderTabBtn.classList.add('active');
    el.tagTabBtn.classList.remove('active');
    el.folderSection.style.display = 'block';
    el.tagSection.style.display = 'none';
  } else {
    el.folderTabBtn.classList.remove('active');
    el.tagTabBtn.classList.add('active');
    el.folderSection.style.display = 'none';
    el.tagSection.style.display = 'block';
    renderTags();
  }
}
