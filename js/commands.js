// アプリ内で利用可能なオプション・コマンド一覧と説明
const commandsList = [
  { id: 'help', name: '/help', desc: '操作ヘルプとマークダウン記法ガイドを表示します', shortcut: 'Help Button', action: () => { el.helpModal.classList.add('active'); safeCreateIcons(); } },
  { id: 'voice', name: '/voice', desc: '音声入力の開始・停止をトグル切り替えします', shortcut: 'Mic Button', action: () => toggleListening() },
  { id: 'preview', name: '/preview', desc: 'マークダウンプレビュー表示 of ON/OFFを切り替えます', shortcut: 'Eye Button', action: () => togglePreview() },
  { id: 'link', name: '/link', desc: 'このメモを繋ぐWiki風マークダウンリンクをコピーします', shortcut: 'Link Button', action: () => copyMemoLink() },
  { id: 'download', name: '/download', desc: 'このメモを画像付きのZIPパッケージ（Markdown + 画像）としてダウンロードします', shortcut: '📥 Download', action: () => downloadMemo(state.activePaneId) },
  { id: 'grid', name: '/grid', desc: 'グリッド段組テンプレート (1〜3列) を挿入します', shortcut: '📊 Grid', action: () => openGridTemplateModal() },
  { id: 'image', name: '/image', desc: 'アップロード済み画像の一覧から選択して再利用します', shortcut: '🖼️ Image', action: () => openImageReuseModal() },
  { id: 'uploads', name: '/uploads', desc: '一時画像一覧を表示し、選択した圧縮画像URLを挿入します', shortcut: '🖼️ Uploads', action: () => { if (el.uploadsTabBtn) el.uploadsTabBtn.style.display = 'flex'; switchTab('uploads'); } },
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
  { id: 'rate-get', name: '/rate-get', desc: '評価サマリーを取得しクリップボードにコピーします', shortcut: '📋 Get Ratings', action: () => getRatingsCommand() },
  { id: 'rate-show', name: '/rate-show', desc: '現在の評価サマリーをエディタに挿入します', shortcut: '📊 Show Ratings', action: () => showRatingsCommand() },
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
  
  const dummyImgUrl = '/uploads/placeholder.png';

  let itemsHtml = '';
  for (let i = 1; i <= cols; i++) {
    itemsHtml += `  [card: ${dummyImgUrl} | ここに説明テキストを入力]\n`;
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
      
      const fullImgUrl = img.url.startsWith('/uploads/') ? API_URL + img.url : img.url;
      card.innerHTML = `
        <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; background-color: rgba(0, 0, 0, 0.15);">
          <img src="${fullImgUrl}" style="width:100%; height:100%; object-fit:cover;" />
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
    if (caretPos > 0 && text.substring(caretPos - 1, caretPos) === '/') {
      textarea.value = text.substring(0, caretPos - 1) + text.substring(caretPos);
      textarea.selectionStart = textarea.selectionEnd = caretPos - 1;
      // オートセーブをトリガー
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

  }

  // 3. アクションを遅延実行
  const cmd = commandsList.find(c => c.id === cmdId);
  if (cmd) {
    showToast(`コマンド「${cmd.name}」を実行しました`, 'terminal');
    setTimeout(() => cmd.action(), 50);
  }
}

// 評価 Markdown の生成
function generateRatingsMarkdown(paneId) {
  const paneState = state.panes[paneId];
  if (!paneState || !paneState.activeMemoId || typeof paneState.activeMemoId === 'string') {
    return '';
  }

  if (!state.currentAxes || state.currentAxes.length === 0) {
    return '評価データはありません。';
  }

  const filterVal = paneState.ratingFilter || 'all';

  // フィルター名の取得
  let filterLabel = '全員';
  if (filterVal === 'me') {
    filterLabel = '自分のみ';
  } else if (filterVal.startsWith('role_')) {
    const roleId = parseInt(filterVal.substring(5), 10);
    const roleObj = state.cachedRoles ? state.cachedRoles.find(r => r.id === roleId) : null;
    filterLabel = roleObj ? `ロール: ${roleObj.name}` : filterVal;
  } else if (filterVal.startsWith('user_')) {
    const targetUserId = parseInt(filterVal.substring(5), 10);
    const userObj = state.cachedUsers ? state.cachedUsers.find(u => u.id === targetUserId) : null;
    filterLabel = userObj ? `ユーザー: ${userObj.display_name} (@${userObj.username})` : filterVal;
  }

  let md = `### 評価サマリー (集計対象: ${filterLabel})\n\n`;
  md += `| 評価軸 | 評価方式 | 評価値 | 投票数 |\n`;
  md += `| --- | --- | --- | --- |\n`;

  const methodLabels = { star: '星評価', tier: 'ティア評価', numeric: '数値評価' };

  state.currentAxes.forEach(axis => {
    const axisData = state.currentRatings ? state.currentRatings.find(r => r.axis && r.axis.id === axis.id) : null;
    const allRatings = axisData ? axisData.ratings : [];

    // ① 可視性設定(トグルグリッド)と、② 集計フィルターで対象ユーザーを絞り込む
    const filteredRatings = allRatings.filter(r => {
      // 可視性トグルグリッドのチェック
      // 自分の評価は常にON。他人の評価は vis.visible !== 0 の場合のみ表示
      if (r.user_id !== state.currentUserId) {
        const userVis = state.currentVisibilityGrid ? state.currentVisibilityGrid.find(g => g.user_id === r.user_id) : null;
        const isVisible = !userVis || userVis.axes[String(axis.id)] !== 0;
        if (!isVisible) return false;
      }

      // 集計対象フィルター(ドロップダウン)のチェック
      if (filterVal === 'all') {
        return true;
      } else if (filterVal === 'me') {
        return r.user_id === state.currentUserId;
      } else if (filterVal.startsWith('role_')) {
        const roleId = parseInt(filterVal.substring(5), 10);
        const memberIds = state.cachedRoleUsers ? state.cachedRoleUsers[roleId] || [] : [];
        return memberIds.includes(r.user_id);
      } else if (filterVal.startsWith('user_')) {
        const targetUserId = parseInt(filterVal.substring(5), 10);
        return r.user_id === targetUserId;
      }
      return true;
    });

    const scores = filteredRatings.map(r => r.score).filter(s => s !== null && s !== undefined);
    
    let avg = null;
    if (scores.length > 0) {
      avg = scores.reduce((sum, val) => sum + val, 0) / scores.length;
    }

    let displayValue = '—';
    if (avg !== null) {
      if (axis.method === 'star') {
        displayValue = `★${avg.toFixed(1)}`;
      } else if (axis.method === 'tier') {
        // ティア評価の場合、投票数が最多だったティア（最頻値）を表示する
        const tierCounts = {};
        filteredRatings.forEach(r => {
          if (r.raw_value) {
            const val = r.raw_value.toUpperCase();
            tierCounts[val] = (tierCounts[val] || 0) + 1;
          }
        });
        const maxTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0];
        displayValue = maxTier ? maxTier[0] : '—';
      } else {
        displayValue = `${avg.toFixed(1)}`;
      }
    }

    const methodName = methodLabels[axis.method] || axis.method;
    md += `| ${axis.name} | ${methodName} | ${displayValue} | ${filteredRatings.length}人 |\n`;
  });

  const memo = state.memos.find(m => m.id === paneState.activeMemoId);
  if (memo && memo.adjusted_rating !== undefined && memo.adjusted_rating !== null) {
    let dateStr = "";
    if (memo.adjusted_rating_calculated_at) {
      try {
        const d = new Date(memo.adjusted_rating_calculated_at);
        const pad = n => String(n).padStart(2, '0');
        dateStr = ` (算出日時: ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())})`;
      } catch (e) {
        console.error(e);
      }
    }
    md += `\n**偏差補正評価平均 (Zスコア):** ${memo.adjusted_rating}点${dateStr}\n`;
  }

  return md;
}

