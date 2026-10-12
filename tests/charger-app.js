// Charge le code de calcul d'index.html dans Node, sans navigateur ni réseau.
// Le DOM, localStorage et Supabase sont remplacés par des faux objets inertes.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function faux() {
  // Objet « attrape-tout » : toute propriété ou tout appel renvoie un autre faux objet.
  const f = function () {};
  return new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => "";
      if (k === "then") return undefined;
      if (k === "value" || k === "textContent" || k === "innerHTML") return "";
      if (k === "length") return 0;
      return faux();
    },
    set() { return true; },
    apply() { return faux(); },
  });
}

function chargerApp() {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const code = scripts.find((s) => s.includes("const DRUGS="));
  if (!code) throw new Error("Script des calculs introuvable dans index.html");

  const stockage = {};
  const ctx = {
    console,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    document: faux(), navigator: faux(), location: faux(), history: faux(),
    localStorage: {
      getItem: (k) => (k in stockage ? stockage[k] : null),
      setItem: (k, v) => { stockage[k] = String(v); },
      removeItem: (k) => { delete stockage[k]; },
    },
    supabase: { createClient: () => faux() },
    addEventListener: () => {}, matchMedia: () => faux(), requestAnimationFrame: () => 0,
    confirm: () => false, alert: () => {}, crypto: globalThis.crypto,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: "index.html" });

  // Les const/let de haut niveau ne sont pas des propriétés de window : on les expose ici.
  const app = vm.runInContext(
    `({ DRUGS, SOLUTES, RECON, S, pedBlock, adultBlock, maintH, maintBlock, plancBlock,
        shockBlock, glucBlock, burnOut, soluteBlock, reconOut })`, ctx);

  // Texte lisible d'un bloc HTML : balises retirées, entités décodées, espaces normalisés.
  app.texte = (h) => String(h)
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
  // Bloc affiché par la fiche d'un produit (enfant), en texte.
  app.dose = (id, w, m = null) => app.texte(app.pedBlock(app.produit(id), w, m));
  // Bloc affiché par « Reconstitution & dilution » pour un produit donné, en texte.
  app.recon = (id, w, m = null) => {
    const r = app.RECON.find((x) => x.id === id);
    if (!r) throw new Error("Reconstitution introuvable : " + id);
    return app.texte(r.f(w, m));
  };
  app.produit = (id) => {
    const d = app.DRUGS.find((x) => x.id === id);
    if (!d) throw new Error("Produit introuvable : " + id);
    return d;
  };
  return app;
}

module.exports = { chargerApp };
