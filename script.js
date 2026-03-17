console.log("=== POS SYSTEM LOADED ===");

/* =========================
   CSV PARSING (robust)
========================= */
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Handle escaped quotes "" inside quoted strings
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function parseCSVToRows(csvText) {
  return csvText
    .split("\n")
    .map((l) => l.replace(/\r/g, ""))
    .filter((l) => l.trim().length > 0)
    .map(parseCSVLine);
}

/* =========================
   STORE CONFIG (fixed)
========================= */
const stores = {
  store1: {
    name: "One Stop",
    users: {
      Cashier: "Glam2025",
    },
  },
  // If you have a second store, uncomment and customize:
  // store2: {
  //   name: "Golden",
  //   users: {
  //     Cashier2: "Password2"
  //   }
  // }
};

/* =========================
   GOOGLE SHEETS (fixed URL)
   IMPORTANT: Sheet must be shared "Anyone with link can view"
========================= */
const SHEET_ID = "1lO_XUqATXSP4XBlGxJvMibFf-KwQE5cUIw_1A8qA0gg";
const GID = "1260434939"; // your sheet tab gid
const GOOGLE_SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRZdZel2WEtgv4uS9ybI-MhrC_ChEM8ykP_G4H55ECaRzb8_kg3H12ySQsN7vGPP8CkJYJHndWawwI0/pub?gid=0&single=true&output=csv`;

/* =========================
   MAIN POS VARIABLES
========================= */
let currentStore = null;
let currentUser = null;
let products = [];
let currentSales = [];

/* =========================
   HELPERS
========================= */
function $(id) {
  return document.getElementById(id);
}

function show(elId) {
  const el = $(elId);
  if (el) el.style.display = "block";
}

function hide(elId) {
  const el = $(elId);
  if (el) el.style.display = "none";
}

/* =========================
   LOAD PRODUCTS
========================= */
async function loadProductsFromGoogleSheets() {
  try {
    console.log("Loading from Google Sheets CSV:", GOOGLE_SHEETS_CSV_URL);
    const response = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Google Sheets fetch failed: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const parsed = parseProductsCSV(csvText);

    console.log(`Loaded ${parsed.length} products for store: ${currentStore}`);
    return parsed;
  } catch (err) {
    console.error("Google Sheets error:", err);
    alert(
      "Failed to load products from Google Sheets.\n" +
        "Check that the sheet is shared to 'Anyone with the link can view' and the CSV URL is correct.\n\n" +
        "Open DevTools > Network to see the failing request."
    );
    return [];
  }
}

function parseProductsCSV(csvText) {
  const rows = parseCSVToRows(csvText);
  if (rows.length < 2) return [];

  // Expected columns (example):
  // [0]=Product Name, [1]=Ct price, [2]=Dz price, [3]=Pc price, [4]=Store1 stock, [5]=Store2 stock
  const output = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells || cells.length < 6) continue;

    const name = (cells[0] || "").trim();
    if (!name || name.toLowerCase() === "product name") continue;

    // Choose stock column based on currentStore
    let stock = 0;
    if (currentStore === "store1") stock = parseFloat(cells[4]) || 0;
    if (currentStore === "store2") stock = parseFloat(cells[5]) || 0;

    output.push({
      name,
      prices: {
        ct: parseFloat(cells[1]) || 0,
        dz: parseFloat(cells[2]) || 0,
        pc: parseFloat(cells[3]) || 0,
      },
      stock,
      stockStore1: cells[4] || "0",
      stockStore2: cells[5] || "0",
    });
  }

  return output;
}

async function loadProducts() {
  products = await loadProductsFromGoogleSheets();
  populateDatalist();
  console.log(`Products ready for ${stores[currentStore]?.name || currentStore}`);
}

function populateDatalist() {
  const datalist = $("item-list");
  if (!datalist) return;

  datalist.innerHTML = "";
  products.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.name;
    datalist.appendChild(option);
  });
}

/* =========================
   LOGIN
========================= */
function checkLogin() {
  console.log("=== LOGIN BUTTON CLICKED ===");

  const username = ($("username")?.value || "").trim();
  const password = ($("password")?.value || "").trim();
  const error = $("login-error");

  let validStore = null;

  for (const storeId in stores) {
    const store = stores[storeId];
    if (store?.users?.[username] && store.users[username] === password) {
      validStore = storeId;
      break;
    }
  }

  if (!validStore) {
    if (error) error.textContent = "Invalid username or password";
    return;
  }

  // ✅ Fixed: no store-selection needed; show POS directly
  currentStore = validStore;
  currentUser = username;

  hide("login-container");
  show("pos-container");

  if ($("store-name")) $("store-name").textContent = `Simple POS - ${stores[currentStore].name}`;
  console.log("Login successful:", currentUser, "Store:", currentStore);

  loadProducts();
}

/* =========================
   PRICE + TOTAL
========================= */
function updatePrice() {
  const itemName = ($("item")?.value || "").trim();
  const unit = $("unit")?.value || "pc";

  const product = products.find((p) => p.name.toLowerCase() === itemName.toLowerCase());
  if (product) {
    const price = product.prices[unit] ?? 0;
    if ($("price")) $("price").value = price;
  } else {
    if ($("price")) $("price").value = "";
  }

  calculateTotal();
}

function calculateTotal() {
  const quantity = parseFloat($("quantity")?.value) || 0;
  const price = parseFloat($("price")?.value) || 0;
  const discount = parseFloat($("discount")?.value) || 0;
  const extra = parseFloat($("extra")?.value) || 0;

  const subtotal = quantity * price;
  const total = subtotal - discount + extra;

  if ($("total")) $("total").value = total.toFixed(2);
  return total;
}

/* =========================
   SALES TABLE
========================= */
function resetForm() {
  const form = $("sale-form");
  if (form) form.reset();

  if ($("price")) $("price").value = "";
  if ($("total")) $("total").value = "";
  $("item")?.focus();
}

function updateSalesTable() {
  const tbody = document.querySelector("#sales-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  let grandTotal = 0;

  currentSales.forEach((sale, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${sale.item}</td>
      <td>${sale.unit}</td>
      <td>${sale.quantity}</td>
      <td>${sale.price.toFixed(2)}</td>
      <td>${sale.discount.toFixed(2)}</td>
      <td>${sale.extra.toFixed(2)}</td>
      <td>${sale.total.toFixed(2)}</td>
      <td>${sale.paymentMethod}</td>
      <td><button type="button" onclick="removeSale(${index})">×</button></td>
    `;
    tbody.appendChild(row);
    grandTotal += sale.total;
  });

  const submitBtn = $("submit-all-btn");
  const clearBtn = $("clear-all-btn");

  if (currentSales.length > 0) {
    if (submitBtn) submitBtn.style.display = "inline-block";
    if (clearBtn) clearBtn.style.display = "inline-block";

    const footerRow = document.createElement("tr");
    footerRow.innerHTML = `
      <td colspan="7" style="text-align:right;"><strong>Grand Total:</strong></td>
      <td><strong>${grandTotal.toFixed(2)}</strong></td>
      <td colspan="2"></td>
    `;
    tbody.appendChild(footerRow);
  } else {
    if (submitBtn) submitBtn.style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";
  }
}

