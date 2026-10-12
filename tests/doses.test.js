// Tests des calculs de doses de NormoDose.
// Lancer : npm test   (ou : node --test)
//
// Les valeurs attendues sont calculées à la main à partir des formules
// (mg/kg, plafonds, concentrations), pas recopiées depuis l'application.
// Si un test échoue après une modification, c'est que la dose affichée a changé :
// vérifier que c'était voulu avant de corriger le test.

const test = require("node:test");
const assert = require("node:assert/strict");
const { chargerApp } = require("./charger-app.js");

const app = chargerApp();

// Vérifie que chaque fragment apparaît dans le texte affiché.
function contient(texte, ...fragments) {
  for (const f of fragments) {
    assert.ok(texte.includes(f), `« ${f} » absent de :\n${texte}`);
  }
}

// ---------------------------------------------------------------- Antipyrétiques

test("Paracétamol VO : 15 mg/kg toutes les 6 h, plafond 1 g par prise et 4 g/j", () => {
  // 12 kg : 15 × 12 = 180 mg ; sirop 24 mg/ml → 7,5 ml ; 24 h : 4 × 180 = 720 mg
  contient(app.dose("para", 12), "≈ 180 mg / prise", "≈ 7,5 ml par prise", "Maximum sur 24 h : 720 mg");
  // 80 kg : 1 200 mg → plafonné à 1 000 mg ; 24 h : 4 000 mg
  contient(app.dose("para", 80), "≈ 1 000 mg / prise", "Maximum sur 24 h : 4 000 mg", "Plafond appliqué");
});

test("Ibuprofène : 10 mg/kg toutes les 8 h, plafond 400 mg, interdit avant 3 mois", () => {
  // 12 kg : 120 mg ; sirop 20 mg/ml → 6 ml ; 24 h : 360 mg
  contient(app.dose("ibu", 12), "≈ 120 mg / prise", "≈ 6 ml par prise", "Maximum sur 24 h : 360 mg");
  contient(app.dose("ibu", 80), "≈ 400 mg / prise", "Maximum sur 24 h : 1 200 mg", "Plafond appliqué");
  contient(app.dose("ibu", 5, 2), "Âge minimum : 3 mois");
});

test("Paracétamol IV : 7,5 mg/kg sous 10 kg, 15 mg/kg à partir de 10 kg", () => {
  // 9,9 kg : 7,5 × 9,9 = 74,25 → 74,3 mg ; 10 kg : 150 mg (flacon 10 mg/ml → 15 ml)
  contient(app.recon("paraIV", 9.9), "7,5 mg/kg", "74,3 mg");
  contient(app.recon("paraIV", 10), "15 mg/kg", "150 mg", "15 ml");
  contient(app.recon("paraIV", 80), "1 000 mg");
});

// ---------------------------------------------------------------- Antibiotiques

test("Amoxicilline VO : 50 à 100 mg/kg/j en 3 prises, plafond 4 g/j", () => {
  // 12 kg : 600 – 1 200 mg/j → 200 – 400 mg par prise → 4 – 8 ml (50 mg/ml)
  contient(app.dose("amox", 12), "≈ 600 – 1 200 mg / jour", "≈ 200 – 400 mg par prise", "≈ 4 – 8 ml par prise");
  contient(app.dose("amox", 80), "≈ 4 000 mg / jour", "Plafond appliqué");
});

test("Amoxicilline + acide clavulanique : 80 à 100 mg/kg/j, plafond 3 g/j", () => {
  contient(app.dose("amcl", 12), "≈ 960 – 1 200 mg / jour", "≈ 320 – 400 mg par prise");
  contient(app.dose("amcl", 80), "≈ 3 000 mg / jour", "Plafond appliqué");
});

