/* =========================================================
   안심하랑께 관리자 로그인 / 회원가입
   - 회원가입: 실제 백엔드 /institution-managers/signup
   - 로그인: 실제 백엔드 /institution-managers/login
   - 로그인 상태: sessionStorage 사용
   - 기관 정보: 실제 백엔드 /institutions API 사용
   - 기관 선택: Leaflet 실제 지도 마커 선택
   - 전화번호 인증: SMS API 연결 전 시연용
========================================================= */

const LOGIN_API_BASE =
  "https://medal-bacterial-nvidia-customize.trycloudflare.com";
const LOGIN_SESSION_KEY =
  "ansim_manager_session";


let signupInstitutions = [];

let signupMap = null;

let signupMarkers = [];

let selectedSignupInstitution = null;

let pendingSignupInstitution = null;


/* =========================================================
   STYLE
========================================================= */

function installLoginStyle() {

  if (document.getElementById("ansimLoginStyle")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ansimLoginStyle";

  style.textContent = `
    #authScreen {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 100vw;
      min-height: 100vh;
      overflow-y: auto;
      padding: 34px 20px;
      background: radial-gradient(circle at 50% 30%, #ffffff 0%, #f8fbfd 46%, #eef6fb 100%);
      font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #authScreen *,
    .signup-overlay * {
      box-sizing: border-box;
    }

    .auth-shell {
      width: 100%;
      max-width: 490px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .auth-logo-area {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 25px;
    }

    .auth-logo {
      width: 260px;
      max-width: 70vw;
      display: block;
    }

    .auth-card {
      width: 100%;
      padding: 36px 36px 30px;
      border: 1px solid #e8edf1;
      border-radius: 16px;
      background: #ffffff;
      box-shadow: 0 13px 40px rgba(39, 68, 87, 0.08);
    }

    .auth-input-wrap {
      position: relative;
      width: 100%;
      margin-bottom: 14px;
    }

    .auth-input-wrap > svg {
      position: absolute;
      top: 50%;
      left: 17px;
      width: 19px;
      height: 19px;
      transform: translateY(-50%);
      color: #8696a3;
      pointer-events: none;
    }

    .auth-input {
      width: 100%;
      height: 55px;
      padding: 0 48px;
      border: 1px solid #d8e1e7;
      border-radius: 9px;
      outline: none;
      background: #ffffff;
      color: #202a31;
      font-size: 14px;
      transition: border-color .15s, box-shadow .15s;
    }

    .auth-input::placeholder {
      color: #98a5af;
    }

    .auth-input:focus {
      border-color: #238fd2;
      box-shadow: 0 0 0 3px rgba(35, 143, 210, .09);
    }

    .password-toggle {
      position: absolute;
      top: 50%;
      right: 15px;
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      transform: translateY(-50%);
      border: 0;
      background: transparent;
      color: #8696a3;
      cursor: pointer;
    }

    .password-toggle svg {
      width: 18px;
      height: 18px;
    }

    .auth-login-button {
      width: 100%;
      height: 56px;
      margin-top: 11px;
      border: 0;
      border-radius: 9px;
      background: #168bd0;
      color: #ffffff;
      font-size: 16px;
      font-weight: 800;
      cursor: pointer;
    }

    .auth-login-button:hover {
      background: #087fc4;
    }

    .auth-login-button:disabled {
      opacity: .6;
      cursor: wait;
    }

    .auth-account-links {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 13px;
      margin-top: 19px;
    }

    .auth-text-button {
      border: 0;
      background: transparent;
      color: #53616a;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
    }

    .auth-text-button:hover {
      color: #168bd0;
    }

    .auth-link-divider {
      width: 1px;
      height: 12px;
      background: #cbd3d8;
    }

    .auth-divider {
      width: 100%;
      height: 1px;
      margin: 24px 0 18px;
      background: #edf1f3;
    }

    .signup-open-button {
      width: 100%;
      height: 48px;
      border: 1px solid #e3edf5;
      border-radius: 9px;
      background: #f3f8fc;
      color: #1684c7;
      font-size: 14px;
      font-weight: 750;
      cursor: pointer;
    }

    .signup-open-button:hover {
      background: #eaf5fb;
    }

    .auth-message {
      display: none;
      margin-top: 13px;
      padding: 10px 12px;
      border-radius: 7px;
      font-size: 11px;
      line-height: 1.5;
      text-align: center;
    }

    .auth-message.error {
      display: block;
      background: #fff1f2;
      color: #df3542;
    }

    .auth-message.success {
      display: block;
      background: #ebf8ef;
      color: #26934c;
    }

    .auth-footer {
      margin-top: 22px;
      color: #9aa6ae;
      font-size: 10px;
    }


    /* ============================================
       회원가입 / 기관찾기 공통
    ============================================ */

    .signup-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(24, 38, 48, .38);
      backdrop-filter: blur(2px);
      font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }


    /* ============================================
       회원가입 팝업
    ============================================ */

    .signup-modal {
      width: min(520px, calc(100vw - 32px));
      max-height: calc(100vh - 40px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 22px 70px rgba(19, 38, 51, .22);
    }

    .signup-modal-header {
      flex: 0 0 66px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 25px;
      border-bottom: 1px solid #e7ecef;
    }

    .signup-modal-header h2 {
      margin: 0;
      font-size: 18px;
      color: #1b252b;
    }

    .signup-close-button {
      width: 35px;
      height: 35px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #68757d;
      cursor: pointer;
    }

    .signup-close-button:hover {
      background: #f3f6f7;
    }

    .signup-close-button svg {
      width: 19px;
      height: 19px;
    }

    .signup-form-panel {
      overflow-y: auto;
      padding: 24px 26px 26px;
    }

    .signup-field {
      display: block;
      margin-bottom: 14px;
    }

    .signup-field > span {
      display: block;
      margin-bottom: 7px;
      color: #4c5961;
      font-size: 11px;
      font-weight: 750;
    }

    .signup-field input {
      width: 100%;
      height: 43px;
      padding: 0 12px;
      border: 1px solid #d7e0e5;
      border-radius: 7px;
      outline: none;
      font-size: 12px;
    }

    .signup-field input:focus {
      border-color: #2291d2;
      box-shadow: 0 0 0 3px rgba(34, 145, 210, .08);
    }

    .signup-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }


    /* ============================================
       전화번호 인증
    ============================================ */

    .signup-inline-row {
      display: grid;
      grid-template-columns: 1fr 118px;
      gap: 9px;
    }

    .signup-inline-button {
      height: 43px;
      border: 1px solid #168bd0;
      border-radius: 7px;
      background: #fff;
      color: #168bd0;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
    }

    .signup-inline-button:hover {
      background: #f0f8fd;
    }

    .signup-inline-button.verified {
      border-color: #46aa68;
      background: #eef9f1;
      color: #278847;
    }

    #signupVerificationArea {
      display: none;
      margin-top: 9px;
    }

    #signupVerificationArea.active {
      display: grid;
    }

    .verification-hint {
      margin: 7px 0 0;
      color: #7c8a92;
      font-size: 10px;
      line-height: 1.5;
    }


    /* ============================================
       소속기관 선택 버튼
    ============================================ */

    .institution-select-button {
      width: 100%;
      min-height: 47px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 13px;
      border: 1px solid #d7e0e5;
      border-radius: 7px;
      background: #fff;
      color: #8a979f;
      text-align: left;
      cursor: pointer;
    }

    .institution-select-button:hover {
      border-color: #2291d2;
      background: #fbfdff;
    }

    .institution-select-button.selected {
      color: #26343b;
    }

    .institution-select-main {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .institution-select-main strong {
      font-size: 12px;
      color: inherit;
    }

    .institution-select-main small {
      max-width: 390px;
      overflow: hidden;
      color: #829099;
      font-size: 9px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .institution-select-button svg {
      flex: 0 0 auto;
      width: 17px;
      height: 17px;
    }

    .signup-submit-button {
      width: 100%;
      height: 46px;
      margin-top: 8px;
      border: 0;
      border-radius: 8px;
      background: #168bd0;
      color: white;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }

    .signup-submit-button:disabled {
      opacity: .55;
      cursor: wait;
    }


    /* ============================================
       기관찾기 팝업
    ============================================ */

    .institution-picker-overlay {
      z-index: 1000002;
    }

    .institution-picker-modal {
      width: min(620px, calc(100vw - 32px));
      max-height: calc(100vh - 50px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 22px 70px rgba(19, 38, 51, .24);
    }

    .institution-picker-body {
      min-height: 0;
      overflow-y: auto;
      padding: 22px 24px 24px;
    }

    .institution-search-wrap {
      position: relative;
      margin-bottom: 10px;
    }

    .institution-search-wrap svg {
      position: absolute;
      top: 50%;
      left: 12px;
      width: 16px;
      height: 16px;
      transform: translateY(-50%);
      color: #87949c;
      pointer-events: none;
    }

    #signupInstitutionSearch {
      width: 100%;
      height: 44px;
      padding: 0 12px 0 37px;
      border: 1px solid #d7e0e5;
      border-radius: 8px;
      outline: none;
      font-size: 12px;
    }

    #signupInstitutionSearch:focus {
      border-color: #168bd0;
    }

    .institution-search-results {
      max-height: 210px;
      overflow-y: auto;
      border: 1px solid #e1e7ea;
      border-radius: 8px;
      background: #fff;
    }

    .institution-result-button {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 11px 12px;
      border: 0;
      border-bottom: 1px solid #edf1f3;
      background: #fff;
      text-align: left;
      cursor: pointer;
    }

    .institution-result-button:last-child {
      border-bottom: 0;
    }

    .institution-result-button:hover {
      background: #f3f9fc;
    }

    .institution-result-button.active {
      background: #eef8fd;
    }

    .institution-result-button strong {
      color: #26343b;
      font-size: 11px;
    }

    .institution-result-button span {
      color: #7b888f;
      font-size: 9px;
    }

    .institution-result-empty {
      padding: 17px;
      color: #89959c;
      font-size: 10px;
      text-align: center;
    }

    .institution-preview {
      display: none;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid #edf1f3;
    }

    .institution-preview.active {
      display: block;
    }

    #signupInstitutionMap {
      width: 100%;
      height: 230px;
      border: 1px solid #dde5e9;
      border-radius: 9px;
      overflow: hidden;
      background: #f2f6f8;
    }

    .institution-preview-info {
      padding: 12px 2px 2px;
    }

    .institution-preview-info strong {
      display: block;
      margin-bottom: 4px;
      color: #26343b;
      font-size: 13px;
    }

    .institution-preview-info span {
      color: #73818a;
      font-size: 10px;
    }

    .institution-confirm-button {
      width: 100%;
      height: 44px;
      margin-top: 13px;
      border: 0;
      border-radius: 8px;
      background: #168bd0;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }

    .signup-map-marker {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border: 3px solid white;
      border-radius: 50%;
      background: #168bd0;
      color: white;
      font-size: 14px;
      box-shadow: 0 2px 9px rgba(18, 75, 108, .3);
    }


    /* ============================================
       간단 안내 팝업
    ============================================ */

    .simple-auth-dialog {
      width: min(410px, calc(100vw - 40px));
      padding: 27px;
      border-radius: 14px;
      background: white;
      box-shadow: 0 20px 60px rgba(10, 31, 44, .2);
      text-align: center;
    }

    .simple-auth-dialog h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }

    .simple-auth-dialog p {
      margin: 0 0 19px;
      color: #748188;
      font-size: 11px;
      line-height: 1.6;
    }

    .simple-dialog-button {
      width: 100%;
      height: 42px;
      border: 0;
      border-radius: 7px;
      background: #168bd0;
      color: #fff;
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }

    @media (max-width: 600px) {

      .auth-card {
        padding: 27px 22px;
      }

      .signup-grid {
        grid-template-columns: 1fr;
        gap: 0;
      }

      .signup-inline-row {
        grid-template-columns: 1fr 105px;
      }

      .signup-form-panel {
        padding: 20px;
      }

      #signupInstitutionMap {
        height: 200px;
      }
    }
  `;

  document.head.appendChild(style);
}


/* =========================================================
   SESSION
========================================================= */

function getCurrentManager() {

  try {

    return JSON.parse(
      sessionStorage.getItem(
        LOGIN_SESSION_KEY
      ) || "null"
    );

  } catch (_) {

    return null;
  }
}


function saveCurrentManager(
  manager
) {

  sessionStorage.setItem(
    LOGIN_SESSION_KEY,
    JSON.stringify(
      manager
    )
  );
}


function clearManagerSession() {

  sessionStorage.removeItem(
    LOGIN_SESSION_KEY
  );
}


/* =========================================================
   LOGIN SCREEN
========================================================= */

function createLoginScreen() {

  if (
    document.getElementById(
      "authScreen"
    )
  ) {
    return;
  }


  const screen =
    document.createElement(
      "section"
    );


  screen.id =
    "authScreen";


  screen.innerHTML = `

    <div class="auth-shell">

      <div class="auth-logo-area">

        <img
          src="./Group 16.svg"
          alt="안심하랑께"
          class="auth-logo"
        />

      </div>


      <div class="auth-card">

        <form id="managerLoginForm">

          <div class="auth-input-wrap">

            <i data-lucide="user"></i>

            <input
              id="managerLoginId"
              class="auth-input"
              type="text"
              autocomplete="username"
              placeholder="아이디를 입력하세요"
              required
            />

          </div>


          <div class="auth-input-wrap">

            <i data-lucide="lock"></i>

            <input
              id="managerLoginPassword"
              class="auth-input"
              type="password"
              autocomplete="current-password"
              placeholder="비밀번호를 입력하세요"
              required
            />

            <button
              id="loginPasswordToggle"
              class="password-toggle"
              type="button"
              title="비밀번호 보기"
            >
              <i data-lucide="eye"></i>
            </button>

          </div>


          <button
            class="auth-login-button"
            type="submit"
          >
            로그인
          </button>


          <div
            id="managerLoginMessage"
            class="auth-message"
          ></div>

        </form>


        <div class="auth-divider"></div>


        <button
          id="openSignupButton"
          class="signup-open-button"
          type="button"
        >
          회원가입하기
        </button>

      </div>


      <div class="auth-footer">
        © 안심하랑께 기관 관리자 시스템
      </div>

    </div>
  `;


  document.body.appendChild(
    screen
  );


  bindLoginEvents();


  if (window.lucide) {
    lucide.createIcons();
  }
}


function showLoginScreen() {

  installLoginStyle();

  createLoginScreen();


  const app =
    document.querySelector(
      ".app"
    );


  if (app) {
    app.style.display =
      "none";
  }


  document
    .getElementById(
      "authScreen"
    )
    ?.style
    .setProperty(
      "display",
      "flex"
    );


  document.body.style.overflow =
    "hidden";
}


function hideLoginScreen() {

  document
    .getElementById(
      "authScreen"
    )
    ?.remove();


  const app =
    document.querySelector(
      ".app"
    );


  if (app) {
    app.style.display = "";
  }


  document.body.style.overflow =
    "";
}


/* =========================================================
   LOGIN EVENTS
========================================================= */

function bindLoginEvents() {

  const form =
    document.getElementById(
      "managerLoginForm"
    );


  form?.addEventListener(
    "submit",
    handleManagerLogin
  );


  document
    .getElementById(
      "loginPasswordToggle"
    )
    ?.addEventListener(
      "click",
      toggleLoginPassword
    );


  document
    .getElementById(
      "openSignupButton"
    )
    ?.addEventListener(
      "click",
      openSignupModal
    );
}


function toggleLoginPassword() {

  const input =
    document.getElementById(
      "managerLoginPassword"
    );


  if (!input) {
    return;
  }


  input.type =
    input.type === "password"
      ? "text"
      : "password";
}


function setLoginMessage(
  message,
  type = "error"
) {

  const box =
    document.getElementById(
      "managerLoginMessage"
    );


  if (!box) {
    return;
  }


  if (!message) {

    box.textContent =
      "";

    box.className =
      "auth-message";

    return;
  }


  box.textContent =
    message;


  box.className =
    `auth-message ${type}`;
}


/* =========================================================
   LOGIN - 실제 API
========================================================= */

async function handleManagerLogin(
  event
) {

  event.preventDefault();


  const loginId =
    document
      .getElementById(
        "managerLoginId"
      )
      .value
      .trim();


  const password =
    document
      .getElementById(
        "managerLoginPassword"
      )
      .value;


  if (
    !loginId ||
    !password
  ) {

    setLoginMessage(
      "아이디와 비밀번호를 입력해주세요."
    );

    return;
  }


  const loginButton =
    document.querySelector(
      ".auth-login-button"
    );


  try {

    if (loginButton) {

      loginButton.disabled =
        true;

      loginButton.textContent =
        "로그인 중...";
    }


    setLoginMessage(
      ""
    );


    const response =
      await fetch(
        `${LOGIN_API_BASE}/institution-managers/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              login_id:
                loginId,

              password:
                password
            })
        }
      );


    if (!response.ok) {

      let message =
        "아이디 또는 비밀번호가 올바르지 않습니다.";


      try {

        const errorData =
          await response.json();


        if (
          errorData?.detail
        ) {

          message =
            typeof errorData.detail ===
              "string"
              ? errorData.detail
              : message;
        }

      } catch (_) {}


      throw new Error(
        message
      );
    }


    const result =
      await response.json();


    /*
      로그인 성공 응답

      {
        id,
        name,
        phone,
        email,
        login_id,
        institution_id
      }

      비밀번호는 브라우저에 저장하지 않는다.
    */


    let institutionName =
      "";


    let institutionAddress =
      "";


    try {

      if (
        result.institution_id !==
          null &&
        result.institution_id !==
          undefined
      ) {

        if (
          !signupInstitutions.length
        ) {

          const institutionResponse =
            await fetch(
              `${LOGIN_API_BASE}/institutions`
            );


          if (
            institutionResponse.ok
          ) {

            const institutionData =
              await institutionResponse.json();


            signupInstitutions =
              Array.isArray(
                institutionData
              )
                ? institutionData
                : [];
          }
        }


        const matchedInstitution =
          signupInstitutions.find(
            institution =>
              Number(
                institution.id
              ) ===
              Number(
                result.institution_id
              )
          );


        institutionName =
          matchedInstitution?.name ||
          "";


        institutionAddress =
          matchedInstitution?.address ||
          "";
      }

    } catch (
      institutionError
    ) {

      console.warn(
        "로그인 후 기관 정보 조회 실패:",
        institutionError
      );
    }


    const manager = {

      id:
        result.id,

      loginId:
        result.login_id,

      name:
        result.name,

      phone:
        result.phone,

      email:
        result.email,

      institutionId:
        result.institution_id,

      institutionName,

      institutionAddress
    };


    saveCurrentManager(
      manager
    );


    applyManagerToDashboard(
      manager
    );


    hideLoginScreen();


    if (
      typeof showPage ===
      "function"
    ) {

      showPage(
        "dashboard"
      );
    }


  } catch (
    error
  ) {

    console.error(
      "관리자 로그인 실패:",
      error
    );


    setLoginMessage(
      error.message ||
      "로그인에 실패했습니다."
    );


  } finally {

    if (loginButton) {

      loginButton.disabled =
        false;

      loginButton.textContent =
        "로그인";
    }
  }
}


/* =========================================================
   ADMIN NAME
========================================================= */

function applyManagerToDashboard(
  manager
) {

  const adminName =
    document.querySelector(
      ".admin-name"
    );


  if (adminName) {

    adminName.innerHTML =
      `
        <strong>
          ${escapeLoginHtml(
            manager.name ||
            "관리자"
          )}
        </strong>
        관리자
      `;
  }
}


/* =========================================================
   SIGNUP
========================================================= */

async function openSignupModal() {

  if (
    document.getElementById(
      "signupOverlay"
    )
  ) {
    return;
  }

  selectedSignupInstitution =
    null;

  pendingSignupInstitution =
    null;


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "signupOverlay";

  overlay.className =
    "signup-overlay";


  overlay.innerHTML = `

    <div class="signup-modal">

      <header class="signup-modal-header">

        <h2>
          기관 관리자 회원가입
        </h2>

        <button
          id="closeSignupButton"
          class="signup-close-button"
          type="button"
          aria-label="닫기"
        >
          <i data-lucide="x"></i>
        </button>

      </header>


      <form
        id="managerSignupForm"
        class="signup-form-panel"
      >

        <label class="signup-field">

          <span>이름</span>

          <input
            id="signupName"
            type="text"
            placeholder="이름을 입력하세요"
            required
          />

        </label>


      <label class="signup-field">

  <span>전화번호</span>

  <input
    id="signupPhone"
    type="tel"
    placeholder="010-0000-0000"
    required
  />

</label>


<div class="signup-field">

  <span>이메일</span>

  <div class="signup-inline-row">

    <input
      id="signupEmail"
      type="email"
      placeholder="example@email.com"
      required
    />

    <button
      id="sendSignupEmailCodeButton"
      class="signup-inline-button"
      type="button"
    >
      인증번호 받기
    </button>

  </div>


  <div
    id="signupEmailVerificationArea"
    class="signup-inline-row"
  >

    <input
      id="signupEmailVerificationCode"
      type="text"
      placeholder="인증번호 입력"
      autocomplete="one-time-code"
    />

    <button
      id="verifySignupEmailCodeButton"
      class="signup-inline-button"
      type="button"
    >
      확인
    </button>

  </div>


  <p
    id="signupEmailVerificationHint"
    class="verification-hint"
  >
    이메일 인증 후 회원가입할 수 있습니다.
  </p>

</div>


        <div class="signup-grid">

          <label class="signup-field">

            <span>아이디</span>

            <input
              id="signupLoginId"
              type="text"
              placeholder="로그인 아이디"
              required
            />

          </label>


          <label class="signup-field">

            <span>비밀번호</span>

            <input
              id="signupPassword"
              type="password"
              placeholder="비밀번호"
              required
            />

          </label>

        </div>


        <label class="signup-field">

          <span>비밀번호 확인</span>

          <input
            id="signupPasswordConfirm"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            required
          />

        </label>


        <div class="signup-field">

          <span>소속 기관</span>

          <button
            id="openInstitutionPickerButton"
            class="institution-select-button"
            type="button"
          >

            <span class="institution-select-main">

              <strong
                id="signupInstitutionButtonName"
              >
                소속 기관을 선택해주세요
              </strong>

              <small
                id="signupInstitutionButtonAddress"
              >
                기관 이름을 검색해서 선택할 수 있습니다.
              </small>

            </span>

            <i data-lucide="chevron-right"></i>

          </button>

        </div>


        <div
          id="signupMessage"
          class="auth-message"
        ></div>


        <button
          id="signupSubmitButton"
          class="signup-submit-button"
          type="submit"
        >
          회원가입 완료
        </button>

      </form>

    </div>
  `;


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      "closeSignupButton"
    )
    ?.addEventListener(
      "click",
      closeSignupModal
    );

document
  .getElementById(
    "sendSignupEmailCodeButton"
  )
  ?.addEventListener(
    "click",
    sendSignupEmailVerificationCode
  );


document
  .getElementById(
    "verifySignupEmailCodeButton"
  )
  ?.addEventListener(
    "click",
    verifySignupEmailCode
  );


document
  .getElementById(
    "signupEmail"
  )
  ?.addEventListener(
    "input",
    event => {

      const currentEmail =
        event.target.value
          .trim()
          .toLowerCase();


      if (
        signupEmailVerified &&
        currentEmail !==
          signupVerificationEmail
      ) {

  

        const sendButton =
          document.getElementById(
            "sendSignupEmailCodeButton"
          );


        if (sendButton) {

          sendButton.textContent =
            "인증번호 받기";

          sendButton.classList.remove(
            "verified"
          );
        }


        const verifyButton =
          document.getElementById(
            "verifySignupEmailCodeButton"
          );


        if (verifyButton) {

          verifyButton.textContent =
            "확인";

          verifyButton.classList.remove(
            "verified"
          );
        }


        const hint =
          document.getElementById(
            "signupEmailVerificationHint"
          );


        if (hint) {

          hint.textContent =
            "이메일이 변경되었습니다. 다시 인증해주세요.";
        }
      }
    }
  );

  document
    .getElementById(
      "openInstitutionPickerButton"
    )
    ?.addEventListener(
      "click",
      openInstitutionPicker
    );


  document
    .getElementById(
      "managerSignupForm"
    )
    ?.addEventListener(
      "submit",
      handleManagerSignup
    );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closeSignupModal();
      }
    }
  );


  if (
    window.lucide
  ) {

    lucide.createIcons();
  }
}


function closeSignupModal() {

  closeInstitutionPicker();


  selectedSignupInstitution =
    null;

  pendingSignupInstitution =
    null;


  document
    .getElementById(
      "signupOverlay"
    )
    ?.remove();
}

/* =========================================================
   EMAIL VERIFICATION - 실제 API
========================================================= */

async function sendSignupEmailVerificationCode() {

  const email =
    document
      .getElementById(
        "signupEmail"
      )
      ?.value
      .trim()
      .toLowerCase() ||
    "";


  if (!email) {

    setSignupMessage(
      "이메일을 먼저 입력해주세요."
    );

    return;
  }


  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


  if (
    !emailPattern.test(
      email
    )
  ) {

    setSignupMessage(
      "올바른 이메일 주소를 입력해주세요."
    );

    return;
  }


  const button =
    document.getElementById(
      "sendSignupEmailCodeButton"
    );


  try {

    if (button) {

      button.disabled =
        true;

      button.textContent =
        "전송 중...";
    }


    setSignupMessage(
      ""
    );


    const response =
      await fetch(
        `${LOGIN_API_BASE}/auth/email/send`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              email
            })
        }
      );


    if (!response.ok) {

      let message =
        "인증번호 전송에 실패했습니다.";


      try {

        const errorData =
          await response.json();


        if (
          errorData?.detail
        ) {

          message =
            typeof errorData.detail ===
              "string"
              ? errorData.detail
              : JSON.stringify(
                  errorData.detail
                );
        }

      } catch (_) {}


      throw new Error(
        message
      );
    }


    signupVerificationEmail =
      email;


    const area =
      document.getElementById(
        "signupEmailVerificationArea"
      );


    area?.classList.add(
      "active"
    );


    const codeInput =
      document.getElementById(
        "signupEmailVerificationCode"
      );


    if (codeInput) {

      codeInput.value =
        "";

      codeInput.focus();
    }


    const hint =
      document.getElementById(
        "signupEmailVerificationHint"
      );


    if (hint) {

      hint.textContent =
        `${email}로 인증번호를 전송했습니다.`;
    }


    if (button) {

      button.textContent =
        "재전송";
    }


    setSignupMessage(
      "이메일로 인증번호를 전송했습니다.",
      "success"
    );


  } catch (
    error
  ) {

    console.error(
      "이메일 인증번호 전송 실패:",
      error
    );


    setSignupMessage(
      error.message ||
      "인증번호 전송 중 오류가 발생했습니다."
    );


  } finally {

    if (button) {

      button.disabled =
        false;


      if (
        button.textContent ===
        "전송 중..."
      ) {

        button.textContent =
          "인증번호 받기";
      }
    }
  }
}



async function verifySignupEmailCode() {

  const email =
    document
      .getElementById(
        "signupEmail"
      )
      ?.value
      .trim()
      .toLowerCase() ||
    "";


  const code =
    document
      .getElementById(
        "signupEmailVerificationCode"
      )
      ?.value
      .trim() ||
    "";


  if (!email) {

    setSignupMessage(
      "이메일을 입력해주세요."
    );

    return;
  }


  if (!code) {

    setSignupMessage(
      "이메일로 받은 인증번호를 입력해주세요."
    );

    return;
  }


  if (
    signupVerificationEmail &&
    email !==
      signupVerificationEmail
  ) {

    setSignupMessage(
      "인증번호를 받은 이메일과 현재 이메일이 다릅니다. 다시 인증번호를 받아주세요."
    );

    return;
  }


  const button =
    document.getElementById(
      "verifySignupEmailCodeButton"
    );


  try {

    if (button) {

      button.disabled =
        true;

      button.textContent =
        "확인 중...";
    }


    setSignupMessage(
      ""
    );


    const response =
      await fetch(
        `${LOGIN_API_BASE}/auth/email/verify`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              email,
              code
            })
        }
      );


    if (!response.ok) {

      let message =
        "인증번호가 올바르지 않습니다.";


      try {

        const errorData =
          await response.json();


        if (
          errorData?.detail
        ) {

          message =
            typeof errorData.detail ===
              "string"
              ? errorData.detail
              : JSON.stringify(
                  errorData.detail
                );
        }

      } catch (_) {}


      throw new Error(
        message
      );
    }


    const hint =
      document.getElementById(
        "signupEmailVerificationHint"
      );


    if (hint) {

      hint.textContent =
        "이메일 인증이 완료되었습니다.";
    }


    const sendButton =
      document.getElementById(
        "sendSignupEmailCodeButton"
      );


    if (sendButton) {

      sendButton.textContent =
        "인증 완료";

      sendButton.classList.add(
        "verified"
      );
    }


    if (button) {

      button.textContent =
        "확인 완료";

      button.classList.add(
        "verified"
      );
    }


    setSignupMessage(
      "이메일 인증이 완료되었습니다.",
      "success"
    );


  } catch (
    error
  ) {

    signupEmailVerified =
      false;


    console.error(
      "이메일 인증 실패:",
      error
    );


    setSignupMessage(
      error.message ||
      "이메일 인증에 실패했습니다."
    );


  } finally {

    if (button) {

      button.disabled =
        false;


      if (
        !signupEmailVerified
      ) {

        button.textContent =
          "확인";
      }
    }
  }
}

/* =========================================================
   INSTITUTION PICKER
========================================================= */

async function openInstitutionPicker() {

  if (
    document.getElementById(
      "institutionPickerOverlay"
    )
  ) {
    return;
  }


  pendingSignupInstitution =
    selectedSignupInstitution;


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "institutionPickerOverlay";


  overlay.className =
    "signup-overlay institution-picker-overlay";


  overlay.innerHTML = `

    <div class="institution-picker-modal">

      <header class="signup-modal-header">

        <h2>
          소속 기관 찾기
        </h2>

        <button
          id="closeInstitutionPickerButton"
          class="signup-close-button"
          type="button"
          aria-label="닫기"
        >
          <i data-lucide="x"></i>
        </button>

      </header>


      <div class="institution-picker-body">

        <div class="institution-search-wrap">

          <i data-lucide="search"></i>

          <input
            id="signupInstitutionSearch"
            type="text"
            placeholder="기관 이름을 검색하세요"
            autocomplete="off"
          />

        </div>


        <div
          id="institutionSearchResults"
          class="institution-search-results"
        >

          <div class="institution-result-empty">
            기관 정보를 불러오는 중입니다...
          </div>

        </div>


        <section
          id="institutionPreview"
          class="institution-preview"
        >

          <div
            id="signupInstitutionMap"
          ></div>


          <div class="institution-preview-info">

            <strong
              id="institutionPreviewName"
            ></strong>

            <span
              id="institutionPreviewAddress"
            ></span>

          </div>


          <button
            id="confirmInstitutionButton"
            class="institution-confirm-button"
            type="button"
          >
            이 기관 선택
          </button>

        </section>

      </div>

    </div>
  `;


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      "closeInstitutionPickerButton"
    )
    ?.addEventListener(
      "click",
      closeInstitutionPicker
    );


  document
    .getElementById(
      "signupInstitutionSearch"
    )
    ?.addEventListener(
      "input",
      event => {

        searchSignupInstitution(
          event.target.value
        );
      }
    );


  document
    .getElementById(
      "confirmInstitutionButton"
    )
    ?.addEventListener(
      "click",
      confirmSignupInstitution
    );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closeInstitutionPicker();
      }
    }
  );


  if (
    window.lucide
  ) {

    lucide.createIcons();
  }


  if (
    !signupInstitutions.length
  ) {

    await loadSignupInstitutions();

  } else {

    renderInstitutionResults(
      signupInstitutions.slice(
        0,
        15
      )
    );
  }


  setTimeout(
    () => {

      document
        .getElementById(
          "signupInstitutionSearch"
        )
        ?.focus();

    },
    50
  );
}


function closeInstitutionPicker() {

  if (
    signupMap
  ) {

    signupMap.remove();

    signupMap =
      null;
  }


  signupMarkers =
    [];


  pendingSignupInstitution =
    null;


  document
    .getElementById(
      "institutionPickerOverlay"
    )
    ?.remove();
}


/* =========================================================
   LOAD / SEARCH INSTITUTIONS
========================================================= */

async function loadSignupInstitutions() {

  const resultBox =
    document.getElementById(
      "institutionSearchResults"
    );


  try {

    const response =
      await fetch(
        `${LOGIN_API_BASE}/institutions`
      );


    if (
      !response.ok
    ) {

      throw new Error(
        `기관 API 오류 ${response.status}`
      );
    }


    const data =
      await response.json();


    signupInstitutions =
      Array.isArray(
        data
      )
        ? data
        : [];


    renderInstitutionResults(
      signupInstitutions.slice(
        0,
        15
      )
    );


  } catch (
    error
  ) {

    console.error(
      "회원가입 기관 목록 조회 실패:",
      error
    );


    if (
      resultBox
    ) {

      resultBox.innerHTML = `
        <div class="institution-result-empty">
          기관 정보를 불러오지 못했습니다.
        </div>
      `;
    }
  }
}


function searchSignupInstitution(
  keyword
) {

  const normalizedKeyword =
    String(
      keyword || ""
    )
      .trim()
      .toLowerCase();


  let filtered =
    signupInstitutions;


  if (
    normalizedKeyword
  ) {

    filtered =
      signupInstitutions.filter(
        institution => {

          return (
            String(
              institution.name ||
              ""
            )
              .toLowerCase()
              .includes(
                normalizedKeyword
              ) ||

            String(
              institution.address ||
              ""
            )
              .toLowerCase()
              .includes(
                normalizedKeyword
              )
          );
        }
      );
  }


  renderInstitutionResults(
    filtered.slice(
      0,
      30
    )
  );
}


/* =========================================================
   RESULT LIST / PREVIEW
========================================================= */

function renderInstitutionResults(list) {

  const container =
    document.getElementById(
      "institutionSearchResults"
    );


  if (!container) {
    return;
  }


  if (!list.length) {

    container.innerHTML = `
      <div class="institution-result-empty">
        검색되는 기관이 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    list
      .map(
        institution => `

          <button
            class="
              institution-result-button
              ${
                pendingSignupInstitution &&
                Number(
                  pendingSignupInstitution.id
                ) ===
                Number(
                  institution.id
                )
                  ? "active"
                  : ""
              }
            "
            type="button"
            data-institution-id="${institution.id}"
          >

            <strong>
              ${escapeLoginHtml(
                institution.name ||
                "기관"
              )}
            </strong>

            <span>
              ${escapeLoginHtml(
                institution.address ||
                "주소 정보 없음"
              )}
            </span>

          </button>
        `
      )
      .join("");


  container
    .querySelectorAll(
      ".institution-result-button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            previewSignupInstitution(
              Number(
                button.dataset.institutionId
              )
            );
          }
        );
      }
    );
}


