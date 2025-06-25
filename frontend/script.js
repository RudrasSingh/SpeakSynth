// frontend/script.js

const API_BASE_URL = "https://speaksynth.onrender.com";
const SAMPLE_AUDIO_URL = "https://github.com/RudrasSingh/SpeakSynth/raw/63159a1b15a64438d15629349c4076fdb99983a0/speaksynth_output.wav";

// API Key Management
async function getApiKey() {
  try {
    const res = await fetch(
      `${API_BASE_URL}/speaksynth/api/v1/register`,
      {
        method: "POST",
      }
    );
    const data = await res.json();

    if (data.api_key) {
      localStorage.setItem("speaksynth_api_key", data.api_key);
      const el = document.getElementById("keyDisplay");
      if (el) {
        el.classList.remove("hidden");
        el.innerText = "✅ Your API Key:\n" + data.api_key + "\nSaved to localStorage!";
      }
      return data.api_key;
    } else {
      alert(data.detail || "Could not get API key");
      return null;
    }
  } catch (err) {
    console.error("Error getting API key:", err);
    alert("Error: " + err.message);
    return null;
  }
}

function getKey() {
  return localStorage.getItem("speaksynth_api_key");
}

// Text to Speech Synthesis
async function synthesizeSpeech(text, voiceId = "sabrina", format = 1) {
  const apiKey = getKey();
  if (!apiKey) {
    alert("No API key found. Please generate one first.");
    return null;
  }

  try {
    showLoadingState();

    const response = await fetch(`${API_BASE_URL}/speaksynth/api/v1/synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify({
        text: text,
        voice_id: voiceId,
        format: format
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Error: ${response.status}`);
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    
    return audioUrl;
  } catch (error) {
    console.error("Speech synthesis error:", error);
    showErrorState(error.message);
    return null;
  } finally {
    hideLoadingState();
  }
}

