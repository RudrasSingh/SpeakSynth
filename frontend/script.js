// API Base URL - used across all pages
const API_BASE_URL = "https://speaksynth.onrender.com";

// Mobile menu toggle - shared across all pages
document.addEventListener("DOMContentLoaded", function () {
  const menuToggle = document.getElementById("menuToggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", function () {
      const mobileMenu = document.getElementById("mobileMenu");
      if (mobileMenu) {
        mobileMenu.classList.toggle("hidden");
      }
    });
  }
});

/**
 * Show status message with optional type for styling
 * @param {string} message - The message to display
 * @param {string} type - "success", "error", or "info"
 */
function showStatus(message, type = "success") {
  const statusMessage = document.getElementById("statusMessage");
  if (!statusMessage) return;

  // Remove existing classes
  statusMessage.classList.remove(
    "bg-green-50",
    "text-green-700",
    "border-green-200"
  );
  statusMessage.classList.remove("bg-red-50", "text-red-700", "border-red-200");
  statusMessage.classList.remove(
    "bg-blue-50",
    "text-blue-700",
    "border-blue-200"
  );

  // Add classes based on type
  if (type === "error") {
    statusMessage.classList.add("bg-red-50", "text-red-700", "border-red-200");
  } else if (type === "info") {
    statusMessage.classList.add(
      "bg-blue-50",
      "text-blue-700",
      "border-blue-200"
    );
  } else {
    // Success is default
    statusMessage.classList.add(
      "bg-green-50",
      "text-green-700",
      "border-green-200"
    );
  }

  // Set message and show
  statusMessage.textContent = message;
  statusMessage.classList.remove("hidden");

  // Hide after 3 seconds
  setTimeout(() => {
    statusMessage.classList.add("hidden");
  }, 3000);
}

/**
 * Generate a consistent browser fingerprint
 * @returns {Promise<string>} A consistent browser identifier
 */