function previewSignupInstitution(
  institutionId
) {

  const institution =
    signupInstitutions.find(
      item =>
        Number(
          item.id
        ) ===
        Number(
          institutionId
        )
    );


  if (!institution) {
    return;
  }


  pendingSignupInstitution =
    institution;


  document
    .querySelectorAll(
      ".institution-result-button"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          Number(
            button.dataset.institutionId
          ) ===
          Number(
            institution.id
          )
        );
      }
    );


  const preview =
    document.getElementById(
      "institutionPreview"
    );


  preview?.classList.add(
    "active"
  );


  const name =
    document.getElementById(
      "institutionPreviewName"
    );


  const address =
    document.getElementById(
      "institutionPreviewAddress"
    );


  if (name) {

    name.textContent =
      institution.name ||
      "선택한 기관";
  }


  if (address) {

    address.textContent =
      institution.address ||
      "주소 정보 없음";
  }


  setTimeout(
    () => {

      showSingleSignupInstitutionOnMap(
        institution
      );

    },
    30
  );
}


function showSingleSignupInstitutionOnMap(
  institution
) {

  const element =
    document.getElementById(
      "signupInstitutionMap"
    );


  if (
    !element ||
    typeof L === "undefined"
  ) {
    return;
  }


  const latitude =
    Number(
      institution.latitude
    );


  const longitude =
    Number(
      institution.longitude
    );


  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {

    element.innerHTML = `
      <div
        style="
          height:100%;
          display:grid;
          place-items:center;
          padding:20px;
          color:#829099;
          font-size:11px;
          text-align:center;
        "
      >
        이 기관은 지도 좌표 정보가 없습니다.<br>
        기관명과 주소를 확인한 뒤 선택해주세요.
      </div>
    `;

    return;
  }


  if (
    signupMap
  ) {

    signupMap.remove();

    signupMap =
      null;
  }


  element.innerHTML =
    "";


  signupMap =
    L.map(
      element,
      {
        zoomControl: true
      }
    )
      .setView(
        [
          latitude,
          longitude
        ],
        16
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
      signupMap
    );


  const icon =
    L.divIcon({
      className: "",

      html: `
        <div class="signup-map-marker">
          +
        </div>
      `,

      iconSize:
        [
          30,
          30
        ],

      iconAnchor:
        [
          15,
          15
        ]
    });


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
      signupMap
    )
    .bindPopup(
      `
        <strong>
          ${escapeLoginHtml(
            institution.name ||
            "기관"
          )}
        </strong>
        <br>

        ${escapeLoginHtml(
          institution.address ||
          ""
        )}
      `
    )
    .openPopup();


  setTimeout(
    () => {

      signupMap
        ?.invalidateSize();

    },
    100
  );
}


