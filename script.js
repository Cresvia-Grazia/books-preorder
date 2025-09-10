const API_URL = "https://script.google.com/macros/s/AKfycbxljkDj9A77th7-4Ca5SBi-cXbYo6RyzTZ1jrKTvxbro-oXRZkSV6goj-VonYWEX4DEtQ/exec"; // Replace with your Apps Script Web App URL
let books = [];
let cart = [];

// Load Books
async function loadBooks() {
  try {
    const res = await fetch(`${API_URL}?action=getInventory`);
    books = await res.json();
    renderBooks(books);
  } catch (err) {
    console.error("Error loading books", err);
  }
}

function renderBooks(data) {
  const list = document.getElementById("bookList");
  list.innerHTML = "";
  data.forEach(book => {
    const card = document.createElement("div");
    card.className = "book-card";
    card.innerHTML = `
      <img src="${book.imageUrl}" alt="${book.title}">
      <div class="book-info">
        <h4>${book.title}</h4>
        <p><em>${book.author}</em></p>
        <p>Genre: ${book.genre}</p>
        <p>₱${book.discountedPrice || book.price}</p>
        <p>${book.description || ""}</p>
        <button class="add-btn" onclick="addToCart('${book.title}', '${book.author}', ${book.discountedPrice || book.price})">Add</button>
      </div>
    `;
    list.appendChild(card);
  });
}

// Cart
function addToCart(title, author, price) {
  const existing = cart.find(item => item.title === title);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ title, author, price, qty: 1 });
  }
  renderCart();
}

function renderCart() {
  const cartDiv = document.getElementById("cart");
  const totalDiv = document.getElementById("orderTotal");
  cartDiv.innerHTML = "";
  let total = 0;

  cart.forEach(item => {
    total += item.price * item.qty;
    cartDiv.innerHTML += `
      <div class="cart-item">
        <span>${item.title} by ${item.author}</span>
        <span>
          <input type="number" min="1" value="${item.qty}" onchange="updateQty('${item.title}', this.value)">
          ₱${item.price * item.qty}
        </span>
      </div>
    `;
  });

  totalDiv.textContent = `Total: ₱${total}`;
  document.getElementById("confirmOrderBtn").disabled = cart.length === 0;
}

function updateQty(title, qty) {
  const item = cart.find(b => b.title === title);
  if (item) {
    item.qty = parseInt(qty);
    renderCart();
  }
}

// Show Disclaimer
document.getElementById("confirmOrderBtn").addEventListener("click", () => {
  document.getElementById("disclaimerPayment").classList.remove("hidden");
});

// Pickup Location → Populate Dates
document.getElementById("pickupLocation").addEventListener("change", function() {
  const location = this.value;
  const dateSelect = document.getElementById("pickupDate");
  dateSelect.innerHTML = '<option value="">Select a date</option>';

  let allowedDay;
  if (location === "Sacred Heart") allowedDay = 1; // Monday
  if (location === "IT Park") allowedDay = 6; // Saturday
  if (location === "Golden Prince") allowedDay = 6; // Saturday
  if (location === "Ayala") allowedDay = 0; // Sunday

  if (allowedDay === undefined) return;

  // Generate next 8 valid dates
  let today = new Date();
  for (let i = 0; i < 60; i++) { // look ahead 2 months
    let date = new Date();
    date.setDate(today.getDate() + i);
    if (date.getDay() === allowedDay) {
      let iso = date.toISOString().split("T")[0];
      let option = document.createElement("option");
      option.value = iso;
      option.textContent = date.toDateString();
      dateSelect.appendChild(option);
    }
  }
});

// Submit Order with file upload
document.getElementById("orderForm").addEventListener("submit", async function(e) {
  e.preventDefault();

  const formData = new FormData(this);
  const file = document.getElementById("paymentFile").files[0];
  let paymentUrl = "";

  if (file) {
    const uploadData = new FormData();
    uploadData.append("action", "uploadFile");
    uploadData.append("file", file);

    const res = await fetch(API_URL, { method: "POST", body: uploadData });
    const result = await res.json();
    paymentUrl = result.fileUrl || "";
  }

  const order = {
    action: "saveOrder",
    FullName: formData.get("fullName"),
    Email: formData.get("email"),
    ContactNumber: formData.get("contact"),
    FBName: formData.get("fbname"),
    Pickup: formData.get("pickup"),
    PickupDate: formData.get("pickupDate"),
    ItemsJSON: JSON.stringify(cart),
    Total: document.getElementById("orderTotal").innerText.replace("Total: ₱", ""),
    PaymentConfirmed: paymentUrl
  };

  await fetch(API_URL, { method: "POST", body: JSON.stringify(order) });

  alert("✅ Order submitted successfully!");
  cart = [];
  renderCart();
  this.reset();
  document.getElementById("disclaimerPayment").classList.add("hidden");
});

loadBooks();
