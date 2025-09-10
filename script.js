// -----------------------------
// CONFIG: put your Apps Script exec URL here
// -----------------------------
const API_URL = "https://script.google.com/macros/s/AKfycbzbBOqJOnedz96QvM_dwgkSr7S9Q-XOZ8ihYGRCaTit43qA9uo5QzW_ENmUb7S17efA8A/exec";
// If you redeploy and URL changed, replace above with new exec URL.

// -----------------------------
// State
// -----------------------------
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
const goToCartBtn = document.getElementById("goToCartBtn");

const pickupLocationEl = document.getElementById("pickupLocation");
const pickupDateHidden = document.getElementById("pickupDate");
const pickupDateDisplay = document.getElementById("pickupDateDisplay");

const submitOrderBtn = document.getElementById("submitOrderBtn");
const cancelCheckoutBtn = document.getElementById("cancelCheckoutBtn");

// -----------------------------
// Helper: fetch JSON with error handling
// -----------------------------
async function fetchJson(url, opts = {}) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return await r.json();
  } catch (err) {
    console.error("Fetch error:", err);
    throw err;
  }
}

// -----------------------------
// Load inventory
// -----------------------------
async function loadInventory() {
  try {
    const data = await fetchJson(`${API_URL}?action=getInventory`);
    if (!Array.isArray(data)) {
      console.error("Inventory response not array:", data);
      bookListEl.innerHTML = `<div class="p-4 text-sm text-rose-600">Failed to load inventory — check Apps Script.</div>`;
      return;
    }
    books = data;
    buildFilterDropdownOptions();
    renderBooks(books);
  } catch (err) {
    bookListEl.innerHTML = `<div class="p-4 text-sm text-rose-600">Error loading books. Open console for details.</div>`;
  }
}

// -----------------------------
// Build filter dropdown when author/genre chosen
// -----------------------------
function buildFilterDropdownOptions() {
  const authors = Array.from(new Set(books.map(b => (b.author || "").trim()).filter(Boolean))).sort();
  const genres = Array.from(new Set(books.map(b => (b.genre || "").trim()).filter(Boolean))).sort();

  filterDropdown.innerHTML = `<option value="">-- All --</option>`;
  // default fill with authors; actual shown depends on radio selection
  authors.forEach(a => filterDropdown.innerHTML += `<option value="${a}">${a}</option>`);

  // attach event
  filterDropdown.addEventListener("change", () => applyFilter());
}

// -----------------------------
// Render book cards
// -----------------------------
function renderBooks(list) {
  bookListEl.innerHTML = "";
  if (!list.length) {
    bookListEl.innerHTML = `<div class="p-4 text-sm text-slate-600">No books match your search.</div>`;
    return;
  }

  list.forEach((b, idx) => {
    const card = document.createElement("div");
    card.className = "bg-white p-3 rounded shadow-sm";

    const imageUrl = b.imageUrl && b.imageUrl.trim() ? b.imageUrl : "https://via.placeholder.com/300x400?text=No+Image";

    card.innerHTML = `
      <img class="book-image mb-3 rounded" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(b.title)}">
      <div class="mb-1">
        <div class="font-semibold text-slate-800">${escapeHtml(b.title)}</div>
        <div class="text-sm text-slate-600">by ${escapeHtml(b.author || "Unknown")}</div>
      </div>
      <div class="flex items-center justify-between gap-2">
        <div>
          <span class="text-xs py-1 px-2 rounded bg-slate-100 text-slate-700 mr-2">${escapeHtml(b.genre || "")}</span>
        </div>
        <div class="text-sky-700 font-semibold">₱${numberFormat(b.discountedPrice ?? b.price ?? 0)}</div>
      </div>
      <p class="desc-line text-sm text-slate-600 mt-2">${escapeHtml(truncate(b.description || "", 140))}</p>

      <div class="mt-3">
        <button class="add-btn bg-emerald-600 text-white px-3 py-1 rounded" data-index="${idx}">Add to cart</button>
      </div>
    `;

    bookListEl.appendChild(card);
  });

  // attach add handlers
  document.querySelectorAll(".add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-index"));
      addToCart(idx);
    });
  });
}