function confirmSignupInstitution() {

  if (
    !pendingSignupInstitution
  ) {
    return;
  }


  selectedSignupInstitution =
    pendingSignupInstitution;


  const button =
    document.getElementById(
      "openInstitutionPickerButton"
    );


  button?.classList.add(
    "selected"
  );


  const name =
    document.getElementById(
      "signupInstitutionButtonName"
    );


  const address =
    document.getElementById(
      "signupInstitutionButtonAddress"
    );


  if (name) {

    name.textContent =
      selectedSignupInstitution.name ||
      "선택한 기관";
  }


  if (address) {

    address.textContent =
      selectedSignupInstitution.address ||
      "주소 정보 없음";
  }


  closeInstitutionPicker();


  if (
    window.lucide
  ) {

    lucide.createIcons();
  }
}


/* =========================================================
   SIGNUP MESSAGE
========================================================= */

function setSignupMessage(
  message,
  type = "error"
) {

  const box =
    document.getElementById(
      "signupMessage"
    );


  if (!box) {
    return;
  }


  if (!message) {

    box.textContent =
      "";

    box.className =
      "auth-message";

    return;
  }


  box.textContent =
    message;


  box.className =
    `auth-message ${type}`;
}


/* =========================================================
   HANDLE SIGNUP - 실제 API
========================================================= */

