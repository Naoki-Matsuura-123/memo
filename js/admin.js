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
  } else if (tabName === 'memos') {
    fetchAdminMemoList();
  } else if (tabName === 'roles') {
    loadAdminRoles();
  } else if (tabName === 'registration') {
    loadAdminRegistrationSettings();
  } else if (tabName === 'shares') {
    loadAdminShares();
  } else if (tabName === 'backup') {
    loadAdminBackups();
  } else if (tabName === 'audit') {
    loadAdminAuditLogs();
  } else if (tabName === 'tags') {
    loadAdminTags();
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
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">読み込み中...</td></tr>`;
  
  try {
    const res = await fetch(`${API_URL}/users`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const users = await res.json();
      renderAdminUserList(users);
    } else {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--danger);">ユーザーリストの取得に失敗しました</td></tr>`;
    }
  } catch (e) {
    console.error("Failed to fetch user list for admin:", e);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--danger);">サーバー通信エラーが発生しました</td></tr>`;
  }
}

function renderAdminUserList(users) {
  const tableBody = document.getElementById('adminUserTableBody');
  tableBody.innerHTML = '';
  
  if (users.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">登録されているユーザーはいません</td></tr>`;
    return;
  }
  
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--panel-border)';
    tr.style.color = 'var(--text-sub)';
    
    const isCurrentUser = state.currentUser && state.currentUser.id === u.id;
    const isGuest = u.username === 'anonymous';
    const roleText = u.is_admin ? '<span style="color:var(--warning); font-weight:600;">管理者</span>' : '一般';
    
    // 容量制限表示
    const storageUsage = u.storage_usage_bytes || 0;
    const usageMB = (storageUsage / (1024 * 1024)).toFixed(2);
    const maxStorage = 1024 * 1024 * 1024;
    const usagePercent = Math.min(100, (storageUsage / maxStorage) * 100);
    const usageBarHtml = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <div style="width: 60px; background: rgba(128,128,128,0.2); height: 6px; border-radius: 3px; overflow: hidden;">
          <div style="width: ${usagePercent}%; background: ${usagePercent > 90 ? 'var(--danger)' : 'var(--accent)'}; height: 100%;"></div>
        </div>
        <span style="font-size: 0.75rem; color:var(--text-sub);">${usageMB} MB</span>
      </div>
    `;

    // 凍結状態
    const statusTextHtml = u.is_suspended
      ? `<span style="color:var(--danger); font-weight:600;">凍結中</span>`
      : `<span style="color:var(--success); font-weight:600;">有効</span>`;

    const freezeBtnHtml = isCurrentUser || isGuest
      ? ``
      : (u.is_suspended
          ? `<button class="btn-secondary" onclick="toggleUserSuspension(${u.id}, false, '${escape(u.username)}')" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color:var(--success); border-color:var(--success); cursor:pointer; background:transparent; margin-right:0.25rem;">解除</button>`
          : `<button class="btn-secondary" onclick="toggleUserSuspension(${u.id}, true, '${escape(u.username)}')" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; color:var(--warning); border-color:var(--warning); cursor:pointer; background:transparent; margin-right:0.25rem;">凍結</button>`
        );

    const cannotDelete = isCurrentUser || isGuest;
    const deleteBtnHtml = cannotDelete 
      ? `<button class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; border-color: transparent; opacity: 0.4; cursor: not-allowed;" disabled>削除不可</button>`
      : `<button class="btn-danger" onclick="deleteUserByAdmin(${u.id}, '${escape(u.username)}')" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.2); color: var(--danger); cursor:pointer; background:transparent;">削除</button>`;
      
    tr.innerHTML = `
      <td style="padding: 0.5rem 0.75rem; font-weight: 500; color: var(--text-main);">@${escape(u.username)}</td>
      <td style="padding: 0.5rem 0.75rem;">${escape(u.display_name)}</td>
      <td style="padding: 0.5rem 0.75rem;">${usageBarHtml}</td>
      <td style="padding: 0.5rem 0.75rem;">${statusTextHtml}</td>
      <td style="padding: 0.5rem 0.75rem;">${roleText}</td>
      <td style="padding: 0.5rem 0.75rem; text-align: right; display:flex; gap:0.25rem; justify-content:flex-end;">
        ${freezeBtnHtml}
        ${deleteBtnHtml}
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

async function toggleUserSuspension(userId, suspended, username) {
  const actionText = suspended ? "凍結" : "凍結解除";
  if (!confirm(`本当にユーザー @${username} を${actionText}しますか？`)) {
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/admin/users/${userId}/status?suspended=${suspended}`, {
      method: 'PUT',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast(`ユーザー @${username} を${actionText}しました`, 'check');
      await fetchAdminUserList();
    } else {
      const err = await res.json();
      showToast(err.detail || `${actionText}に失敗しました`, 'shield-alert');
    }
  } catch (e) {
    showToast("サーバーとの通信に失敗しました", 'shield-alert');
  }
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

