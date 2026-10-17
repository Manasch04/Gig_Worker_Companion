// Gig Worker Companion Client Logic
document.addEventListener("DOMContentLoaded", () => {
  // --- STATE ---
  let currentLanguage = "hinglish";
  let activeSpeech = null;
  let recognition = null;
  let activeMicBtn = null;
  let selectedFile = null;

  // Connected flow state (passes facts across tabs)
  const sharedDisputeState = {
    platform: "",
    partnerId: "",
    orderId: "",
    amount: "",
    reason: "",
    facts: ""
  };

  // --- DOM ELEMENTS ---
  const langSelect = document.getElementById("langSelect");
  const outdoorModeBtn = document.getElementById("outdoorModeBtn");

  // Workflow steps
  const flowStep1 = document.getElementById("flowStep1");
  const flowStep2 = document.getElementById("flowStep2");
  const flowStep3 = document.getElementById("flowStep3");
  const flowStep4 = document.getElementById("flowStep4");

  // Tabs
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  // --- LOCALIZATION & LANGUAGE SWITCHER ---
  function getTimeGreeting() {
    const dict = window.gigTranslations?.[currentLanguage] || window.gigTranslations?.["hinglish"] || {};
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      return dict.greetingMorning || "सुप्रभात! मैं आपका साथी हूँ। आज मैं आपकी क्या मदद करूँ?";
    } else if (hour >= 12 && hour < 17) {
      return dict.greetingAfternoon || "नमस्ते! मैं आपका साथी हूँ। आज आपकी कमाई या कागज़ में क्या मदद करूँ?";
    } else {
      return dict.greetingEvening || "शुभ संध्या! आज की शिफ्ट कैसी रही? कोई परेशानी या हिसाब करना है?";
    }
  }

  function updateTimeGreeting() {
    const greeting = getTimeGreeting();
    const titleEl = document.getElementById("homeGreetingTitle");
    if (titleEl) titleEl.textContent = greeting;
  }

  function applyLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem("preferred_gig_lang", lang);

    const dict = window.gigTranslations?.[lang] || window.gigTranslations?.["hinglish"] || {};

    // Update textContent for elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    // Update placeholders for inputs with data-i18n-ph
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const phKey = el.getAttribute("data-i18n-ph");
      if (dict[phKey]) {
        el.setAttribute("placeholder", dict[phKey]);
      }
    });

    // Update time-based greeting on home hub
    updateTimeGreeting();

    // Update active highlight in native language grid
    document.querySelectorAll(".lang-tile").forEach((tile) => {
      tile.classList.toggle("active-lang", tile.getAttribute("data-lang") === lang);
    });

    // Update Outdoor Sun Mode button label
    const isOutdoor = document.body.classList.contains("outdoor-mode");
    const sunBtnText = outdoorModeBtn?.querySelector(".btn-text");
    if (sunBtnText) {
      sunBtnText.textContent = isOutdoor ? (dict.sunModeNormal || "Normal Mode") : (dict.sunModeText || "Sun Mode");
    }
  }

  // Initial language setup
  const savedLang = localStorage.getItem("preferred_gig_lang") || "hinglish";
  if (langSelect) {
    langSelect.value = savedLang;
    langSelect.addEventListener("change", (e) => {
      applyLanguage(e.target.value);
    });
  }
  applyLanguage(savedLang);

  // Outdoor Sun Mode (High-contrast for motorcycle delivery partners under sun)
  outdoorModeBtn.addEventListener("click", () => {
    document.body.classList.toggle("outdoor-mode");
    const isOutdoor = document.body.classList.contains("outdoor-mode");
    const dict = window.gigTranslations?.[currentLanguage] || {};
    outdoorModeBtn.querySelector(".btn-text").textContent = isOutdoor 
      ? (dict.sunModeNormal || "Normal Mode") 
      : (dict.sunModeText || "Sun Mode");
  });

  initSpeechRecognition();
  enhanceSelectDropdowns();

  // Custom High-Contrast Dropdowns (Eliminates Windows/Chrome native popup bugs)
  function enhanceSelectDropdowns() {
    document.querySelectorAll("select.styled-input").forEach((sel) => {
      if (sel.nextElementSibling && sel.nextElementSibling.classList.contains("custom-select-wrapper")) {
        return;
      }

      sel.style.display = "none";

      const wrapper = document.createElement("div");
      wrapper.className = "custom-select-wrapper";

      const trigger = document.createElement("div");
      trigger.className = "custom-select-trigger";
      const selectedOption = sel.options[sel.selectedIndex] || sel.options[0];
      trigger.innerHTML = `<span class="trigger-text">${selectedOption ? selectedOption.text : ""}</span><span class="custom-select-arrow">▼</span>`;

      const optionsList = document.createElement("div");
      optionsList.className = "custom-select-options";

      function buildOptions() {
        optionsList.innerHTML = "";
        Array.from(sel.options).forEach((opt) => {
          const item = document.createElement("div");
          item.className = "custom-option" + (opt.selected ? " selected" : "");
          item.textContent = opt.text;
          item.setAttribute("data-value", opt.value);

          item.addEventListener("click", (e) => {
            e.stopPropagation();
            sel.value = opt.value;
            trigger.querySelector(".trigger-text").textContent = opt.text;
            optionsList.querySelectorAll(".custom-option").forEach((o) => o.classList.remove("selected"));
            item.classList.add("selected");
            wrapper.classList.remove("open");
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          });

          optionsList.appendChild(item);
        });
      }

      buildOptions();

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".custom-select-wrapper.open").forEach((w) => {
          if (w !== wrapper) w.classList.remove("open");
        });
        wrapper.classList.toggle("open");
      });

      // Synchronize trigger text and options when select value changes programmatically
      sel.addEventListener("change", () => {
        const curOpt = sel.options[sel.selectedIndex];
        if (curOpt) {
          trigger.querySelector(".trigger-text").textContent = curOpt.text;
          optionsList.querySelectorAll(".custom-option").forEach((o) => {
            o.classList.toggle("selected", o.getAttribute("data-value") === sel.value);
          });
        }
      });

      wrapper.appendChild(trigger);
      wrapper.appendChild(optionsList);
      sel.parentNode.insertBefore(wrapper, sel.nextSibling);
    });

    document.addEventListener("click", () => {
      document.querySelectorAll(".custom-select-wrapper.open").forEach((w) => w.classList.remove("open"));
    });
  }

  // Tab Switching
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });

  function switchTab(tabName) {
    document.body.classList.toggle("on-home-tab", tabName === "home");
    stopAllSpeech();

    tabButtons.forEach((b) => {
      const isActive = b.getAttribute("data-tab") === tabName;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", isActive);
    });

    tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${tabName}`);
    });

    // Update workflow step indicator
    if (tabName === "earnings") activateWorkflowStep(1);
    else if (tabName === "document") activateWorkflowStep(2);
    else if (tabName === "grievance") activateWorkflowStep(3);
    else if (tabName === "schemes") activateWorkflowStep(4);
    else activateWorkflowStep(0);
  }

  function activateWorkflowStep(stepNum) {
    [flowStep1, flowStep2, flowStep3, flowStep4].forEach((step, idx) => {
      step.classList.toggle("active", idx + 1 === stepNum);
    });
  }

  // --- GOOGLE-STYLE 5 BIG TOUCH CARDS & NAVIGATION ---
  document.querySelectorAll(".google-touch-card").forEach((card) => {
    card.addEventListener("click", () => {
      const target = card.getAttribute("data-target-tab");
      if (target) {
        switchTab(target);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  // Task back to home buttons (1 Screen = 1 Task guarantee)
  document.querySelectorAll(".task-back-home-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab("home");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // --- FIRST-TOUCH LANGUAGE SHEET (Native Script) ---
  const firstTouchLangModal = document.getElementById("firstTouchLangModal");
  const langNativeGrid = document.getElementById("langNativeGrid");

  function initFirstTouchLanguage() {
    const saved = localStorage.getItem("preferred_gig_lang");
    if (!saved) {
      // Auto-detect browser language
      const navLang = (navigator.language || navigator.userLanguage || "").toLowerCase();
      let detected = "hinglish";
      if (navLang.startsWith("hi")) detected = "hindi";
      else if (navLang.startsWith("pa")) detected = "punjabi";
      else if (navLang.startsWith("mr")) detected = "marathi";
      else if (navLang.startsWith("ta")) detected = "tamil";
      else if (navLang.startsWith("bn")) detected = "bengali";
      else if (navLang.startsWith("en")) detected = "english";

      document.querySelectorAll(".lang-tile").forEach((t) => {
        t.classList.toggle("active-lang", t.getAttribute("data-lang") === detected);
      });

      if (firstTouchLangModal) {
        firstTouchLangModal.classList.remove("hidden");
      }
    }
  }

  // Trigger First-Touch modal check on page load
  initFirstTouchLanguage();

  // Tapping any language tile in the sheet
  if (langNativeGrid) {
    langNativeGrid.querySelectorAll(".lang-tile").forEach((tile) => {
      tile.addEventListener("click", () => {
        const selected = tile.getAttribute("data-lang");
        applyLanguage(selected);
        if (firstTouchLangModal) firstTouchLangModal.classList.add("hidden");
        // Audio is unlocked by this user gesture! Speak greeting immediately!
        setTimeout(() => {
          speakText(getTimeGreeting());
        }, 150);
      });
    });
  }

  // Re-open sheet when clicking language selector or globe icon
  const langDropdownContainer = document.getElementById("langDropdownContainer");
  if (langDropdownContainer) {
    langDropdownContainer.addEventListener("click", (e) => {
      if (e.target.tagName !== "SELECT" && !e.target.closest(".custom-select-options")) {
        if (firstTouchLangModal) firstTouchLangModal.classList.toggle("hidden");
      }
    });
  }

  // Home Greeting Audio Button
  const homePlayGreetingAudio = document.getElementById("homePlayGreetingAudio");
  if (homePlayGreetingAudio) {
    homePlayGreetingAudio.addEventListener("click", () => {
      toggleSpeech(homePlayGreetingAudio, getTimeGreeting());
    });
  }

  // Persistent Floating Saathi Avatar
  const avatarBubbleBtn = document.getElementById("avatarBubbleBtn");
  if (avatarBubbleBtn) {
    avatarBubbleBtn.addEventListener("click", () => {
      switchTab("chat");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => {
        const chatInput = document.getElementById("chatInput");
        if (chatInput) chatInput.focus();
      }, 200);
      toggleSpeech(null, getTimeGreeting());
    });
  }

  // --- SPEECH RECOGNITION (MIC INPUT) ---
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        if (activeMicBtn) activeMicBtn.classList.add("recording");
      };

      recognition.onend = () => {
        if (activeMicBtn) activeMicBtn.classList.remove("recording");
        activeMicBtn = null;
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (activeMicBtn) activeMicBtn.classList.remove("recording");
        activeMicBtn = null;
      };
    }
  }

  function getVoiceLang(lang) {
    switch (lang) {
      case "hindi":
      case "hinglish":
        return "hi-IN";
      case "punjabi":
        return "pa-IN";
      case "marathi":
        return "mr-IN";
      case "tamil":
        return "ta-IN";
      case "bengali":
        return "bn-IN";
      case "english":
      default:
        return "en-IN";
    }
  }

  // Central Big Mic on Home Hub
  const homeBigMicBtn = document.getElementById("homeBigMicBtn");
  if (homeBigMicBtn) {
    homeBigMicBtn.addEventListener("click", () => {
      if (!recognition) {
        alert("Speech Recognition not supported on this browser. You can type or tap any card.");
        return;
      }

      if (activeMicBtn === homeBigMicBtn) {
        recognition.stop();
        return;
      }

      activeMicBtn = homeBigMicBtn;
      homeBigMicBtn.classList.add("recording");
      recognition.lang = getVoiceLang(currentLanguage);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        homeBigMicBtn.classList.remove("recording");
        activeMicBtn = null;

        // Auto-route based on keywords
        const lower = transcript.toLowerCase();
        if (lower.includes("rupay") || lower.includes("kamai") || lower.includes("order") || lower.includes("petrol") || lower.includes("bachat") || /\d+/.test(lower)) {
          switchTab("earnings");
          const noteEl = document.getElementById("earningsNote");
          if (noteEl) noteEl.value = transcript;
          speakText("Maine aapka hisaab note kar liya. Calculation check karein.");
        } else {
          switchTab("chat");
          const chatInput = document.getElementById("chatInput");
          if (chatInput) {
            chatInput.value = transcript;
            const chatForm = document.getElementById("chatForm");
            if (chatForm) chatForm.dispatchEvent(new Event("submit"));
          }
        }
      };

      recognition.onerror = () => {
        homeBigMicBtn.classList.remove("recording");
        activeMicBtn = null;
      };

      recognition.onend = () => {
        homeBigMicBtn.classList.remove("recording");
        activeMicBtn = null;
      };

      recognition.start();
    });
  }

  initFirstTouchLanguage();

  function setupMicButton(btnId, targetInputId) {
    const btn = document.getElementById(btnId);
    const targetInput = document.getElementById(targetInputId);
    if (!btn || !targetInput) return;

    btn.addEventListener("click", () => {
      if (!recognition) {
        alert("Speech Recognition is not supported on this browser. You can type directly in the box.");
        return;
      }

      if (activeMicBtn === btn) {
        recognition.stop();
        return;
      }

      activeMicBtn = btn;
      recognition.lang = getVoiceLang(currentLanguage);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (targetInput.value) {
          targetInput.value += " " + transcript;
        } else {
          targetInput.value = transcript;
        }
      };
      recognition.start();
    });
  }

  setupMicButton("micEarningsBtn", "earningsNote");
  setupMicButton("micGrievanceBtn", "grievanceFacts");
  setupMicButton("micSafetyBtn", "safetySituation");
  setupMicButton("micChatBtn", "chatInput");

  // --- TEXT TO SPEECH (AUDIO PLAYBACK) ---
  // --- ACTION LOADER POPUP MODAL ---
  const actionLoaderModal = document.getElementById("actionLoaderModal");
  const loaderTitle = document.getElementById("loaderTitle");
  const loaderSub = document.getElementById("loaderSub");

  function showActionLoader(title, sub) {
    stopAllSpeech();
    if (loaderTitle) loaderTitle.textContent = title;
    if (loaderSub) loaderSub.textContent = sub;
    if (actionLoaderModal) actionLoaderModal.classList.remove("hidden");
  }

  function hideActionLoader() {
    if (actionLoaderModal) actionLoaderModal.classList.add("hidden");
  }

  // --- TEXT TO SPEECH & VOICE MANAGER (LISTEN / STOP TOGGLE) ---
  let currentSpeakingBtn = null;

  function stopAllSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (currentSpeakingBtn) {
      resetAudioBtnState(currentSpeakingBtn);
      currentSpeakingBtn = null;
    }
  }

  function resetAudioBtnState(btn) {
    if (!btn) return;
    btn.classList.remove("speaking");
    const dict = window.gigTranslations?.[currentLanguage] || window.gigTranslations?.["hinglish"] || {};
    const iconEl = btn.querySelector(".audio-btn-icon");
    const textEl = btn.querySelector(".audio-btn-text");
    if (iconEl) iconEl.textContent = "🔊";
    if (textEl) {
      textEl.textContent = dict.btnListen || "सुनें";
    } else {
      btn.textContent = "🔊 " + (dict.btnListen || "सुनें");
    }
  }

  function toggleSpeech(btn, text) {
    if (!("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported on your browser.");
      return;
    }

    // If currently speaking this same button -> STOP!
    if (btn && currentSpeakingBtn === btn && window.speechSynthesis.speaking) {
      stopAllSpeech();
      return;
    }

    stopAllSpeech();
    if (!text || !text.trim()) return;

    if (btn) {
      currentSpeakingBtn = btn;
      btn.classList.add("speaking");
      const dict = window.gigTranslations?.[currentLanguage] || window.gigTranslations?.["hinglish"] || {};
      const iconEl = btn.querySelector(".audio-btn-icon");
      const textEl = btn.querySelector(".audio-btn-text");
      if (iconEl) iconEl.textContent = "⏹️";
      if (textEl) {
        textEl.textContent = dict.btnStop || "रोकें";
      } else {
        btn.textContent = "⏹️ " + (dict.btnStop || "रोकें");
      }
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.lang = getVoiceLang(currentLanguage);

    utterance.onend = () => {
      if (btn) resetAudioBtnState(btn);
      if (currentSpeakingBtn === btn) currentSpeakingBtn = null;
    };
    utterance.onerror = () => {
      if (btn) resetAudioBtnState(btn);
      if (currentSpeakingBtn === btn) currentSpeakingBtn = null;
    };

    window.speechSynthesis.speak(utterance);
  }

  function speakText(text) {
    toggleSpeech(null, text);
  }

  // =========================================================================
  // 1. EARNINGS & MATH TAB LOGIC
  // =========================================================================
  const earningsForm = document.getElementById("earningsForm");
  const calculateEarningsBtn = document.getElementById("calculateEarningsBtn");
  const earningsEmptyState = document.getElementById("earningsEmptyState");
  const earningsResultData = document.getElementById("earningsResultData");
  const playEarningsAudio = document.getElementById("playEarningsAudio");
  const sendToGrievanceBtn = document.getElementById("sendToGrievanceBtn");

  // Preset Buttons
  document.getElementById("presetZomatoRider").addEventListener("click", () => {
    document.getElementById("workerPlatform").value = "Zomato";
    document.getElementById("grossEarnings").value = "1150";
    document.getElementById("hoursWorked").value = "8.5";
    document.getElementById("fuelExpense").value = "280";
    document.getElementById("platformDeductions").value = "150";
    document.getElementById("earningsNote").value = "Aaj 14 delivery ki. Customer cancellation delay ki wajah se Zomato ne bina notice ₹150 penalty kaat li.";
  });

  document.getElementById("presetUberDriver").addEventListener("click", () => {
    document.getElementById("workerPlatform").value = "Uber";
    document.getElementById("grossEarnings").value = "2100";
    document.getElementById("hoursWorked").value = "10";
    document.getElementById("fuelExpense").value = "650";
    document.getElementById("platformDeductions").value = "300";
    document.getElementById("earningsNote").value = "Airport trip par toll reimbursement nahi mila aur commission 25% se zyada kaat liya.";
  });

  document.getElementById("presetVoiceNote").addEventListener("click", () => {
    document.getElementById("workerPlatform").value = "Swiggy";
    document.getElementById("grossEarnings").value = "890";
    document.getElementById("hoursWorked").value = "7";
    document.getElementById("fuelExpense").value = "210";
    document.getElementById("platformDeductions").value = "120";
    document.getElementById("earningsNote").value = "Barish mein login kiya tha par surge bonus nahi mila, aur ₹120 bag uniform ka cut kar liya.";
  });

  earningsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setButtonLoading(calculateEarningsBtn, true, "Auditing Math & Deductions...");

    const payload = {
      platform: document.getElementById("workerPlatform").value,
      grossEarnings: parseFloat(document.getElementById("grossEarnings").value) || 0,
      hoursWorked: parseFloat(document.getElementById("hoursWorked").value) || 0,
      operatingExpenses: parseFloat(document.getElementById("fuelExpense").value) || 0,
      platformDeductions: parseFloat(document.getElementById("platformDeductions").value) || 0,
      notes: document.getElementById("earningsNote").value,
      language: currentLanguage
    };

    try {
      const res = await fetch("/api/earnings/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.summary) {
        renderEarningsResult(data, payload);
      } else {
        alert("Error: " + (data.error || "Failed to analyze earnings."));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setButtonLoading(calculateEarningsBtn, false, "Verify Calculations & Audit Deductions");
    }
  });

  function renderEarningsResult(data, inputPayload) {
    earningsEmptyState.classList.add("hidden");
    earningsResultData.classList.remove("hidden");

    document.getElementById("resGross").textContent = `₹${data.summary.grossEarnings}`;
    document.getElementById("resExpenses").textContent = `-₹${data.summary.operatingExpenses}`;
    document.getElementById("resDeductions").textContent = `-₹${data.summary.platformDeductions}`;
    document.getElementById("resNet").textContent = `₹${data.summary.netTakeHome}`;
    document.getElementById("resFormula").textContent = data.verifiedFormula || `₹${data.summary.grossEarnings} - ₹${data.summary.operatingExpenses} - ₹${data.summary.platformDeductions} = ₹${data.summary.netTakeHome}`;
    document.getElementById("resHourly").textContent = `₹${data.summary.netHourlyRate} / hr`;

    // Render deduction audit
    const deductionContainer = document.getElementById("resDeductionList");
    deductionContainer.innerHTML = "";
    if (data.deductionAudit && data.deductionAudit.length > 0) {
      data.deductionAudit.forEach((item) => {
        const div = document.createElement("div");
        div.className = "evidence-quote-item";
        div.style.borderLeftColor = item.flagged ? "var(--accent-danger)" : "var(--primary)";
        div.innerHTML = `
          <strong style="color: ${item.flagged ? "var(--accent-danger)" : "var(--primary)"};">
            ${item.flagged ? "⚠️ Disputed / Flagged: " : "✓ Normal: "} ${item.item} (₹${item.amount})
          </strong>
          <p class="quote-meaning">${item.reason}</p>
        `;
        deductionContainer.appendChild(div);
      });
    } else {
      deductionContainer.innerHTML = "<p style='font-size:0.8rem; color:var(--text-muted);'>No deductions flagged.</p>";
    }

    document.getElementById("resExplanation").textContent = data.workerExplanation;
    document.getElementById("resNextStep").textContent = data.actionableNextStep;

    // Setup speech
    playEarningsAudio.onclick = () => speakText(data.workerExplanation);

    // Save state for connected journey
    sharedDisputeState.platform = inputPayload.platform;
    sharedDisputeState.amount = data.summary.platformDeductions;
    sharedDisputeState.reason = data.deductionAudit?.[0]?.reason || "Unfair daily deduction";
    sharedDisputeState.facts = inputPayload.notes;

    // Show connected action
    if (data.summary.platformDeductions > 0) {
      sendToGrievanceBtn.classList.remove("hidden");
    }
  }

  // Connected Flow: Earnings -> Grievance
  sendToGrievanceBtn.addEventListener("click", () => {
    document.getElementById("grievancePlatform").value = sharedDisputeState.platform || "Zomato";
    document.getElementById("grievanceAmount").value = sharedDisputeState.amount || "";
    document.getElementById("grievanceFacts").value = `Shift Note: ${sharedDisputeState.facts}\nDisputed Deduction: ₹${sharedDisputeState.amount}. Audit note: ${sharedDisputeState.reason}`;
    switchTab("grievance");
  });

  // =========================================================================
  // 2. DOCUMENT SCANNER TAB LOGIC
  // =========================================================================
  const docVerifyForm = document.getElementById("docVerifyForm");
  const docFileInput = document.getElementById("docFileInput");
  const previewWrapper = document.getElementById("previewWrapper");
  const imagePreview = document.getElementById("imagePreview");
  const removeImgBtn = document.getElementById("removeImgBtn");
  const docTextInput = document.getElementById("docTextInput");
  const verifyDocBtn = document.getElementById("verifyDocBtn");
  const docEmptyState = document.getElementById("docEmptyState");
  const docResultData = document.getElementById("docResultData");
  const playDocAudio = document.getElementById("playDocAudio");
  const sendDocToGrievanceBtn = document.getElementById("sendDocToGrievanceBtn");

  // Sample Preset Buttons for evaluators
  document.getElementById("presetDocPenalty").addEventListener("click", () => {
    selectedFile = null;
    previewWrapper.classList.add("hidden");
    docTextInput.value = "SMS Alert from Zomato Partner:\nOrder ID #ORD-98214 delayed by 18 mins. Deduction of ₹150 applied under Clause 4.2 Rider Service Penalty. Payout adjusted on 16-Oct-2026. Partner ID: ZOM-77412.";
  });

  document.getElementById("presetDocDeactivation").addEventListener("click", () => {
    selectedFile = null;
    previewWrapper.classList.add("hidden");
    docTextInput.value = "Swiggy Delivery Alert:\nDear Partner SWG-44102, your account has been temporarily suspended due to a customer dispute on Trip #SW-9021. You have 48 hours to explain or account will be permanently deactivated without pending incentive payout.";
  });

  docFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        imagePreview.src = ev.target.result;
        previewWrapper.classList.remove("hidden");
      };
      reader.readAsDataURL(selectedFile);
    }
  });

  removeImgBtn.addEventListener("click", () => {
    selectedFile = null;
    docFileInput.value = "";
    previewWrapper.classList.add("hidden");
    imagePreview.src = "";
  });

  docVerifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setButtonLoading(verifyDocBtn, true, "Reading Document & Extracting Evidence...");

    const formData = new FormData();
    if (selectedFile) {
      formData.append("documentImage", selectedFile);
    }
    formData.append("textContent", docTextInput.value);
    formData.append("language", currentLanguage);

    try {
      const res = await fetch("/api/document/verify", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.platform) {
        renderDocResult(data);
      } else {
        alert("Error: " + (data.error || "Failed to verify document."));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setButtonLoading(verifyDocBtn, false, "Verify Document & Extract Evidence");
    }
  });

  function renderDocResult(data) {
    docEmptyState.classList.add("hidden");
    docResultData.classList.remove("hidden");

    document.getElementById("docPlatform").textContent = data.platform;
    document.getElementById("docType").textContent = data.documentType;
    document.getElementById("docPartnerId").textContent = data.partnerId;
    document.getElementById("docOrderId").textContent = data.orderId;

    // Extracted Verbatim Evidence
    const evidenceList = document.getElementById("docEvidenceList");
    evidenceList.innerHTML = "";
    (data.extractedEvidence || []).forEach((ev) => {
      const div = document.createElement("div");
      div.className = "evidence-quote-item";
      div.innerHTML = `
        <div class="quote-text">"${ev.quote}"</div>
        <div class="quote-meaning"><strong>Verified Meaning:</strong> ${ev.meaning}</div>
      `;
      evidenceList.appendChild(div);
    });

    // Disputed Items
    const disputedList = document.getElementById("docDisputedList");
    disputedList.innerHTML = "";
    (data.disputedItems || []).forEach((item) => {
      const div = document.createElement("div");
      div.className = "evidence-quote-item";
      div.style.borderLeftColor = item.isDisputable ? "var(--accent-amber)" : "var(--primary)";
      div.innerHTML = `
        <strong style="color:${item.isDisputable ? "var(--accent-amber)" : "var(--primary)"};">
          ${item.description} (${item.amount}) ${item.isDisputable ? "— [Disputable Ground]" : "— [Standard]"}
        </strong>
        <p class="quote-meaning">${item.disputeReason}</p>
      `;
      disputedList.appendChild(div);
    });

    document.getElementById("docSimpleExplain").textContent = data.simpleExplanation;
    document.getElementById("docNextAction").textContent = data.nextStepAction;

    playDocAudio.onclick = () => speakText(data.simpleExplanation);

    // Save state for connected journey
    sharedDisputeState.platform = data.platform;
    sharedDisputeState.partnerId = data.partnerId !== "Not specified" ? data.partnerId : "";
    sharedDisputeState.orderId = data.orderId !== "N/A" ? data.orderId : "";
    sharedDisputeState.amount = data.disputedItems?.[0]?.amount?.replace(/[^0-9]/g, "") || "150";
    sharedDisputeState.reason = data.disputedItems?.[0]?.disputeReason || "";
    sharedDisputeState.facts = `Extracted from ${data.documentType}: ${data.extractedEvidence?.[0]?.quote || ""}`;
  }

  // Connected Flow: Document -> Grievance
  sendDocToGrievanceBtn.addEventListener("click", () => {
    document.getElementById("grievancePlatform").value = sharedDisputeState.platform || "";
    document.getElementById("grievancePartnerId").value = sharedDisputeState.partnerId || "";
    document.getElementById("grievanceOrderId").value = sharedDisputeState.orderId || "";
    document.getElementById("grievanceAmount").value = sharedDisputeState.amount || "";
    document.getElementById("grievanceFacts").value = `Document Evidence: ${sharedDisputeState.facts}\nDispute Grounds: ${sharedDisputeState.reason}`;
    switchTab("grievance");
  });

  // =========================================================================
  // 3. GRIEVANCE DRAFTER TAB LOGIC
  // =========================================================================
  const grievanceForm = document.getElementById("grievanceForm");
  const generateGrievanceBtn = document.getElementById("generateGrievanceBtn");
  const grievanceEmptyState = document.getElementById("grievanceEmptyState");
  const grievanceResultData = document.getElementById("grievanceResultData");
  const copyChatTicketBtn = document.getElementById("copyChatTicketBtn");
  const copyFormalLetterBtn = document.getElementById("copyFormalLetterBtn");
  const playGrievanceAudio = document.getElementById("playGrievanceAudio");

  // --- GRIEVANCE CONFIRMATION MODAL & ACTION STEP ---
  const grievanceConfirmModal = document.getElementById("grievanceConfirmModal");
  const btnConfirmGenerate = document.getElementById("btnConfirmGenerate");
  const btnConfirmDismiss = document.getElementById("btnConfirmDismiss");
  let pendingGrievancePayload = null;

  grievanceForm.addEventListener("submit", (e) => {
    e.preventDefault();

    pendingGrievancePayload = {
      platform: document.getElementById("grievancePlatform").value,
      partnerId: document.getElementById("grievancePartnerId").value,
      orderId: document.getElementById("grievanceOrderId").value,
      disputedAmount: document.getElementById("grievanceAmount").value,
      issueType: document.getElementById("grievanceType").value,
      workerStatement: document.getElementById("grievanceFacts").value,
      language: currentLanguage
    };

    // Populate preview confirmation card
    const previewPlatEl = document.getElementById("previewPlatform");
    if (previewPlatEl) previewPlatEl.textContent = pendingGrievancePayload.platform || "Platform";
    const previewPartEl = document.getElementById("previewPartnerId");
    if (previewPartEl) previewPartEl.textContent = pendingGrievancePayload.partnerId || "Self-reported";
    const previewAmtEl = document.getElementById("previewAmount");
    if (previewAmtEl) previewAmtEl.textContent = pendingGrievancePayload.disputedAmount ? `₹${pendingGrievancePayload.disputedAmount}` : "None";
    const previewFactsEl = document.getElementById("previewFacts");
    if (previewFactsEl) previewFactsEl.textContent = pendingGrievancePayload.workerStatement.slice(0, 120) + (pendingGrievancePayload.workerStatement.length > 120 ? "..." : "");

    // Show Confirmation Modal
    if (grievanceConfirmModal) {
      grievanceConfirmModal.classList.remove("hidden");
    } else {
      executeGrievanceDraft();
    }
  });

  if (btnConfirmDismiss) {
    btnConfirmDismiss.addEventListener("click", () => {
      if (grievanceConfirmModal) grievanceConfirmModal.classList.add("hidden");
      document.getElementById("grievanceFacts").focus();
    });
  }

  if (btnConfirmGenerate) {
    btnConfirmGenerate.addEventListener("click", () => {
      if (grievanceConfirmModal) grievanceConfirmModal.classList.add("hidden");
      executeGrievanceDraft();
    });
  }

  async function executeGrievanceDraft() {
    if (!pendingGrievancePayload) return;
    setButtonLoading(generateGrievanceBtn, true, "Drafting Legally-Grounded Letter...");

    try {
      const res = await fetch("/api/grievance/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingGrievancePayload)
      });
      const data = await res.json();

      if (res.ok && data.formalLetter) {
        renderGrievanceResult(data);
      } else {
        alert("Error: " + (data.error || "Failed to draft grievance."));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setButtonLoading(generateGrievanceBtn, false, "Generate Legally-Grounded Grievance Letter");
    }
  }

  function renderGrievanceResult(data) {
    grievanceEmptyState.classList.add("hidden");
    grievanceResultData.classList.remove("hidden");

    document.getElementById("grievanceWorkerSummary").textContent = data.workerSummaryInNativeLang;
    document.getElementById("grievanceShortTicket").value = data.shortAppTicket;
    document.getElementById("grievanceSubject").textContent = data.subjectLine || "Formal Dispute Letter";
    document.getElementById("grievanceFullLetter").value = data.formalLetter;

    const checklistUl = document.getElementById("grievanceChecklist");
    checklistUl.innerHTML = "";
    (data.evidenceChecklist || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      checklistUl.appendChild(li);
    });

    playGrievanceAudio.onclick = () => speakText(data.workerSummaryInNativeLang);

    copyChatTicketBtn.onclick = () => {
      navigator.clipboard.writeText(document.getElementById("grievanceShortTicket").value);
      copyChatTicketBtn.textContent = "✓ Copied!";
      setTimeout(() => (copyChatTicketBtn.textContent = "📋 Copy"), 2000);
    };

    copyFormalLetterBtn.onclick = () => {
      navigator.clipboard.writeText(document.getElementById("grievanceFullLetter").value);
      copyFormalLetterBtn.textContent = "✓ Copied!";
      setTimeout(() => (copyFormalLetterBtn.textContent = "📋 Copy Full Letter"), 2000);
    };

    // WhatsApp Sharing Actions
    const shareChatWhatsAppBtn = document.getElementById("shareChatWhatsAppBtn");
    if (shareChatWhatsAppBtn) {
      shareChatWhatsAppBtn.onclick = () => {
        const text = encodeURIComponent(`*Dispute Ticket - ${data.platform || "Platform"}*\n\n${data.shortAppTicket}`);
        window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
      };
    }

    const shareFormalWhatsAppBtn = document.getElementById("shareFormalWhatsAppBtn");
    if (shareFormalWhatsAppBtn) {
      shareFormalWhatsAppBtn.onclick = () => {
        const text = encodeURIComponent(`*Formal Dispute Grievance*\n\n${data.formalLetter}`);
        window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
      };
    }
  }

  // =========================================================================
  // 4. WELFARE SCHEMES TAB LOGIC
  // =========================================================================
  const schemesForm = document.getElementById("schemesForm");
  const checkSchemesBtn = document.getElementById("checkSchemesBtn");
  const schemesEmptyState = document.getElementById("schemesEmptyState");
  const schemesResultData = document.getElementById("schemesResultData");
  const playSchemesAudio = document.getElementById("playSchemesAudio");

  schemesForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setButtonLoading(checkSchemesBtn, true, "Checking Verified Portals & Acts...");

    const payload = {
      age: parseInt(document.getElementById("workerAge").value) || 30,
      state: document.getElementById("workerState").value,
      workType: document.getElementById("workerWorkType").value,
      monthlyIncome: parseInt(document.getElementById("workerMonthlyIncome").value) || 15000,
      hasEpfo: document.getElementById("hasEpfo").checked,
      language: currentLanguage
    };

    try {
      const res = await fetch("/api/schemes/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.matchedSchemes) {
        renderSchemesResult(data);
      } else {
        alert("Error: " + (data.error || "Failed to check schemes."));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setButtonLoading(checkSchemesBtn, false, "Check Verified Scheme Eligibility & Documents");
    }
  });

  function renderSchemesResult(data) {
    schemesEmptyState.classList.add("hidden");
    schemesResultData.classList.remove("hidden");

    document.getElementById("schemesGuidanceText").textContent = data.simpleGuidance;
    playSchemesAudio.onclick = () => speakText(data.simpleGuidance);

    const container = document.getElementById("schemesList");
    container.innerHTML = "";

    (data.matchedSchemes || []).forEach((scheme) => {
      const card = document.createElement("div");
      card.className = "scheme-card";
      card.innerHTML = `
        <div class="scheme-top">
          <h4 class="scheme-title">${scheme.schemeName}</h4>
          <span class="badge verified" style="font-size:0.7rem;">${scheme.status}</span>
        </div>
        <p class="scheme-benefit">${scheme.benefitSummary}</p>
        <div class="scheme-meta">
          <span>🏛️ Helpline: <strong>${scheme.helpline}</strong></span>
          <span>🔗 Portal: <a href="${scheme.officialUrl}" target="_blank" rel="noopener">${scheme.officialUrl}</a></span>
        </div>
        <div class="scheme-docs-list">
          <strong>Required Documents:</strong> ${scheme.requiredDocuments ? scheme.requiredDocuments.join(", ") : "Aadhaar Card, Bank Account"}
        </div>
      `;
      container.appendChild(card);
    });
  }

  // =========================================================================
  // 5. SAFETY & SOS TAB LOGIC
  // =========================================================================
  const safetyForm = document.getElementById("safetyForm");
  const getSafetyBtn = document.getElementById("getSafetyBtn");
  const safetyEmptyState = document.getElementById("safetyEmptyState");
  const safetyResultData = document.getElementById("safetyResultData");
  const playSafetyAudio = document.getElementById("playSafetyAudio");

  document.getElementById("presetAccident").addEventListener("click", () => {
    document.getElementById("safetySituation").value = "Bike ka chhota accident ho gaya delivery ke waqt. Ghutne mein chot lagi hai aur gaadi gir gayi hai.";
  });
  document.getElementById("presetHarassment").addEventListener("click", () => {
    document.getElementById("safetySituation").value = "Customer order lene ke baad gaali-galoch kar raha hai aur pay karne se mana kar raha hai. Main unke ghar ke bahar khada hoon.";
  });
  document.getElementById("presetHeatwave").addEventListener("click", () => {
    document.getElementById("safetySituation").value = "Dopehar ke 2 baje 44 degree dhoop mein chakar aa rahe hain aur sir mein bohot dard ho raha hai.";
  });

  safetyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setButtonLoading(getSafetyBtn, true, "Activating Emergency Guidance...");

    const payload = {
      situation: document.getElementById("safetySituation").value,
      language: currentLanguage
    };

    try {
      const res = await fetch("/api/safety/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.immediateAction) {
        renderSafetyResult(data);
      } else {
        alert("Error: " + (data.error || "Failed to fetch safety guidance."));
      }
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setButtonLoading(getSafetyBtn, false, "Get Immediate Action Checklist & Support");
    }
  });

  function renderSafetyResult(data) {
    safetyEmptyState.classList.add("hidden");
    safetyResultData.classList.remove("hidden");

    document.getElementById("safetyEmergencyNumber").textContent = data.primaryEmergencyNumber || "112";
    document.getElementById("safetyServiceName").textContent = data.emergencyServiceName || "National Emergency";
    document.getElementById("safetyCallLink").href = `tel:${data.primaryEmergencyNumber || "112"}`;

    const stepsList = document.getElementById("safetyStepsList");
    stepsList.innerHTML = "";
    (data.immediateAction || []).forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      stepsList.appendChild(li);
    });

    document.getElementById("safetyProtectionTip").textContent = data.platformProtectionTip;
    document.getElementById("safetyAdvice").textContent = data.reassuringAdvice;

    playSafetyAudio.onclick = () => speakText(data.reassuringAdvice);
  }

  // =========================================================================
  // 6. VOICE COMPANION CHAT TAB LOGIC
  // =========================================================================
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatMessages = document.getElementById("chatMessages");
  const chatHistory = [];

  // Quick Prompt Chips
  document.querySelectorAll(".prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chatInput.value = chip.getAttribute("data-query");
      chatForm.dispatchEvent(new Event("submit"));
    });
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    appendChatMessage("user", message);
    chatInput.value = "";

    const loadingId = appendChatMessage("bot", "साथी सोच रहा है...");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: chatHistory,
          language: currentLanguage
        })
      });
      const data = await res.json();

      removeChatMessage(loadingId);
      if (res.ok && data.reply) {
        appendChatMessage("bot", data.reply, true);
        chatHistory.push({ role: "user", content: message });
        chatHistory.push({ role: "assistant", content: data.reply });
      } else {
        appendChatMessage("bot", "माफ कीजिए, संपर्क नहीं हो पाया। " + (data.error || ""));
      }
    } catch (err) {
      removeChatMessage(loadingId);
      appendChatMessage("bot", "Network error: " + err.message);
    }
  });

  function appendChatMessage(sender, text, enableAudio = false) {
    const msgId = "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
    const div = document.createElement("div");
    div.className = `chat-message ${sender}`;
    div.id = msgId;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    div.innerHTML = `
      <div class="message-bubble">
        <p>${text}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.35rem;">
          <span class="msg-time">${timeStr}</span>
          ${enableAudio ? `<button type="button" class="audio-btn" style="padding:0.15rem 0.5rem; font-size:0.7rem;">🔊</button>` : ""}
        </div>
      </div>
    `;

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (enableAudio) {
      const audioBtn = div.querySelector(".audio-btn");
      if (audioBtn) {
        audioBtn.innerHTML = '<span class="audio-btn-icon">🔊</span>';
        audioBtn.onclick = () => toggleSpeech(audioBtn, text);
      }
    }

    return msgId;
  }

  function removeChatMessage(msgId) {
    const el = document.getElementById(msgId);
    if (el) el.remove();
  }

  // --- HELPER FUNCTIONS ---
  function setButtonLoading(btn, isLoading, text) {
    btn.disabled = isLoading;
    btn.querySelector("span").textContent = text;
    if (isLoading) {
      btn.style.opacity = "0.7";
    } else {
      btn.style.opacity = "1";
    }
  }
});
