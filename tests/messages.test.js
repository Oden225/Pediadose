// Tests des messages affichés à la connexion quand Supabase répond mal ou pas du tout.
// Lancer : npm test   (ou : node --test)

const test = require("node:test");
const assert = require("node:assert/strict");
const { chargerPage } = require("./charger-page.js");

const INJOIGNABLE = "Le serveur ne répond pas. Réessayez dans quelques minutes.";

test("Connexion : un serveur injoignable donne un message clair", () => {
  const page = chargerPage("index.html");
  // Erreurs typiques de supabase-js quand le projet est en pause ou en panne
  assert.equal(page.aTrad({ name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 }), INJOIGNABLE);
  assert.equal(page.aTrad({ message: "TypeError: Load failed" }), INJOIGNABLE);
  assert.equal(page.aTrad({ message: "NetworkError when attempting to fetch resource." }), INJOIGNABLE);
  assert.equal(page.aTrad({ message: "", status: 503 }), INJOIGNABLE);
  assert.equal(page.aTrad({ message: "Project paused", status: 540 }), INJOIGNABLE);
});

test("Connexion : les autres erreurs gardent leur message", () => {
  const page = chargerPage("index.html");
  assert.equal(page.aTrad({ message: "Invalid login credentials", status: 400 }), "E-mail ou mot de passe incorrect.");
  assert.equal(page.aTrad({ message: "Email not confirmed", status: 400 }), "Compte non confirmé : entrez le code reçu par e-mail.");
  assert.equal(page.aTrad({ message: "Something odd", status: 422 }), "Une erreur est survenue. Réessayez.");
});

test("Page d'abonnement : même message quand le serveur est injoignable", async () => {
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInWithPassword: async () => ({ error: { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 } }),
    },
  };
  const page = chargerPage("abonnement.html", { supabase });
  page.document.getElementById("lEmail").value = "medecin@test.local";
  page.document.getElementById("lPass").value = "motdepasse";
  await page.login();
  assert.equal(page.document.getElementById("loginMsg").textContent, INJOIGNABLE);
});
