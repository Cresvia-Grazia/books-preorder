// --- CONFIG ---
const API_URL = "https://script.google.com/macros/s/AKfycbzbBOqJOnedz96QvM_dwgkSr7S9Q-XOZ8ihYGRCaTit43qA9uo5QzW_ENmUb7S17efA8A/exec";

// Store books and cart
let books = [];
let cart = [];

// --- FETCH INVENTORY ---
async function loadBooks() {
  try {
    const res = await fetch(`${API_URL}?action=getInventory`);
    const data = await res.json();
    books = data;
    renderBooks();
  } catch (err) {
    console.error("Error loading books", err);
  }
}

// --- RENDER BOOK LIST ---
function renderBooks(filter = "title", value = "") {
  const list = document.getElementById("bookList");
  list.innerHTML = "";

  let filteredBooks = books;
  if (value) {
    filteredBooks = books.filter(book =>
      book[filter].toLowerCase().includes(value.toLowerCase())
    );
  }

  filteredBooks.forEach((book, i) => {
    const card = document.createElement("div");
    card.className = "book-card";
    card.innerHTML = `
      <div class="book-title">${book.title}</div>
      <div class="book-author">by ${book.author}</div>
      <div class="book-price">₱${book.discountedPrice || book.price}</div>
      <p class="book-desc">${book.description || ""}</p>
      <button onclick="addToCart(${i})">Add to Cart</button>
    `;
    list.appendChild(card);
  });
}

// --- CART FUNCTIONS ---
function addToCart(index) {
  const book = books[index];
  if (!book) return;

  const existing = cart.find(item => item.id === index);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: index, title: book.title, author: book.author, price: book.discountedPrice || book.price, qty: 1 });
  }
  renderCart();
}

function updateQty(id, qty) {
  const item = cart.find(i => i.id === id);
  if (item) {
    let q = parseInt(qty) || 1;
    if (q < 1) q = 1;
    item.qty = q;
    renderCart();
  }
}

function removeItem(id) {
  cart = cart.filter(i => i.id !== id);
  renderCart();
}

// --- RENDER CART ---
function renderCart() {
  const tbody = document.querySelector("#cartTable tbody");
  tbody.innerHTML = "";

  let total = 0;
  cart.forEach((item, i) => {
    const row = document.createElement("tr");
    const subTotal = item.qty * item.price;
    total += subTotal;

    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${item.title}</td>
      <td>${item.author}</td>
      <td><input type="number" min="1" value="${item.qty}" onchange="updateQty(${item.id}, this.value)"></td>
      <td>₱${subTotal.toFixed(2)}</td>
      <td><button onclick="removeItem(${item.id})">❌</button></td>
    `;
    tbody.appendChild(row);
  });

  document.getElementById("orderTotal").innerHTML = `<strong>Total: ₱${total.toFixed(2)}</strong>`;
}

// --- CONFIRM ORDER TOGGLE ---
document.getElementById("confirmOrderBtn").addEventListener("click", () => {
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }
  document.getElementById("extraDetails").style.display = "block";
  document.getElementById("confirmOrderBtn").style.display = "none";
});

// --- PICKUP DATE LOGIC ---
const pickupSchedule = {
  "Feast Sacred Heart": "Monday",
  "Feast IT Park": "Saturday",
  "Feast Golden Prince": "Saturday",
  "Feast Ayala": "Sunday"
};

document.getElementById("pickupLocation").addEventListener("change", e => {
  const location = e.target.value;
  const allowedDay = pickupSchedule[location];
  if (!allowedDay) return;

  const today = new Date();
  let nextDate = new Date(today);

  // find next allowed day
  while (nextDate.toLocaleDateString("en-US", { weekday: "long" }) !== allowedDay) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  const yyyy = nextDate.getFullYear();
  const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
  const dd = String(nextDate.getDate()).padStart(2, "0");

  const pickupDateInput = document.getElementById("pickupDate");
  pickupDateInput.value = `${yyyy}-${mm}-${dd}`;
  pickupDateInput.min = `${yyyy}-${mm}-${dd}`;
  pickupDateInput.max = `${yyyy}-${mm}-${dd}`;
});

// --- SUBMIT ORDER ---
document.getElementById("submitOrderBtn").addEventListener("click", async () => {
  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const contact = document.getElementById("contact").value.trim();
  const fbName = document.getElementById("fbName").value.trim();
  const pickup = document.getElementById("pickupLocation").value;
  const date = document.getElementById("pickupDate").value;
  const paymentProof = document.getElementById("paymentProof").files[0];

  if (!fullName || !email || !contact || !fbName || !pickup || !date || !paymentProof) {
    alert("Please complete all required fields and upload payment proof.");
    return;
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const order = {
    FullName: fullName,
    Email: email,
    ContactNumber: contact,
    FBName: fbName,
    Pickup: `${pickup} - ${date}`,
    ItemsJSON: JSON.stringify(cart),
    Total: total,
    PaymentConfirmed: "Pending"
  };

  try {
    const res = await fetch(`${API_URL}?action=saveOrder`, {
      method: "POST",
      body: JSON.stringify(order),
      headers: { "Content-Type": "application/json" }
    });

    const result = await res.json();
    if (result.success) {
      alert("Order submitted successfully!");
      location.reload();
    } else {
      alert("Failed to submit order.");
    }
  } catch (err) {
    console.error(err);
    alert("Error submitting order.");
  }
});

// --- INIT ---
loadBooks();
