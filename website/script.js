const API_BASE_URL =
  "https://ai-x-hackathon-backend.onrender.com";


const SUBJECT_TYPE_LABELS = {
  child: "아동",
  dementia: "치매환자",
  elderly: "노인",
  disability: "장애인",
  general: "일반",
  other: "기타",
};


const GENDER_LABELS = {
  male: "남",
  female: "여",
  unknown: "-",
  other: "기타",
};


/* ==================================================
   DATA
================================================== */

let subjects = [];
let guardians = [];
let institutions = [];

let userTab = "subjects";
let authTab = "subjects";

let userSearchKeyword = "";
let userTypeFilterValue = "all";
let userAddressKeyword = "";

let authSearchKeyword = "";

let monitorSearchKeyword = "";
let monitorTypeValue = "all";

let selectedMonitorSubject = null;
let selectedGps = null;

let selectedAuthUser = null;
let selectedAuthCode = null;

const relationCache = new Map();


/* ==================================================
   ALERT
================================================== */

let alerts = [];

let alertTab = "all";
let alertStatusValue = "all";
let alertSearchKeyword = "";




/* ==================================================
   DASHBOARD
================================================== */


/*
  임시 위험도 데이터

  실제 위험도 API가 생기면
  generateMockRiskData() 부분만 교체
*/

const MOCK_RISK_SCORES = [
  85,
  76,
  72,
  68,
  54,
  35,
  31,
  28,
  24,
  21,
  18,
  16,
  14,
  12,
  10,
  8,
  6,
  5,
  4,
  3
];


const MOCK_RISK_FACTORS = [
  "GPS 경로 이탈",
  "장시간 위치 정지",
  "위험지역 접근",
  "이동 패턴 이상",
  "평소 경로 이탈",
  "-",
  "-",
  "-",
  "-",
  "-"
];


const MOCK_UPDATE_TIMES = [
  "1분 전",
  "3분 전",
  "4분 전",
  "5분 전",
  "6분 전",
  "8분 전",
  "10분 전",
  "12분 전",
  "15분 전",
  "18분 전"
];


/* ==================================================
   INTERNAL PAGE HISTORY
================================================== */

let currentPage = "dashboard";

let previousPages = [];

let isBackNavigation = false;


/* ==================================================
   MAP
================================================== */

let liveMap = null;
let subjectMarker = null;
let institutionMarkers = [];


/* ==================================================
   ELEMENTS
================================================== */

const dashboardNav =
  document.getElementById("dashboardNav");

const userNav =
  document.getElementById("userNav");

const realtimeNav =
  document.getElementById("realtimeNav");

const authNav =
  document.getElementById("authNav");

const alertNav =
  document.getElementById("alertNav");

const settingsNav =
  document.getElementById("settingsNav");

const alertSidebarBadge =
  document.getElementById("alertSidebarBadge");


const dashboardPage =
  document.getElementById("dashboardPage");

const userManagementPage =
  document.getElementById("userManagementPage");

const realtimePage =
  document.getElementById("realtimePage");

const authManagementPage =
  document.getElementById("authManagementPage");

const alertPage =
  document.getElementById("alertPage");


/* ==================================================
   DASHBOARD ELEMENTS
================================================== */

const dashboardTotalSubjects =
  document.getElementById("dashboardTotalSubjects");

const dashboardDangerCount =
  document.getElementById("dashboardDangerCount");

const dashboardCautionCount =
  document.getElementById("dashboardCautionCount");

const dashboardSafeCount =
  document.getElementById("dashboardSafeCount");

const dashboardDangerPercent =
  document.getElementById("dashboardDangerPercent");

const dashboardCautionPercent =
  document.getElementById("dashboardCautionPercent");

const dashboardSafePercent =
  document.getElementById("dashboardSafePercent");

const dashboardTodayAlerts =
  document.getElementById("dashboardTodayAlerts");

const dashboardRiskTableBody =
  document.getElementById("dashboardRiskTableBody");

const dashboardViewAllButton =
  document.getElementById("dashboardViewAllButton");


/* ==================================================
   USER
================================================== */

const addUserButton =
  document.getElementById("addUserButton");

const userSubjectTab =
  document.getElementById("userSubjectTab");

const userGuardianTab =
  document.getElementById("userGuardianTab");

const userSearchInput =
  document.getElementById("userSearchInput");

const userTypeFilter =
  document.getElementById("userTypeFilter");

const userAddressBox =
  document.getElementById("userAddressBox");

const userAddressInput =
  document.getElementById("userAddressInput");

const userTableHead =
  document.getElementById("userTableHead");

const userTableBody =
  document.getElementById("userTableBody");

const userLoading =
  document.getElementById("userLoading");

const userError =
  document.getElementById("userError");

const userTableArea =
  document.getElementById("userTableArea");

const userTotalCount =
  document.getElementById("userTotalCount");


/* ==================================================
   ADD USER
================================================== */

const addUserModal =
  document.getElementById("addUserModal");

const closeAddUserModal =
  document.getElementById("closeAddUserModal");

const addSubjectTab =
  document.getElementById("addSubjectTab");

const addGuardianTab =
  document.getElementById("addGuardianTab");

const subjectForm =
  document.getElementById("subjectForm");

const guardianForm =
  document.getElementById("guardianForm");

const submitSubjectButton =
  document.getElementById("submitSubjectButton");

const submitGuardianButton =
  document.getElementById("submitGuardianButton");


const subjectName =
  document.getElementById("subjectName");

const subjectGender =
  document.getElementById("subjectGender");

const subjectPhone =
  document.getElementById("subjectPhone");

const subjectBirthDate =
  document.getElementById("subjectBirthDate");

const subjectAddress =
  document.getElementById("subjectAddress");

const subjectAddressDetail =
  document.getElementById("subjectAddressDetail");

const subjectAddressSearchButton =
  document.getElementById("subjectAddressSearchButton");

const subjectTypeInput =
  document.getElementById("subjectType");

const subjectInstitution =
  document.getElementById("subjectInstitution");

const subjectSpecialNotes =
  document.getElementById("subjectSpecialNotes");


const guardianName =
  document.getElementById("guardianName");

const guardianGender =
  document.getElementById("guardianGender");

const guardianPhone =
  document.getElementById("guardianPhone");

const guardianBirthDate =
  document.getElementById("guardianBirthDate");

const guardianAddress =
  document.getElementById("guardianAddress");

const guardianAddressDetail =
  document.getElementById("guardianAddressDetail");

const guardianAddressSearchButton =
  document.getElementById("guardianAddressSearchButton");


/* ==================================================
   REALTIME
================================================== */

const monitorSubjectCount =
  document.getElementById("monitorSubjectCount");

const monitorSearchInput =
  document.getElementById("monitorSearchInput");

const monitorTypeFilter =
  document.getElementById("monitorTypeFilter");

const monitorSubjectList =
  document.getElementById("monitorSubjectList");

const realtimeRefreshButton =
  document.getElementById("realtimeRefreshButton");

const mapEmptyState =
  document.getElementById("mapEmptyState");

const monitorEmptyDetail =
  document.getElementById("monitorEmptyDetail");

const monitorDetailContent =
  document.getElementById("monitorDetailContent");

const monitorDetailName =
  document.getElementById("monitorDetailName");

const monitorDetailRole =
  document.getElementById("monitorDetailRole");

const monitorDetailPhone =
  document.getElementById("monitorDetailPhone");

const monitorUpdatedAt =
  document.getElementById("monitorUpdatedAt");

const monitorCoordinates =
  document.getElementById("monitorCoordinates");

const nearestInstitutionList =
  document.getElementById("nearestInstitutionList");

const focusMapButton =
  document.getElementById("focusMapButton");


/* ==================================================
   AUTH
================================================== */

const authSubjectTab =
  document.getElementById("authSubjectTab");

const authGuardianTab =
  document.getElementById("authGuardianTab");

const authSearchInput =
  document.getElementById("authSearchInput");

const authTableBody =
  document.getElementById("authTableBody");

const authTotalCount =
  document.getElementById("authTotalCount");

const refreshAuthButton =
  document.getElementById("refreshAuthButton");


/* ==================================================
   ALERT
================================================== */

const alertSearchInput =
  document.getElementById("alertSearchInput");

const alertStatusFilter =
  document.getElementById("alertStatusFilter");

const alertTableBody =
  document.getElementById("alertTableBody");

const alertTotalCount =
  document.getElementById("alertTotalCount");

const allAlertCount =
  document.getElementById("allAlertCount");

const dangerAlertCount =
  document.getElementById("dangerAlertCount");

const authAlertCount =
  document.getElementById("authAlertCount");


/* ==================================================
   USER DETAIL
================================================== */

const userDetailDrawer =
  document.getElementById("userDetailDrawer");

const closeUserDrawer =
  document.getElementById("closeUserDrawer");

const userDetailName =
  document.getElementById("userDetailName");

const userDetailRole =
  document.getElementById("userDetailRole");

const userDetailStatus =
  document.getElementById("userDetailStatus");

const userBasicInfo =
  document.getElementById("userBasicInfo");

const userRelationTitle =
  document.getElementById("userRelationTitle");

const userRelationList =
  document.getElementById("userRelationList");

const userExtraInfo =
  document.getElementById("userExtraInfo");


/* ==================================================
   AUTH DETAIL
================================================== */

const authDetailDrawer =
  document.getElementById("authDetailDrawer");

const closeAuthDrawer =
  document.getElementById("closeAuthDrawer");

const authDetailName =
  document.getElementById("authDetailName");

const authDetailRole =
  document.getElementById("authDetailRole");

const authDetailPhone =
  document.getElementById("authDetailPhone");

const authDetailType =
  document.getElementById("authDetailType");

const authDetailStatus =
  document.getElementById("authDetailStatus");

const authDetailCode =
  document.getElementById("authDetailCode");

const copyAuthCodeButton =
  document.getElementById("copyAuthCodeButton");

const issueAuthDetailButton =
  document.getElementById("issueAuthDetailButton");


/* ==================================================
   AUTH MODAL
================================================== */

const authCodeModal =
  document.getElementById("authCodeModal");

const authModalName =
  document.getElementById("authModalName");

const authModalCode =
  document.getElementById("authModalCode");

const closeAuthModal =
  document.getElementById("closeAuthModal");

const confirmAuthModal =
  document.getElementById("confirmAuthModal");

const copyModalCode =
  document.getElementById("copyModalCode");


/* ==================================================
   API
================================================== */

async function apiRequest(
  path,
  options = {}
) {

  const response =
    await fetch(
      `${API_BASE_URL}${path}`,
      options
    );


  if (!response.ok) {

    let message =
      `API 요청 실패 (${response.status})`;


    try {

      const errorData =
        await response.json();


      if (errorData.detail) {

        message =
          typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      }

    } catch (_) {}


    throw new Error(message);
  }


  const text =
    await response.text();


  if (!text) {
    return null;
  }


  try {

    return JSON.parse(text);

  } catch (_) {

    return text;
  }
}


/* ==================================================
   HELPERS
================================================== */

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function normalize(value) {

  return String(value || "")
    .replaceAll("-", "")
    .replace(/\s/g, "")
    .toLowerCase();
}


function getSubjectTypeLabel(value) {

  return (
    SUBJECT_TYPE_LABELS[
      String(value || "")
        .toLowerCase()
    ] ||
    value ||
    "-"
  );
}


function getGenderLabel(value) {

  return (
    GENDER_LABELS[
      String(value || "")
        .toLowerCase()
    ] ||
    "-"
  );
}


function formatDate(value) {

  if (!value) {
    return "-";
  }


  return String(value)
    .split("T")[0]
    .replaceAll("-", ".");
}


function formatDateTime(value) {

  if (!value) {
    return "-";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(date.getTime())
  ) {
    return String(value);
  }


  return date
    .toLocaleString(
      "ko-KR",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }
    )
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
}


