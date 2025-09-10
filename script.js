// script.js - frontend
// Replace API_URL with your deployed Apps Script /exec URL if different
const API_URL = "https://script.google.com/macros/s/AKfycbwttBqQuHGjCWInJiM8EGzy9jU_ZuQGeLmVxttcH847BVai_dkV8ew0nvFoOKz7DYtIJg/exec";

let books = [];
let cart = [];

/* DOM refs */
const booksSection = document.getElementById("booksSection");
const searchBox = document.getElementById("searchBox");
const filterRadios = document.querySelectorAll("input[name='filterType']");
const filterDropdown = document.getElementById("filterDropdown");

const cartTbody = document.getElementById("cartTbody");
const cartTotalEl = document.getElementById("cartTotal");
const cartEmptyNotice = document.getElementById("cartEmptyNotice");
const confirmOrderBtn = document.getElementById("confirmOrderBtn");
const clearCartBtn = document.getElementById("clearCartBtn");

const checkoutDetails = document.getElementById("checkoutDetails");
const pickupLocationEl = document.getElementById("pickupLocation");
const calendarEl = document.getElementById("calendar");
const pickupDateIso = document.getElementById("pickupDateIso");
const pickupDateDisplay = document.getElementById("pickupDateDisplay");
const paymentFileEl = document.getElementById("paymentFile");
const submitOrderBtn = document.getElementById("submitOrderBtn");
const cancelCheckoutBtn = document.getElementById("cancelCheckoutBtn");

/* schedule mapping (0=Sun...6=Sat) */
const scheduleMap = {
  "Feast Sacred Heart": 1, // Monday
  "Feast IT Park": 6, // Saturday
  "Feast Golden Prince": 6, // Saturday
  "Feast Ayala": 0 // Sunday
};

/* ---------- utilities ---------- */
function numberFormat(n){ return Number(n).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
function truncate(s,n){ return s.length>n ? s.slice(0,n-1)+"…" : s; }
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

/* ---------- fetch JSON with error handling ---------- */
async function fetchJson(url, opts = {}) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return await r.json();
  } catch (err) {
    console.error("fetchJson error:", err);
    throw err;
  }
}

/* ---------- load inventory on page load ---------- */
async function loadInventory() {
  try {
    booksSection.innerHTML = `<div class="p-4 text-sm">Loading books…</div>`;
    const data = await fetchJson(`${API_URL}?action=getInventory`);
    if (!Array.isArray(data)) {
      booksSection.innerHTML = `<div class="p-4 text-sm text-rose-600">Failed to load inventory — invalid response.</div>`;
      console.error("Invalid inventory response:", data);
      return;
    }
    books = data;
    buildFilterDropdownOptions();
    renderBooks(books);
  } catch (err) {
    booksSection.innerHTML = `<div class="p-4 text-sm text-rose-600">Failed to load inventory — check console and Apps Script deployment.</div>`;
  }
}

/* ---------- render books ---------- */
function renderBooks(list) {
  booksSection.innerHTML = "";
  if (!list.length) {
    booksSection.innerHTML = `<div class="p-4 text-sm">No books found.</div>`;
    return;
  }

  list.forEach((b, idx) => {
    const img = b.imageUrl && b.imageUrl.trim() ? b.imageUrl : "https://via.placeholder.com/400x600?text=No+Image";
    const card = document.createElement("div");
    card.className = "bg-white p-3 rounded shadow-sm";
    card.innerHTML = `
      <img class="book-image mb-3" src="${escapeHtml(img)}" alt="${escapeHtml(b.title)}" />
      <div class="font-semibold">${escapeHtml(b.title)}</div>
      <div class="text-sm text-slate-600">by ${escapeHtml(b.author || "Unknown")}</div>
      <div class="mt-1"><span class="text-xs px-2 py-1 rounded bg-slate-100">${escapeHtml(b.genre || "")}</span></div>
      <div class="text-sky-700 font-semibold mt-2">₱${numberFormat(b.discountedPrice ?? b.price ?? 0)}</div>
      <p class="desc-line text-sm text-slate-600 mt-2">${escapeHtml(truncate(b.description || "", 140))}</p>
      <div class="mt-3"><button class="add-btn bg-emerald-600 text-white px-3 py-1 rounded" data-idx="${idx}">Add to cart</button></div>
    `;
    booksSection.appendChild(card);
  });

  // attach add handlers
  document.querySelectorAll(".add-btn").forEach(btn => btn.addEventListener("click", () => {
    addToCart(Number(btn.dataset.idx));
  }));
}

/* ---------- filters ---------- */
function buildFilterDropdownOptions() {
  // populate dropdown with authors by default (radio toggles between title vs dropdown)
  const authors = Array.from(new Set(books.map(b => (b.author||"").trim()).filter(Boolean))).sort();
  filterDropdown.innerHTML = `<option value="">-- All --</option>`;
  authors.forEach(a => filterDropdown.innerHTML += `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`);
}

filterRadios.forEach(r => r.addEventListener("change", () => {
  const type = document.querySelector("input[name='filterType']:checked").value;
  if (type === "title") {
    searchBox.classList.remove("hidden");
    filterDropdown.classList.add("hidden");
    searchBox.value = "";
    renderBooks(books);
  } else {
    const values = Array.from(new Set(books.map(b => (b[type]||"").trim()).filter(Boolean))).sort();
    filterDropdown.innerHTML = `<option value="">-- All --</option>`;
    values.forEach(v => filterDropdown.innerHTML += `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`);
    searchBox.classList.add("hidden");
    filterDropdown.classList.remove("hidden");
  }
}));

searchBox.addEventListener("input", () => {
  const q = searchBox.value.trim().toLowerCase();
  if (!q) return renderBooks(books);
  renderBooks(books.filter(b => (b.title||"").toLowerCase().includes(q)));
});
filterDropdown.addEventListener("change", () => {
  const type = document.querySelector("input[name='filterType']:checked").value;
  const val = filterDropdown.value;
  if (!val) return renderBooks(books);
  renderBooks(books.filter(b => ((b[type]||"").trim()) === val));
});

/* ---------- cart management ---------- */
function addToCart(bookIndex) {
  const b = books[bookIndex];
  if (!b) return;
  const found = cart.find(i => i.title === b.title && i.author === b.author);
  if (found) found.qty += 1;
  else cart.push({ title: b.title, author: b.author, price: Number(b.discountedPrice ?? b.price ?? 0), qty: 1 });
  renderCart();
}

function renderCart() {
  cartTbody.innerHTML = "";
  if (!cart.length) {
    cartEmptyNotice.classList.remove("hidden");
    cartTotalEl.textContent = "Total: ₱0.00";
    confirmOrderBtn.disabled = true;
    return;
  }
  cartEmptyNotice.classList.add("hidden");
  confirmOrderBtn.disabled = false;

  let total = 0;
  cart.forEach((item, i) => {
    const subtotal = item.price * item.qty;
    total += subtotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2 text-center">${i+1}</td>
      <td class="p-2">${escapeHtml(item.title)}</td>
      <td class="p-2">${escapeHtml(item.author)}</td>
      <td class="p-2 text-center"><input type="number" min="1" value="${item.qty}" data-index="${i}" class="w-20 p-1 border rounded qty-input" /></td>
      <td class="p-2 text-right">₱${numberFormat(subtotal)}</td>
      <
