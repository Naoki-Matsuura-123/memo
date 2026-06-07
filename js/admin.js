// --- Admin Logic ---

// モーダルを開く
async function openAdminModal() {
  if (!state.currentUser || !state.currentUser.is_admin) {
    showToast("管理者権限が必要です", "shield-alert");
    return;
  }
  
  // 初期タブをダッシュボードにする
  switchAdminTab('dashboard');
  
  el.adminModal.classList.add('active');
}

// タブ切り替え
function switchAdminTab(tabName) {
  // すべてのコンテンツを非表示にする
  document.querySelectorAll('.admin-tab-content').forEach(element => {
    element.style.display = 'none';
  });
  
  // 対象のコンテンツを表示する
  const target = document.getElementById(`adminTab-${tabName}`);
  if (target) {
    target.style.display = 'block';
  }
  
  // サイドバーのメニューのアクティブ状態を更新する
  document.querySelectorAll('.admin-menu-item').forEach(element => {
    element.classList.remove('active');
    element.style.color = 'var(--text-sub)';
  });
  
  // アクティブにするボタンを特定
  const activeBtn = Array.from(document.querySelectorAll('.admin-menu-item')).find(btn => 
    btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabName}'`)
  );
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.color = 'var(--text-main)';
  }

  // タブに応じたデータロード
  if (tabName === 'dashboard') {
    loadAdminStats();
  } else if (tabName === 'users') {
    fetchAdminUserList();
  } else if (tabName === 'registration') {
    loadAdminRegistrationSettings();
  } else if (tabName === 'shares') {
    loadAdminShares();
  } else if (tabName === 'backup') {
    loadAdminBackups();
  }
}

// 1. 利用統計ダッシュボード
async function loadAdminStats() {
  try {
    const res = await fetch(`${API_URL}/admin/stats`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const stats = await res.json();
      document.getElementById('statUsersCount').textContent = stats.users_count;
      document.getElementById('statMemosCount').textContent = stats.memos_count;
      document.getElementById('statFoldersCount').textContent = stats.folders_count;
      document.getElementById('statRatingsCount').textContent = stats.ratings_count;
      
      const sizeKB = (stats.db_size_bytes / 1024).toFixed(2);
      document.getElementById('statDbSize').textContent = `${sizeKB} KB`;
      document.getElementById('statApiServer').textContent = API_URL;
    } else {
      showToast("利用統計の取得に失敗しました", "shield-alert");
    }
  } catch (e) {
    console.error("Failed to load admin stats:", e);
    showToast("サーバー通信エラー", "shield-alert");
  }
}

// 2. ユーザー管理
async function fetchAdminUserList() {
  const tableBody = document.getElementById('adminUserTableBody');
  tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">読み込み中...</td></tr>`;
  
  try {
    const res = await fetch(`${API_URL}/users`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const users = await res.json();
      renderAdminUserList(users);
    } else {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--danger);">ユーザーリストの取得に失敗しました</td></tr>`;
    }
  } catch (e) {
    console.error("Failed to fetch user list for admin:", e);
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--danger);">サーバー通信エラーが発生しました</td></tr>`;
  }
}

function renderAdminUserList(users) {
  const tableBody = document.getElementById('adminUserTableBody');
  tableBody.innerHTML = '';
  
  if (users.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">登録されているユーザーはいません</td></tr>`;
    return;
  }
  
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--panel-border)';
    tr.style.color = 'var(--text-sub)';
    
    const isCurrentUser = state.currentUser && state.currentUser.id === u.id;
    const isGuest = u.username === 'anonymous';
    const roleText = u.is_admin ? '<span style="color:var(--warning); font-weight:600;">管理者</span>' : '一般';
    
    const cannotDelete = isCurrentUser || isGuest;
    const deleteBtnHtml = cannotDelete 
      ? `<button class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; border-color: transparent; opacity: 0.4; cursor: not-allowed;" disabled>削除不可</button>`
      : `<button class="btn-danger" onclick="deleteUserByAdmin(${u.id}, '${escape(u.username)}')" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.2); color: var(--danger); cursor:pointer; background:transparent;">削除</button>`;
      
    tr.innerHTML = `
      <td style="padding: 0.5rem 0.75rem; font-weight: 500; color: var(--text-main);">@${escape(u.username)}</td>
      <td style="padding: 0.5rem 0.75rem;">${escape(u.display_name)}</td>
      <td style="padding: 0.5rem 0.75rem;">${roleText}</td>
      <td style="padding: 0.5rem 0.75rem; text-align: right;">${deleteBtnHtml}</td>
    `;
    tableBody.appendChild(tr);
  });
}