function detailItem(
  label,
  value
) {

  return `
    <div class="detail-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}


function toNumber(value) {

  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : null;
}

function loadExternalScript(
  src,
  isLoaded
) {

  return new Promise(
    (resolve, reject) => {

      if (isLoaded()) {
        resolve();
        return;
      }


      const existing =
        document.querySelector(
          `script[src="${src}"]`
        );


      if (existing) {

        existing.addEventListener(
          "load",
          resolve,
          { once: true }
        );

        existing.addEventListener(
          "error",
          reject,
          { once: true }
        );

        return;
      }


      const script =
        document.createElement(
          "script"
        );


      script.src =
        src;


      script.onload =
        resolve;


      script.onerror =
        reject;


      document.head.appendChild(
        script
      );
    }
  );
}

/* ==================================================
   UI STYLE PATCH
================================================== */

function installUiPatch() {

  const oldStyle =
    document.getElementById(
      "runtimeUiPatch"
    );


  if (oldStyle) {
    oldStyle.remove();
  }


  const style =
    document.createElement("style");


  style.id =
    "runtimeUiPatch";


  style.textContent = `

    /* ============================================
       TOP BAR
    ============================================ */

.topbar {
  position: relative;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;

  padding-left: 28px !important;
  padding-right: 29px !important;

  overflow: visible !important;
  z-index: 80 !important;
}

.admin {
  margin-left: auto !important;
  position: relative;
}

    .topbar-back-button {
      display: none !important;
    }

    /* ============================================
       ADMIN
    ============================================ */

    

    .admin:hover .admin-name {
      color: #1688cf;
    }

    .admin-menu-dropdown {
      position: absolute;
      top: calc(100% - 3px);
      right: 0;
      width: 210px;
      background: #ffffff;
      border: 1px solid #e1e7eb;
      border-radius: 11px;
      box-shadow: 0 12px 35px rgba(24, 44, 58, 0.13);
      overflow: hidden;
      z-index: 9999;
    }

    .admin-dropdown-profile {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 16px;
      border-bottom: 1px solid #edf1f3;
    }

    .admin-dropdown-avatar {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      flex: 0 0 40px;
      border-radius: 50%;
      background: #eaf5fc;
      color: #1688cf;
    }

    .admin-dropdown-avatar svg {
      width: 22px;
      height: 22px;
    }

    .admin-dropdown-profile strong {
      display: block;
      margin-bottom: 3px;
      font-size: 13px;
      color: #172027;
    }

    .admin-dropdown-profile span {
      display: block;
      font-size: 11px;
      color: #7e8990;
    }

    .admin-dropdown-item {
      width: 100%;
      height: 43px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 16px;
      border: 0;
      background: #fff;
      color: #404b52;
      text-align: left;
      font-size: 12px;
      font-weight: 650;
    }

    .admin-dropdown-item:hover {
      background: #f6fafc;
    }

    .admin-dropdown-item svg {
      width: 17px;
      height: 17px;
    }

    .admin-dropdown-item.logout {
      color: #e83943;
      border-top: 1px solid #edf1f3;
    }


    /* ============================================
       DASHBOARD FIX
    ============================================ */

    .dashboard-page {
      height: 100% !important;
      overflow: hidden !important;
      padding-top: 30px !important;
      padding-bottom: 18px !important;
      display: flex !important;
      flex-direction: column !important;
    }

    .dashboard-page.hidden {
      display: none !important;
    }

    .dashboard-heading {
      flex: 0 0 auto;
      margin-bottom: 23px !important;
    }

    .dashboard-summary-grid {
      flex: 0 0 auto;
      margin-bottom: 27px !important;
    }

    .dashboard-risk-card {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      margin-bottom: 0 !important;
    }

    .dashboard-risk-header {
      flex: 0 0 auto;
    }

  .dashboard-table-wrap {
  flex: 1 1 auto;
  min-height: 0;

  overflow-y: auto !important;
  overflow-x: auto !important;
}

.dashboard-view-all {
  display: none !important;
}

    .dashboard-risk-table thead {
      position: sticky;
      top: 0;
      z-index: 3;
    }

    .dashboard-risk-table td {
      height: 52px !important;
    }

    .dashboard-info {
      flex: 0 0 42px;
      min-height: 42px !important;
    }
      
    /* ============================================
       GENERIC POPUP
    ============================================ */

    .account-overlay {
      position: fixed;
      inset: 0;
      z-index: 12000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(28, 39, 48, 0.35);
      backdrop-filter: blur(1px);
    }

    .account-dialog {
      width: min(
        600px,
        calc(100vw - 50px)
      );
      max-height: calc(100vh - 70px);
      overflow-y: auto;
      background: #fff;
      border-radius: 15px;
      box-shadow:
        0 20px 60px
        rgba(12, 29, 41, 0.20);
    }

    .account-dialog.large {
      width: min(
        760px,
        calc(100vw - 50px)
      );
    }

    .account-dialog-header {
      height: 62px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 21px;
      border-bottom: 1px solid #e8edef;
    }

    .account-dialog-header h2 {
      margin: 0;
      font-size: 17px;
    }

    .account-dialog-close {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      color: #657078;
    }

    .account-dialog-close svg {
      width: 18px;
      height: 18px;
    }

    .account-dialog-body {
      padding: 24px;
    }


    /* ============================================
       MY INFO
    ============================================ */

    .account-profile-area {
      display: grid;
      grid-template-columns: 105px 1fr;
      gap: 24px;
      align-items: center;
    }

    .account-big-avatar {
      width: 86px;
      height: 86px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #eaf5fc;
      color: #1688cf;
    }

    .account-big-avatar svg {
      width: 43px;
      height: 43px;
    }

    .account-info-grid {
      display: grid;
      grid-template-columns: 80px 1fr;
      row-gap: 13px;
      font-size: 13px;
    }

    .account-info-grid span {
      color: #7a858c;
    }

    .account-info-grid strong {
      color: #29343a;
    }


    /* ============================================
       SETTINGS
    ============================================ */

    .settings-layout {
      display: grid;
      grid-template-columns: 170px 1fr;
      min-height: 360px;
    }

    .settings-side {
      padding: 19px 14px;
      border-right: 1px solid #e8edef;
      background: #fafcfd;
    }

    .settings-menu {
      width: 100%;
      height: 43px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 12px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #56626a;
      font-size: 12px;
      font-weight: 700;
      text-align: left;
    }

    .settings-menu.active {
      background: #e6f3fb;
      color: #1688cf;
    }

    .settings-menu svg {
      width: 16px;
      height: 16px;
    }

    .settings-content {
      padding: 25px;
    }

    .settings-content h3 {
      margin: 0 0 22px;
      font-size: 16px;
    }

    .settings-field {
      display: grid;
      grid-template-columns: 105px 1fr;
      align-items: center;
      gap: 16px;
      margin-bottom: 14px;
    }

    .settings-field label {
      font-size: 12px;
      font-weight: 700;
    }

    .settings-field input {
      height: 40px;
      padding: 0 11px;
      border: 1px solid #d5dde2;
      border-radius: 7px;
      outline: none;
      font-size: 12px;
    }

    .settings-action-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 25px;
    }

    .settings-button {
      height: 39px;
      padding: 0 17px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 750;
    }

    .settings-button.cancel {
      border: 1px solid #d4dce1;
      background: white;
      color: #667179;
    }

    .settings-button.save {
      border: 0;
      background: #1688cf;
      color: white;
    }

    .notification-setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 15px 0;
      border-bottom: 1px solid #edf0f2;
    }

    .notification-setting-row strong {
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
    }

    .notification-setting-row span {
      color: #7d888f;
      font-size: 11px;
    }

    .setting-toggle {
      position: relative;
      width: 43px;
      height: 24px;
      border: 0;
      border-radius: 999px;
      background: #ccd4d9;
      padding: 0;
    }

    .setting-toggle::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      transition: .18s ease;
    }

    .setting-toggle.on {
      background: #1688cf;
    }

    .setting-toggle.on::after {
      transform: translateX(19px);
    }


    /* ============================================
       LOGOUT
    ============================================ */

    .logout-dialog {
      width: 390px;
      padding: 27px;
      background: #fff;
      border-radius: 14px;
      text-align: center;
      box-shadow:
        0 20px 60px
        rgba(12, 29, 41, .20);
    }

    .logout-icon-circle {
      width: 55px;
      height: 55px;
      display: grid;
      place-items: center;
      margin: 0 auto 15px;
      border-radius: 50%;
      background: #fff0f1;
      color: #e8323d;
    }

    .logout-icon-circle svg {
      width: 27px;
      height: 27px;
    }

    .logout-dialog h3 {
      margin: 0 0 7px;
      font-size: 17px;
    }

    .logout-dialog p {
      margin: 0 0 21px;
      color: #7b868d;
      font-size: 12px;
    }

    .logout-dialog-actions {
      display: flex;
      justify-content: center;
      gap: 8px;
    }

    .logout-dialog-actions button {
      width: 100px;
      height: 39px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 750;
    }

    .logout-cancel {
      border: 1px solid #d7dee2;
      background: #fff;
      color: #67727a;
    }

    .logout-confirm {
      border: 0;
      background: #e8323d;
      color: #fff;
    }


    @media (max-width: 900px) {

      .settings-layout {
        grid-template-columns: 1fr;
      }

      .settings-side {
        display: flex;
        gap: 7px;
        border-right: 0;
        border-bottom: 1px solid #e8edef;
      }

      .settings-menu {
        width: auto;
      }
    }
  `;


  document.head.appendChild(
    style
  );
}


/* ==================================================
   TOPBAR + ADMIN MENU
================================================== */

function setupTopbar() {

  const topbar =
    document.querySelector(
      ".topbar"
    );


  if (!topbar) {
    return;
  }


  /*
    기존 뒤로가기 버튼이 남아 있으면 제거
  */

  document
    .getElementById(
      "topbarBackButton"
    )
    ?.remove();


  document
    .getElementById(
      "sidebarBackButton"
    )
    ?.remove();


  /*
    기존 빈 div 있으면 제거
  */

  Array.from(
    topbar.children
  )
    .forEach(
      child => {

        if (
          child.tagName === "DIV" &&
          !child.classList.contains(
            "admin"
          ) &&
          !child.id &&
          child.children.length === 0 &&
          !child.textContent.trim()
        ) {

          child.remove();
        }
      }
    );


  const admin =
    topbar.querySelector(
      ".admin"
    );


  if (!admin) {
    return;
  }


  admin.setAttribute(
    "role",
    "button"
  );


  admin.setAttribute(
    "tabindex",
    "0"
  );


  if (
    !admin.dataset.menuReady
  ) {

    admin.dataset.menuReady =
      "true";


    admin.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        toggleAdminMenu();
      }
    );


    admin.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {

          event.preventDefault();
          event.stopPropagation();

          toggleAdminMenu();
        }
      }
    );
  }


  if (window.lucide) {
    lucide.createIcons();
  }
}


function toggleAdminMenu() {

  const admin =
    document.querySelector(
      ".admin"
    );


  if (!admin) {
    return;
  }


  const existing =
    document.getElementById(
      "adminMenuDropdown"
    );


  if (existing) {

    existing.remove();

    return;
  }


  const menu =
    document.createElement(
      "div"
    );


  menu.id =
    "adminMenuDropdown";


  menu.className =
    "admin-menu-dropdown";


  menu.innerHTML =
    `

      <div class="admin-dropdown-profile">

        <div class="admin-dropdown-avatar">
          <i data-lucide="user-round"></i>
        </div>

        <div>
          <strong>홍길동</strong>
          <span>관리자</span>
        </div>

      </div>


      <button
        id="myInfoMenuButton"
        class="admin-dropdown-item"
        type="button"
      >
        <i data-lucide="user"></i>
        내 정보
      </button>


      <button
        id="accountSettingsMenuButton"
        class="admin-dropdown-item"
        type="button"
      >
        <i data-lucide="settings"></i>
        설정
      </button>


      <button
        id="logoutMenuButton"
        class="admin-dropdown-item logout"
        type="button"
      >
        <i data-lucide="log-out"></i>
        로그아웃
      </button>
    `;


  admin.appendChild(
    menu
  );


  menu.addEventListener(
    "click",
    event => {

      event.stopPropagation();
    }
  );


  document
    .getElementById(
      "myInfoMenuButton"
    )
    ?.addEventListener(
      "click",
      () => {

        menu.remove();

        openMyInfoModal();
      }
    );


  document
    .getElementById(
      "accountSettingsMenuButton"
    )
    ?.addEventListener(
      "click",
      () => {

        menu.remove();

        openSettingsModal();
      }
    );


  document
    .getElementById(
      "logoutMenuButton"
    )
    ?.addEventListener(
      "click",
      () => {

        menu.remove();

        openLogoutConfirm();
      }
    );


  if (window.lucide) {
    lucide.createIcons();
  }
}


/* ==================================================
   MY INFO
================================================== */

function openMyInfoModal() {

  closeAccountOverlay();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "accountOverlay";


  overlay.className =
    "account-overlay";


  overlay.innerHTML =
    `

      <div class="account-dialog">

        <div class="account-dialog-header">

          <h2>내 정보</h2>

          <button
            class="account-dialog-close"
            type="button"
            id="closeAccountDialog"
          >
            <i data-lucide="x"></i>
          </button>

        </div>


        <div class="account-dialog-body">

          <div class="account-profile-area">

            <div class="account-big-avatar">
              <i data-lucide="user-round"></i>
            </div>


            <div class="account-info-grid">

              <span>이름</span>
              <strong>홍길동</strong>

              <span>역할</span>
              <strong>관리자</strong>

              <span>이메일</span>
              <strong>
                hong@example.com
              </strong>

              <span>연락처</span>
              <strong>
                010-1234-5678
              </strong>

              <span>소속 기관</span>
              <strong>
                안심하랑께 관리센터
              </strong>

            </div>

          </div>

        </div>

      </div>
    `;


  document.body.appendChild(
    overlay
  );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closeAccountOverlay();
      }
    }
  );


  document
    .getElementById(
      "closeAccountDialog"
    )
    ?.addEventListener(
      "click",
      closeAccountOverlay
    );


  if (window.lucide) {
    lucide.createIcons();
  }
}


/* ==================================================
   SETTINGS
================================================== */

function openSettingsModal() {

  closeAccountOverlay();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "accountOverlay";


  overlay.className =
    "account-overlay";


  overlay.innerHTML =
    `

      <div class="account-dialog large">

        <div class="account-dialog-header">

          <h2>설정</h2>

          <button
            id="closeAccountDialog"
            class="account-dialog-close"
            type="button"
          >
            <i data-lucide="x"></i>
          </button>

        </div>


        <div class="settings-layout">

          <aside class="settings-side">

            <button
              class="settings-menu active"
              type="button"
              data-settings-tab="account"
            >
              <i data-lucide="user-cog"></i>
              계정 설정
            </button>

          </aside>


          <section
            class="settings-content"
            id="settingsContent"
          ></section>

        </div>

      </div>
    `;


  document.body.appendChild(
    overlay
  );


  renderSettingsTab(
    "account"
  );


  overlay
    .querySelectorAll(
      ".settings-menu"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            overlay
              .querySelectorAll(
                ".settings-menu"
              )
              .forEach(
                item =>
                  item.classList.remove(
                    "active"
                  )
              );


            button.classList.add(
              "active"
            );


            renderSettingsTab(
              button.dataset.settingsTab
            );
          }
        );
      }
    );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closeAccountOverlay();
      }
    }
  );


  document
    .getElementById(
      "closeAccountDialog"
    )
    ?.addEventListener(
      "click",
      closeAccountOverlay
    );


  if (window.lucide) {
    lucide.createIcons();
  }
}


function renderSettingsTab(tab) {

  const content =
    document.getElementById(
      "settingsContent"
    );


  if (!content) {
    return;
  }



  content.innerHTML =
    `

      <h3>계정 설정</h3>


      <div class="settings-field">
        <label>이름</label>

        <input
          type="text"
          value="홍길동"
        />
      </div>


      <div class="settings-field">
        <label>이메일</label>

        <input
          type="email"
          value="hong@example.com"
        />
      </div>


      <div class="settings-field">
        <label>연락처</label>

        <input
          type="text"
          value="010-1234-5678"
        />
      </div>


      <div class="settings-field">
        <label>비밀번호</label>

        <button
          type="button"
          class="settings-button cancel"
          id="passwordChangeButton"
          style="width:max-content;"
        >
          비밀번호 변경
        </button>
      </div>


      <div class="settings-action-row">

        <button
          class="settings-button cancel"
          type="button"
          id="settingsCancelButton"
        >
          취소
        </button>

        <button
          class="settings-button save"
          type="button"
          id="settingsSaveButton"
        >
          저장
        </button>

      </div>
    `;


  document
    .getElementById(
      "settingsCancelButton"
    )
    ?.addEventListener(
      "click",
      closeAccountOverlay
    );


  document
    .getElementById(
      "settingsSaveButton"
    )
    ?.addEventListener(
      "click",
      () => {

        alert(
          "현재는 화면 시연용 설정입니다."
        );
      }
    );


  document
    .getElementById(
      "passwordChangeButton"
    )
    ?.addEventListener(
      "click",
      () => {

        alert(
          "로그인 기능 연결 후 비밀번호 변경 기능을 추가하면 됩니다."
        );
      }
    );
}


/* ==================================================
   LOGOUT
================================================== */

function openLogoutConfirm() {

  closeAccountOverlay();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "accountOverlay";


  overlay.className =
    "account-overlay";


  overlay.innerHTML =
    `

      <div class="logout-dialog">

        <div class="logout-icon-circle">
          <i data-lucide="power"></i>
        </div>

        <h3>
          로그아웃 하시겠습니까?
        </h3>

        <p>
          로그아웃 시 로그인 화면으로 이동합니다.
        </p>

        <div class="logout-dialog-actions">

          <button
            class="logout-cancel"
            type="button"
            id="logoutCancelButton"
          >
            취소
          </button>

          <button
            class="logout-confirm"
            type="button"
            id="logoutConfirmButton"
          >
            로그아웃
          </button>

        </div>

      </div>
    `;


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      "logoutCancelButton"
    )
    ?.addEventListener(
      "click",
      closeAccountOverlay
    );


  document
    .getElementById(
      "logoutConfirmButton"
    )
    ?.addEventListener(
      "click",
      () => {

        alert(
          "로그인 화면을 만든 뒤 실제 로그아웃 기능과 연결하면 됩니다."
        );

        closeAccountOverlay();
      }
    );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closeAccountOverlay();
      }
    }
  );


  if (window.lucide) {
    lucide.createIcons();
  }
}


function closeAccountOverlay() {

  document
    .getElementById(
      "accountOverlay"
    )
    ?.remove();
}


/* ==================================================
   DASHBOARD
================================================== */

function getRiskLevel(score) {

  if (score >= 70) {
    return "danger";
  }


  if (score >= 40) {
    return "caution";
  }


  return "safe";
}


function getRiskLevelLabel(level) {

  if (
    level === "danger"
  ) {
    return "위험";
  }


  if (
    level === "caution"
  ) {
    return "주의";
  }


  return "안전";
}


function generateMockRiskData() {

  return subjects.map(
    (subject, index) => {

      let score =
        MOCK_RISK_SCORES[index];


      if (
        score === undefined
      ) {

        score =
          Math.max(
            1,
            8 -
            (
              index %
              8
            )
          );
      }


      const level =
        getRiskLevel(score);


      const mainRiskFactor =
        level === "safe"
          ? "-"
          : (
              MOCK_RISK_FACTORS[index] ||
              "이동 패턴 이상"
            );


      return {

        subjectId:
          subject.id,

        subject,

        riskScore:
          score,

        riskLevel:
          level,

        mainRiskFactor,

        updatedAt:
          MOCK_UPDATE_TIMES[
            index %
            MOCK_UPDATE_TIMES.length
          ] ||
          "10분 전"
      };
    }
  );
}


function calculatePercent(
  count,
  total
) {

  if (!total) {
    return "0%";
  }


  return (
    (
      count /
      total *
      100
    ).toFixed(1) +
    "%"
  );
}


function isToday(value) {

  if (!value) {
    return false;
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }


  const now =
    new Date();


  return (
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate()
  );
}


function renderDashboard() {

  if (
    !dashboardTotalSubjects ||
    !dashboardRiskTableBody
  ) {
    return;
  }


  const riskData =
    generateMockRiskData();


  const total =
    riskData.length;


  const danger =
    riskData.filter(
      item =>
        item.riskLevel === "danger"
    );


  const caution =
    riskData.filter(
      item =>
        item.riskLevel === "caution"
    );


  const safe =
    riskData.filter(
      item =>
        item.riskLevel === "safe"
    );


  dashboardTotalSubjects.textContent =
    `${total}명`;


  dashboardDangerCount.textContent =
    `${danger.length}명`;


  dashboardCautionCount.textContent =
    `${caution.length}명`;


  dashboardSafeCount.textContent =
    `${safe.length}명`;


  dashboardDangerPercent.textContent =
    calculatePercent(
      danger.length,
      total
    );


  dashboardCautionPercent.textContent =
    calculatePercent(
      caution.length,
      total
    );


  dashboardSafePercent.textContent =
    calculatePercent(
      safe.length,
      total
    );


  const todayAlertCount =
    alerts.filter(
      item =>
        isToday(
          item.createdAt
        )
    ).length;


  dashboardTodayAlerts.textContent =
    `${todayAlertCount}건`;


  const sortedRiskData =
    [...riskData]
      .sort(
        (a, b) =>
          b.riskScore -
          a.riskScore
      );


 const visibleRiskData =
  sortedRiskData;


  if (
    !visibleRiskData.length
  ) {

    dashboardRiskTableBody.innerHTML =
      `
        <tr>
          <td
            colspan="7"
            style="
              height:180px;
              text-align:center;
              color:#849098;
            "
          >
            보호대상자 데이터가 없습니다.
          </td>
        </tr>
      `;

    return;
  }


  dashboardRiskTableBody.innerHTML =
    visibleRiskData
      .map(
        (item, index) => {

          const level =
            item.riskLevel;


          return `

            <tr>

              <td>
                <span
                  class="dashboard-rank ${level}"
                >
                  ${index + 1}
                </span>
              </td>


              <td>
                <strong>
                  ${escapeHtml(
                    item.subject.name
                  )}
                </strong>
              </td>


              <td>
                <span
                  class="dashboard-score ${level}"
                >
                  ${item.riskScore}점
                </span>
              </td>


              <td>
                <span
                  class="risk-level-badge ${level}"
                >
                  ${getRiskLevelLabel(
                    level
                  )}
                </span>
              </td>


              <td>
                ${escapeHtml(
                  item.mainRiskFactor
                )}
              </td>


              <td>
                ${escapeHtml(
                  item.updatedAt
                )}
              </td>


              <td>

                <button
                  class="dashboard-monitor-button"
                  onclick="
                    openDashboardSubject(
                      ${item.subjectId}
                    )
                  "
                >
                  상세보기
                </button>

              </td>

            </tr>
          `;
        }
      )
      .join("");


  


  if (window.lucide) {
    lucide.createIcons();
  }
}


async function openDashboardSubject(
  subjectId
) {

  showPage(
    "realtime"
  );


  setTimeout(
    async () => {

      await selectMonitorSubject(
        subjectId
      );

    },
    150
  );
}


/* ==================================================
   LOAD BASE DATA
================================================== */

async function loadBaseData() {

  userLoading?.classList.remove(
    "hidden"
  );

  userError?.classList.add(
    "hidden"
  );

  userTableArea?.classList.add(
    "hidden"
  );


  try {

    const [
      subjectData,
      guardianData
    ] =
      await Promise.all([

        apiRequest(
          "/subjects?skip=0&limit=100"
        ),

        apiRequest(
          "/guardians?skip=0&limit=100"
        )

      ]);


    subjects =
      Array.isArray(subjectData)
        ? subjectData
        : [];


    guardians =
      Array.isArray(guardianData)
        ? guardianData
        : [];


    try {

      const institutionData =
        await apiRequest(
          "/institutions?skip=0&limit=100"
        );


      institutions =
        Array.isArray(
          institutionData
        )
          ? institutionData
          : [];


    } catch (
      institutionError
    ) {

      console.warn(
        "기관 데이터 조회 실패:",
        institutionError
      );


      institutions = [];
    }


    populateInstitutionSelect();

populateRelationUserSelects();

    renderUserManagement();

    renderAuthManagement();

    renderMonitorSubjects();

    renderDashboard();


    userLoading?.classList.add(
      "hidden"
    );

    userTableArea?.classList.remove(
      "hidden"
    );


  } catch (error) {

    console.error(error);


    userLoading?.classList.add(
      "hidden"
    );

    userError?.classList.remove(
      "hidden"
    );


    if (userError) {

      userError.textContent =
        `사용자 정보를 불러오지 못했습니다. ${error.message}`;
    }
  }
}

/* ==================================================
   ALERT API
================================================== */

function normalizeAlertType(value) {

  const type =
    String(value || "")
      .trim()
      .toLowerCase();


  if (
    type.includes("auth") ||
    type.includes("verification") ||
    type.includes("인증")
  ) {
    return "auth";
  }


  return "danger";
}


function findSubjectById(id) {

  if (
    id === null ||
    id === undefined
  ) {
    return null;
  }


  return (
    subjects.find(
      subject =>
        Number(subject.id) ===
        Number(id)
    ) || null
  );
}


function findGuardianById(id) {

  if (
    id === null ||
    id === undefined
  ) {
    return null;
  }


  return (
    guardians.find(
      guardian =>
        Number(guardian.id) ===
        Number(id)
    ) || null
  );
}


/* ==================================================
   API ALERT -> FRONT ALERT
================================================== */

function convertApiAlert(apiAlert) {

  const type =
    normalizeAlertType(
      apiAlert.type
    );


  const subject =
    findSubjectById(
      apiAlert.subject_id
    );


  const guardian =
    findGuardianById(
      apiAlert.guardian_id
    );


  let name =
    "사용자";


  let phone =
    "";


  let displayInfo =
    "";


  /*
    위험 알림은 보호대상자 기준
  */

  if (
    type === "danger"
  ) {

    if (subject) {

      name =
        subject.name ||
        "보호대상자";


      phone =
        subject.phone ||
        "";


      displayInfo =
        getSubjectTypeLabel(
          subject.subject_type
        );
    }

  }


  /*
    인증 알림은 보호자 우선
  */

  else {

    if (guardian) {

      name =
        guardian.name ||
        "보호자";


      phone =
        guardian.phone ||
        "";


      displayInfo =
        "보호자";

    } else if (subject) {

      name =
        subject.name ||
        "보호대상자";


      phone =
        subject.phone ||
        "";


      displayInfo =
        getSubjectTypeLabel(
          subject.subject_type
        );
    }
  }


  return {

    id:
      apiAlert.id,

    alertType:
      type,

    rawType:
      apiAlert.type,

    subjectId:
      apiAlert.subject_id,

    guardianId:
      apiAlert.guardian_id,

    name,

    phone,

    displayInfo,

    message:
      apiAlert.message ||
      (
        type === "danger"
          ? "위험 상황이 감지되었습니다."
          : "인증코드 발급 요청"
      ),

    riskScore:
      Number(
        apiAlert.risk_score || 0
      ),

    read:
      Boolean(
        apiAlert.is_read
      ),

    createdAt:
      apiAlert.created_at
  };
}


/* ==================================================
   GET /alerts
================================================== */

async function loadAlerts() {

  try {

    const data =
      await apiRequest(
        "/alerts"
      );


    const rawAlerts =
      Array.isArray(data)
        ? data
        : [];


   alerts =
  rawAlerts
    .map(
      convertApiAlert
    )
    .filter(
      item =>
        item.alertType === "danger"
    )
    .sort(
          (a, b) => {

            return (
              new Date(
                b.createdAt
              ) -
              new Date(
                a.createdAt
              )
            );
          }
        );


    /*
      현재 페이지가 없는 경우 방지
    */

    if (
      alertTableBody
    ) {

      renderAlerts();
    }


    /*
      대시보드 오늘 알림도
      실제 API 기준으로 갱신
    */

    updateDashboardAlertCount();


    /*
      사이드바 미확인 알림 숫자
    */

    updateAlertSidebarBadge();


  } catch (error) {

    console.error(
      "알림 조회 실패:",
      error
    );


    if (
      alertTableBody
    ) {

      alertTableBody.innerHTML = `

        <tr>

          <td
            colspan="6"
            style="
              height:180px;
              text-align:center;
              color:#d33b3b;
            "
          >
            알림 정보를 불러오지 못했습니다.
          </td>

        </tr>
      `;
    }
  }
}


/* ==================================================
   오늘 알림 개수
================================================== */

function updateDashboardAlertCount() {

  if (
    !dashboardTodayAlerts
  ) {
    return;
  }


  const now =
    new Date();


  const todayAlerts =
    alerts.filter(
      alertItem => {

        if (
          !alertItem.createdAt
        ) {
          return false;
        }


        const date =
          new Date(
            alertItem.createdAt
          );


        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return false;
        }


        return (
          date.getFullYear() ===
            now.getFullYear() &&

          date.getMonth() ===
            now.getMonth() &&

          date.getDate() ===
            now.getDate()
        );
      }
    );


  dashboardTodayAlerts.textContent =
    `${todayAlerts.length}건`;
}


/* ==================================================
   사이드바 미확인 알림
================================================== */

function updateAlertSidebarBadge() {

  if (
    !alertSidebarBadge
  ) {
    return;
  }


  const unreadCount =
    alerts.filter(
      alertItem =>
        !alertItem.read
    ).length;


  alertSidebarBadge.textContent =
    unreadCount;


  alertSidebarBadge.classList.toggle(
    "hidden",
    unreadCount === 0
  );
}


/* ==================================================
   PATCH /alerts/{id}/read
================================================== */

async function markAlertAsRead(
  alertId
) {

  const alertItem =
    alerts.find(
      item =>
        Number(item.id) ===
        Number(alertId)
    );


  if (!alertItem) {
    return;
  }


  if (alertItem.read) {
    return;
  }


  const guardianId =
    Number(
      alertItem.guardianId
    );


  if (
    !Number.isFinite(guardianId) ||
    guardianId <= 0
  ) {

    console.error(
      "알림에 guardian_id가 없습니다:",
      alertItem
    );

    alert(
      "이 알림의 보호자 정보를 찾을 수 없습니다."
    );

    return;
  }


  try {

    await apiRequest(
      `/alerts/${alertId}/read?guardian_id=${guardianId}`,
      {
        method: "PATCH"
      }
    );


    alertItem.read =
      true;


    renderAlerts();


    updateDashboardAlertCount();


    updateAlertSidebarBadge();


  } catch (error) {

    console.error(
      "알림 읽음 처리 실패:",
      error
    );


    alert(
      "알림 읽음 처리에 실패했습니다."
    );
  }
}

/* ==================================================
   ADDRESS
================================================== */

function openPostcodeSearch(
  addressInput,
  detailInput
) {

  if (
    !window.kakao ||
    !window.kakao.Postcode
  ) {

    alert(
      "주소 검색 서비스를 불러오지 못했습니다."
    );

    return;
  }


  new kakao.Postcode({

    oncomplete: function(data) {

      const selectedAddress =
        data.roadAddress ||
        data.jibunAddress ||
        data.address ||
        "";


      addressInput.value =
        selectedAddress;


      setTimeout(
        () => {
          detailInput.focus();
        },
        100
      );
    }

  }).open();
}


function makeFullAddress(
  baseAddress,
  detailAddress
) {

  return [
    baseAddress.trim(),
    detailAddress.trim()
  ]
    .filter(Boolean)
    .join(" ");
}


/* ==================================================
   REGISTRATION
================================================== */

function isRegistered(user) {

  return Boolean(
    user?.auth_code &&
    String(
      user.auth_code
    ).trim()
  );
}


function renderStatusBadge(user) {

  return isRegistered(user)
    ? `
      <span class="status-badge registered">
        등록
      </span>
    `
    : `
      <span class="status-badge unregistered">
        미등록
      </span>
    `;
}


/* ==================================================
   DRAWERS
================================================== */

function closeDrawers() {

  userDetailDrawer?.classList.remove(
    "open"
  );

  authDetailDrawer?.classList.remove(
    "open"
  );

  document.body.classList.remove(
    "drawer-open"
  );
}


/* ==================================================
   PAGE HISTORY
================================================== */

function navigateBack() {

  if (
    previousPages.length === 0
  ) {

    showPage(
      "dashboard"
    );

    return;
  }


  const previousPage =
    previousPages.pop();


  isBackNavigation =
    true;


  showPage(
    previousPage
  );


  isBackNavigation =
    false;
}


/* ==================================================
   PAGE SWITCH
================================================== */

function showPage(page) {

  closeDrawers();


  if (
    !isBackNavigation &&
    currentPage &&
    currentPage !== page
  ) {

    previousPages.push(
      currentPage
    );


    if (
      previousPages.length > 20
    ) {
      previousPages.shift();
    }
  }


  currentPage =
    page;


  dashboardPage?.classList.add(
    "hidden"
  );

  userManagementPage?.classList.add(
    "hidden"
  );

  realtimePage?.classList.add(
    "hidden"
  );

  authManagementPage?.classList.add(
    "hidden"
  );

  alertPage?.classList.add(
    "hidden"
  );


  dashboardNav?.classList.remove(
    "active"
  );

  userNav?.classList.remove(
    "active"
  );

  realtimeNav?.classList.remove(
    "active"
  );

  authNav?.classList.remove(
    "active"
  );

  alertNav?.classList.remove(
    "active"
  );


  if (
    page === "dashboard"
  ) {

    dashboardPage?.classList.remove(
      "hidden"
    );

    dashboardNav?.classList.add(
      "active"
    );

    renderDashboard();
  }


  if (
    page === "users"
  ) {

    userManagementPage?.classList.remove(
      "hidden"
    );

    userNav?.classList.add(
      "active"
    );

    renderUserManagement();
  }


  if (
    page === "realtime"
  ) {

    realtimePage?.classList.remove(
      "hidden"
    );

    realtimeNav?.classList.add(
      "active"
    );

    renderMonitorSubjects();


    setTimeout(
      () => {

        initializeMap();

        if (liveMap) {
          liveMap.invalidateSize();
        }

      },
      100
    );
  }


  if (
    page === "auth"
  ) {

    authManagementPage?.classList.remove(
      "hidden"
    );

    authNav?.classList.add(
      "active"
    );

    renderAuthManagement();
  }


  if (
    page === "alerts"
  ) {

    alertPage?.classList.remove(
      "hidden"
    );

    alertNav?.classList.add(
      "active"
    );

    loadAlerts();
  }


  if (window.lucide) {
    lucide.createIcons();
  }
}


/* ==================================================
   USER MANAGEMENT
================================================== */

function getFilteredUsers() {

  const source =
    userTab === "subjects"
      ? subjects
      : guardians;


  const keyword =
    normalize(
      userSearchKeyword
    );


  const addressKeyword =
    normalize(
      userAddressKeyword
    );


  return source.filter(
    user => {

      const matchesKeyword =
        !keyword ||
        (
          normalize(
            user.name
          ) +
          normalize(
            user.phone
          )
        ).includes(
          keyword
        );


      if (
        userTab === "guardians"
      ) {

        const matchesAddress =
          !addressKeyword ||
          normalize(
            user.address
          ).includes(
            addressKeyword
          );


        return (
          matchesKeyword &&
          matchesAddress
        );
      }


      const matchesType =
        userTypeFilterValue ===
          "all" ||
        String(
          user.subject_type ||
          ""
        ).toLowerCase() ===
          userTypeFilterValue;


      return (
        matchesKeyword &&
        matchesType
      );
    }
  );
}


function renderUserManagement() {

  if (
    !userSubjectTab ||
    !userGuardianTab
  ) {
    return;
  }


  const subjectMode =
    userTab === "subjects";


  userSubjectTab.classList.toggle(
    "active",
    subjectMode
  );


  userGuardianTab.classList.toggle(
    "active",
    !subjectMode
  );


  userTypeFilter?.classList.toggle(
    "hidden",
    !subjectMode
  );


  userAddressBox?.classList.toggle(
    "hidden",
    subjectMode
  );


  const users =
    getFilteredUsers();


  if (subjectMode) {

    userTableHead.innerHTML = `
      <tr>
        <th>이름</th>
        <th>유형</th>
        <th>생년월일</th>
        <th>전화번호</th>
        <th>보호자</th>
        <th>상태</th>
        <th>관리</th>
      </tr>
    `;


    userTableBody.innerHTML =
      users
        .map(
          subject => `

            <tr>

              <td>
                ${escapeHtml(
                  subject.name
                )}
              </td>

              <td>
                ${escapeHtml(
                  getSubjectTypeLabel(
                    subject.subject_type
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  formatDate(
                    subject.birth_date
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  subject.phone ||
                  "-"
                )}
              </td>

              <td
                id="guardian-${subject.id}"
              >
                -
              </td>

              <td>
                ${renderStatusBadge(
                  subject
                )}
              </td>

              <td>

                <button
                  class="detail-button"
                  onclick="
                    openUserDetail(
                      'subjects',
                      ${subject.id}
                    )
                  "
                >
                  상세보기
                </button>

              </td>

            </tr>
          `
        )
        .join("");


    fillGuardianNames(
      users
    );


  } else {

    userTableHead.innerHTML = `
      <tr>
        <th>이름</th>
        <th>성별</th>
        <th>연락처</th>
        <th>주소</th>
        <th>상태</th>
        <th>관리</th>
      </tr>
    `;


    userTableBody.innerHTML =
      users
        .map(
          guardian => `

            <tr>

              <td>
                ${escapeHtml(
                  guardian.name
                )}
              </td>

              <td>
                ${escapeHtml(
                  getGenderLabel(
                    guardian.gender
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  guardian.phone ||
                  "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  guardian.address ||
                  "-"
                )}
              </td>

              <td>
                ${renderStatusBadge(
                  guardian
                )}
              </td>

              <td>

                <button
                  class="detail-button"
                  onclick="
                    openUserDetail(
                      'guardians',
                      ${guardian.id}
                    )
                  "
                >
                  상세보기
                </button>

              </td>

            </tr>
          `
        )
        .join("");
  }


  userTotalCount.textContent =
    `전체 ${users.length}건`;


  if (window.lucide) {
    lucide.createIcons();
  }
}


/* ==================================================
   ADD USER
================================================== */

function openAddUserModal() {

  addUserModal.classList.remove(
    "hidden"
  );


  if (
    userTab === "guardians"
  ) {

    showGuardianForm();

  } else {

    showSubjectForm();
  }


  populateInstitutionSelect();

  if (window.lucide) {
    lucide.createIcons();
  }
}


function closeUserAddModal() {

  addUserModal.classList.add(
    "hidden"
  );

  subjectForm.reset();
  guardianForm.reset();
}


function showSubjectForm() {

  addSubjectTab.classList.add(
    "active"
  );

  addGuardianTab.classList.remove(
    "active"
  );

  subjectForm.classList.remove(
    "hidden"
  );

  guardianForm.classList.add(
    "hidden"
  );
}


function showGuardianForm() {

  addGuardianTab.classList.add(
    "active"
  );

  addSubjectTab.classList.remove(
    "active"
  );

  guardianForm.classList.remove(
    "hidden"
  );

  subjectForm.classList.add(
    "hidden"
  );
}


function populateInstitutionSelect() {

  if (!subjectInstitution) {
    return;
  }


  const oldValue =
    subjectInstitution.value;


  subjectInstitution.innerHTML =
    `
      <option value="">
        소속 기관 없음
      </option>
    ` +
    institutions
      .map(
        institution => `
          <option value="${institution.id}">
            ${escapeHtml(
              institution.name ||
              `기관 ${institution.id}`
            )}
          </option>
        `
      )
      .join("");


  if (
    oldValue &&
    institutions.some(
      institution =>
        String(
          institution.id
        ) === oldValue
    )
  ) {

    subjectInstitution.value =
      oldValue;
  }
}

function populateRelationUserSelects() {
  const subjectExistingGuardian =
    document.getElementById("subjectExistingGuardian");

  const guardianExistingSubject =
    document.getElementById("guardianExistingSubject");

  if (subjectExistingGuardian) {
    subjectExistingGuardian.innerHTML =
      `<option value="">보호자를 선택하세요.</option>` +
      guardians
        .map(
          (guardian) => `
            <option value="${guardian.id}">
              ${escapeHtml(guardian.name)}
              ·
              ${escapeHtml(guardian.phone || "-")}
            </option>
          `
        )
        .join("");
  }

  if (guardianExistingSubject) {
    guardianExistingSubject.innerHTML =
      `<option value="">보호대상자를 선택하세요.</option>` +
      subjects
        .map(
          (subject) => `
            <option value="${subject.id}">
              ${escapeHtml(subject.name)}
              ·
              ${escapeHtml(subject.phone || "-")}
            </option>
          `
        )
        .join("");
  }
}

async function createSubject(event) {

  event.preventDefault();


  if (!subjectAddress.value.trim()) {

    alert(
      "주소 검색을 통해 주소를 선택해주세요."
    );

    return;
  }


  const guardianMode =
    document.getElementById(
      "subjectGuardianMode"
    )?.value;


  const relationshipCode =
    document.getElementById(
      "subjectRelationship"
    )?.value;


  if (!relationshipCode) {

    alert(
      "보호자와의 관계를 선택해주세요."
    );

    return;
  }


  if (guardianMode === "existing") {

    const selectedGuardianId =
      document.getElementById(
        "subjectExistingGuardian"
      )?.value;


    if (!selectedGuardianId) {

      alert(
        "연결할 보호자를 선택해주세요."
      );

      return;
    }
  }


  const payload = {

    name:
      subjectName.value.trim(),

    gender:
      subjectGender.value,

    phone:
      subjectPhone.value.trim(),

    birth_date:
      subjectBirthDate.value,

    address:
      makeFullAddress(
        subjectAddress.value,
        subjectAddressDetail.value
      ),

    subject_type:
      subjectTypeInput.value,

    special_notes:
      subjectSpecialNotes.value.trim(),

    institution_id:
      subjectInstitution.value
        ? Number(
            subjectInstitution.value
          )
        : null
  };


  try {

    submitSubjectButton.disabled =
      true;


    submitSubjectButton.textContent =
      "추가 중...";


    /* ======================================
       1. 보호대상자 생성
    ====================================== */

    const createdSubject =
      await apiRequest(
        "/subjects",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );


    if (!createdSubject?.id) {

      throw new Error(
        "생성된 보호대상자의 ID를 확인할 수 없습니다."
      );
    }


    const subjectId =
      createdSubject.id;
console.log(
  "새 보호대상자 생성 결과:",
  createdSubject,
  "subjectId:",
  subjectId
);

    let guardianId;


    /* ======================================
       2-A. 기존 보호자 연결
    ====================================== */

    if (
      guardianMode ===
      "existing"
    ) {

      guardianId =
        Number(
          document.getElementById(
            "subjectExistingGuardian"
          ).value
        );
    }


    /* ======================================
       2-B. 새 보호자 생성
    ====================================== */

    else {

      const newGuardianName =
        document.getElementById(
          "subjectNewGuardianName"
        )?.value.trim();


      const newGuardianGender =
        document.getElementById(
          "subjectNewGuardianGender"
        )?.value;


      const newGuardianPhone =
        document.getElementById(
          "subjectNewGuardianPhone"
        )?.value.trim();


      const newGuardianBirthDate =
        document.getElementById(
          "subjectNewGuardianBirthDate"
        )?.value;


      const newGuardianAddress =
        document.getElementById(
          "subjectNewGuardianAddress"
        )?.value.trim();


      const newGuardianAddressDetail =
        document.getElementById(
          "subjectNewGuardianAddressDetail"
        )?.value.trim();


      if (
        !newGuardianName ||
        !newGuardianGender ||
        !newGuardianPhone ||
        !newGuardianBirthDate ||
        !newGuardianAddress
      ) {

        throw new Error(
          "새 보호자 정보를 모두 입력해주세요."
        );
      }


      const createdGuardian =
        await apiRequest(
          "/guardians",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                name:
                  newGuardianName,

                gender:
                  newGuardianGender,

                phone:
                  newGuardianPhone,

                birth_date:
                  newGuardianBirthDate,

                address:
                  makeFullAddress(
                    newGuardianAddress,
                    newGuardianAddressDetail
                  )
              })
          }
        );


      if (!createdGuardian?.id) {

        throw new Error(
          "생성된 보호자의 ID를 확인할 수 없습니다."
        );
      }


      guardianId =
        createdGuardian.id;
    }


    /* ======================================
       3. 보호대상자 ↔ 보호자 관계 생성
    ====================================== */
console.log(
  "관계 생성 요청:",
  {
    subjectId,
    guardianId,
    relationshipCode
  }
);
    await createGuardianRegistration(
      subjectId,
      guardianId,
      relationshipCode
    );


    /* 기존 관계 캐시 제거 */

    relationCache.clear();


    userTab =
      "subjects";


    closeUserAddModal();


    await loadBaseData();


    alert(
      "보호대상자와 보호자가 함께 등록되었습니다."
    );


  } catch (error) {

    console.error(
      "보호대상자 등록 실패:",
      error
    );


    alert(
      `보호대상자 등록 실패\n${error.message}`
    );


  } finally {

    submitSubjectButton.disabled =
      false;


    submitSubjectButton.textContent =
      "보호대상자 추가";
  }
}

async function createGuardian(event) {

  event.preventDefault();

  if (!guardianAddress.value.trim()) {
    alert("주소 검색을 통해 주소를 선택해주세요.");
    return;
  }

  const subjectMode =
    document.getElementById(
      "guardianSubjectMode"
    )?.value;

  const relationshipCode =
    document.getElementById(
      "guardianRelationship"
    )?.value;

  if (!relationshipCode) {
    alert("보호대상자와의 관계를 선택해주세요.");
    return;
  }

  if (subjectMode === "existing") {

    const selectedSubjectId =
      document.getElementById(
        "guardianExistingSubject"
      )?.value;

    if (!selectedSubjectId) {
      alert("연결할 보호대상자를 선택해주세요.");
      return;
    }
  }

  const payload = {

    name:
      guardianName.value.trim(),

    gender:
      guardianGender.value,

    phone:
      guardianPhone.value.trim(),

    birth_date:
      guardianBirthDate.value,

    address:
      makeFullAddress(
        guardianAddress.value,
        guardianAddressDetail.value
      )
  };

  try {

    submitGuardianButton.disabled = true;
    submitGuardianButton.textContent = "추가 중...";


    /* ======================================
       1. 보호자 생성
    ====================================== */

    const createdGuardian =
      await apiRequest(
        "/guardians",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

    if (!createdGuardian?.id) {
      throw new Error(
        "생성된 보호자의 ID를 확인할 수 없습니다."
      );
    }

    const guardianId =
      createdGuardian.id;

    let subjectId;


    /* ======================================
       2-A. 기존 보호대상자 연결
    ====================================== */

    if (subjectMode === "existing") {

      subjectId =
        Number(
          document.getElementById(
            "guardianExistingSubject"
          ).value
        );
    }


    /* ======================================
       2-B. 새 보호대상자 생성
    ====================================== */

    else {

      const newSubjectName =
        document.getElementById(
          "guardianNewSubjectName"
        )?.value.trim();

      const newSubjectGender =
        document.getElementById(
          "guardianNewSubjectGender"
        )?.value;

      const newSubjectPhone =
        document.getElementById(
          "guardianNewSubjectPhone"
        )?.value.trim();

      const newSubjectBirthDate =
        document.getElementById(
          "guardianNewSubjectBirthDate"
        )?.value;

      const newSubjectAddress =
        document.getElementById(
          "guardianNewSubjectAddress"
        )?.value.trim();

      const newSubjectAddressDetail =
        document.getElementById(
          "guardianNewSubjectAddressDetail"
        )?.value.trim();

      const newSubjectType =
        document.getElementById(
          "guardianNewSubjectType"
        )?.value;

      const newSubjectInstitution =
        document.getElementById(
          "guardianNewSubjectInstitution"
        )?.value;

      const newSubjectSpecialNotes =
        document.getElementById(
          "guardianNewSubjectSpecialNotes"
        )?.value.trim();


      if (
        !newSubjectName ||
        !newSubjectGender ||
        !newSubjectPhone ||
        !newSubjectBirthDate ||
        !newSubjectAddress ||
        !newSubjectType
      ) {
        throw new Error(
          "새 보호대상자의 필수 정보를 모두 입력해주세요."
        );
      }


      const createdSubject =
        await apiRequest(
          "/subjects",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({

              name:
                newSubjectName,

              gender:
                newSubjectGender,

              phone:
                newSubjectPhone,

              birth_date:
                newSubjectBirthDate,

              address:
                makeFullAddress(
                  newSubjectAddress,
                  newSubjectAddressDetail
                ),

              subject_type:
                newSubjectType,

              institution_id:
                newSubjectInstitution
                  ? Number(newSubjectInstitution)
                  : null,

              special_notes:
                newSubjectSpecialNotes || ""
            })
          }
        );

      if (!createdSubject?.id) {
        throw new Error(
          "생성된 보호대상자의 ID를 확인할 수 없습니다."
        );
      }

      subjectId =
        createdSubject.id;
    }


    /* ======================================
       3. 보호자 ↔ 보호대상자 관계 생성
    ====================================== */

    await createGuardianRegistration(
      subjectId,
      guardianId,
      relationshipCode
    );


    relationCache.clear();

    userTab = "guardians";

    closeUserAddModal();

    await loadBaseData();

    alert(
      "보호자와 보호대상자가 함께 등록되었습니다."
    );


  } catch (error) {

    console.error(
      "보호자 등록 실패:",
      error
    );

    alert(
      `보호자 등록 실패\n${error.message}`
    );

  } finally {

    submitGuardianButton.disabled = false;
    submitGuardianButton.textContent = "보호자 추가";
  }
}

async function createGuardianRegistration(
  subjectId,
  guardianId,
  relationshipCode
) {

  let relationshipNote = null;


  if (relationshipCode === "other") {

    const subjectEtcInput =
      document.getElementById(
        "subjectRelationshipEtc"
      );

    const guardianEtcInput =
      document.getElementById(
        "guardianRelationshipEtc"
      );


    relationshipNote =
      subjectEtcInput?.value?.trim() ||
      guardianEtcInput?.value?.trim() ||
      "";


    if (!relationshipNote) {

      throw new Error(
        "기타 관계에 대한 메모를 입력해주세요."
      );
    }
  }


  return apiRequest(
    "/guardian-registrations",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        subject_id: Number(subjectId),
        guardian_id: Number(guardianId),
        relationship_code: relationshipCode,
        relationship_note: relationshipNote,
        is_primary: false
      })
    }
  );
}

/* ==================================================
   RELATION
================================================== */

async function getSubjectRelations(id) {

  const key =
    `subject-${id}`;


  if (
    relationCache.has(key)
  ) {

    return relationCache.get(
      key
    );
  }


  try {

    const data =
      await apiRequest(
        `/subjects/${id}/guardians`
      );


    const result =
      Array.isArray(data)
        ? data
        : [];


    relationCache.set(
      key,
      result
    );


    return result;


  } catch (_) {

    return [];
  }
}


async function getGuardianRelations(id) {

  const key =
    `guardian-${id}`;


  if (
    relationCache.has(key)
  ) {

    return relationCache.get(
      key
    );
  }


  try {

    const data =
      await apiRequest(
        `/guardians/${id}/subjects`
      );


    const result =
      Array.isArray(data)
        ? data
        : [];


    relationCache.set(
      key,
      result
    );


    return result;


  } catch (_) {

    return [];
  }
}


async function fillGuardianNames(users) {

  users.forEach(
    async subject => {

      const cell =
        document.getElementById(
          `guardian-${subject.id}`
        );


      if (!cell) {
        return;
      }


      const relations =
        await getSubjectRelations(
          subject.id
        );


      const relation =
        relations.find(
          item =>
            item.is_primary
        ) ||
        relations[0];


      cell.textContent =
        relation?.guardian?.name ||
        "-";
    }
  );
}


/* ==================================================
   USER DETAIL
================================================== */

async function openUserDetail(
  type,
  id
) {

  closeDrawers();


  const source =
    type === "subjects"
      ? subjects
      : guardians;


  const user =
    source.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!user) {
    return;
  }


  const registered =
    isRegistered(user);


  userDetailName.textContent =
    user.name;


  userDetailStatus.textContent =
    registered
      ? "등록"
      : "미등록";


  userDetailStatus.className =
    registered
      ? "status-badge registered"
      : "status-badge unregistered";


  if (
    type === "subjects"
  ) {

    userDetailRole.textContent =
      `보호대상자 · ${getSubjectTypeLabel(
        user.subject_type
      )}`;


    userBasicInfo.innerHTML = `

      ${detailItem(
        "성별",
        getGenderLabel(
          user.gender
        )
      )}

      ${detailItem(
        "생년월일",
        formatDate(
          user.birth_date
        )
      )}

      ${detailItem(
        "전화번호",
        user.phone ||
        "-"
      )}

      ${detailItem(
        "상태",
        registered
          ? "등록"
          : "미등록"
      )}
    `;


    const relations =
      await getSubjectRelations(
        id
      );


    userRelationTitle.textContent =
      "보호자 정보";


    if (!relations.length) {

      userRelationList.innerHTML =
        `
          <div class="relation-empty">
            연결된 보호자가 없습니다.
          </div>
        `;

    } else {

      userRelationList.innerHTML =
        relations
          .map(
            relation => `

              <article class="relation-card">

                <strong>
                  ${escapeHtml(
                    relation.guardian?.name ||
                    "-"
                  )}
                </strong>

                <p>
  관계 ·
  ${escapeHtml(
    relation.relationship_code === "other"
      ? `기타 (${relation.relationship_note || "-"})`
      : relation.relationship_code || "-"
  )}
</p>

                <p>
                  전화번호 ·
                  ${escapeHtml(
                    relation.guardian?.phone ||
                    "-"
                  )}
                </p>

              </article>
            `
          )
          .join("");
    }


    userExtraInfo.innerHTML = `

      ${detailItem(
        "주소",
        user.address ||
        "-"
      )}

      ${detailItem(
        "특이사항",
        user.special_notes ||
        "-"
      )}
    `;


  } else {

    userDetailRole.textContent =
      "보호자";


    userBasicInfo.innerHTML = `

      ${detailItem(
        "성별",
        getGenderLabel(
          user.gender
        )
      )}

      ${detailItem(
        "생년월일",
        formatDate(
          user.birth_date
        )
      )}

      ${detailItem(
        "전화번호",
        user.phone ||
        "-"
      )}

      ${detailItem(
        "주소",
        user.address ||
        "-"
      )}

      ${detailItem(
        "상태",
        registered
          ? "등록"
          : "미등록"
      )}
    `;


    const relations =
      await getGuardianRelations(
        id
      );


    userRelationTitle.textContent =
      "연결된 보호대상자";


    if (!relations.length) {

      userRelationList.innerHTML =
        `
          <div class="relation-empty">
            연결된 보호대상자가 없습니다.
          </div>
        `;

    } else {

      userRelationList.innerHTML =
        relations
          .map(
            relation => `

              <article class="relation-card">

                <strong>
                  ${escapeHtml(
                    relation.subject?.name ||
                    "-"
                  )}
                </strong>

                <p>
                  유형 ·
                  ${escapeHtml(
                    getSubjectTypeLabel(
                      relation.subject?.subject_type
                    )
                  )}
                </p>

              </article>
            `
          )
          .join("");
    }


    userExtraInfo.innerHTML =
      "";
  }

    /* ======================================
     정보 수정 버튼
  ====================================== */

  document
    .getElementById(
      "userEditActionArea"
    )
    ?.remove();


  const editActionArea =
    document.createElement(
      "div"
    );


  editActionArea.id =
    "userEditActionArea";


  editActionArea.style.cssText =
    `
      display:flex;
      justify-content:flex-end;
      padding:18px 0 4px;
    `;


  const editButton =
    document.createElement(
      "button"
    );


  editButton.type =
    "button";


  editButton.id =
    "editUserButton";


  editButton.textContent =
    "정보 수정";


  editButton.style.cssText =
    `
      height:38px;
      padding:0 18px;
      border:0;
      border-radius:7px;
      background:#1688cf;
      color:#ffffff;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
    `;


  editActionArea.appendChild(
    editButton
  );

    editButton.addEventListener(
    "click",
    () => {

      openUserEditModal(
        type,
        user
      );
    }
  );

  userExtraInfo.insertAdjacentElement(
    "afterend",
    editActionArea
  );

  document.body.classList.add(
    "drawer-open"
  );


  userDetailDrawer.classList.add(
    "open"
  );


  if (window.lucide) {
    lucide.createIcons();
  }
}

function openUserEditModal(type, user) {

  document
    .getElementById("userEditOverlay")
    ?.remove();


  const overlay =
    document.createElement("div");

  overlay.id = "userEditOverlay";
  overlay.className = "account-overlay";


  const isSubject =
    type === "subjects";


  const institutionOptions =
    institutions
      .map(institution => `
        <option
          value="${institution.id}"
          ${
            Number(user.institution_id) ===
            Number(institution.id)
              ? "selected"
              : ""
          }
        >
          ${escapeHtml(
            institution.name ||
            `기관 ${institution.id}`
          )}
        </option>
      `)
      .join("");


  const subjectFields =
    isSubject
      ? `
        <div class="user-edit-field">

          <label>유형 *</label>

          <select id="editUserSubjectType">

            <option
              value="child"
              ${user.subject_type === "child" ? "selected" : ""}
            >
              아동
            </option>

            <option
              value="dementia"
              ${user.subject_type === "dementia" ? "selected" : ""}
            >
              치매환자
            </option>

            <option
              value="elderly"
              ${user.subject_type === "elderly" ? "selected" : ""}
            >
              노인
            </option>

            <option
              value="disability"
              ${user.subject_type === "disability" ? "selected" : ""}
            >
              장애인
            </option>

            <option
              value="general"
              ${user.subject_type === "general" ? "selected" : ""}
            >
              일반
            </option>

            <option
              value="other"
              ${user.subject_type === "other" ? "selected" : ""}
            >
              기타
            </option>

          </select>

        </div>


        <div class="user-edit-field">

          <label>소속 기관</label>

          <select id="editUserInstitution">

            <option value="">
              소속 기관 없음
            </option>

            ${institutionOptions}

          </select>

        </div>


        <div class="user-edit-field full">

          <label>특이사항</label>

          <textarea
            id="editUserSpecialNotes"
            placeholder="필요한 특이사항을 입력하세요."
          >${escapeHtml(
            user.special_notes || ""
          )}</textarea>

        </div>
      `
      : "";


  overlay.innerHTML = `

    <div class="user-edit-dialog">

      <div class="user-edit-header">

        <div>

          <h2>
            ${
              isSubject
                ? "보호대상자 정보 수정"
                : "보호자 정보 수정"
            }
          </h2>

          <p>
            등록된 사용자 정보를 수정합니다.
          </p>

        </div>


        <button
          id="closeUserEditModal"
          class="user-edit-close"
          type="button"
        >
          <i data-lucide="x"></i>
        </button>

      </div>


      <div class="user-edit-body">

        <div class="user-edit-grid">


          <div class="user-edit-field">

            <label>이름 *</label>

            <input
              id="editUserName"
              type="text"
              value="${escapeHtml(
                user.name || ""
              )}"
            />

          </div>


          <div class="user-edit-field">

            <label>성별 *</label>

            <select id="editUserGender">

              <option
                value="male"
                ${user.gender === "male" ? "selected" : ""}
              >
                남성
              </option>

              <option
                value="female"
                ${user.gender === "female" ? "selected" : ""}
              >
                여성
              </option>

              <option
                value="unknown"
                ${user.gender === "unknown" ? "selected" : ""}
              >
                미상
              </option>

            </select>

          </div>


          <div class="user-edit-field">

            <label>전화번호 *</label>

            <input
              id="editUserPhone"
              type="text"
              value="${escapeHtml(
                user.phone || ""
              )}"
              placeholder="010-0000-0000"
            />

          </div>


          <div class="user-edit-field">

            <label>생년월일 *</label>

            <input
              id="editUserBirthDate"
              type="date"
              value="${
                user.birth_date
                  ? String(user.birth_date).split("T")[0]
                  : ""
              }"
            />

          </div>


