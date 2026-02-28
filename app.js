/* Twiscent Candles - Vanilla JS cart + quantity + UPI
   - No backend: purely client-side
   - Saves cart + UPI settings to localStorage
*/

const PRODUCTS = [
  { id: "c1", name: "Eucalyptus Mint", emoji: "🌿", price: 199, note: "Fresh • Clean • Spa vibe" },
  { id: "c2", name: "Vanilla Bean", emoji: "🍦", price: 249, note: "Warm • Sweet • Classic" },
  { id: "c3", name: "Rose Oud",        emoji: "🌹", price: 299, note: "Luxury • Bold • Date night" },
  { id: "c4", name: "Mocha Latte",     emoji: "☕", price: 279, note: "Coffee • Cozy • Winter" },
  { id: "c5", name: "Fresh Linen",     emoji: "🧺", price: 229, note: "Soft • Clean • Airy" },
  { id: "c6", name: "Lavender Calm",   emoji: "🌸", price: 219, note: "Relaxing • Floral • Sleep" },
];

const LS_CART = "twiscent_cart_v1";
const LS_UPI  = "twiscent_upi_v1";

const elProducts   = document.getElementById("products");
const elCartList   = document.getElementById("cartList");
const elCartEmpty  = document.getElementById("cartEmpty");
const elCartItems  = document.getElementById("cartItems");
const elCartTotal  = document.getElementById("cartTotal");
const elPayBtn     = document.getElementById("payUpiBtn");
const elClearCart  = document.getElementById("clearCart");

const elUpiId      = document.getElementById("upiId");
const elPayeeName  = document.getElementById("payeeName");
const elSaveUpi    = document.getElementById("saveUpi");

// ---------- State ----------
let cart = loadCart(); // { [productId]: qty }
let upi = loadUpi();   // { upiId, payeeName }

// ---------- Init ----------
renderProducts();
renderCart();
hydrateUpiInputs();
wireUpiSave();
wireClearCart();
wirePayButton();

function renderProducts() {
  elProducts.innerHTML = PRODUCTS.map(p => productCardHTML(p)).join("");

  // Qty + / - handlers (shop)
  elProducts.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const pid = btn.dataset.id;
    const input = elProducts.querySelector(`input[data-qty="${pid}"]`);
    if (!input) return;

    let val = clampInt(parseInt(input.value || "1", 10), 1, 99);

    if (action === "dec") val = Math.max(1, val - 1);
    if (action === "inc") val = Math.min(99, val + 1);

    input.value = String(val);
  });

  // Add to Cart / Buy Now (shop)
  elProducts.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const buy = e.target.closest("[data-buy]");
    if (!add && !buy) return;

    const pid = (add || buy).dataset.id;
    const qtyInput = elProducts.querySelector(`input[data-qty="${pid}"]`);
    const qty = clampInt(parseInt(qtyInput?.value || "1", 10), 1, 99);

    const product = PRODUCTS.find(x => x.id === pid);
    if (!product) return;

    if (add) {
      cart[pid] = (cart[pid] || 0) + qty;
      saveCart();
      renderCart();
      toast(`Added ${qty} × ${product.name}`);
      return;
    }

    if (buy) {
      // pay for this item only
      const amount = product.price * qty;
      const tn = `Twiscent Order - ${product.name} x${qty}`;
      const url = buildUpiUrl(amount, tn);
      if (!url) {
        toast("Set UPI ID first (scroll to UPI Setup)");
        location.hash = "#upi";
        return;
      }
      window.location.href = url;
    }
  });

  // manual input validation
  elProducts.addEventListener("change", (e) => {
    const input = e.target.closest('input[data-qty]');
    if (!input) return;
    input.value = String(clampInt(parseInt(input.value || "1", 10), 1, 99));
  });
}

function productCardHTML(p) {
  return `
    <article class="product card">
      <div class="p-top">
        <div class="p-emoji">${p.emoji}</div>
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <p class="muted small">${escapeHtml(p.note)}</p>
        </div>
        <div class="price">₹${p.price}</div>
      </div>

      <div class="p-actions">
        <div class="qty" aria-label="Quantity selector">
          <button type="button" data-action="dec" data-id="${p.id}" aria-label="Decrease">−</button>
          <input type="number" min="1" max="99" value="1" data-qty="${p.id}" aria-label="Quantity input" />
          <button type="button" data-action="inc" data-id="${p.id}" aria-label="Increase">+</button>
        </div>

        <button class="btn ghost" type="button" data-add="1" data-id="${p.id}">Add to Cart</button>
        <button class="btn primary" type="button" data-buy="1" data-id="${p.id}">Buy Now</button>
      </div>
    </article>
  `;
}

