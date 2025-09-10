// ✅ Replace with your Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbxmDVXy6zQ5aLvJp0MvQ-I0so8Av6CLLrwCxbSl9fsZKJAzlyboyj7qjwEh-vFJyi53wQ/exec";

let books = [];
let cart = [];

// Fetch books from Google Sheets
async function fetchBooks() {
  try {
    const res = await fetch(API_URL);
    books = await res.json();
    displayBooks(books);
  } catch (err) {
    console.error("Error fetching books:", err);
  }
}

// Display books in the left panel
function displayBooks(data) {
  const list = document.getElementById("bookList");
  list.innerHTML = "";

  data.forEach((book) => {
    const li = document.createElement("li");
    li.className = "border p-2 rounded hover:bg-gray-100 cursor-pointer";
    li.innerHTML = `
      <div class="flex items-start space-x-3">
        <img src="${book.imageUrl || 'https://via.placeholder.com/50'}" alt="${book.title}" class="w-12 h-16 object-cover rounded">
        <div class="flex-1">
          <strong>${book.title}</strong><br>
          <small>by ${book.author} | ${book.genre}</small><br>
          <span class="text-sm text-gray-600">Stock: ${book.stock}</span><br>
          <span class="text-sm text-green-700 font-bold">
            ₱${book.discountedPrice || book.price}
          </span>
          ${book.discountedPrice ? `<span class="line-through text-gray-400 ml-1">₱${book.price}</span>` : ""}
        </div>
        <button 
          class="bg-blue-600 text-white px-2 py-1 rounded text-sm"
          onclick="addToCart(${book.id})">
          Add
        </button>
      </div>
    `;
    list.appendChild(li);
  });
}

// Add book to cart
function addToCart(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book || book.stock <= 0) {
    alert("Out of stock!");
    return;
  }

  const existing = cart.find(item => item.id === bookId);
  if (existing) {
    if (existing.qty < book.stock) {
      existing.qty += 1;
    } else {
      alert("No more stock available for this item.");
    }
  } else {
    cart.push({ ...book, qty: 1 });
  }
  renderCart();
}

// Render cart items in right panel
function renderCart() {
  const cartTable = document.getElementById("cartItems");
  cartTable.innerHTML = "";

  cart.forEach((item, idx) => {
    const price = item.discountedPrice || item.price;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="border p-2">${idx + 1}</td>
      <td class="border p-2">${item.title} <br><small>by ${item.author}</small></td>
      <td class="border p-2">
        <input 
          type="number" 
          min="1" 
          max="${item.stock}"
          value="${item.qty}" 
          class="w-16 border rounded p-1 text-center"
          onchange="updateQty(${item.id}, this.value)"
        />
      </td>
      <td class="border p-2">₱${price}</td>
    `;
    cartTable.appendChild(tr);
  });
}

// Update quantity in cart
function updateQty(bookId, qty) {
  const item = cart.find(c => c.id === bookId);
  if (item) {
    const stock = item.stock;
    let q = parseInt(qty) || 1;
    if (q > stock) q = stock;
    item.qty = q;
    renderCart();
  }
}

// Filter handler
document.querySelectorAll("input[name='filter']").forEach(radio => {
  radio.addEventListener("change", () => {
    const selected = document.querySelector("input[name='filter']:checked").value;
    const dropdown = document.getElementById("dropdownFilter");
    const filterOptions = document.getElementById("filterOptions");

    if (selected === "title") {
      dropdown.classList.add("hidden");
      displayBooks(books);
    } else {
      dropdown.classList.remove("hidden");

      // Unique filter values
      const values = [...new Set(books.map(b => b[selected]))];
      filterOptions.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join("");

      filterOptions.onchange = () => {
        const filtered = books.filter(b => b[selected] === filterOptions.value);
        displayBooks(filtered);
      };
    }
  });
});

// Handle form submission
document.getElementById("orderForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  const formData = new FormData(this);
  const order = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    contact: formData.get("contact"),
    fbName: formData.get("fbName"),
    pickupLocation: formData.get("pickupLocation"),
    pickupDate: formData.get("pickupDate"),
    cart: cart
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(order)
    });
    const result = await res.json();
    alert("Order submitted successfully! Reference: " + result.ref);
    this.reset();
    cart = [];
    renderCart();
  } catch (err) {
    console.error("Error submitting order:", err);
    alert("Failed to submit order. Try again later.");
  }
});

// Load books on page load
fetchBooks();
