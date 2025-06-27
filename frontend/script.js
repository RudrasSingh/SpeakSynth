// Define API_BASE_URL only if it doesn't already exist
if (typeof window.API_BASE_URL === "undefined") {
  window.API_BASE_URL = "https://speaksynth.onrender.com";
}

/**
 * Multi-server configuration
 */
window.SPEAKSYNTH_SERVERS = [
  "https://speaksynth.onrender.com",
  "https://speaksynth-6ck5.onrender.com",
  "https://speaksynth3.onrender.com",
];

/**
 * Initialize mobile menu toggle functionality
 */
function initMobileMenu() {
  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const nav = document.querySelector("nav");

  // Create overlay for mobile menu
  const overlay = document.createElement("div");
  overlay.className = "mobile-menu-overlay";
  document.body.appendChild(overlay);

  // Make navigation fixed
  if (nav) {
    nav.classList.add("fixed-header");
    document.body.classList.add("fixed-nav");
  }

  if (menuToggle && mobileMenu) {
    // Add fixed-menu class
    mobileMenu.classList.add("fixed-menu");

    menuToggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = !mobileMenu.classList.contains("hidden");

      if (isOpen) {
        // Close menu
        mobileMenu.classList.add("hidden");
        overlay.classList.remove("active");
        document.body.style.overflow = "";
      } else {
        // Open menu
        mobileMenu.classList.remove("hidden");
        overlay.classList.add("active");
        document.body.style.overflow = "hidden"; // Prevent body scrolling
      }
    });

    // Close menu when clicking overlay
    overlay.addEventListener("click", function () {
      mobileMenu.classList.add("hidden");
      overlay.classList.remove("active");
      document.body.style.overflow = "";
    });

    // Close menu when clicking menu items
    const menuItems = mobileMenu.querySelectorAll("a");
    menuItems.forEach((item) => {
      item.addEventListener("click", function () {
        mobileMenu.classList.add("hidden");
        overlay.classList.remove("active");
        document.body.style.overflow = "";
      });
    });
  }

  // Handle documentation sidebar for docs.html
  const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
  const closeSidebar = document.getElementById("closeSidebar");
  const documentationSidebar = document.getElementById("documentationSidebar");

  if (mobileSidebarToggle && documentationSidebar) {
    mobileSidebarToggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      documentationSidebar.classList.remove("hidden");
      overlay.classList.add("active");
      document.body.style.overflow = "hidden"; // Prevent body scrolling
    });
  }

  if (closeSidebar && documentationSidebar) {
    closeSidebar.addEventListener("click", function () {
      documentationSidebar.classList.add("hidden");
      overlay.classList.remove("active");
      document.body.style.overflow = "";
    });
  }

  // Close sidebar when clicking overlay (if sidebar is open)
  overlay.addEventListener("click", function () {
    const sidebar = document.getElementById("documentationSidebar");
    if (sidebar && !sidebar.classList.contains("hidden")) {
      sidebar.classList.add("hidden");
      overlay.classList.remove("active");
      document.body.style.overflow = "";
    }
  });

  console.log("Mobile menu initialized");
}

/**
 * Generate a consistent browser fingerprint
 */
async function getBrowserFingerprint() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const text = "SpeakSynth-Fingerprint";

  canvas.width = 280;
  canvas.height = 60;

  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#666";
  ctx.font = "18px Arial";
  ctx.fillText(text, 10, 30);

  ctx.strokeStyle = "#abc";
  ctx.beginPath();
  ctx.moveTo(20, 10);
  ctx.bezierCurveTo(40, 20, 60, 40, 80, 20);
  ctx.stroke();

  const dataUrl = canvas.toDataURL();

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

  const combinedString = dataUrl + props;

  try {
    const msgBuffer = new TextEncoder().encode(combinedString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < combinedString.length; i++) {
      hash = (hash << 5) - hash + combinedString.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Store API key with server information
 */
function storeApiKey(apiKey, email, serverId = 0) {
  console.log(
    "Storing API key:",
    apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4),
    "on server",
    serverId
  );
  localStorage.setItem("speaksynth_api_key", apiKey);
  localStorage.setItem("speaksynth_email", email);
  localStorage.setItem("speaksynth_server_id", serverId);
}

/**
 * Retrieve API key with logging
 */
function getApiKey() {
  const apiKey = localStorage.getItem("speaksynth_api_key");

  if (apiKey) {
    console.log(
      "Retrieved API key:",
      apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)
    );

    if (apiKey.includes("undefined") || apiKey.includes("null")) {
      console.error("Corrupted API key detected:", apiKey);
      localStorage.removeItem("speaksynth_api_key");
      return null;
    }

    return apiKey;
  } else {
    console.warn("No API key found in localStorage");
    return null;
  }
}