async function handleManagerSignup(
  event
) {

  event.preventDefault();


  const name =
    document
      .getElementById(
        "signupName"
      )
      .value
      .trim();


  const phone =
    document
      .getElementById(
        "signupPhone"
      )
      .value
      .trim();


  const email =
    document
      .getElementById(
        "signupEmail"
      )
      .value
      .trim();


  const loginId =
    document
      .getElementById(
        "signupLoginId"
      )
      .value
      .trim();


  const password =
    document
      .getElementById(
        "signupPassword"
      )
      .value;


  const passwordConfirm =
    document
      .getElementById(
        "signupPasswordConfirm"
      )
      .value;


  if (
    !name ||
    !phone ||
    !email ||
    !loginId ||
    !password
  ) {

    setSignupMessage(
      "모든 항목을 입력해주세요."
    );

    return;
  }


  if (
    password !==
    passwordConfirm
  ) {

    setSignupMessage(
      "비밀번호가 일치하지 않습니다."
    );

    return;
  }


  /*
    SMS API 연결 전까지는
    현재 시연용 인증번호 확인 사용
  */

  if (
  !signupEmailVerified
) {

  setSignupMessage(
    "이메일 인증을 완료해주세요."
  );

  return;
}


if (
  email.toLowerCase() !==
  signupVerificationEmail
) {

  signupEmailVerified =
    false;

  setSignupMessage(
    "인증한 이메일과 현재 입력된 이메일이 다릅니다. 다시 이메일 인증을 진행해주세요."
  );

  return;
}

  if (
    !selectedSignupInstitution
  ) {

    setSignupMessage(
      "소속 기관을 선택해주세요."
    );

    return;
  }


  const button =
    document.getElementById(
      "signupSubmitButton"
    );


  try {

    if (
      button
    ) {

      button.disabled =
        true;

      button.textContent =
        "가입 처리 중...";
    }


    setSignupMessage(
      ""
    );


    const response =
      await fetch(
        `${LOGIN_API_BASE}/institution-managers/signup`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              name,
              phone,
              email,

              login_id:
                loginId,

              password,

              institution_id:
                Number(
                  selectedSignupInstitution.id
                )
            })
        }
      );


    if (!response.ok) {

      let message =
        "회원가입에 실패했습니다.";


      try {

        const errorData =
          await response.json();


        if (
          errorData?.detail
        ) {

          message =
            typeof errorData.detail ===
              "string"
              ? errorData.detail
              : JSON.stringify(
                  errorData.detail
                );
        }

      } catch (_) {}


      throw new Error(
        message
      );
    }


    /*
      성공 응답

      {
        id,
        name,
        phone,
        email,
        login_id,
        institution_id
      }
    */

    await response.json();


    setSignupMessage(
      "회원가입이 완료되었습니다.",
      "success"
    );


    setTimeout(
      () => {

        closeSignupModal();


        const idInput =
          document.getElementById(
            "managerLoginId"
          );


        if (
          idInput
        ) {

          idInput.value =
            loginId;
        }


        const passwordInput =
          document.getElementById(
            "managerLoginPassword"
          );


        if (
          passwordInput
        ) {

          passwordInput.value =
            "";

          passwordInput.focus();
        }


        setLoginMessage(
          "회원가입이 완료되었습니다. 비밀번호를 입력해 로그인해주세요.",
          "success"
        );

      },
      700
    );


  } catch (
    error
  ) {

    console.error(
      "관리자 회원가입 실패:",
      error
    );


    setSignupMessage(
      error.message ||
      "회원가입 처리 중 오류가 발생했습니다."
    );


  } finally {

    if (
      button
    ) {

      button.disabled =
        false;

      button.textContent =
        "회원가입 완료";
    }
  }
}


