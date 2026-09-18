# 🚀 Google Flow Helper (Tampermonkey Userscript)

**Google Flow Helper** is a lightweight, standalone userscript that unlocks limitations in Google Flow.

It dynamically intercepts and patches API configuration responses on the fly using a remote specification, complete with a beautiful RTL (Persian) floating UI.

![Status](https://img.shields.io/badge/Status-Active-success)
![Platform](https://img.shields.io/badge/Platform-Tampermonkey-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 📋 Prerequisites

Before installing, ensure you have a Userscript Manager extension installed in your browser.
* **[Tampermonkey](https://www.tampermonkey.net/)** (Recommended for Chrome, Edge, Safari, Firefox)
* **[Violentmonkey](https://violentmonkey.github.io/)** (Alternative)

---

## 🛠️ Step-by-Step Installation

1. **Install Tampermonkey:** If you haven't already, install the [Tampermonkey extension](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) from your browser's web store.
2. **Open the Dashboard:** Click the Tampermonkey icon in your browser toolbar and select **"Create a new script..."**
3. **Clear the Editor:** Delete any default template code currently in the editor.
4. **Copy the Script:** Open the `google-flow-helper.user.js` file in this repository, copy the **entire** code block.
5. **Paste & Save:** Paste the code into the Tampermonkey editor and press `Ctrl + S` (or `Cmd + S` on Mac) to save.
6. **Activate:** Navigate to [https://flow.google.com](https://flow.google.com) and refresh the page. You should see the floating panel appear in the bottom right corner!


## ⚙️ How It Works (Technical Overview)

1. **Initialization:** The script runs at `document-start` and injects hooks into `XMLHttpRequest.prototype.open` and property getters (`responseText`, `response`).
2. **Targeting:** It identifies requests targeting Google's internal `/_/AiSandboxAngularFrontend/data/batchexecute` endpoint.
3. **Spec Fetching:** Using `GM_xmlhttpRequest` (to bypass CORS restrictions), it fetches a JSON specification from a remote server. This spec defines exactly which array index/flag needs to be flipped to bypass limitations.
4. **Payload Patching:** When the targeted XHR completes, the script parses the response, locates the specific RPC ID (`cPZSdc`), flips the target boolean flag to `true`, recalculates the frame length headers, and passes the modified string back to the Google Flow frontend.
5. **DOM Sync:** State updates are synced to a `data-flow-local-diagnostic` attribute on the `<html>` tag and reflected in the injected UI panel.

---

## 🐛 Troubleshooting

- **Panel not showing up?** Ensure the script is enabled in the Tampermonkey dashboard and that you are on a URL matching `https://flow.google.com/*`.
- **Status says "spec unavailable"?** The remote configuration server (`flow.cfcnode.com`) might be temporarily down. The script will gracefully fail and allow Google Flow to load normally without modifications.
- **CSP (Content Security Policy) Errors in Console?** Tampermonkey's `GM_xmlhttpRequest` and `unsafeWindow` bypass standard browser CORS/CSP limits. If you are using a highly restrictive browser fork, ensure userscript injection is allowed.


