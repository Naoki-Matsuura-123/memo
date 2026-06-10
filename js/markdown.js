function processAndPasteImage(file, qualitySetting) {
  // 1. オフラインのチェック
  if (!state.isOnline) {
    const dummySvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="%23f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%23a0a0a0">オフライン仮画像</text></svg>`;
    insertImageMarkdown(dummySvg);
    showToast("オフラインのため仮画像を挿入しました。レイアウト調整用です。", 'image');
    return;
  }

  // 2. オンライン時のアップロード処理
  if (qualitySetting === 'original') {
    uploadImageFile(file, file.name || 'image.jpg');
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
          uploadImageFile(blob, file.name || 'compressed_image.jpg');
        } else {
          showToast("画像圧縮に失敗しました", 'shield-alert');
        }
      }, 'image/jpeg', quality);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function uploadImageFile(blob, filename) {
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
      insertImageMarkdown(data.url);
      showToast("画像のアップロードが完了しました！", 'check');
    }
  })
  .catch(err => {
    console.error(err);
    showToast("画像のアップロードに失敗しました", 'shield-alert');
  });
}

function insertImageMarkdown(imageUrl) {
  const textarea = el.memoContent;
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

function syncPreviewUI(paneId = state.activePaneId) {
  const pel = getPaneEl(paneId);
  const paneState = state.panes[paneId];
  const activeMemo = state.memos.find(m => m.id === paneState.activeMemoId);
  const isReadOnlyByACL = activeMemo && activeMemo.permission === 'read';

  if (paneState.isPreviewActive) {
    pel.previewBtn.innerHTML = '<i data-lucide="edit-3" style="width:14px; height:14px;"></i>編集';
    pel.memoContent.style.display = 'none';
    pel.markdownPreview.classList.add('active');
    pel.memoTitle.readOnly = true;
    pel.memoTitle.classList.add('readonly-title');
    compileMarkdown(paneId);
  } else {
    pel.previewBtn.innerHTML = '<i data-lucide="eye" style="width:14px; height:14px;"></i>プレビュー';
    pel.memoContent.style.display = 'block';
    pel.markdownPreview.classList.remove('active');
    
    if (!isReadOnlyByACL) {
      pel.memoTitle.readOnly = false;
      pel.memoTitle.classList.remove('readonly-title');
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
    syncPreviewUI(paneId);
    return;
  }

  paneState.isEditModeExplicit = !paneState.isEditModeExplicit;
  paneState.isPreviewActive = !paneState.isEditModeExplicit;
  syncPreviewUI(paneId);
}

function compileMarkdown(paneId = state.activePaneId) {
  const pel = getPaneEl(paneId);
  const raw = pel.memoContent.value || '';
  
  if (typeof marked === 'undefined') {
    pel.markdownPreview.innerHTML = `<p>${escape(raw).replace(/\n/g, '<br>')}</p>`;
    return;
  }
  
  let html = marked.parse(raw);
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

  // 後処理: 画像のサイズ指定 ![alt|width](url)
  // まず、memo-grid 内の img を包んでいる不要な p タグを取り除く（marked.jsの仕様対策）
  const gridImages = pel.markdownPreview.querySelectorAll('.memo-grid img');
  gridImages.forEach(img => {
    const parent = img.parentElement;
    if (parent && parent.tagName === 'P') {
      parent.replaceWith(img);
    }
  });

  const images = pel.markdownPreview.querySelectorAll('img');
  images.forEach(img => {
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