test("Ceftriaxone : 50 à 100 mg/kg ×1/j, plafond 2 g, volumes IV et IM", () => {
  contient(app.dose("ceftri", 12), "≈ 600 – 1 200 mg / jour");
  contient(app.dose("ceftri", 30), "≈ 1 500 – 2 000 mg / jour", "Plafond appliqué");
  // IV 100 mg/ml → 6 – 12 ml ; IM 250 mg/ml → 2,4 – 4,8 ml
  contient(app.recon("ceftri", 12), "600 – 1 200 mg", "prélever 6 – 12 ml", "prélever 2,4 – 4,8 ml");
});

test("Azithromycine : 20 mg/kg ×1/j, plafond 500 mg", () => {
  // 12 kg : 240 mg ; susp. 40 mg/ml → 6 ml
  contient(app.dose("azi", 12), "≈ 240 mg / prise", "≈ 6 ml par prise");
  contient(app.dose("azi", 30), "≈ 500 mg / prise", "Plafond appliqué");
});

test("Céfixime : 8 mg/kg/j en 2 prises", () => {
  // 12 kg : 96 mg/j → 48 mg par prise → 2,4 ml (20 mg/ml)
  contient(app.dose("cefi", 12), "≈ 96 mg / jour", "≈ 48 mg par prise", "≈ 2,4 ml par prise");
});

test("Gentamicine : 3 à 5 mg/kg/j, volumes selon l'ampoule pédiatrique ou adulte", () => {
  contient(app.dose("genta", 12), "≈ 36 – 60 mg / jour");
  // 10 mg/ml → 3,6 – 6 ml ; 40 mg/ml → 0,9 – 1,5 ml
  contient(app.recon("genta", 12), "36 – 60 mg", "3,6 – 6 ml", "0,9 – 1,5 ml");
});

// ---------------------------------------------------------------- Antipaludiques

test("Artéméther-luméfantrine : la bonne tranche de poids est surlignée", () => {
  const ligne = (w) => app.pedBlock(app.produit("al"), w, null).match(/<tr class="hl"><td class="num">([^<]*)</)[1];
  assert.equal(ligne(12), "5 – &lt; 15 kg");
  assert.equal(ligne(15), "15 – &lt; 25 kg");
  assert.equal(ligne(34.9), "25 – &lt; 35 kg");
  assert.equal(ligne(35), "35 – … kg");
  contient(app.dose("al", 4), "Poids minimum : 5 kg");
});

test("Artésunate (reconstitution) : 3 mg/kg sous 20 kg, 2,4 mg/kg à partir de 20 kg", () => {
  // 19 kg : 57 mg → 5,7 ml à 10 mg/ml ; 20 kg : 48 mg
  contient(app.recon("artesu", 19), "3 mg/kg", "57 mg", "5,7 ml");
  contient(app.recon("artesu", 20), "2,4 mg/kg", "48 mg");
});

test("Artéméther IM : 3,2 mg/kg à J1 puis 1,6 mg/kg/j", () => {
  contient(app.dose("artem", 12), "38,4 mg", "19,2 mg");
  // ampoule 80 mg/ml : 38,4 mg → 0,48 ml
  contient(app.recon("artem", 12), "38,4 mg → 0,48 ml", "19,2 mg → 0,24 ml");
});

test("Quinine : 8 mg/kg par perfusion ×3/j, dilution 10 ml/kg sur 4 h", () => {
  // 12 kg : 96 mg par perfusion, 120 ml de G5/G10, 30 ml/h, 10 gouttes/min
  contient(app.recon("quinine", 12), "96 mg", "120 ml", "30 ml/h", "10 gttes/min");
  contient(app.dose("quinine", 12), "≈ 96 mg par prise");
});

// ---------------------------------------------------------------- Urgences neuro / respiratoires

