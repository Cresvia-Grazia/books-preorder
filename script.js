/****************************
 * Replace with your deployed Apps Script exec URL (the web app you will deploy).
 * Example: const API_URL = "https://script.google.com/macros/s/AKf.../exec"
 ****************************/
const API_URL = "https://script.google.com/macros/s/AKfycbwW_rd2hCKoG8Oq0ZU8UI655OHSlMZiTeXRS4B1qRci1BRUnDvqiunn7Tv1tdviJfhezQ/exec";

// State
let books = [];
let cart = [];

// DOM refs
const bookListEl = document.getElementById("bookList");
const searchBox = document.getElementById("searchBox");
const filterRadios = document.querySelectorAll("input[name='filterType']");
const filterDropdown = document.getElementById("filterDropdown");

const cartTbody = document.getElementById("cartTbody");
const cartTotalEl = document.getElementById("cartTotal");
const cartEmptyNotice = document.getElementById("cartEmptyNotice");
const confirmOrderBtn = document.getElementById("confirmOrderBtn");
const clearCartBtn = document.getElementById("clearCartBtn");

const checkoutDetails = document.getElementById("checkoutDetails");
const checkoutForm = document.getElementById("checkoutForm");

const pickupLocationEl = document.getElementById("pickupLocation");
const calendarEl = document.getElementById("calendar");
const pickupDateIsoEl = document.getElementById("pickupDateIso");
const pickupDateDisplayEl = document.getElementById("pickupDateDisplay");

const paymentFileEl = document.getElementById("paymentFile");
const submitOrderBtn = document.getElementById("submitOrderBtn");
const cancelCheckoutBtn = document.getElementById("cancelCheckoutBtn");

// schedule map (weekday numbers: 0=Sun..6=Sat)
const scheduleMap = {
  "Feast Sacred Heart": 1,   // Monday
  "Feast IT Park": 6,        // Saturday
  "Feast Golden Prince": 6,  // Saturday
  "Feast Ayala": 0           // Sunday
};

/* ---------- fetch helper ---------- */
async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`HTTP ${r.status}: ${txt}`);
  }
  return r.json();
}

/* ---------- load inventory ---------- */
async function loadInventory() {
  try {
    const data = await fetchJson(`${API_URL}?action=getInventory`);
    if (!Array.isArray(data)) throw new Error("inventory response not array");
    books = data;
    buildFilterDropdownOptions(); // fill dropdown for author/genre
    renderBooks(books);
  } catch (err) {
    console.error("loadInventory error", err);
    bookListEl.innerHTML = `<div class="p-4 text-sm text-red-600">Failed to load inventory — check Apps Script console and web app deployment.</div>`;
  }
}

/* ---------- render books ---------- */
function renderBooks(list) {
  bookListEl.innerHTML = "";
  if (!list.length) {
    bookListEl.innerHTML = `<div class="p-4 text-sm text-slate-600">No books match your search.</div>`;
    return;
  }

  list.forEach((b, idx) => {
    const card = document.createElement("div");
    card.className = "bg-white p-3 rounded shadow-sm";

    const imageUrl = (b.imageUrl && b.imageUrl.trim()) ? b.imageUrl : "https://via.placeholder.com/400x600?text=No+Image";

    card.innerHTML = `
      <img class="book-image mb-3 rounded" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(b.title)}">
      <div class="mb-1">
        <div class="font-semibold text-slate-800">${escapeHtml(b.title)}</div>
        <div class="text-sm text-slate-600">by ${escapeHtml(b.author || "Unknown")}</div>
      </div>
      <div class="flex items-center justify-between gap-2">
        <div><span class="text-xs py-1 px-2 rounded bg-slate-100 text-slate-700 mr-2">${escapeHtml(b.genre || "")}</span></div>
        <div class="text-sky-700 font-semibold">₱${numberFormat(b.discountedPrice ?? b.price ?? 0)}</div>
      </div>
      <p class="desc-line text-sm text-slate-600 mt-2">${escapeHtml(truncate(b.description || "", 140))}</p>
      <div class="mt-3">
        <button class="add-btn bg-emerald-600 text-white px-3 py-1 rounded" data-index="${idx}">Add to cart</button>
      </div>
    `;
    bookListEl.appendChild(card);
  });

  // attach handlers
  document.querySelectorAll(".add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      addToCart(idx);
    });
  });
}

