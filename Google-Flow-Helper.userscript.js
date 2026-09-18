// ==UserScript==
// @name         Google Flow Helper
// @namespace    https://github.com/maanimeisam
// @version      1.1
// @description  Unlocks Google Flow limitations by patching API responses based on remote specs.
// @match        https://flow.google.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @connect      flow.cfcnode.com
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const SPEC_URL = "https://flow.cfcnode.com/v1/flow-spec";
  const SPEC_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours caching

  let spec = null;
  let specChecked = false;

  function validateSpec(s) {
    return (
      s &&
      typeof s === "object" &&
      typeof s.path === "string" &&
      s.path.startsWith("/") &&
      typeof s.rpcids === "string" &&
      s.rpcids.length > 0 &&
      typeof s.tag === "string" &&
      s.tag.length > 0 &&
      Number.isInteger(s.flagIndex) &&
      s.flagIndex >= 0 &&
      Number.isInteger(s.minLength) &&
      s.minLength > s.flagIndex
    );
  }

  function patchResponse(text, config) {
    const lines = text.split("\n");
    let originalFlag = null;
    let patchedCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith("[[")) continue;
      let parsed;
      try {
        parsed = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      let patched = false;
      for (const item of parsed) {
        if (
          !Array.isArray(item) ||
          item[0] !== config.tag ||
          item[1] !== config.rpcids
        )
          continue;
        const itemData = JSON.parse(item[2]);
        if (
          !Array.isArray(itemData) ||
          itemData.length < config.minLength ||
          (itemData[config.flagIndex] !== null &&
            typeof itemData[config.flagIndex] !== "boolean")
        ) {
          throw new Error("Unexpected config schema");
        }
        originalFlag = itemData[config.flagIndex];
        itemData[config.flagIndex] = true; // Force flag to true
        patchedCount++;
        item[2] = JSON.stringify(itemData);
        patched = true;
      }
      if (patched) {
        const originalLine = lines[i].replace(/\r$/, "");
        const prevLengthStr = Number(lines[i - 1]);
        const getLength = (str) => new TextEncoder().encode(str).length;
        const getLengthFallback = (str) => str.length;

        const lengthFunc = [getLength, getLengthFallback].find((fn) =>
          [0, 1, 2].includes(prevLengthStr - fn(originalLine)),
        );
        if (!lengthFunc) {
          throw new Error("Unexpected frame length");
        }

        const newLine = JSON.stringify(parsed);
        lines[i - 1] = String(
          prevLengthStr + lengthFunc(newLine) - lengthFunc(originalLine),
        );
        lines[i] = newLine;
      }
    }
    if (patchedCount !== 1) {
      throw new Error("Expected one config response");
    }
    return { body: lines.join("\n"), before: originalFlag };
  }

  const xhrTargets = new WeakMap();
  const xhrPatched = new WeakMap();

  const proto = unsafeWindow.XMLHttpRequest.prototype;
  const originalOpen = proto.open;

  proto.open = function (method, url, ...args) {
    let isTarget = false;
    try {
      const parsedUrl = new URL(url, location.href);
      if (spec) {
        isTarget =
          parsedUrl.origin === location.origin &&
          parsedUrl.pathname === spec.path &&
          parsedUrl.searchParams.get("rpcids") === spec.rpcids;
      } else {
        isTarget =
          parsedUrl.origin === location.origin &&
          parsedUrl.pathname.includes("/data/batchexecute");
      }
    } catch {}
    xhrTargets.set(this, isTarget);
    xhrPatched.delete(this);
    return Reflect.apply(originalOpen, this, [method, url, ...args]);
  };

  function createGetterInterceptor(prop) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
    if (!descriptor?.get || !descriptor.configurable) return;
    Object.defineProperty(proto, prop, {
      ...descriptor,
      get() {
        const originalValue = Reflect.apply(descriptor.get, this, []);
        if (!xhrTargets.get(this) || typeof originalValue !== "string") {
          return originalValue;
        }
        if (!spec) {
          if (this.readyState === 4 && specChecked) {
            return originalValue;
          } else {
            return ""; // Hold response until spec is ready
          }
        }
        if (this.readyState === 3) {
          return ""; // Hold partial responses
        }
        if (this.readyState !== 4) {
          return originalValue;
        }
        if (!xhrPatched.has(this)) {
          try {
            const patched = patchResponse(originalValue, spec);
            xhrPatched.set(this, patched.body);
          } catch (e) {
            console.warn("CFC Flow patch failed:", e);
            xhrPatched.set(this, originalValue);
          }
        }
        return xhrPatched.get(this);
      },
    });
  }

  createGetterInterceptor("responseText");
  createGetterInterceptor("response");

  function fetchSpec() {
    const cached = GM_getValue("specCache", null);
    if (cached && Date.now() - cached.timestamp < SPEC_TTL_MS) {
      specChecked = true;
      if (validateSpec(cached.data)) {
        spec = cached.data;
      }
      return;
    }

    GM_xmlhttpRequest({
      method: "GET",
      url: SPEC_URL,
      onload: function (res) {
        specChecked = true;
        if (res.status >= 200 && res.status < 300) {
          try {
            const parsed = JSON.parse(res.responseText);
            GM_setValue("specCache", { data: parsed, timestamp: Date.now() });
            if (validateSpec(parsed)) {
              spec = parsed;
            }
          } catch {}
        }
      },
      onerror: function () {
        specChecked = true;
      },
    });
  }

  fetchSpec();
})();