async function getBrowserFingerprint() {
  // Canvas fingerprinting
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const text = "SpeakSynth-Fingerprint";

  // Size and configuration
  canvas.width = 280;
  canvas.height = 60;

  // Fill background
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Text configuration
  ctx.fillStyle = "#666";
  ctx.font = "18px Arial";
  ctx.fillText(text, 10, 30);

  // Add some graphics that render differently on different systems
  ctx.strokeStyle = "#abc";
  ctx.beginPath();
  ctx.moveTo(20, 10);
  ctx.bezierCurveTo(40, 20, 60, 40, 80, 20);
  ctx.stroke();

  // Get the image data as a string
  const dataUrl = canvas.toDataURL();

  // Combine with stable browser properties
  const props = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.pixelDepth,
    navigator.hardwareConcurrency,
    screen.width + "x" + screen.height,
    navigator.platform || "unknown",
    navigator.vendor || "unknown",
  ].join("|");

  // Create a hash of the combined data
  const combinedString = dataUrl + props;

  // Hash the string using SubtleCrypto if available (more secure)
  try {
    const msgBuffer = new TextEncoder().encode(combinedString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    // Fallback to simpler hash if SubtleCrypto not available
    let hash = 0;
    for (let i = 0; i < combinedString.length; i++) {
      hash = (hash << 5) - hash + combinedString.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Generate API key and save it to localStorage
 */
async function generateApiKey() {
  const emailInput = document.getElementById("emailInput");
  const generateKeyBtn = document.getElementById("generateKeyBtn");
  const statusMessage = document.getElementById("statusMessage");

  if (!emailInput || !emailInput.value || !emailInput.value.includes("@")) {
    showStatus("Please enter a valid email address", "error");
    return;
  }

  if (!generateKeyBtn) return;

  const email = emailInput.value.trim();

  generateKeyBtn.disabled = true;
  generateKeyBtn.textContent = "Generating...";

  try {
    // Get browser fingerprint
    const browserId = await getBrowserFingerprint();

    const response = await fetch(`${API_BASE_URL}/speaksynth/api/v1/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        browser_id: browserId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.detail || `API responded with status ${response.status}`
      );
    }

    const data = await response.json();
    console.log("API key response:", data);

    if (data.api_key) {
      // Save API key and email to localStorage
      localStorage.setItem("speaksynth_api_key", data.api_key);
      localStorage.setItem("speaksynth_email", email);

      // Update UI based on page context
      const noApiKeySection = document.getElementById("noApiKeySection");
      const dashboardContent = document.getElementById("dashboardContent");

      if (noApiKeySection && dashboardContent) {
        // We're on the dashboard page
        noApiKeySection.classList.add("hidden");
        dashboardContent.classList.remove("hidden");

        // Display masked API key
        updateApiKeyDisplay(data.api_key);

        // Update email display if available
        const emailDisplay = document.getElementById("emailDisplay");
        if (emailDisplay) {
          emailDisplay.textContent = email;
        }

        // Fetch usage data
        fetchUsageData(data.api_key);
      }

      // Show success message
      showStatus(data.message || "API key generated successfully!");
    } else {
      showStatus(data.detail || "Failed to generate API key", "error");
    }
  } catch (error) {
    console.error("Error generating API key:", error);
    showStatus(
      error.message || "Error connecting to the API. Please try again.",
      "error"
    );
  } finally {
    if (generateKeyBtn) {
      generateKeyBtn.disabled = false;
      generateKeyBtn.textContent = "Generate API Key";
    }
  }
}

/**
 * Fetch usage data for a specific API key
 * @param {string} apiKey - The API key to check usage for
 */
async function fetchUsageData(apiKey) {
  if (!apiKey) return;

  try {
    showStatus("Fetching usage data...", "info");

    const response = await fetch(`${API_BASE_URL}/speaksynth/api/v1/usage`, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    console.log("Usage data:", data);

    if (data) {
      updateUsageDisplay(data.daily_usage, data.daily_limit, data.remaining);
      showStatus("Usage data updated");

      // Update playground usage if we're on that page
      updatePlaygroundUsage(data.daily_usage, data.daily_limit);
    }
  } catch (error) {
    console.error("Error fetching usage data:", error);
    showStatus("Could not fetch usage data", "error");

    // For development: show demo data if API is unavailable
    updateUsageDisplay(12, 50, 38);
  }
}

/**
 * Update usage display in dashboard
 * @param {number} used - Number of API calls used today
 * @param {number} total - Total daily limit
 * @param {number} remaining - Remaining API calls
 */
function updateUsageDisplay(used, total, remaining) {
  const usageValue = document.getElementById("usageValue");
  const remainingValue = document.getElementById("remainingValue");
  const usageCircle = document.getElementById("usageCircle");

  if (!usageValue || !remainingValue || !usageCircle) return;

  // Update numbers
  usageValue.textContent = used;
  remainingValue.textContent = remaining;

  // Update progress circle
  const percentage = (used / total) * 100;
  usageCircle.setAttribute("stroke-dasharray", `${percentage}, 100`);

  // Change color based on usage
  if (percentage > 80) {
    usageCircle.setAttribute("stroke", "#EF4444"); // Red
  } else if (percentage > 50) {
    usageCircle.setAttribute("stroke", "#F59E0B"); // Amber
  } else {
    usageCircle.setAttribute("stroke", "#3B82F6"); // Blue (default)
  }
}

/**
 * Update API key display (masked or unmasked)
 * @param {string} apiKey - The API key to display
 * @param {boolean} mask - Whether to mask the key
 */
function updateApiKeyDisplay(apiKey, mask = true) {
  const apiKeyDisplay = document.getElementById("apiKeyDisplay");
  if (!apiKeyDisplay) return;

  if (mask) {
    // Show first 6 and last 4 characters, mask the rest
    const firstChars = apiKey.substring(0, 6);
    const lastChars = apiKey.substring(apiKey.length - 4);
    const maskedPortion = "•".repeat(apiKey.length - 10);
    apiKeyDisplay.value = `${firstChars}${maskedPortion}${lastChars}`;
  } else {
    apiKeyDisplay.value = apiKey;
  }
}

/**
 * Initialize playground functionality
 */
function initPlayground() {
  // Get DOM elements
  const playgroundText = document.getElementById("playgroundText");
  const charCount = document.getElementById("charCount");
  const resetTextBtn = document.getElementById("resetTextBtn");
  const wavFormatBtn = document.getElementById("wavFormatBtn");
  const opusFormatBtn = document.getElementById("opusFormatBtn");
  const synthesizePlaygroundBtn = document.getElementById(
    "synthesizePlaygroundBtn"
  );
  const apiKeyWarning = document.getElementById("apiKeyWarning");
  const initialState = document.getElementById("initialState");
  const loadingState = document.getElementById("loadingState");
  const playerState = document.getElementById("playerState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const tryAgainBtn = document.getElementById("tryAgainBtn");
  const playgroundAudio = document.getElementById("playgroundAudio");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  const progressBar = document.getElementById("progressBar");
  const audioDuration = document.getElementById("audioDuration");
  const currentTime = document.getElementById("currentTime");
  const usageBar = document.getElementById("usageBar");
  const usageCount = document.getElementById("usageCount");

  // Variables to track state
  let audioFormat = 1; // 1 = WAV, 2 = OPUS
  let audioBlob = null;

  // Check for API key
  const apiKey = localStorage.getItem("speaksynth_api_key");
  if (!apiKey) {
    // Show API key warning
    apiKeyWarning.classList.remove("hidden");
    synthesizePlaygroundBtn.disabled = true;
    synthesizePlaygroundBtn.classList.add("opacity-50", "cursor-not-allowed");
  } else {
    // Fetch usage data
    fetchUsageData(apiKey);
  }

  // Update character count initially
  if (playgroundText) {
    const textLength = playgroundText.value.length;
    if (charCount) charCount.textContent = `${textLength}/500 characters`;
  }

  // Set up event listeners
  if (playgroundText) {
    playgroundText.addEventListener("input", function () {
      const textLength = this.value.length;
      if (charCount) charCount.textContent = `${textLength}/500 characters`;

      // Validate length
      if (textLength > 500) {
        this.value = this.value.substring(0, 500);
        showStatus("Maximum 500 characters allowed", "error");
      }
    });
  }

  if (resetTextBtn) {
    resetTextBtn.addEventListener("click", function () {
      if (playgroundText) {
        playgroundText.value =
          "Experience the future of text-to-speech with SpeakSynth. Our API transforms your words into natural sounding voice instantly.";
        const textLength = playgroundText.value.length;
        if (charCount) charCount.textContent = `${textLength}/500 characters`;
      }
    });
  }

  if (wavFormatBtn && opusFormatBtn) {
    // WAV format button
    wavFormatBtn.addEventListener("click", function () {
      audioFormat = 1;
      this.classList.remove("bg-white", "text-gray-600");
      this.classList.add("bg-blue-500", "text-white");
      opusFormatBtn.classList.remove("bg-blue-500", "text-white");
      opusFormatBtn.classList.add("bg-white", "text-gray-600");
    });

    // OPUS format button
    opusFormatBtn.addEventListener("click", function () {
      audioFormat = 2;
      this.classList.remove("bg-white", "text-gray-600");
      this.classList.add("bg-blue-500", "text-white");
      wavFormatBtn.classList.remove("bg-blue-500", "text-white");
      wavFormatBtn.classList.add("bg-white", "text-gray-600");
    });
  }

  // Synthesize button
  if (synthesizePlaygroundBtn) {
    synthesizePlaygroundBtn.addEventListener("click", async function () {
      if (!apiKey) {
        showStatus("API key required. Please generate one first.", "error");
        return;
      }

      const text = playgroundText.value.trim();
      if (!text) {
        showStatus("Please enter text to synthesize", "error");
        return;
      }

      // Show loading state
      initialState.classList.add("hidden");
      playerState.classList.add("hidden");
      errorState.classList.add("hidden");
      loadingState.classList.remove("hidden");

      try {
        // Synthesize speech
        const response = await fetch(
          `${API_BASE_URL}/speaksynth/api/v1/synthesize`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": apiKey,
            },
            body: JSON.stringify({
              text: text,
              format: audioFormat,
              voice_id: "sabrina", // Currently only one voice available
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }

        // Get audio blob
        audioBlob = await response.blob();

        // Create URL for audio element
        const audioURL = URL.createObjectURL(audioBlob);

        // Update audio element
        playgroundAudio.src = audioURL;
        playgroundAudio.load();

        // Show player state
        loadingState.classList.add("hidden");
        playerState.classList.remove("hidden");

        // Reset player state
        progressBar.style.width = "0%";
        audioDuration.textContent = "00:00";
        currentTime.textContent = "00:00";

        // Set up audio events
        playgroundAudio.onloadedmetadata = function () {
          audioDuration.textContent = formatTime(playgroundAudio.duration);
        };

        playgroundAudio.addEventListener("timeupdate", function () {
          const percent =
            (playgroundAudio.currentTime / playgroundAudio.duration) * 100;
          progressBar.style.width = `${percent}%`;
          currentTime.textContent = formatTime(playgroundAudio.currentTime);
        });

        playgroundAudio.addEventListener("ended", function () {
          playIcon.classList.remove("hidden");
          pauseIcon.classList.add("hidden");
        });

        // Fetch updated usage data after synthesis
        fetchUsageData(apiKey);
      } catch (error) {
        console.error("Error synthesizing speech:", error);

        // Show error state
        loadingState.classList.add("hidden");
        errorState.classList.remove("hidden");
        errorMessage.textContent =
          error.message || "Failed to synthesize speech";
      }
    });
  }

  // Try again button
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener("click", function () {
      errorState.classList.add("hidden");
      initialState.classList.remove("hidden");
    });
  }

  // Play/pause button
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", function () {
      if (!playgroundAudio.src) return;

      if (playgroundAudio.paused) {
        playgroundAudio.play();
        playIcon.classList.add("hidden");
        pauseIcon.classList.remove("hidden");
      } else {
        playgroundAudio.pause();
        playIcon.classList.remove("hidden");
        pauseIcon.classList.add("hidden");
      }
    });
  }
}

/**
 * Update usage display in the playground
 * @param {number} used - Number of API calls used today
 * @param {number} total - Total daily limit
 */
function updatePlaygroundUsage(used, total) {
  const usageBar = document.getElementById("usageBar");
  const usageCount = document.getElementById("usageCount");

  if (!usageBar || !usageCount) return;

  // Update usage bar
  const percentage = (used / total) * 100;
  usageBar.style.width = `${percentage}%`;

  // Update usage count text
  usageCount.textContent = `${used}/${total} requests today`;

  // Change color based on usage
  if (percentage > 80) {
    usageBar.classList.remove("bg-blue-500");
    usageBar.classList.add("bg-red-500");
  } else if (percentage > 50) {
    usageBar.classList.remove("bg-blue-500", "bg-red-500");
    usageBar.classList.add("bg-amber-500");
  } else {
    usageBar.classList.remove("bg-amber-500", "bg-red-500");
    usageBar.classList.add("bg-blue-500");
  }
}

/**
 * Format time in seconds to MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}
