import { db } from "./firebase-config.js";
import {
  collection, query, orderBy, onSnapshot, doc, onSnapshot as onDocSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (sel, root = document) => root.querySelector(sel);

$("#year").textContent = new Date().getFullYear();

// ----------------------
// Load site settings
// ----------------------
const settingsRef = doc(db, "site", "settings");

onDocSnapshot(settingsRef, (snap) => {
  const data = snap.data() || {};

  const name = data.name || "Miguel Atonliké";
  const role = data.role || "Architecte & Ingénieur Civil";

  $("#brandName").textContent = name;
  $("#footerName").textContent = name;
  $("#heroName").textContent = name;
  $("#heroRole").textContent = role;

  $("#heroBio").textContent = data.bio || $("#heroBio").textContent;
  $("#aboutIntro").textContent = data.aboutIntro || $("#aboutIntro").textContent;
  $("#aboutText").textContent = data.aboutText || $("#aboutText").textContent;

  $("#statYears").textContent = data.years || $("#statYears").textContent;
  $("#statProjects").textContent = data.projectsCount || $("#statProjects").textContent;
  $("#statCities").textContent = data.cities || $("#statCities").textContent;

  $("#contactEmail").textContent = data.email || "atonlikeumiguel@gmail.com";
  $("#contactEmail").href = `mailto:${data.email || "atonlikeumiguel@gmail.com"}`;
  $("#contactPhone").textContent = data.phone || "À renseigner";
  $("#contactAddress").textContent = data.address || "À renseigner";

  // services
  const services = Array.isArray(data.services) ? data.services : null;
  if (services && services.length) {
    const ul = $("#servicesList");
    ul.innerHTML = services.map(s => `<li>${escapeHtml(s)}</li>`).join("");
  }

  // highlights
  const highlights = Array.isArray(data.highlights) ? data.highlights : null;
  if (highlights && highlights.length) {
    const wrap = $("#aboutHighlights");
    wrap.innerHTML = highlights.map(h => `<span class="pill">${escapeHtml(h)}</span>`).join("");
  }

  $("#pageTitle").textContent = `${name} | ${role}`;
});

// ----------------------
// Projects
// ----------------------
const grid = $("#projectsGrid");
const empty = $("#emptyState");
const searchInput = $("#searchInput");
const typeFilter = $("#typeFilter");

let allProjects = [];

const projectsQ = query(collection(db, "projects"), orderBy("createdAt", "desc"));

onSnapshot(projectsQ, (snap) => {
  allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
});

function render() {
  const term = (searchInput.value || "").trim().toLowerCase();
  const type = (typeFilter.value || "").trim();

  const filtered = allProjects.filter(p => {
    const matchesTerm =
      !term ||
      (p.title || "").toLowerCase().includes(term) ||
      (p.description || "").toLowerCase().includes(term) ||
      (p.location || "").toLowerCase().includes(term);

    const matchesType = !type || p.type === type;
    const published = p.published !== false; // default true
    return published && matchesTerm && matchesType;
  });

  if (!filtered.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = filtered.map(p => projectCard(p)).join("");

  grid.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      const project = filtered.find(x => x.id === id);
      if (project) openModal(project);
    });
  });
}

searchInput.addEventListener("input", render);
typeFilter.addEventListener("change", render);

// ----------------------
// Modal
// ----------------------
const modal = $("#modal");
const modalBackdrop = $("#modalBackdrop");
const modalClose = $("#modalClose");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBody");

function openModal(project) {
  modalTitle.textContent = project.title || "Projet";
  modalBody.innerHTML = modalContent(project);
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
modalBackdrop.addEventListener("click", closeModal);
modalClose.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function modalContent(p) {
  const cover = p.coverUrl ? `<img class="modalMedia" src="${p.coverUrl}" alt="">` : "";
  const gallery = Array.isArray(p.galleryUrls) && p.galleryUrls.length
    ? `<div class="grid grid--3" style="margin-top:12px">
        ${p.galleryUrls.map(u => `<img class="modalMedia" src="${u}" alt="">`).join("")}
      </div>` : "";

  const video = p.videoUrl
    ? `<div style="margin-top:12px">
        <video class="modalMedia" controls src="${p.videoUrl}"></video>
      </div>` : "";

  const meta = `
    <div class="projectCard__meta" style="margin-top:12px">
      ${p.type ? `<span class="tag">${escapeHtml(p.type)}</span>` : ""}
      ${p.location ? `<span class="tag">${escapeHtml(p.location)}</span>` : ""}
      ${p.createdAt?.toDate ? `<span class="tag">${new Date(p.createdAt.toDate()).toLocaleDateString()}</span>` : ""}
    </div>
  `;

  return `
    ${cover}
    ${meta}
    <p style="margin-top:12px; color: var(--muted); font-weight:700">
      ${escapeHtml(p.description || "")}
    </p>
    ${gallery}
    ${video}
  `;
}

function projectCard(p) {
  return `
    <article class="card projectCard">
      ${p.coverUrl ? `<img class="projectCard__cover" src="${p.coverUrl}" alt="">` : `<div class="projectCard__cover"></div>`}
      <div class="projectCard__body">
        <h3 class="card__title">${escapeHtml(p.title || "Projet")}</h3>
        <p class="card__text">${escapeHtml(short(p.description || "", 110))}</p>
        <div class="projectCard__meta">
          ${p.type ? `<span class="tag">${escapeHtml(p.type)}</span>` : ""}
          ${p.location ? `<span class="tag">${escapeHtml(p.location)}</span>` : ""}
        </div>
        <div class="projectCard__actions">
          <button class="btn btn--soft" data-open="${p.id}" type="button">Voir détails</button>
        </div>
      </div>
    </article>
  `;
}

function short(s, n) {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
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

// ----------------------
// Quote form -> mailto
// ----------------------
const qForm = $("#quoteForm");
const qErrName = $("#qErrName");
const qErrEmail = $("#qErrEmail");
const qErrMsg = $("#qErrMsg");

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

qForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#qName").value.trim();
  const email = $("#qEmail").value.trim();
  const msg = $("#qMsg").value.trim();

  qErrName.textContent = name ? "" : "Entrez votre nom.";
  qErrEmail.textContent = email ? (isEmail(email) ? "" : "Email invalide.") : "Entrez votre email.";
  qErrMsg.textContent = msg ? "" : "Écrivez un message.";

  if (!name || !email || !isEmail(email) || !msg) return;

  const to = $("#contactEmail").textContent.trim() || "atonlikeumiguel@gmail.com";
  const subject = encodeURIComponent("Demande de devis - Site web");
  const body = encodeURIComponent(
`Bonjour,

Nom: ${name}
Email: ${email}

Message:
${msg}

— Envoyé depuis le site`
  );

  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
});