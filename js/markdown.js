function processAndPasteImage(file, qualitySetting, paneId = state.activePaneId) {
  if (!state.isOnline) {
    const dummySvg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMzAwIDIwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2EwYTBhMCI+44Kq44OV44Op44Kk44Oz5Luu55S75YOPPC90ZXh0Pjwvc3ZnPg==";
    insertImageMarkdown(dummySvg, paneId);
    showToast("オフラインのため仮画像を挿入しました。レイアウト調整用です。", 'image');
    return;
  }

  // 2. オンライン時のアップロード処理
  if (qualitySetting === 'original') {
    uploadImageFile(file, file.name || 'image.jpg', paneId);
    return;
  }

  // JPEG非可逆圧縮処理の実行 (Canvasを使用)
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      let maxWidth = 1200;
      let quality = 0.75;
      
      if (qualitySetting === 'high') {
        maxWidth = 2000;
        quality = 0.85;
      }

      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          uploadImageFile(blob, file.name || 'compressed_image.jpg', paneId);
        } else {
          showToast("画像圧縮に失敗しました", 'shield-alert');
        }
      }, 'image/jpeg', quality);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function uploadImageFile(blob, filename, paneId = state.activePaneId) {
  if (!state.token) {
    showToast("ログインセッションが見つかりません", 'shield-alert');
    return;
  }

  showToast("画像をアップロード中...", 'refresh-cw');

  const formData = new FormData();
  formData.append('file', blob, filename);

  fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${state.token}`,
      'ngrok-skip-browser-warning': 'true'
    },
    body: formData
  })
  .then(res => {
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  })
  .then(data => {
    if (data && data.url) {
      insertImageMarkdown(data.url, paneId);
      showToast("画像のアップロードが完了しました！", 'check');
      if (state.activeTab === 'uploads' && typeof renderUploads === 'function') {
        renderUploads();
      }
    }
  })

  .catch(err => {
    console.error(err);
    showToast("画像のアップロードに失敗しました", 'shield-alert');
  });
}

function insertImageMarkdown(imageUrl, paneId = state.activePaneId) {
  const pel = getPaneEl(paneId);
  const textarea = pel.memoContent;
  if (!textarea) return;
  textarea.focus();
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  const selectedText = text.substring(start, end).trim();
  let markdownTag = `![貼り付け画像|fit](${imageUrl})`;
  
  if (selectedText.startsWith('![') && selectedText.includes('](')) {
    const altMatch = selectedText.match(/!\[(.*?)\]/);
    const altText = altMatch ? altMatch[1] : '貼り付け画像|fit';
    markdownTag = `![${altText}](${imageUrl})`;
    
    textarea.value = text.substring(0, start) + markdownTag + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + markdownTag.length;
  } else {
    const fullTag = `\n${markdownTag}\n`;
    textarea.value = text.substring(0, start) + fullTag + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + fullTag.length;
  }
  
  textarea.dispatchEvent(new Event('input'));
}

function syncPreviewUI(paneId = state.activePaneId, forceScrollAdjust = false) {
  const pel = getPaneEl(paneId);
  const paneState = state.panes[paneId];
  const activeMemo = state.memos.find(m => m.id === paneState.activeMemoId);
  const isReadOnlyByACL = activeMemo && activeMemo.permission === 'read';
  const viewport = pel.container ? pel.container.querySelector('.editor-viewport') : null;
  const textarea = pel.memoContent;

  // 切り替え前の状態を取得 (forceScrollAdjust が true のときのみ)
  let caretY = 0;
  let editorScrollHeight = 1;
  if (forceScrollAdjust && textarea && viewport && textarea.style.display !== 'none') {
    const position = textarea.selectionStart || 0;
    const coords = getCaretCoordinates(textarea, position);
    const textareaOffsetTop = textarea.offsetTop;
    caretY = textareaOffsetTop + coords.top;
    editorScrollHeight = viewport.scrollHeight || 1;
  }

  if (paneState.isPreviewActive) {
    // 編集 -> プレビュー
    const ratio = (forceScrollAdjust && textarea && viewport && textarea.style.display !== 'none') ? (caretY / editorScrollHeight) : 0;

    pel.previewBtn.innerHTML = '<i data-lucide="edit-3" style="width:14px; height:14px;"></i>編集';
    pel.memoContent.style.display = 'none';
    pel.markdownPreview.classList.add('active');
    pel.memoTitle.readOnly = true;
    pel.memoTitle.classList.add('readonly-title');
    compileMarkdown(paneId);

    // プレビュー表示後のスクロール位置調整
    if (forceScrollAdjust && viewport && ratio > 0) {
      const previewScrollHeight = viewport.scrollHeight || 1;
      const targetScrollTop = ratio * previewScrollHeight - 80;
      viewport.scrollTop = Math.max(0, targetScrollTop);
    }
  } else {
    // プレビュー -> 編集
    pel.previewBtn.innerHTML = '<i data-lucide="eye" style="width:14px; height:14px;"></i>プレビュー';
    pel.memoContent.style.display = 'block';
    if (typeof adjustTextareaHeight === 'function') {
      adjustTextareaHeight(textarea);
    }
    pel.markdownPreview.classList.remove('active');
    
    if (!isReadOnlyByACL) {
      pel.memoTitle.readOnly = false;
      pel.memoTitle.classList.remove('readonly-title');
    }

    // 編集表示後のスクロール位置調整
    if (forceScrollAdjust && textarea && viewport) {
      const position = textarea.selectionStart || 0;
      const coords = getCaretCoordinates(textarea, position);
      const textareaOffsetTop = textarea.offsetTop;
      const caretYAfter = textareaOffsetTop + coords.top;
      const targetScrollTop = caretYAfter - 80;
      viewport.scrollTop = Math.max(0, targetScrollTop);
    }
  }
  
  if (paneState.isEditModeExplicit) {
    pel.previewBtn.style.background = 'var(--accent-glow)';
    pel.previewBtn.style.borderColor = 'var(--accent)';
  } else {
    pel.previewBtn.style.background = '';
    pel.previewBtn.style.borderColor = '';
  }
  safeCreateIcons();
}


function togglePreview(paneId = state.activePaneId) {
  if (typeof paneId !== 'string') {
    // クリックイベントハンドラから直接呼ばれた場合、thisやeventオブジェクトが渡る可能性があるため防ぐ
    paneId = state.activePaneId;
  }
  const paneState = state.panes[paneId];
  const activeMemo = state.memos.find(m => m.id === paneState.activeMemoId);
  if (activeMemo && activeMemo.permission === 'read') {
    paneState.isPreviewActive = true;
    paneState.isEditModeExplicit = false;
    syncPreviewUI(paneId, true);
    return;
  }

  paneState.isEditModeExplicit = !paneState.isEditModeExplicit;
  paneState.isPreviewActive = !paneState.isEditModeExplicit;
  syncPreviewUI(paneId, true);
}


function compileMarkdown(paneId = state.activePaneId) {
  const pel = getPaneEl(paneId);
  const raw = pel.memoContent.value || '';
  
  // [card: url | text] 記法を解析前にHTMLに置換する処理
  let processedRaw = raw;
  
  // 1. 画像あり、または空白/テキストカード: [card: url | text]
  processedRaw = processedRaw.replace(/\[card:\s*([^|\]]*?)\s*\|\s*([^\]]*?)\]/g, (match, url, text) => {
    url = url.trim();
    text = text.trim();
    
    // A. 空白（blank / empty / 空欄）の判定
    if (url === '' || url.toLowerCase() === 'blank' || url.toLowerCase() === 'empty') {
      return `<div class="grid-card" style="background: transparent !important; border: none !important; box-shadow: none !important; pointer-events: none;">` +
             `<div class="grid-card-img-container empty-img-container" style="background: transparent !important; border: none !important; box-shadow: none !important; display: block;">` +
             `</div>` +
             (text ? `<p class="card-text" style="background: transparent !important; border-top: none !important; color: var(--text-muted) !important;">${escape(text)}</p>` : '') +
             `</div>`;
    }
    
    // B. 文字列指定 (text: 任意の文字列) の判定
    if (url.toLowerCase().startsWith('text:')) {
      const displayStr = url.substring(5).trim();
      return `<div class="grid-card">` +
             `<div class="grid-card-img-container string-card-container" style="background-color:rgba(128,128,128,0.1); border:1px dashed var(--panel-border); display:flex; align-items:center; justify-content:center; color:var(--accent); font-size:1.15rem; font-weight:700; text-align:center; padding:0.5rem; box-sizing:border-box;">` +
             `<span>${escape(displayStr)}</span>` +
             `</div>` +
             `<p class="card-text">${escape(text)}</p>` +
             `</div>`;
    }
    
    // C. 通常の画像URLとしての処理
    const fullUrl = url.startsWith('/uploads/') ? API_URL + url : url;
    return `<div class="grid-card">` +
           `<div class="grid-card-img-container">` +
           `<img src="${fullUrl}" alt="${escape(text)}" style="width:100%; height:100%; object-fit:contain; display:block;" />` +
           `</div>` +
           `<p class="card-text">${escape(text)}</p>` +
           `</div>`;
  });

  // 2. 画像なし（文章のみ、No Image表示）: [card: text]
  processedRaw = processedRaw.replace(/\[card:\s*([^|\]]+?)\]/g, (match, text) => {
    text = text.trim();
    return `<div class="grid-card">` +
           `<div class="grid-card-img-container empty-img-container" style="background-color:rgba(128,128,128,0.15); display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.75rem;">` +
           `<span>No Image</span>` +
           `</div>` +
           `<p class="card-text">${escape(text)}</p>` +
           `</div>`;
  });


  let html = marked.parse(processedRaw);
  pel.markdownPreview.innerHTML = html;

  // 後処理: YouTube動画埋め込み ＆ memo://ジャンプリンク・バッジ付与
  const anchors = pel.markdownPreview.querySelectorAll('a');
  anchors.forEach(a => {
    const url = a.getAttribute('href');
    if (!url) return;
    
    // YouTube動画の埋め込み処理
    const ymMappings = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ymMappings) {
      const videoId = ymMappings[1];
      const iframeContainer = document.createElement('div');
      iframeContainer.className = 'youtube-embed-container';
      iframeContainer.style.cssText = "position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 1rem 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.15);";
      iframeContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>`;
      
      const parent = a.parentElement;
      if (parent && parent.tagName === 'P' && parent.childNodes.length === 1) {
        parent.replaceWith(iframeContainer);
      } else {
        a.replaceWith(iframeContainer);
      }
      return;
    }

    // memo:// ジャンプリンクとインラインバッジ処理
    if (url.startsWith('memo://')) {
      const memoId = url.replace('memo://', '');
      const mId = /^\d+$/.test(memoId) ? parseInt(memoId, 10) : memoId;
      
      a.className = 'memo-link';
      a.setAttribute('data-memo-id', memoId);
      a.style.cssText = "color: var(--accent); text-decoration: underline; font-weight: 500; display:inline-block; vertical-align:middle;";
      a.removeAttribute('target');
      
      const targetMemo = state.memos.find(m => m.id === mId);
      if (targetMemo) {
        let badgeHtml = '';
        if (targetMemo.tags && targetMemo.tags.length > 0) {
          targetMemo.tags.forEach(t => {
            badgeHtml += `<span class="inline-tag-badge" style="font-size:0.65rem; background:rgba(128,128,128,0.15); color:var(--text-sub); padding:0.1rem 0.3rem; border-radius:4px; margin-left:0.25rem; display:inline-flex; align-items:center; vertical-align:middle; font-weight:500;"><i data-lucide="tag" style="width:10px; height:10px; margin-right:2px; display:inline-block; vertical-align:middle;"></i>${escape(t.name)}</span>`;
          });
        }
        if (targetMemo.average_rating !== undefined && targetMemo.average_rating !== null) {
          const starVal = (targetMemo.average_rating / 20.0).toFixed(1);
          badgeHtml += `<span class="inline-rating-badge" style="font-size:0.65rem; background:rgba(245,158,11,0.15); color:var(--warning); padding:0.1rem 0.3rem; border-radius:4px; margin-left:0.25rem; display:inline-flex; align-items:center; vertical-align:middle; font-weight:600;"><i data-lucide="star" style="width:10px; height:10px; margin-right:2px; display:inline-block; vertical-align:middle; fill:var(--warning);"></i>${starVal}</span>`;
        }
        if (badgeHtml) {
          a.insertAdjacentHTML('afterend', badgeHtml);
        }
      }
      return;
    }

    // 外部リンクは別窓で開く
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.style.cssText = "color: var(--accent); text-decoration: underline;";
  });

  // まず、memo-grid 内の img を包んでいる不要な p タグを取り除く（marked.jsの仕様対策）
  const gridImages = pel.markdownPreview.querySelectorAll('.memo-grid img');
  gridImages.forEach(img => {
    const parent = img.parentElement;
    if (parent && parent.tagName === 'P') {
      parent.replaceWith(img);
    }
  });

  // 新規追加: memo-grid 内の grid-card を包んでいる不要な p タグを取り除く
  const gridCards = pel.markdownPreview.querySelectorAll('.memo-grid .grid-card');
  gridCards.forEach(card => {
    const parent = card.parentElement;
    if (parent && parent.tagName === 'P') {
      parent.replaceWith(card);
    }
  });

  const images = pel.markdownPreview.querySelectorAll('img');
  images.forEach(img => {
    let src = img.getAttribute('src');
    if (src && src.startsWith('/uploads/')) {
      img.setAttribute('src', API_URL + src);
    }
    const alt = img.getAttribute('alt') || '';
    
    // この画像がグリッド段組テンプレート内にあるかどうかチェック
    const inGrid = img.closest('.memo-grid') !== null;
    
    if (inGrid) {
      // すでにラップ済み（再描画時）なら多重ラップを防ぐ
      if (img.parentElement.classList.contains('grid-card-img-container')) {
        return;
      }
      
      let realAlt = alt;
      let widthSetting = 'fit';
      if (alt.includes('|')) {
        const parts = alt.split('|');
        realAlt = parts[0].trim();
        widthSetting = parts[1].trim();
      }
      
      // カード構成要素の動的生成
      const card = document.createElement('div');
      card.className = 'grid-card';
      
      const imgContainer = document.createElement('div');
      imgContainer.className = 'grid-card-img-container';
      
      // DOM操作: 画像をコンテナとカードでラップ
      img.parentNode.insertBefore(card, img);
      imgContainer.appendChild(img);
      card.appendChild(imgContainer);
      
      // システムのデフォルトプレースホルダーテキストや fit キーワードを除外して説明文のみを表示
      const cleanText = realAlt.replace(/^(貼り付け画像|仮画像|ここに説明テキストを入力)$/, '').trim();
      if (cleanText) {
        const p = document.createElement('p');
        p.className = 'card-text';
        p.textContent = cleanText;
        card.appendChild(p);
      }
      
      // グリッド内の画像はCSSの object-fit: contain で制御するため、スタイルの個別初期化
      img.style.cssText = "";
      img.setAttribute('alt', cleanText);
    } else {
      // 通常の画像レイアウト（block表示）
      img.style.cssText = "max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 0.75rem 0; display: block;";
      
      if (alt.includes('|')) {
        const parts = alt.split('|');
        const realAlt = parts[0].trim();
        const width = parts[1].trim();
        
        img.setAttribute('alt', realAlt);
        const w = /^\d+$/.test(width) ? `${width}px` : width;
        img.style.width = w;
      }
    }
  });

  // 後処理: コードブロックへのヘッダーとコピーボタンの追加 (カード風表示)
  const preBlocks = pel.markdownPreview.querySelectorAll('pre');
  preBlocks.forEach(pre => {
    if (pre.querySelector('.code-block-header')) return;
    
    const codeEl = pre.querySelector('code');
    if (!codeEl) return;
    const rawCode = codeEl.innerText;
    
    let lang = 'code';
    const classes = Array.from(codeEl.classList);
    const langClass = classes.find(c => c.startsWith('language-'));
    if (langClass) {
      lang = langClass.replace('language-', '');
    }
    
    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span class="code-block-lang">${lang}</span>
      <button class="code-block-copy-btn" title="コードをコピー">
        <i data-lucide="copy" style="width:12px; height:12px;"></i>
        <span>コピー</span>
      </button>
    `;
    
    const copyBtn = header.querySelector('.code-block-copy-btn');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(rawCode).then(() => {
        const span = copyBtn.querySelector('span');
        const icon = copyBtn.querySelector('i');
        span.textContent = 'コピー完了';
        copyBtn.classList.add('copied');
        
        if (icon) {
          icon.setAttribute('data-lucide', 'check');
          safeCreateIcons();
        }
        
        setTimeout(() => {
          span.textContent = 'コピー';
          copyBtn.classList.remove('copied');
          if (icon) {
            icon.setAttribute('data-lucide', 'copy');
            safeCreateIcons();
          }
        }, 2000);
        showToast('コードをクリップボードにコピーしました！', 'copy');
      }).catch(() => {
        showToast('コピーに失敗しました', 'shield-alert');
      });
    });
    
    pre.appendChild(header);
  });

  safeCreateIcons();
}

// ==========================================
// キャレット座標計算・画像選択/挿入・自動スクロール
// ==========================================

function getCaretCoordinates(element, position) {
  const properties = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
    'MozTabSize'
  ];

  const div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';

  properties.forEach(prop => {
    style[prop] = computed[prop];
  });

  style.width = element.clientWidth + 'px';

  div.textContent = element.value.substring(0, position);

  const span = document.createElement('span');
  span.textContent = element.value.substring(position, position + 1) || '.';
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth || '0'),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth || '0'),
    height: parseInt(computed.lineHeight || '20')
  };

  document.body.removeChild(div);
  return coordinates;
}

async function fetchUploads() {
  if (!state.isOnline) return [];
  try {
    const res = await fetch(`${API_URL}/uploads/my-images`, {
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'ngrok-skip-browser-warning': 'true'
      }
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("画像一覧の取得失敗", e);
  }
  return [];
}

async function renderUploads() {
  const images = await fetchUploads();
  const listEl = el.sidebarUploadsList;
  if (!listEl) return;
  listEl.innerHTML = '';
  
  if (images.length === 0) {
    listEl.innerHTML = '<div style="grid-column: span 3; text-align: center; font-size: 0.75rem; color: var(--text-muted); padding: 1rem;">画像がありません</div>';
    return;
  }
  
  images.forEach(img => {
    const item = document.createElement('div');
    item.className = 'sidebar-upload-item';
    item.style.cssText = `
      position: relative;
      aspect-ratio: 1;
      border-radius: 4px;
      overflow: hidden;
      cursor: pointer;
      border: 1px solid var(--panel-border);
      background: var(--editor-bg);
      transition: border-color 0.2s;
    `;
    item.addEventListener('mouseenter', () => {
      item.style.borderColor = 'var(--accent)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.borderColor = 'var(--panel-border)';
    });
    
    const imgEl = document.createElement('img');
    const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    imgEl.src = `${baseUrl}${img.url}`;
    imgEl.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    
    item.appendChild(imgEl);
    
    item.addEventListener('click', () => {
      insertImageUrl(img.url);
      showToast("選択した画像のURLを挿入しました", 'check');
    });
    
    listEl.appendChild(item);
  });
}

function insertImageUrl(url) {
  const paneId = state.activePaneId;
  const pel = getPaneEl(paneId);
  const textarea = pel.memoContent;
  
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  textarea.value = text.substring(0, start) + url + text.substring(end);
  
  // カーソルを挿入したURLの直後に進める
  textarea.selectionStart = textarea.selectionEnd = start + url.length;
  
  // 編集を続けられるようにフォーカスをあてる
  textarea.focus();
  
  // inputイベントを発火して自動保存とプレビュー更新をトリガー
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}