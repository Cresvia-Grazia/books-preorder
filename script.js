// script.js
const API_URL = "https://script.google.com/macros/s/AKfycbxmDVXy6zQ5aLvJp0MvQ-I0so8Av6CLLrwCxbSl9fsZKJAzlyboyj7qjwEh-vFJyi53wQ/exec";
// Replace above if you deploy to a different web app URL.

let inventory = []; // will hold books from spreadsheet
let cart = [];      // { title, author, price, qty, rowIndex? }

/////////////////////
// Helper utilities
function numberFormat(n){ return Number(n).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

/////////////////////
// Load inventory
async function loadInventory(){
  try {
    document.getElementById("booksSection").innerHTML = `<div class="p-4 text-sm text-slate-500">Loading books...</div>`;
    const res = await fetch(`${API_URL}?action=getInventory`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid inventory response: " + JSON.stringify(data));
    // Normalize fields: prefer headers Title,Author,Genre,Price,Discounted Price,Location,Stock,ImageURL,Description
    inventory = data.map(row => ({
      title: row.Title ?? row.title ?? row.Title ?? "",
      author: row.Author ?? row.author ?? "",
      genre: row.Genre ?? row.genre ?? "",
      price: Number(row["Price"] ?? row.price ?? 0) || 0,
      discounted: Number(row["Discounted Price"] ?? row.discountedPrice ?? row["Discounted Price"] ?? row.discounted || 0) || 0,
      location: row.Location ?? row.location ?? "",
      stock: row.Stock ?? row.stock ?? "",
      imageUrl: row.ImageURL ?? row.imageUrl ?? "",
      description: row.Description ?? row.description ?? ""
    }));
    renderBooks(inventory);
    buildFilterDropdowns();
  } catch (err) {
    console.error("loadInventory error", err);
    document.getElementById("booksSection").innerHTML = `<div class="p-4 text-sm text-rose-600">Failed to load inventory — check Apps Script deployment and spreadsheet access. See console.</div>`;
  }
}

/////////////////////
// Render books
function renderBooks(list){
  const sec = document.getElementById("booksSection");
  sec.innerHTML = "";
  if (!list.length) {
    sec.innerHTML = `<div class="p-4 text-sm text-slate-600">No books found.</div>`;
    return;
  }

  list.forEach((b, idx) => {
    const price = (b.discounted && b.discounted > 0) ? b.discounted : b.price;
    const img = b.imageUrl && b.imageUrl.trim() ? b.imageUrl : "https://via.placeholder.com/400x600?text=No+Image";
    const card = document.createElement("article");
    card.className = "bg-white p-3 rounded shadow-sm flex flex-col";
    card.innerHTML = `
      <img src="${escapeHtml(img)}" alt="${escapeHtml(b.title)}" class="book-image mb-3">
      <div class="mb-1">
        <div class="font-semibold text-slate-800">${escapeHtml(b.title)}</div>
        <div class="text-sm text-slate-600">by ${escapeHtml(b.author || "Unknown")}</div>
      </div>
      <div class="flex items-center justify-between gap-2 mt-auto">
        <div><span class="text-xs py-1 px-2 rounded bg-slate-100 text-slate-700">${escapeHtml(b.genre || "")}</span></div>
        <div class="text-sky-700 font-semibold">₱${numberFormat(price)}</div>
      </div>
      <button class="mt-3 bg-emerald-600 text-white px-3 py-1 rounded text-sm" data-idx="${idx}">Add</button>
    `;
    sec.appendChild(card);
  });

  // attach add handlers
  document.querySelectorAll("#booksSection button[data-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.idx);
      addToCart(i);
    });
  });
}

/////////////////////
// Filters
function buildFilterDropdowns(){
  // prepare dropdown when user selects author/genre
  const authors = Array.from(new Set(inventory.map(b => (b.author||"").trim()).filter(Boolean))).sort();
  const genres = Array.from(new Set(inventory.map(b => (b.genre||"").trim()).filter(Boolean))).sort();
  // initial hidden
  const dd = document.getElementById("filterDropdown");
  dd.innerHTML = "";
  // wire radio changes
  document.querySelectorAll("input[name='filterType']").forEach(r => r.addEventListener("change", () => {
    const type = document.querySelector("input[name='filterType']:checked").value;
    if (type === "title") {
      dd.classList.add("hidden");
      document.getElementById("searchBox").classList.remove("hidden");
      document.getElementById("searchBox").value = "";
      renderBooks(inventory);
    } else {
      // populate ddl for author or genre
      dd.innerHTML = `<option value="">-- All --</option>`;
      const values = (type === "author") ? authors : genres;
      values.forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; dd.appendChild(o); });
      dd.classList.remove("hidden");
      document.getElementById("searchBox").classList.add("hidden");
    }
  }));

  // dropdown change filter
  dd.addEventListener("change", () => {
    const type = document.querySelector("input[name='filterType']:checked").value;
    const val = dd.value;
    if (!val) renderBooks(inventory);
    else renderBooks(inventory.filter(b => ((b[type]||"").trim()) === val));
  });

  // search box filter
  document.getElementById("searchBox").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) renderBooks(inventory);
    else renderBooks(inventory.filter(b => (b.title||"").toLowerCase().includes(q)));
  });
}

