/* Twiscent Candles - Vanilla JS cart + quantity + UPI
   - No backend: purely client-side
   - Saves cart + UPI settings to localStorage
*/

const PRODUCTS = [
  {
    id: "c1",
    name: "Pastel Daisy Garden Bowl",
    image: "photos/c1.jpeg",
    price: 699,
    note: "Colorful daisy candles arranged in a decorative bowl"
  },
  {
    id: "c2",
    name: "Purple Congrats Heart Candle",
    image: "photos/c2.jpeg",
    price: 349,
    note: "Perfect small congratulation gift candle"
  },
  {
    id: "c3",
    name: "Twin Bloom Bowl Set",
    image: "photos/c3.jpeg",
    price: 749,
    note: "Pair of pastel floral candles in textured bowls"
  },
  {
    id: "c4",
    name: "Couple Sculpture Gift Set",
    image: "photos/c4.jpeg",
    price: 899,
    note: "Romantic couple sculpture candle set"
  },
  {
    id: "c5",
    name: "Pink Rose Glass Bowl",
    image: "photos/c5.jpeg",
    price: 249,
    note: "Elegant rose shaped candle in glass bowl"
  },
  {
    id: "c6",
    name: "25th Birthday Keepsake",
    image: "photos/c6.jpeg",
    price: 399,
    note: "Birthday candle centerpiece for celebrations"
  },
  {
    id: "c7",
    name: "You & Me Twin Heart Candle",
    image: "photos/c7.jpeg",
    price: 499,
    note: "Cute couple themed heart candle"
  },
  {
    id: "c8",
    name: "Blush Rose Pillar Candle",
    image: "photos/c8.jpeg",
    price: 329,
    note: "Delicate pillar candle with rose carvings"
  },
  {
    id: "c9",
    name: "Mother's Day Floral Bowl",
    image: "photos/c9.jpeg",
    price: 799,
    note: "Special floral bowl candle for Mother's Day"
  }
];

const LS_CART = "twiscent_cart_v1";
const LS_UPI = "twiscent_upi_v1";

const elProducts = document.getElementById("products");
const elCartList = document.getElementById("cartList");
const elCartEmpty = document.getElementById("cartEmpty");
const elCartItems = document.getElementById("cartItems");
const elCartTotal = document.getElementById("cartTotal");
const elPayBtn = document.getElementById("payUpiBtn");
const elClearCart = document.getElementById("clearCart");

const elUpiId = document.getElementById("upiId");
const elPayeeName = document.getElementById("payeeName");
const elSaveUpi = document.getElementById("saveUpi");

// Lightbox elements
const elLightbox = document.getElementById("imageLightbox");
const elLightboxImg = document.getElementById("lightboxImg");
const elLightboxCaption = document.getElementById("lightboxCaption");
const elLightboxClose = document.getElementById("lightboxClose");

// ---------- State ----------
let cart = loadCart();
let upi = loadUpi();

// ---------- Init ----------
renderProducts();
renderCart();
hydrateUpiInputs();
wireUpiSave();
wireClearCart();
wirePayButton();
wireLightbox();

function renderProducts() {
  elProducts.innerHTML = PRODUCTS.map((p) => productCardHTML(p)).join("");

  elProducts.addEventListener("click", (e) => {
    const imgBtn = e.target.closest("[data-preview]");
    if (imgBtn) {
      const pid = imgBtn.dataset.preview;
      const product = PRODUCTS.find((x) => x.id === pid);
      if (product) openLightbox(product.image, product.name);
      return;
    }

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

  elProducts.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const buy = e.target.closest("[data-buy]");
    if (!add && !buy) return;

    const pid = (add || buy).dataset.id;
    const qtyInput = elProducts.querySelector(`input[data-qty="${pid}"]`);
    const qty = clampInt(parseInt(qtyInput?.value || "1", 10), 1, 99);

    const product = PRODUCTS.find((x) => x.id === pid);
    if (!product) return;

    if (add) {
      cart[pid] = (cart[pid] || 0) + qty;
      saveCart();
      renderCart();
      toast(`Added ${qty} × ${product.name}`);
      return;
    }

    if (buy) {
      const amount = product.price * qty;
      const tn = `Twiscent Order - ${product.name} x${qty}`;
      const url = buildUpiUrl(amount, tn);

      if (!url) {
        toast("Set UPI ID first");
        location.hash = "#upi";
        return;
      }

      window.location.href = url;
    }
  });

  elProducts.addEventListener("change", (e) => {
    const input = e.target.closest("input[data-qty]");
    if (!input) return;
    input.value = String(clampInt(parseInt(input.value || "1", 10), 1, 99));
  });
}