// -----------------------------
// FILTERS: text search and radio/dropdown handlers
// -----------------------------
function applyFilter() {
  const type = document.querySelector("input[name='filterType']:checked").value;
  let value = "";

  if (type === "title") {
    value = searchBox.value.trim().toLowerCase();
    if (!value) return renderBooks(books);
    renderBooks(books.filter(b => (b.title || "").toLowerCase().includes(value)));
  } else {
    // author or genre uses dropdown
    value = filterDropdown.value.trim();
    if (!value) return renderBooks(books);
    renderBooks(books.filter(b => ((b[type] || "").trim()) === value));
  }
}

// radio change toggles search vs dropdown
filterRadios.forEach(radio => radio.addEventListener("change", () => {
  const type = document.querySelector("input[name='filterType']:checked").value;
  if (type === "title") {
    searchBox.classList.remove("hidden");
    filterDropdown.classList.add("hidden");
    // reset dropdown value
    filterDropdown.value = "";
    searchBox.placeholder = "Search by title...";
  } else {
    // populate dropdown with appropriate values
    const values = Array.from(new Set(books.map(b => (b[type] || "").trim()).filter(Boolean))).sort();
    filterDropdown.innerHTML = `<option value="">-- All --</option>`;
    values.forEach(v => filterDropdown.innerHTML += `<option value="${v}">${v}</option>`);
    searchBox.classList.add("hidden");
    filterDropdown.classList.remove("hidden");
  }
}));

searchBox.addEventListener("input", () => applyFilter());

// -----------------------------
// CART: add / update / remove / render
// -----------------------------
function addToCart(bookIndex) {
  const b = books[bookIndex];
  if (!b) return;
  const found = cart.find(i => i.title === b.title && i.author === b.author);
  if (found) {
    found.qty += 1;
  } else {
    cart.push({
      title: b.title,
      author: b.author,
      price: Number(b.discountedPrice ?? b.price ?? 0),
      qty: 1
    });
  }
  renderCart();
}