/* ---------- filtering ---------- */
function buildFilterDropdownOptions() {
  // default fill with authors
  const authors = Array.from(new Set(books.map(b => (b.author||"").trim()).filter(Boolean))).sort();
  const genres = Array.from(new Set(books.map(b => (b.genre||"").trim()).filter(Boolean))).sort();

  filterDropdown.innerHTML = `<option value="">-- All --</option>`;
  authors.forEach(a => filterDropdown.innerHTML += `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`);

  // event
  filterDropdown.addEventListener("change", applyFilter);
}

filterRadios.forEach(r => r.addEventListener("change", () => {
  const type = document.querySelector("input[name='filterType']:checked").value;
  if (type === "title") {
    searchBox.classList.remove("hidden");
    filterDropdown.classList.add("hidden");
    searchBox.value = "";
    renderBooks(books);
  } else {
    // populate dropdown with appropriate values
    const values = Array.from(new Set(books.map(b => (b[type]||"").trim()).filter(Boolean))).sort();
    filterDropdown.innerHTML = `<option value="">-- All --</option>`;
    values.forEach(v => filterDropdown.innerHTML += `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`);
    searchBox.classList.add("hidden");
    filterDropdown.classList.remove("hidden");
  }
}));

searchBox.addEventListener("input", () => {
  const q = searchBox.value.trim().toLowerCase();
  if (!q) renderBooks(books);
  else renderBooks(books.filter(b => (b.title||"").toLowerCase().includes(q)));
});

function applyFilter() {
  const type = document.querySelector("input[name='filterType']:checked").value;
  const val = filterDropdown.value;
  if (!val) renderBooks(books);
  else renderBooks(books.filter(b => ((b[type]||"").trim()) === val));
}