// 2.5 全メモ管理
async function fetchAdminMemoList(query = '') {
  const tableBody = document.getElementById('adminMemoTableBody');
  tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">読み込み中...</td></tr>`;
  try {
    const url = query ? `${API_URL}/admin/memos?q=${encodeURIComponent(query)}` : `${API_URL}/admin/memos`;
    const res = await fetch(url, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const memos = await res.json();
      renderAdminMemoList(memos);
    } else {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--danger);">メモ一覧の取得に失敗しました</td></tr>`;
    }
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--danger);">サーバー通信エラー</td></tr>`;
  }
}

function renderAdminMemoList(memos) {
  const tableBody = document.getElementById('adminMemoTableBody');
  tableBody.innerHTML = '';
  if (memos.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">メモはありません</td></tr>`;
    return;
  }
  memos.forEach(m => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--panel-border)';
    tr.style.color = 'var(--text-sub)';
    
    tr.innerHTML = `
      <td style="padding: 0.5rem 0.6rem; color:var(--text-main); font-weight:500;">${escape(m.title || '無題')}</td>
      <td style="padding: 0.5rem 0.6rem;">@${escape(m.username)}</td>
      <td style="padding: 0.5rem 0.6rem;">${new Date(m.created_at).toLocaleString()}</td>
      <td style="padding: 0.5rem 0.6rem; text-align: right; display:flex; gap:0.25rem; justify-content:flex-end;">
        <button class="btn-secondary" onclick="openTransferModal(${m.id}, '${escape(m.title)}')" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; cursor:pointer; background:transparent;">移転</button>
        <button class="btn-danger" onclick="deleteMemoByAdmin(${m.id}, '${escape(m.title)}')" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; border-color: rgba(239, 68, 68, 0.2); color: var(--danger); background:transparent; cursor:pointer;">削除</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

let transferMemoId = null;
async function openTransferModal(memoId, memoTitle) {
  transferMemoId = memoId;
  const select = document.getElementById('transferTargetUserSelect');
  select.innerHTML = '<option value="">読み込み中...</option>';
  document.getElementById('transferOwnershipModal').classList.add('active');
  try {
    const res = await fetch(`${API_URL}/users`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const users = await res.json();
      select.innerHTML = '';
      users.forEach(u => {
        if (u.username !== 'anonymous') {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = `${u.display_name} (@${u.username})`;
          select.appendChild(opt);
        }
      });
    }
  } catch (e) {
    select.innerHTML = '<option value="">読み込み失敗</option>';
  }
}

async function confirmTransfer() {
  if (!transferMemoId) return;
  const select = document.getElementById('transferTargetUserSelect');
  const targetUserId = select.value;
  if (!targetUserId) {
    showToast("移転先ユーザーを選択してください", "shield-alert");
    return;
  }
  try {
    const res = await fetch(`${API_URL}/admin/memos/${transferMemoId}/transfer?target_user_id=${targetUserId}`, {
      method: 'PUT',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("所有権を移転しました", "check");
      document.getElementById('transferOwnershipModal').classList.remove('active');
      await fetchAdminMemoList();
      if (typeof fetchMemos === 'function') {
        fetchMemos();
      }
    } else {
      const err = await res.json();
      showToast(err.detail || "移転に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

async function deleteMemoByAdmin(memoId, title) {
  if (!confirm(`本当にメモ「${title}」を強制削除しますか？`)) return;
  try {
    const res = await fetch(`${API_URL}/admin/memos/${memoId}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("メモを強制削除しました", "check");
      await fetchAdminMemoList();
      if (typeof fetchMemos === 'function') {
        fetchMemos();
      }
    } else {
      showToast("削除に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

// 2.7 ロール管理
async function loadAdminRoles() {
  const select = document.getElementById('adminRoleSelect');
  const tableBody = document.getElementById('adminRoleTableBody');
  select.innerHTML = '<option value="">読み込み中...</option>';
  tableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:1.5rem; color:var(--text-muted);">読み込み中...</td></tr>`;
  try {
    const res = await fetch(`${API_URL}/roles`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const roles = await res.json();
      select.innerHTML = '';
      tableBody.innerHTML = '';
      if (roles.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:1.5rem; color:var(--text-muted);">ロールはありません</td></tr>`;
        return;
      }
      for (const r of roles) {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        select.appendChild(opt);
        
        const usersRes = await fetch(`${API_URL}/roles/${r.id}/users`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        let membersHtml = 'なし';
        if (usersRes.ok) {
          const members = await usersRes.json();
          if (members.length > 0) {
            membersHtml = members.map(m => `
              <span style="background:rgba(128,128,128,0.15); padding:0.15rem 0.4rem; border-radius:4px; margin-right:0.25rem; font-size:0.75rem; display:inline-flex; align-items:center; gap:0.25rem;">
                @${escape(m.username)}
                <span onclick="removeUserFromRole(${r.id}, ${m.id}, '${escape(m.username)}')" style="color:var(--danger); cursor:pointer; font-weight:bold; margin-left:0.2rem;">×</span>
              </span>
            `).join('');
          }
        }
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--panel-border)';
        tr.style.color = 'var(--text-sub)';
        tr.innerHTML = `
          <td style="padding: 0.5rem 0.6rem; color:var(--text-main); font-weight:600; width:150px;">${escape(r.name)}</td>
          <td style="padding: 0.5rem 0.6rem; line-height: 1.6;">${membersHtml}</td>
        `;
        tableBody.appendChild(tr);
      }
    }
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:1.5rem; color:var(--danger);">ロールのロードに失敗しました</td></tr>`;
  }
}

async function createRole() {
  const nameInput = document.getElementById('newRoleNameInput');
  const descInput = document.getElementById('newRoleDescInput');
  const name = nameInput.value.trim();
  const desc = descInput.value.trim();
  if (!name) {
    showToast("ロール名を入力してください", "shield-alert");
    return;
  }
  try {
    const res = await fetch(`${API_URL}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ name, description: desc || null })
    });
    if (res.ok) {
      showToast("ロールを作成しました", "check");
      nameInput.value = '';
      descInput.value = '';
      await loadAdminRoles();
    } else {
      const err = await res.json();
      showToast(err.detail || "ロールの作成に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

async function addUserToRole() {
  const select = document.getElementById('adminRoleSelect');
  const usernameInput = document.getElementById('adminRoleUsernameInput');
  const roleId = select.value;
  const username = usernameInput.value.trim();
  if (!roleId || !username) {
    showToast("ロールとユーザー名を入力してください", "shield-alert");
    return;
  }
  try {
    const res = await fetch(`${API_URL}/roles/${roleId}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ username })
    });
    if (res.ok) {
      showToast("ユーザーをロールに追加しました", "check");
      usernameInput.value = '';
      await loadAdminRoles();
    } else {
      const err = await res.json();
      showToast(err.detail || "追加に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

async function removeUserFromRole(roleId, userId, username) {
  if (!confirm(`本当に @${username} をこのロールから外しますか？`)) return;
  try {
    const res = await fetch(`${API_URL}/roles/${roleId}/users/${userId}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast("ユーザーをロールから削除しました", "check");
      await loadAdminRoles();
    } else {
      showToast("削除に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

// 3. 新規登録制限 & 招待コード
async function loadAdminRegistrationSettings() {
  try {
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

// 5.5 管理操作ログ
async function loadAdminAuditLogs() {
  const tableBody = document.getElementById('adminAuditTableBody');
  tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">読み込み中...</td></tr>`;
  try {
    const res = await fetch(`${API_URL}/admin/audit-logs`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const logs = await res.json();
      tableBody.innerHTML = '';
      if (logs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">監査ログはありません</td></tr>`;
        return;
      }
      logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--panel-border)';
        tr.style.color = 'var(--text-sub)';
        
        const timestamp = new Date(log.timestamp).toLocaleString();
        const executor = log.admin_id ? `ID: ${log.admin_id}` : 'システム/緊急';
        
        tr.innerHTML = `
          <td style="padding: 0.5rem 0.6rem; font-size:0.75rem;">${timestamp}</td>
          <td style="padding: 0.5rem 0.6rem; font-weight:500;">${executor}</td>
          <td style="padding: 0.5rem 0.6rem;"><span class="action-badge" style="background:var(--sidebar-bg); border:1px solid var(--panel-border); padding:0.15rem 0.35rem; border-radius:4px; font-size:0.75rem;">${escape(log.action)}</span></td>
          <td style="padding: 0.5rem 0.6rem; font-family:var(--font-mono); font-size:0.75rem;">${escape(log.target || 'なし')}</td>
          <td style="padding: 0.5rem 0.6rem; font-size:0.8rem; color:var(--text-main);">${escape(log.details || '')}</td>
        `;
        tableBody.appendChild(tr);
      });
    } else {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--danger);">監査ログの取得に失敗しました</td></tr>`;
    }
  } catch (e) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--danger);">サーバー通信エラー</td></tr>`;
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
      if (typeof fetchTags === 'function') {
        await fetchTags();
      }
    } else {
      resultDiv.textContent = '最適化の実行に失敗しました。';
      resultDiv.style.color = 'var(--danger)';
    }
  } catch (e) {
    resultDiv.textContent = '通信エラーが発生しました。';
    resultDiv.style.color = 'var(--danger)';
  }
}

