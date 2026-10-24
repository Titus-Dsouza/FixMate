const screens = [...document.querySelectorAll("[data-screen-panel]")];
const getStartedButton = document.querySelector("[data-get-started]");
const roleChoices = document.querySelectorAll("[data-role-choice]");
const screenLinks = document.querySelectorAll("[data-screen-link]");
const roleName = document.querySelector("#role-name");
const roleDescription = document.querySelector("#role-description");
const civilianTabs = document.querySelectorAll("[data-civilian-tab]");
const civilianViews = document.querySelectorAll("[data-civilian-view]");
const complaintForm = document.querySelector("#complaint-form");
const entryPanel = document.querySelector("[data-entry-panel]");
const reviewPanel = document.querySelector("[data-review-panel]");
const confirmationPanel = document.querySelector("[data-confirmation-panel]");
const analysisStatus = document.querySelector("#analysis-status");
const analyzeButton = document.querySelector("[data-analyze-and-review]");
const photoInput = document.querySelector("#issue-photo");
const photoError = document.querySelector("#photo-error");
const photoPreview = document.querySelector("#photo-preview");
const previewImage = document.querySelector("#preview-image");
const previewName = document.querySelector("#preview-name");
const reviewPhotoPanel = document.querySelector("#review-photo-panel");
const reviewImage = document.querySelector("#review-image");
const reviewFinalCategory = document.querySelector("#review-final-category");
const reviewFinalDescription = document.querySelector("#review-final-description");
const reviewDescriptionSource = document.querySelector("#review-description-source");
const reviewHumanNotice = document.querySelector("#review-human-review");
const reviewManualFallback = document.querySelector("#review-manual-fallback");
const reviewCategoryChanged = document.querySelector("#review-category-change");
const aiDetailsPanel = document.querySelector("#ai-analysis-details");
const uncertaintyPanel = document.querySelector("#review-uncertainties-panel");
const STORAGE_KEY = "fixmate.civilian.complaints.v1";
const ANALYZE_ENDPOINT = "/api/complaints/analyze/";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_ANALYSIS_WAIT_MS = 15000;
const SUPPORTED_CATEGORIES = [
  "Roads & Footpaths",
  "Garbage & Waste",
  "Drainage & Waterlogging",
  "Water Supply & Leakage",
];
const SUPPORTED_DEPARTMENTS = [
  "Road Department",
  "Solid Waste Management",
  "Drainage Department",
  "Water Supply Department",
];

const roleDetails = {
  civilian: {
    name: "Civilian",
    description: "A place for residents to report civic issues, track complaints, and view area progress.",
  },
  official: {
    name: "Government Official",
    description: "A demonstration workspace for reviewing sample complaints and repair evidence.",
  },
};

const demoComplaints = [
  {
    reference: "DEMO-001",
    category: "Roads & Footpaths",
    description: "A sample uneven road surface is shown here to demonstrate an unresolved report.",
    locality: "Example locality",
    submittedAt: daysAgo(18),
    status: "unresolved",
  },
  {
    reference: "DEMO-002",
    category: "Garbage & Waste",
    description: "A fictional waste collection example awaiting an initial review.",
    locality: "Example locality",
    submittedAt: daysAgo(5),
    status: "awaiting_review",
  },
  {
    reference: "DEMO-003",
    category: "Drainage & Waterlogging",
    description: "A sample drainage report demonstrates a case with uncertain validity.",
    locality: "Example locality",
    submittedAt: daysAgo(11),
    status: "uncertain",
  },
  {
    reference: "DEMO-004",
    category: "Water Supply & Leakage",
    description: "A fictional repair example confirmed by the reporting citizen.",
    locality: "Example locality",
    submittedAt: daysAgo(30),
    status: "confirmed",
  },
];

const statusDetails = {
  unresolved: { label: "Unresolved", classSuffix: "unresolved" },
  awaiting_review: { label: "Awaiting review", classSuffix: "awaiting" },
  uncertain: { label: "Validity uncertain", classSuffix: "uncertain" },
  confirmed: { label: "Completed · citizen confirmed", classSuffix: "confirmed" },
};

const departmentByCategory = {
  "Roads & Footpaths": "Road Department",
  "Garbage & Waste": "Solid Waste Management",
  "Drainage & Waterlogging": "Drainage Department",
  "Water Supply & Leakage": "Water Supply Department",
};