function removeSale(index) {
  currentSales.splice(index, 1);
  updateSalesTable();
}

function clearAllSales() {
  if (confirm("Are you sure you want to clear all items?")) {
    currentSales = [];
    updateSalesTable();
  }
}

/* =========================
   SUBMIT SALES TO GOOGLE FORM
========================= */
function submitSaleToGoogleForm(sale) {
  const formUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSclmoUb_V44uk6AdT1bY9RDqJvRLvUeyMTCnRNRCXrz_KDkPQ/formResponse";

  const formData = new URLSearchParams();
  formData.append("entry.1617444836", sale.item);
  formData.append("entry.591095593", sale.unit);
  formData.append("entry.268864996", String(sale.quantity));
  formData.append("entry.53788851", String(sale.price));
  formData.append("entry.411866054", String(sale.discount));
  formData.append("entry.511901350", String(sale.extra));
  formData.append("entry.1094112162", String(sale.total));
  formData.append("entry.970001475", sale.paymentMethod);
  formData.append("entry.106245113", stores[currentStore]?.name || currentStore);

  return fetch(formUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
}

function submitAllSales() {
  if (currentSales.length === 0) {
    alert("No items to submit");
    return;
  }

  const submitBtn = $("submit-all-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
  }

  let successCount = 0;
  const errors = [];

  const progress = document.createElement("div");
  progress.style.margin = "10px 0";
  progress.style.fontWeight = "bold";
  progress.textContent = `Submitting 0/${currentSales.length} items...`;
  submitBtn?.parentNode?.appendChild(progress);

  const submitNext = (index) => {
    if (index >= currentSales.length) {
      progress.innerHTML = `Completed: ${successCount}/${currentSales.length} submitted`;

      if (errors.length) {
        progress.innerHTML += `<br>${errors.length} failed (see console)`;
        console.error("Failed submissions:", errors);
      }

      if (successCount > 0) {
        currentSales.splice(0, successCount);
        updateSalesTable();
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit All Items";
      }

      setTimeout(() => progress.remove(), 5000);
      return;
    }

    progress.textContent = `Submitting ${index + 1}/${currentSales.length} items...`;

    submitSaleToGoogleForm(currentSales[index])
      .then(() => {
        successCount++;
        submitNext(index + 1);
      })
      .catch((err) => {
        errors.push({ index, err });
        submitNext(index + 1);
      });
  };

  submitNext(0);
}

/* =========================
   STOCK DISPLAY
========================= */
let allStoreProducts = [];

async function loadAllStoreProducts() {
  try {
    const response = await fetch(GOOGLE_SHEETS_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const csvText = await response.text();
    const parsed = parseProductsCSV(csvText);

    // parsed already includes stockStore1/2 strings for display
    allStoreProducts = parsed;
    return allStoreProducts;
  } catch (err) {
    console.error("Error loading all store products:", err);
    return [];
  }
}

function showStockLevels() {
  loadAllStoreProducts().then((prods) => {
    populateStockTable(prods);
    const modal = $("stock-modal");
    if (modal) modal.style.display = "flex";
    setupStockSearch();
  });
}

function hideStockLevels() {
  const modal = $("stock-modal");
  if (modal) modal.style.display = "none";
}

function populateStockTable(productsList) {
  const tbody = $("stock-table-body");
  const summary = $("stock-summary");
  if (!tbody) return;

  tbody.innerHTML = "";

  let outOfStockCount = 0;
  let lowStockCount = 0;

  productsList.forEach((product) => {
    const s1 = (product.stockStore1 || "").trim();
    const s2 = (product.stockStore2 || "").trim();

    const isStore1Out = s1 === "" || s1 === "0" || s1.toLowerCase() === "0 pc";
    const isStore2Out = s2 === "" || s2 === "0" || s2.toLowerCase() === "0 pc";
    const isOutOfStock = isStore1Out && isStore2Out;

    let status = "✅ In Stock";
    let statusColor = "#27ae60";

    if (isOutOfStock) {
      status = "❌ Out of Stock";
      statusColor = "#e74c3c";
      outOfStockCount++;
    } else if (isStore1Out || isStore2Out) {
      status = "⚠️ Low Stock";
      statusColor = "#f39c12";
      lowStockCount++;
    }

    const row = document.createElement("tr");
    row.style.borderBottom = "1px solid #eee";
    row.innerHTML = `
      <td style="padding:10px; font-weight:bold;">${product.name}</td>
      <td style="padding:10px; text-align:center; color:${isStore1Out ? "#e74c3c" : "#2c3e50"}">
        ${s1}${isStore1Out ? " ❌" : ""}
      </td>
      <td style="padding:10px; text-align:center; color:${isStore2Out ? "#e74c3c" : "#2c3e50"}">
        ${s2}${isStore2Out ? " ❌" : ""}
      </td>
      <td style="padding:10px; text-align:center; color:${statusColor}">${status}</td>
    `;
    tbody.appendChild(row);
  });

  if (summary) {
    summary.innerHTML = `
      <strong>Summary:</strong>
      Total Products: ${productsList.length} |
      Out of Stock: <span style="color:#e74c3c">${outOfStockCount}</span> |
      Low Stock: <span style="color:#f39c12">${lowStockCount}</span>
    `;
  }
}

function setupStockSearch() {
  const searchInput = $("stock-search");
  if (!searchInput) return;

  // Remove old listeners by cloning
  const clone = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(clone, searchInput);

  clone.addEventListener("input", function () {
    const term = this.value.toLowerCase().trim();
    if (!allStoreProducts.length) return;

    if (!term) {
      populateStockTable(allStoreProducts);
      return;
    }

    const filtered = allStoreProducts.filter((p) => p.name.toLowerCase().includes(term));
    populateStockTable(filtered);
  });

  clone.value = "";
}

/* =========================
   STOCK ADJUSTMENT
========================= */
let adjustmentItems = [];

function showStockAdjustment() {
  if (!currentStore) {
    alert("Please login first.");
    return;
  }

  adjustmentItems = [];
  const modal = $("stock-adjustment-modal");
  if (modal) modal.style.display = "flex";

  if ($("adjustment-store-name")) {
    $("adjustment-store-name").textContent = stores[currentStore]?.name || currentStore;
  }

  updateAdjustmentTable();
  setupAdjustmentSearch();
}

function hideStockAdjustment() {
  const modal = $("stock-adjustment-modal");
  if (modal) modal.style.display = "none";
}

function setupAdjustmentSearch() {
  const searchInput = $("adjustment-search");
  const suggestions = $("adjustment-suggestions");
  if (!searchInput || !suggestions) return;

  searchInput.oninput = function () {
    const term = this.value.toLowerCase().trim();
    suggestions.innerHTML = "";

    if (term.length < 1) {
      suggestions.style.display = "none";
      return;
    }

    const filtered = products.filter((p) => p.name.toLowerCase().includes(term));

    if (!filtered.length) {
      suggestions.style.display = "none";
      return;
    }

    filtered.slice(0, 30).forEach((p) => {
      const div = document.createElement("div");
      div.style.cssText = "padding:10px 15px; cursor:pointer; border-bottom:1px solid #f1f1f1;";
      div.textContent = p.name;
      div.addEventListener("click", () => {
        searchInput.value = p.name;
        suggestions.style.display = "none";
      });
      suggestions.appendChild(div);
    });

    suggestions.style.display = "block";
  };

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.style.display = "none";
    }
  });
}

