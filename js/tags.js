// エディタ内のタグチップを描画する
function renderMemoTags(memo, paneId = state.activePaneId) {
  const pel = getPaneEl(paneId);
  if (!pel.memoTagList) return;
  
  pel.memoTagList.innerHTML = '';
  const tags = memo.tags || [];
  tags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip';
    chip.innerHTML = `
      <button class="tag-chip-remove" onclick="removeMemoTag('${escape(tag.name)}', '${paneId}')" style="margin-right: 4px; margin-left: 0;">
        <i data-lucide="x" style="width:10px; height:10px;"></i>
      </button>
      <span>${escape(tag.name)}</span>
    `;
    pel.memoTagList.appendChild(chip);
  });
  safeCreateIcons();
}

// 現在選択されているメモにタグを追加する
function addMemoTag(tagName, paneId = state.activePaneId) {
  const paneState = state.panes[paneId];
  const activeMemoId = paneState.activeMemoId;
  if (!activeMemoId) return;
  const memo = state.memos.find(m => m.id === activeMemoId);
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
  renderMemoTags(memo, paneId);
  
  // 自動保存を発火
  triggerAutosave(paneId);
  
  // オンラインならタグ一覧をサーバーから再取得
  if (state.isOnline) {
    setTimeout(fetchTags, 1500);
  }
}

// 現在選択されているメモからタグを削除する
window.removeMemoTag = (tagName, paneId = state.activePaneId) => {
  const paneState = state.panes[paneId];
  const activeMemoId = paneState.activeMemoId;
  if (!activeMemoId) return;
  const memo = state.memos.find(m => m.id === activeMemoId);
  if (!memo) return;
  
  if (!memo.tags) return;
  memo.tags = memo.tags.filter(t => t.name !== tagName);
  renderMemoTags(memo, paneId);
  
  // 自動保存を発火
  triggerAutosave(paneId);
  
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
    const isSelected = state.activeTags.includes(tag.name);
    const item = document.createElement('div');
    item.className = `tag-item ${isSelected ? 'active' : ''}`;
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
  
  safeCreateIcons();
}

// サイドバーでタグを選択した際の処理
function selectTag(tagName) {
  state.activeTagId = null; 
  state.activeFolderId = 'all'; // フォルダ選択をクリア
  
  const idx = state.activeTags.indexOf(tagName);
  if (idx !== -1) {
    // 既に選択されていれば解除
    state.activeTags.splice(idx, 1);
  } else {
    // 選択されていなければ追加
    state.activeTags.push(tagName);
    
    // 高度な検索がONで式が空の場合、最初のタグを自動で式に挿入
    if (state.tagSearchMode === 'advanced' && !state.tagQueryFormula.trim()) {
      state.tagQueryFormula = `[${tagName}]`;
    }
  }
  
  document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
  renderTags();
  renderFolders();
  renderAdvancedTagSearchUI();
  renderList();
}

// 簡易的な構文バリデーション
function checkFormulaSyntax(formula) {
  if (!formula.trim()) return { isValid: true, msg: '🟢 式が空です (全メモ表示)' };
  
  // 括弧のバランスチェック
  let stack = 0;
  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    if (char === '(') stack++;
    if (char === ')') stack--;
    if (stack < 0) return { isValid: false, msg: '🔴 閉じ括弧が開き括弧より前にあります' };
  }
  if (stack > 0) return { isValid: false, msg: '🔴 閉じ括弧が不足しています' };
  if (stack < 0) return { isValid: false, msg: '🔴 開き括弧が不足しています' };

  // 不正な文字のチェック
  let testStr = formula;
  testStr = testStr.replace(/\[([^\]]+)\]/g, 'true');
  testStr = testStr.toLowerCase();
  testStr = testStr.replace(/and/g, '&&').replace(/or/g, '||').replace(/not/g, '!');
  
  const safeRegex = /^[true|false|&|\||!|\(|\)|\s]+$/;
  if (!safeRegex.test(testStr)) {
    return { isValid: false, msg: '🔴 不正な演算子または文字が含まれています' };
  }

  // 演算子の連続チェック
  if (/&&\s*&&|\|\|\s*\|\||&&\s*\|\||\|\|\s*&&/.test(testStr)) {
    return { isValid: false, msg: '🔴 演算子が連続しています' };
  }

  return { isValid: true, msg: '🟢 式は正常です' };
}

// ポップオーバーの表示をトグルする
window.toggleAdvancedPopover = () => {
  state.isAdvancedPopoverOpen = !state.isAdvancedPopoverOpen;
  renderAdvancedTagSearchUI();
};

// 適用中の式インジケーターから式をクリアして検索
window.clearFormulaAndSearch = () => {
  clearFormula();
};