async function runUploadsCleanup() {
  const resultDiv = document.getElementById('cleanupResult');
  resultDiv.textContent = '不要画像の物理削除を実行中...';
  resultDiv.style.color = 'var(--text-sub)';
  try {
    const res = await fetch(`${API_URL}/admin/maintenance/cleanup-uploads`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const data = await res.json();
      resultDiv.textContent = data.message;
      resultDiv.style.color = 'var(--success)';
      showToast(data.message, "check");
    } else {
      resultDiv.textContent = 'クリーンアップに失敗しました。';
      resultDiv.style.color = 'var(--danger)';
    }
  } catch (e) {
    resultDiv.textContent = '通信エラーが発生しました。';
    resultDiv.style.color = 'var(--danger)';
  }
}

// 管理者パスワード変更
async function changeAdminPassword() {
  const newPwdEl = document.getElementById('adminNewPassword');
  const confirmPwdEl = document.getElementById('adminConfirmPassword');
  
  const newPassword = newPwdEl.value;
  const confirmPassword = confirmPwdEl.value;
  
  if (!newPassword || !confirmPassword) {
    showToast("すべての項目を入力してください", "shield-alert");
    return;
  }
  
  if (newPassword.length < 4) {
    showToast("パスワードは4文字以上で入力してください", "shield-alert");
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showToast("新しいパスワードと確認用パスワードが一致しません", "shield-alert");
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/admin/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ new_password: newPassword })
    });
    
    if (res.ok) {
      showToast("管理者のパスワードを変更しました", "check");
      newPwdEl.value = '';
      confirmPwdEl.value = '';
    } else {
      const err = await res.json();
      showToast(err.detail || "パスワードの変更に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
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

  const runUploadsCleanupBtn = document.getElementById('runUploadsCleanupBtn');
  if (runUploadsCleanupBtn) {
    runUploadsCleanupBtn.onclick = runUploadsCleanup;
  }
  
  // パスワード変更
  const changePwdBtn = document.getElementById('changeAdminPasswordBtn');
  if (changePwdBtn) {
    changePwdBtn.onclick = changeAdminPassword;
  }

  // 全メモ検索
  const adminMemoSearchInput = document.getElementById('adminMemoSearchInput');
  const adminMemoSearchBtn = document.getElementById('adminMemoSearchBtn');
  if (adminMemoSearchBtn && adminMemoSearchInput) {
    adminMemoSearchBtn.onclick = () => {
      fetchAdminMemoList(adminMemoSearchInput.value);
    };
    adminMemoSearchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        fetchAdminMemoList(adminMemoSearchInput.value);
      }
    };
  }

  // ロール新規作成
  const createRoleBtn = document.getElementById('createRoleBtn');
  if (createRoleBtn) {
    createRoleBtn.onclick = createRole;
  }

  // ロールへユーザー追加
  const adminAddUserToRoleBtn = document.getElementById('adminAddUserToRoleBtn');
  if (adminAddUserToRoleBtn) {
    adminAddUserToRoleBtn.onclick = addUserToRole;
  }

  // 所有権移転モーダルのアクション
  const cancelTransferBtn = document.getElementById('cancelTransferBtn');
  if (cancelTransferBtn) {
    cancelTransferBtn.onclick = () => {
      document.getElementById('transferOwnershipModal').classList.remove('active');
    };
  }
  const confirmTransferBtn = document.getElementById('confirmTransferBtn');
  if (confirmTransferBtn) {
    confirmTransferBtn.onclick = confirmTransfer;
  }
});