function renderCart() {
  cartTbody.innerHTML = "";
  if (!cart.length) {
    cartEmptyNotice.classList.remove("hidden");
    cartEmptyNotice.textContent = "Your cart is empty.";
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
      <td class="p-2 text-center">${i + 1}</td>
      <td class="p-2">${escapeHtml(item.title)}</td>
      <td class="p-2">${escapeHtml(item.author)}</td>
      <td class="p-2 text-center">
        <input type="number" min="1" value="${item.qty}" data-index="${i}" class="w-20 p-1 border rounded text-center qty-input" />
      </td>
      <td class="p-2 text-right">₱${numberFormat(subtotal)}</td>
      <td class="p-2 text-center">
        <button class="remove-btn text-rose-600" data-index="${i}">✖</button>
      </td>
    `;
    cartTbody.appendChild(tr);
  });

  // attach qty handlers
  document.querySelectorAll(".qty-input").forEach(inp => {
    inp.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.index);
      const val = Math.max(1, parseInt(e.target.value) || 1);
      cart[idx].qty = val;
      renderCart();
    });
  });

  // attach remove handlers
  document.querySelectorAll(".remove-btn").forEach(b => {
    b.addEventListener("click", (e) => {
      const idx = Number(e.target.dataset.index);
      cart.splice(idx, 1);
      renderCart();
    });
  });

  cartTotalEl.textContent = `Total: ₱${numberFormat(total)}`;
}

// clear cart
clearCartBtn.addEventListener("click", () => {
  if (!cart.length) return;
  if (!confirm("Clear cart?")) return;
  cart = [];
  renderCart();
});

// -----------------------------
// Confirm order -> reveal checkout
// -----------------------------
confirmOrderBtn.addEventListener("click", () => {
  if (!cart.length) {
    alert("Your cart is empty.");
    return;
  }
  checkoutDetails.classList.remove("hidden");
  checkoutDetails.scrollIntoView({ behavior: "smooth" });
});

// cancel checkout
cancelCheckoutBtn.addEventListener("click", () => {
  checkoutDetails.classList.add("hidden");
});

// -----------------------------
// Pickup date logic: next available date only
// -----------------------------
const scheduleMap = {
  "Feast Sacred Heart": 1,   // Monday
  "Feast IT Park": 6,        // Saturday
  "Feast Golden Prince": 6,  // Saturday
  "Feast Ayala": 0           // Sunday
};

pickupLocationEl.addEventListener("change", () => {
  const val = pickupLocationEl.value;
  if (!val) {
    pickupDateDisplay.value = "";
    pickupDateHidden.value = "";
    return;
  }
  const weekday = scheduleMap[val];
  if (weekday === undefined) {
    pickupDateDisplay.value = "";
    pickupDateHidden.value = "";
    return;
  }

  const next = getNextWeekdayDate(weekday);
  pickupDateHidden.value = next.iso;
  pickupDateDisplay.value = `${next.human} (${next.iso})`; // e.g., Monday, Sep 15 2025 (2025-09-15)
});

// get next date for given weekday (0=Sun..6=Sat)
function getNextWeekdayDate(targetWeekday) {
  const today = new Date();
  const todayDay = today.getDay();
  let daysToAdd = (targetWeekday - todayDay + 7) % 7;
  if (daysToAdd === 0) daysToAdd = 7; // next week's same weekday (if you want next occurrence - change if today allowed)
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysToAdd);

  const iso = nextDate.toISOString().split("T")[0];
  const human = nextDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  return { iso, human };
}

// -----------------------------
// Submit order
// -----------------------------
submitOrderBtn.addEventListener("click", async () => {
  const name = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const contact = document.getElementById("contactNumber").value.trim();
  const fbName = document.getElementById("fbName").value.trim();
  const pickupLocation = pickupLocationEl.value;
  const pickupDateIso = pickupDateHidden.value;
  const paymentFile = document.getElementById("paymentFile").files[0];
  const notes = document.getElementById("orderNotes").value.trim();

  if (!name || !email || !contact || !pickupLocation || !pickupDateIso) {
    alert("Please complete your details, choose a pickup location, and ensure a pickup date is set.");
    return;
  }

  if (!paymentFile) {
    if (!confirm("No payment proof uploaded. Are you sure you want to continue?")) {
      return;
    }
  }

  // Prepare ItemsJSON
  const items = cart.map(i => ({ title: i.title, author: i.author, price: i.price, qty: i.qty }));

  const payload = {
    FullName: name,
    Email: email,
    ContactNumber: contact,
    FBName: fbName,
    Pickup: `${pickupLocation} - ${pickupDateIso}`,
    ItemsJSON: JSON.stringify(items),
    Total: cart.reduce((s, it) => s + it.price * it.qty, 0),
    PaymentConfirmed: paymentFile ? "Yes" : "No",
    Notes: notes
    // Note: file content upload not implemented here (would require multipart/form-data & Apps Script handling)
  };

  try {
    const res = await fetch(`${API_URL}?action=saveOrder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json && (json.success || json.ref || json.orderId || json.status === "success")) {
      alert("Order submitted! Reference: " + (json.ref || json.orderId || "saved"));
      // reset
      cart = [];
      renderCart();
      checkoutDetails.classList.add("hidden");
      document.getElementById("checkoutForm").reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      console.error("Unexpected response:", json);
      alert("Order submission returned unexpected response. Check console.");
    }
  } catch (err) {
    console.error("Submit error:", err);
    alert("Failed to submit order. See console for details.");
  }
});

// -----------------------------
// go to cart button (mobile)
goToCartBtn.addEventListener("click", () => {
  document.getElementById("orderSection").scrollIntoView({ behavior: "smooth" });
});

// -----------------------------
// UTILITIES
// -----------------------------
function numberFormat(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}
function escapeHtml(unsafe) {
  return String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// -----------------------------
// init
// -----------------------------
loadInventory();
renderCart();