/**
 * Retrieve API server ID
 */
function getApiServerId() {
  const serverId = localStorage.getItem("speaksynth_server_id");
  return serverId !== null ? parseInt(serverId, 10) : 0;
}

/**
 * Get current API base URL based on stored server ID
 */
function getCurrentApiBaseUrl() {
  const serverId = getApiServerId();
  const servers = window.SPEAKSYNTH_SERVERS;

  if (serverId >= 0 && serverId < servers.length) {
    return servers[serverId];
  }

  return servers[0]; // Default to first server
}

/**
 * Switch to next server
 */
function switchToNextServer() {
  const currentServerId = getApiServerId();
  const serverCount = window.SPEAKSYNTH_SERVERS.length;
  const nextServerId = (currentServerId + 1) % serverCount;

  localStorage.setItem("speaksynth_server_id", nextServerId);
  console.log(
    `Switching from server ${currentServerId} to server ${nextServerId}`
  );

  return window.SPEAKSYNTH_SERVERS[nextServerId];
}

/**
 * Clear API key
 */
function clearApiKey() {
  console.log("Clearing stored API key");
  localStorage.removeItem("speaksynth_api_key");
  localStorage.removeItem("speaksynth_email");
}

/**
 * Add a general promise error handler
 */
window.addEventListener("unhandledrejection", function (event) {
  console.warn("Unhandled promise rejection:", event.reason);
});

/**
 * Make authenticated API requests with server fallback
 */
async function makeApiRequest(
  endpoint,
  options = {},
  timeout = 30000,
  retryCount = 0
) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("No API key available");
  }

  options.headers = options.headers || {};
  options.headers["X-API-Key"] = apiKey;

  if (options.method === "POST" && !options.headers["Content-Type"]) {
    options.headers["Content-Type"] = "application/json";
  }

  // Use the server ID stored with the API key
  let baseUrl = getCurrentApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  console.log(`Making ${options.method || "GET"} request to:`, url);

  try {
    // Add timeout to fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    options.signal = controller.signal;

    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorDetail = null;

      try {
        const errorData = await response.json();

        // Handle new error format (object with message)
        if (typeof errorData.detail === "object" && errorData.detail.message) {
          errorMessage = errorData.detail.message;
          errorDetail = errorData.detail;
        } else {
          errorMessage = errorData.detail || errorMessage;
        }
      } catch (e) {
        try {
          errorMessage = await response.text();
        } catch (e2) {
          // Use default message
        }
      }

      console.error("API Error:", errorMessage, errorDetail);

      // Special handling for 401 errors - this means the API key is invalid
      if (response.status === 401) {
        console.warn("401 error - clearing potentially invalid API key");
        clearApiKey();
        throw new Error(errorMessage);
      }

      // Check if it's the synthesize endpoint - switch servers for ANY error on this endpoint
      if (
        endpoint.includes("/synthesize") &&
        retryCount < window.SPEAKSYNTH_SERVERS.length - 1
      ) {
        console.warn(
          `Error on synthesize endpoint: ${errorMessage}, switching to next server`
        );

        // Switch server ID and get new base URL
        switchToNextServer();

        // Show notification about switching servers
        showServerSwitchNotification(
          errorDetail?.error_type || "synthesis_error"
        );

        // Wait a moment to ensure the API is available
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Retry with new server
        return makeApiRequest(endpoint, options, timeout, retryCount + 1);
      }

      // For other endpoints, only switch servers on 5xx errors or specific errors
      else if (
        (response.status >= 500 ||
          (errorDetail?.error_type &&
            (errorDetail.error_type === "gpu_quota_exceeded" ||
              errorDetail.error_type === "server_error" ||
              errorDetail.error_type === "synthesis_error" ||
              errorDetail.error_type === "database_error"))) &&
        retryCount < window.SPEAKSYNTH_SERVERS.length - 1
      ) {
        console.warn(
          `Server error (${errorMessage}), switching to next server`
        );

        // Switch server ID and get new base URL
        switchToNextServer();

        // Show notification
        showServerSwitchNotification(errorDetail?.error_type || "server_error");

        // Wait a moment to ensure the API is available
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Retry with new server
        return makeApiRequest(endpoint, options, timeout, retryCount + 1);
      }

      // Create error object with additional details
      const error = new Error(errorMessage);
      error.status = response.status;
      error.detail = errorDetail;
      throw error;
    }

    return response;
  } catch (error) {
    console.error("Request failed:", error);

    if (error.name === "AbortError") {
      throw new Error("Request timed out after " + timeout / 1000 + " seconds");
    }

    // Switch servers on network errors for any endpoint
    if (retryCount < window.SPEAKSYNTH_SERVERS.length - 1) {
      console.warn("Network/Request error, switching to next server");

      // Switch server ID and get new base URL
      switchToNextServer();

      // Show notification
      showServerSwitchNotification("network_error");

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Retry with new server
      return makeApiRequest(endpoint, options, timeout, retryCount + 1);
    }

    throw error;
  }
}