function getRatingsCommand() {
  const paneId = state.activePaneId;
  const paneState = state.panes[paneId];
  if (!paneState || !paneState.activeMemoId || typeof paneState.activeMemoId === 'string') {
    showToast('メモを先に選択してください', 'shield-alert');
    return;
  }
  const md = generateRatingsMarkdown(paneId);
  if (!md) {
    showToast('評価データを取得できませんでした', 'shield-alert');
    return;
  }
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(md)
      .then(() => {
        showToast('評価サマリーをクリップボードにコピーしました！', 'check');
      })
      .catch(err => {
        console.error('Clipboard copy error:', err);
        fallbackCopyTextToClipboard(md);
      });
  } else {
    fallbackCopyTextToClipboard(md);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";  // avoid scrolling to bottom
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showToast('評価サマリーをクリップボードにコピーしました！', 'check');
    } else {
      showToast('コピーに失敗しました', 'shield-alert');
    }
  } catch (err) {
    showToast('コピーに失敗しました', 'shield-alert');
  }
  document.body.removeChild(textArea);
}

function showRatingsCommand() {
  const paneId = state.activePaneId;
  const paneState = state.panes[paneId];
  if (!paneState || !paneState.activeMemoId || typeof paneState.activeMemoId === 'string') {
    showToast('メモを先に選択してください', 'shield-alert');
    return;
  }
  const md = generateRatingsMarkdown(paneId);
  if (!md) {
    showToast('評価データを取得できませんでした', 'shield-alert');
    return;
  }

  const pel = getPaneEl(paneId);
  const textarea = pel.memoContent;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  textarea.value = val.substring(0, start) + md + val.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + md.length;

  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  showToast('評価サマリーを挿入しました！', 'check');
}