/* =========================================================
   SIMPLE DIALOG
========================================================= */

function openSimpleDialog(
  title,
  message
) {

  const overlay =
    document.createElement(
      "div"
    );


  overlay.className =
    "signup-overlay";


  overlay.innerHTML = `

    <div class="simple-auth-dialog">

      <h3>
        ${escapeLoginHtml(
          title
        )}
      </h3>

      <p>
        ${escapeLoginHtml(
          message
        )}
      </p>

      <button
        class="simple-dialog-button"
        type="button"
      >
        확인
      </button>

    </div>
  `;


  document.body.appendChild(
    overlay
  );


  overlay
    .querySelector(
      ".simple-dialog-button"
    )
    ?.addEventListener(
      "click",
      () => {

        overlay.remove();
      }
    );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        overlay.remove();
      }

    }
  );
}


/* =========================================================
   LOGOUT
========================================================= */

function logoutManagerAccount() {

  clearManagerSession();


  closeSignupModal();


  document
    .getElementById(
      "accountOverlay"
    )
    ?.remove();


  showLoginScreen();
}


/*
  기존 script.js 로그아웃 확인 버튼과 연결
*/

document.addEventListener(
  "click",
  event => {

    const logoutButton =
      event.target.closest(
        "#logoutConfirmButton"
      );


    if (
      !logoutButton
    ) {
      return;
    }


    event.preventDefault();

    event.stopPropagation();

    event.stopImmediatePropagation();


    logoutManagerAccount();

  },
  true
);


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeLoginHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* =========================================================
   INITIAL AUTH STATE