/**
 * Show status message
 */
function showStatus(message, type = "success") {
  const statusMessage = document.getElementById("statusMessage");
  if (!statusMessage) {
    console.log(`Status: ${message} (${type})`);
    return;
  }

  statusMessage.textContent = message;
  statusMessage.classList.remove("hidden");

  // Reset classes
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

  // Apply appropriate styling
  if (type === "success") {
    statusMessage.classList.add(
      "bg-green-50",
      "text-green-700",
      "border-green-200"
    );
  } else if (type === "error") {
    statusMessage.classList.add("bg-red-50", "text-red-700", "border-red-200");
  } else {
    statusMessage.classList.add(
      "bg-blue-50",
      "text-blue-700",
      "border-blue-200"
    );
  }

  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusMessage.classList.add("hidden");
  }, 5000);
}

/**
 * Fetch usage data from the API with proper error handling
 */
async function fetchUsageData() {
  // Show loading state by default
  const usageLoading = document.getElementById("usageLoading");
  const usageData = document.getElementById("usageData");

  if (usageLoading) {
    console.log("Showing loading indicator");
    usageLoading.classList.remove("hidden");
  }

  if (usageData) {
    usageData.classList.add("hidden");
  }

  try {
    const response = await makeApiRequest("/speaksynth/api/v1/usage");
    const data = await response.json();
    console.log("Usage data received:", data);

    return data;
  } catch (error) {
    console.error("Error fetching usage data:", error);
    throw error;
  }
}

/**
 * Update the usage display with fetched data
 */