// ---------- Cart UI ----------
function renderCart() {
  const entries = Object.entries(cart).filter(([,qty]) => qty > 0);

  if (entries.length === 0) {
    elCartEmpty.style.display = "block";
    elCartList.style.display = "none";
    elCartList.innerHTML = "";
  } else {
    elCartEmpty.style.display = "none";
    elCartList.style.display = "grid";
    elCartList.innerHTML = entries.map(([pid, qty]) => cartRowHTML(pid, qty)).join("");
  }

  const { itemsCount, total } = cartTotals();
  elCartItems.textContent = String(itemsCount);
  elCartTotal.textContent = String(total);

  // Update Pay button link target dynamically
  const payUrl = buildUpiUrl(total, `Twiscent Cart Order - ${itemsCount} item(s)`);
  elPayBtn.href = payUrl || "#upi";
  elPayBtn.setAttribute("aria-disabled", payUrl ? "false" : "true");

  // wire row actions (delegation)
  elCartList.onclick = (e) => {
    const act = e.target.closest("[data-cart-action]");
    if (!act) return;

    const action = act.dataset.cartAction;
    const pid = act.dataset.id;
    const product = PRODUCTS.find(x => x.id === pid);
    if (!product) return;

    if (action === "dec") {
      cart[pid] = Math.max(1, (cart[pid] || 1) - 1);
      saveCart(); renderCart();
    }
    if (action === "inc") {
      cart[pid] = Math.min(99, (cart[pid] || 1) + 1);
      saveCart(); renderCart();
    }
    if (action === "remove") {
      delete cart[pid];
      saveCart(); renderCart();
      toast(`Removed ${product.name}`);
    }
  };
}

function cartRowHTML(pid, qty) {
  const p = PRODUCTS.find(x => x.id === pid);
  if (!p) return "";

  const lineTotal = p.price * qty;

  return `
    <div class="cart-row">
      <div class="left">
        <div class="emoji">${p.emoji}</div>
        <div>
          <h4>${escapeHtml(p.name)}</h4>
          <div class="sub">₹${p.price} each</div>
        </div>
      </div>

      <div class="right">
        <div class="qty" aria-label="Cart quantity selector">
          <button type="button" data-cart-action="dec" data-id="${p.id}" aria-label="Decrease">−</button>
          <input type="number" min="1" max="99" value="${qty}" disabled />
          <button type="button" data-cart-action="inc" data-id="${p.id}" aria-label="Increase">+</button>
        </div>

        <div class="line-total">₹${lineTotal}</div>

        <button class="icon-btn" type="button" data-cart-action="remove" data-id="${p.id}">
          Remove
        </button>
      </div>
    </div>
  `;
}

// ---------- UPI ----------
function hydrateUpiInputs() {
  if (upi.upiId) elUpiId.value = upi.upiId;
  if (upi.payeeName) elPayeeName.value = upi.payeeName;
}

function wireUpiSave() {
  elSaveUpi.addEventListener("click", () => {
    const upiId = (elUpiId.value || "").trim();
    const payeeName = (elPayeeName.value || "Twiscent Candles").trim();

    if (!upiId || !upiId.includes("@")) {
      toast("Please enter a valid UPI ID (example@bank)");
      elUpiId.focus();
      return;
    }

    upi = { upiId, payeeName };
    localStorage.setItem(LS_UPI, JSON.stringify(upi));
    toast("UPI saved ✅");
    renderCart();
  });
}

function wirePayButton() {
  elPayBtn.addEventListener("click", (e) => {
    const { total } = cartTotals();
    if (total <= 0) {
      e.preventDefault();
      toast("Cart is empty");
      return;
    }
    const url = buildUpiUrl(total, `Twiscent Cart Order`);
    if (!url) {
      e.preventDefault();
      toast("Set UPI ID first (scroll to UPI Setup)");
      location.hash = "#upi";
    }
  });
}

// ---------- Clear Cart ----------
function wireClearCart() {
  elClearCart.addEventListener("click", () => {
    cart = {};
    saveCart();
    renderCart();
    toast("Cart cleared");
  });
}

// ---------- Helpers ----------
function cartTotals() {
  let itemsCount = 0;
  let total = 0;

  for (const [pid, qty] of Object.entries(cart)) {
    const q = clampInt(qty, 0, 99);
    if (!q) continue;
    const p = PRODUCTS.find(x => x.id === pid);
    if (!p) continue;

    itemsCount += q;
    total += p.price * q;
  }
  return { itemsCount, total };
}

function buildUpiUrl(amount, note) {
  if (!upi?.upiId || !upi.upiId.includes("@")) return "";
  if (!amount || amount <= 0) return "";

  const pa = encodeURIComponent(upi.upiId);
  const pn = encodeURIComponent(upi.payeeName || "Twiscent Candles");
  const am = encodeURIComponent(String(amount));
  const cu = "INR";
  const tn = encodeURIComponent(note || "Twiscent Candles Order");

  // UPI deep link format
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=${cu}&tn=${tn}`;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(LS_CART);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCart() {
  localStorage.setItem(LS_CART, JSON.stringify(cart));
}

function loadUpi() {
  try {
    const raw = localStorage.getItem(LS_UPI);
    return raw ? JSON.parse(raw) : { upiId: "", payeeName: "Twiscent Candles" };
  } catch {
    return { upiId: "", payeeName: "Twiscent Candles" };
  }
}

function clampInt(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer = null;
function toast(msg) {
  clearTimeout(toastTimer);

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;

  document.body.appendChild(el);
  toastTimer = setTimeout(() => {
    el.remove();
  }, 2200);
}