========================================================= */

function startLoginSystem() {

  installLoginStyle();


  const currentManager =
    getCurrentManager();


  if (
    currentManager
  ) {

    applyManagerToDashboard(
      currentManager
    );


    const app =
      document.querySelector(
        ".app"
      );


    if (
      app
    ) {

      app.style.display =
        "";
    }


  } else {

    showLoginScreen();
  }
}


/* =========================================================
   START
========================================================= */

startLoginSystem();
/* =========================================================
   LOGIN API
========================================================= */

async function handleManagerLogin(
  event
) {

  event.preventDefault();


  const loginId =
    document
      .getElementById(
        "managerLoginId"
      )
      .value
      .trim();


  const password =
    document
      .getElementById(
        "managerLoginPassword"
      )
      .value;


  if (
    !loginId ||
    !password
  ) {

    setLoginMessage(
      "아이디와 비밀번호를 입력해주세요."
    );

    return;
  }


  const loginButton =
    document.querySelector(
      ".auth-login-button"
    );


  try {

    if (loginButton) {

      loginButton.disabled =
        true;

      loginButton.textContent =
        "로그인 중...";
    }


    setLoginMessage(
      ""
    );


    const response =
      await fetch(
        `${LOGIN_API_BASE}/institution-managers/login`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              login_id:
                loginId,

              password
            })
        }
      );


    if (!response.ok) {

      let message =
        "아이디 또는 비밀번호가 올바르지 않습니다.";


      try {

        const errorData =
          await response.json();


        if (
          typeof errorData?.detail ===
          "string"
        ) {

          message =
            errorData.detail;
        }

      } catch (_) {}


      throw new Error(
        message
      );
    }


    const result =
      await response.json();


    let institutionName =
      "";

    let institutionAddress =
      "";


    try {

      if (
        result.institution_id !== null &&
        result.institution_id !== undefined
      ) {

        if (
          !signupInstitutions.length
        ) {

          await loadSignupInstitutions(
            false
          );
        }


        const institution =
          signupInstitutions.find(
            item =>
              Number(item.id) ===
              Number(
                result.institution_id
              )
          );


        institutionName =
          institution?.name ||
          "";


        institutionAddress =
          institution?.address ||
          "";
      }

    } catch (error) {

      console.warn(
        "기관 정보 조회 실패:",
        error
      );
    }


    const manager = {

      id:
        result.id,

      loginId:
        result.login_id,

      name:
        result.name,

      phone:
        result.phone,

      email:
        result.email,

      institutionId:
        result.institution_id,

      institutionName,

      institutionAddress
    };


    saveCurrentManager(
      manager
    );


    applyManagerToDashboard(
      manager
    );


    hideLoginScreen();


    if (
      typeof showPage ===
      "function"
    ) {

      showPage(
        "dashboard"
      );
    }


  } catch (error) {

    console.error(
      "관리자 로그인 실패:",
      error
    );


    setLoginMessage(
      error.message ||
      "로그인에 실패했습니다."
    );


  } finally {

    if (loginButton) {

      loginButton.disabled =
        false;

      loginButton.textContent =
        "로그인";
    }
  }
}


/* =========================================================
   ADMIN NAME
========================================================= */

function applyManagerToDashboard(
  manager
) {

  const adminName =
    document.querySelector(
      ".admin-name"
    );


  if (!adminName) {
    return;
  }


  adminName.innerHTML = `

    <strong>
      ${escapeLoginHtml(
        manager.name ||
        "관리자"
      )}
    </strong>

    관리자
  `;
}


/* =========================================================
   SIGNUP MODAL
========================================================= */

