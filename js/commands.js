// アプリ内で利用可能なオプション・コマンド一覧と説明
const commandsList = [
  { id: 'help', name: '/help', desc: '操作ヘルプとマークダウン記法ガイドを表示します', shortcut: 'Help Button', action: () => { el.helpModal.classList.add('active'); safeCreateIcons(); } },
  { id: 'voice', name: '/voice', desc: '音声入力の開始・停止をトグル切り替えします', shortcut: 'Mic Button', action: () => toggleListening() },
  { id: 'preview', name: '/preview', desc: 'マークダウンプレビュー表示 of ON/OFFを切り替えます', shortcut: 'Eye Button', action: () => togglePreview() },
  { id: 'link', name: '/link', desc: 'このメモを繋ぐWiki風マークダウンリンクをコピーします', shortcut: 'Link Button', action: () => copyMemoLink() },
  { id: 'download', name: '/download', desc: 'このメモを画像付きのZIPパッケージ（Markdown + 画像）としてダウンロードします', shortcut: '📥 Download', action: () => downloadMemo(state.activePaneId) },
  { id: 'grid', name: '/grid', desc: 'グリッド段組テンプレート (1〜3列) を挿入します', shortcut: '📊 Grid', action: () => openGridTemplateModal() },
  { id: 'image', name: '/image', desc: 'アップロード済み画像の一覧から選択して再利用します', shortcut: '🖼️ Image', action: () => openImageReuseModal() },
  { id: 'collapse', name: '/collapse', desc: '折りたたみブロック（アコーディオン）を挿入します', shortcut: '➕ Fold', action: () => insertAccordion() },
  { id: 'delete', name: '/delete', desc: '現在編集中のメモをデータベースから完全に消去します', shortcut: 'Trash Button', action: () => { const paneState = state.panes[state.activePaneId]; if (paneState.activeMemoId) el.deleteModal.classList.add('active'); } },
  { id: 'folder-new', name: '/folder-new', desc: '新しくフォルダを作成するためのダイアログを起動します', shortcut: '+ Folder', action: () => window.openCreateFolderModal() },
  { id: 'rate', name: '/rate', desc: '評価パネルにフォーカスします（メモ選択時）', shortcut: '⭐ Rating', action: () => { const paneId = state.activePaneId; const paneState = state.panes[paneId]; if (paneState.activeMemoId) { const pel = getPaneEl(paneId); if (pel.ratingPanel) { pel.ratingPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } } else { showToast('メモを先に選択してください', 'shield-alert'); } } },
  { id: 'add-axis', name: '/add-axis', desc: '現在のメモに新しい評価軸を追加します', shortcut: '➕ Axis', action: () => { const paneState = state.panes[state.activePaneId]; if (paneState.activeMemoId) openAxisModal(); else showToast('メモを先に選択してください', 'shield-alert'); } },
  { id: 'toggle-ratings', name: '/toggle-ratings', desc: '評価の表示設定（トグルグリッド）を開きます', shortcut: '📊 Toggle', action: () => { const paneState = state.panes[state.activePaneId]; if (paneState.activeMemoId) openToggleGrid(); else showToast('メモを先に選択してください', 'shield-alert'); } },
  { id: 'theme-light', name: '/theme-light', desc: '画面テーマを Notion 風の「クリーンライト」に変更します', shortcut: 'Light Theme', action: () => { applyTheme('theme-light'); const lt = document.getElementById('left-themeSelect'); if (lt) lt.value = 'theme-light'; const rt = document.getElementById('right-themeSelect'); if (rt) rt.value = 'theme-light'; } },
  { id: 'theme-dark', name: '/theme-dark', desc: '画面テーマを高級感のある「モダンダーク」に変更します', shortcut: 'Dark Theme', action: () => { applyTheme('theme-dark'); const lt = document.getElementById('left-themeSelect'); if (lt) lt.value = 'theme-dark'; const rt = document.getElementById('right-themeSelect'); if (rt) rt.value = 'theme-dark'; } },
  { id: 'theme-sepia', name: '/theme-sepia', desc: '画面テーマを優しく暖かい「セピアブラウン」に変更します', shortcut: 'Sepia Theme', action: () => { applyTheme('theme-sepia'); const lt = document.getElementById('left-themeSelect'); if (lt) lt.value = 'theme-sepia'; const rt = document.getElementById('right-themeSelect'); if (rt) rt.value = 'theme-sepia'; } },
  { id: 'theme-nord', name: '/theme-nord', desc: '画面テーマを落ち着きある「ノルディック」に変更します', shortcut: 'Nord Theme', action: () => { applyTheme('theme-nord'); const lt = document.getElementById('left-themeSelect'); if (lt) lt.value = 'theme-nord'; const rt = document.getElementById('right-themeSelect'); if (rt) rt.value = 'theme-nord'; } },
  { id: 'clear', name: '/clear', desc: 'エディタ表示を閉じ、現在のメモの選択状態をクリアします', shortcut: 'Close View', action: () => closeWorkspace() }
];

