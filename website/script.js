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


/*
  ==================================================
  알림 임시 데이터

  아직 알림 API를 받지 않았기 때문에
  여기만 프론트 임시 데이터 사용.

  subjectId / userId가 실제 DB ID와 맞으면
  해당 사용자 선택 상태로 페이지가 이동함.
  ==================================================
*/

let alerts = [
  {
    id: 1,

    alertType: "danger",

    subjectId: 3,

    name: "김민수",

    displayInfo: "남, 8세",

    phone: "",

    message: "안전구역 이탈",

    createdAt: "2026-08-11T21:08:00",

    read: false
  },

  {
    id: 2,

    alertType: "danger",

    subjectId: 4,

    name: "이서연",

    displayInfo: "여, 9세",

    phone: "",

    message: "장시간 위치 정지",

    createdAt: "2026-08-11T20:52:00",

    read: false
  },

  {
    id: 3,

    alertType: "danger",

    subjectId: 5,

    name: "박지우",

    displayInfo: "여, 7세",

    phone: "",

    message: "위험지역 진입",

    createdAt: "2026-08-11T20:31:00",

    read: true
  },

  {
    id: 4,

    alertType: "danger",

    subjectId: 6,

    name: "최수아",

    displayInfo: "여, 6세",

    phone: "",

    message: "장시간 위치 정지",

    createdAt: "2026-08-11T19:48:00",

    read: true
  },

  {
    id: 5,

    alertType: "auth",

    userType: "guardians",

    userId: 1,

    name: "김다온 보호자",

    displayInfo: "",

    phone: "01011110000",

    message: "인증코드 발급 요청",

    createdAt: "2026-08-11T20:31:00",

    read: false
  },

  {
    id: 6,

    alertType: "auth",

    userType: "guardians",

    userId: 3,

    name: "홍길동 보호자",

    displayInfo: "",

    phone: "",

    message: "인증코드 발급 요청",

    createdAt: "2026-08-11T19:48:00",

    read: true
  },

  {
    id: 7,

    alertType: "auth",

    userType: "subjects",

    userId: 7,

    name: "정유진 보호대상자",

    displayInfo: "",

    phone: "",

    message: "인증코드 발급 요청",

    createdAt: "2026-08-11T17:59:00",

    read: true
  },

  {
    id: 8,

    alertType: "danger",

    subjectId: 8,

    name: "이민호",

    displayInfo: "남, 10세",

    phone: "",

    message: "안전구역 이탈",

    createdAt: "2026-08-11T16:42:00",

    read: true
  }
];


let alertTab = "all";
let alertStatusValue = "all";
let alertSearchKeyword = "";

let alertCurrentPage = 1;

const ALERTS_PER_PAGE = 8;


/* ==================================================
   MAP
================================================== */

let liveMap = null;
let subjectMarker = null;
let institutionMarkers = [];


/* ==================================================
   ELEMENTS
================================================== */

const userNav =
  document.getElementById("userNav");

const realtimeNav =
  document.getElementById("realtimeNav");

const authNav =
  document.getElementById("authNav");

const alertNav =
  document.getElementById("alertNav");

const alertSidebarBadge =
  document.getElementById("alertSidebarBadge");


const userManagementPage =
  document.getElementById("userManagementPage");

const realtimePage =
  document.getElementById("realtimePage");

const authManagementPage =
  document.getElementById("authManagementPage");

const alertPage =
  document.getElementById("alertPage");


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

const alertPagination =
  document.getElementById("alertPagination");

const allAlertCount =
  document.getElementById("allAlertCount");

const dangerAlertCount =
  document.getElementById("dangerAlertCount");

const authAlertCount =
  document.getElementById("authAlertCount");

const refreshAlertButton =
  document.getElementById("refreshAlertButton");


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
   LOAD BASE DATA
================================================== */