/* ---------- CART ---------- */
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
  cart.forEach((it, i) => {
    const subtotal = it.price * it.qty;
    total += subtotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2 text-center">${i+1}</td>
      <td class="p-2">${escapeHtml(it.title)}</td>
      <td class="p-2">${escapeHtml(it.author)}</td>
      <td class="p-2 text-center"><input type="number" min="1" value="${it.qty}" data-index="${i}" class="w-20 p-1 border rounded qty-input" /></td>
      <td class="p-2 text-right">₱${numberFormat(subtotal)}</td>
      <td class="p-2 text-center"><button class="remove-btn text-rose-600" data-index="${i}">✖</button></td>
    `;
    cartTbody.appendChild(tr);
  });

  // qty change
  document.querySelectorAll(".qty-input").forEach(inp => inp.addEventListener("change", (e) => {
    const idx = Number(e.target.dataset.index);
    const v = Math.max(1, parseInt(e.target.value) || 1);
    cart[idx].qty = v;
    renderCart();
  }));

  // remove
  document.querySelectorAll(".remove-btn").forEach(b => b.addEventListener("click", (e) => {
    const idx = Number(e.target.dataset.index);
    cart.splice(idx,1);
    renderCart();
  }));

  cartTotalEl.textContent = `Total: ₱${numberFormat(total)}`;
}

clearCartBtn.addEventListener("click", () => {
  if (!cart.length) return;
  if (!confirm("Clear cart?")) return;
  cart = [];
  renderCart();
});

/* ---------- checkout reveal ---------- */
confirmOrderBtn.addEventListener("click", () => {
  if (!cart.length) { alert("Your cart is empty."); return; }
  checkoutDetails.classList.remove("hidden");
  checkoutDetails.scrollIntoView({ behavior: "smooth" });
});

cancelCheckoutBtn.addEventListener("click", () => {
  checkoutDetails.classList.add("hidden");
});

/* ---------- calendar renderer (grays out disallowed days) ---------- */
function renderCalendarForWeekday(targetWeekday) {
  calendarEl.innerHTML = ""; // weekday headers
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  weekdays.forEach(d => {
    const hdr = document.createElement("div");
    hdr.className = "text-xs font-medium text-center text-slate-600";
    hdr.textContent = d;
    calendarEl.appendChild(hdr);
  });

  // build next 8 weeks (56 days) starting from today
  const daysToShow = 56;
  const today = new Date();
  // compute first cell: go back to start of week (Sunday) to fill grid nicely
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay()+7)%7));

  for (let i = 0; i < daysToShow; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const iso = day.toISOString().split("T")[0];
    const human = day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day text-xs";

    // disabled if before tomorrow? allow starting tomorrow or next occurrence: permit from tomorrow onwards
    const tomorrow = new Date();
    tomorrow.setDate((new Date()).getDate() + 0); // allow today also - adjust if not desired
    if (day < tomorrow) {
      dayEl.classList.add("disabled");
      dayEl.textContent = day.getDate();
      calendarEl.appendChild(dayEl);
      continue;
    }

    if (day.getDay() === targetWeekday) {
      dayEl.classList.add("enabled");
      dayEl.textContent = day.getDate();
      dayEl.title = human;
      dayEl.addEventListener("click", () => {
        // clear previous selected
        document.querySelectorAll(".calendar-day.selected").forEach(n => n.classList.remove("selected"));
        dayEl.classList.add("selected");
        pickupDateIsoEl.value = iso;
        pickupDateDisplayEl.value = day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      });
    } else {
      dayEl.classList.add("disabled");
      dayEl.textContent = day.getDate();
      dayEl.title = human;
    }
    calendarEl.appendChild(dayEl);
  }
}

/* ---------- pickup location change ---------- */
pickupLocationEl.addEventListener("change", () => {
  const val = pickupLocationEl.value;
  if (!val) {
    calendarEl.innerHTML = "";
    pickupDateIsoEl.value = "";
    pickupDateDisplayEl.value = "";
    return;
  }
  const weekday = scheduleMap[val];
  if (weekday === undefined) {
    calendarEl.innerHTML = "";
    return;
  }
  renderCalendarForWeekday(weekday);
});


/* ---------- file upload to Apps Script (base64) ---------- */
async function uploadFileToAppsScript(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        // evt.target.result -> data:[<mediatype>][;base64],<data>
        const dataUrl = evt.target.result;
        const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
        if (!match) throw new Error("Invalid file data");
        const mime = match[1];
        const base64 = match[2];
        const payload = {
          action: "uploadFile",
          filename: file.name,
          mimeType: mime,
          data: base64
        };

        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json && (json.success || json.fileUrl)) resolve(json.fileUrl || json.url || "");
        else reject(new Error("Upload failed: " + JSON.stringify(json)));
      } catch (err) { reject(err); }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/* ---------- submit order ---------- */
submitOrderBtn.addEventListener("click", async () => {
  try {
    // basic validations
    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const contact = document.getElementById("contactNumber").value.trim();
    const fb = document.getElementById("fbName").value.trim();
    const pickupLocation = pickupLocationEl.value;
    const pickupIso = pickupDateIsoEl.value;

    if (!name || !email || !contact || !pickupLocation || !pickupIso) {
      alert("Please complete required fields and choose a pickup date.");
      return;
    }

    // upload file if present
    let fileUrl = "";
    const file = paymentFileEl.files[0];
    if (file) {
      submitOrderBtn.disabled = true;
      submitOrderBtn.textContent = "Uploading file...";
      try {
        fileUrl = await uploadFileToAppsScript(file);
      } catch (err) {
        console.error("File upload error", err);
        alert("File upload failed. Check console. You can still submit without file.");
      } finally {
        submitOrderBtn.disabled = false;
        submitOrderBtn.textContent = "Submit Order";
      }
    }

    // prepare order payload
    const items = cart.map(i => ({ title: i.title, author: i.author, price: i.price, qty: i.qty }));
    const total = cart.reduce((s,i)=> s + (i.price * i.qty), 0);

    const payload = {
      action: "saveOrder",
      FullName: name,
      Email: email,
      ContactNumber: contact,
      FBName: fb,
      Pickup: `${pickupLocation} - ${pickupIso}`,
      ItemsJSON: JSON.stringify(items),
      Total: total,
      PaymentConfirmed: fileUrl || ""
    };

    // send order
    submitOrderBtn.disabled = true;
    submitOrderBtn.textContent = "Submitting order...";
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    submitOrderBtn.disabled = false;
    submitOrderBtn.textContent = "Submit Order";

    if (json && (json.success || json.ref || json.orderId || json.status === "success")) {
      alert("Order submitted! Reference: " + (json.ref || json.orderId || "saved"));
      // reset
      cart = [];
      renderCart();
      checkoutDetails.classList.add("hidden");
      document.getElementById("checkoutForm").reset();
      calendarEl.innerHTML = "";
      pickupDateIsoEl.value = "";
      pickupDateDisplayEl.value = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      console.error("saveOrder returned:", json);
      alert("Order submission returned unexpected response. Check console.");
    }

  } catch (err) {
    console.error("submitOrder error", err);
    alert("Error submitting order. Check console.");
    submitOrderBtn.disabled = false;
    submitOrderBtn.textContent = "Submit Order";
  }
});

/* ---------- utilities ---------- */
function numberFormat(n){ return Number(n).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
function truncate(s,n){ return s.length>n ? s.slice(0,n-1)+"…" : s; }
function escapeHtml(s){ return String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

/* ---------- init ---------- */
loadInventory();
renderCart(); // initial empty