function openSignupModal() {

  if (
    document.getElementById(
      "signupOverlay"
    )
  ) {
    return;
  }


  selectedSignupInstitution =
    null;

  pendingSignupInstitution =
    null;


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "signupOverlay";


  overlay.className =
    "signup-overlay";


  overlay.innerHTML = `

    <div class="signup-modal">

      <header class="signup-modal-header">

        <h2>
          기관 관리자 회원가입
        </h2>


        <button
          id="closeSignupButton"
          class="signup-close-button"
          type="button"
        >
          <i data-lucide="x"></i>
        </button>

      </header>


      <form
        id="managerSignupForm"
        class="signup-form-panel"
      >


        <label class="signup-field">

          <span>이름</span>

          <input
            id="signupName"
            type="text"
            placeholder="이름을 입력하세요"
            required
          />

        </label>


        <label class="signup-field">

          <span>전화번호</span>

          <input
            id="signupPhone"
            type="tel"
            placeholder="010-0000-0000"
            required
          />

        </label>


        <label class="signup-field">

          <span>이메일</span>

          <input
            id="signupEmail"
            type="email"
            placeholder="example@email.com"
            required
          />

        </label>


        <div class="signup-grid">

          <label class="signup-field">

            <span>아이디</span>

            <input
              id="signupLoginId"
              type="text"
              placeholder="로그인 아이디"
              required
            />

          </label>


          <label class="signup-field">

            <span>비밀번호</span>

            <input
              id="signupPassword"
              type="password"
              placeholder="비밀번호"
              required
            />

          </label>

        </div>


        <label class="signup-field">

          <span>비밀번호 확인</span>

          <input
            id="signupPasswordConfirm"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            required
          />

        </label>


        <div class="signup-field">

          <span>소속 기관</span>


          <button
            id="openInstitutionPickerButton"
            class="institution-select-button"
            type="button"
          >

            <span class="institution-select-main">

              <strong
                id="signupInstitutionButtonName"
              >
                소속 기관을 선택해주세요
              </strong>


              <small
                id="signupInstitutionButtonAddress"
              >
                기관 이름을 검색해서 선택할 수 있습니다.
              </small>

            </span>


            <i data-lucide="chevron-right"></i>

          </button>

        </div>


        <div
          id="signupMessage"
          class="auth-message"
        ></div>


        <button
          id="signupSubmitButton"
          class="signup-submit-button"
          type="submit"
        >
          회원가입 완료
        </button>

      </form>

    </div>
  `;


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      "closeSignupButton"
    )
    ?.addEventListener(
      "click",
      closeSignupModal
    );


  document
    .getElementById(
      "openInstitutionPickerButton"
    )
    ?.addEventListener(
      "click",
      openInstitutionPicker
    );


  document
    .getElementById(
      "managerSignupForm"
    )
    ?.addEventListener(
      "submit",
      handleManagerSignup
    );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closeSignupModal();
      }
    }
  );


  if (window.lucide) {
    lucide.createIcons();
  }
}


function closeSignupModal() {

  closeInstitutionPicker();


  selectedSignupInstitution =
    null;


  pendingSignupInstitution =
    null;


  document
    .getElementById(
      "signupOverlay"
    )
    ?.remove();
}


/* =========================================================
   SIGNUP MESSAGE
========================================================= */

function setSignupMessage(
  message,
  type = "error"
) {

  const box =
    document.getElementById(
      "signupMessage"
    );


  if (!box) {
    return;
  }


  if (!message) {

    box.textContent =
      "";

    box.className =
      "auth-message";

    return;
  }


  box.textContent =
    message;


  box.className =
    `auth-message ${type}`;
}


/* =========================================================
   SIGNUP API
========================================================= */

async function handleManagerSignup(
  event
) {

  event.preventDefault();


  const name =
    document
      .getElementById(
        "signupName"
      )
      .value
      .trim();


  const phone =
    document
      .getElementById(
        "signupPhone"
      )
      .value
      .trim();


  const email =
    document
      .getElementById(
        "signupEmail"
      )
      .value
      .trim();


  const loginId =
    document
      .getElementById(
        "signupLoginId"
      )
      .value
      .trim();


  const password =
    document
      .getElementById(
        "signupPassword"
      )
      .value;


  const passwordConfirm =
    document
      .getElementById(
        "signupPasswordConfirm"
      )
      .value;


  if (
    !name ||
    !phone ||
    !email ||
    !loginId ||
    !password ||
    !passwordConfirm
  ) {

    setSignupMessage(
      "모든 항목을 입력해주세요."
    );

    return;
  }


  if (
    password !==
    passwordConfirm
  ) {

    setSignupMessage(
      "비밀번호가 일치하지 않습니다."
    );

    return;
  }


  if (
    !selectedSignupInstitution
  ) {

    setSignupMessage(
      "소속 기관을 선택해주세요."
    );

    return;
  }


  const button =
    document.getElementById(
      "signupSubmitButton"
    );


  try {

    if (button) {

      button.disabled =
        true;

      button.textContent =
        "가입 처리 중...";
    }


    setSignupMessage(
      ""
    );


    const response =
      await fetch(
        `${LOGIN_API_BASE}/institution-managers/signup`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              name,

              phone,

              email,

              login_id:
                loginId,

              password,

              institution_id:
                Number(
                  selectedSignupInstitution.id
                )
            })
        }
      );


    if (!response.ok) {

      let message =
        "회원가입에 실패했습니다.";


      try {

        const errorData =
          await response.json();


        if (
          errorData?.detail
        ) {

          message =
            typeof errorData.detail ===
              "string"
              ? errorData.detail
              : JSON.stringify(
                  errorData.detail
                );
        }

      } catch (_) {}


      throw new Error(
        message
      );
    }


    await response.json();


    setSignupMessage(
      "회원가입이 완료되었습니다.",
      "success"
    );


    setTimeout(
      () => {

        closeSignupModal();


        const idInput =
          document.getElementById(
            "managerLoginId"
          );


        if (idInput) {

          idInput.value =
            loginId;
        }


        const passwordInput =
          document.getElementById(
            "managerLoginPassword"
          );


        if (passwordInput) {

          passwordInput.value =
            "";

          passwordInput.focus();
        }


        setLoginMessage(
          "회원가입이 완료되었습니다. 비밀번호를 입력해 로그인해주세요.",
          "success"
        );

      },
      700
    );


  } catch (error) {

    console.error(
      "관리자 회원가입 실패:",
      error
    );


    setSignupMessage(
      error.message ||
      "회원가입 처리 중 오류가 발생했습니다."
    );


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "회원가입 완료";
    }
  }
}
/* =========================================================
   INSTITUTION PICKER
========================================================= */

async function openInstitutionPicker() {

  if (
    document.getElementById(
      "institutionPickerOverlay"
    )
  ) {
    return;
  }


  pendingSignupInstitution =
    selectedSignupInstitution;


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    "institutionPickerOverlay";


  overlay.className =
    "signup-overlay institution-picker-overlay";


  overlay.innerHTML = `

    <div class="institution-picker-modal">

      <header class="signup-modal-header">

        <h2>
          소속 기관 찾기
        </h2>


        <button
          id="closeInstitutionPickerButton"
          class="signup-close-button"
          type="button"
        >
          <i data-lucide="x"></i>
        </button>

      </header>


      <div class="institution-picker-body">

        <div class="institution-search-wrap">

          <i data-lucide="search"></i>


          <input
            id="signupInstitutionSearch"
            type="text"
            placeholder="기관 이름을 검색하세요"
            autocomplete="off"
          />

        </div>


        <div
          id="institutionSearchResults"
          class="institution-search-results"
        >

          <div class="institution-result-empty">
            기관 정보를 불러오는 중입니다...
          </div>

        </div>


        <section
          id="institutionPreview"
          class="institution-preview"
        >

          <div
            id="signupInstitutionMap"
          ></div>


          <div class="institution-preview-info">

            <strong
              id="institutionPreviewName"
            ></strong>


            <span
              id="institutionPreviewAddress"
            ></span>

          </div>


          <button
            id="confirmInstitutionButton"
            class="institution-confirm-button"
            type="button"
          >
            이 기관 선택
          </button>

        </section>

      </div>

    </div>
  `;


  document.body.appendChild(
    overlay
  );


  document
    .getElementById(
      "closeInstitutionPickerButton"
    )
    ?.addEventListener(
      "click",
      closeInstitutionPicker
    );


  document
    .getElementById(
      "signupInstitutionSearch"
    )
    ?.addEventListener(
      "input",
      event => {

        searchSignupInstitution(
          event.target.value
        );
      }
    );


  document
    .getElementById(
      "confirmInstitutionButton"
    )
    ?.addEventListener(
      "click",
      confirmSignupInstitution
    );


  overlay.addEventListener(
    "click",
    event => {

      if (
        event.target === overlay
      ) {

        closeInstitutionPicker();
      }
    }
  );


  if (window.lucide) {
    lucide.createIcons();
  }


  if (
    !signupInstitutions.length
  ) {

    await loadSignupInstitutions(
      true
    );

  } else {

    renderInstitutionResults(
      signupInstitutions.slice(
        0,
        15
      )
    );
  }


  setTimeout(
    () => {

      document
        .getElementById(
          "signupInstitutionSearch"
        )
        ?.focus();

    },
    50
  );
}