let activePhotoUrl = null;
let sessionOnlySubmissions = [];
let currentAnalysisDraft = null;
let originalComplaint = null;
let analysisInProgress = false;
let citizenChangedCategory = false;
let citizenChangedDescription = false;

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function showScreen(screenName) {
  const nextScreen = screens.find((screen) => screen.dataset.screenPanel === screenName);
  if (!nextScreen) return;

  screens.forEach((screen) => {
    screen.hidden = screen !== nextScreen;
    screen.classList.remove("is-active");
  });

  if (screenName === "welcome") document.title = "Welcome to FixMate";
  else if (screenName === "roles") document.title = "Choose your role — FixMate";
  else if (screenName === "civilian") document.title = "Civilian space — FixMate";
  else if (screenName === "official-login") document.title = "Official demonstration sign in — FixMate";
  else if (screenName === "official-dashboard") document.title = "Official demonstration workspace — FixMate";
  else document.title = roleName.textContent + " experience — FixMate";

  window.scrollTo({ top: 0, behavior: "auto" });
  nextScreen.classList.add("is-active");
  nextScreen.querySelector("h1").focus({ preventScroll: true });
}

window.fixmateShowScreen = showScreen;

function showCivilianView(viewName, moveFocus = true) {
  const nextView = [...civilianViews].find((view) => view.dataset.civilianView === viewName);
  if (!nextView) return;

  civilianViews.forEach((view) => {
    view.hidden = view !== nextView;
    view.classList.toggle("is-current", view === nextView);
  });

  civilianTabs.forEach((tab) => {
    const selected = tab.dataset.civilianTab === viewName;
    tab.classList.toggle("is-selected", selected);
    if (selected) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });

  if (viewName === "complaints") renderComplaints();
  if (moveFocus) nextView.querySelector("h2").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function setRole(role) {
  const details = roleDetails[role];
  if (!details) return;

  roleName.textContent = details.name;
  roleDescription.textContent = details.description;

  if (role === "civilian") {
    showScreen("civilian");
    showCivilianView("report", false);
  } else {
    showScreen("official-login");
  }
}

function readStoredComplaints() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return sessionOnlySubmissions;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return sessionOnlySubmissions;
    const storedEntries = parsed.filter((item) => (
      item && typeof item.reference === "string" &&
      typeof (item.finalCategory || item.category) === "string" &&
      typeof (item.finalDescription ?? item.description) === "string" &&
      typeof item.locality === "string" &&
      typeof item.submittedAt === "string" &&
      item.status === "awaiting_review"
    ));
    return [...storedEntries, ...sessionOnlySubmissions];
  } catch {
    return sessionOnlySubmissions;
  }
}

