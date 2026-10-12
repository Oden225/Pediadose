// Charge tous les scripts d'une page HTML dans Node, sans navigateur ni réseau,
// avec un faux DOM qui garde en mémoire le contenu écrit dans chaque élément.
// Sert aux tests de sécurité (échappement de l'affichage, service worker).
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function faux() {
  const f = function () {};
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => "";
      if (k === "then") return undefined;
      if (k === "length") return 0;
      return faux();
    },
    set() { return true; },
    apply() { return faux(); },
  });
}

// Élément qui mémorise innerHTML, textContent, value, dataset et style.
function element() {
  const etat = { innerHTML: "", textContent: "", value: "", dataset: {}, style: {}, className: "", hidden: false };
  return new Proxy(etat, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "classList") return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (k === "querySelectorAll") return () => [];
      if (k === "querySelector") return () => null;
      if (k === Symbol.toPrimitive) return () => "";
      if (k === "then") return undefined;
      return faux();
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function chargerPage(fichier, { supabase, stockage = {} } = {}) {
  const html = fs.readFileSync(path.join(__dirname, "..", fichier), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const elements = {};
  const document = new Proxy({}, {
    get(t, k) {
      if (k === "getElementById") return (id) => (elements[id] = elements[id] || element());
      if (k === "querySelectorAll") return () => [];
      if (k === "querySelector") return () => null;
      if (k === "createElement") return () => element();
      return faux();
    },
  });
  const ctx = {
    console, document, elements,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    navigator: faux(), location: { origin: "https://app.test", href: "https://app.test/", reload() {}, protocol: "https:" },
    history: faux(),
    localStorage: {
      getItem: (k) => (k in stockage ? stockage[k] : null),
      setItem: (k, v) => { stockage[k] = String(v); },
      removeItem: (k) => { delete stockage[k]; },
    },
    supabase: { createClient: () => supabase || faux() },
    addEventListener: () => {}, matchMedia: () => faux(), requestAnimationFrame: () => 0,
    scrollTo: () => {}, confirm: () => false, alert: () => {}, crypto: globalThis.crypto,
    URL, Date, Intl, JSON, Math, Promise,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const code of scripts) {
    try { vm.runInContext(code, ctx, { filename: fichier }); } catch (e) { ctx.__erreurs = (ctx.__erreurs || []).concat(String(e)); }
  }
  return ctx;
}

module.exports = { chargerPage };
