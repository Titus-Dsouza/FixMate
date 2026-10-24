(() => {
  const loginForm = document.querySelector("#official-login-form");
  const officialEmail = document.querySelector("#official-email");
  const officialPassword = document.querySelector("#official-password");
  const departmentSelect = document.querySelector("#official-department");
  const localitySelect = document.querySelector("#official-locality");
  const loginError = document.querySelector("#official-login-error");
  const officialPages = [...document.querySelectorAll("[data-official-page]")];
  const complaintList = document.querySelector("#official-complaint-list");
  const emptyState = document.querySelector("#official-queue-empty");
  const statusFilterButtons = [...document.querySelectorAll("[data-status-filter]")];
  const repairForm = document.querySelector("#repair-evidence-form");
  const repairPhotoInput = document.querySelector("#repair-photo");
  const repairPhotoError = document.querySelector("#repair-photo-error");
  const repairSubmitError = document.querySelector("#repair-submit-error");
  const repairPhotoPreview = document.querySelector("#repair-photo-preview");
  const repairPreviewImage = document.querySelector("#repair-preview-image");
  const repairPreviewName = document.querySelector("#repair-preview-name");
  const MAX_REPAIR_PHOTO_BYTES = 5 * 1024 * 1024;
  const DEMO_DEPARTMENTS = ["Road Department", "Solid Waste Management", "Drainage Department", "Water Supply Department"];
  const DEMO_LOCALITIES = ["Example locality A", "Example locality B", "Example locality C", "Example locality D", "Example locality E"];
  const statusInfo = {
    unresolved: { label: "Unresolved", className: "unresolved" },
    awaiting_review: { label: "Awaiting review", className: "awaiting" },
    awaiting_confirmation: { label: "Awaiting citizen confirmation", className: "awaiting" },
    uncertain: { label: "Validity uncertain", className: "uncertain" },
    confirmed: { label: "Resolved · citizen confirmed", className: "confirmed" },
  };

  function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  // Explicitly fictional records. A deadline exists only when a fixture supplies deadlineAt.
  const sampleComplaints = [
    {
      reference: "FM-DEMO-201", source: "demo", status: "unresolved", category: "Roads & Footpaths",
      locality: "Example locality A", submittedAt: daysAgo(20), deadlineAt: daysAgo(3), severity: "high",
      description: "A sample report describes a damaged footpath surface near a crossing.",
      assignedDepartment: "Road Department", departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false,
    },
    {
      reference: "FM-DEMO-202", source: "demo", status: "awaiting_confirmation", category: "Roads & Footpaths",
      locality: "Example locality A", submittedAt: daysAgo(8), deadlineAt: null, severity: "medium",
      description: "A fictional report describes a loose paving section beside a walkway.",
      assignedDepartment: "Road Department", departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false,
      workProgressNote: "Sample work record: the paving section was reset.", workSubmittedByDemoOfficial: true,
      repairEvidence: { photoName: "Sample evidence filename only", explanation: "Fictional after-repair evidence awaiting citizen confirmation.", submittedAt: daysAgo(1), status: "awaiting_confirmation", previewUrl: null },
    },
    {
      reference: "FM-DEMO-203", source: "demo", status: "confirmed", category: "Roads & Footpaths",
      locality: "Example locality A", submittedAt: daysAgo(42), deadlineAt: daysAgo(28), severity: "low",
      description: "Fictional completed example; confirmation appears only as sample workflow data.",
      assignedDepartment: "Road Department", departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false,
      workProgressNote: "Sample work record: damaged paving was replaced.", workSubmittedByDemoOfficial: true,
      repairEvidence: { photoName: "Sample confirmed evidence filename", explanation: "Demonstration repair evidence.", submittedAt: daysAgo(35), status: "citizen_confirmed", previewUrl: null },
      citizenConfirmedAt: daysAgo(32), resolutionDays: 10,
    },
    {
      reference: "FM-DEMO-204", source: "demo", status: "unresolved", category: "Roads & Footpaths",
      locality: "Example locality B", submittedAt: daysAgo(4), deadlineAt: null, severity: "medium",
      description: "A sample footpath report with no deadline recorded.", assignedDepartment: "Road Department",
      departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false,
    },
    {
      reference: "FM-DEMO-205", source: "demo", status: "awaiting_review", category: "Garbage & Waste",
      locality: "Example locality C", submittedAt: daysAgo(13), deadlineAt: daysAgo(2), severity: "medium",
      description: "A fictional report says waste was left at a shared collection point.", assignedDepartment: "Solid Waste Management",
      departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false,
    },
    {
      reference: "FM-DEMO-206", source: "demo", status: "confirmed", category: "Garbage & Waste",
      locality: "Example locality C", submittedAt: daysAgo(31), deadlineAt: daysAgo(18), severity: "low",
      description: "A completed sample report. Its work history is not attributed to this demo official.", assignedDepartment: "Solid Waste Management",
      departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false, resolutionDays: 9,
    },
    {
      reference: "FM-DEMO-207", source: "demo", status: "uncertain", category: "Drainage & Waterlogging",
      locality: "Example locality D", submittedAt: daysAgo(17), deadlineAt: null, severity: "high",
      description: "A sample report describes water collecting beside a roadside drain.", assignedDepartment: "Drainage Department",
      departmentRecommendation: null, aiSuggestion: null, needsHumanReview: true,
    },
    {
      reference: "FM-DEMO-208", source: "demo", status: "unresolved", category: "Drainage & Waterlogging",
      locality: "Example locality D", submittedAt: daysAgo(12), deadlineAt: daysAgo(1), severity: "medium",
      description: "Fictional drain-maintenance report with a sample deadline.", assignedDepartment: "Drainage Department",
      departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false,
    },
    {
      reference: "FM-DEMO-209", source: "demo", status: "awaiting_confirmation", category: "Water Supply & Leakage",
      locality: "Example locality E", submittedAt: daysAgo(6), deadlineAt: null, severity: "medium",
      description: "A fictional report describes a leak near a public tap.", assignedDepartment: "Water Supply Department",
      departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false,
      workProgressNote: "Sample work record: a connector was replaced.", workSubmittedByDemoOfficial: true,
      repairEvidence: { photoName: "Sample evidence filename only", explanation: "Fictional repair evidence awaiting citizen confirmation.", submittedAt: daysAgo(1), status: "awaiting_confirmation", previewUrl: null },
    },
    {
      reference: "FM-DEMO-210", source: "demo", status: "unresolved", category: "Water Supply & Leakage",
      locality: "Example locality E", submittedAt: daysAgo(24), deadlineAt: daysAgo(8), severity: "high",
      description: "A sample water-supply report without a stored model analysis.", assignedDepartment: "Water Supply Department",
      departmentRecommendation: null, aiSuggestion: null, needsHumanReview: false,
    },
  ];

  let demoWorkspaceOpen = false;
  let selectedDepartment = "";
  let selectedLocality = "";
  let activeStatusFilter = "all";
  let selectedComplaint = null;
  let activeRepairPhotoUrl = null;

  function makeNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function ageInDays(complaint) {
    const submitted = new Date(complaint.submittedAt);
    if (Number.isNaN(submitted.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - submitted.getTime()) / 86400000));
  }

  function isResolved(complaint) {
    return complaint.status === "confirmed";
  }

  function isOpen(complaint) {
    return !isResolved(complaint);
  }

  function isResolvedByDemoOfficial(complaint) {
    if (!isResolved(complaint) || !complaint.workSubmittedByDemoOfficial || !complaint.workProgressNote || !complaint.repairEvidence?.submittedAt || complaint.repairEvidence.status !== "citizen_confirmed" || !complaint.citizenConfirmedAt) return false;
    const evidenceDate = new Date(complaint.repairEvidence.submittedAt);
    const confirmationDate = new Date(complaint.citizenConfirmedAt);
    return !Number.isNaN(evidenceDate.getTime()) && !Number.isNaN(confirmationDate.getTime()) && confirmationDate >= evidenceDate;
  }

  function isOverdue(complaint) {
    if (!isOpen(complaint) || !complaint.deadlineAt) return false;
    const deadline = new Date(complaint.deadlineAt);
    return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
  }

  function getScopedComplaints() {
    if (!demoWorkspaceOpen || !selectedDepartment || !selectedLocality) return [];
    return sampleComplaints.filter((complaint) => complaint.assignedDepartment === selectedDepartment && complaint.locality === selectedLocality);
  }

  function getFilteredComplaints() {
    const scoped = getScopedComplaints();
    if (activeStatusFilter === "unresolved") return scoped.filter((complaint) => isOpen(complaint) && complaint.status !== "awaiting_confirmation");
    if (activeStatusFilter === "awaiting_confirmation") return scoped.filter((complaint) => complaint.status === "awaiting_confirmation");
    if (activeStatusFilter === "resolved") return scoped.filter(isResolved);
    return scoped;
  }

  function descriptionSourceLabel(source, citizenDescription) {
    const labels = {
      citizen: "Citizen-provided",
      citizen_edited: "Citizen-written or edited during review",
      gemini: "Gemini-generated draft, citizen-reviewed",
      citizen_edited_gemini: "Gemini-generated draft, then edited by the citizen",
      pending: "Description pending",
    };
    if (source && labels[source]) return labels[source];
    return citizenDescription ? "Citizen-provided" : "Source not recorded";
  }

  function setOfficialPage(pageName, moveFocus = true) {
    officialPages.forEach((page) => { page.hidden = page.dataset.officialPage !== pageName; });
    if (moveFocus) {
      const heading = pageName === "overview" ? document.querySelector("#official-dashboard-title") : document.querySelector("#official-detail-title");
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function addDefinition(list, label, value) {
    const row = makeNode("div", "official-detail-row");
    row.append(makeNode("dt", "", label), makeNode("dd", "", value || "Not recorded in this sample"));
    list.append(row);
  }

  function renderMetrics() {
    const complaints = getScopedComplaints();
    const values = {
      "#official-metric-assigned": complaints.length,
      "#official-metric-completed": complaints.filter(isResolvedByDemoOfficial).length,
      "#official-metric-unresolved": complaints.filter(isOpen).length,
      "#official-metric-overdue": complaints.filter(isOverdue).length,
    };
    Object.entries(values).forEach(([selector, count]) => { document.querySelector(selector).textContent = String(count); });
  }

  function renderQueue() {
    const scoped = getScopedComplaints();
    const complaints = getFilteredComplaints();
    complaintList.replaceChildren(...complaints.map(createComplaintCard));
    emptyState.hidden = complaints.length > 0;
    if (!complaints.length) {
      emptyState.textContent = scoped.length
        ? "No demonstration complaints match this status in the selected scope. Choose another status filter."
        : "No demonstration complaints match this department and locality. Choose another demo scope.";
    }
  }

  function renderDashboard() {
    document.querySelector("#official-scope-summary").textContent = `${selectedDepartment} · ${selectedLocality} · demonstration records only`;
    renderMetrics();
    renderQueue();
    setOfficialPage("overview", false);
  }

  function getStatusInfo(complaint) {
    return statusInfo[complaint.status] || statusInfo.unresolved;
  }

  function openDurationLabel(complaint) {
    if (complaint.status === "awaiting_review") return "Days awaiting review";
    if (complaint.status === "awaiting_confirmation") return "Days awaiting citizen confirmation";
    if (complaint.status === "uncertain") return "Days open · validity uncertain";
    return "Days unresolved";
  }

  function createComplaintCard(complaint) {
    const status = getStatusInfo(complaint);
    const card = makeNode("article", `official-complaint-card official-card--${status.className}`);
    const top = makeNode("div", "official-card-top");
    top.append(makeNode("span", "official-reference", complaint.reference));
    top.append(makeNode("span", `official-status-badge status-${status.className}`, status.label));
    const button = makeNode("button", "official-card-open");
    button.type = "button";
    button.setAttribute("aria-label", `Open ${complaint.reference}, ${status.label}`);
    button.append(makeNode("h3", "", complaint.category));
    button.append(makeNode("p", "official-card-description", complaint.description));
    button.addEventListener("click", () => openComplaint(complaint.reference));
    const metadata = makeNode("dl", "official-card-metadata");
    const values = [
      ["Locality", complaint.locality],
      ["Submitted", new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(complaint.submittedAt))],
    ];
    if (isOpen(complaint)) values.push([openDurationLabel(complaint), `${ageInDays(complaint)} days`]);
    values.forEach(([label, value]) => {
      const row = makeNode("div", "official-card-metadata-row");
      row.append(makeNode("dt", "", label), makeNode("dd", "", value));
      metadata.append(row);
    });
    card.append(top, makeNode("span", "official-sample-label", "DEMONSTRATION RECORD"), button, metadata);
    if (isOverdue(complaint)) card.append(makeNode("span", "official-overdue-label", `Overdue · deadline ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(complaint.deadlineAt))}`));
    return card;
  }

  function showPhotoPlaceholder() {
    const panel = document.querySelector("#official-photo-panel");
    const photoUrl = selectedComplaint && typeof selectedComplaint.photoUrl === "string" ? selectedComplaint.photoUrl : "";
    if (photoUrl) {
      try {
        const parsed = new URL(photoUrl, window.location.href);
        if (parsed.protocol === "https:" || parsed.origin === window.location.origin) {
          const image = makeNode("img", "official-complaint-photo");
          image.src = parsed.href;
          image.alt = `Uploaded photo for ${selectedComplaint.reference}`;
          panel.replaceChildren(image);
          return;
        }
      } catch { /* Use a non-image placeholder for an invalid photo URL. */ }
    }
    panel.replaceChildren(makeNode("p", "official-no-photo", "No uploaded complaint photo is available in this demonstration record."));
  }

  function renderAiFields(complaint) {
    const fields = document.querySelector("#official-ai-fields");
    fields.replaceChildren();
    const suggestion = complaint.aiSuggestion;
    if (!suggestion) {
      addDefinition(fields, "Gemini analysis", "No model result is stored for this sample record.");
      addDefinition(fields, "Suggested category", "Not available");
      addDefinition(fields, "Suggested department", "Not available");
      addDefinition(fields, "Generated description", "Not available");
      addDefinition(fields, "Severity / confidence", "No AI result available");
      addDefinition(fields, "Uncertainties", "Not available");
    } else {
      addDefinition(fields, "Suggested category", suggestion.suggestedCategory);
      addDefinition(fields, "Suggested department", suggestion.suggestedDepartment);
      addDefinition(fields, "AI-generated description", suggestion.generatedDescription || "No generated description returned");
      addDefinition(fields, "Severity", suggestion.severity);
      addDefinition(fields, "Confidence", typeof suggestion.confidence === "number" ? `${Math.round(suggestion.confidence * 100)}%` : suggestion.confidence);
      addDefinition(fields, "Reasoning summary", suggestion.reasoningSummary);
      addDefinition(fields, "Uncertainties", Array.isArray(suggestion.uncertainties) && suggestion.uncertainties.length ? suggestion.uncertainties.join("; ") : "None recorded");
    }
    const flag = document.querySelector("#official-review-flag");
    flag.hidden = !complaint.needsHumanReview;
    flag.textContent = complaint.needsHumanReview
      ? "Human review flag present in this sample record. It is not evidence of a real Gemini analysis."
      : "No human-review flag is recorded in this demonstration record.";
  }

  function renderExistingEvidence(complaint) {
    const container = document.querySelector("#official-existing-evidence");
    container.replaceChildren();
    const evidence = complaint.repairEvidence;
    container.hidden = !evidence;
    if (!evidence) return;
    container.append(makeNode("span", "official-demo-pill", evidence.status === "citizen_confirmed" ? "CITIZEN CONFIRMED · SAMPLE" : "PENDING CITIZEN CONFIRMATION"));
    container.append(makeNode("p", "", evidence.explanation));
    container.append(makeNode("p", "official-field-hint", `Photo: ${evidence.photoName || "Filename unavailable"} · submitted ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(evidence.submittedAt))}`));
    if (evidence.previewUrl) {
      const image = makeNode("img", "official-submitted-evidence-image");
      image.src = evidence.previewUrl;
      image.alt = "After-repair photo submitted for citizen review";
      container.append(image);
    } else {
      container.append(makeNode("p", "official-no-photo", "No image bytes are available in this sample record."));
    }
  }

  function openComplaint(reference) {
    if (!demoWorkspaceOpen) return;
    const complaint = getScopedComplaints().find((item) => item.reference === reference);
    if (!complaint) return;
    selectedComplaint = complaint;
    document.querySelector("#official-detail-title").textContent = complaint.category;
    document.querySelector("#official-detail-reference").textContent = `${complaint.reference} · Demonstration record`;
    const info = getStatusInfo(complaint);
    const statusPanel = document.querySelector("#official-detail-status");
    statusPanel.className = `official-status-panel official-status--${info.className}`;
    statusPanel.textContent = info.label;
    showPhotoPlaceholder();

    const citizenFields = document.querySelector("#official-citizen-fields");
    citizenFields.replaceChildren();
    addDefinition(citizenFields, "Locality", complaint.locality);
    addDefinition(citizenFields, "Submitted", new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(complaint.submittedAt)));
    addDefinition(citizenFields, "Citizen-selected category", complaint.originalCategory || complaint.category);
    const citizenDescription = typeof complaint.citizenDescription === "string" ? complaint.citizenDescription : complaint.description;
    const aiDescription = complaint.generatedDescription || complaint.aiSuggestion?.generatedDescription;
    addDefinition(citizenFields, "Citizen-provided description", citizenDescription || "No citizen description was provided.");
    addDefinition(citizenFields, "AI-generated description", aiDescription || "No AI-generated description is available for this record.");
    addDefinition(citizenFields, "Final description", complaint.finalDescription ?? complaint.description ?? "No final description is recorded.");
    addDefinition(citizenFields, "Description source", descriptionSourceLabel(complaint.descriptionSource, citizenDescription));
    addDefinition(citizenFields, "Department", complaint.assignedDepartment);
    addDefinition(citizenFields, "Days unresolved", isOpen(complaint) ? `${ageInDays(complaint)} days` : "Not applicable · citizen-confirmed resolved");
    addDefinition(citizenFields, "Deadline", complaint.deadlineAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(complaint.deadlineAt)) : "No deadline recorded");
    renderAiFields(complaint);

    const routingFields = document.querySelector("#official-routing-fields");
    routingFields.replaceChildren();
    addDefinition(routingFields, "AI department recommendation", complaint.departmentRecommendation?.department || "Not provided; no Gemini result is stored");
    addDefinition(routingFields, "Demonstration assignment", `${complaint.assignedDepartment} · sample fixture only`);
    addDefinition(routingFields, "Overdue", isOverdue(complaint) ? "Yes · recorded sample deadline has passed" : complaint.deadlineAt ? "No · recorded sample deadline has not passed" : "No deadline recorded");
    addDefinition(routingFields, "Work progress note", complaint.workProgressNote || "No work note has been recorded.");
    renderExistingEvidence(complaint);
    repairForm.hidden = Boolean(complaint.repairEvidence) || isResolved(complaint);
    repairSubmitError.hidden = true;
    repairForm.reset();
    clearRepairPhoto();
    setOfficialPage("detail");
  }

  function clearRepairPhoto() {
    if (activeRepairPhotoUrl) URL.revokeObjectURL(activeRepairPhotoUrl);
    activeRepairPhotoUrl = null;
    repairPhotoInput.value = "";
    repairPhotoInput.setCustomValidity("");
    repairPhotoPreview.hidden = true;
    repairPreviewImage.removeAttribute("src");
    repairPreviewName.textContent = "";
    repairPhotoError.hidden = true;
    repairPhotoError.textContent = "";
  }

  function validateRepairPhoto() {
    if (activeRepairPhotoUrl) URL.revokeObjectURL(activeRepairPhotoUrl);
    activeRepairPhotoUrl = null;
    repairPhotoInput.setCustomValidity("");
    repairPhotoError.hidden = true;
    repairPhotoError.textContent = "";
    const file = repairPhotoInput.files && repairPhotoInput.files[0];
    if (!file) return false;
    let error = "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) error = "Choose a JPG, PNG, or WebP image.";
    else if (file.size > MAX_REPAIR_PHOTO_BYTES) error = "Choose an image smaller than 5 MB.";
    if (error) {
      repairPhotoInput.setCustomValidity(error);
      repairPhotoError.textContent = error;
      repairPhotoError.hidden = false;
      return false;
    }
    activeRepairPhotoUrl = URL.createObjectURL(file);
    repairPreviewImage.src = activeRepairPhotoUrl;
    repairPreviewName.textContent = file.name;
    repairPhotoPreview.hidden = false;
    return true;
  }

  function submitRepairEvidence(event) {
    event.preventDefault();
    if (!selectedComplaint || !demoWorkspaceOpen || isResolved(selectedComplaint) || selectedComplaint.repairEvidence) return;
    repairSubmitError.hidden = true;
    repairSubmitError.textContent = "";
    const photoValid = validateRepairPhoto();
    const workNote = document.querySelector("#repair-explanation").value.trim();
    if (!photoValid || !workNote) {
      repairSubmitError.textContent = !photoValid ? "Add a valid after-repair photo to continue." : "Add a short work-progress note to continue.";
      repairSubmitError.hidden = false;
      if (!photoValid) repairPhotoInput.reportValidity();
      else document.querySelector("#repair-explanation").focus();
      return;
    }
    const file = repairPhotoInput.files[0];
    const submittedAt = new Date().toISOString();
    selectedComplaint.workProgressNote = workNote;
    selectedComplaint.workSubmittedByDemoOfficial = true;
    selectedComplaint.repairEvidence = { photoName: file.name, explanation: workNote, submittedAt, status: "awaiting_confirmation", previewUrl: activeRepairPhotoUrl };
    selectedComplaint.status = "awaiting_confirmation";
    activeRepairPhotoUrl = null;
    renderExistingEvidence(selectedComplaint);
    repairForm.hidden = true;
    const statusPanel = document.querySelector("#official-detail-status");
    statusPanel.className = "official-status-panel official-status--awaiting";
    statusPanel.textContent = statusInfo.awaiting_confirmation.label;
    renderMetrics();
    renderQueue();
  }

  function populateLocalitySelect() {
    DEMO_LOCALITIES.forEach((locality) => {
      const option = makeNode("option", "", locality);
      option.value = locality;
      localitySelect.append(option);
    });
  }

  function validateDemoSignIn() {
    const email = officialEmail.value.trim();
    const password = officialPassword.value.trim();
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailLooksValid || !password || !DEMO_DEPARTMENTS.includes(departmentSelect.value) || !DEMO_LOCALITIES.includes(localitySelect.value)) {
      loginError.textContent = !emailLooksValid
        ? "Enter a valid demonstration email address."
        : !password
          ? "Enter a demonstration password to continue."
          : !DEMO_DEPARTMENTS.includes(departmentSelect.value)
            ? "Choose a department for the demonstration."
            : "Choose an assigned locality for the demonstration.";
      loginError.hidden = false;
      const target = !emailLooksValid ? officialEmail : !password ? officialPassword : !DEMO_DEPARTMENTS.includes(departmentSelect.value) ? departmentSelect : localitySelect;
      target.focus();
      return false;
    }
    loginError.hidden = true;
    loginError.textContent = "";
    return true;
  }

  populateLocalitySelect();
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateDemoSignIn()) return;
    selectedDepartment = departmentSelect.value;
    selectedLocality = localitySelect.value;
    activeStatusFilter = "all";
    demoWorkspaceOpen = true;
    loginForm.reset();
    renderDashboard();
    window.fixmateShowScreen("official-dashboard");
  });

  document.querySelector("[data-official-back-roles]").addEventListener("click", () => window.fixmateShowScreen("roles"));
  document.querySelector("[data-official-back-dashboard]").addEventListener("click", () => setOfficialPage("overview"));
  document.querySelector("[data-official-sign-out]").addEventListener("click", () => {
    demoWorkspaceOpen = false;
    selectedComplaint = null;
    loginForm.reset();
    window.fixmateShowScreen("roles");
  });
  statusFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeStatusFilter = button.dataset.statusFilter;
      statusFilterButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      renderQueue();
    });
  });
  document.querySelector("#repair-remove-photo").addEventListener("click", clearRepairPhoto);
  repairPhotoInput.addEventListener("change", validateRepairPhoto);
  repairForm.addEventListener("submit", submitRepairEvidence);
})();