function productCardHTML(p) {
  return `
    <article class="product card">
      <div class="p-top">
        <button class="p-image-btn" type="button" data-preview="${p.id}" aria-label="Preview ${escapeHtml(p.name)}">
          <div class="p-image">
            <img src="${p.image}" alt="${escapeHtml(p.name)}">
          </div>
        </button>

        <div class="p-info">
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
  const entries = Object.entries(cart).filter(([, qty]) => qty > 0);

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

  const payUrl = buildUpiUrl(total, `Twiscent Cart Order - ${itemsCount} item(s)`);
  elPayBtn.href = payUrl || "#upi";
  elPayBtn.setAttribute("aria-disabled", payUrl ? "false" : "true");

  elCartList.onclick = (e) => {
    const thumbBtn = e.target.closest("[data-cart-preview]");
    if (thumbBtn) {
      const pid = thumbBtn.dataset.cartPreview;
      const product = PRODUCTS.find((x) => x.id === pid);
      if (product) openLightbox(product.image, product.name);
      return;
    }

    const act = e.target.closest("[data-cart-action]");
    if (!act) return;

    const action = act.dataset.cartAction;
    const pid = act.dataset.id;
    const product = PRODUCTS.find((x) => x.id === pid);
    if (!product) return;

    if (action === "dec") {
      cart[pid] = Math.max(1, (cart[pid] || 1) - 1);
      saveCart();
      renderCart();
    }

    if (action === "inc") {
      cart[pid] = Math.min(99, (cart[pid] || 1) + 1);
      saveCart();
      renderCart();
    }

    if (action === "remove") {
      delete cart[pid];
      saveCart();
      renderCart();
      toast(`Removed ${product.name}`);
    }
  };
}

function cartRowHTML(pid, qty) {
  const p = PRODUCTS.find((x) => x.id === pid);
  if (!p) return "";

  const lineTotal = p.price * qty;

  return `
    <div class="cart-row">
      <div class="left">
        <button class="cart-thumb-btn" type="button" data-cart-preview="${p.id}" aria-label="Preview ${escapeHtml(p.name)}">
          <div class="cart-thumb">
            <img src="${p.image}" alt="${escapeHtml(p.name)}">
          </div>
        </button>
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

// ---------- Lightbox ----------
function wireLightbox() {
  if (!elLightbox || !elLightboxImg || !elLightboxCaption || !elLightboxClose) return;

  elLightboxClose.addEventListener("click", closeLightbox);

  elLightbox.addEventListener("click", (e) => {
    if (e.target === elLightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && elLightbox.classList.contains("open")) {
      closeLightbox();
    }
  });
}

function openLightbox(src, caption) {
  if (!elLightbox || !elLightboxImg || !elLightboxCaption) return;

  elLightboxImg.src = src;
  elLightboxImg.alt = caption || "Product image";
  elLightboxCaption.textContent = caption || "";
  elLightbox.classList.add("open");
  document.body.classList.add("no-scroll");
}

function closeLightbox() {
  if (!elLightbox || !elLightboxImg || !elLightboxCaption) return;

  elLightbox.classList.remove("open");
  elLightboxImg.src = "";
  elLightboxImg.alt = "";
  elLightboxCaption.textContent = "";
  document.body.classList.remove("no-scroll");
}

// ---------- UPI ----------
function hydrateUpiInputs() {
  if (upi.upiId && elUpiId) elUpiId.value = upi.upiId;
  if (upi.payeeName && elPayeeName) elPayeeName.value = upi.payeeName;
}

function wireUpiSave() {
  if (!elSaveUpi) return;

  elSaveUpi.addEventListener("click", () => {
    const upiId = (elUpiId.value || "").trim();
    const payeeName = (elPayeeName.value || "Twiscent Candles").trim();

    if (!upiId || !upiId.includes("@")) {
      toast("Please enter a valid UPI ID");
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
  if (!elPayBtn) return;

  elPayBtn.addEventListener("click", (e) => {
    const { total } = cartTotals();

    if (total <= 0) {
      e.preventDefault();
      toast("Cart is empty");
      return;
    }

    const url = buildUpiUrl(total, "Twiscent Cart Order");
    if (!url) {
      e.preventDefault();
      toast("Set UPI ID first");
      location.hash = "#upi";
    }
  });
}

// ---------- Clear Cart ----------
function wireClearCart() {
  if (!elClearCart) return;

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

    const p = PRODUCTS.find((x) => x.id === pid);
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

  const oldToast = document.querySelector(".toast");
  if (oldToast) oldToast.remove();

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;

  document.body.appendChild(el);

  toastTimer = setTimeout(() => {
    el.remove();
  }, 2200);
}