/////////////////////
// Cart management
function addToCart(idx){
  const b = inventory[idx];
  if (!b) return;
  const existing = cart.find(it => it.title === b.title && it.author === b.author);
  if (existing) existing.qty += 1;
  else cart.push({
    title: b.title,
    author: b.author,
    price: (b.discounted && b.discounted > 0) ? b.discounted : b.price,
    qty: 1
  });
  renderCart();
}

function updateQty(index, qty){
  cart[index].qty = Math.max(1, parseInt(qty) || 1);
  renderCart();
}

function removeFromCart(index){
  cart.splice(index,1);
  renderCart();
}

function clearCart(){
  cart = [];
  renderCart();
}

function renderCart(){
  const tbody = document.getElementById("cartTbody");
  const count = document.getElementById("cartCount");
  const totalEl = document.getElementById("cartTotal");
  const emptyNotice = document.getElementById("cartEmptyNotice");
  tbody.innerHTML = "";
  if (!cart.length) {
    count.textContent = "0 items";
    totalEl.textContent = "Total: ₱0.00";
    emptyNotice.style.display = "block";
    document.getElementById("confirmOrderBtn").disabled = true;
    return;
  }
  emptyNotice.style.display = "none";
  let total = 0;
  cart.forEach((it, i) => {
    const subtotal = it.price * it.qty;
    total += subtotal;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2 text-center">${i+1}</td>
      <td class="p-2">${escapeHtml(it.title)}</td>
      <td class="p-2">${escapeHtml(it.author)}</td>
      <td class="p-2 text-center"><input type="number" min="1" value="${it.qty}" data-i="${i}" class="w-20 p-1 border rounded qty-input" /></td>
      <td class="p-2 text-right">₱${numberFormat(subtotal)}</td>
      <td class="p-2 text-center"><button class="remove-btn text-rose-600" data-i="${i}">✖</button></td>
    `;
    tbody.appendChild(tr);
  });

  // wire qty change & remove
  document.querySelectorAll(".qty-input").forEach(inp => inp.addEventListener("change", (e) => {
    const i = Number(e.target.dataset.i); updateQty(i, e.target.value);
  }));
  document.querySelectorAll(".remove-btn").forEach(b => b.addEventListener("click", (e) => {
    const i = Number(e.target.dataset.i); removeFromCart(i);
  }));

  count.textContent = `${cart.length} items`;
  totalEl.textContent = `Total: ₱${numberFormat(total)}`;
  document.getElementById("confirmOrderBtn").disabled = false;
}

/////////////////////
// Confirm and save reservation
document.getElementById("confirmOrderBtn").addEventListener("click", async () => {
  if (!cart.length) { alert("Cart is empty"); return; }
  // show checkout area (we will save immediately on confirm)
  // Collect pickup information via prompt modal (simple)
  const pickup = prompt("Select pickup location (type exactly):\nFeast Sacred Heart\nFeast IT Park\nFeast Golden Prince\nFeast Ayala", "Feast Sacred Heart");
  if (!pickup) return;
  // Validate pickup mapping to allowed weekdays (we won't enforce date here; user will choose date in form)
  // Save reservation now
  try {
    const payload = {
      action: "saveReservation",
      cart: cart,
      pickupLocation: pickup,
      total: cart.reduce((s,i)=> s + (i.price * i.qty), 0)
    };
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json && json.success && json.orderId) {
      // show saved confirmation and provide link to form
      document.getElementById("checkoutDetails").classList.remove("hidden");
      document.getElementById("savedOrderBox").innerHTML = `<div class="p-2 bg-slate-100 rounded">Order saved. Order ID: <strong>${json.orderId}</strong></div>`;
      // enable open form button and store orderId on button
      const formBtn = document.getElementById("openFormBtn");
      formBtn.disabled = false;
      formBtn.dataset.orderId = json.orderId;
      // open the form in new tab (view form URL constructed from form ID)
      formBtn.onclick = () => {
        // your public form (view) URL:
        const formUrl = "https://docs.google.com/forms/d/151aja0bTJXGiW-wN0Peo7nUIIbNLpMyEetKhPOWnscU/viewform";
        window.open(formUrl, "_blank");
        alert("Please enter Order ID (" + json.orderId + ") in the form so we can match your payment.");
      };
      // clear cart
      cart = [];
      renderCart();
    } else {
      throw new Error(JSON.stringify(json));
    }
  } catch (err) {
    console.error("saveReservation error", err);
    alert("Failed to save reservation — check console.");
  }
});

document.getElementById("clearCartBtn").addEventListener("click", () => {
  if (!cart.length) return;
  if (confirm("Clear cart?")) { cart = []; renderCart(); }
});
document.getElementById("closeCheckoutBtn").addEventListener("click", () => {
  document.getElementById("checkoutDetails").classList.add("hidden");
});

/////////////////////
// INIT
window.addEventListener("DOMContentLoaded", () => {
  loadInventory();
  renderCart();
});
