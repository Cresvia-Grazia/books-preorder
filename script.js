// script.js - debug-ready frontend
const API_URL = "https://script.google.com/macros/s/AKfycbz2F2csUU5GOmNykeORlbMF58FiGH7iwS5AQFefcPSKXv2u_tv8zOyGuBTgReYSwOfV/exec";
// If you redeploy, replace the above with your /exec URL.

let inventory = [];
let cart = [];

// DOM refs
const booksSection = document.getElementById("booksSection");
const searchBox = document.getElementById("searchBox");
const cartArea = document.getElementById("cartArea");
const cartTotal = document.getElementById("cartTotal");
const confirmBtn = document.getElementById("confirmBtn");
const checkoutSection = document.getElementById("checkout");
const pickupLocation = document.getElementById("pickupLocation");
const calendarEl = document.getElementById("calendar");
const pickupIso = document.getElementById("pickupIso");
const pickupDisplay = document.getElementById("pickupDisplay");
const paymentFile = document.getElementById("paymentFile");

const scheduleMap = {
  "Feast Sacred Heart": 1,
  "Feast IT Park": 6,
  "Feast Golden Prince": 6,
  "Feast Ayala": 0
};

document.addEventListener("DOMContentLoaded", () => {
  setupHandlers();
  healthCheck();
  loadInventory();
});

function setupHandlers() {
  searchBox.addEventListener("input", () => {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) renderBooks(inventory);
    else renderBooks(inventory.filter(b => (b.title||"").toLowerCase().includes(q) || (b.author||"").toLowerCase().includes(q) || (b.genre||"").toLowerCase().includes(q)));
  });

  confirmBtn.addEventListener("click", () => {
    if (!cart.length) return alert("Cart empty");
    checkoutSection.classList.remove("hidden");
    checkoutSection.scrollIntoView({behavior:"smooth"});
  });

  document.getElementById("healthBtn").addEventListener("click", healthCheck);
  document.getElementById("backupBtn").addEventListener("click", backupInventory);

  document.getElementById("submitOrder").addEventListener("click", submitOrder);
  document.getElementById("cancel").addEventListener("click", () => checkoutSection.classList.add("hidden"));

  pickupLocation.addEventListener("change", () => {
    const val = pickupLocation.value;
    if (!val) { calendarEl.innerHTML=""; pickupIso.value=""; pickupDisplay.value=""; return; }
    const weekday = scheduleMap[val];
    renderCalendarForWeekday(weekday);
  });
}

async function healthCheck() {
  try {
    console.log("→ health check");
    const res = await fetch(`${API_URL}?action=health`);
    const j = await res.json();
    console.log("health:", j);
    alert("Health: " + JSON.stringify(j));
  } catch (err) {
    console.error("Health error", err);
    alert("Health check failed — check console.");
  }
}

async function backupInventory() {
  try {
    const res = await fetch(`${API_URL}?action=backupInventory`);
    const j = await res.json();
    console.log("backup:", j);
    if (j && j.success) alert("Backup created: " + j.fileUrl);
    else alert("Backup failed: " + (j.error || JSON.stringify(j)));
  } catch (err) {
    console.error("Backup error", err);
    alert("Backup failed — check console.");
  }
}

