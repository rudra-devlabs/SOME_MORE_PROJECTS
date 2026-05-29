"use strict";

const SAFE_PATH = "/";
const BLOCKED_PATH = /^\/(?:shorts|playables)(?:\/|$)/i;
const BLOCKED_LINK = /(?:^|\/)(?:shorts|playables)(?:\/|$)/i;
const HOME_PATH = /^\/$/;

const blockedText = new Set([
  "shorts",
  "youtube shorts",
  "playables",
  "youtube playables"
]);

const strictHideCss = `
  body.strict-home-block ytd-browse[page-subtype="home"] #contents,
  body.strict-home-block ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,
  body.strict-home-block ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer {
    display: none !important;
  }

  body.strict-home-block {
    background: #0f0f0f !important;
  }

  a[href^="/shorts"],
  a[href^="/playables"],
  a[href*="youtube.com/shorts"],
  a[href*="youtube.com/playables"],
  div#contents.style-scope.ytd-rich-shelf-renderer,
  ytd-reel-shelf-renderer,
  ytd-rich-shelf-renderer[is-shorts],
  ytm-shorts-lockup-view-model {
    display: none !important;
  }
`;

function installStrictCss() {
  if (document.getElementById("strict-shorts-blocker-css")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "strict-shorts-blocker-css";
  style.textContent = strictHideCss;
  (document.head || document.documentElement).appendChild(style);
}

function isBlockedLocation() {
  return BLOCKED_PATH.test(window.location.pathname);
}

function isHomeLocation() {
  return HOME_PATH.test(window.location.pathname) && !window.location.search;
}

function isBlockedHref(href) {
  if (!href) {
    return false;
  }

  try {
    const url = new URL(href, window.location.href);
    return /(^|\.)youtube\.com$/i.test(url.hostname) && BLOCKED_LINK.test(url.pathname);
  } catch {
    return BLOCKED_LINK.test(href);
  }
}

function escapeBlockedPage() {
  if (isBlockedLocation()) {
    window.location.replace(SAFE_PATH);
  }
}

function closestRemovable(node) {
  if (!(node instanceof Element)) {
    return null;
  }

  return node.closest([
    "ytd-rich-section-renderer",
    "ytd-reel-shelf-renderer",
    "ytd-rich-shelf-renderer",
    "ytd-grid-video-renderer",
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytm-shorts-lockup-view-model",
    "ytm-rich-item-renderer",
    "ytm-video-with-context-renderer",
    "a"
  ].join(","));
}

function removeBlockedElement(element) {
  const target = closestRemovable(element);
  if (target) {
    target.remove();
  }
}

function stripBlockedLinks(root = document) {
  if (!root.querySelectorAll) {
    return;
  }

  root.querySelectorAll("a[href]").forEach((link) => {
    if (isBlockedHref(link.getAttribute("href")) || isBlockedHref(link.href)) {
      removeBlockedElement(link);
    }
  });
}

function stripBlockedButtons(root = document) {
  if (!root.querySelectorAll) {
    return;
  }

  root.querySelectorAll("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytm-pivot-bar-item-renderer, a, button").forEach((element) => {
    const label = [
      element.textContent,
      element.getAttribute("title"),
      element.getAttribute("aria-label")
    ].filter(Boolean).join(" ").trim().toLowerCase();

    if (blockedText.has(label) || /\b(shorts|playables)\b/i.test(label)) {
      removeBlockedElement(element);
    }
  });
}

function stripKnownBlockedLinks(root = document) {
  if (!root.querySelectorAll) {
    return;
  }

  root.querySelectorAll("a[href*='/shorts/'], a[href*='/playables']").forEach((link) => {
    if (isBlockedHref(link.href)) {
      removeBlockedElement(link);
    }
  });
}

function stripBlockedShelves(root = document) {
  if (!root.querySelectorAll) {
    return;
  }

  root.querySelectorAll("div#contents.style-scope.ytd-rich-shelf-renderer").forEach((element) => {
    element.remove();
  });
}

function getVisibleSidebarWidth() {
  const sidebar = [
    document.querySelector("ytd-guide-renderer"),
    document.querySelector("ytd-mini-guide-renderer")
  ].find((element) => {
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  });

  return sidebar ? Math.round(sidebar.getBoundingClientRect().right) : 0;
}

function getHomeConcept() {
  const concepts = Array.isArray(window.JEE_CONCEPTS) ? window.JEE_CONCEPTS : [];
  if (concepts.length === 0) {
    return {
      subject: "Focus",
      title: "Watch only things that matter",
      explanation: "Use YouTube with intention. Search for what you need, learn it, then leave.",
      formulas: [],
      sketch: ""
    };
  }

  const index = Math.floor(Math.random() * concepts.length);
  return concepts[index];
}

function appendTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMathExpression(value) {
  return escapeHtml(value)
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\text\{([^{}]+)\}/g, "<span class=\"strict-math-text\">$1</span>")
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "<span class=\"strict-frac\"><span>$1</span><span>$2</span></span>")
    .replace(/\\sqrt\{([^{}]+)\}/g, "<span class=\"strict-root\">&radic;<span>$1</span></span>")
    .replace(/\\sqrt([A-Za-z0-9]+)/g, "<span class=\"strict-root\">&radic;<span>$1</span></span>")
    .replace(/\\alpha/g, "&alpha;")
    .replace(/\\beta/g, "&beta;")
    .replace(/\\gamma/g, "&gamma;")
    .replace(/\\Delta/g, "&Delta;")
    .replace(/\\delta/g, "&delta;")
    .replace(/\\theta/g, "&theta;")
    .replace(/\\lambda/g, "&lambda;")
    .replace(/\\mu/g, "&mu;")
    .replace(/\\omega/g, "&omega;")
    .replace(/\\pi/g, "&pi;")
    .replace(/\\epsilon/g, "&epsilon;")
    .replace(/\\phi/g, "&phi;")
    .replace(/\\nabla/g, "&nabla;")
    .replace(/\\circ/g, "&deg;")
    .replace(/\\pm/g, "&plusmn;")
    .replace(/\\times/g, "&times;")
    .replace(/\\cdot/g, "&middot;")
    .replace(/\\int/g, "&int;")
    .replace(/\\sum/g, "&sum;")
    .replace(/\\lim/g, "lim")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\log/g, "log")
    .replace(/\\ln/g, "ln")
    .replace(/\\cup/g, "&cup;")
    .replace(/\\cap/g, "&cap;")
    .replace(/\\ge/g, "&ge;")
    .replace(/\\le/g, "&le;")
    .replace(/\\ne/g, "&ne;")
    .replace(/\\Rightarrow/g, "&rArr;")
    .replace(/\\nRightarrow/g, "&#8655;")
    .replace(/\\to/g, "&rarr;")
    .replace(/\\vec\s*([A-Za-z])/g, "<span class=\"strict-vector\">$1</span>")
    .replace(/([A-Za-z0-9)\]}])\^\{([^{}]+)\}/g, "$1<sup>$2</sup>")
    .replace(/([A-Za-z0-9)\]}])\^([A-Za-z0-9+\-]+)/g, "$1<sup>$2</sup>")
    .replace(/([A-Za-z0-9)\]}])_\{([^{}]+)\}/g, "$1<sub>$2</sub>")
    .replace(/([A-Za-z0-9)\]}])_([A-Za-z0-9+\-]+)/g, "$1<sub>$2</sub>")
    .replace(/\\mathbb\{([^{}]+)\}/g, "<span class=\"strict-blackboard\">$1</span>")
    .replace(/\\/g, "");
}