// 折りたたみ（アコーディオン）ブロックの挿入
function insertAccordion() {
  const pel = getPaneEl(state.activePaneId);
  const textarea = pel.memoContent;
  if (!textarea) return;

  const template = `<details>\n  <summary>折りたたみのタイトル</summary>\n\n  ここに折りたたむ内容を記述します。\n</details>\n`;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  textarea.value = val.substring(0, start) + template + val.substring(end);

  // タイトル部分を選択状態にする
  const prefixLength = template.indexOf('<summary>') + '<summary>'.length;
  const selectStart = start + prefixLength;
  const selectEnd = selectStart + '折りたたみのタイトル'.length;

  textarea.setSelectionRange(selectStart, selectEnd);
  // inputイベントを手動で発火して自動保存とプレビュー更新を即トリガー
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

function openGridTemplateModal() {
  const oldModal = document.getElementById('gridTemplateModal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'gridTemplateModal';
  modal.className = 'modal active';
  modal.style.cssText = "display: flex; align-items: center; justify-content: center; z-index: 1000;";
  
  modal.innerHTML = `
    <div class="modal-content" style="background: var(--bg); border: 1px solid var(--panel-border); padding: 1.5rem; border-radius: 8px; width: 360px; max-width: 90%;">
      <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main);"><i data-lucide="layout-grid" style="width: 18px; height: 18px; color: var(--accent);"></i>グリッド段組の挿入</h3>
      
      <div class="form-group" style="margin-bottom:1rem;">
        <label class="form-label" style="display:block; font-size:0.8rem; color:var(--text-sub); margin-bottom:0.35rem;">列数（分割数）</label>
        <select id="gridColsSelect" class="theme-select" style="width:100%; padding:0.5rem; height:36px;">
          <option value="1">1列 (1分割)</option>
          <option value="2" selected>2列 (2分割)</option>
          <option value="3">3列 (3分割)</option>
        </select>
      </div>
      
      <div class="form-group" style="margin-bottom:1.5rem;">
        <label class="form-label" style="display:block; font-size:0.8rem; color:var(--text-sub); margin-bottom:0.35rem;">カード画像のアスペクト比</label>
        <select id="gridAspectSelect" class="theme-select" style="width:100%; padding:0.5rem; height:36px;">
          <option value="standard" selected>標準比率 (4 : 3)</option>
          <option value="portrait">縦長比率 (9 : 16) - スマホ向け</option>
          <option value="landscape">横長比率 (3 : 1) - バナー向け</option>
        </select>
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
        <button id="gridCancelBtn" class="btn-secondary" style="padding:0.4rem 1rem;">キャンセル</button>
        <button id="gridConfirmBtn" class="btn-primary" style="width:auto; padding:0.4rem 1.25rem;">挿入する</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  safeCreateIcons();
  
  document.getElementById('gridCancelBtn').addEventListener('click', () => modal.remove());
  document.getElementById('gridConfirmBtn').addEventListener('click', () => {
    const cols = parseInt(document.getElementById('gridColsSelect').value, 10);
    const aspect = document.getElementById('gridAspectSelect').value;
    insertGridTemplate(cols, aspect);
    modal.remove();
  });
}

function insertGridTemplate(cols, aspect) {
  const pel = getPaneEl(state.activePaneId);
  const textarea = pel.memoContent;
  if (!textarea) return;

  const aspectClass = `aspect-${aspect}`;
  const colsClass = `grid-cols-${cols}`;
  
  const dummySvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="%23f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23a0a0a0">仮画像</text></svg>`;

  let itemsHtml = '';
  for (let i = 1; i <= cols; i++) {
    itemsHtml += `  ![ここに説明テキストを入力|fit](${dummySvg})\n`;
  }
  
  const template = `<div class="memo-grid ${colsClass} ${aspectClass}">\n${itemsHtml}</div>\n`;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  textarea.value = val.substring(0, start) + template + val.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + template.length;
  
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
  showToast("グリッドテンプレートを挿入しました！", 'layout-grid');
}

function openImageReuseModal() {
  const oldModal = document.getElementById('imageReuseModal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'imageReuseModal';
  modal.className = 'modal active';
  modal.style.cssText = "display: flex; align-items: center; justify-content: center; z-index: 1000;";
  
  modal.innerHTML = `
    <div class="modal-content" style="background: var(--bg); border: 1px solid var(--panel-border); padding: 1.5rem; border-radius: 8px; width: 480px; max-width: 95%; display:flex; flex-direction:column; max-height: 80vh;">
      <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main);"><i data-lucide="image" style="width: 18px; height: 18px; color: var(--accent);"></i>アップロード済み画像一覧</h3>
      
      <div id="imageReuseList" style="flex:1; overflow-y:auto; display:grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; min-height: 200px; padding: 0.25rem;">
        <div style="grid-column: 1 / -1; text-align:center; padding:2rem; color:var(--text-muted);">読み込み中...</div>
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1rem; border-top:1px solid var(--panel-border); padding-top:0.75rem;">
        <button id="imageReuseCloseBtn" class="btn-secondary" style="padding:0.4rem 1rem;">閉じる</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  safeCreateIcons();
  
  fetch(`${API_URL}/uploads/my-images`, {
    headers: {
      'Authorization': `Bearer ${state.token}`,
      'ngrok-skip-browser-warning': 'true'
    }
  })
  .then(res => {
    if (!res.ok) throw new Error("Failed to fetch my-images");
    return res.json();
  })
  .then(data => {
    const listEl = document.getElementById('imageReuseList');
    listEl.innerHTML = '';
    
    if (!data || data.length === 0) {
      listEl.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">画像履歴が見つかりません</div>`;
      return;
    }
    
    data.forEach(img => {
      const card = document.createElement('div');
      card.className = 'grid-card';
      card.style.cssText = "cursor:pointer; border-radius:6px; overflow:hidden; border:1px solid var(--panel-border); background-color: rgba(128, 128, 128, 0.05); height: 100px;";
      
      card.innerHTML = `
        <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; background-color: rgba(0, 0, 0, 0.15);">
          <img src="${img.url}" style="width:100%; height:100%; object-fit:cover;" />
        </div>
      `;
      
      card.addEventListener('click', () => {
        insertImageMarkdown(img.url);
        showToast("選択した画像を挿入しました", 'check');
        modal.remove();
      });
      listEl.appendChild(card);
    });
  })
  .catch(err => {
    console.error(err);
    document.getElementById('imageReuseList').innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding:2rem; color:var(--danger); font-size:0.85rem;">読み込みエラーが発生しました</div>`;
  });
  
  document.getElementById('imageReuseCloseBtn').addEventListener('click', () => modal.remove());
}

