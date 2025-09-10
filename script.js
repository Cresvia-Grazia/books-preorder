const API_URL = "https://script.google.com/macros/s/AKfycbzbBOqJOnedz96QvM_dwgkSr7S9Q-XOZ8ihYGRCaTit43qA9uo5QzW_ENmUb7S17efA8A/exec"; // replace with your Apps Script Web App URL

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

// Add to Cart
function addToCart(title, author, price) {
  const existing = cart.find(item => item.title === title);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ title, author, price, qty: 1 });
  }
  renderCart();
}

// Render Cart
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

// Confirm Order
document.getElementById("confirmOrderBtn").addEventListener("click", () => {
  document.getElementById("disclaimerPayment").classList.remove("hidden");
});

// Pickup Location → Auto Date
document.getElementById("pickupLocation").addEventListener("change", function() {
  const location = this.value;
  let nextDate = getNextPickupDate(location);
  document.getElementById("pickupDate").value = nextDate;
});

// Get next available date
function getNextPickupDate(location) {
  const today = new Date();
  let dayOfWeek;

  if (location === "Sacred Heart") dayOfWeek = 1; // Monday
  if (location === "IT Park") dayOfWeek = 6; // Saturday
  if (location === "Golden Prince") dayOfWeek = 6; // Saturday
  if (location === "Ayala") dayOfWeek = 0; // Sunday

  let date = new Date(today);
  while (date.getDay() !== dayOfWeek) {
    date.setDate(date.getDate() + 1);
  }
  return date.toDateString();
}

loadBooks();