async function loadInventory() {
  try {
    booksSection.innerHTML = `<div class="p-4 text-sm">Loading books...</div>`;
    const res = await fetch(`${API_URL}?action=getInventory`);
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("inventory response not array", data);
      booksSection.innerHTML = `<div class="p-4 text-sm text-rose-600">Failed to load inventory — check Apps Script and web app deployment.</div>`;
      return;
    }
    inventory = data;
    renderBooks(inventory);
  } catch (err) {
    console.error("loadInventory error", err);
    booksSection.innerHTML = `<div class="p-4 text-sm text-rose-600">Failed to load inventory — see console.</div>`;
  }
}

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
      <div class="mt-1"><span class="text-xs px-2 py-1 rounded bg-slate-100">${escapeHtml(b.genre||"")}</span></div>
      <div class="text-sky-700 font-semibold mt-2">₱${numberFormat(b.discountedPrice ?? b.price ?? 0)}</div>
      <p class="desc-line text-sm text-slate-600 mt-2">${escapeHtml(truncate(b.description || "", 120))}</p>
      <div class="mt-3"><button class="px-3 py-1 bg-emerald-600 text-white rounded add-btn" data-idx="${idx}">Add to cart</button></div>
    `;
    booksSection.appendChild(card);
  });

  document.querySelectorAll(".add-btn").forEach(btn => btn.addEventListener("click", () => {
    addToCart(Number(btn.dataset.idx));
  }));
}

function addToCart(idx) {
  const b = inventory[idx];
  if (!b) return;
  const found = cart.find(i => i.title === b.title && i.author === b.author);
  if (found) found.qty++;
  else cart.push({ title: b.title, author: b.author, price: Number(b.discountedPrice ?? b.price ?? 0), qty: 1 });
  renderCart();
}

function renderCart() {
  cartArea.innerHTML = "";
  if (!cart.length) {
    cartArea.innerHTML = `<div class="text-sm text-slate-500">Your cart is empty.</div>`;
    cartTotal.textContent = "Total: ₱0.00";
    confirmBtn.disabled = true;
    return;
  }
  confirmBtn.disabled = false;
  let total = 0;
  cart.forEach((it, i) => {
    const subtotal = it.price * it.qty;
    total += subtotal;
    const div = document.createElement("div");
    div.className = "flex items-center justify-between gap-2";
    div.innerHTML = `<div>${escapeHtml(it.title)} <span class="text-xs text-slate-500">by ${escapeHtml(it.author)}</span></div>
      <div><input type="number" min="1" value="${it.qty}" data-i="${i}" class="w-20 p-1 border rounded qty" /> ₱${numberFormat(subtotal)} <button class="text-rose-600 remove" data-i="${i}">✖</button></div>`;
    cartArea.appendChild(div);
  });

  document.querySelectorAll(".qty").forEach(inp => inp.addEventListener("change", (e) => {
    const i = Number(e.target.dataset.i);
    cart[i].qty = Math.max(1, parseInt(e.target.value) || 1);
    renderCart();
  }));
  document.querySelectorAll(".remove").forEach(b => b.addEventListener("click", (e) => {
    const i = Number(e.target.dataset.i);
    cart.splice(i,1);
    renderCart();
  }));

  cartTotal.textContent = `Total: ₱${numberFormat(total)}`;
}

/* ---------- calendar (grayed/disabled days) ---------- */
function renderCalendarForWeekday(weekdayTarget) {
  calendarEl.innerHTML = "";
  // weekday header
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  days.forEach(d => {
    const h = document.createElement("div");
    h.textContent = d;
    h.className = "text-xs font-medium text-center text-slate-600";
    calendarEl.appendChild(h);
  });

  const showDays = 56; // 8 weeks
  const today = new Date();
  // Start at start of week (Sunday)
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());

  for (let i = 0; i < showDays; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const iso = day.toISOString().split("T")[0];
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day text-xs text-center p-2";

    // allow from today (or tomorrow if you want)
    const minAllowed = new Date(); // change if you want to disallow today
    if (day < minAllowed) {
      dayEl.classList.add("disabled");
      dayEl.textContent = day.getDate();
      calendarEl.appendChild(dayEl);
      continue;
    }

    if (day.getDay() === weekdayTarget) {
      dayEl.classList.add("enabled");
      dayEl.textContent = day.getDate();
      dayEl.title = day.toLocaleDateString();
      dayEl.addEventListener("click", () => {
        document.querySelectorAll(".calendar-day.selected").forEach(n => n.classList.remove("selected"));
        dayEl.classList.add("selected");
        pickupIso.value = iso;
        pickupDisplay.value = day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      });
    } else {
      dayEl.classList.add("disabled");
      dayEl.textContent = day.getDate();
      dayEl.title = day.toLocaleDateString();
    }
    calendarEl.appendChild(dayEl);
  }
}

/* ---------- file upload helper (base64) ---------- */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      // data:[mime];base64,xxxxx
      const dataUrl = r.result;
      const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
      if (!m) return reject(new Error("Invalid file data"));
      resolve({ mime: m[1], base64: m[2] });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------- submit order flow ---------- */
async function submitOrder() {
  try {
    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const contact = document.getElementById("contact").value.trim();
    const fb = document.getElementById("fbname").value.trim();
    const pickLoc = pickupLocation.value;
    const pickIso = pickupIso.value;

    if (!name || !email || !contact || !pickLoc || !pickIso) {
      return alert("Please complete required fields & pick a date.");
    }
    if (!cart.length) return alert("Cart is empty.");

    let fileUrl = "";
    if (paymentFile && paymentFile.files && paymentFile.files[0]) {
      const f = paymentFile.files[0];
      const { mime, base64 } = await readFileAsBase64(f);
      console.log("Uploading file:", f.name, mime);
      const uplRes = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uploadFile", filename: f.name, mimeType: mime, data: base64 })
      });
      const uplJson = await uplRes.json();
      console.log("upload file response:", uplJson);
      if (uplJson && uplJson.success) fileUrl = uplJson.fileUrl;
      else console.warn("File upload failed:", uplJson);
    }

    // Prepare payload
    const items = cart.map(i => ({ title: i.title, author: i.author, price: i.price, qty: i.qty }));
    const total = cart.reduce((s,i) => s + (i.price * i.qty), 0);
    const payload = {
      action: "saveOrder",
      FullName: name,
      Email: email,
      ContactNumber: contact,
      FBName: fb,
      Pickup: `${pickLoc} - ${pickIso}`,
      ItemsJSON: JSON.stringify(items),
      Total: total,
      PaymentConfirmed: fileUrl || ""
    };

    // Save order
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    console.log("saveOrder response:", json);
    if (json && json.success) {
      alert("Order submitted — ref: " + json.orderId);
      cart = [];
      renderCart();
      checkoutSection.classList.add("hidden");
      document.getElementById("checkoutForm").reset();
      calendarEl.innerHTML = "";
      pickupIso.value = "";
      pickupDisplay.value = "";
    } else {
      console.error("Order save failed:", json);
      alert("Order failed — check console.");
    }
  } catch (err) {
    console.error("submitOrder error", err);
    alert("Order submission error — check console.");
  }
}

/* ---------- utilities ---------- */
function numberFormat(n){ return Number(n).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
function truncate(s,n){ return s.length>n ? s.slice(0,n-1)+"…" : s; }
function escapeHtml(s){ return String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