function renderLatexText(value) {
  const parts = String(value).split(/(\\\(.+?\\\))/g);
  return parts.map((part) => {
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      return `<span class="strict-math">${renderMathExpression(part.slice(2, -2))}</span>`;
    }

    return escapeHtml(part);
  }).join("");
}

function appendRichElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.dataset.latexSource = text;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function renderOfflineMath(root) {
  root.querySelectorAll("[data-latex-source]").forEach((element) => {
    element.innerHTML = renderLatexText(element.dataset.latexSource || element.textContent || "");
  });
}

function loadMathJax() {
  if (window.MathJax?.typesetPromise) {
    return Promise.resolve(window.MathJax);
  }

  if (window.strictMathJaxPromise) {
    return window.strictMathJaxPromise;
  }

  window.MathJax = {
    tex: {
      inlineMath: [["\\(", "\\)"]],
      displayMath: [["\\[", "\\]"]],
      processEscapes: true
    },
    options: {
      skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
    }
  };

  window.strictMathJaxPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
    script.async = true;
    script.onload = () => resolve(window.MathJax);
    script.onerror = () => reject(new Error("MathJax failed to load"));
    (document.head || document.documentElement).appendChild(script);
  });

  return window.strictMathJaxPromise;
}

function typesetConceptMath(root) {
  let fallbackUsed = false;
  const fallbackTimer = window.setTimeout(() => {
    fallbackUsed = true;
    renderOfflineMath(root);
  }, 3500);

  loadMathJax()
    .then((mathJax) => {
      if (fallbackUsed || !mathJax?.typesetPromise) {
        return;
      }

      window.clearTimeout(fallbackTimer);
      return mathJax.typesetPromise([root]);
    })
    .catch(() => {
      window.clearTimeout(fallbackTimer);
      renderOfflineMath(root);
    });
}