let selectedCommandIndex = 0;
let filteredCommands = [...commandsList];

// コマンドパレット起動
function openCommandPalette() {
  selectedCommandIndex = 0;
  el.commandPaletteInput.value = '';
  el.commandPaletteModal.classList.add('active');
  renderCommandPalette('');
  setTimeout(() => el.commandPaletteInput.focus(), 80);
}

function closeCommandPalette() {
  el.commandPaletteModal.classList.remove('active');
  // エディタへフォーカスを戻す
  const paneState = state.panes[state.activePaneId];
  if (paneState.activeMemoId) {
    const pel = getPaneEl(state.activePaneId);
    if (pel.memoContent) pel.memoContent.focus();
  }
}

// コマンドパレットの絞り込みレンダリング
function renderCommandPalette(filterText = '') {
  el.commandPaletteList.innerHTML = '';
  const query = filterText.toLowerCase().replace(/^\//, ''); // 先頭のスラッシュを除去して検索

  filteredCommands = commandsList.filter(cmd => 
    cmd.name.toLowerCase().includes(query) || cmd.desc.toLowerCase().includes(query)
  );

  if (filteredCommands.length === 0) {
    el.commandPaletteList.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem;">一致するコマンドはありません</div>`;
    return;
  }

  if (selectedCommandIndex >= filteredCommands.length) {
    selectedCommandIndex = filteredCommands.length - 1;
  }
  if (selectedCommandIndex < 0) selectedCommandIndex = 0;

  filteredCommands.forEach((cmd, idx) => {
    const isSelected = idx === selectedCommandIndex;
    const item = document.createElement('div');
    item.className = `command-palette-item ${isSelected ? 'selected' : ''}`;
    item.innerHTML = `
      <div class="command-palette-left">
        <span class="command-name">${cmd.name}</span>
        <span class="command-desc">${cmd.desc}</span>
      </div>
      <div class="command-right">
        <span class="command-shortcut">${cmd.shortcut}</span>
      </div>
    `;
    item.addEventListener('click', () => executeCommand(cmd.id));
    el.commandPaletteList.appendChild(item);
  });
}

// ヘルプモーダルのコマンドタブにインタラクティブなボタン付一覧をレンダリング
function renderHelpCommands() {
  if (!el.helpCommandsList) return;
  el.helpCommandsList.innerHTML = '';

  commandsList.forEach(cmd => {
    const item = document.createElement('div');
    item.className = 'command-palette-item';
    item.style.cursor = 'default'; // ヘルプ内はボタン側をクリックさせるため通常カーソル
    item.innerHTML = `
      <div class="command-palette-left" style="flex:1; min-width:0;">
        <span class="command-name" style="color:var(--accent); font-size:0.9rem;">${cmd.name}</span>
        <span class="command-desc" style="white-space:normal; font-size:0.75rem;">${cmd.desc}</span>
      </div>
      <div class="command-right" style="flex-shrink:0;">
        <span class="command-shortcut" style="margin-right:0.4rem;">${cmd.shortcut}</span>
        <button class="command-run-btn" onclick="executeCommand('${cmd.id}')">実行</button>
      </div>
    `;
    el.helpCommandsList.appendChild(item);
  });
}

// コマンドの実行処理
function executeCommand(cmdId) {
  // 1. 各種モーダルを閉じる
  el.commandPaletteModal.classList.remove('active');
  el.helpModal.classList.remove('active');

  // 2. もしエディタ上でスラッシュが入力されて起動した場合、入力されたスラッシュ「/」を自動除去する
  const pel = getPaneEl(state.activePaneId);
  const textarea = pel.memoContent;
  if (textarea) {
    const text = textarea.value;
    const caretPos = textarea.selectionStart;
    
    // 直前がスラッシュであれば、それを削除
    if (textarea === document.activeElement && caretPos > 0 && text.substring(caretPos - 1, caretPos) === '/') {
      textarea.value = text.substring(0, caretPos - 1) + text.substring(caretPos);
      textarea.selectionStart = textarea.selectionEnd = caretPos - 1;
      // オートセーブをトリガー
      textarea.dispatchEvent(new Event('input'));
    }
  }

  // 3. アクションを遅延実行
  const cmd = commandsList.find(c => c.id === cmdId);
  if (cmd) {
    showToast(`コマンド「${cmd.name}」を実行しました`, 'terminal');
    setTimeout(() => cmd.action(), 50);
  }
}