async function loadBaseData() {

  userLoading.classList.remove("hidden");

  userError.classList.add("hidden");

  userTableArea.classList.add("hidden");


  try {

    /*
      사용자 정보는 필수.
      기관 데이터는 실패해도 사용자 관리가 죽지 않도록 분리.
    */

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
        Array.isArray(institutionData)
          ? institutionData
          : [];


    } catch (institutionError) {

      console.warn(
        "기관 데이터 조회 실패:",
        institutionError
      );


      institutions =
        [];
    }


    populateInstitutionSelect();

    renderUserManagement();

    renderAuthManagement();

    renderMonitorSubjects();


    userLoading.classList.add("hidden");

    userTableArea.classList.remove("hidden");


  } catch (error) {

    console.error(error);


    userLoading.classList.add("hidden");

    userError.classList.remove("hidden");


    userError.textContent =
      `사용자 정보를 불러오지 못했습니다. ${error.message}`;
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
      String(value || "").toLowerCase()
    ] ||
    value ||
    "-"
  );
}


function getGenderLabel(value) {

  return (
    GENDER_LABELS[
      String(value || "").toLowerCase()
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
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value);
  }


  return date.toLocaleString(
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

      <dt>
        ${escapeHtml(label)}
      </dt>

      <dd>
        ${escapeHtml(value)}
      </dd>

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
    String(user.auth_code).trim()
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
   PAGE SWITCH
================================================== */

function closeDrawers() {

  userDetailDrawer.classList.remove(
    "open"
  );

  authDetailDrawer.classList.remove(
    "open"
  );

  document.body.classList.remove(
    "drawer-open"
  );
}


function showPage(page) {

  closeDrawers();


  userManagementPage.classList.add(
    "hidden"
  );

  realtimePage.classList.add(
    "hidden"
  );

  authManagementPage.classList.add(
    "hidden"
  );

  alertPage.classList.add(
    "hidden"
  );


  userNav.classList.remove(
    "active"
  );

  realtimeNav.classList.remove(
    "active"
  );

  authNav.classList.remove(
    "active"
  );

  alertNav.classList.remove(
    "active"
  );


  if (page === "users") {

    userManagementPage.classList.remove(
      "hidden"
    );

    userNav.classList.add(
      "active"
    );

    renderUserManagement();
  }


  if (page === "realtime") {

    realtimePage.classList.remove(
      "hidden"
    );

    realtimeNav.classList.add(
      "active"
    );

    renderMonitorSubjects();


    setTimeout(
      () => {

        initializeMap();

        liveMap.invalidateSize();

      },
      100
    );
  }


  if (page === "auth") {

    authManagementPage.classList.remove(
      "hidden"
    );

    authNav.classList.add(
      "active"
    );

    renderAuthManagement();
  }


  if (page === "alerts") {

    alertPage.classList.remove(
      "hidden"
    );

    alertNav.classList.add(
      "active"
    );

    renderAlerts();
  }


  lucide.createIcons();
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
    normalize(userSearchKeyword);


  const addressKeyword =
    normalize(userAddressKeyword);


  return source.filter(
    user => {

      const matchesKeyword =
        !keyword ||
        (
          normalize(user.name) +
          normalize(user.phone)
        ).includes(keyword);


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
        userTypeFilterValue === "all" ||
        String(
          user.subject_type || ""
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


  userTypeFilter.classList.toggle(
    "hidden",
    !subjectMode
  );


  userAddressBox.classList.toggle(
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
                ${escapeHtml(subject.name)}
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
                  subject.phone || "-"
                )}
              </td>

              <td id="guardian-${subject.id}">
                -
              </td>

              <td>
                ${renderStatusBadge(subject)}
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
                  상세보기⌄
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
                ${escapeHtml(guardian.name)}
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
                  guardian.phone || "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  guardian.address || "-"
                )}
              </td>

              <td>
                ${renderStatusBadge(guardian)}
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
                  상세보기⌄
                </button>

              </td>

            </tr>
          `
        )
        .join("");
  }


  userTotalCount.textContent =
    `전체 ${users.length}건`;


  lucide.createIcons();
}


/* ==================================================
   ADD USER
================================================== */

function openAddUserModal() {

  addUserModal.classList.remove(
    "hidden"
  );


  if (userTab === "guardians") {

    showGuardianForm();

  } else {

    showSubjectForm();
  }


  populateInstitutionSelect();

  lucide.createIcons();
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
        String(institution.id) ===
        oldValue
    )
  ) {

    subjectInstitution.value =
      oldValue;
  }
}


async function createSubject(event) {

  event.preventDefault();


  if (
    !subjectAddress.value.trim()
  ) {

    alert(
      "주소 검색을 통해 주소를 선택해주세요."
    );

    return;
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


    await apiRequest(
      "/subjects",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );


    userTab =
      "subjects";


    closeUserAddModal();


    await loadBaseData();


    alert(
      "보호대상자가 DB에 추가되었습니다."
    );


  } catch (error) {

    alert(
      `보호대상자 추가 실패\n${error.message}`
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


  if (
    !guardianAddress.value.trim()
  ) {

    alert(
      "주소 검색을 통해 주소를 선택해주세요."
    );

    return;
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

    submitGuardianButton.disabled =
      true;


    submitGuardianButton.textContent =
      "추가 중...";


    await apiRequest(
      "/guardians",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );


    userTab =
      "guardians";


    closeUserAddModal();


    await loadBaseData();


    alert(
      "보호자가 DB에 추가되었습니다."
    );


  } catch (error) {

    alert(
      `보호자 추가 실패\n${error.message}`
    );


  } finally {

    submitGuardianButton.disabled =
      false;


    submitGuardianButton.textContent =
      "보호자 추가";
  }
}


/* ==================================================
   RELATION
================================================== */

async function getSubjectRelations(id) {

  const key =
    `subject-${id}`;


  if (relationCache.has(key)) {

    return relationCache.get(key);
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


  if (relationCache.has(key)) {

    return relationCache.get(key);
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
        item.id === id
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


  if (type === "subjects") {

    userDetailRole.textContent =
      `보호대상자 · ${getSubjectTypeLabel(
        user.subject_type
      )}`;


    userBasicInfo.innerHTML = `

      ${detailItem(
        "성별",
        getGenderLabel(user.gender)
      )}

      ${detailItem(
        "생년월일",
        formatDate(user.birth_date)
      )}

      ${detailItem(
        "전화번호",
        user.phone || "-"
      )}

      ${detailItem(
        "상태",
        registered
          ? "등록"
          : "미등록"
      )}
    `;


    const relations =
      await getSubjectRelations(id);


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
                    relation.relationship_code ||
                    "-"
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
        user.address || "-"
      )}

      ${detailItem(
        "특이사항",
        user.special_notes || "-"
      )}
    `;


  } else {

    userDetailRole.textContent =
      "보호자";


    userBasicInfo.innerHTML = `

      ${detailItem(
        "성별",
        getGenderLabel(user.gender)
      )}

      ${detailItem(
        "생년월일",
        formatDate(user.birth_date)
      )}

      ${detailItem(
        "전화번호",
        user.phone || "-"
      )}

      ${detailItem(
        "주소",
        user.address || "-"
      )}

      ${detailItem(
        "상태",
        registered
          ? "등록"
          : "미등록"
      )}
    `;


    const relations =
      await getGuardianRelations(id);


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


  document.body.classList.add(
    "drawer-open"
  );


  userDetailDrawer.classList.add(
    "open"
  );


  lucide.createIcons();
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
    normalize(authSearchKeyword);


  return source.filter(
    user => {

      if (!keyword) {
        return true;
      }


      return (
        normalize(user.name) +
        normalize(user.phone)
      ).includes(keyword);
    }
  );
}


function renderAuthManagement() {

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
                ${escapeHtml(user.name)}
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
                  user.phone || "-"
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
                ${renderStatusBadge(user)}
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
                  상세보기⌄
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
        item.id === id
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


  if (type === "subjects") {

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
    user.phone || "-";


  updateAuthDetail();


  document.body.classList.add(
    "drawer-open"
  );


  authDetailDrawer.classList.add(
    "open"
  );


  lucide.createIcons();
}


function updateAuthDetail() {

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


    issueAuthDetailButton.textContent =
      "인증코드 발급";
  }


  lucide.createIcons();
}


async function issueAuthCode() {

  if (!selectedAuthUser) {
    return;
  }


  const endpoint =
    selectedAuthUser.type === "subjects"
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


    if (!result?.auth_code) {

      throw new Error(
        "백엔드 응답에 인증코드가 없습니다."
      );
    }


    const targetArray =
      selectedAuthUser.type === "subjects"
        ? subjects
        : guardians;


    const targetUser =
      targetArray.find(
        user =>
          user.id ===
          selectedAuthUser.id
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
   ALERTS
================================================== */

function getFilteredAlerts() {

  const keyword =
    normalize(
      alertSearchKeyword
    );


  return alerts.filter(
    item => {

      const matchesType =
        alertTab === "all" ||
        item.alertType === alertTab;


      const matchesStatus =
        alertStatusValue === "all" ||
        (
          alertStatusValue === "unread" &&
          !item.read
        ) ||
        (
          alertStatusValue === "read" &&
          item.read
        );


      const matchesKeyword =
        !keyword ||
        (
          normalize(item.name) +
          normalize(item.phone)
        ).includes(keyword);


      return (
        matchesType &&
        matchesStatus &&
        matchesKeyword
      );
    }
  );
}


function getAlertTypeHtml(item) {

  if (item.alertType === "danger") {

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


  if (item.alertType === "danger") {

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

    alertSidebarBadge.classList.add(
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

  const filtered =
    getFilteredAlerts();


  const dangerCount =
    alerts.filter(
      item =>
        item.alertType === "danger"
    ).length;


  const authCount =
    alerts.filter(
      item =>
        item.alertType === "auth"
    ).length;


  allAlertCount.textContent =
    alerts.length;


  dangerAlertCount.textContent =
    dangerCount;


  authAlertCount.textContent =
    authCount;


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
        ALERTS_PER_PAGE
      )
    );


  if (
    alertCurrentPage >
    totalPages
  ) {

    alertCurrentPage =
      totalPages;
  }


  const startIndex =
    (
      alertCurrentPage -
      1
    ) *
    ALERTS_PER_PAGE;


  const pageItems =
    filtered.slice(
      startIndex,
      startIndex +
      ALERTS_PER_PAGE
    );


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
            item.alertType === "danger"
              ? "실시간 관제로 이동"
              : "인증코드 관리로 이동";


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
                ${getAlertTypeHtml(item)}
              </td>

              <td>
                ${escapeHtml(
                  item.message
                )}
              </td>

              <td>
                ${getAlertStatusHtml(item)}
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
            조건에 맞는 알림이 없습니다.
          </td>

        </tr>
      `;
  }


  renderAlertPagination(
    totalPages
  );


  alertTotalCount.textContent =
    `전체 ${filtered.length}건`;


  renderAlertSidebarBadge();


  document
    .querySelectorAll(
      ".alert-tab"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.alertTab ===
          alertTab
        );
      }
    );


  lucide.createIcons();
}


function renderAlertPagination(
  totalPages
) {

  let html =
    `
      <button
        class="page-arrow-button"
        onclick="
          changeAlertPage(
            ${alertCurrentPage - 1}
          )
        "
        ${
          alertCurrentPage === 1
            ? "disabled"
            : ""
        }
      >
        <i data-lucide="chevron-left"></i>
      </button>
    `;


  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {

    html +=
      `
        <button
          class="
            page-number-button
            ${
              page === alertCurrentPage
                ? "active"
                : ""
            }
          "
          onclick="
            changeAlertPage(
              ${page}
            )
          "
        >
          ${page}
        </button>
      `;
  }


  html +=
    `
      <button
        class="page-arrow-button"
        onclick="
          changeAlertPage(
            ${alertCurrentPage + 1}
          )
        "
        ${
          alertCurrentPage === totalPages
            ? "disabled"
            : ""
        }
      >
        <i data-lucide="chevron-right"></i>
      </button>
    `;


  alertPagination.innerHTML =
    html;
}


function changeAlertPage(page) {

  const filtered =
    getFilteredAlerts();


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
        ALERTS_PER_PAGE
      )
    );


  if (
    page < 1 ||
    page > totalPages
  ) {
    return;
  }


  alertCurrentPage =
    page;


  renderAlerts();
}


/*
  핵심:
  알림에서 이동할 때
  해당 사용자까지 자동 선택
*/

async function routeFromAlert(
  alertId
) {

  const item =
    alerts.find(
      alertItem =>
        alertItem.id ===
        alertId
    );


  if (!item) {
    return;
  }


  /*
    클릭하면 확인 처리
  */

  item.read =
    true;


  renderAlertSidebarBadge();


  /*
    위험 알림
    → 실시간 관제
    → 해당 보호대상자 자동 선택
  */

  if (
    item.alertType ===
    "danger"
  ) {

    showPage(
      "realtime"
    );


    setTimeout(
      async () => {

        let subject =
          subjects.find(
            user =>
              user.id ===
              item.subjectId
          );


        /*
          임시 알림 ID가 실제 DB와 다를 경우
          이름으로 한 번 더 탐색.
          실제 알림 API가 연결되면
          subject_id만 사용하면 됨.
        */

        if (!subject) {

          const cleanName =
            item.name
              .replace(
                /\s*\([^)]*\)\s*/g,
                ""
              )
              .trim();


          subject =
            subjects.find(
              user =>
                user.name ===
                cleanName
            );
        }


        if (subject) {

          await selectMonitorSubject(
            subject.id
          );


        } else {

          alert(
            "해당 보호대상자를 현재 DB에서 찾지 못했습니다.\n알림 API 연동 시 subject_id로 정확히 연결됩니다."
          );
        }

      },
      150
    );


    return;
  }


  /*
    인증 요청
    → 인증코드 관리
    → 보호자/보호대상자 탭 자동 선택
    → 해당 사용자 상세 drawer 자동 오픈
  */

  const targetType =
    item.userType ||
    "guardians";


  authTab =
    targetType;


  showPage(
    "auth"
  );


  renderAuthManagement();


  setTimeout(
    () => {

      const source =
        targetType === "subjects"
          ? subjects
          : guardians;


      let user =
        source.find(
          candidate =>
            candidate.id ===
            item.userId
        );


      if (!user) {

        const cleanName =
          item.name
            .replace(
              " 보호자",
              ""
            )
            .replace(
              " 보호대상자",
              ""
            )
            .trim();


        user =
          source.find(
            candidate =>
              candidate.name ===
              cleanName
          );
      }


      if (user) {

        openAuthDetail(
          targetType,
          user.id
        );


      } else {

        alert(
          "해당 사용자를 현재 DB에서 찾지 못했습니다.\n알림 API 연동 시 user_id로 정확히 연결됩니다."
        );
      }

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
          normalize(subject.name) +
          normalize(subject.phone)
        ).includes(keyword);


      const matchesType =
        monitorTypeValue === "all" ||
        String(
          subject.subject_type || ""
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
            selectedMonitorSubject?.id ===
            subject.id;


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
                  ${escapeHtml(subject.name)}
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
                    subject.phone || "-"
                  )}
                </span>

              </div>

            </button>
          `;
        }
      )
      .join("");


  lucide.createIcons();
}


async function selectMonitorSubject(
  id
) {

  const subject =
    subjects.find(
      item =>
        item.id === id
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
    subject.phone || "-";


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


  await loadSubjectGps(
    subject
  );


  lucide.createIcons();
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
      `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;


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


  mapEmptyState.classList.add(
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
          ${escapeHtml(subject.name)}
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
   INSTITUTIONS
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

  const R =
    6371;


  const toRad =
    degree =>
      degree *
      Math.PI /
      180;


  const dLat =
    toRad(
      lat2 - lat1
    );


  const dLon =
    toRad(
      lon2 - lon1
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
      Math.sqrt(1 - a)
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
            Number(item.latitude),
            Number(item.longitude)
          );


        return {
          ...item,

          distance_km:
            distance
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
          item.institution_id !==
          undefined
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
          merged.distance_km ===
          undefined &&
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
      .slice(0, 5)
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
                    ${escapeHtml(distance)}
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


  lucide.createIcons();
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
   NAV EVENTS
================================================== */

userNav.addEventListener(
  "click",
  () =>
    showPage("users")
);


realtimeNav.addEventListener(
  "click",
  () =>
    showPage("realtime")
);


authNav.addEventListener(
  "click",
  () =>
    showPage("auth")
);


alertNav.addEventListener(
  "click",
  () =>
    showPage("alerts")
);


/* ==================================================
   USER EVENTS
================================================== */

userSubjectTab.addEventListener(
  "click",
  () => {

    userTab =
      "subjects";


    renderUserManagement();
  }
);


userGuardianTab.addEventListener(
  "click",
  () => {

    userTab =
      "guardians";


    renderUserManagement();
  }
);


userSearchInput.addEventListener(
  "input",
  event => {

    userSearchKeyword =
      event.target.value;


    renderUserManagement();
  }
);


userTypeFilter.addEventListener(
  "change",
  event => {

    userTypeFilterValue =
      event.target.value;


    renderUserManagement();
  }
);


userAddressInput.addEventListener(
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

subjectAddressSearchButton.addEventListener(
  "click",
  () => {

    openPostcodeSearch(
      subjectAddress,
      subjectAddressDetail
    );
  }
);


subjectAddress.addEventListener(
  "click",
  () => {

    openPostcodeSearch(
      subjectAddress,
      subjectAddressDetail
    );
  }
);


guardianAddressSearchButton.addEventListener(
  "click",
  () => {

    openPostcodeSearch(
      guardianAddress,
      guardianAddressDetail
    );
  }
);


guardianAddress.addEventListener(
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

addUserButton.addEventListener(
  "click",
  openAddUserModal
);


closeAddUserModal.addEventListener(
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


addUserModal.addEventListener(
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


addSubjectTab.addEventListener(
  "click",
  showSubjectForm
);


addGuardianTab.addEventListener(
  "click",
  showGuardianForm
);


subjectForm.addEventListener(
  "submit",
  createSubject
);


guardianForm.addEventListener(
  "submit",
  createGuardian
);


/* ==================================================
   AUTH EVENTS
================================================== */

authSubjectTab.addEventListener(
  "click",
  () => {

    authTab =
      "subjects";


    renderAuthManagement();
  }
);


authGuardianTab.addEventListener(
  "click",
  () => {

    authTab =
      "guardians";


    renderAuthManagement();
  }
);


authSearchInput.addEventListener(
  "input",
  event => {

    authSearchKeyword =
      event.target.value;


    renderAuthManagement();
  }
);


refreshAuthButton.addEventListener(
  "click",
  loadBaseData
);


issueAuthDetailButton.addEventListener(
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


/* ==================================================
   ALERT EVENTS
================================================== */

document
  .querySelectorAll(
    ".alert-tab"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          alertTab =
            button.dataset.alertTab;


          alertCurrentPage =
            1;


          renderAlerts();
        }
      );
    }
  );


alertSearchInput.addEventListener(
  "input",
  event => {

    alertSearchKeyword =
      event.target.value;


    alertCurrentPage =
      1;


    renderAlerts();
  }
);


alertStatusFilter.addEventListener(
  "change",
  event => {

    alertStatusValue =
      event.target.value;


    alertCurrentPage =
      1;


    renderAlerts();
  }
);


refreshAlertButton.addEventListener(
  "click",
  () => {

    renderAlerts();
  }
);


/* ==================================================
   REALTIME EVENTS
================================================== */

monitorSearchInput.addEventListener(
  "input",
  event => {

    monitorSearchKeyword =
      event.target.value;


    renderMonitorSubjects();
  }
);


monitorTypeFilter.addEventListener(
  "change",
  event => {

    monitorTypeValue =
      event.target.value;


    renderMonitorSubjects();
  }
);


realtimeRefreshButton.addEventListener(
  "click",
  async () => {

    const selectedId =
      selectedMonitorSubject?.id;


    await loadBaseData();


    if (selectedId) {

      const refreshedSubject =
        subjects.find(
          subject =>
            subject.id ===
            selectedId
        );


      if (refreshedSubject) {

        await selectMonitorSubject(
          refreshedSubject.id
        );
      }
    }
  }
);


focusMapButton.addEventListener(
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

copyAuthCodeButton.addEventListener(
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


copyModalCode.addEventListener(
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

closeUserDrawer.addEventListener(
  "click",
  closeDrawers
);


closeAuthDrawer.addEventListener(
  "click",
  closeDrawers
);


closeAuthModal.addEventListener(
  "click",
  () => {

    authCodeModal.classList.add(
      "hidden"
    );
  }
);


confirmAuthModal.addEventListener(
  "click",
  () => {

    authCodeModal.classList.add(
      "hidden"
    );
  }
);


authCodeModal.addEventListener(
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


window.changeAlertPage =
  changeAlertPage;


/* ==================================================
   START
================================================== */

if (window.lucide) {

  lucide.createIcons();
}


renderAlertSidebarBadge();

renderAlerts();

loadBaseData();