<div class="user-edit-field full">

  <label>주소 *</label>

  <div class="user-edit-address-row">

    <input
      id="editUserAddress"
      type="text"
      value="${escapeHtml(
        user.address || ""
      )}"
      placeholder="주소 검색을 눌러주세요."
      readonly
    />

    <button
      id="editUserAddressSearchButton"
      type="button"
      class="user-edit-address-button"
    >
      <i data-lucide="search"></i>
      주소 검색
    </button>

  </div>

</div>


<div class="user-edit-field full">

  <label>상세주소</label>

  <input
    id="editUserAddressDetail"
    type="text"
    placeholder="동, 호수 등 상세주소를 입력하세요."
  />

</div>


          ${subjectFields}


        </div>


        <div class="user-edit-actions">

          <button
            id="cancelUserEditButton"
            class="user-edit-cancel"
            type="button"
          >
            취소
          </button>

          <button
            id="saveUserEditButton"
            class="user-edit-save"
            type="button"
          >
            수정 완료
          </button>

        </div>

      </div>

    </div>
  `;


  document.body.appendChild(overlay);


  /* 수정창 전용 디자인 */
  const style =
    document.createElement("style");

  style.id = "userEditStyle";

  style.textContent = `

    .user-edit-dialog {
      width: min(760px, calc(100vw - 48px));
      max-height: calc(100vh - 60px);
      overflow-y: auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(12, 29, 41, 0.18);
    }

    .user-edit-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 25px 28px 20px;
      border-bottom: 1px solid #edf1f3;
    }

    .user-edit-header h2 {
      margin: 0 0 6px;
      color: #172027;
      font-size: 20px;
      font-weight: 800;
    }

    .user-edit-header p {
      margin: 0;
      color: #8a959c;
      font-size: 12px;
    }

    .user-edit-close {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      color: #68747b;
      cursor: pointer;
    }

    .user-edit-close svg {
      width: 21px;
      height: 21px;
    }

    .user-edit-body {
      padding: 25px 28px 27px;
    }

    .user-edit-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px 18px;
    }

    .user-edit-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user-edit-field.full {
      grid-column: 1 / -1;
    }

    .user-edit-field label {
      color: #172027;
      font-size: 12px;
      font-weight: 750;
    }

    .user-edit-field input,
    .user-edit-field select,
    .user-edit-field textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #d8e1e6;
      border-radius: 9px;
      background: #ffffff;
      color: #263238;
      font-family: inherit;
      font-size: 13px;
      outline: none;
    }

    .user-edit-field input,
    .user-edit-field select {
      height: 46px;
      padding: 0 14px;
    }

    .user-edit-field textarea {
      min-height: 95px;
      padding: 13px 14px;
      resize: vertical;
    }

    .user-edit-field input:focus,
    .user-edit-field select:focus,
    .user-edit-field textarea:focus {
      border-color: #1688cf;
    }

    .user-edit-address-row {
      display: grid;
      grid-template-columns: 1fr 130px;
      gap: 10px;
    }

    .user-edit-address-button {
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: 1px solid #1688cf;
      border-radius: 9px;
      background: #ffffff;
      color: #1688cf;
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }

    .user-edit-address-button svg {
      width: 17px;
      height: 17px;
    }

    .user-edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 9px;
      margin-top: 27px;
    }

    .user-edit-cancel,
    .user-edit-save {
      height: 43px;
      padding: 0 20px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }

    .user-edit-cancel {
      border: 1px solid #d6dfe4;
      background: #ffffff;
      color: #68747b;
    }

    .user-edit-save {
      border: 0;
      background: #1688cf;
      color: #ffffff;
    }

    @media (max-width: 650px) {

      .user-edit-grid {
        grid-template-columns: 1fr;
      }

      .user-edit-field.full {
        grid-column: auto;
      }

      .user-edit-address-row {
        grid-template-columns: 1fr 110px;
      }
    }
  `;


  document
    .getElementById("userEditStyle")
    ?.remove();

  document.head.appendChild(style);


  const closeEditModal =
    () => {

      overlay.remove();

      document
        .getElementById("userEditStyle")
        ?.remove();
    };


  document
    .getElementById("closeUserEditModal")
    ?.addEventListener(
      "click",
      closeEditModal
    );


  document
    .getElementById("cancelUserEditButton")
    ?.addEventListener(
      "click",
      closeEditModal
    );

    document
  .getElementById(
    "saveUserEditButton"
  )
  ?.addEventListener(
    "click",
    async () => {

      const saveButton =
        document.getElementById(
          "saveUserEditButton"
        );


      const name =
        document
          .getElementById(
            "editUserName"
          )
          ?.value.trim();


      const gender =
        document
          .getElementById(
            "editUserGender"
          )
          ?.value;


      const phone =
        document
          .getElementById(
            "editUserPhone"
          )
          ?.value.trim();


      const birthDate =
        document
          .getElementById(
            "editUserBirthDate"
          )
          ?.value;


      const baseAddress =
        document
          .getElementById(
            "editUserAddress"
          )
          ?.value.trim();


      const detailAddress =
        document
          .getElementById(
            "editUserAddressDetail"
          )
          ?.value.trim();


      if (
        !name ||
        !gender ||
        !phone ||
        !birthDate ||
        !baseAddress
      ) {

        alert(
          "필수 정보를 모두 입력해주세요."
        );

        return;
      }


      const address =
        makeFullAddress(
          baseAddress,
          detailAddress || ""
        );


      const payload = {};


      if (
        name !==
        String(user.name || "")
      ) {
        payload.name =
          name;
      }


      if (
        gender !==
        String(user.gender || "")
      ) {
        payload.gender =
          gender;
      }


      if (
        phone !==
        String(user.phone || "")
      ) {
        payload.phone =
          phone;
      }


      const oldBirthDate =
        user.birth_date
          ? String(
              user.birth_date
            ).split("T")[0]
          : "";


      if (
        birthDate !==
        oldBirthDate
      ) {
        payload.birth_date =
          birthDate;
      }


      /*
        주소는 주소 검색을 새로 했거나
        상세주소를 입력한 경우만 변경
      */

      if (
        address !==
        String(user.address || "")
      ) {
        payload.address =
          address;
      }


      /*
        보호대상자 전용 필드
      */

      if (isSubject) {

        const subjectType =
          document
            .getElementById(
              "editUserSubjectType"
            )
            ?.value;


        const institutionValue =
          document
            .getElementById(
              "editUserInstitution"
            )
            ?.value;


        const specialNotes =
          document
            .getElementById(
              "editUserSpecialNotes"
            )
            ?.value.trim() || "";


        const institutionId =
          institutionValue
            ? Number(
                institutionValue
              )
            : null;


        if (
          subjectType !==
          String(
            user.subject_type ||
            ""
          )
        ) {
          payload.subject_type =
            subjectType;
        }


        const oldInstitutionId =
          user.institution_id ===
            null ||
          user.institution_id ===
            undefined
            ? null
            : Number(
                user.institution_id
              );


        if (
          institutionId !==
          oldInstitutionId
        ) {
          payload.institution_id =
            institutionId;
        }


        if (
          specialNotes !==
          String(
            user.special_notes ||
            ""
          )
        ) {
          payload.special_notes =
            specialNotes;
        }
      }


      if (
        Object.keys(
          payload
        ).length === 0
      ) {

        alert(
          "변경된 정보가 없습니다."
        );

        return;
      }


      const endpoint =
        isSubject
          ? `/subjects/${user.id}`
          : `/guardians/${user.id}`;


      try {

        saveButton.disabled =
          true;


        saveButton.textContent =
          "수정 중...";


        await apiRequest(
          endpoint,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );


        relationCache.clear();


        closeEditModal();


        await loadBaseData();


        await openUserDetail(
          type,
          user.id
        );


        alert(
          "사용자 정보가 수정되었습니다."
        );


      } catch (error) {

        console.error(
          "사용자 정보 수정 실패:",
          error
        );


        alert(
          `사용자 정보 수정 실패\n${error.message}`
        );


      } finally {

        if (
          document.body.contains(
            saveButton
          )
        ) {

          saveButton.disabled =
            false;


          saveButton.textContent =
            "수정 완료";
        }
      }
    }
  );

  overlay.addEventListener(
    "click",
    event => {

      if (event.target === overlay) {
        closeEditModal();
      }
    }
  );


  const editAddressInput =
    document.getElementById(
      "editUserAddress"
    );

const editAddressDetailInput =
  document.getElementById(
    "editUserAddressDetail"
  );

  document
    .getElementById(
      "editUserAddressSearchButton"
    )
    ?.addEventListener(
      "click",
      () => {

        openPostcodeSearch(
  editAddressInput,
  editAddressDetailInput
);
      }
    );


  if (window.lucide) {
    lucide.createIcons();
  }
}

/* ==================================================
   AUTH
================================================== */

function getAuthUsers() {

  const source =
    authTab === "subjects"
      ? subjects
      : guardians;


  const keyword =
    normalize(
      authSearchKeyword
    );


  return source.filter(
    user => {

      if (!keyword) {
        return true;
      }


      return (
        normalize(
          user.name
        ) +
        normalize(
          user.phone
        )
      ).includes(
        keyword
      );
    }
  );
}


function renderAuthManagement() {

  if (
    !authSubjectTab ||
    !authGuardianTab
  ) {
    return;
  }


  const subjectMode =
    authTab === "subjects";


  authSubjectTab.classList.toggle(
    "active",
    subjectMode
  );


  authGuardianTab.classList.toggle(
    "active",
    !subjectMode
  );


  const users =
    getAuthUsers();


  authTableBody.innerHTML =
    users
      .map(
        user => {

          const registered =
            isRegistered(user);


          return `

            <tr>

              <td>
                ${escapeHtml(
                  user.name
                )}
              </td>

              <td>

                ${
                  authTab === "subjects"
                    ? escapeHtml(
                        `보호대상자 · ${getSubjectTypeLabel(
                          user.subject_type
                        )}`
                      )
                    : "보호자"
                }

              </td>

              <td>
                ${escapeHtml(
                  user.phone ||
                  "-"
                )}
              </td>

              <td>

                <span
                  class="${
                    registered
                      ? "code-mask"
                      : "code-empty"
                  }"
                >

                  ${
                    registered
                      ? "••••••"
                      : "미발급"
                  }

                </span>

              </td>

              <td>
                ${renderStatusBadge(
                  user
                )}
              </td>

              <td>

                <button
                  class="detail-button"
                  onclick="
                    openAuthDetail(
                      '${authTab}',
                      ${user.id}
                    )
                  "
                >
                  상세보기
                </button>

              </td>

            </tr>
          `;
        }
      )
      .join("");


  authTotalCount.textContent =
    `전체 ${users.length}건`;
}


function openAuthDetail(
  type,
  id
) {

  closeDrawers();


  const source =
    type === "subjects"
      ? subjects
      : guardians;


  const user =
    source.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!user) {

    alert(
      "해당 사용자를 찾을 수 없습니다."
    );

    return;
  }


  selectedAuthUser = {
    ...user,
    type
  };


  selectedAuthCode =
    user.auth_code ||
    null;


  authDetailName.textContent =
    user.name;


  if (
    type === "subjects"
  ) {

    authDetailRole.textContent =
      `보호대상자 · ${getSubjectTypeLabel(
        user.subject_type
      )}`;


    authDetailType.textContent =
      `보호대상자 · ${getSubjectTypeLabel(
        user.subject_type
      )}`;


  } else {

    authDetailRole.textContent =
      "보호자";


    authDetailType.textContent =
      "보호자";
  }


  authDetailPhone.textContent =
    user.phone ||
    "-";


  updateAuthDetail();


  document.body.classList.add(
    "drawer-open"
  );


  authDetailDrawer.classList.add(
    "open"
  );


  if (window.lucide) {
    lucide.createIcons();
  }
}

function ensureAuthPdfButton() {

  if (
    document.getElementById(
      "downloadAuthPdfButton"
    )
  ) {
    return;
  }


  if (!copyAuthCodeButton) {
    return;
  }


  const button =
    document.createElement(
      "button"
    );


  button.id =
    "downloadAuthPdfButton";


  button.type =
    "button";


  /*
    기존 복사 버튼과 같은 디자인 사용
  */

  button.className =
    copyAuthCodeButton.className;


  button.classList.add(
    "hidden"
  );


  button.title =
    "인증 안내 PDF 다운로드";


  button.innerHTML =
    `
      <i data-lucide="download"></i>
    `;


  copyAuthCodeButton
    .insertAdjacentElement(
      "afterend",
      button
    );


  button.addEventListener(
    "click",
    downloadAuthPdf
  );


  if (window.lucide) {
    lucide.createIcons();
  }
}


async function downloadAuthPdf() {

  if (
    !selectedAuthUser ||
    !selectedAuthCode
  ) {

    alert(
      "먼저 인증코드를 발급해주세요."
    );

    return;
  }


  const pdfButton =
    document.getElementById(
      "downloadAuthPdfButton"
    );


  let guide = null;


  try {

    if (pdfButton) {

      pdfButton.disabled =
        true;
    }


    /*
      PDF 생성에 필요한 라이브러리 불러오기
    */

    await Promise.all([

      loadExternalScript(
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
        () =>
          typeof window.html2canvas ===
          "function"
      ),

      loadExternalScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        () =>
          Boolean(
            window.jspdf?.jsPDF
          )
      )

    ]);


    const userType =
      selectedAuthUser.type ===
        "subjects"
        ? `보호대상자 · ${getSubjectTypeLabel(
            selectedAuthUser.subject_type
          )}`
        : "보호자";


    /*
      PDF에 들어갈 안내서 화면 생성
    */

    guide =
      document.createElement(
        "div"
      );


    guide.style.cssText =
      `
        position:fixed;
        left:-10000px;
        top:0;

        width:794px;
        min-height:1123px;

        box-sizing:border-box;

        padding:80px 70px;

        background:#ffffff;
        color:#172027;

        font-family:
          Arial,
          "Noto Sans KR",
          sans-serif;
      `;


    guide.innerHTML = `

      <div
        style="
          margin-bottom:55px;
        "
      >

        <div
          style="
            margin-bottom:12px;
            color:#1688cf;
            font-size:21px;
            font-weight:800;
          "
        >
          안심하랑께
        </div>


        <h1
          style="
            margin:0;
            color:#172027;
            font-size:35px;
            font-weight:800;
          "
        >
          서비스 등록 안내
        </h1>


        <p
          style="
            margin:13px 0 0;
            color:#7b878e;
            font-size:15px;
          "
        >
          아래 인증코드를 앱 첫 화면에 입력해주세요.
        </p>

      </div>


      <div
        style="
          padding:30px;

          border:1px solid #dde5e9;
          border-radius:16px;

          background:#f8fbfd;
        "
      >

        <div
          style="
            display:grid;
            grid-template-columns:120px 1fr;
            row-gap:22px;
            font-size:16px;
          "
        >

          <span
            style="color:#7a858c;"
          >
            이름
          </span>

          <strong>
            ${escapeHtml(
              selectedAuthUser.name ||
              "-"
            )}
          </strong>


          <span
            style="color:#7a858c;"
          >
            구분
          </span>

          <strong>
            ${escapeHtml(
              userType
            )}
          </strong>


          <span
            style="color:#7a858c;"
          >
            전화번호
          </span>

          <strong>
            ${escapeHtml(
              selectedAuthUser.phone ||
              "-"
            )}
          </strong>

        </div>

      </div>


      <div
        style="
          margin-top:42px;
          padding:36px;

          border:2px solid #1688cf;
          border-radius:18px;

          text-align:center;
        "
      >

        <div
          style="
            margin-bottom:14px;
            color:#68747b;
            font-size:15px;
            font-weight:700;
          "
        >
          인증코드
        </div>


        <div
          style="
            color:#1688cf;
            font-size:43px;
            font-weight:900;
            letter-spacing:7px;
          "
        >
          ${escapeHtml(
            selectedAuthCode
          )}
        </div>

      </div>


      <div
        style="
          margin-top:45px;

          padding:26px 28px;

          border-radius:14px;

          background:#eef7fc;

          color:#42515a;

          font-size:15px;
          line-height:1.9;
        "
      >

        <strong
          style="
            display:block;
            margin-bottom:8px;
            color:#1688cf;
          "
        >
          등록 방법
        </strong>

        1. 안심하랑께 앱을 실행합니다.<br>
        2. 첫 화면의 인증코드 입력란에 위 코드를 입력합니다.<br>
        3. 인증이 완료되면 사용자 정보와 앱이 연결됩니다.

      </div>


      <div
        style="
          margin-top:50px;
          color:#919ba1;
          font-size:12px;
          line-height:1.7;
        "
      >

        본 인증코드는 사용자 등록을 위한 코드입니다.<br>
        타인에게 인증코드를 공개하지 않도록 주의해주세요.

      </div>
    `;


    document.body.appendChild(
      guide
    );


    /*
      HTML 안내서를 이미지로 변환
    */

    const canvas =
      await window.html2canvas(
        guide,
        {
          scale: 2,
          backgroundColor:
            "#ffffff"
        }
      );


    const imageData =
      canvas.toDataURL(
        "image/png"
      );


    const {
      jsPDF
    } =
      window.jspdf;


    const pdf =
      new jsPDF({
        orientation:
          "portrait",

        unit:
          "mm",

        format:
          "a4"
      });


    pdf.addImage(
      imageData,
      "PNG",
      0,
      0,
      210,
      297
    );


    /*
      파일명에 사용할 수 없는 문자 제거
    */

    const safeName =
      String(
        selectedAuthUser.name ||
        "사용자"
      )
        .replace(
          /[\\/:*?"<>|]/g,
          "_"
        );


    pdf.save(
      `${safeName}_인증안내.pdf`
    );


  } catch (error) {

    console.error(
      "인증 안내 PDF 생성 실패:",
      error
    );


    alert(
      "PDF 생성에 실패했습니다."
    );


  } finally {

    guide?.remove();


    if (pdfButton) {

      pdfButton.disabled =
        false;
    }
  }
}

function updateAuthDetail() {

  ensureAuthPdfButton();


  const downloadAuthPdfButton =
    document.getElementById(
      "downloadAuthPdfButton"
    );


  if (selectedAuthCode) {

    authDetailCode.textContent =
      selectedAuthCode;


    authDetailStatus.innerHTML =
      `
        <span class="status-badge registered">
          등록
        </span>
      `;


    copyAuthCodeButton.classList.remove(
      "hidden"
    );

downloadAuthPdfButton
  ?.classList.remove(
    "hidden"
  );

    issueAuthDetailButton.textContent =
      "인증코드 확인";


  } else {

    authDetailCode.textContent =
      "아직 발급되지 않았습니다.";


    authDetailStatus.innerHTML =
      `
        <span class="status-badge unregistered">
          미등록
        </span>
      `;


    copyAuthCodeButton.classList.add(
      "hidden"
    );

downloadAuthPdfButton
  ?.classList.add(
    "hidden"
  );

    issueAuthDetailButton.textContent =
      "인증코드 발급";
  }


  if (window.lucide) {
    lucide.createIcons();
  }
}


async function issueAuthCode() {

  if (!selectedAuthUser) {
    return;
  }


  const endpoint =
    selectedAuthUser.type ===
      "subjects"
      ? `/subjects/${selectedAuthUser.id}/auth-code`
      : `/guardians/${selectedAuthUser.id}/auth-code`;


  try {

    issueAuthDetailButton.disabled =
      true;


    issueAuthDetailButton.textContent =
      "발급 중...";


    const result =
      await apiRequest(
        endpoint,
        {
          method: "POST"
        }
      );


    if (
      !result?.auth_code
    ) {

      throw new Error(
        "백엔드 응답에 인증코드가 없습니다."
      );
    }


    const targetArray =
      selectedAuthUser.type ===
        "subjects"
        ? subjects
        : guardians;


    const targetUser =
      targetArray.find(
        user =>
          Number(user.id) ===
          Number(
            selectedAuthUser.id
          )
      );


    if (targetUser) {

      targetUser.auth_code =
        result.auth_code;
    }


    selectedAuthUser.auth_code =
      result.auth_code;


    selectedAuthCode =
      result.auth_code;


    updateAuthDetail();

    renderAuthManagement();

    renderUserManagement();


    authModalName.textContent =
      `${selectedAuthUser.name}님의 인증코드`;


    authModalCode.textContent =
      result.auth_code;


    authCodeModal.classList.remove(
      "hidden"
    );


  } catch (error) {

    alert(
      `인증코드 발급 실패\n${error.message}`
    );


  } finally {

    issueAuthDetailButton.disabled =
      false;


    if (!selectedAuthCode) {

      issueAuthDetailButton.textContent =
        "인증코드 발급";
    }
  }
}


/* ==================================================
   ALERT RENDER
================================================== */

function getFilteredAlerts() {

  const keyword =
    normalize(
      alertSearchKeyword
    );


  return alerts.filter(
    item => {


      const matchesStatus =
        alertStatusValue ===
          "all" ||
        (
          alertStatusValue ===
            "unread" &&
          !item.read
        ) ||
        (
          alertStatusValue ===
            "read" &&
          item.read
        );


      const matchesKeyword =
        !keyword ||
        (
          normalize(
            item.name
          ) +
          normalize(
            item.phone
          )
        ).includes(
          keyword
        );


      return (
  matchesStatus &&
  matchesKeyword
);
    }
  );
}


function getAlertTypeHtml(item) {

  if (
    item.alertType ===
    "danger"
  ) {

    return `
      <span class="alert-type danger">
        <i data-lucide="shield-alert"></i>
        위험 알림
      </span>
    `;
  }


  return `
    <span class="alert-type auth">
      <i data-lucide="key-round"></i>
      인증 요청
    </span>
  `;
}


function getAlertStatusHtml(item) {

  if (item.read) {

    return `
      <span class="alert-status read">
        확인
      </span>
    `;
  }


  if (
    item.alertType ===
    "danger"
  ) {

    return `
      <span class="alert-status danger-unread">
        미확인
      </span>
    `;
  }


  return `
    <span class="alert-status auth-unread">
      미확인
    </span>
  `;
}


function renderAlertSidebarBadge() {

  const unreadCount =
    alerts.filter(
      item =>
        !item.read
    ).length;


  if (!unreadCount) {

    alertSidebarBadge?.classList.add(
      "hidden"
    );

    return;
  }


  alertSidebarBadge.textContent =
    unreadCount;


  alertSidebarBadge.classList.remove(
    "hidden"
  );
}


function renderAlerts() {

  if (!alertTableBody) {
    return;
  }


  const filtered =
    getFilteredAlerts();

const pageItems = filtered;

  alertTableBody.innerHTML =
    pageItems
      .map(
        item => {

          const rowClass =
            item.read
              ? "alert-row read"
              : `alert-row unread ${item.alertType}`;


          const actionClass =
            item.read
              ? `${item.alertType} read`
              : item.alertType;


          const actionText =
            item.alertType ===
              "danger"
              ? "실시간 관제로 이동"
              : "인증코드 관리로 이동";


          const riskScoreText =
            item.alertType ===
              "danger" &&
            item.riskScore !== null &&
            item.riskScore !== undefined
              ? `
                <span
                  style="
                    display:block;
                    margin-top:3px;
                    color:#7b858c;
                    font-size:11px;
                  "
                >
                  위험도
                  ${escapeHtml(
                    item.riskScore
                  )}점
                </span>
              `
              : "";


          return `

            <tr class="${rowClass}">

              <td>
                ${escapeHtml(
                  formatDateTime(
                    item.createdAt
                  )
                )}
              </td>

              <td>

                <strong>
                  ${escapeHtml(
                    item.name
                  )}
                </strong>

                ${
                  item.displayInfo
                    ? `
                      <span>
                        (${escapeHtml(
                          item.displayInfo
                        )})
                      </span>
                    `
                    : ""
                }

              </td>

              <td>
                ${getAlertTypeHtml(
                  item
                )}
              </td>

              <td>
                ${escapeHtml(
                  item.message
                )}
                ${riskScoreText}
              </td>

              <td>
                ${getAlertStatusHtml(
                  item
                )}
              </td>

              <td>

                <button
                  class="
                    alert-action-button
                    ${actionClass}
                  "
                  onclick="
                    routeFromAlert(
                      ${item.id}
                    )
                  "
                >

                  ${actionText}

                  <i data-lucide="chevron-right"></i>

                </button>

              </td>

            </tr>
          `;
        }
      )
      .join("");


  if (!pageItems.length) {

    alertTableBody.innerHTML =
      `
        <tr>

          <td
            colspan="6"
            style="
              text-align:center;
              height:180px;
              color:#79858d;
            "
          >
            ${
              alerts.length === 0
                ? "현재 등록된 알림이 없습니다."
                : "조건에 맞는 알림이 없습니다."
            }
          </td>

        </tr>
      `;
  }



  alertTotalCount.textContent =
    `전체 ${filtered.length}건`;


  renderAlertSidebarBadge();




  if (window.lucide) {
    lucide.createIcons();
  }
}



/* ==================================================
   ALERT ROUTING
================================================== */

async function routeFromAlert(
  alertId
) {

  const item =
    alerts.find(
      alertItem =>
        Number(
          alertItem.id
        ) ===
        Number(alertId)
    );


  if (!item) {
    return;
  }


  await markAlertAsRead(
    item.id
  );


  if (
    item.alertType ===
    "danger"
  ) {

    showPage(
      "realtime"
    );


    setTimeout(
      async () => {

        const subject =
          findSubjectById(
            item.subjectId
          );


        if (subject) {

          await selectMonitorSubject(
            subject.id
          );

        } else {

          alert(
            "이 알림에 연결된 보호대상자를 찾을 수 없습니다."
          );
        }

      },
      150
    );


    return;
  }


  let targetType = null;
  let targetUser = null;


  if (
    item.guardianId !== null &&
    item.guardianId !== undefined &&
    Number(item.guardianId) > 0
  ) {

    targetType =
      "guardians";


    targetUser =
      findGuardianById(
        item.guardianId
      );


  } else if (
    item.subjectId !== null &&
    item.subjectId !== undefined &&
    Number(item.subjectId) > 0
  ) {

    targetType =
      "subjects";


    targetUser =
      findSubjectById(
        item.subjectId
      );
  }


  if (
    !targetType ||
    !targetUser
  ) {

    alert(
      "이 인증 요청에 연결된 사용자를 찾을 수 없습니다."
    );

    return;
  }


  authTab =
    targetType;


  showPage(
    "auth"
  );


  renderAuthManagement();


  setTimeout(
    () => {

      openAuthDetail(
        targetType,
        targetUser.id
      );

    },
    100
  );
}


/* ==================================================
   MAP
================================================== */

function initializeMap() {

  if (liveMap) {
    return;
  }


  const mapElement =
    document.getElementById(
      "liveMap"
    );


  if (
    !mapElement ||
    typeof L === "undefined"
  ) {
    return;
  }


  liveMap =
    L.map(
      "liveMap",
      {
        zoomControl: true
      }
    )
      .setView(
        [
          36.5,
          127.8
        ],
        7
      );


  L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,

      attribution:
        "&copy; OpenStreetMap"
    }
  )
    .addTo(
      liveMap
    );
}


/* ==================================================
   MONITOR
================================================== */

function getMonitorSubjects() {

  const keyword =
    normalize(
      monitorSearchKeyword
    );


  return subjects.filter(
    subject => {

      const matchesKeyword =
        !keyword ||
        (
          normalize(
            subject.name
          ) +
          normalize(
            subject.phone
          )
        ).includes(
          keyword
        );


      const matchesType =
        monitorTypeValue ===
          "all" ||
        String(
          subject.subject_type ||
          ""
        ).toLowerCase() ===
          monitorTypeValue;


      return (
        matchesKeyword &&
        matchesType
      );
    }
  );
}


function renderMonitorSubjects() {

  if (!monitorSubjectList) {
    return;
  }


  const items =
    getMonitorSubjects();


  monitorSubjectCount.textContent =
    `${items.length}명`;


  if (!items.length) {

    monitorSubjectList.innerHTML =
      `
        <div class="institution-empty">
          검색 결과가 없습니다.
        </div>
      `;

    return;
  }


  monitorSubjectList.innerHTML =
    items
      .map(
        subject => {

          const active =
            Number(
              selectedMonitorSubject?.id
            ) ===
            Number(subject.id);


          return `

            <button
              class="
                monitor-subject-item
                ${active ? "active" : ""}
              "
              onclick="
                selectMonitorSubject(
                  ${subject.id}
                )
              "
            >

              <div class="monitor-list-avatar">
                <i data-lucide="user-round"></i>
              </div>

              <div class="monitor-subject-info">

                <strong>
                  ${escapeHtml(
                    subject.name
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    getSubjectTypeLabel(
                      subject.subject_type
                    )
                  )}
                </span>

                <span>
                  ${escapeHtml(
                    subject.phone ||
                    "-"
                  )}
                </span>

              </div>

            </button>
          `;
        }
      )
      .join("");


  if (window.lucide) {
    lucide.createIcons();
  }
}
/* ==================================================
   REALTIME ENVIRONMENT
   날씨 + 대기질
================================================== */

function getPrecipitationLabel(
  value
) {

  const labels = {
    "0": "강수 없음",
    "1": "비",
    "2": "비/눈",
    "3": "눈",
    "5": "빗방울",
    "6": "빗방울/눈날림",
    "7": "눈날림"
  };


  return (
    labels[
      String(value)
    ] ||
    "강수 정보 없음"
  );
}


function getWindDirectionLabel(
  degree
) {

  const number =
    Number(degree);


  if (
    !Number.isFinite(number)
  ) {
    return "-";
  }


  const directions = [
    "북",
    "북동",
    "동",
    "남동",
    "남",
    "남서",
    "서",
    "북서"
  ];


  const index =
    Math.round(
      number / 45
    ) % 8;


  return (
    `${directions[index]}풍 (${number}°)`
  );
}


function getAirGradeLabel(
  grade
) {

  const labels = {
    "1": "좋음",
    "2": "보통",
    "3": "나쁨",
    "4": "매우 나쁨"
  };


  return (
    labels[
      String(grade)
    ] ||
    "정보 없음"
  );
}


function resetEnvironmentCards() {

  const temperature =
    document.getElementById(
      "monitorWeatherTemperature"
    );

  const condition =
    document.getElementById(
      "monitorWeatherCondition"
    );

  const humidity =
    document.getElementById(
      "monitorWeatherHumidity"
    );

  const rainfall =
    document.getElementById(
      "monitorWeatherRainfall"
    );

  const windSpeed =
    document.getElementById(
      "monitorWeatherWindSpeed"
    );

  const windDirection =
    document.getElementById(
      "monitorWeatherWindDirection"
    );

  const airGrade =
    document.getElementById(
      "monitorAirQualityGrade"
    );

  const airDust =
    document.getElementById(
      "monitorAirQualityDust"
    );


  if (temperature) {
    temperature.textContent =
      "조회 중...";
  }


  if (condition) {
    condition.textContent =
      "-";
  }


  if (humidity) {
    humidity.textContent =
      "조회 중...";
  }


  if (rainfall) {
    rainfall.textContent =
      "-";
  }


  if (windSpeed) {
    windSpeed.textContent =
      "조회 중...";
  }


  if (windDirection) {
    windDirection.textContent =
      "-";
  }


  if (airGrade) {
    airGrade.textContent =
      "조회 중...";
  }


  if (airDust) {
    airDust.textContent =
      "-";
  }
}

async function loadRealtimeEnvironment(
  subject
) {

  if (!subject) {
    return;
  }


  resetEnvironmentCards();


  const temperature =
    document.getElementById(
      "monitorWeatherTemperature"
    );

  const condition =
    document.getElementById(
      "monitorWeatherCondition"
    );

  const humidity =
    document.getElementById(
      "monitorWeatherHumidity"
    );

  const rainfall =
    document.getElementById(
      "monitorWeatherRainfall"
    );

  const windSpeed =
    document.getElementById(
      "monitorWeatherWindSpeed"
    );

  const windDirection =
    document.getElementById(
      "monitorWeatherWindDirection"
    );

  const airGrade =
    document.getElementById(
      "monitorAirQualityGrade"
    );

  const airDust =
    document.getElementById(
      "monitorAirQualityDust"
    );


  const [
    weatherResult,
    airResult
  ] =
    await Promise.allSettled([

      apiRequest(
        `/environment/weather/${subject.id}`
      ),

      apiRequest(
        `/environment/air/${subject.id}`
      )

    ]);


  /* =========================
     날씨
  ========================= */

  if (
    weatherResult.status ===
    "fulfilled"
  ) {

    const weather =
      weatherResult.value || {};


    if (temperature) {
      temperature.textContent =
        weather.temperature != null
          ? `${weather.temperature}°C`
          : "-";
    }


    if (condition) {
      condition.textContent =
        getPrecipitationLabel(
          weather.precipitation_type
        );
    }


    if (humidity) {
      humidity.textContent =
        weather.humidity != null
          ? `${weather.humidity}%`
          : "-";
    }


    if (rainfall) {
      rainfall.textContent =
        weather.rainfall_1h != null
          ? `최근 1시간 ${weather.rainfall_1h}mm`
          : "-";
    }


    if (windSpeed) {
      windSpeed.textContent =
        weather.wind_speed != null
          ? `${weather.wind_speed} m/s`
          : "-";
    }


    if (windDirection) {
      windDirection.textContent =
        getWindDirectionLabel(
          weather.wind_direction
        );
    }

  } else {

    console.error(
      "날씨 API 조회 실패:",
      weatherResult.reason
    );


    if (temperature) {
      temperature.textContent =
        "정보 없음";
    }

    if (condition) {
      condition.textContent =
        "-";
    }

    if (humidity) {
      humidity.textContent =
        "정보 없음";
    }

    if (rainfall) {
      rainfall.textContent =
        "-";
    }

    if (windSpeed) {
      windSpeed.textContent =
        "정보 없음";
    }

    if (windDirection) {
      windDirection.textContent =
        "-";
    }
  }


  /* =========================
     대기질
  ========================= */

  if (
    airResult.status ===
    "fulfilled"
  ) {

    const air =
      airResult.value?.air_quality ||
      {};


    if (airGrade) {
      airGrade.textContent =
        getAirGradeLabel(
          air.khai_grade
        );
    }


    if (airDust) {
      airDust.textContent =
        `PM10 ${air.pm10 ?? "-"} · PM2.5 ${air.pm25 ?? "-"}`;
    }

  } else {

    console.error(
      "대기질 API 조회 실패:",
      airResult.reason
    );


    if (airGrade) {
      airGrade.textContent =
        "정보 없음";
    }

    if (airDust) {
      airDust.textContent =
        "-";
    }
  }


  if (window.lucide) {
    lucide.createIcons();
  }
}

async function selectMonitorSubject(
  id
) {

  const subject =
    subjects.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!subject) {
    return;
  }


  selectedMonitorSubject =
    subject;


  renderMonitorSubjects();


  monitorEmptyDetail.classList.add(
    "hidden"
  );


  monitorDetailContent.classList.remove(
    "hidden"
  );


  monitorDetailName.textContent =
    subject.name;


  monitorDetailRole.textContent =
    `보호대상자 · ${getSubjectTypeLabel(
      subject.subject_type
    )}`;


  monitorDetailPhone.textContent =
    subject.phone ||
    "-";


  monitorCoordinates.textContent =
    "위치 조회 중...";


  monitorUpdatedAt.textContent =
    "";


  nearestInstitutionList.innerHTML =
    `
      <div class="mini-loading">
        가까운 기관을 찾고 있습니다...
      </div>
    `;

await Promise.allSettled([

  loadSubjectGps(
    subject
  ),

  loadRealtimeEnvironment(
    subject
  )

]);

  if (window.lucide) {
    lucide.createIcons();
  }
}

/* ==================================================
   GPS -> 주소 변환
================================================== */

async function reverseGeocodeAddress(
  latitude,
  longitude
) {

  try {

    const response =
      await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=ko`
      );


    if (!response.ok) {

      throw new Error(
        `주소 변환 실패 (${response.status})`
      );
    }


    const data =
      await response.json();


    const address =
      data.address ||
      {};


    const province =
      address.state ||
      address.province ||
      "";


    const city =
      address.city ||
      address.county ||
      address.municipality ||
      "";


    const district =
      address.borough ||
      address.city_district ||
      address.district ||
      "";


    const town =
      address.town ||
      address.village ||
      address.suburb ||
      address.quarter ||
      "";


    const road =
      address.road ||
      "";


    const parts =
      [
        province,
        city,
        district,
        town,
        road
      ]
        .filter(Boolean);


    /*
      중복 제거
      예: 전라남도 영암군 영암군 -> 방지
    */

    const uniqueParts =
      [...new Set(parts)];


    if (
      uniqueParts.length
    ) {

      return uniqueParts.join(
        " "
      );
    }


    return (
      data.display_name ||
      `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    );


  } catch (error) {

    console.warn(
      "GPS 주소 변환 실패:",
      error
    );


    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
}

async function loadSubjectGps(
  subject
) {

  try {

    const gps =
      await apiRequest(
        `/gps/latest/${subject.id}`
      );


    const latitude =
      toNumber(
        gps?.latitude
      );


    const longitude =
      toNumber(
        gps?.longitude
      );


    if (
      latitude === null ||
      longitude === null
    ) {

      throw new Error(
        "유효한 GPS 좌표가 없습니다."
      );
    }


    selectedGps = {
      ...gps,
      latitude,
      longitude
    };

monitorCoordinates.textContent =
  "주소 확인 중...";


const locationAddress =
  await reverseGeocodeAddress(
    latitude,
    longitude
  );

const addressParts =
  locationAddress.split(" ");


let mainAddress = "";
let detailAddress = "";


// "-시"가 나오는 위치 찾기
const cityIndex =
  addressParts.findIndex(
    part => part.endsWith("시")
  );


if (cityIndex !== -1) {

  // 시까지 첫 번째 줄
  mainAddress =
    addressParts
      .slice(0, cityIndex + 1)
      .join(" ");


  // 시 이후 주소는 두 번째 줄
  detailAddress =
    addressParts
      .slice(cityIndex + 1)
      .join(" ");

} else {

  // 시가 없는 지역은 앞의 두 단어를 첫 줄로
  mainAddress =
    addressParts
      .slice(0, 2)
      .join(" ");


  detailAddress =
    addressParts
      .slice(2)
      .join(" ");
}


monitorCoordinates.innerHTML =
  `
    <strong
      style="
        display:block;
        color:#243038;
        font-size:11px;
        font-weight:700;
        line-height:1.4;
        margin-bottom:2px;
      "
    >
      ${escapeHtml(mainAddress)}
    </strong>

    ${
      detailAddress
        ? `
          <span
            style="
              display:block;
              color:#56636b;
              font-size:10px;
              line-height:1.4;
              margin-bottom:4px;
            "
          >
            ${escapeHtml(detailAddress)}
          </span>
        `
        : ""
    }

    <span
      style="
        display:block;
        color:#98a3aa;
        font-size:8px;
      "
    >
      ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
    </span>
  `;

    monitorUpdatedAt.textContent =
      formatDateTime(
        gps.measured_at
      );


    showSubjectOnMap(
      subject,
      selectedGps
    );


    await loadNearestInstitutions(
      subject,
      selectedGps
    );


  } catch (error) {

    selectedGps =
      null;


    monitorCoordinates.textContent =
      "등록된 GPS 위치가 없습니다.";


    monitorUpdatedAt.textContent =
      "-";


    nearestInstitutionList.innerHTML =
      `
        <div class="institution-empty">
          현재 위치가 없어 주변 기관을 표시할 수 없습니다.
        </div>
      `;
  }
}


function showSubjectOnMap(
  subject,
  gps
) {

  initializeMap();


  if (!liveMap) {
    return;
  }


  mapEmptyState?.classList.add(
    "hidden"
  );


  if (subjectMarker) {

    liveMap.removeLayer(
      subjectMarker
    );
  }


  clearInstitutionMarkers();


  const icon =
    L.divIcon({
      className: "",

      html:
        `
          <div class="subject-map-marker">
            ●
          </div>
        `,

      iconSize:
        [34, 34],

      iconAnchor:
        [17, 17]
    });


  subjectMarker =
    L.marker(
      [
        gps.latitude,
        gps.longitude
      ],
      {
        icon
      }
    )
      .addTo(
        liveMap
      )
      .bindPopup(
        `
          <strong>
            ${escapeHtml(
              subject.name
            )}
          </strong><br>

          ${escapeHtml(
            getSubjectTypeLabel(
              subject.subject_type
            )
          )}
        `
      );


  liveMap.setView(
    [
      gps.latitude,
      gps.longitude
    ],
    15
  );
}


/* ==================================================
   INSTITUTION
================================================== */

async function loadNearestInstitutions(
  subject,
  gps
) {

  let nearestRaw =
    null;


  try {

    nearestRaw =
      await apiRequest(
        `/subjects/${subject.id}/institutions/nearest?radius_km=10&limit=5`
      );


  } catch (error) {

    console.warn(
      "기관 API 실패:",
      error
    );
  }


  let nearest =
    normalizeInstitutionResponse(
      nearestRaw
    );


  if (!nearest.length) {

    nearest =
      calculateNearestInstitutions(
        gps.latitude,
        gps.longitude,
        institutions,
        5
      );
  }


  nearest =
    enrichInstitutionData(
      nearest,
      gps
    );


  renderInstitutions(
    nearestInstitutionList,
    nearest
  );


  showInstitutionsOnMap(
    nearest
  );
}


function normalizeInstitutionResponse(
  raw
) {

  if (!raw) {
    return [];
  }


  if (
    Array.isArray(raw)
  ) {
    return raw;
  }


  if (
    typeof raw === "object"
  ) {

    if (
      Array.isArray(
        raw.items
      )
    ) {
      return raw.items;
    }


    if (
      Array.isArray(
        raw.institutions
      )
    ) {
      return raw.institutions;
    }


    if (
      Array.isArray(
        raw.results
      )
    ) {
      return raw.results;
    }


    return [raw];
  }


  return [];
}


function haversineDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371;


  const toRad =
    degree =>
      degree *
      Math.PI /
      180;


  const dLat =
    toRad(
      lat2 -
      lat1
    );


  const dLon =
    toRad(
      lon2 -
      lon1
    );


  const a =
    Math.sin(
      dLat / 2
    ) ** 2 +
    Math.cos(
      toRad(lat1)
    ) *
    Math.cos(
      toRad(lat2)
    ) *
    Math.sin(
      dLon / 2
    ) ** 2;


  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a
      )
    )
  );
}


function calculateNearestInstitutions(
  latitude,
  longitude,
  list,
  limit = 5
) {

  return list
    .filter(
      item =>
        toNumber(
          item.latitude
        ) !== null &&
        toNumber(
          item.longitude
        ) !== null
    )
    .map(
      item => {

        const distance =
          haversineDistance(
            latitude,
            longitude,
            Number(
              item.latitude
            ),
            Number(
              item.longitude
            )
          );


        return {
          ...item,
          distance_km: distance
        };
      }
    )
    .sort(
      (a, b) =>
        a.distance_km -
        b.distance_km
    )
    .slice(
      0,
      limit
    );
}


function enrichInstitutionData(
  list,
  gps
) {

  return list
    .map(
      item => {

        let matched =
          null;


        if (
          item.id !== undefined
        ) {

          matched =
            institutions.find(
              institution =>
                institution.id ===
                Number(item.id)
            );
        }


        if (
          !matched &&
          item.institution_id !== undefined
        ) {

          matched =
            institutions.find(
              institution =>
                institution.id ===
                Number(
                  item.institution_id
                )
            );
        }


        if (
          !matched &&
          item.name
        ) {

          matched =
            institutions.find(
              institution =>
                institution.name ===
                item.name
            );
        }


        const merged = {
          ...(matched || {}),
          ...item
        };


        const latitude =
          toNumber(
            merged.latitude
          );


        const longitude =
          toNumber(
            merged.longitude
          );


        if (
          merged.distance_km === undefined &&
          latitude !== null &&
          longitude !== null
        ) {

          merged.distance_km =
            haversineDistance(
              gps.latitude,
              gps.longitude,
              latitude,
              longitude
            );
        }


        return merged;
      }
    )
    .filter(Boolean);
}


function renderInstitutions(
  container,
  items
) {

  if (!container) {
    return;
  }


  if (!items.length) {

    container.innerHTML =
      `
        <div class="institution-empty">
          조회된 기관이 없습니다.
        </div>
      `;

    return;
  }


  container.innerHTML =
    items
      .slice(
        0,
        5
      )
      .map(
        item => {

          const distance =
            Number.isFinite(
              Number(
                item.distance_km
              )
            )
              ? `${Number(
                  item.distance_km
                ).toFixed(2)}km`
              : "";


          return `

            <article class="institution-card">

              <div class="institution-icon">
                <i data-lucide="building-2"></i>
              </div>

              <div class="institution-info">

                <div class="institution-title-row">

                  <strong>
                    ${escapeHtml(
                      item.name ||
                      "기관 정보"
                    )}
                  </strong>

                  <span class="institution-distance">
                    ${escapeHtml(
                      distance
                    )}
                  </span>

                </div>

                <span>
                  ${escapeHtml(
                    item.institution_type ||
                    "-"
                  )}
                </span>

                <small>
                  ${escapeHtml(
                    item.address ||
                    "주소 정보 없음"
                  )}
                </small>

                ${
                  item.phone
                    ? `
                      <small>
                        ☎ ${escapeHtml(
                          item.phone
                        )}
                      </small>
                    `
                    : ""
                }

              </div>

            </article>
          `;
        }
      )
      .join("");


  if (window.lucide) {
    lucide.createIcons();
  }
}


function clearInstitutionMarkers() {

  institutionMarkers.forEach(
    marker =>
      liveMap?.removeLayer(
        marker
      )
  );


  institutionMarkers =
    [];
}


function showInstitutionsOnMap(
  items
) {

  if (!liveMap) {
    return;
  }


  clearInstitutionMarkers();


  items.forEach(
    item => {

      const latitude =
        toNumber(
          item.latitude
        );


      const longitude =
        toNumber(
          item.longitude
        );


      if (
        latitude === null ||
        longitude === null
      ) {
        return;
      }


      const icon =
        L.divIcon({
          className: "",

          html:
            `
              <div class="institution-map-marker">
                +
              </div>
            `,

          iconSize:
            [27, 27],

          iconAnchor:
            [13, 13]
        });


      const marker =
        L.marker(
          [
            latitude,
            longitude
          ],
          {
            icon
          }
        )
          .addTo(
            liveMap
          )
          .bindPopup(
            `
              <strong>
                ${escapeHtml(
                  item.name ||
                  "기관"
                )}
              </strong><br>

              ${escapeHtml(
                item.address ||
                ""
              )}
            `
          );


      institutionMarkers.push(
        marker
      );
    }
  );
}


/* ==================================================
   NAV
================================================== */

dashboardNav?.addEventListener(
  "click",
  () =>
    showPage(
      "dashboard"
    )
);


userNav?.addEventListener(
  "click",
  () =>
    showPage(
      "users"
    )
);


realtimeNav?.addEventListener(
  "click",
  () =>
    showPage(
      "realtime"
    )
);


authNav?.addEventListener(
  "click",
  () =>
    showPage(
      "auth"
    )
);


alertNav?.addEventListener(
  "click",
  () =>
    showPage(
      "alerts"
    )
);





/* ==================================================
   USER EVENTS
================================================== */

userSubjectTab?.addEventListener(
  "click",
  () => {

    userTab =
      "subjects";


    renderUserManagement();
  }
);


userGuardianTab?.addEventListener(
  "click",
  () => {

    userTab =
      "guardians";


    renderUserManagement();
  }
);


userSearchInput?.addEventListener(
  "input",
  event => {

    userSearchKeyword =
      event.target.value;


    renderUserManagement();
  }
);


userTypeFilter?.addEventListener(
  "change",
  event => {

    userTypeFilterValue =
      event.target.value;


    renderUserManagement();
  }
);


userAddressInput?.addEventListener(
  "input",
  event => {

    userAddressKeyword =
      event.target.value;


    renderUserManagement();
  }
);


/* ==================================================
   ADDRESS EVENTS
================================================== */

subjectAddressSearchButton?.addEventListener(
  "click",
  () => {

    openPostcodeSearch(
      subjectAddress,
      subjectAddressDetail
    );
  }
);


subjectAddress?.addEventListener(
  "click",
  () => {

    openPostcodeSearch(
      subjectAddress,
      subjectAddressDetail
    );
  }
);


guardianAddressSearchButton?.addEventListener(
  "click",
  () => {

    openPostcodeSearch(
      guardianAddress,
      guardianAddressDetail
    );
  }
);


guardianAddress?.addEventListener(
  "click",
  () => {

    openPostcodeSearch(
      guardianAddress,
      guardianAddressDetail
    );
  }
);


/* ==================================================
   ADD USER EVENTS
================================================== */

addUserButton?.addEventListener(
  "click",
  openAddUserModal
);


closeAddUserModal?.addEventListener(
  "click",
  closeUserAddModal
);


document
  .querySelectorAll(
    "[data-close-user-modal]"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        closeUserAddModal
      );
    }
  );


addUserModal?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      addUserModal
    ) {

      closeUserAddModal();
    }
  }
);


addSubjectTab?.addEventListener(
  "click",
  showSubjectForm
);


addGuardianTab?.addEventListener(
  "click",
  showGuardianForm
);


subjectForm?.addEventListener(
  "submit",
  createSubject
);


guardianForm?.addEventListener(
  "submit",
  createGuardian
);


/* ==================================================
   AUTH EVENTS
================================================== */

authSubjectTab?.addEventListener(
  "click",
  () => {

    authTab =
      "subjects";


    renderAuthManagement();
  }
);


authGuardianTab?.addEventListener(
  "click",
  () => {

    authTab =
      "guardians";


    renderAuthManagement();
  }
);


authSearchInput?.addEventListener(
  "input",
  event => {

    authSearchKeyword =
      event.target.value;


    renderAuthManagement();
  }
);


issueAuthDetailButton?.addEventListener(
  "click",
  () => {

    if (selectedAuthCode) {

      authModalName.textContent =
        `${selectedAuthUser.name}님의 인증코드`;


      authModalCode.textContent =
        selectedAuthCode;


      authCodeModal.classList.remove(
        "hidden"
      );


      return;
    }


    issueAuthCode();
  }
);


alertSearchInput?.addEventListener(
  "input",
  event => {

    alertSearchKeyword =
      event.target.value;


    renderAlerts();
  }
);


alertStatusFilter?.addEventListener(
  "change",
  event => {

    alertStatusValue =
      event.target.value;


    renderAlerts();
  }
);


/* ==================================================
   REALTIME EVENTS
================================================== */

monitorSearchInput?.addEventListener(
  "input",
  event => {

    monitorSearchKeyword =
      event.target.value;


    renderMonitorSubjects();
  }
);


monitorTypeFilter?.addEventListener(
  "change",
  event => {

    monitorTypeValue =
      event.target.value;


    renderMonitorSubjects();
  }
);


realtimeRefreshButton?.addEventListener(
  "click",
  async () => {

    const selectedId =
      selectedMonitorSubject?.id;


    await loadBaseData();


    if (selectedId) {

      const refreshedSubject =
        subjects.find(
          subject =>
            Number(subject.id) ===
            Number(selectedId)
        );


      if (
        refreshedSubject
      ) {

        await selectMonitorSubject(
          refreshedSubject.id
        );
      }
    }
  }
);


focusMapButton?.addEventListener(
  "click",
  () => {

    if (
      !selectedGps ||
      !liveMap
    ) {
      return;
    }


    liveMap.setView(
      [
        selectedGps.latitude,
        selectedGps.longitude
      ],
      16
    );


    subjectMarker?.openPopup();
  }
);


/* ==================================================
   COPY
================================================== */

copyAuthCodeButton?.addEventListener(
  "click",
  async () => {

    if (!selectedAuthCode) {
      return;
    }


    await navigator.clipboard.writeText(
      selectedAuthCode
    );
  }
);


copyModalCode?.addEventListener(
  "click",
  async () => {

    if (!selectedAuthCode) {
      return;
    }


    await navigator.clipboard.writeText(
      selectedAuthCode
    );
  }
);


/* ==================================================
   CLOSE
================================================== */

closeUserDrawer?.addEventListener(
  "click",
  closeDrawers
);


closeAuthDrawer?.addEventListener(
  "click",
  closeDrawers
);


closeAuthModal?.addEventListener(
  "click",
  () => {

    authCodeModal.classList.add(
      "hidden"
    );
  }
);


confirmAuthModal?.addEventListener(
  "click",
  () => {

    authCodeModal.classList.add(
      "hidden"
    );
  }
);


authCodeModal?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      authCodeModal
    ) {

      authCodeModal.classList.add(
        "hidden"
      );
    }
  }
);


/* ==================================================
   OUTSIDE CLICK
================================================== */

document.addEventListener(
  "click",
  event => {

    const menu =
      document.getElementById(
        "adminMenuDropdown"
      );


    const admin =
      document.querySelector(
        ".admin"
      );


    if (
      menu &&
      admin &&
      !admin.contains(
        event.target
      )
    ) {

      menu.remove();
    }
  }
);


/* ==================================================
   GLOBAL
================================================== */

window.openUserDetail =
  openUserDetail;


window.openAuthDetail =
  openAuthDetail;


window.selectMonitorSubject =
  selectMonitorSubject;


window.routeFromAlert =
  routeFromAlert;


window.openDashboardSubject =
  openDashboardSubject;


/* ==================================================
   START
================================================== */

async function startApp() {

  /*
    UI 디자인 / 관리자 메뉴 적용
  */

  installUiPatch();

  setupTopbar();


  if (window.lucide) {
    lucide.createIcons();
  }


  /*
    첫 화면 = 대시보드
  */

  currentPage =
    "dashboard";


  previousPages =
    [];


  showPage(
    "dashboard"
  );


  /*
    실제 데이터 불러오기
  */

  await loadBaseData();

  await loadAlerts();

  renderDashboard();


  /*
    알림 10초마다 자동 갱신
  */

  setInterval(
    () => {

      loadAlerts();

    },
    10000
  );
}


startApp();

/* ==================================================
   LOGIN MANAGER PROFILE PATCH
   - 로그인한 실제 관리자 정보 사용
   - 드롭다운
   - 내 정보
   - 설정 화면
================================================== */

(function () {

  const MANAGER_SESSION_KEY =
    "ansim_manager_session";


  /* ================================================
     현재 로그인 관리자 불러오기
  ================================================= */

  function getLoggedInManager() {

    try {

      const saved =
        sessionStorage.getItem(
          MANAGER_SESSION_KEY
        );


      if (!saved) {
        return null;
      }


      return JSON.parse(
        saved
      );


    } catch (error) {

      console.error(
        "관리자 세션 읽기 실패:",
        error
      );


      return null;
    }
  }


  /* ================================================
     관리자 드롭다운
  ================================================= */

  toggleAdminMenu =
    function () {

      const admin =
        document.querySelector(
          ".admin"
        );


      if (!admin) {
        return;
      }


      const existing =
        document.getElementById(
          "adminMenuDropdown"
        );


      if (existing) {

        existing.remove();

        return;
      }


      const manager =
        getLoggedInManager();


      const managerName =
        manager?.name ||
        "관리자";


      const menu =
        document.createElement(
          "div"
        );


      menu.id =
        "adminMenuDropdown";


      menu.className =
        "admin-menu-dropdown";


      menu.innerHTML = `

        <div class="admin-dropdown-profile">

          <div class="admin-dropdown-avatar">
            <i data-lucide="user-round"></i>
          </div>

          <div>

            <strong>
              ${escapeHtml(
                managerName
              )}
            </strong>

            <span>
              관리자
            </span>

          </div>

        </div>


        <button
          id="myInfoMenuButton"
          class="admin-dropdown-item"
          type="button"
        >
          <i data-lucide="user"></i>
          내 정보
        </button>


        <button
          id="accountSettingsMenuButton"
          class="admin-dropdown-item"
          type="button"
        >
          <i data-lucide="settings"></i>
          설정
        </button>


        <button
          id="logoutMenuButton"
          class="admin-dropdown-item logout"
          type="button"
        >
          <i data-lucide="log-out"></i>
          로그아웃
        </button>
      `;


      admin.appendChild(
        menu
      );


      menu.addEventListener(
        "click",
        event => {

          event.stopPropagation();
        }
      );


      document
        .getElementById(
          "myInfoMenuButton"
        )
        ?.addEventListener(
          "click",
          () => {

            menu.remove();

            openMyInfoModal();
          }
        );


      document
        .getElementById(
          "accountSettingsMenuButton"
        )
        ?.addEventListener(
          "click",
          () => {

            menu.remove();

            openSettingsModal();
          }
        );


      document
        .getElementById(
          "logoutMenuButton"
        )
        ?.addEventListener(
          "click",
          () => {

            menu.remove();

            openLogoutConfirm();
          }
        );


      if (window.lucide) {
        lucide.createIcons();
      }
    };


  /* ================================================
     내 정보
  ================================================= */

  openMyInfoModal =
    function () {

      closeAccountOverlay();


      const manager =
        getLoggedInManager();


      const name =
        manager?.name ||
        "-";


      const email =
        manager?.email ||
        "-";


      const phone =
        manager?.phone ||
        "-";


      const institutionName =
        manager?.institutionName ||
        (
          manager?.institutionId
            ? `기관 ID ${manager.institutionId}`
            : "-"
        );


      const overlay =
        document.createElement(
          "div"
        );


      overlay.id =
        "accountOverlay";


      overlay.className =
        "account-overlay";


      overlay.innerHTML = `

        <div class="account-dialog">

          <div class="account-dialog-header">

            <h2>
              내 정보
            </h2>

            <button
              class="account-dialog-close"
              type="button"
              id="closeAccountDialog"
            >
              <i data-lucide="x"></i>
            </button>

          </div>


          <div class="account-dialog-body">

            <div class="account-profile-area">

              <div class="account-big-avatar">
                <i data-lucide="user-round"></i>
              </div>


              <div class="account-info-grid">

                <span>이름</span>

                <strong>
                  ${escapeHtml(name)}
                </strong>


                <span>역할</span>

                <strong>
                  관리자
                </strong>


                <span>이메일</span>

                <strong>
                  ${escapeHtml(email)}
                </strong>


                <span>연락처</span>

                <strong>
                  ${escapeHtml(phone)}
                </strong>


                <span>소속 기관</span>

                <strong>
                  ${escapeHtml(
                    institutionName
                  )}
                </strong>

              </div>

            </div>

          </div>

        </div>
      `;


      document.body.appendChild(
        overlay
      );


      overlay.addEventListener(
        "click",
        event => {

          if (
            event.target === overlay
          ) {

            closeAccountOverlay();
          }
        }
      );


      document
        .getElementById(
          "closeAccountDialog"
        )
        ?.addEventListener(
          "click",
          closeAccountOverlay
        );


      if (window.lucide) {
        lucide.createIcons();
      }
    };


  /* ================================================
     설정 화면
     - 알림 설정 제거
     - 계정 설정만 표시
  ================================================= */

  renderSettingsTab =
    function () {

      const content =
        document.getElementById(
          "settingsContent"
        );


      if (!content) {
        return;
      }


      const manager =
        getLoggedInManager();


      const name =
        manager?.name ||
        "";


      const email =
        manager?.email ||
        "";


      const phone =
        manager?.phone ||
        "";


      content.innerHTML = `

        <h3>
          계정 설정
        </h3>


        <div class="settings-field">

          <label>
            이름
          </label>

          <input
            id="settingsManagerName"
            type="text"
            value="${escapeHtml(name)}"
          />

        </div>


        <div class="settings-field">

          <label>
            이메일
          </label>

          <input
            id="settingsManagerEmail"
            type="email"
            value="${escapeHtml(email)}"
          />

        </div>


        <div class="settings-field">

          <label>
            연락처
          </label>

          <input
            id="settingsManagerPhone"
            type="text"
            value="${escapeHtml(phone)}"
          />

        </div>


        <div class="settings-field">

          <label>
            비밀번호
          </label>

          <button
            type="button"
            class="settings-button cancel"
            id="passwordChangeButton"
            style="width:max-content;"
          >
            비밀번호 변경
          </button>

        </div>


        <div class="settings-action-row">

          <button
            class="settings-button cancel"
            type="button"
            id="settingsCancelButton"
          >
            취소
          </button>


          <button
            class="settings-button save"
            type="button"
            id="settingsSaveButton"
          >
            저장
          </button>

        </div>
      `;


      document
        .getElementById(
          "settingsCancelButton"
        )
        ?.addEventListener(
          "click",
          closeAccountOverlay
        );


      document
        .getElementById(
          "settingsSaveButton"
        )
        ?.addEventListener(
          "click",
          () => {

            alert(
              "계정 정보 수정 API는 아직 연결되지 않았습니다."
            );
          }
        );


    document
  .getElementById(
    "passwordChangeButton"
  )
  ?.addEventListener(
    "click",
    openPasswordChangeModal
  );
    };

    function openPasswordChangeModal() {

  const manager =
    getLoggedInManager();


  if (!manager?.id) {

    alert(
      "로그인한 관리자 정보를 확인할 수 없습니다."
    );

    return;
  }


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "passwordChangeOverlay";


  overlay.className =
    "account-overlay";


  overlay.innerHTML = `

    <div class="account-dialog">

      <div class="account-dialog-header">

        <h2>
          비밀번호 변경
        </h2>

        <button
          class="account-dialog-close"
          type="button"
          id="closePasswordChangeDialog"
        >
          <i data-lucide="x"></i>
        </button>

      </div>


      <div class="account-dialog-body">

        <div class="settings-field">

          <label>
            현재 비밀번호
          </label>

          <input
            id="currentPasswordInput"
            type="password"
            placeholder="현재 비밀번호를 입력하세요"
          />

        </div>


        <div class="settings-field">

          <label>
            새 비밀번호
          </label>

          <input
            id="newPasswordInput"
            type="password"
            placeholder="새 비밀번호를 입력하세요"
          />

        </div>


        <div class="settings-field">

          <label>
            비밀번호 확인
          </label>

          <input
            id="newPasswordConfirmInput"
            type="password"
            placeholder="새 비밀번호를 다시 입력하세요"
          />

        </div>


        <div class="settings-action-row">

          <button
            class="settings-button cancel"
            type="button"
            id="passwordChangeCancelButton"
          >
            취소
          </button>


          <button
            class="settings-button save"
            type="button"
            id="passwordChangeSaveButton"
          >
            변경
          </button>

        </div>

      </div>

    </div>
  `;


  document.body.appendChild(
    overlay
  );


  function closePasswordModal() {

    overlay.remove();
  }


  document
    .getElementById(
      "closePasswordChangeDialog"
    )
    ?.addEventListener(
      "click",
      closePasswordModal
    );


  document
    .getElementById(
      "passwordChangeCancelButton"
    )
    ?.addEventListener(
      "click",
      closePasswordModal
    );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closePasswordModal();
      }
    }
  );


  document
    .getElementById(
      "passwordChangeSaveButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        const currentPassword =
          document
            .getElementById(
              "currentPasswordInput"
            )
            ?.value;


        const newPassword =
          document
            .getElementById(
              "newPasswordInput"
            )
            ?.value;


        const confirmPassword =
          document
            .getElementById(
              "newPasswordConfirmInput"
            )
            ?.value;


        if (
          !currentPassword ||
          !newPassword ||
          !confirmPassword
        ) {

          alert(
            "모든 항목을 입력해주세요."
          );

          return;
        }


        if (
          newPassword !==
          confirmPassword
        ) {

          alert(
            "새 비밀번호가 일치하지 않습니다."
          );

          return;
        }


        if (
          currentPassword ===
          newPassword
        ) {

          alert(
            "새 비밀번호는 현재 비밀번호와 다르게 설정해주세요."
          );

          return;
        }


        const saveButton =
          document.getElementById(
            "passwordChangeSaveButton"
          );


        try {

          saveButton.disabled =
            true;


          saveButton.textContent =
            "변경 중...";


          await apiRequest(
            `/institution-managers/${manager.id}/change-password`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  current_password:
                    currentPassword,

                  new_password:
                    newPassword
                })
            }
          );


        alert(
  "비밀번호가 변경되었습니다.\n새 비밀번호로 다시 로그인해주세요."
);

sessionStorage.removeItem(
  "ansim_manager_session"
);

window.location.href =
  "index.html";

        } catch (error) {

          console.error(
            "비밀번호 변경 실패:",
            error
          );


          alert(
            `비밀번호 변경 실패\n${error.message}`
          );


        } finally {

          if (
            document.body.contains(
              saveButton
            )
          ) {

            saveButton.disabled =
              false;


            saveButton.textContent =
              "변경";
          }
        }
      }
    );


  if (window.lucide) {

    lucide.createIcons();
  }
}

  /* ================================================
     현재 상단 이름도 세션 기준으로 맞춤
  ================================================= */

  const manager =
    getLoggedInManager();


  if (
    manager?.name
  ) {

    const adminName =
      document.querySelector(
        ".admin-name"
      );


    if (adminName) {

      adminName.innerHTML = `

        <strong>
          ${escapeHtml(
            manager.name
          )}
        </strong>

        관리자
      `;
    }
  }


  console.log(
    "관리자 실제 로그인 정보 UI 연결 완료"
  );

})();

/* =========================================================
   USER RELATION FORM TOGGLE
========================================================= */

const subjectGuardianMode =
  document.getElementById("subjectGuardianMode");

const subjectExistingGuardianBox =
  document.getElementById("subjectExistingGuardianBox");

const subjectNewGuardianBox =
  document.getElementById("subjectNewGuardianBox");


const guardianSubjectMode =
  document.getElementById("guardianSubjectMode");

const guardianExistingSubjectBox =
  document.getElementById("guardianExistingSubjectBox");

const guardianNewSubjectBox =
  document.getElementById("guardianNewSubjectBox");


subjectGuardianMode?.addEventListener("change", () => {

  const isNew =
    subjectGuardianMode.value === "new";

  subjectExistingGuardianBox?.classList.toggle(
    "hidden",
    isNew
  );

  subjectNewGuardianBox?.classList.toggle(
    "hidden",
    !isNew
  );

});


guardianSubjectMode?.addEventListener("change", () => {

  const isNew =
    guardianSubjectMode.value === "new";

  guardianExistingSubjectBox?.classList.toggle(
    "hidden",
    isNew
  );

  guardianNewSubjectBox?.classList.toggle(
    "hidden",
    !isNew
  );

});
const subjectNewGuardianAddress =
  document.getElementById("subjectNewGuardianAddress");

const subjectNewGuardianAddressDetail =
  document.getElementById("subjectNewGuardianAddressDetail");

const subjectNewGuardianAddressSearchButton =
  document.getElementById("subjectNewGuardianAddressSearchButton");


const guardianNewSubjectAddress =
  document.getElementById("guardianNewSubjectAddress");

const guardianNewSubjectAddressDetail =
  document.getElementById("guardianNewSubjectAddressDetail");

const guardianNewSubjectAddressSearchButton =
  document.getElementById("guardianNewSubjectAddressSearchButton");


subjectNewGuardianAddressSearchButton?.addEventListener(
  "click",
  () => {
    openPostcodeSearch(
      subjectNewGuardianAddress,
      subjectNewGuardianAddressDetail
    );
  }
);


guardianNewSubjectAddressSearchButton?.addEventListener(
  "click",
  () => {
    openPostcodeSearch(
      guardianNewSubjectAddress,
      guardianNewSubjectAddressDetail
    );
  }
);

const subjectRelationship =
  document.getElementById("subjectRelationship");

const subjectRelationshipEtcBox =
  document.getElementById("subjectRelationshipEtcBox");

const subjectRelationshipEtc =
  document.getElementById("subjectRelationshipEtc");


const guardianRelationship =
  document.getElementById("guardianRelationship");

const guardianRelationshipEtcBox =
  document.getElementById("guardianRelationshipEtcBox");

const guardianRelationshipEtc =
  document.getElementById("guardianRelationshipEtc");


subjectRelationship?.addEventListener("change", () => {

  const isOther =
    subjectRelationship.value === "other";

  subjectRelationshipEtcBox?.classList.toggle(
    "hidden",
    !isOther
  );

  if (!isOther && subjectRelationshipEtc) {
    subjectRelationshipEtc.value = "";
  }
});


guardianRelationship?.addEventListener("change", () => {

  const isOther =
    guardianRelationship.value === "other";

  guardianRelationshipEtcBox?.classList.toggle(
    "hidden",
    !isOther
  );

  if (!isOther && guardianRelationshipEtc) {
    guardianRelationshipEtc.value = "";
  }
});