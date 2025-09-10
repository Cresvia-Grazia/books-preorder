const API_URL = "https://script.google.com/macros/s/AKfycbwttBqQuHGjCWInJiM8EGzy9jU_ZuQGeLmVxttcH847BVai_dkV8ew0nvFoOKz7DYtIJg/exec"; // replace with your /exec link
let allBooks = [];
let orderItems = [];

// Load books on page ready
document.addEventListener("DOMContentLoaded", () => {
  loadBooks();

  document.getElementById("searchInput").addEventListener("input", (e) => {
    filterBooks(e.target.value);
  });

  document.getElementById("confirmOrderBtn").addEventListener("click", showDisclaimerForm);

  document.getElementById("pickupLocation").addEventListener("change", handlePickupLocation);

  document.getElementById("customerForm").addEventListener("submit", handleSubmitOrder);
});

// Fetch inventory
async function loadBooks() {
  try {
    const res = await fetch(`${API_URL}?action=getInventory`);
    allBooks = await res.json();
    renderBooks(allBooks);
  } catch (err) {
    console.error(err);
    document.getElementById("bookList").innerHTML = `<p style="color:red">Failed to load inventory.</p>`;
  }
}

// Render book cards
function renderBooks(books) {
  const bookList = document.getElementById("bookList");
  bookList.innerHTML = books.map(b => `
    <div class="book-card">
      <img src="${b.ImageURL || 'https://via.placeholder.com/100'}" alt="${b.Title}">
      <h3>${b.Title}</h3>
      <p><strong>Author:</strong> ${b.Author}</p>
      <p><strong>Genre:</strong> ${b.Genre}</p>
      <p><strong>Price:</strong> ₱${b["Discounted Price"] || b.Price}</p>
      <button onclick='addToOrder(${JSON.stringify(b)})'>Reserve</button>
    </div>
  `).join("");
}

// Add to order
function addToOrder(book) {
  orderItems.push({...book, qty: 1});
  renderOrder();
}

function renderOrder() {
  const orderDiv = document.getElementById("orderSummary");
  if (!orderItems.length) {
    orderDiv.innerHTML = "<p>No items selected.</p>";
    document.getElementById("confirmOrderBtn").disabled = true;
    return;
  }

  let total = 0;
  orderDiv.innerHTML = orderItems.map((it, idx) => {
    const price = it["Discounted Price"] || it.Price;
    total += price * it.qty;
    return `<p>${idx+1}. "${it.Title}" by ${it.Author} — ₱${price} x ${it.qty}</p>`;
  }).join("") + `<hr><p><strong>Total: ₱${total}</strong></p>`;

  document.getElementById("confirmOrderBtn").disabled = false;
}

// Show disclaimer + form
function showDisclaimerForm() {
  document.getElementById("disclaimer").classList.remove("hidden");
  document.getElementById("customerForm").classList.remove("hidden");
}

// Handle pickup restriction
function handlePickupLocation(e) {
  const location = e.target.value;
  const dateInput = document.getElementById("pickupDate");
  const today = new Date();
  let allowedDay;

  if (location.includes("Sacred Heart")) allowedDay = 1; // Monday
  if (location.includes("IT Park")) allowedDay = 6; // Saturday
  if (location.includes("Golden Prince")) allowedDay = 6; // Saturday
  if (location.includes("Ayala")) allowedDay = 0; // Sunday

  // Find next allowed date
  let nextDate = new Date(today);
  nextDate.setDate(today.getDate() + ((7 + allowedDay - today.getDay()) % 7 || 7));

  // Restrict input
  dateInput.min = nextDate.toISOString().split("T")[0];
  dateInput.value = nextDate.toISOString().split("T")[0];

  // Gray out invalid days
  dateInput.oninput = () => {
    const chosen = new Date(dateInput.value);
    if (chosen.getDay() !== allowedDay) {
      alert("Invalid date for selected location. Please pick the allowed day.");
      dateInput.value = nextDate.toISOString().split("T")[0];
    }
  };
}

// Handle form submit
async function handleSubmitOrder(e) {
  e.preventDefault();

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
    PickupDate: document.getElementById("pickupDate").value,
    ItemsJSON: JSON.stringify(orderItems),
    Total: orderItems.reduce((sum, it) => sum + ((it["Discounted Price"] || it.Price) * it.qty), 0),
    PaymentConfirmed: fileUrl
  };

  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });

  const result = await res.json();
  alert(result.success ? "Order submitted successfully!" : "Error saving order.");
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