// Usage Stats
async function fetchUsageStats() {
  const apiKey = getKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/speaksynth/api/v1/usage`, {
      headers: {
        "X-API-Key": apiKey
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching usage stats:", error);
    return null;
  }
}

// Playground Functionality
function initPlayground() {
  const textarea = document.getElementById('playgroundText');
  const synthesizeBtn = document.getElementById('synthesizePlaygroundBtn');
  const wavFormatBtn = document.getElementById('wavFormatBtn');
  const opusFormatBtn = document.getElementById('opusFormatBtn');
  const resetTextBtn = document.getElementById('resetTextBtn');
  const audioElement = document.getElementById('playgroundAudio');
  const charCount = document.getElementById('charCount');
  
  let currentFormat = 1; // 1 for WAV, 2 for OPUS

  // Check for API key
  const apiKey = getKey();
  if (!apiKey) {
    document.getElementById('apiKeyWarning')?.classList.remove('hidden');
  }

  // Character counter
  function updateCharCount() {
    if (!textarea) return;
    
    const count = textarea.value.length;
    charCount.textContent = `${count}/500 characters`;
    
    if (count > 500) {
      charCount.classList.add('text-red-500');
    } else {
      charCount.classList.remove('text-red-500');
    }
  }
  
  // Initialize events
  if (textarea) {
    textarea.addEventListener('input', updateCharCount);
    updateCharCount(); // Initial count
  }
  
  if (resetTextBtn) {
    resetTextBtn.addEventListener('click', function() {
      textarea.value = '';
      updateCharCount();
    });
  }
  
  // Format switching
  if (wavFormatBtn && opusFormatBtn) {
    wavFormatBtn.addEventListener('click', function() {
      wavFormatBtn.classList.remove('bg-white', 'text-gray-600');
      wavFormatBtn.classList.add('bg-blue-500', 'text-white');
      opusFormatBtn.classList.remove('bg-blue-500', 'text-white');
      opusFormatBtn.classList.add('bg-white', 'text-gray-600');
      currentFormat = 1;
    });
    
    opusFormatBtn.addEventListener('click', function() {
      opusFormatBtn.classList.remove('bg-white', 'text-gray-600');
      opusFormatBtn.classList.add('bg-blue-500', 'text-white');
      wavFormatBtn.classList.remove('bg-blue-500', 'text-white');
      wavFormatBtn.classList.add('bg-white', 'text-gray-600');
      currentFormat = 2;
    });
  }
  
  // Audio player setup
  if (audioElement) {
    setupAudioPlayer();
  }
  
  // Synthesize button
  if (synthesizeBtn) {
    synthesizeBtn.addEventListener('click', async function() {
      if (!textarea || !textarea.value.trim()) return;
      
      const text = textarea.value;
      const voiceModel = document.getElementById('voiceModel')?.value || "sabrina";
      
      if (!getKey()) {
        alert("You need an API key first. Generate one on the insights page.");
        return;
      }
      
      showLoadingState();
      
      try {
        const audioUrl = await synthesizeSpeech(text, voiceModel, currentFormat);
        if (audioUrl) {
          playAudio(audioUrl);
          updateUsageDisplay();
        }
      } catch (error) {
        showErrorState(error.message);
      }
    });
  }

  // Try again button
  const tryAgainBtn = document.getElementById('tryAgainBtn');
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener('click', function() {
      document.getElementById('errorState').classList.add('hidden');
      document.getElementById('initialState').classList.remove('hidden');
    });
  }
  
  // Load sample audio for demo purposes
  const demoPlayBtn = document.getElementById('demoPlayBtn');
  if (demoPlayBtn) {
    demoPlayBtn.addEventListener('click', function() {
      playAudio(SAMPLE_AUDIO_URL);
    });
  }
}

// Audio Player Functions
function setupAudioPlayer() {
  const audioElement = document.getElementById('playgroundAudio');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const progressBar = document.getElementById('progressBar');
  const currentTime = document.getElementById('currentTime');
  
  if (!audioElement || !playPauseBtn) return;
  
  // Play/Pause functionality
  playPauseBtn.addEventListener('click', function() {
    if (audioElement.paused) {
      audioElement.play();
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
    } else {
      audioElement.pause();
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
    }
  });
  
  // Update progress bar and time
  audioElement.addEventListener('timeupdate', function() {
    const percent = (audioElement.currentTime / audioElement.duration) * 100;
    progressBar.style.width = percent + '%';
    
    const mins = Math.floor(audioElement.currentTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(audioElement.currentTime % 60).toString().padStart(2, '0');
    currentTime.textContent = `${mins}:${secs}`;
  });
  
  // Update duration display once audio is loaded
  audioElement.addEventListener('loadedmetadata', function() {
    const duration = audioElement.duration;
    const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
    const seconds = Math.floor(duration % 60).toString().padStart(2, '0');
    
    const durationElement = document.getElementById('audioDuration');
    if (durationElement) {
      durationElement.textContent = `${minutes}:${seconds}`;
    }
  });
  
  // Reset player when audio ends
  audioElement.addEventListener('ended', function() {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    progressBar.style.width = '0%';
    currentTime.textContent = '00:00';
  });
  
  // Make progress bar clickable
  const progressContainer = progressBar.parentElement;
  if (progressContainer) {
    progressContainer.addEventListener('click', function(e) {
      const clickPosition = (e.offsetX / this.offsetWidth);
      audioElement.currentTime = clickPosition * audioElement.duration;
    });
  }
}

function playAudio(audioUrl) {
  const audioElement = document.getElementById('playgroundAudio');
  if (!audioElement) return;
  
  // Hide all states and show player
  document.getElementById('initialState')?.classList.add('hidden');
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('errorState')?.classList.add('hidden');
  document.getElementById('playerState')?.classList.remove('hidden');
  
  // Set audio source and play
  audioElement.src = audioUrl;
  audioElement.load();
  
  // Play after a short delay to ensure loading
  setTimeout(() => {
    audioElement.play()
      .then(() => {
        document.getElementById('playIcon')?.classList.add('hidden');
        document.getElementById('pauseIcon')?.classList.remove('hidden');
      })
      .catch(err => {
        console.error("Audio playback failed:", err);
      });
  }, 300);
}

// UI State Functions
function showLoadingState() {
  document.getElementById('initialState')?.classList.add('hidden');
  document.getElementById('playerState')?.classList.add('hidden');
  document.getElementById('errorState')?.classList.add('hidden');
  document.getElementById('loadingState')?.classList.remove('hidden');
}

function hideLoadingState() {
  document.getElementById('loadingState')?.classList.add('hidden');
}

function showErrorState(message = "An error occurred") {
  document.getElementById('initialState')?.classList.add('hidden');
  document.getElementById('playerState')?.classList.add('hidden');
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('errorState')?.classList.remove('hidden');
  
  const errorMsg = document.getElementById('errorMessage');
  if (errorMsg) {
    errorMsg.textContent = message;
  }
}

async function updateUsageDisplay() {
  try {
    const usageData = await fetchUsageStats();
    
    if (!usageData) return;
    
    const used = usageData.daily_usage || 0;
    const limit = usageData.daily_limit || 50;
    const remaining = usageData.remaining || (limit - used);
    
    // Update usage bar
    const usageBar = document.getElementById('usageBar');
    if (usageBar) {
      const percentage = (used / limit) * 100;
      usageBar.style.width = `${percentage}%`;
      
      // Change color based on usage
      if (percentage > 80) {
        usageBar.classList.add('bg-red-500');
        usageBar.classList.remove('bg-blue-500', 'bg-yellow-500');
      } else if (percentage > 50) {
        usageBar.classList.add('bg-yellow-500');
        usageBar.classList.remove('bg-blue-500', 'bg-red-500');
      } else {
        usageBar.classList.add('bg-blue-500');
        usageBar.classList.remove('bg-yellow-500', 'bg-red-500');
      }
    }
    
    // Update usage counts
    document.getElementById('usageCount')?.textContent = `${used}/${limit} requests today`;
    document.getElementById('usageValue')?.textContent = used;
    document.getElementById('remainingValue')?.textContent = remaining;
    
    // Update usage circle if it exists (on insights page)
    const usageCircle = document.getElementById('usageCircle');
    if (usageCircle) {
      const percentage = (used / limit) * 100;
      usageCircle.setAttribute('stroke-dasharray', `${percentage}, 100`);
      
      if (percentage > 80) {
        usageCircle.setAttribute('stroke', '#EF4444'); // Red
      } else if (percentage > 50) {
        usageCircle.setAttribute('stroke', '#F59E0B'); // Amber
      } else {
        usageCircle.setAttribute('stroke', '#3B82F6'); // Blue
      }
    }
  } catch (error) {
    console.error("Error updating usage display:", error);
  }
}

// Dashboard/Insights Page Functions
function initInsightsPage() {
  const apiKey = getKey();
  const noApiKeySection = document.getElementById('noApiKeySection');
  const dashboardContent = document.getElementById('dashboardContent');
  
  if (apiKey && noApiKeySection && dashboardContent) {
    noApiKeySection.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    updateApiKeyDisplay(apiKey);
    updateUsageDisplay();
  }
  
  // Generate API Key button
  const generateKeyBtn = document.getElementById('generateKeyBtn');
  if (generateKeyBtn) {
    generateKeyBtn.addEventListener('click', async function() {
      this.disabled = true;
      this.textContent = 'Generating...';
      
      const apiKey = await getApiKey();
      
      if (apiKey) {
        noApiKeySection.classList.add('hidden');
        dashboardContent.classList.remove('hidden');
        updateApiKeyDisplay(apiKey);
        updateUsageDisplay();
      } else {
        this.disabled = false;
        this.textContent = 'Generate API Key';
      }
    });
  }
  
  // Copy API key button
  const copyApiKeyBtn = document.getElementById('copyApiKeyBtn');
  if (copyApiKeyBtn) {
    copyApiKeyBtn.addEventListener('click', function() {
      const apiKey = getKey();
      if (apiKey) {
        navigator.clipboard.writeText(apiKey).then(() => {
          const originalText = this.textContent;
          this.textContent = 'Copied!';
          setTimeout(() => {
            this.textContent = originalText;
          }, 2000);
        });
      }
    });
  }
  
  // Show/hide API key
  const showHideKeyBtn = document.getElementById('showHideKeyBtn');
  if (showHideKeyBtn) {
    showHideKeyBtn.addEventListener('click', function() {
      const apiKeyDisplay = document.getElementById('apiKeyDisplay');
      const apiKey = getKey();
      const eyeIcon = document.getElementById('eyeIcon');
      const eyeOffIcon = document.getElementById('eyeOffIcon');
      
      if (apiKeyDisplay.value === apiKey) {
        // Mask the API key
        updateApiKeyDisplay(apiKey, true);
        eyeIcon.classList.add('hidden');
        eyeOffIcon.classList.remove('hidden');
      } else {
        // Show the API key
        apiKeyDisplay.value = apiKey;
        eyeIcon.classList.remove('hidden');
        eyeOffIcon.classList.add('hidden');
      }
    });
  }
  
  // Update date
  const usageDate = document.getElementById('usageDate');
  if (usageDate) {
    usageDate.textContent = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

// Helper Functions
function updateApiKeyDisplay(apiKey, mask = true) {
  const apiKeyDisplay = document.getElementById('apiKeyDisplay');
  if (!apiKeyDisplay) return;
  
  if (mask) {
    // Show first 6 and last 4 characters, mask the rest
    const firstChars = apiKey.substring(0, 6);
    const lastChars = apiKey.substring(apiKey.length - 4);
    const maskedPortion = '•'.repeat(apiKey.length - 10);
    apiKeyDisplay.value = `${firstChars}${maskedPortion}${lastChars}`;
  } else {
    apiKeyDisplay.value = apiKey;
  }
}

// Initialize on document load
document.addEventListener('DOMContentLoaded', function() {
  // Mobile menu toggle
  document.getElementById('menuToggle')?.addEventListener('click', function() {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu?.classList.toggle('hidden');
  });
  
  // Init appropriate page functionality based on URL
  const path = window.location.pathname;
  
  if (path.includes('playground')) {
    initPlayground();
  } else if (path.includes('dashboard') || path.includes('insights')) {
    initInsightsPage();
  }
  
  // Removed: Automatic API key generation on first visit
});