function updateUsageDisplay(data) {
  // Hide loading state
  const usageLoading = document.getElementById("usageLoading");
  const usageData = document.getElementById("usageData");

  if (usageLoading) {
    usageLoading.classList.add("hidden");
  }

  if (usageData) {
    usageData.classList.remove("hidden");
  }

  console.log("Updating usage display with:", data);

  // Get the values we need
  const used = data.daily_usage || 0;
  const total = data.daily_limit || 50;
  const remaining = data.remaining || total - used;

  // Update usage numbers
  const usageValue = document.getElementById("usageValue");
  const remainingValue = document.getElementById("remainingValue");
  const usageCircle = document.getElementById("usageCircle");

  if (usageValue) {
    usageValue.textContent = used;
  }

  if (remainingValue) {
    remainingValue.textContent = remaining;
  }

  // Update usage circle
  if (usageCircle) {
    const percentage = Math.min(100, (used / total) * 100);

    // For SVG path dasharray
    if (usageCircle.tagName.toLowerCase() === "path") {
      usageCircle.setAttribute("stroke-dasharray", `${percentage}, 100`);

      // Change color based on usage
      if (percentage > 80) {
        usageCircle.setAttribute("stroke", "#EF4444"); // Red
      } else if (percentage > 50) {
        usageCircle.setAttribute("stroke", "#F59E0B"); // Amber
      } else {
        usageCircle.setAttribute("stroke", "#3B82F6"); // Blue
      }
    }
    // For elements using style property
    else {
      usageCircle.style.strokeDasharray = `${percentage}, 100`;
    }
  }

  // Update date
  const usageDate = document.getElementById("usageDate");
  if (usageDate && data.date) {
    const dateObj = new Date(data.date);
    usageDate.textContent = dateObj.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  console.log("Usage display updated successfully");
}

// Remove or comment out the duplicate updateUsageDisplay function
// function updateUsageDisplay(used, total, remaining) { ... }

/**
 * Update usage display in the playground
 */
function updatePlaygroundUsage(used, total) {
  const usageBar = document.getElementById("usageBar");
  const usageCount = document.getElementById("usageCount");

  if (usageBar) {
    const percentage = (used / total) * 100;
    usageBar.style.width = `${percentage}%`;

    // Change color based on usage
    usageBar.classList.remove("bg-blue-500", "bg-amber-500", "bg-red-500");
    if (percentage > 80) {
      usageBar.classList.add("bg-red-500");
    } else if (percentage > 50) {
      usageBar.classList.add("bg-amber-500");
    } else {
      usageBar.classList.add("bg-blue-500");
    }
  }

  if (usageCount) {
    usageCount.textContent = `${used}/${total} requests today`;
  }
}

/**
 * Update API key display (masked or unmasked)
 */
function updateApiKeyDisplay(apiKey, mask = true) {
  const apiKeyDisplay = document.getElementById("apiKeyDisplay");
  if (!apiKeyDisplay || !apiKey) return;

  if (mask && apiKey.length > 8) {
    const firstFour = apiKey.substring(0, 4);
    const lastFour = apiKey.substring(apiKey.length - 4);
    apiKeyDisplay.value = `${firstFour}${"•".repeat(
      apiKey.length - 8
    )}${lastFour}`;
  } else {
    apiKeyDisplay.value = apiKey;
  }
}

/**
 * Format time in seconds to MM:SS format
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initMobileMenu();
});

/**
 * Initialize API base URL
 */
window.API_BASE_URL = getCurrentApiBaseUrl();
console.log(`Using API endpoint: ${window.API_BASE_URL}`);

/**
 * Show server switch notification with error type information
 */
function showServerSwitchNotification(errorType = "unknown_error") {
  const serverId = getApiServerId();
  const notification = document.createElement("div");
  notification.id = "serverSwitchNotification";
  notification.className =
    "fixed bottom-4 right-4 bg-amber-50 border-l-4 border-amber-500 text-amber-800 p-4 rounded-lg shadow-lg z-50 animate__animated animate__fadeIn";

  // Create custom message based on error type
  let errorMessage =
    "Switching to backup server due to API error. Please wait...";
  if (errorType === "gpu_quota_exceeded") {
    errorMessage =
      "Server GPU resources are at capacity. Switching to alternate server...";
  } else if (errorType === "synthesis_error") {
    errorMessage = "Speech synthesis failed. Trying alternate server...";
  } else if (errorType === "network_error") {
    errorMessage = "Network connection issue. Switching to alternate server...";
  } else if (errorType === "server_error") {
    errorMessage = "Server error detected. Switching to alternate server...";
  }

  notification.innerHTML = `
    <div class="flex items-start">
      <div class="flex-shrink-0 mt-0.5">
        <svg class="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
        </svg>
      </div>
      <div class="ml-3">
        <p class="text-sm font-medium">
          ${errorMessage}
        </p>
        <p class="mt-1 text-xs text-amber-700">
          Server ${serverId + 1} of ${window.SPEAKSYNTH_SERVERS.length}
        </p>
      </div>
      <button class="ml-4 text-amber-600 hover:text-amber-800" onclick="document.getElementById('serverSwitchNotification').remove()">
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  `;

  // Remove existing notification if present
  const existingNotification = document.getElementById(
    "serverSwitchNotification"
  );
  if (existingNotification) {
    existingNotification.remove();
  }

  document.body.appendChild(notification);

  // Auto-hide after 8 seconds
  setTimeout(() => {
    const notification = document.getElementById("serverSwitchNotification");
    if (notification) {
      notification.classList.add("animate__fadeOut");
      setTimeout(() => notification.remove(), 1000);
    }
  }, 8000);
}
