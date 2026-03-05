import { auth, db, storage, OWNER_EMAIL } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  doc, getDoc, setDoc,
  collection, addDoc, getDocs, query, orderBy,
  deleteDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const loginCard = $("#loginCard");
const dashboard = $("#dashboard");
const logoutBtn = $("#logoutBtn");

const toast = $("#toast");
let toastTimer = null;
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// ---------------------
// Auth gate
// ---------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginCard.hidden = false;
    dashboard.hidden = true;
    logoutBtn.hidden = true;
    return;
  }

  // Security check: only owner email allowed
  if ((user.email || "").toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    showToast("Accès refusé: email non autorisé ❗");
    await signOut(auth);
    return;
  }

  loginCard.hidden = true;
  dashboard.hidden = false;
  logoutBtn.hidden = false;

  await loadSettings();
  await loadProjects();
});

logoutBtn.addEventListener("click", () => signOut(auth));

// ---------------------
// Login
// ---------------------
const loginForm = $("#loginForm");
const errLoginEmail = $("#errLoginEmail");
const errLoginPass = $("#errLoginPass");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#loginEmail").value.trim();
  const pass = $("#loginPass").value;

  errLoginEmail.textContent = email ? "" : "Email requis.";
  errLoginPass.textContent = pass ? "" : "Mot de passe requis.";
  if (!email || !pass) return;

  if (email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    errLoginEmail.textContent = "Cet email n'est pas autorisé.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("Connecté ✔️");
  } catch (err) {
    showToast("Erreur de connexion ❗");
    errLoginPass.textContent = err?.message || "Erreur.";
  }
});

$("#resetPassBtn").addEventListener("click", async () => {
  const email = $("#loginEmail").value.trim() || OWNER_EMAIL;
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Email de réinitialisation envoyé ✔️");
  } catch {
    showToast("Impossible d'envoyer l'email ❗");
  }
});

// ---------------------
// Settings
// ---------------------
const settingsRef = doc(db, "site", "settings");
const settingsForm = $("#settingsForm");

async function loadSettings() {
  const snap = await getDoc(settingsRef);
  const d = snap.data() || {};

  $("#sName").value = d.name || "";
  $("#sRole").value = d.role || "";
  $("#sBio").value = d.bio || "";
  $("#sYears").value = d.years || "";
  $("#sProjects").value = d.projectsCount || "";
  $("#sCities").value = d.cities || "";
  $("#sPhone").value = d.phone || "";
  $("#sAddress").value = d.address || "";

  // optional arrays
  // you can later add UI fields for these if you want
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: $("#sName").value.trim(),
    role: $("#sRole").value.trim(),
    bio: $("#sBio").value.trim(),
    years: $("#sYears").value.trim(),
    projectsCount: $("#sProjects").value.trim(),
    cities: $("#sCities").value.trim(),
    phone: $("#sPhone").value.trim(),
    address: $("#sAddress").value.trim(),
    email: OWNER_EMAIL,

    // default services/highlights if none:
    services: [
      "Conception de plans & architecture",
      "Construction de maisons",
      "Rénovation & extension",
      "Suivi de chantier"
    ],
    highlights: ["Qualité", "Transparence", "Délais", "Design moderne"],
    aboutIntro: "Un professionnel du bâtiment qui transforme vos idées en réalisations.",
    aboutText:
      "Nous accompagnons nos clients de la conception jusqu’à la livraison, avec un souci de qualité, sécurité et respect des délais."
  };

  await setDoc(settingsRef, payload, { merge: true });
  showToast("Informations enregistrées ✔️");
});

// ---------------------
// Projects: Create
// ---------------------
const projectForm = $("#projectForm");
const errPTitle = $("#errPTitle");
const errPCover = $("#errPCover");

const progressWrap = $("#uploadProgress");
const progressBar = $("#progressBar");

projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = $("#pTitle").value.trim();
  const type = $("#pType").value.trim();
  const location = $("#pLocation").value.trim();
  const description = $("#pDesc").value.trim();

  const coverFile = $("#pCover").files?.[0];
  const galleryFiles = $("#pGallery").files ? Array.from($("#pGallery").files) : [];
  const videoFile = $("#pVideo").files?.[0] || null;

  errPTitle.textContent = title ? "" : "Titre requis.";
  errPCover.textContent = coverFile ? "" : "Image de couverture requise.";
  if (!title || !coverFile) return;

  try {
    progressWrap.hidden = false;
    setProgress(0);

    // upload cover
    const coverPath = `projects/${Date.now()}_cover_${safeName(coverFile.name)}`;
    const coverUrl = await uploadWithProgress(coverPath, coverFile, 0, 40);

    // upload gallery
    let galleryUrls = [];
    if (galleryFiles.length) {
      const per = 35 / galleryFiles.length;
      for (let i = 0; i < galleryFiles.length; i++) {
        const f = galleryFiles[i];
        const p = `projects/${Date.now()}_g${i}_${safeName(f.name)}`;
        const u = await uploadWithProgress(p, f, 40 + per * i, 40 + per * (i + 1));
        galleryUrls.push(u);
      }
    }

    // upload video (optional)
    let videoUrl = "";
    if (videoFile) {
      const vPath = `projects/${Date.now()}_video_${safeName(videoFile.name)}`;
      videoUrl = await uploadWithProgress(vPath, videoFile, 75, 98);
    }

    // Firestore doc
    await addDoc(collection(db, "projects"), {
      title,
      type,
      location,
      description,
      coverUrl,
      galleryUrls,
      videoUrl,
      published: true,
      createdAt: serverTimestamp()
    });

    setProgress(100);
    showToast("Projet publié ✔️");
    projectForm.reset();
    await loadProjects();
  } catch (err) {
    console.error(err);
    showToast("Erreur lors de la publication ❗");
  } finally {
    setTimeout(() => { progressWrap.hidden = true; }, 1200);
  }
});

function setProgress(p) {
  progressBar.style.width = `${Math.max(0, Math.min(100, p))}%`;
}

function safeName(name) {
  return String(name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

async function uploadWithProgress(storagePath, file, fromPct, toPct) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    task.on("state_changed",
      (snap) => {
        const ratio = snap.bytesTransferred / snap.totalBytes;
        const pct = fromPct + ratio * (toPct - fromPct);
        setProgress(pct);
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

// ---------------------
// Projects: list + delete + toggle published
// ---------------------
const adminGrid = $("#adminProjectsGrid");
const adminEmpty = $("#adminEmpty");
$("#refreshBtn").addEventListener("click", loadProjects);

async function loadProjects() {
  const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (!items.length) {
    adminGrid.innerHTML = "";
    adminEmpty.hidden = false;
    return;
  }
  adminEmpty.hidden = true;

  adminGrid.innerHTML = items.map(p => adminCard(p)).join("");

  $$("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("Supprimer ce projet ?")) return;
      await deleteProject(id);
      await loadProjects();
    });
  });

  $$("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-toggle");
      const published = btn.getAttribute("data-published") === "true";
      await updateDoc(doc(db, "projects", id), { published: !published });
      showToast(!published ? "Projet publié ✔️" : "Projet masqué ✔️");
      await loadProjects();
    });
  });
}

function adminCard(p) {
  const pub = p.published !== false;
  return `
    <article class="card projectCard">
      ${p.coverUrl ? `<img class="projectCard__cover" src="${p.coverUrl}" alt="">` : `<div class="projectCard__cover"></div>`}
      <div class="projectCard__body">
        <h3 class="card__title">${escapeHtml(p.title || "Projet")}</h3>
        <p class="card__text">${escapeHtml((p.description || "").slice(0, 90))}${(p.description || "").length > 90 ? "…" : ""}</p>
        <div class="projectCard__meta">
          ${p.type ? `<span class="tag">${escapeHtml(p.type)}</span>` : ""}
          ${p.location ? `<span class="tag">${escapeHtml(p.location)}</span>` : ""}
          <span class="tag">${pub ? "Publié" : "Masqué"}</span>
        </div>
        <div class="projectCard__actions">
          <button class="btn btn--soft" type="button" data-toggle="${p.id}" data-published="${pub}">
            ${pub ? "Masquer" : "Publier"}
          </button>
          <button class="btn btn--ghost" type="button" data-del="${p.id}">Supprimer</button>
        </div>
      </div>
    </article>
  `;
}

async function deleteProject(id) {
  const refDoc = doc(db, "projects", id);
  const snap = await getDoc(refDoc);
  const p = snap.data() || {};

  // Delete Firestore doc first (or after) – either is okay
  await deleteDoc(refDoc);

  // Attempt delete files (best effort)
  const urls = [p.coverUrl, ...(p.galleryUrls || []), p.videoUrl].filter(Boolean);
  await Promise.allSettled(urls.map(deleteByUrl));
  showToast("Projet supprimé ✔️");
}

async function deleteByUrl(url) {
  // Firebase can delete by refFromURL
  try {
    const { ref: refFromURL } = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js");
    const fileRef = refFromURL(storage, url);
    await deleteObject(fileRef);
  } catch {
    // ignore if can't delete
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}