function closeInstitutionPicker() {

  if (signupMap) {

    signupMap.remove();

    signupMap =
      null;
  }


  pendingSignupInstitution =
    null;


  document
    .getElementById(
      "institutionPickerOverlay"
    )
    ?.remove();
}


/* =========================================================
   LOAD INSTITUTIONS
========================================================= */

async function loadSignupInstitutions(
  render = true
) {

  const resultBox =
    document.getElementById(
      "institutionSearchResults"
    );


  try {

    const response =
      await fetch(
        `${LOGIN_API_BASE}/institutions`
      );


    if (!response.ok) {

      throw new Error(
        `기관 API 오류 ${response.status}`
      );
    }


    const data =
      await response.json();


    signupInstitutions =
      Array.isArray(data)
        ? data
        : [];


    if (render) {

      renderInstitutionResults(
        signupInstitutions.slice(
          0,
          15
        )
      );
    }


  } catch (error) {

    console.error(
      "기관 목록 조회 실패:",
      error
    );


    if (
      render &&
      resultBox
    ) {

      resultBox.innerHTML = `

        <div class="institution-result-empty">
          기관 정보를 불러오지 못했습니다.
        </div>
      `;
    }
  }
}


/* =========================================================
   SEARCH
========================================================= */

function searchSignupInstitution(
  keyword
) {

  const normalized =
    String(
      keyword || ""
    )
      .trim()
      .toLowerCase();


  let filtered =
    signupInstitutions;


  if (normalized) {

    filtered =
      signupInstitutions.filter(
        institution => {

          return (

            String(
              institution.name ||
              ""
            )
              .toLowerCase()
              .includes(
                normalized
              )

            ||

            String(
              institution.address ||
              ""
            )
              .toLowerCase()
              .includes(
                normalized
              )
          );
        }
      );
  }


  renderInstitutionResults(
    filtered.slice(
      0,
      30
    )
  );
}


/* =========================================================
   RESULT
========================================================= */

function renderInstitutionResults(
  list
) {

  const container =
    document.getElementById(
      "institutionSearchResults"
    );


  if (!container) {
    return;
  }


  if (!list.length) {

    container.innerHTML = `

      <div class="institution-result-empty">
        검색되는 기관이 없습니다.
      </div>
    `;

    return;
  }


  container.innerHTML =
    list
      .map(
        institution => `

          <button
            class="
              institution-result-button

              ${
                pendingSignupInstitution &&
                Number(
                  pendingSignupInstitution.id
                ) ===
                Number(
                  institution.id
                )
                  ? "active"
                  : ""
              }
            "
            type="button"
            data-institution-id="${institution.id}"
          >

            <strong>
              ${escapeLoginHtml(
                institution.name ||
                "기관"
              )}
            </strong>


            <span>
              ${escapeLoginHtml(
                institution.address ||
                "주소 정보 없음"
              )}
            </span>

          </button>
        `
      )
      .join("");


  container
    .querySelectorAll(
      ".institution-result-button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            previewSignupInstitution(
              Number(
                button.dataset
                  .institutionId
              )
            );
          }
        );
      }
    );
}


/* =========================================================
   PREVIEW
========================================================= */

function previewSignupInstitution(
  institutionId
) {

  const institution =
    signupInstitutions.find(
      item =>
        Number(item.id) ===
        Number(
          institutionId
        )
    );


  if (!institution) {
    return;
  }


  pendingSignupInstitution =
    institution;


  document
    .querySelectorAll(
      ".institution-result-button"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          Number(
            button.dataset
              .institutionId
          ) ===
          Number(
            institution.id
          )
        );
      }
    );


  document
    .getElementById(
      "institutionPreview"
    )
    ?.classList.add(
      "active"
    );


  const name =
    document.getElementById(
      "institutionPreviewName"
    );


  const address =
    document.getElementById(
      "institutionPreviewAddress"
    );


  if (name) {

    name.textContent =
      institution.name ||
      "선택한 기관";
  }


  if (address) {

    address.textContent =
      institution.address ||
      "주소 정보 없음";
  }


  setTimeout(
    () => {

      showInstitutionMap(
        institution
      );

    },
    30
  );
}


/* =========================================================
   MAP
========================================================= */

function showInstitutionMap(
  institution
) {

  const element =
    document.getElementById(
      "signupInstitutionMap"
    );


  if (
    !element ||
    typeof L ===
      "undefined"
  ) {
    return;
  }


  const latitude =
    Number(
      institution.latitude
    );


  const longitude =
    Number(
      institution.longitude
    );


  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {

    element.innerHTML = `

      <div
        style="
          height:100%;
          display:grid;
          place-items:center;
          padding:20px;
          color:#829099;
          font-size:11px;
          text-align:center;
        "
      >

        이 기관은 지도 좌표 정보가 없습니다.
        <br>
        기관명과 주소를 확인해주세요.

      </div>
    `;

    return;
  }


  if (signupMap) {

    signupMap.remove();

    signupMap =
      null;
  }


  element.innerHTML =
    "";


  signupMap =
    L.map(
      element,
      {
        zoomControl: true
      }
    )
      .setView(
        [
          latitude,
          longitude
        ],
        16
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
      signupMap
    );


  const icon =
    L.divIcon({
      className: "",

      html: `

        <div class="signup-map-marker">
          +
        </div>
      `,

      iconSize:
        [30, 30],

      iconAnchor:
        [15, 15]
    });


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
      signupMap
    )
    .bindPopup(
      `

        <strong>
          ${escapeLoginHtml(
            institution.name ||
            "기관"
          )}
        </strong>

        <br>

        ${escapeLoginHtml(
          institution.address ||
          ""
        )}
      `
    )
    .openPopup();


  setTimeout(
    () => {

      signupMap
        ?.invalidateSize();

    },
    100
  );
}


/* =========================================================
   CONFIRM INSTITUTION
========================================================= */

function confirmSignupInstitution() {

  if (
    !pendingSignupInstitution
  ) {
    return;
  }


  selectedSignupInstitution =
    pendingSignupInstitution;


  const button =
    document.getElementById(
      "openInstitutionPickerButton"
    );


  button?.classList.add(
    "selected"
  );


  const name =
    document.getElementById(
      "signupInstitutionButtonName"
    );


  const address =
    document.getElementById(
      "signupInstitutionButtonAddress"
    );


  if (name) {

    name.textContent =
      selectedSignupInstitution
        .name ||
      "선택한 기관";
  }


  if (address) {

    address.textContent =
      selectedSignupInstitution
        .address ||
      "주소 정보 없음";
  }


  closeInstitutionPicker();


  if (window.lucide) {
    lucide.createIcons();
  }
}
/* =========================================================
   LOGOUT
========================================================= */

function logoutManagerAccount() {

  clearManagerSession();


  closeSignupModal();


  document
    .getElementById(
      "accountOverlay"
    )
    ?.remove();


  showLoginScreen();
}


/*
  script.js의 로그아웃 확인 버튼과 연결
*/

document.addEventListener(
  "click",
  event => {

    const logoutButton =
      event.target.closest(
        "#logoutConfirmButton"
      );


    if (!logoutButton) {
      return;
    }


    event.preventDefault();

    event.stopPropagation();

    event.stopImmediatePropagation();


    logoutManagerAccount();

  },
  true
);


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeLoginHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* =========================================================
   START
========================================================= */

function startLoginSystem() {

  installLoginStyle();


  const currentManager =
    getCurrentManager();


  if (currentManager) {

    applyManagerToDashboard(
      currentManager
    );


    const app =
      document.querySelector(
        ".app"
      );


    if (app) {

      app.style.display =
        "";
    }


  } else {

    showLoginScreen();
  }
}


startLoginSystem();