function addItemToAdjustment() {
  const searchInput = $("adjustment-search");
  const itemName = (searchInput?.value || "").trim();

  if (!itemName) {
    alert("Please enter a product name");
    return;
  }

  const product = products.find((p) => p.name.toLowerCase() === itemName.toLowerCase());
  if (!product) {
    alert("Product not found");
    return;
  }

  const exists = adjustmentItems.find((x) => x.name === product.name);
  if (exists) {
    alert("Item already in adjustment list");
    return;
  }

  adjustmentItems.push({
    id: product.name,
    name: product.name,
    unit: "pc",
    adjustmentType: "add",
    quantity: 0,
    _userBlank: true,
  });

  if (searchInput) searchInput.value = "";
  const suggestions = $("adjustment-suggestions");
  if (suggestions) suggestions.style.display = "none";

  updateAdjustmentTable();
}

function updateAdjustmentTable() {
  const tbody = $("adjustment-table-body");
  const summary = $("adjustment-summary");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (adjustmentItems.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="5" style="text-align:center; padding:40px 20px; color:#7f8c8d;">
          <h3 style="margin:0 0 10px 0;">No items added yet</h3>
          <p style="margin:0;">Search for products above and click "Add Item" to start adjusting stock</p>
        </td>
      </tr>
    `;
    if (summary) summary.textContent = "Items to adjust: 0";
    return;
  }

  adjustmentItems.forEach((item, index) => {
    const row = document.createElement("tr");

    const displayQuantity = item._userBlank ? "" : String(item.quantity);

    row.innerHTML = `
      <td style="padding:12px 15px; font-weight:600; color:#2c3e50;">${item.name}</td>
      <td style="padding:12px 15px;">
        <select class="unit-select" data-index="${index}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
          <option value="pc" ${item.unit === "pc" ? "selected" : ""}>Pieces (pc)</option>
          <option value="dz" ${item.unit === "dz" ? "selected" : ""}>Dozens (dz)</option>
          <option value="ct" ${item.unit === "ct" ? "selected" : ""}>Cartons (ct)</option>
        </select>
      </td>
      <td style="padding:12px 15px;">
        <select class="type-select" data-index="${index}" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
          <option value="add" ${item.adjustmentType === "add" ? "selected" : ""}>Add Stock</option>
          <option value="remove" ${item.adjustmentType === "remove" ? "selected" : ""}>Remove Stock</option>
          <option value="set" ${item.adjustmentType === "set" ? "selected" : ""}>Set Stock</option>
        </select>
      </td>
      <td style="padding:12px 15px;">
        <input type="text" class="qty-input" data-index="${index}" value="${displayQuantity}" placeholder="0.00"
          style="width:80px; padding:8px; border:1px solid #ddd; border-radius:4px; text-align:center;">
      </td>
      <td style="padding:12px 15px;">
        <button type="button" class="remove-btn" data-index="${index}"
          style="background:#e74c3c; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
          Remove
        </button>
      </td>
    `;

    tbody.appendChild(row);

    // events
    row.querySelector(".unit-select")?.addEventListener("change", function () {
      const i = Number(this.dataset.index);
      adjustmentItems[i].unit = this.value;
    });

    row.querySelector(".type-select")?.addEventListener("change", function () {
      const i = Number(this.dataset.index);
      adjustmentItems[i].adjustmentType = this.value;
    });

    row.querySelector(".qty-input")?.addEventListener("input", function () {
      const i = Number(this.dataset.index);
      let v = this.value.replace(/[^0-9.]/g, "");
      if ((v.match(/\./g) || []).length > 1) {
        const first = v.indexOf(".");
        v = v.slice(0, first + 1) + v.slice(first + 1).replace(/\./g, "");
      }
      this.value = v;

      if (v === "") {
        adjustmentItems[i].quantity = 0;
        adjustmentItems[i]._userBlank = true;
      } else {
        adjustmentItems[i].quantity = parseFloat(v) || 0;
        adjustmentItems[i]._userBlank = false;
      }
    });

    row.querySelector(".remove-btn")?.addEventListener("click", function () {
      const i = Number(this.dataset.index);
      const name = adjustmentItems[i].name;
      adjustmentItems.splice(i, 1);
      updateAdjustmentTable();
      alert(`"${name}" removed from adjustment list`);
    });
  });

  if (summary) summary.textContent = `Items to adjust: ${adjustmentItems.length}`;
}

function clearAdjustments() {
  if (!adjustmentItems.length) {
    alert("No items to clear");
    return;
  }
  if (confirm("Are you sure you want to clear all items?")) {
    adjustmentItems = [];
    updateAdjustmentTable();
  }
}

/* =========================
   SUBMIT STOCK ADJUSTMENTS TO GOOGLE FORM
========================= */
function ensureHiddenIframe() {
  const id = "google-forms-hidden-iframe";
  if (!document.getElementById(id)) {
    const iframe = document.createElement("iframe");
    iframe.id = id;
    iframe.name = id;
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }
  return id;
}

async function submitStockAdjustmentToGoogleForm(adjustment) {
  const formUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLScXAN-92_F1BDYpQ_cVo9A6PInT_RxI7XWuYVFm7LxQpIeUPw/formResponse";

  const UNIT_MAP = { pc: "pc", dz: "dz", ct: "ct" };
  const TYPE_MAP = { add: "Add", remove: "Remove", set: "Set" };

  const unitValue = UNIT_MAP[(adjustment.unit || "").toLowerCase()] || adjustment.unit || "";
  const typeValue = TYPE_MAP[(adjustment.adjustmentType || "").toLowerCase()] || adjustment.adjustmentType || "";
  const storeValue = stores[currentStore]?.name || "";

  const payload = new URLSearchParams();
  payload.append("entry.907585622", adjustment.name || "");
  payload.append("entry.35356559", unitValue);
  payload.append("entry.1457043352", String(adjustment.quantity || 0));
  payload.append("entry.1711231423", typeValue);
  payload.append("entry.763520958", storeValue);

  if (adjustment._submitting) return { status: "skipped-duplicate" };
  adjustment._submitting = true;

  try {
    await fetch(formUrl, { method: "POST", body: payload, mode: "no-cors" });
    adjustment._submitting = false;
    return { status: "ok", method: "fetch" };
  } catch (err) {
    // fallback hidden form submit
    ensureHiddenIframe();
    const iframeName = "google-forms-hidden-iframe";

    const form = document.createElement("form");
    form.action = formUrl;
    form.method = "POST";
    form.target = iframeName;
    form.style.display = "none";

    for (const [k, v] of payload.entries()) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = v;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => form.remove(), 2000);
    adjustment._submitting = false;
    return { status: "ok", method: "form-fallback" };
  }
}

function submitStockAdjustment() {
  if (!adjustmentItems.length) {
    alert("No items to adjust");
    return;
  }

  // Validate quantities (allow decimals, no negatives)
  const invalid = adjustmentItems.filter((x) => isNaN(parseFloat(x.quantity)) || parseFloat(x.quantity) < 0);
  if (invalid.length) {
    alert("Please set valid quantities for all items (0 or greater).");
    return;
  }

  let success = 0;
  const errors = [];

  const btn = document.querySelector('#stock-adjustment-modal button[onclick="submitStockAdjustment()"]');
  const originalText = btn?.textContent || "Submit Adjustments";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Submitting...";
  }

  const submitNext = (i) => {
    if (i >= adjustmentItems.length) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }

      if (success > 0) {
        alert(`✅ Successfully submitted ${success} stock adjustment(s)!`);
        adjustmentItems = [];
        hideStockAdjustment();
      } else {
        alert("❌ No adjustments were submitted. Check console for errors.");
      }

      if (errors.length) console.error("Adjustment submission errors:", errors);
      return;
    }

    submitStockAdjustmentToGoogleForm(adjustmentItems[i])
      .then(() => {
        success++;
        submitNext(i + 1);
      })
      .catch((err) => {
        errors.push({ item: adjustmentItems[i]?.name, err });
        submitNext(i + 1);
      });
  };

  submitNext(0);
}

/* =========================
   DOM WIRING (safe)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  // Ensure POS is hidden by default (your HTML already does this)
  // hide("pos-container"); // optional

  // Form listeners
  ["quantity", "price", "discount", "extra"].forEach((id) => {
    $(id)?.addEventListener("input", calculateTotal);
  });

  $("item")?.addEventListener("input", updatePrice);
  $("unit")?.addEventListener("change", updatePrice);

  $("sale-form")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const item = ($("item")?.value || "").trim();
    if (!item) {
      alert("Please select an item");
      return;
    }

    const unit = $("unit")?.value || "pc";
    const quantity = parseFloat($("quantity")?.value) || 0;
    const price = parseFloat($("price")?.value) || 0;
    const discount = parseFloat($("discount")?.value) || 0;
    const extra = parseFloat($("extra")?.value) || 0;
    const paymentMethod = $("payment-method")?.value || "Cash";
    const total = calculateTotal();

    const sale = {
      item,
      unit,
      quantity,
      price,
      discount,
      extra,
      paymentMethod,
      total,
      timestamp: new Date().toLocaleTimeString(),
      store: currentStore,
    };

    currentSales.push(sale);
    updateSalesTable();
    resetForm();
  });
});

/* =========================
   Expose functions used by HTML onclick=
========================= */
window.checkLogin = checkLogin;
window.submitAllSales = submitAllSales;
window.clearAllSales = clearAllSales;
window.showStockLevels = showStockLevels;
window.hideStockLevels = hideStockLevels;
window.showStockAdjustment = showStockAdjustment;
window.hideStockAdjustment = hideStockAdjustment;
window.addItemToAdjustment = addItemToAdjustment;
window.clearAdjustments = clearAdjustments;
window.submitStockAdjustment = submitStockAdjustment;
window.removeSale = removeSale;