test("Diazépam (reconstitution) : jamais plus de 10 mg par administration", () => {
  // IR 0,5 mg/kg : 12 kg → 6 mg = 1,2 ml (5 mg/ml) ; 30 kg → plafonné 10 mg
  contient(app.recon("diaz", 12), "6 mg → 1,2 ml");
  contient(app.recon("diaz", 30), "10 mg → 2 ml");
  // IV 0,3 mg/kg : 80 kg → 24 mg plafonné à 10 mg
  const iv80 = app.recon("diaz", 80).match(/IV lente 0,3 mg\/kg (\S+) mg/)[1];
  assert.equal(iv80, "10");
});

test("Phénobarbital : charge 15 à 20 mg/kg, volumes selon la concentration", () => {
  // 12 kg : 180 – 240 mg ; 50 mg/ml → 3,6 – 4,8 ml ; 200 mg/ml → 0,9 – 1,2 ml
  contient(app.recon("gardenal", 12), "180 – 240 mg", "3,6 – 4,8 ml", "0,9 – 1,2 ml");
});

test("Salbutamol nébulisé : 0,15 mg/kg, minimum 2,5 mg, maximum 5 mg", () => {
  contient(app.recon("salbuNeb", 8), "2,5 mg");
  contient(app.recon("salbuNeb", 30), "4,5 mg");
  contient(app.recon("salbuNeb", 80), "5 mg");
});

test("Oméprazole IV enfant : 1 mg/kg/j, plafond 40 mg", () => {
  contient(app.recon("omep", 12), "12 mg → 3 ml");
  contient(app.recon("omep", 80), "40 mg → 10 ml");
});

// ---------------------------------------------------------------- Perfusion

test("Entretien hydrique 4-2-1 (Holliday-Segar)", () => {
  // 4 ml/kg/h jusqu'à 10 kg, +2 ml/kg/h de 10 à 20 kg, +1 ml/kg/h au-delà
  assert.equal(app.maintH(4), 16);
  assert.equal(app.maintH(10), 40);
  assert.equal(app.maintH(12), 44);
  assert.equal(app.maintH(20), 60);
  assert.equal(app.maintH(30), 70);
  // 44 ml/h : perfuseur 20 gouttes/ml → 14,7 → 15 gouttes/min ; sur 24 h 1 056 ml
  contient(app.texte(app.maintBlock(12)), "44 ml/h", "15 gttes/min", "1 056 ml/j");
});

test("Plan C OMS : 100 ml/kg, 30 % puis 70 %, durée selon l'âge", () => {
  // 12 kg : 1 200 ml ; 360 ml puis 840 ml
  contient(app.texte(app.plancBlock(12, 6)), "Total 1 200 ml en 6 h", "360 ml en 1 h", "840 ml en 5 h");
  contient(app.texte(app.plancBlock(12, 24)), "Total 1 200 ml en 3 h", "360 ml en 30 min", "840 ml en 2 h 30");
});

test("Choc : bolus 20 ml/kg (ou 10 ml/kg prudent)", () => {
  contient(app.texte(app.shockBlock(12)), "240 ml", "120 ml");
});

test("Hypoglycémie : G10 % 2 ml/kg, préparation à partir de G30 %", () => {
  // 12 kg : 24 ml de G10 % = 8 ml de G30 % + 16 ml d'eau
  contient(app.texte(app.glucBlock(12)), "24 ml", "60 ml", "8 ml de G30");
});

test("Brûlures : Parkland 4 ml/kg/% SCB, moitié sur les 8 premières heures", () => {
  app.S.scb = 20;
  // 12 kg, 20 % : 960 ml ; 480 ml en 8 h = 60 ml/h ; 480 ml en 16 h = 30 ml/h
  contient(app.texte(app.burnOut(12)), "960 ml", "480 ml → 60 ml/h", "480 ml → 30 ml/h");
});

// ---------------------------------------------------------------- Vérifications sur tous les produits