function buildConceptCard(concept) {
  const card = document.createElement("section");
  card.className = "strict-concept-card";

  appendTextElement(card, "div", "strict-concept-kicker", `${concept.subject} concept`);
  appendTextElement(card, "h1", "strict-concept-title", concept.title);
  appendRichElement(card, "p", "strict-concept-explanation", concept.explanation);

  if (concept.formulas?.length) {
    const list = document.createElement("ul");
    list.className = "strict-concept-formulas";

    concept.formulas.forEach((formula) => {
      appendRichElement(list, "li", "", formula);
    });

    card.appendChild(list);
  }

  if (concept.sketch) {
    appendTextElement(card, "div", "strict-concept-xfactor-title", "JEE X-factor");
    appendTextElement(card, "pre", "strict-concept-sketch", concept.sketch);
  }

  appendTextElement(card, "div", "strict-concept-footer", "watch only things that matter");
  return card;
}

function renderHomeNote() {
  const existingNote = document.getElementById("strict-home-note");
  const shouldShow = isHomeLocation();

  document.body?.classList.toggle("strict-home-block", shouldShow);

  if (!shouldShow) {
    existingNote?.remove();
    return;
  }

  const leftOffset = getVisibleSidebarWidth();

  if (existingNote) {
    existingNote.style.left = `${leftOffset}px`;
    return;
  }

  const note = document.createElement("main");
  note.id = "strict-home-note";
  note.setAttribute("role", "main");
  note.style.cssText = [
    "box-sizing:border-box",
    "position:fixed",
    `left:${leftOffset}px`,
    "right:0",
    "top:56px",
    "bottom:0",
    "z-index:2147483647",
    "background:#0f0f0f",
    "min-height:calc(100vh - 56px)",
    "display:grid",
    "place-items:center",
    "padding:28px",
    "font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-size:16px",
    "font-weight:400",
    "line-height:1.5",
    "letter-spacing:0",
    "color:#ffffff",
    "text-align:left",
    "overflow:auto"
  ].join(";");

  const cardStyle = document.createElement("style");
  cardStyle.textContent = `
    #strict-home-note .strict-concept-card {
      width: min(900px, 94%);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 8px;
      background: #171717;
      padding: 28px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.38);
    }
    #strict-home-note .strict-concept-kicker {
      color: #7dd3fc;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    #strict-home-note .strict-concept-title {
      color: #ffffff;
      font-size: clamp(24px, 3.6vw, 42px);
      line-height: 1.12;
      margin: 0 0 14px;
      font-weight: 800;
      letter-spacing: 0;
    }
    #strict-home-note .strict-concept-explanation {
      color: #e5e7eb;
      font-size: clamp(14px, 1.35vw, 17px);
      margin: 0 0 18px;
    }
    #strict-home-note .strict-concept-formulas {
      display: grid;
      gap: 8px;
      margin: 0 0 18px;
      padding: 0;
      list-style: none;
    }
    #strict-home-note .strict-concept-formulas li {
      color: #f8fafc;
      background: #0f0f0f;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 9px 11px;
      font: 600 15px/1.35 Consolas, 'Courier New', monospace;
      overflow-wrap: anywhere;
    }
    #strict-home-note .strict-math {
      display: inline-flex;
      align-items: center;
      gap: 0.12em;
      color: #ffffff;
      font-family: "Cambria Math", Cambria, "Times New Roman", serif;
      font-size: 1.08em;
      line-height: 1.35;
      vertical-align: middle;
      white-space: nowrap;
    }
    #strict-home-note .strict-concept-formulas .strict-math {
      white-space: normal;
    }
    #strict-home-note .strict-frac {
      display: inline-grid;
      grid-template-rows: auto auto;
      align-items: center;
      justify-items: center;
      margin: 0 0.15em;
      vertical-align: middle;
      line-height: 1.05;
    }
    #strict-home-note .strict-frac > span:first-child {
      border-bottom: 1px solid currentColor;
      padding: 0 0.18em 0.08em;
    }
    #strict-home-note .strict-frac > span:last-child {
      padding: 0.08em 0.18em 0;
    }
    #strict-home-note .strict-root {
      display: inline-flex;
      align-items: flex-start;
      gap: 0.05em;
    }
    #strict-home-note .strict-root > span {
      border-top: 1px solid currentColor;
      padding: 0.02em 0.1em 0;
    }
    #strict-home-note .strict-vector {
      text-decoration: overline;
      text-decoration-thickness: 1px;
    }
    #strict-home-note .strict-concept-xfactor-title {
      color: #fde68a;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin: 2px 0 8px;
    }
    #strict-home-note .strict-concept-sketch {
      color: #fef3c7;
      background: #15110a;
      border: 1px solid rgba(253, 230, 138, 0.2);
      border-radius: 6px;
      padding: 14px;
      margin: 0 0 18px;
      font: 600 14px/1.35 Consolas, 'Courier New', monospace;
      white-space: pre-wrap;
    }
    #strict-home-note .strict-concept-footer {
      color: #ffffff;
      font-family: 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', 'Apple Chancery', cursive;
      font-size: clamp(18px, 2.5vw, 30px);
      line-height: 1.2;
      text-align: right;
    }
  `;

  note.appendChild(cardStyle);
  note.appendChild(buildConceptCard(getHomeConcept()));
  (document.body || document.documentElement).appendChild(note);
  typesetConceptMath(note);
}

function scrubPage() {
  installStrictCss();
  escapeBlockedPage();
  renderHomeNote();
  stripBlockedLinks();
  stripBlockedButtons();
  stripKnownBlockedLinks();
  stripBlockedShelves();
}

function blockBlockedClick(event) {
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!link || !isBlockedHref(link.href)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  removeBlockedElement(link);
}

function patchHistoryMethod(name) {
  const original = history[name];
  history[name] = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    queueMicrotask(scrubPage);
    return result;
  };
}

installStrictCss();
escapeBlockedPage();
patchHistoryMethod("pushState");
patchHistoryMethod("replaceState");
window.addEventListener("popstate", scrubPage, true);
window.addEventListener("yt-navigate-finish", scrubPage, true);
document.addEventListener("click", blockBlockedClick, true);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) {
        stripBlockedLinks(node);
        stripBlockedButtons(node);
        stripKnownBlockedLinks(node);
        stripBlockedShelves(node);
      }
    }
  }
});

if (document.documentElement) {
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scrubPage, { once: true });
} else {
  scrubPage();
}

setInterval(scrubPage, 1000);