function createNode(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function elapsedDays(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function createComplaintCard(complaint, isDemo) {
  const status = statusDetails[complaint.status] || statusDetails.awaiting_review;
  const card = createNode("article", "complaint-card complaint-card--" + status.classSuffix);
  const top = createNode("div", "complaint-card-top");
  const ref = createNode("span", "complaint-reference", complaint.reference);
  const statusBadge = createNode("span", "status-badge status-badge--" + status.classSuffix, status.label);
  top.append(ref, statusBadge);
  card.append(top);

  if (isDemo) card.append(createNode("span", "demo-label complaint-demo-label", "DEMO DATA"));
  else card.append(createNode("span", "prototype-label", "PROTOTYPE ENTRY"));

  const category = complaint.finalCategory || complaint.category || "Category not recorded";
  card.append(createNode("h4", "complaint-category", category));

  const description = complaint.finalDescription ?? complaint.description ?? "";
  const descriptionPending = complaint.descriptionPending || !description.trim();
  card.append(createNode(
    "p",
    descriptionPending ? "complaint-description pending-description" : "complaint-description",
    descriptionPending ? "Description pending — AI analysis is unavailable or did not produce a supported draft." : description,
  ));

  const metadata = createNode("dl", "complaint-metadata");
  const department = complaint.departmentRecommendation && complaint.departmentRecommendation.department
    ? complaint.departmentRecommendation.department
    : complaint.department || "Not recommended";
  const fields = [
    ["Locality", complaint.locality],
    ["Department recommendation", department],
    ["Submitted", formatDate(complaint.submittedAt)],
  ];
  const aiSuggestedCategory = complaint.suggestedCategory;
  if (aiSuggestedCategory) fields.push(["Gemini category suggestion", aiSuggestedCategory]);
  const days = elapsedDays(complaint.submittedAt);
  if (complaint.status !== "confirmed" && days !== null) {
    const ageLabel = complaint.status === "unresolved" ? "Unresolved for" : "Awaiting review for";
    fields.push([ageLabel, days + (days === 1 ? " day" : " days")]);
  }
  if (complaint.photoName) fields.push(["Photo", complaint.photoName]);

  fields.forEach(([label, value]) => {
    const item = createNode("div", "complaint-metadata-item");
    item.append(createNode("dt", "", label), createNode("dd", "", value));
    metadata.append(item);
  });
  card.append(metadata);

  if (complaint.needsHumanReview) {
    card.append(createNode("p", "status-explainer", "Human review is recommended; no automatic assignment was made."));
  }
  if (complaint.status === "confirmed") {
    card.append(createNode("p", "confirmation-explainer", isDemo
      ? "Demonstration example: completed and confirmed by the reporting citizen."
      : "This prototype record has no way to change its status; citizen confirmation is not simulated."));
  } else if (isDemo && complaint.status === "uncertain") {
    card.append(createNode("p", "status-explainer", "Example only: validity has not been established."));
  }

  return card;
}

function renderComplaints() {
  const submitted = readStoredComplaints();
  const submittedList = document.querySelector("#submitted-complaints");
  const demoList = document.querySelector("#demo-complaints");
  const emptyState = document.querySelector("#submission-empty-state");
  const count = document.querySelector("[data-submission-count]");

  submittedList.replaceChildren(...submitted.map((item) => createComplaintCard(item, false)));
  demoList.replaceChildren(...demoComplaints.map((item) => createComplaintCard(item, true)));
  emptyState.hidden = submitted.length !== 0;
  count.textContent = String(submitted.length);
}

function showFormStep(step) {
  entryPanel.hidden = step !== "entry";
  reviewPanel.hidden = step !== "review";
  confirmationPanel.hidden = step !== "confirmation";
  const heading = step === "entry"
    ? document.querySelector("#issue-category")
    : step === "review"
      ? document.querySelector("#review-title")
      : document.querySelector("#confirmation-title");
  heading.focus({ preventScroll: true });
}

function releasePhotoPreview() {
  if (activePhotoUrl) URL.revokeObjectURL(activePhotoUrl);
  activePhotoUrl = null;
  photoPreview.hidden = true;
  previewImage.removeAttribute("src");
  previewName.textContent = "";
  reviewImage.removeAttribute("src");
}

function clearPhotoPreview() {
  releasePhotoPreview();
  photoInput.value = "";
  photoInput.setCustomValidity("");
  photoError.hidden = true;
  photoError.textContent = "";
}

function validatePhoto() {
  const file = photoInput.files && photoInput.files[0];
  releasePhotoPreview();
  photoInput.setCustomValidity("");
  photoError.hidden = true;
  photoError.textContent = "";

  if (!file) return true;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    photoInput.setCustomValidity("Choose a JPG, PNG, or WebP image.");
    photoError.textContent = "Choose a JPG, PNG, or WebP image.";
    photoError.hidden = false;
    return false;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    photoInput.setCustomValidity("Choose an image smaller than 5 MB.");
    photoError.textContent = "This image is larger than 5 MB. Choose a smaller photo.";
    photoError.hidden = false;
    return false;
  }

  if (activePhotoUrl) URL.revokeObjectURL(activePhotoUrl);
  activePhotoUrl = URL.createObjectURL(file);
  previewImage.src = activePhotoUrl;
  previewName.textContent = file.name;
  photoPreview.hidden = false;
  return true;
}

function validateAnalysisResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;

  const validConfidenceLevels = ["low", "medium", "high"];
  const confidenceIsValid = typeof result.confidence === "number"
    ? Number.isFinite(result.confidence) && result.confidence >= 0 && result.confidence <= 1
    : typeof result.confidence === "string" && validConfidenceLevels.includes(result.confidence.toLowerCase());

  const uncertaintiesAreValid = Array.isArray(result.uncertainties) &&
    result.uncertainties.length <= 12 &&
    result.uncertainties.every((item) => typeof item === "string" && item.length <= 300);

  if (!SUPPORTED_CATEGORIES.includes(result.suggested_category)) return null;
  if (!SUPPORTED_DEPARTMENTS.includes(result.suggested_department)) return null;
  if (!["low", "medium", "high", "critical"].includes(result.severity)) return null;
  if (typeof result.reasoning_summary !== "string" || !result.reasoning_summary.trim() || result.reasoning_summary.length > 500) return null;
  if (typeof result.generated_description !== "string" || result.generated_description.length > 1000) return null;
  if (typeof result.needs_human_review !== "boolean" || !confidenceIsValid || !uncertaintiesAreValid) return null;

  const confidenceIsLow = typeof result.confidence === "number"
    ? result.confidence < 0.55
    : result.confidence.toLowerCase() === "low";

  return {
    suggested_category: result.suggested_category,
    suggested_department: result.suggested_department,
    generated_description: result.generated_description.trim(),
    severity: result.severity,
    reasoning_summary: result.reasoning_summary.trim(),
    confidence: result.confidence,
    needs_human_review: result.needs_human_review || confidenceIsLow || result.uncertainties.length > 0,
    uncertainties: result.uncertainties.map((item) => item.trim()).filter(Boolean),
  };
}

