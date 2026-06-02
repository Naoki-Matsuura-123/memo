function processAndPasteImage(file, qualitySetting) {
  if (qualitySetting === 'original') {
    const reader = new FileReader();
    reader.onload = (event) => {
      insertImageMarkdown(event.target.result);
    };
    reader.readAsDataURL(file);
    return;
  }

  // JPEG非可逆圧縮処理の実行 (Canvasを使用)
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // デフォルトおよびカスタム（高画質例外）サイズの設定値
      let maxWidth = 1000;
      let quality = 0.65; // 軽量標準: JPEG品質 65% 非可逆圧縮
      
      if (qualitySetting === 'high') {
        maxWidth = 2000;
        quality = 0.82; // 高画質設定: JPEG品質 82%
      }

      // アスペクト比を維持したリサイズ計算
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      // HTML5 Canvasによる圧縮エンコード
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      // 白背景で塗りつぶす (PNG透過時の黒化防止)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      
      ctx.drawImage(img, 0, 0, width, height);

      // 非可逆JPEGデータURLとして出力
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      insertImageMarkdown(compressedDataUrl);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function insertImageMarkdown(dataUrl) {
  const textarea = el.memoContent;
  textarea.focus();
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  const markdownTag = `\n![貼り付け画像](${dataUrl})\n`;
  textarea.value = text.substring(0, start) + markdownTag + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + markdownTag.length;
  
  // inputイベントを手動で発火して自動保存とプレビュー更新を即トリガー
  textarea.dispatchEvent(new Event('input'));
  showToast("画像を非可逆圧縮し、超軽量データとして埋め込みました！", 'image');
}

function togglePreview() {
  state.isPreviewActive = !state.isPreviewActive;
  
  if (state.isPreviewActive) {
    el.previewBtn.innerHTML = '<i data-lucide="edit-3" style="width:14px; height:14px;"></i>編集に戻る';
    el.memoContent.style.display = 'none';
    el.markdownPreview.classList.add('active');
    compileMarkdown();
  } else {
    el.previewBtn.innerHTML = '<i data-lucide="eye" style="width:14px; height:14px;"></i>プレビュー';
    el.memoContent.style.display = 'block';
    el.markdownPreview.classList.remove('active');
  }
  lucide.createIcons();
}

function compileMarkdown() {
  const raw = el.memoContent.value || '';
  let html = escape(raw);

  // YouTube動画のパース
  // 1. [説明](YouTubeURL) の形式を置換
  html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/[^)]+)\)/g, (match, text, url) => {
    const decodedUrl = url.replace(/&amp;/g, '&');
    const m = decodedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (m) {
      const videoId = m[1];
      return `<div class="youtube-embed-container" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 1rem 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
                <iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>
              </div>`;
    }
    return match;
  });

  // 2. 単独直貼りYouTubeURLの置換 (単独行または前後にスペースがある場合)
  html = html.replace(/(?:^|\s)(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[^\s<]*))/g, (match, url, videoId) => {
    return `<div class="youtube-embed-container" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 1rem 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
              <iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>
            </div>`;
  });

  // 画像のパース ![説明](URL) or ![説明|サイズ](URL)
  html = html.replace(/!\[([^\]|]+)(?:\|([^\]]+))?\]\(([^)]+)\)/g, (match, alt, width, url) => {
    const decodedUrl = url.replace(/&amp;/g, '&');
    let style = "max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 0.75rem 0; display: block;";
    if (width) {
      // 数字のみの場合は px を補完、% 等はそのまま適用
      const w = /^\d+$/.test(width.trim()) ? `${width.trim()}px` : width.trim();
      style += ` width: ${w};`;
    }
    return `<img src="${decodedUrl}" alt="${alt}" style="${style}">`;
  });

  // リンクのパース [Text](URL) or [Text](memo://id)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const decodedUrl = url.replace(/&amp;/g, '&');
    if (decodedUrl.startsWith('memo://')) {
      const memoId = decodedUrl.replace('memo://', '');
      return `<a href="${decodedUrl}" data-memo-id="${memoId}" class="memo-link" style="color: var(--accent); text-decoration: underline; font-weight: 500;">${text}</a>`;
    }
    return `<a href="${decodedUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent); text-decoration: underline;">${text}</a>`;
  });

  html = html.replace(/```([\s\S]*?)```/gm, (m, c) => `<pre><code>${c.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^\&gt\; (.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^\s*\-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  const blocks = html.split(/\n{2,}/g).map(b => {
    if (b.trim().startsWith('<h') || b.trim().startsWith('<pre') || b.trim().startsWith('<ul') || b.trim().startsWith('<blockquote')) {
      return b;
    }
    return `<p>${b.replace(/\n/g, '<br>')}</p>`;
  });

  el.markdownPreview.innerHTML = blocks.join('');
}