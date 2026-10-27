const STORAGE_KEY = "colourfulExpenseTracker_v1";

const $ = id => document.getElementById(id);

const form = $("transactionForm");

let transactions = [];
let chart = null;
let toastTimer;

const colors = [
    "#8068f1",
    "#f29a4a",
    "#20bd91",
    "#4b8be8",
    "#ef6b9a",
    "#20b8c5",
    "#d17ce8",
    "#e7c24d",
    "#718096",
    "#f07848"
];

// GET TODAY'S DATE

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// FORMAT CURRENCY

function money(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount || 0);
}

// FORMAT DATE

function prettyDate(value) {
    if (!value) return "—";

    return new Date(value + "T00:00:00")
        .toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
}

// SHOW NOTIFICATION

function showToast(message) {
    const toast = $("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
}

// LOAD DATA FROM LOCAL STORAGE

function loadTransactions() {
    try {
        transactions = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "[]"
        );
    } catch {
        transactions = [];
    }
}

// SAVE DATA

function saveTransactions() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(transactions)
    );

    renderAll();
}

// CALCULATE TOTALS

function sum(list, type) {
    return list
        .filter(item => item.type === type)
        .reduce((total, item) => total + Number(item.amount), 0);
}

// UPDATE SUMMARY CARDS

function renderSummary() {
    const income = sum(transactions, "income");
    const expenses = sum(transactions, "expense");

    $("totalIncome").textContent = money(income);

    $("totalExpenses").textContent = money(expenses);

    $("balance").textContent = money(income - expenses);

    const currentMonth = localDateString().slice(0, 7);

    const monthlyExpenses = transactions.filter(item =>
        item.type === "expense" &&
        item.date.slice(0, 7) === currentMonth
    );

    $("monthExpenses").textContent = money(
        sum(monthlyExpenses, "expense")
    );

    $("transactionCount").textContent =
        `${transactions.length} records`;
}

// FILTER TRANSACTIONS

function getFilteredTransactions() {
    const query = $("search").value.trim().toLowerCase();

    const type = $("typeFilter").value;
    const category = $("categoryFilter").value;

    const from = $("fromDate").value;
    const to = $("toDate").value;

    return [...transactions]
        .filter(item => {
            const searchableText =
                `${item.description} ${item.notes || ""} ${item.category}`
                .toLowerCase();

            const matchesText = searchableText.includes(query);

            const matchesType =
                type === "all" || item.type === type;

            const matchesCategory =
                category === "all" || item.category === category;

            const matchesFrom =
                !from || item.date >= from;

            const matchesTo =
                !to || item.date <= to;

            return matchesText &&
                matchesType &&
                matchesCategory &&
                matchesFrom &&
                matchesTo;
        })
        .sort((a, b) =>
            b.date.localeCompare(a.date) ||
            b.createdAt - a.createdAt
        );
}

// PREVENT HTML INJECTION

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

// DISPLAY TRANSACTION TABLE

function renderTransactions() {
    const list = getFilteredTransactions();

    $("transactionList").innerHTML = list.map(item => `
        <tr>
            <td>
                <span class="description-cell">
                    ${escapeHTML(item.description)}
                </span>

                ${item.notes ? `
                    <span class="note-cell">
                        ${escapeHTML(item.notes)}
                    </span>
                ` : ""}
            </td>

            <td>
                <span class="category-pill">
                    ${escapeHTML(item.category)}
                </span>
            </td>

            <td>${prettyDate(item.date)}</td>

            <td>
                <span class="type-pill ${item.type}">
                    ${item.type === "income"
                        ? "＋ Income"
                        : "－ Expense"}
                </span>
            </td>

            <td class="amount ${item.type}">
                ${item.type === "income" ? "+" : "−"}
                ${money(item.amount)}
            </td>

            <td>
                <div class="actions">

                    <button class="action-btn edit"
                        data-action="edit"
                        data-id="${item.id}"
                        aria-label="Edit transaction">
                        ✏️
                    </button>

                    <button class="action-btn delete"
                        data-action="delete"
                        data-id="${item.id}"
                        aria-label="Delete transaction">
                        🗑️
                    </button>

                </div>
            </td>
        </tr>
    `).join("");

    $("emptyState").style.display =
        list.length ? "none" : "block";

    $("showingLabel").textContent =
        `Showing ${list.length} of ${transactions.length} transactions`;
}

// DISPLAY EXPENSE CHART