// 2.9 タグ管理
async function loadAdminTags() {
  try {
    const res = await fetch(`${API_URL}/admin/tags`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const tags = await res.json();
      el.adminTagTableBody.innerHTML = '';
      if (tags.length === 0) {
        el.adminTagTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1rem; color:var(--text-sub);">タグが登録されていません。</td></tr>`;
        return;
      }
      tags.forEach(tag => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--panel-border)';
        tr.innerHTML = `
          <td style="padding: 0.5rem 0.6rem; color: var(--text-sub);">${tag.id}</td>
          <td style="padding: 0.5rem 0.6rem; font-weight: 500; color: var(--text-main);">${escape(tag.name)}</td>
          <td style="padding: 0.5rem 0.6rem; color: var(--text-sub);">${tag.memo_count}</td>
          <td style="padding: 0.5rem 0.6rem; text-align: center;">
            <button class="btn-primary" onclick="deleteTagByAdmin(${tag.id}, '${escape(tag.name)}')" style="background-color: var(--danger); border-color: var(--danger); padding: 0.2rem 0.6rem; font-size: 0.75rem; height: auto; cursor: pointer;">削除</button>
          </td>
        `;
        el.adminTagTableBody.appendChild(tr);
      });
    } else {
      showToast("タグ一覧の取得に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}

async function deleteTagByAdmin(tagId, tagName) {
  if (!confirm(`本当にタグ「${tagName}」をシステム全体から強制削除しますか？\nこのタグが付けられているすべてのメモからタグが剥がされます。`)) return;
  
  try {
    const res = await fetch(`${API_URL}/admin/tags/${tagId}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      showToast(`タグ「${tagName}」を強制削除しました`, "check");
      await loadAdminTags();
      
      // グローバル側の表示更新
      if (typeof fetchTags === 'function') {
        fetchTags();
      }
      if (typeof fetchMemos === 'function') {
        fetchMemos();
      }
      if (typeof renderList === 'function') {
        renderList();
      }
    } else {
      const err = await res.json();
      showToast(err.detail || "タグの削除に失敗しました", "shield-alert");
    }
  } catch (e) {
    showToast("サーバー通信エラー", "shield-alert");
  }
}


// グローバルスコープに公開
window.openAdminModal = openAdminModal;
window.switchAdminTab = switchAdminTab;
window.deleteUserByAdmin = deleteUserByAdmin;
window.toggleUserSuspension = toggleUserSuspension;
window.deleteInviteCode = deleteInviteCode;
window.deleteShareByAdmin = deleteShareByAdmin;
window.downloadBackup = downloadBackup;
window.restoreBackup = restoreBackup;
window.deleteBackupFile = deleteBackupFile;
window.changeAdminPassword = changeAdminPassword;
window.openTransferModal = openTransferModal;
window.deleteMemoByAdmin = deleteMemoByAdmin;
window.removeUserFromRole = removeUserFromRole;
window.deleteTagByAdmin = deleteTagByAdmin;

