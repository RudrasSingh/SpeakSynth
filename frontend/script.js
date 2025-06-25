// frontend/script.js

async function getApiKey() {
  try {
    const res = await fetch(
      "https://your-api.onrender.com/speaksynth/api/v1/register",
      {
        method: "POST",
      }
    );
    const data = await res.json();

    if (data.api_key) {
      localStorage.setItem("speaksynth_api_key", data.api_key);
      const el = document.getElementById("keyDisplay");
      el.classList.remove("hidden");
      el.innerText =
        "✅ Your API Key:\n" + data.api_key + "\nSaved to localStorage!";
    } else {
      alert(data.detail || "Could not get API key");
    }
  } catch (err) {
    alert("Error: " + err.message);
  }
}

function getKey() {
  return localStorage.getItem("speaksynth_api_key");
}
