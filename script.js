const API_URL = "https://script.google.com/macros/s/AKfycbwttBqQuHGjCWInJiM8EGzy9jU_ZuQGeLmVxttcH847BVai_dkV8ew0nvFoOKz7DYtIJg/exec"; 
let allBooks = [];
let cart = [];

// Init
document.addEventListener("DOMContentLoaded", () => {
  loadBooks();

  document.getElementById("searchBox").addEventListener("input", (e) => {
    filterBooks(e.target.value);
  });

  document.getElementById("confirmOrderBtn").addEventListener("click", () => {
    document.getElementById("checkoutDetails").classList.remove("hidden");
  });

  document.getElementById("clearCartBtn").addEventListener("click", () => {
    cart = [];
    renderCart();
  });

  document.getElementById("pickupLocation").addEventListener("change", handlePickupLocation);

  document.getElementById("submitOrderBtn").addEventListener("click", handleSubmitOrder);

  document.getElementById("cancelCheckoutBtn").addEventListener("click", () => {
    document.getElementById("checkoutDetails").classList.add("hidden");
  });
});

// Fetch inventory
async function loadBooks() {
  try {
    const res = await fetch(`${API_URL}?action=getInventory`);
    allBooks = await res.json();
    renderBooks(allBooks);
  } catch (err) {
    console.error(err);
    document.getElementById("booksSection").innerHTML = `<p class="text-red-600">Failed to load inventory.</p>`;
  }
}

// Render book cards
function renderBooks(books) {
  const list = document.getElementById("booksSection");
  list.innerHTML = books.map((b, idx) => `
    <div class="bg-white p-3 rounded shadow flex flex-col">
      <img src="${b.ImageURL || 'https://via.placeholder.com/200x180'}" alt="${b.Title}" class="book-image mb-2">
      <h3 class="font-semibold">${b.Title}</h3>
      <p class="text-sm text-slate-600">by ${b.Author}</p>
      <p class="text-xs text-slate-500">${b.Genre}</p>
      <p class="font-bold text-sky-700 mt-1">₱${b["Discounted Price"] || b.Price}</p>
      <button onclick='addToCart(${idx})' class="mt-auto bg-sky-600 text-white px-3 py-1 rounded text-sm">Reserve</button>
    </div>
  `).join("");
}

// Add to cart
function addToCart(idx) {
  const book = allBooks[idx];
  const existing = cart.find(it => it.Title === book.Title);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...book, qty: 1 });
  }
  renderCart();
}

// Render cart
function renderCart() {
  const tbody = document.getElementById("cartTbody");
  const countEl = document.getElementById("cartCount");
  const totalEl = document.getElementById("cartTotal");
  const emptyNotice = document.getElementById("cartEmptyNotice");

  tbody.innerHTML = "";
  if (!cart.length) {
    countEl.textContent = "0 items";
    totalEl.textContent = "Total: ₱0.00";
    emptyNotice.classList.remove("hidden");
    document.getElementById("confirmOrderBtn").disabled = true;
    return;
  }

  let total = 0;
  cart.forEach((it, i) => {
    const price = it["Discounted Price"] || it.Price;
    total += price * it.qty;
    tbody.innerHTML += `
      <tr>
        <td class="p-2">${i + 1}</td>
        <td class="p-2">${it.Title}</td>
        <td class="p-2">${it.Author}</td>
        <td class="p-2"><input type="number" min="1" value="${it.qty}" class="w-16 border p-1 text-center" onchange="updateQty(${i}, this.value)" /></td>
        <td class="p-2">₱${price * it.qty}</td>
        <td class="p-2"><button class="text-rose-600" onclick="removeFromCart(${i})">✖</button></td>
      </tr>
    `;
  });

  countEl.textContent = `${cart.length} items`;
  totalEl.textContent = `Total: ₱${total.toFixed(2)}`;
  emptyNotice.classList.add("hidden");
  document.getElementById("confirmOrderBtn").disabled = false;
}

function updateQty(i, qty) {
  cart[i].qty = parseInt(qty) || 1;
  renderCart();
}

function removeFromCart(i) {
  cart.splice(i, 1);
  renderCart();
}

// Calendar rendering
function renderCalendar(allowedDay) {
  const calendarEl = document.getElementById("calendar");
  const hiddenIso = document.getElementById("pickupDateIso");
  const displayInput = document.getElementById("pickupDateDisplay");

  calendarEl.innerHTML = "";
  hiddenIso.value = "";
  displayInput.value = "";

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // pad for first day alignment
  for (let i = 0; i < monthStart.getDay(); i++) {
    const empty = document.createElement("div");
    calendarEl.appendChild(empty);
  }

  for (let d = 1; d <= monthEnd.getDate(); d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), d);
    const day = date.getDay();
    const iso = date.toISOString().split("T")[0];

    const cell = document.createElement("div");
    cell.textContent = d;
    cell.className = "calendar-day";

    if (day === allowedDay && date >= today) {
      cell.classList.add("enabled");
      cell.addEventListener("click", () => {
        document.querySelectorAll(".calendar-day").forEach(c => c.classList.remove("selected"));
        cell.classList.add("selected");
        hiddenIso.value = iso;
        displayInput.value = date.toDateString();
      });
    } else {
      cell.classList.add("disabled");
    }

    calendarEl.appendChild(cell);
  }
}

// Pickup location handler
function handlePickupLocation(e) {
  const location = e.target.value;
  let allowedDay;

  if (location.includes("Sacred Heart")) allowedDay = 1; // Monday
  if (location.includes("IT Park")) allowedDay = 6; // Saturday
  if (location.includes("Golden Prince")) allowedDay = 6; // Saturday
  if (location.includes("Ayala")) allowedDay = 0; // Sunday

  if (allowedDay !== undefined) {
    renderCalendar(allowedDay);
  }
}

// Submit order
async function handleSubmitOrder() {
  if (!cart.length) {
    alert("Cart is empty!");
    return;
  }

  const fileInput = document.getElementById("paymentFile");
  let fileUrl = "";
  if (fileInput.files.length > 0) {
    fileUrl = await uploadFile(fileInput.files[0]);
  }

  const payload = {
    action: "saveOrder",
    FullName: document.getElementById("fullName").value,
    Email: document.getElementById("email").value,
    ContactNumber: document.getElementById("contactNumber").value,
    FBName: document.getElementById("fbName").value,
    Pickup: document.getElementById("pickupLocation").value,
    PickupDate: document.getElementById("pickupDateIso").value,
    ItemsJSON: JSON.stringify(cart),
    Total: cart.reduce((sum, it) => sum + ((it["Discounted Price"] || it.Price) * it.qty), 0),
    PaymentConfirmed: fileUrl
  };

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });

  const result = await res.json();
  alert(result.success ? "✅ Order submitted successfully!" : "❌ Error saving order.");
}

// Upload file to Apps Script
async function uploadFile(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      const base64Data = reader.result.split(",")[1];
      const payload = {
        action: "uploadFile",
        data: base64Data,
        filename: file.name,
        mimeType: file.type
      };

      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      });
      const result = await res.json();
      if (result.success) resolve(result.fileUrl);
      else reject("Upload failed");
    };
    reader.readAsDataURL(file);
  });
}