const POIDS = [0.5, 1, 2, 2.5, 3, 4, 5, 7.5, 9.9, 10, 12, 15, 19.9, 20, 25, 30, 35, 45, 60, 80, 100, 150];
const AGES = [null, 0, 2, 6, 12, 24, 60, 180];
const SUSPECT = /NaN|undefined|Infinity|null|\[object/;

test("Aucun produit n'affiche de valeur invalide (NaN, undefined…) quel que soit le poids ou l'âge", () => {
  for (const d of app.DRUGS) {
    for (const w of POIDS) {
      for (const m of AGES) {
        const h = d.calc ? d.calc(w, m) : app.pedBlock(d, w, m);
        assert.doesNotMatch(app.texte(h), SUSPECT, `${d.id}, ${w} kg, ${m} mois`);
      }
    }
    if (d.adulte) assert.doesNotMatch(app.texte(app.adultBlock(d)), SUSPECT, `${d.id} adulte`);
  }
  for (const r of app.RECON) {
    for (const w of POIDS) {
      for (const m of AGES) assert.doesNotMatch(app.texte(r.f(w, m)), SUSPECT, `recon ${r.id}, ${w} kg`);
    }
  }
  for (const s of app.SOLUTES) {
    for (const w of [0, ...POIDS]) assert.doesNotMatch(app.texte(s.f(w)), SUSPECT, `soluté ${s.id}, ${w} kg`);
  }
});

// Premier nombre après « ≈ » : la dose principale affichée (format français : 1 000,5).
function dosePrincipale(texte) {
  const m = texte.match(/≈ (\d{1,3}(?: \d{3})*(?:,\d+)?)/);
  return m ? Number(m[1].replace(/ /g, "").replace(",", ".")) : null;
}

test("Les plafonds par prise et par jour ne sont jamais dépassés, même à 150 kg", () => {
  for (const d of app.DRUGS) {
    const p = d.ped;
    if (!p || d.calc || d.bands || d.multi || d.fixed) continue;
    const dose = dosePrincipale(app.dose(d.id, 150));
    if (p.perKg !== undefined && p.maxPrise) {
      assert.ok(dose <= p.maxPrise, `${d.id} : ${dose} > plafond par prise ${p.maxPrise}`);
    }
    if (p.perDayKg !== undefined && p.maxJour) {
      assert.ok(dose <= p.maxJour, `${d.id} : ${dose} > plafond par jour ${p.maxJour}`);
    }
  }
});

test("La dose ne diminue jamais quand le poids augmente", () => {
  for (const d of app.DRUGS) {
    const p = d.ped;
    if (!p || d.calc || d.bands || d.multi || d.fixed) continue;
    let avant = 0;
    for (const w of POIDS) {
      const dose = dosePrincipale(app.dose(d.id, w));
      assert.ok(dose >= avant, `${d.id} : ${dose} à ${w} kg < ${avant} au poids précédent`);
      avant = dose;
    }
  }
});

// ---------------------------------------------------------------- Points à valider par un médecin
// Incohérences relevées en écrivant ces tests. Elles s'affichent comme « todo »
// sans faire échouer les tests. Une fois tranchées, les transformer en vrais tests.

test.todo("Diazépam (fiche produit) : pas de plafond à 10 mg ; affiche 15 – 30 mg à 30 kg alors que sa note et la fiche Reconstitution disent max 10 mg par administration");
test.todo("Fer : la dose par prise n'est pas plafonnée ; à 80 kg la fiche affiche 240 mg puis « Maximum sur 24 h : 180 mg »");
test.todo("Artésunate (fiche produit) : 2,4 mg/kg même sous 20 kg, alors que la fiche Reconstitution applique 3 mg/kg (OMS)");
test.todo("Acide niflumique : sous 10 kg, l'arrondi force 1 suppositoire de 400 mg (ex. 5 kg → 80 mg/kg)");
test.todo("Plafonds absents à confirmer : phénobarbital (1 600 mg à 80 kg), quinine (640 mg par perfusion et 800 ml de dilution à 80 kg), ceftriaxone limitée à 2 g même en méningite");
