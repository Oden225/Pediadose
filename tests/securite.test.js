// Tests de sécurité : échappement de l'affichage et service worker.
// Lancer : npm test   (ou : node --test)
//
// Ils vérifient que des données venues du serveur ou du stockage du navigateur
// ne peuvent pas devenir du code dans la page, et que le service worker
// ne met jamais en cache les réponses de Supabase (liées à un compte).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { chargerPage } = require("./charger-page.js");

// Texte piégé : tente de sortir d'une chaîne JavaScript (') et d'un attribut HTML (").
const PIEGE = "x');window.__pirate=1;(' \"><img src=x onerror=window.__pirate=2>";

// Aucun élément HTML injecté, aucune donnée brute dans le code des onclick.
function verifierSansInjection(html) {
  assert.ok(!/<img/i.test(html), "une balise <img> injectée est présente :\n" + html);
  assert.ok(!html.includes("x');") && !html.includes('"><img'), "le texte piégé apparaît non échappé :\n" + html);
  for (const m of html.matchAll(/onclick="([^"]*)"/g)) {
    assert.ok(!m[1].includes("pirate"), "donnée piégée dans un onclick : " + m[1]);
  }
}

test("Panneau admin : les champs d'un paiement déclaré sont affichés comme du texte", async () => {
  const ligne = {
    id: "1');window.__pirate=1;//",
    nom: PIEGE, email: "a@test.local", montant_fcfa: 3000,
    plan_vise: PIEGE, operateur: PIEGE, reference: PIEGE, numero_payeur: PIEGE,
  };
  const supabase = {
    rpc: async (nom) => (nom === "paiements_declares" ? { data: [ligne], error: null } : { data: null, error: null }),
    auth: { getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) },
  };
  const page = chargerPage("abonnement.html", { supabase });
  await page.chargerAdmin();
  const html = page.elements.adminList.innerHTML;
  verifierSansInjection(html);
  assert.ok(html.includes("&lt;img src=x"), "le texte piégé doit rester visible, échappé");
  assert.ok(html.includes('onclick="valider(this.dataset.id)"'), "l'identifiant passe par data-id, pas par le code");
});

test("Historique : une entrée piégée (mode, nom) ne devient jamais du code", () => {
  const entree = { k: "a", t: Date.now(), w: 12, m: null, mode: PIEGE, cls: "", id: "para", nom: PIEGE, urg: false, dose: PIEGE };
  const page = chargerPage("index.html", { stockage: { pd_hist: JSON.stringify([entree]) } });
  page.showTab("hist");
  const html = page.elements.histList.innerHTML;
  verifierSansInjection(html);
  assert.ok(html.includes('onclick="togSess(this.parentNode.dataset.k, this.parentNode)"'));
  assert.ok(html.includes('onclick="reopen(Number(this.dataset.w) || 0, this.dataset.m, this.dataset.mode)"'));
});

test("Historique : « Rouvrir » n'accepte que les modes enfant ou adulte", () => {
  const page = chargerPage("index.html");
  const modes = [];
  page.setMode = (m) => modes.push(m);
  // Mode par défaut : enfant. Un mode inconnu est ramené à « enfant », donc pas de changement.
  page.reopen(12, "null", PIEGE);
  page.reopen(12, "24", "adulte");
  assert.deepEqual(modes, ["adulte"]);
});

// ---------------------------------------------------------------- Service worker

function chargerServiceWorker() {
  const code = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const ecouteurs = {};
  const ctx = {
    URL, Promise, Response: { error: () => ({}) }, setTimeout, clearTimeout,
    caches: { match: async () => undefined, open: async () => ({ put: async () => {} }) },
    fetch: async () => ({ ok: true, type: "basic", clone() { return this; } }),
    addEventListener: (type, fn) => { ecouteurs[type] = fn; },
    skipWaiting: () => {}, clients: { claim: () => {} },
    location: { origin: "https://app.test" },
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: "sw.js" });
  // Indique si le service worker prend la main sur une requête (cache) ou la laisse au réseau.
  return (url, { method = "GET", mode = "cors", entetes = {} } = {}) => {
    let intercepte = false;
    ecouteurs.fetch({
      request: { url, method, mode, headers: { has: (h) => Object.keys(entetes).some((k) => k.toLowerCase() === h.toLowerCase()) } },
      respondWith: () => { intercepte = true; },
    });
    return intercepte;
  };
}

test("Service worker : les appels à Supabase ne passent jamais par le cache", () => {
  const intercepte = chargerServiceWorker();
  const supa = "https://rwmuqzamhxziboykyttz.supabase.co";
  assert.equal(intercepte(supa + "/auth/v1/user", { entetes: { Authorization: "Bearer x" } }), false);
  assert.equal(intercepte(supa + "/rest/v1/historique?select=*&order=t.asc"), false);
  assert.equal(intercepte("https://fonts.googleapis.com/css2?family=Hanken+Grotesk"), false);
  assert.equal(intercepte("https://app.test/donnees", { entetes: { Authorization: "Bearer x" } }), false);
});

test("Service worker : les fichiers de l'application restent disponibles hors ligne", () => {
  const intercepte = chargerServiceWorker();
  assert.equal(intercepte("https://app.test/icon-192.png"), true);
  assert.equal(intercepte("https://app.test/index.html", { mode: "navigate" }), true);
  assert.equal(intercepte("https://app.test/index.html", { method: "POST" }), false);
});