async function deleteUserByAdmin(userId, username) {
  if (!confirm(`本当にユーザー @${username} を削除しますか？\n作成されたメモやフォルダ、評価データなど関連するすべてのデータが完全に削除され、復元はできません。`)) {
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast(`ユーザー @${username} を完全に削除しました`, 'check');
      await fetchAdminUserList();
    } else {
      const err = await res.json();
      showToast(err.detail || "ユーザーの削除に失敗しました", 'shield-alert');
    }
  } catch (e) {
    showToast("サーバーとの通信に失敗しました", 'shield-alert');
  }
}

// 3. 新規登録制限 & 招待コード
async function loadAdminRegistrationSettings() {
  try {
    // 設定を取得
    const res = await fetch(`${API_URL}/admin/settings`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const settings = await res.json();
      const regModeSetting = settings.find(s => s.key === 'registration_mode');
      const regMode = regModeSetting ? regModeSetting.value : 'open';
      
      const radio = document.querySelector(`input[name="adminRegMode"][value="${regMode}"]`);
      if (radio) {
        radio.checked = true;
      }
    }
    
    // 招待コード一覧を取得
    await loadAdminInviteCodes();
  } catch (e) {
    console.error("Failed to load registration settings:", e);
  }
}

async function saveAdminRegistrationMode() {
  const checkedRadio = document.querySelector('input[name="adminRegMode"]:checked');
  if (!checkedRadio) return;
  const value = checkedRadio.value;
  
  try {
    const res = await fetch(`${API_URL}/admin/settings/registration_mode?value=${value}`, {
      method: 'PUT',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("新規登録制限設定を保存しました", "check");
    } else {
      const err = await res.json();
      showToast(err.detail || "設定の保存に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

async function loadAdminInviteCodes() {
  const tableBody = document.getElementById('adminInviteTableBody');
  tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--text-muted);">読み込み中...</td></tr>`;
  
  try {
    const res = await fetch(`${API_URL}/admin/invites`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const invites = await res.json();
      tableBody.innerHTML = '';
      if (invites.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--text-muted);">有効な招待コードはありません</td></tr>`;
        return;
      }
      
      invites.forEach(inv => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--panel-border)';
        tr.style.color = 'var(--text-sub)';
        
        tr.innerHTML = `
          <td style="padding: 0.4rem 0.6rem; font-family: var(--font-mono); font-weight:600; color: var(--text-main);">${escape(inv.code)}</td>
          <td style="padding: 0.4rem 0.6rem;">${new Date(inv.created_at).toLocaleString()}</td>
          <td style="padding: 0.4rem 0.6rem; text-align: right;">
            <button class="btn-danger" onclick="deleteInviteCode(${inv.id})" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.2); color: var(--danger); background:transparent; cursor:pointer;">削除</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    }
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--danger);">招待コードの読み込みに失敗しました</td></tr>`;
  }
}

async function createInviteCode() {
  const input = document.getElementById('newInviteCodeInput');
  const code = input.value.trim();
  
  try {
    const res = await fetch(`${API_URL}/admin/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ code: code || null })
    });
    if (res.ok) {
      showToast("招待コードを生成しました", "check");
      input.value = '';
      await loadAdminInviteCodes();
    } else {
      const err = await res.json();
      showToast(err.detail || "招待コードの生成に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

async function deleteInviteCode(id) {
  if (!confirm("この招待コードを削除しますか？")) return;
  try {
    const res = await fetch(`${API_URL}/admin/invites/${id}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("招待コードを削除しました", "check");
      await loadAdminInviteCodes();
    } else {
      showToast("削除に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

// 4. 共有アクセス監査
async function loadAdminShares() {
  const tableBody = document.getElementById('adminShareTableBody');
  tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-muted);">読み込み中...</td></tr>`;
  
  try {
    const res = await fetch(`${API_URL}/admin/shares`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const shares = await res.json();
      tableBody.innerHTML = '';
      if (shares.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--text-muted);">現在共有されているメモはありません</td></tr>`;
        return;
      }
      
      shares.forEach(s => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--panel-border)';
        tr.style.color = 'var(--text-sub)';
        
        const typeIcon = s.target_type === 'user' ? '👤' : '👥';
        const permText = s.permission === 'write' ? '✏️ 編集' : '👀 閲覧';
        
        tr.innerHTML = `
          <td style="padding: 0.5rem 0.6rem; color:var(--text-main); font-weight:500;">${escape(s.memo_title)}</td>
          <td style="padding: 0.5rem 0.6rem;">@${escape(s.memo_owner)}</td>
          <td style="padding: 0.5rem 0.6rem;">${typeIcon} ${escape(s.target_name)}</td>
          <td style="padding: 0.5rem 0.6rem;"><span class="share-permission-badge ${s.permission}">${permText}</span></td>
          <td style="padding: 0.5rem 0.6rem; text-align: right;">
            <button class="btn-danger" onclick="deleteShareByAdmin(${s.id})" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.2); color: var(--danger); background:transparent; cursor:pointer;">解除</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
      safeCreateIcons();
    }
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1rem; color:var(--danger);">共有情報の取得に失敗しました</td></tr>`;
  }
}

async function deleteShareByAdmin(id) {
  if (!confirm("この共有設定を強制解除しますか？\nメモの所有者以外からアクセスできなくなります。")) return;
  try {
    const res = await fetch(`${API_URL}/admin/shares/${id}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("共有設定を強制解除しました", "check");
      await loadAdminShares();
    } else {
      showToast("解除に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

// 5. バックアップ管理
async function loadAdminBackups() {
  const tableBody = document.getElementById('adminBackupTableBody');
  tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted);">読み込み中...</td></tr>`;
  
  try {
    const res = await fetch(`${API_URL}/admin/backups`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const backups = await res.json();
      tableBody.innerHTML = '';
      if (backups.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted);">バックアップ履歴はありません</td></tr>`;
        return;
      }
      
      backups.forEach(b => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--panel-border)';
        tr.style.color = 'var(--text-sub)';
        
        const sizeMB = (b.size_bytes / (1024 * 1024)).toFixed(2);
        
        tr.innerHTML = `
          <td style="padding: 0.5rem 0.6rem; font-family: var(--font-mono); color:var(--text-main); font-size:0.75rem;">${escape(b.filename)}</td>
          <td style="padding: 0.5rem 0.6rem;">${sizeMB} MB</td>
          <td style="padding: 0.5rem 0.6rem;">${new Date(b.created_at).toLocaleString()}</td>
          <td style="padding: 0.5rem 0.6rem; text-align: right; display:flex; gap:0.25rem; justify-content:flex-end;">
            <button class="btn-secondary" onclick="downloadBackup('${b.filename}')" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; cursor:pointer;">DL</button>
            <button class="btn-primary" onclick="restoreBackup('${b.filename}')" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; cursor:pointer;">復元</button>
            <button class="btn-danger" onclick="deleteBackupFile('${b.filename}')" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.2); color: var(--danger); background:transparent; cursor:pointer;">削除</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    }
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--danger);">バックアップの取得に失敗しました</td></tr>`;
  }
}

async function runBackupManual() {
  try {
    showToast("バックアップを作成中...", "database");
    const res = await fetch(`${API_URL}/admin/backups/run`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("手動バックアップを作成しました", "check");
      await loadAdminBackups();
    } else {
      showToast("バックアップ作成に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

async function downloadBackup(filename) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/backups/${filename}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true'
      }
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else {
      showToast("ダウンロードに失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("ダウンロード通信エラー", "shield-alert");
  }
}

async function restoreBackup(filename) {
  if (!confirm(`本当にバックアップ ${filename} からデータベースを復元しますか？\n現在のすべてのデータは上書きされ失われます。この操作は取り消せません。`)) {
    return;
  }
  
  try {
    showToast("データベースを復元中...", "database");
    const res = await fetch(`${API_URL}/admin/backups/${filename}/restore`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("データベースを復元しました！データをリロードします。", "check");
      await checkStatus();
      await loadAdminBackups();
    } else {
      const err = await res.json();
      showToast(err.detail || "復元に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

async function deleteBackupFile(filename) {
  if (!confirm(`本当にバックアップファイル ${filename} を削除しますか？`)) return;
  try {
    const res = await fetch(`${API_URL}/admin/backups/${filename}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("バックアップファイルを削除しました", "check");
      await loadAdminBackups();
    } else {
      showToast("削除に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

// 6. データベースクリーンアップ & 最適化
async function runDatabaseCleanup() {
  const resultDiv = document.getElementById('cleanupResult');
  resultDiv.textContent = '最適化処理を実行中...';
  resultDiv.style.color = 'var(--text-sub)';
  
  try {
    const res = await fetch(`${API_URL}/admin/maintenance/cleanup`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const data = await res.json();
      resultDiv.textContent = data.message;
      resultDiv.style.color = 'var(--success)';
      showToast("最適化が完了しました", "check");
      await fetchTags();
    } else {
      resultDiv.textContent = '最適化の実行に失敗しました。';
      resultDiv.style.color = 'var(--danger)';
    }
  } catch (e) {
    resultDiv.textContent = '通信エラーが発生しました。';
    resultDiv.style.color = 'var(--danger)';
  }
}

// イベントリスニングバインディング
document.addEventListener('DOMContentLoaded', () => {
  // 管理ボタンのバインド
  if (el.adminBtn) {
    el.adminBtn.onclick = openAdminModal;
  }
  if (el.closeAdminBtn) {
    el.closeAdminBtn.onclick = () => el.adminModal.classList.remove('active');
  }
  
  // 新規登録制限設定の保存ボタン
  const saveRegModeBtn = document.getElementById('saveAdminRegModeBtn');
  if (saveRegModeBtn) {
    saveRegModeBtn.onclick = saveAdminRegistrationMode;
  }
  
  // 招待コード生成
  const createInviteBtn = document.getElementById('createInviteCodeBtn');
  if (createInviteBtn) {
    createInviteBtn.onclick = createInviteCode;
  }
  
  // 手動バックアップ実行
  const runBackupBtn = document.getElementById('runBackupManualBtn');
  if (runBackupBtn) {
    runBackupBtn.onclick = runBackupManual;
  }
  
  // クリーンアップ実行
  const runCleanupBtn = document.getElementById('runDatabaseCleanupBtn');
  if (runCleanupBtn) {
    runCleanupBtn.onclick = runDatabaseCleanup;
  }
});

// グローバルスコープに公開
window.openAdminModal = openAdminModal;
window.switchAdminTab = switchAdminTab;
window.deleteUserByAdmin = deleteUserByAdmin;
window.deleteInviteCode = deleteInviteCode;
window.deleteShareByAdmin = deleteShareByAdmin;
window.downloadBackup = downloadBackup;
window.restoreBackup = restoreBackup;
window.deleteBackupFile = deleteBackupFile;