async function requestAnalysis() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MAX_ANALYSIS_WAIT_MS);
  const formData = new FormData();
  const selectedPhoto = photoInput.files && photoInput.files[0];

  formData.append("category", document.querySelector("#issue-category").value);
  formData.append("locality", document.querySelector("#locality").value.trim());
  formData.append("description", document.querySelector("#issue-description").value.trim());
  if (selectedPhoto) formData.append("photo", selectedPhoto, selectedPhoto.name);

  try {
    const response = await fetch(ANALYZE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
      signal: controller.signal,
      credentials: "same-origin",
    });
    if (!response.ok) {
      const error = new Error("The analysis service is unavailable.");
      error.code = "service_unavailable";
      throw error;
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      const error = new Error("The analysis service returned invalid data.");
      error.code = "invalid_json";
      throw error;
    }

    const analysis = validateAnalysisResult(payload);
    if (!analysis) {
      const error = new Error("The analysis service returned an unsupported result.");
      error.code = "invalid_response";
      throw error;
    }

    return { source: "gemini", analysis: analysis, failureCode: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

function confidenceLabel(confidence) {
  if (typeof confidence === "number") return Math.round(confidence * 100) + "%";
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

function updateDescriptionSource() {
  const current = reviewFinalDescription.value.trim();
  if (!current) {
    reviewDescriptionSource.textContent = "Description pending. No description was generated.";
  } else if (originalComplaint.citizenDescription) {
    reviewDescriptionSource.textContent = citizenChangedDescription
      ? "Citizen-provided description, edited by the citizen."
      : "Citizen-provided description.";
  } else if (currentAnalysisHasGeneratedDescription()) {
    reviewDescriptionSource.textContent = citizenChangedDescription
      ? "AI-generated draft, edited by the citizen."
      : "AI-generated draft — review and edit before confirming.";
  } else {
    reviewDescriptionSource.textContent = "Citizen-provided during review.";
  }
}

function currentAnalysisHasGeneratedDescription() {
  return Boolean(
    currentAnalysisDraft &&
    currentAnalysisDraft.source === "gemini" &&
    currentAnalysisDraft.analysis.generated_description
  );
}

function recommendedDepartmentForReview() {
  if (currentAnalysisDraft && currentAnalysisDraft.source === "gemini") {
    return currentAnalysisDraft.analysis.suggested_department;
  }
  return departmentByCategory[reviewFinalCategory.value] || "Department recommendation unavailable";
}

function renderReview() {
  const analysis = currentAnalysisDraft && currentAnalysisDraft.source === "gemini"
    ? currentAnalysisDraft.analysis
    : null;
  const initialFinalCategory = analysis ? analysis.suggested_category : originalComplaint.category;
  const initialFinalDescription = originalComplaint.citizenDescription ||
    (analysis ? analysis.generated_description : "");

  document.querySelector("#review-original-category").textContent = originalComplaint.category;
  document.querySelector("#review-suggested-category").textContent = analysis
    ? analysis.suggested_category
    : "Unavailable — original category retained";
  document.querySelector("#review-locality").textContent = originalComplaint.locality;
  const originalDescriptionRow = document.querySelector("#review-original-description-row");
  originalDescriptionRow.hidden = !originalComplaint.citizenDescription;
  document.querySelector("#review-original-description").textContent = originalComplaint.citizenDescription;
  reviewFinalCategory.value = initialFinalCategory;
  reviewFinalDescription.value = initialFinalDescription;
  citizenChangedCategory = false;
  citizenChangedDescription = false;
  reviewCategoryChanged.hidden = true;

  reviewPhotoPanel.hidden = !originalComplaint.photoUrl;
  if (originalComplaint.photoUrl) reviewImage.src = originalComplaint.photoUrl;

  document.querySelector("#review-department").textContent = recommendedDepartmentForReview();
  document.querySelector("#review-department-note").textContent = analysis
    ? "Gemini recommendation only. The responsible jurisdiction has not been verified, and this is not an official assignment."
    : "Category-based fallback suggestion only. Exact jurisdiction has not been verified, and no department has been officially assigned.";

  aiDetailsPanel.hidden = !analysis;
  reviewManualFallback.hidden = Boolean(analysis);
  const needsHumanReview = !analysis || analysis.needs_human_review ||
    (!originalComplaint.citizenDescription && !analysis.generated_description);
  reviewHumanNotice.hidden = !needsHumanReview;

  if (analysis) {
    document.querySelector("#review-severity").textContent = analysis.severity;
    document.querySelector("#review-confidence").textContent = confidenceLabel(analysis.confidence);
    document.querySelector("#review-reasoning").textContent = analysis.reasoning_summary;
    uncertaintyPanel.hidden = analysis.uncertainties.length === 0;
    const uncertaintyList = document.querySelector("#review-uncertainties");
    uncertaintyList.replaceChildren(...analysis.uncertainties.map((item) => createNode("li", "", item)));
  } else {
    uncertaintyPanel.hidden = true;
    document.querySelector("#review-uncertainties").replaceChildren();
  }

  updateDescriptionSource();
  showFormStep("review");
}

function getDescriptionSource(finalDescription, generatedDescription, citizenDescription) {
  if (!finalDescription) return "pending";
  if (citizenDescription) return finalDescription === citizenDescription ? "citizen" : "citizen_edited";
  if (generatedDescription) return finalDescription === generatedDescription ? "gemini" : "citizen_edited_gemini";
  return "citizen_edited";
}

function createReference() {
  const suffix = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return "FM-PROT-" + Date.now().toString(36).toUpperCase() + "-" + suffix.toUpperCase();
}

function savePrototypeComplaint() {
  const finalCategory = reviewFinalCategory.value;
  const finalDescription = reviewFinalDescription.value.trim();
  const citizenDescription = originalComplaint.citizenDescription;
  const analysis = currentAnalysisDraft && currentAnalysisDraft.source === "gemini"
    ? currentAnalysisDraft.analysis
    : null;
  const categoryWasCorrected = finalCategory !== (analysis ? analysis.suggested_category : originalComplaint.category);
  const aiSuggestion = analysis ? {
    suggestedCategory: analysis.suggested_category,
    suggestedDepartment: analysis.suggested_department,
    generatedDescription: analysis.generated_description,
    severity: analysis.severity,
    reasoningSummary: analysis.reasoning_summary,
    confidence: analysis.confidence,
    needsHumanReview: analysis.needs_human_review || (!citizenDescription && !analysis.generated_description),
    uncertainties: analysis.uncertainties,
  } : null;

  const complaint = {
    reference: createReference(),
    category: finalCategory,
    originalCategory: originalComplaint.category,
    suggestedCategory: analysis ? analysis.suggested_category : null,
    finalCategory: finalCategory,
    locality: originalComplaint.locality,
    citizenDescription: citizenDescription,
    generatedDescription: analysis ? analysis.generated_description : "",
    finalDescription: finalDescription,
    description: finalDescription,
    descriptionPending: !finalDescription,
    descriptionSource: getDescriptionSource(finalDescription, analysis ? analysis.generated_description : "", citizenDescription),
    departmentRecommendation: {
      department: analysis ? analysis.suggested_department : (departmentByCategory[finalCategory] || null),
      source: analysis ? "gemini" : "category_fallback",
      officiallyAssigned: false,
    },
    aiSuggestion: aiSuggestion,
    severity: analysis ? analysis.severity : null,
    reasoningSummary: analysis ? analysis.reasoning_summary : "",
    confidence: analysis ? analysis.confidence : null,
    needsHumanReview: !analysis || analysis.needs_human_review || categoryWasCorrected ||
      (!citizenDescription && !finalDescription),
    uncertainties: analysis ? analysis.uncertainties : ["Gemini analysis was unavailable; jurisdiction and classification need human review."],
    analysisStatus: analysis ? "completed" : "unavailable",
    analysisFailureCode: currentAnalysisDraft ? currentAnalysisDraft.failureCode : "unknown",
    photoName: originalComplaint.photoName,
    submittedAt: new Date().toISOString(),
    status: "awaiting_review",
  };

  let persisted = false;
  try {
    const existing = readStoredComplaints().filter((item) => !item.reference.startsWith("SESSION-"));
    existing.push(complaint);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    persisted = true;
  } catch {
    complaint.reference = "SESSION-" + complaint.reference;
    sessionOnlySubmissions.push(complaint);
  }

  document.querySelector("[data-confirmation-reference]").textContent = complaint.reference;
  document.querySelector("[data-confirmation-copy]").textContent = persisted
    ? "Saved in this browser only. This is not a registered government complaint or a department delivery. AI results, if shown above, are recommendations only."
    : "Browser storage is unavailable, so this prototype report is available only for this session. It is not registered or delivered to a government department.";
  clearPhotoPreview();
  complaintForm.reset();
  renderComplaints();
  showFormStep("confirmation");
}

function updateFinalCategoryReview() {
  const originalSuggested = currentAnalysisDraft && currentAnalysisDraft.source === "gemini"
    ? currentAnalysisDraft.analysis.suggested_category
    : originalComplaint.category;
  citizenChangedCategory = reviewFinalCategory.value !== originalSuggested;
  reviewCategoryChanged.hidden = !citizenChangedCategory;

  if (!currentAnalysisDraft || currentAnalysisDraft.source !== "gemini") {
    document.querySelector("#review-department").textContent = recommendedDepartmentForReview();
  }
}

getStartedButton.addEventListener("click", () => showScreen("roles"));

roleChoices.forEach((choice) => {
  choice.addEventListener("click", () => setRole(choice.dataset.roleChoice));
});

screenLinks.forEach((link) => {
  link.addEventListener("click", () => showScreen(link.dataset.screenLink));
});

civilianTabs.forEach((tab) => {
  tab.addEventListener("click", () => showCivilianView(tab.dataset.civilianTab));
});

complaintForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (analysisInProgress) return;
  if (!validatePhoto()) {
    photoInput.reportValidity();
    photoInput.focus();
    return;
  }
  if (!complaintForm.reportValidity()) return;

  originalComplaint = {
    category: document.querySelector("#issue-category").value,
    locality: document.querySelector("#locality").value.trim(),
    citizenDescription: document.querySelector("#issue-description").value.trim(),
    photoFile: photoInput.files && photoInput.files[0] ? photoInput.files[0] : null,
    photoName: photoInput.files && photoInput.files[0] ? photoInput.files[0].name : "",
    photoUrl: activePhotoUrl,
  };

  analysisInProgress = true;
  analyzeButton.disabled = true;
  analysisStatus.hidden = false;
  analysisStatus.textContent = "Checking for a configured Gemini analysis service…";

  try {
    try {
      currentAnalysisDraft = await requestAnalysis();
    } catch (error) {
      currentAnalysisDraft = {
        source: "manual_fallback",
        analysis: null,
        failureCode: error && error.code ? error.code : "api_unavailable",
      };
    }
    renderReview();
  } finally {
    analysisInProgress = false;
    analyzeButton.disabled = false;
    analysisStatus.hidden = true;
    analysisStatus.textContent = "";
  }
});

photoInput.addEventListener("change", validatePhoto);
document.querySelector("#remove-photo").addEventListener("click", clearPhotoPreview);
document.querySelector("[data-edit-complaint]").addEventListener("click", () => showFormStep("entry"));
document.querySelector("[data-confirm-complaint]").addEventListener("click", savePrototypeComplaint);
document.querySelector("[data-open-complaints]").addEventListener("click", () => showCivilianView("complaints"));
document.querySelector("[data-open-report]").addEventListener("click", () => showCivilianView("report"));
reviewFinalCategory.addEventListener("change", updateFinalCategoryReview);
reviewFinalDescription.addEventListener("input", () => {
  citizenChangedDescription = true;
  updateDescriptionSource();
});
document.querySelector("[data-new-complaint]").addEventListener("click", () => {
  complaintForm.reset();
  clearPhotoPreview();
  originalComplaint = null;
  currentAnalysisDraft = null;
  citizenChangedCategory = false;
  citizenChangedDescription = false;
  showFormStep("entry");
});

renderComplaints();
