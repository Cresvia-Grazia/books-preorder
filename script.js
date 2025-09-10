const API_URL = "https://script.google.com/macros/s/AKfycbxmDVXy6zQ5aLvJp0MvQ-I0so8Av6CLLrwCxbSl9fsZKJAzlyboyj7qjwEh-vFJyi53wQ/exec";

let books = [];
let cart = [];

// Fetch books from Google Sheets
async function fetchBooks() {
  try {
    const res = await fetch(API_URL);
    books = await res.json();
    renderBooks(books);
  } catch (err) {
    console.error("Error fetching books:", err);
  }
}

// Render book list
function renderBooks(list) {
  const bookList = document.getElementById("bookList");
  bookList.innerHTML = "";
  list.forEach(book => {
    const div = document.createElement("div");
    div.className = "p-3 border rounded shadow-sm";
    div.innerHTML = `
      <img src="${book.imageUrl}" alt="${book.title}" class="w-full h-40 object-cover mb-2">
      <h3 class="font-semibold">${book.title}</h3>
      <p class="text-sm">by ${book.author}</p>
      <p class="text-sm">${book.genre}</p>
      <p class="font-bold text-blue-600">₱${book.discountedPrice || book.price}</p>
      <button onclick="addToCart(${book.id})" class="bg-green-600 text-white px-3 py-1 rounded mt-2">Add to Cart</button>
    `;
    bookList.appendChild(div);
  });
}

// Add book to cart
function addToCart(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;
  const existing = cart.find(item => item.id === bookId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...book, qty: 1 });
  }
  renderCart();
}

// Render cart
function renderCart() {
  const cartItems = document.getElementById("cartItems");
  cartItems.innerHTML = "";
  let total = 0;

  cart.forEach((item, i) => {
    const price = Number(item.discountedPrice || item.price) * item.qty;
    total += price;
    cartItems.innerHTML += `
      <div class="border-b py-2">
        ${item.title} by ${item.author} 
        <input type="number" min="1" value="${item.qty}" 
          onchange="updateQty(${i}, this.value)" 
          class="w-12 p-1 border ml-2 text-center"> 
        <button onclick="removeFromCart(${i})" class="text-red-600 ml-2">x</button>
        <span class="float-right">₱${price}</span>
      </div>
    `;
  });

  document.getElementById("cartTotal").textContent = "Total: ₱" + total;
}

// Update quantity
function updateQty(index, qty) {
  let q = parseInt(qty) || 1;
  if (q < 1) q = 1;
  cart[index].qty = q;
  renderCart();
}

// Remove item
function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

// Filter books
document.querySelectorAll("input[name=filterType]").forEach(radio => {
  radio.addEventListener("change", () => {
    const type = document.querySelector("input[name=filterType]:checked").value;
    const inputWrapper = document.getElementById("filterInputWrapper");
    if (type === "author" || type === "genre") {
      inputWrapper.innerHTML = `<select id="filterInput" class="w-full p-2 border rounded"></select>`;
      const options = [...new Set(books.map(b => b[type]))];
      const select = document.getElementById("filterInput");
      select.innerHTML = `<option value="">-- All --</option>`;
      options.forEach(opt => {
        select.innerHTML += `<option value="${opt}">${opt}</option>`;
      });
      select.addEventListener("change", applyFilter);
    } else {
      inputWrapper.innerHTML = `<input type="text" id="filterInput" placeholder="Search by ${type}..." class="w-full p-2 border rounded">`;
      document.getElementById("filterInput").addEventListener("input", applyFilter);
    }
  });
});

function applyFilter() {
  const type = document.querySelector("input[name=filterType]:checked").value;
  const val = document.getElementById("filterInput").value.toLowerCase();
  if (!val) return renderBooks(books);
  renderBooks(books.filter(b => String(b[type]).toLowerCase().includes(val)));
}

// Handle order submit
document.getElementById("orderSubmitForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  const order = {
    fullName: document.getElementById("fullName").value,
    email: document.getElementById("email").value,
    contactNumber: document.getElementById("contactNumber").value,
    fbName: document.getElementById("fbName").value,
    pickup: document.getElementById("pickup").value,
    pickupDate: document.getElementById("pickupDate").value,
    items: cart,
    total: cart.reduce((sum, i) => sum + (Number(i.discountedPrice || i.price) * i.qty), 0),
    paymentConfirmed: !!document.getElementById("paymentFile").files.length
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(order),
      headers: { "Content-Type": "application/json" }
    });
    const result = await res.json();
    alert("Order submitted successfully! Reference ID: " + result.orderId);
    cart = [];
    renderCart();
    e.target.reset();
  } catch (err) {
    console.error("Error submitting order:", err);
    alert("Failed to submit order. Try again later.");
  }
});

// Init
fetchBooks();