// 高度なタグ集合演算UIの描画
function renderAdvancedTagSearchUI() {
  const container = el.advancedTagSearchContainer;
  const btnOpen = el.btnOpenAdvancedSearch;
  const indicator = el.activeFormulaIndicator;
  if (!container) return;

  // 1. 高度な検索ON/OFFに応じた表示制御
  if (state.tagSearchMode !== 'advanced') {
    container.style.display = 'none';
    if (btnOpen) btnOpen.style.display = 'none';
    if (indicator) indicator.style.display = 'none';
    state.isAdvancedPopoverOpen = false;
    return;
  }

  // 高度な検索がONの場合、編集トグルボタンを表示
  if (btnOpen) btnOpen.style.display = 'inline-flex';

  // ポップオーバー本体の表示・非表示
  if (state.isAdvancedPopoverOpen) {
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }

  // 適用中の数式インジケーターの表示制御
  if (indicator) {
    if (state.tagQueryFormula.trim()) {
      indicator.style.display = 'flex';
      indicator.querySelector('.formula-text').textContent = '式: ' + state.tagQueryFormula;
    } else {
      indicator.style.display = 'none';
    }
  }

  // ポップオーバーが開いていないなら、内部描画はスキップ
  if (!state.isAdvancedPopoverOpen) return;

  container.innerHTML = '';

  // 1. 式表示＆入力エリア
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'formula-input-wrapper';
  
  const textarea = document.createElement('textarea');
  textarea.className = 'formula-textarea';
  textarea.id = 'advancedTagFormulaInput';
  textarea.placeholder = '例: ([タグA] or [タグB]) and not [タグC]';
  textarea.value = state.tagQueryFormula;
  
  // リアルタイム構文チェック
  const statusLabel = document.createElement('div');
  statusLabel.className = 'formula-status';
  const syntax = checkFormulaSyntax(state.tagQueryFormula);
  statusLabel.className = `formula-status ${syntax.isValid ? 'valid' : 'invalid'}`;
  statusLabel.textContent = syntax.msg;
  
  textarea.addEventListener('input', (e) => {
    state.tagQueryFormula = e.target.value;
    const s = checkFormulaSyntax(state.tagQueryFormula);
    statusLabel.className = `formula-status ${s.isValid ? 'valid' : 'invalid'}`;
    statusLabel.textContent = s.msg;
    
    // インジケーターも即座に同期
    if (indicator) {
      if (state.tagQueryFormula.trim()) {
        indicator.style.display = 'flex';
        indicator.querySelector('.formula-text').textContent = '式: ' + state.tagQueryFormula;
      } else {
        indicator.style.display = 'none';
      }
    }
    renderList(); // リアルタイムに絞り込み実行
  });

  inputWrapper.appendChild(textarea);
  inputWrapper.appendChild(statusLabel);
  container.appendChild(inputWrapper);

  // 2. 記号・演算子ボタンパネル (電卓風)
  const buttonsTitle = document.createElement('div');
  buttonsTitle.className = 'btn-panel-title';
  buttonsTitle.textContent = '🎛️ 記号・演算子:';
  container.appendChild(buttonsTitle);

  const buttonGrid = document.createElement('div');
  buttonGrid.className = 'button-grid';
  
  const symbols = [
    { text: '(', val: '(' },
    { text: ')', val: ')' },
    { text: 'AND', val: ' and ', type: 'op-and' },
    { text: 'OR', val: ' or ', type: 'op-or' },
    { text: 'NOT', val: ' not ', type: 'op-not' }
  ];
  
  symbols.forEach(sym => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `calc-btn ${sym.type || 'op-symbol'}`;
    btn.textContent = sym.text;
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // ポップオーバー外クリック判定を防ぐ
      insertFormulaToken(sym.val);
    });
    buttonGrid.appendChild(btn);
  });
  
  // バックスペース & クリア
  const bsBtn = document.createElement('button');
  bsBtn.type = 'button';
  bsBtn.className = 'calc-btn op-action';
  bsBtn.textContent = '⌫ 消去';
  bsBtn.title = '一字削除します';
  bsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeLastFormulaChar();
  });
  buttonGrid.appendChild(bsBtn);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'calc-btn op-action';
  clearBtn.textContent = '🗑️ クリア';
  clearBtn.title = '式をすべて消去します';
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFormula();
  });
  buttonGrid.appendChild(clearBtn);

  container.appendChild(buttonGrid);

  // 3. 選択タグボタンリスト (式に挿入用)
  const tagListTitle = document.createElement('div');
  tagListTitle.className = 'btn-panel-title';
  tagListTitle.textContent = '🏷️ 選択中のタグ (クリックで式に挿入):';
  container.appendChild(tagListTitle);

  const tagButtonsList = document.createElement('div');
  tagButtonsList.className = 'tag-buttons-list';

  if (state.activeTags.length === 0) {
    tagButtonsList.innerHTML = '<div style="font-size:0.65rem; color:var(--text-muted); font-style:italic; padding:0.2rem 0.5rem;">タグを選択してください。</div>';
  } else {
    state.activeTags.forEach(tagName => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-btn';
      btn.textContent = tagName;
      btn.title = `式に [${tagName}] を挿入します`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        insertFormulaToken(`[${tagName}]`);
      });
      tagButtonsList.appendChild(btn);
    });
  }
  container.appendChild(tagButtonsList);

  // ポップオーバー内のクリックが外クリック判定で閉じるのを防ぐ
  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  safeCreateIcons();
}