function renderChart() {
    const expenses = transactions.filter(
        item => item.type === "expense"
    );

    const totals = {};

    expenses.forEach(item => {
        totals[item.category] =
            (totals[item.category] || 0) +
            Number(item.amount);
    });

    const labels = Object.keys(totals);

    const values = labels.map(category => totals[category]);

    $("emptyChart").style.display =
        labels.length ? "none" : "block";

    $("chartLegend").innerHTML = labels.map((label, index) => `
        <span class="legend-item">
            <i class="legend-dot"
                style="background:${colors[index % colors.length]}">
            </i>
            ${escapeHTML(label)} · ${money(values[index])}
        </span>
    `).join("");

    if (chart) {
        chart.destroy();
    }

    if (typeof Chart === "undefined") {
        $("emptyChart").textContent =
            "Connect to the internet to load the chart.";
        $("emptyChart").style.display = "block";
        return;
    }

    chart = new Chart($("expenseChart"), {
        type: "doughnut",

        data: {
            labels: labels,

            datasets: [{
                data: values,

                backgroundColor: labels.map(
                    (_, index) => colors[index % colors.length]
                ),

                borderWidth: 3,
                borderColor: "#ffffff",
                hoverOffset: 7
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            cutout: "66%",

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.label}: ${money(context.raw)}`
                    }
                }
            }
        }
    });
}

// REFRESH EVERYTHING

function renderAll() {
    renderSummary();
    renderTransactions();
    renderChart();
}

// RESET FORM

function resetForm() {
    form.reset();

    $("editId").value = "";

    $("date").value = localDateString();

    $("formTitle").textContent = "New Transaction";

    $("saveButton").textContent = "＋ Add Transaction";

    $("cancelEdit").classList.add("hidden");

    document.querySelector(
        'input[name="type"][value="expense"]'
    ).checked = true;
}

// ADD OR UPDATE TRANSACTION

form.addEventListener("submit", event => {
    event.preventDefault();

    const description = $("description").value.trim();

    const amount = Number($("amount").value);

    const date = $("date").value;

    if (
        !description ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !date
    ) {
        showToast("Please enter valid transaction details.");
        return;
    }

    const editId = $("editId").value;

    const existing = transactions.find(
        item => item.id === editId
    );

    const item = {
        id: editId ||
            `${Date.now()}-${Math.random().toString(16).slice(2)}`,

        description: description,

        amount: amount,

        date: date,

        category: $("category").value,

        type: document.querySelector(
            'input[name="type"]:checked'
        ).value,

        notes: $("notes").value.trim(),

        createdAt: existing?.createdAt || Date.now()
    };

    if (editId) {
        transactions = transactions.map(transaction =>
            transaction.id === editId ? item : transaction
        );

        showToast("Transaction updated successfully.");
    } else {
        transactions.push(item);

        showToast("Transaction added successfully.");
    }

    saveTransactions();

    resetForm();
});

// CANCEL EDITING

$("cancelEdit").addEventListener("click", resetForm);

// EDIT AND DELETE TRANSACTIONS

$("transactionList").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const item = transactions.find(
        transaction => transaction.id === button.dataset.id
    );

    if (!item) return;

    if (button.dataset.action === "delete") {
        if (!confirm(`Delete "${item.description}"?`)) {
            return;
        }

        transactions = transactions.filter(
            transaction => transaction.id !== item.id
        );

        saveTransactions();

        showToast("Transaction deleted.");

        if ($("editId").value === item.id) {
            resetForm();
        }

        return;
    }

    // FILL FORM FOR EDITING

    $("editId").value = item.id;

    $("description").value = item.description;

    $("amount").value = item.amount;

    $("date").value = item.date;

    $("category").value = item.category;

    $("notes").value = item.notes || "";

    document.querySelector(
        `input[name="type"][value="${item.type}"]`
    ).checked = true;

    $("formTitle").textContent = "Edit Transaction";

    $("saveButton").textContent = "✓ Save Changes";

    $("cancelEdit").classList.remove("hidden");

    $("description").focus();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});

// SEARCH AND FILTER EVENTS

["search", "typeFilter", "categoryFilter", "fromDate", "toDate"]
    .forEach(id => {
        $(id).addEventListener(
            id === "search" ? "input" : "change",
            renderTransactions
        );
    });

// CLEAR FILTERS

$("clearFilters").addEventListener("click", () => {
    $("search").value = "";

    $("fromDate").value = "";

    $("toDate").value = "";

    $("typeFilter").value = "all";

    $("categoryFilter").value = "all";

    renderTransactions();

    showToast("Filters cleared.");
});

// DELETE ALL TRANSACTIONS

$("deleteAll").addEventListener("click", () => {
    if (!transactions.length) {
        showToast("There is no data to delete.");
        return;
    }

    if (confirm("Delete ALL transactions? This cannot be undone.")) {
        transactions = [];

        saveTransactions();

        resetForm();

        showToast("All transaction data deleted.");
    }
});

// INITIALIZE PROJECT

$("todayLabel").textContent =
    new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });

$("date").value = localDateString();

loadTransactions();

renderAll();