// デフォルトURLと永続化された接続URLの読み込み
const DEFAULT_API_URL = "https://memo-api.7korobi.org";
let API_URL = localStorage.getItem('naomemo_api_url') || DEFAULT_API_URL;

// アプリ状態
let state = {
  memos: [],
  folders: [], // フォルダ一覧
  tags: [], // タグ一覧
  expandedFolderIds: [], // 展開されているフォルダIDのリスト
  activeMemoId: null,
  activeFolderId: 'all', // 'all' | 'uncategorized' | folder_id (number)
  activeTagId: null, // null | tag_id (number)
  activeTab: 'folders', // 'folders' | 'tags'
  searchQuery: '',
  sortBy: 'updated', // 'updated' | 'created' | 'title'
  isOnline: true,
  isPreviewActive: true, // デフォルトでビューモードにする
  isEditModeExplicit: false, // 明示的編集トグルのフラグ
  syncQueue: [],
  syncing: false,
  
  // スプリットペイン用の状態
  activePaneId: 'left', // 現在アクティブなペイン ('left' | 'right')
  isSplitView: false, // 画面分割が有効か
  panes: {
    left: { activeMemoId: null, openMemoIds: [], isPreviewActive: true, isEditModeExplicit: false, ratingFilter: 'all', ratingExpanded: false },
    right: { activeMemoId: null, openMemoIds: [], isPreviewActive: true, isEditModeExplicit: false, ratingFilter: 'all', ratingExpanded: false }
  },

  // 評価システム
  currentAxes: [],      // 現在メモの評価軸一覧
  currentRatings: [],   // 現在メモの評価データ
  currentSummary: [],   // 現在メモの集計データ
  currentUserId: null,  // 現在のユーザーID (anonymous)
  cachedUsers: [],      // フィルター用ユーザーキャッシュ
  cachedRoles: [],      // フィルター用ロールキャッシュ
  cachedRoleUsers: {},  // フィルター用ロール所属ユーザーマップ { role_id: [user_ids] }
  scratchpadPreviewActive: true // 一時メモが現在ビューモードかどうかのフラグ
};

// フォルダ操作用グローバル変数
let editingFolderId = null;
let deletingFolderId = null;
let autosaveTimer = null;