// テキストエリアのカーソル位置にトークンを挿入する
function insertFormulaToken(token) {
  const textarea = document.getElementById('advancedTagFormulaInput');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  const before = text.substring(0, start);
  const after = text.substring(end, text.length);
  
  state.tagQueryFormula = before + token + after;
  textarea.value = state.tagQueryFormula;
  
  const newCursorPos = start + token.length;
  textarea.focus();
  textarea.setSelectionRange(newCursorPos, newCursorPos);

  // インジケーターと構文チェック同期
  const indicator = el.activeFormulaIndicator;
  if (indicator) {
    if (state.tagQueryFormula.trim()) {
      indicator.style.display = 'flex';
      indicator.querySelector('.formula-text').textContent = '式: ' + state.tagQueryFormula;
    } else {
      indicator.style.display = 'none';
    }
  }

  const s = checkFormulaSyntax(state.tagQueryFormula);
  const statusLabel = document.querySelector('.formula-status');
  if (statusLabel) {
    statusLabel.className = `formula-status ${s.isValid ? 'valid' : 'invalid'}`;
    statusLabel.textContent = s.msg;
  }
  renderList();
}

// バックスペース (一字削除)
function removeLastFormulaChar() {
  const textarea = document.getElementById('advancedTagFormulaInput');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;

  if (text.length === 0) return;

  let before = '';
  let after = '';
  let newCursorPos = 0;

  if (start !== end) {
    before = text.substring(0, start);
    after = text.substring(end);
    newCursorPos = start;
  } else {
    if (start === 0) return;
    before = text.substring(0, start - 1);
    after = text.substring(start);
    newCursorPos = start - 1;
  }

  state.tagQueryFormula = before + after;
  textarea.value = state.tagQueryFormula;
  
  textarea.focus();
  textarea.setSelectionRange(newCursorPos, newCursorPos);

  const indicator = el.activeFormulaIndicator;
  if (indicator) {
    if (state.tagQueryFormula.trim()) {
      indicator.style.display = 'flex';
      indicator.querySelector('.formula-text').textContent = '式: ' + state.tagQueryFormula;
    } else {
      indicator.style.display = 'none';
    }
  }

  const s = checkFormulaSyntax(state.tagQueryFormula);
  const statusLabel = document.querySelector('.formula-status');
  if (statusLabel) {
    statusLabel.className = `formula-status ${s.isValid ? 'valid' : 'invalid'}`;
    statusLabel.textContent = s.msg;
  }
  renderList();
}

// クリア
function clearFormula() {
  state.tagQueryFormula = '';
  const textarea = document.getElementById('advancedTagFormulaInput');
  if (textarea) {
    textarea.value = '';
    textarea.focus();
  }
  
  const indicator = el.activeFormulaIndicator;
  if (indicator) {
    indicator.style.display = 'none';
  }

  const s = checkFormulaSyntax('');
  const statusLabel = document.querySelector('.formula-status');
  if (statusLabel) {
    statusLabel.className = `formula-status ${s.isValid ? 'valid' : 'invalid'}`;
    statusLabel.textContent = s.msg;
  }
  renderList();
}

// フォルダ表示とタグ表示のタブ切り替え
function switchTab(tab) {
  state.activeTab = tab;
  
  // クラスのクリア
  el.folderTabBtn.classList.remove('active');
  el.tagTabBtn.classList.remove('active');
  if (el.uploadsTabBtn) el.uploadsTabBtn.classList.remove('active');

  // セクションの表示・非表示
  el.folderSection.style.display = 'none';
  el.tagSection.style.display = 'none';
  if (el.uploadsSection) el.uploadsSection.style.display = 'none';
  
  if (tab === 'folders') {
    el.folderTabBtn.classList.add('active');
    el.folderSection.style.display = 'block';
    
    // 他のタブに移る際、画像タブは非表示にする
    if (el.uploadsTabBtn) el.uploadsTabBtn.style.display = 'none';
    
    // タグタブから切り替える際、タグの絞り込みをクリア
    state.activeTags = [];
    state.tagQueryFormula = '';
    state.isAdvancedPopoverOpen = false;
    renderTags();
    renderAdvancedTagSearchUI();
    renderFolders();
    renderList();
  } else if (tab === 'tags') {
    el.tagTabBtn.classList.add('active');
    el.tagSection.style.display = 'block';
    
    // 他のタブに移る際、画像タブは非表示にする
    if (el.uploadsTabBtn) el.uploadsTabBtn.style.display = 'none';
    
    // フォルダタブから切り替える際、フォルダの絞り込みを「すべて」にリセット
    state.activeFolderId = 'all';
    renderTags();
    renderAdvancedTagSearchUI();
    renderFolders();
    renderList();
  } else if (tab === 'uploads') {
    if (el.uploadsTabBtn) {
      el.uploadsTabBtn.style.display = 'flex';
      el.uploadsTabBtn.classList.add('active');
    }
    if (el.uploadsSection) el.uploadsSection.style.display = 'block';
    
    // 画像一覧のレンダリング
    if (typeof renderUploads === 'function') {
      renderUploads();
    }
  }
}