// DOM要素
const el = {
  themeSelect: document.getElementById('themeSelect'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusUrl: document.getElementById('statusUrl'),
  createBtn: document.getElementById('createBtn'),
  searchBar: document.getElementById('searchBar'),
  memoList: document.getElementById('memoList'),
  saveIndicator: document.getElementById('saveIndicator'),
  activeDbBadge: document.getElementById('activeDbBadge'),
  previewBtn: document.getElementById('previewBtn'),
  deleteBtn: document.getElementById('deleteBtn'),
  memoTitle: document.getElementById('memoTitle'),
  memoContent: document.getElementById('memoContent'),
  markdownPreview: document.getElementById('markdownPreview'),
  emptyState: document.getElementById('emptyState'),
  deleteModal: document.getElementById('deleteModal'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  apiUrlInput: document.getElementById('apiUrlInput'),
  editorWidthSlider: document.getElementById('editorWidthSlider'),
  editorWidthVal: document.getElementById('editorWidthVal'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  toastContainer: document.getElementById('toastContainer'),
  ngrokWarningBanner: document.getElementById('ngrokWarningBanner'),
  ngrokBypassBtn: document.getElementById('ngrokBypassBtn'),
  sortSelect: document.getElementById('sortSelect'),
  voiceBtn: document.getElementById('voiceBtn'),
  
  // タブおよびフォルダ・タグ表示用
  folderTabBtn: document.getElementById('folderTabBtn'),
  tagTabBtn: document.getElementById('tagTabBtn'),
  folderSection: document.getElementById('folderSection'),
  tagSection: document.getElementById('tagSection'),
  tagList: document.getElementById('tagList'),

  // フォルダ操作用
  createFolderBtn: document.getElementById('createFolderBtn'),
  folderList: document.getElementById('folderList'),
  folderModal: document.getElementById('folderModal'),
  folderModalTitle: document.getElementById('folderModalTitle'),
  folderNameInput: document.getElementById('folderNameInput'),
  cancelFolderBtn: document.getElementById('cancelFolderBtn'),
  saveFolderBtn: document.getElementById('saveFolderBtn'),
  folderParentSelect: document.getElementById('folderParentSelect'),
  deleteFolderModal: document.getElementById('deleteFolderModal'),
  deleteFolderOnlyBtn: document.getElementById('deleteFolderOnlyBtn'),
  deleteFolderAllBtn: document.getElementById('deleteFolderAllBtn'),
  cancelDeleteFolderBtn: document.getElementById('cancelDeleteFolderBtn'),
  
  // ワークスペース内のフォルダ連携・リンク用
  memoFolderContainer: document.getElementById('memoFolderContainer'),
  memoFolderSelect: document.getElementById('memoFolderSelect'),
  linkCopyBtn: document.getElementById('linkCopyBtn'),

  // タグ表示・入力用
  memoTagContainer: document.getElementById('memoTagContainer'),
  memoTagList: document.getElementById('memoTagList'),
  memoTagInput: document.getElementById('memoTagInput'),

  // ヘルプおよび画像貼り付け用
  helpBtn: document.getElementById('helpBtn'),
  helpModal: document.getElementById('helpModal'),
  closeHelpBtn: document.getElementById('closeHelpBtn'),
  imagePasteConfig: document.getElementById('imagePasteConfig'),
  imageQualitySelect: document.getElementById('imageQualitySelect'),

  // コマンドパレットおよびコマンド実行用
  commandPaletteModal: document.getElementById('commandPaletteModal'),
  commandPaletteInput: document.getElementById('commandPaletteInput'),
  commandPaletteList: document.getElementById('commandPaletteList'),
  helpCommandsList: document.getElementById('helpCommandsList'),

  // 評価システム用
  ratingPanel: document.getElementById('ratingPanel'),
  ratingAxesList: document.getElementById('ratingAxesList'),
  ratingSummaryRow: document.getElementById('ratingSummaryRow'),
  addAxisBtn: document.getElementById('addAxisBtn'),
  toggleGridBtn: document.getElementById('toggleGridBtn'),
  axisModal: document.getElementById('axisModal'),
  axisNameInput: document.getElementById('axisNameInput'),
  axisMethodSelect: document.getElementById('axisMethodSelect'),
  cancelAxisBtn: document.getElementById('cancelAxisBtn'),
  saveAxisBtn: document.getElementById('saveAxisBtn'),
  toggleGridModal: document.getElementById('toggleGridModal'),
  toggleGridHead: document.getElementById('toggleGridHead'),
  toggleGridBody: document.getElementById('toggleGridBody'),
  closeToggleGridBtn: document.getElementById('closeToggleGridBtn'),

  // 一時フローティングメモ (Scratchpad)
  scratchpadWidget: document.getElementById('scratchpadWidget'),
  scratchpadHeader: document.getElementById('scratchpadHeader'),
  scratchpadContent: document.getElementById('scratchpadContent'),
  scratchpadPreview: document.getElementById('scratchpadPreview'),
  scratchpadMinimizeBtn: document.getElementById('scratchpadMinimizeBtn'),
  scratchpadCloseBtn: document.getElementById('scratchpadCloseBtn'),
  scratchpadRestoreBtn: document.getElementById('scratchpadRestoreBtn'),
  scratchpadInsertLinkBtn: document.getElementById('scratchpadInsertLinkBtn'),
  scratchpadExportBtn: document.getElementById('scratchpadExportBtn'),
  scratchpadBadge: document.getElementById('scratchpadBadge'),
  
  // 共有＆認証
  loginModal: document.getElementById('loginModal'),
  loginModalTitle: document.getElementById('loginModalTitle'),
  loginModalSubtitle: document.getElementById('loginModalSubtitle'),
  loginFormContainer: document.getElementById('loginFormContainer'),
  registerFormContainer: document.getElementById('registerFormContainer'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  loginSubmitBtn: document.getElementById('loginSubmitBtn'),
  guestLoginBtn: document.getElementById('guestLoginBtn'),
  toRegisterLink: document.getElementById('toRegisterLink'),
  registerUsername: document.getElementById('registerUsername'),
  registerDisplayName: document.getElementById('registerDisplayName'),
  registerPassword: document.getElementById('registerPassword'),
  registerSubmitBtn: document.getElementById('registerSubmitBtn'),
  toLoginLink: document.getElementById('toLoginLink'),
  registerInviteCode: document.getElementById('registerInviteCode'),
  
  sidebarUserFooter: document.getElementById('sidebarUserFooter'),
  userDisplayName: document.getElementById('userDisplayName'),
  userUsername: document.getElementById('userUsername'),
  logoutBtn: document.getElementById('logoutBtn'),
  
  shareBtn: document.getElementById('shareBtn'),
  shareModal: document.getElementById('shareModal'),
  shareTypeSelect: document.getElementById('shareTypeSelect'),
  shareTargetInput: document.getElementById('shareTargetInput'),
  shareUserDatalist: document.getElementById('shareUserDatalist'),
  sharePermissionSelect: document.getElementById('sharePermissionSelect'),
  addShareBtn: document.getElementById('addShareBtn'),
  shareList: document.getElementById('shareList'),
  closeShareBtn: document.getElementById('closeShareBtn'),
  
  // 管理者用
  adminBtn: document.getElementById('adminBtn'),
  adminModal: document.getElementById('adminModal'),
  closeAdminBtn: document.getElementById('closeAdminBtn'),
  adminUserTableBody: document.getElementById('adminUserTableBody'),
  
  // スプリットビュー
  splitViewBtn: document.getElementById('splitViewBtn'),
  splitViewBtnText: document.getElementById('splitViewBtnText'),
  panesContainer: document.getElementById('panesContainer')
};

// ペイン固有のDOM要素へのアクセスヘルパー
function getPaneEl(paneId) {
  return {
    saveIndicator: document.getElementById(`${paneId}-saveIndicator`),
    saveIconContainer: document.getElementById(`${paneId}-saveIconContainer`),
    activeDbBadge: document.getElementById(`${paneId}-activeDbBadge`),
    themeSelect: document.getElementById(`${paneId}-themeSelect`),
    linkCopyBtn: document.getElementById(`${paneId}-linkCopyBtn`),
    voiceBtn: document.getElementById(`${paneId}-voiceBtn`),
    shareBtn: document.getElementById(`${paneId}-shareBtn`),
    previewBtn: document.getElementById(`${paneId}-previewBtn`),
    deleteBtn: document.getElementById(`${paneId}-deleteBtn`),
    downloadBtn: document.getElementById(`${paneId}-downloadBtn`),
    memoFolderContainer: document.getElementById(`${paneId}-memoFolderContainer`),
    memoFolderSelect: document.getElementById(`${paneId}-memoFolderSelect`),
    memoTagContainer: document.getElementById(`${paneId}-memoTagContainer`),
    memoTagList: document.getElementById(`${paneId}-memoTagList`),
    memoTagInput: document.getElementById(`${paneId}-memoTagInput`),
    imagePasteConfig: document.getElementById(`${paneId}-imagePasteConfig`),
    imageQualitySelect: document.getElementById(`${paneId}-imageQualitySelect`),
    ratingPanel: document.getElementById(`${paneId}-ratingPanel`),
    ratingPanelContent: document.getElementById(`${paneId}-ratingPanelContent`),
    ratingToggleIcon: document.getElementById(`${paneId}-ratingToggleIcon`),
    ratingFilterContainer: document.getElementById(`${paneId}-ratingFilterContainer`),
    ratingFilterSelect: document.getElementById(`${paneId}-ratingFilterSelect`),
    addAxisBtn: document.getElementById(`${paneId}-addAxisBtn`),
    toggleGridBtn: document.getElementById(`${paneId}-toggleGridBtn`),
    ratingAxesList: document.getElementById(`${paneId}-ratingAxesList`),
    ratingSummaryRow: document.getElementById(`${paneId}-ratingSummaryRow`),
    memoTitle: document.getElementById(`${paneId}-memoTitle`),
    memoContent: document.getElementById(`${paneId}-memoContent`),
    markdownPreview: document.getElementById(`${paneId}-markdownPreview`),
    emptyState: document.getElementById(`${paneId}-emptyState`),
    tabsSidebar: document.getElementById(`${paneId}-tabsSidebar`),
    tabsList: document.getElementById(`${paneId}-tabsList`),
    toggleTabsBtn: document.getElementById(`${paneId}-toggleTabsBtn`),
    openTabsBtn: document.getElementById(`${paneId}-openTabsBtn`),
    container: document.getElementById(`pane-${paneId}`)
  };
}

function safeCreateIcons() {
  if (typeof lucide !== 'undefined' && lucide && typeof lucide.createIcons === 'function') {
    try {
      lucide.createIcons();
    } catch (e) {
      console.error("Lucide icons creation failed:", e);
    }
  } else {
    console.warn("Lucide library is not loaded yet or unavailable. Skipping icon creation.");
  }
}
