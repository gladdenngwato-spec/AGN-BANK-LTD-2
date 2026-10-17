const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());

const dataFolder = path.join(__dirname, "data");

const customersFile = path.join(dataFolder, "customers.json");
const transactionsFile = path.join(dataFolder, "transactions.json");
const receiveRequestsFile = path.join(dataFolder, "receiveRequests.json");
const accountRequestsFile = path.join(dataFolder, "accountRequests.json");
const schoolsFile = path.join(dataFolder, "schools.json");
const groceriesFile = path.join(dataFolder, "groceries.json");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

function ensureFile(file, defaultData) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
    }
}

ensureFile(customersFile, []);
ensureFile(transactionsFile, []);
ensureFile(receiveRequestsFile, []);
ensureFile(accountRequestsFile, []);
ensureFile(schoolsFile, []);
ensureFile(groceriesFile, []);

function readJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        console.error("JSON error in:", file);
        return [];
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getCustomers() {
    return readJSON(customersFile);
}

function getTransactions() {
    return readJSON(transactionsFile);
}

function getReceiveRequests() {
    return readJSON(receiveRequestsFile);
}

function getAccountRequests() {
    return readJSON(accountRequestsFile);
}

function getSchools() {
    return readJSON(schoolsFile);
}

function getGroceries() {
    return readJSON(groceriesFile);
}

function nextCustomerAccount() {
    const customers = getCustomers();

    if (customers.length === 0) {
        return "100001";
    }

    const numbers = customers
        .map(c => Number(c.accountNumber))
        .filter(n => !isNaN(n));

    return String(Math.max(...numbers, 100000) + 1);
}

function addTransaction(transaction) {
    const transactions = getTransactions();

    transactions.push({
        id: Date.now(),
        date: new Date().toISOString(),
        ...transaction
    });

    writeJSON(transactionsFile, transactions);
}


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
    res.send(`
        <h1>AGN Bank Ltd</h1>
        <p>Welcome to AGN Bank Ltd.</p>
        <p>
            <a href="/customer">Customer App</a>
        </p>
        <p>
            <a href="/manager">Manager App</a>
        </p>
    `);
});


/* =========================
   CUSTOMER & MANAGER FILES
========================= */

app.use("/customer", express.static(path.join(__dirname, "customer")));
app.use("/manager", express.static(path.join(__dirname, "manager")));


/* =========================
   CUSTOMER ACCOUNT REQUEST
========================= */

app.post("/account-request", (req, res) => {

    const { name, birthdate, age } = req.body;

    if (!name || !birthdate || !age) {
        return res.status(400).json({
            success: false,
            message: "Please provide name, birthdate and age."
        });
    }

    const numericAge = Number(age);

    if (!Number.isInteger(numericAge) || numericAge <= 0) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid age."
        });
    }

    const requests = getAccountRequests();

    const existing = requests.find(request =>
        request.status === "Pending" &&
        request.name.toLowerCase() === String(name).trim().toLowerCase() &&
        request.birthdate === birthdate
    );

    if (existing) {
        return res.status(400).json({
            success: false,
            message: "An account request for this person is already pending."
        });
    }

    const request = {
        id: Date.now(),
        name: String(name).trim(),
        birthdate,
        age: numericAge,
        status: "Pending",
        date: new Date().toISOString()
    };

    requests.push(request);

    writeJSON(accountRequestsFile, requests);

    res.json({
        success: true,
        message: "Account request sent to the manager successfully.",
        request
    });
});


/* =========================
   CUSTOMER LOGIN
========================= */

app.post("/login", (req, res) => {

    const { accountNumber, pin } = req.body;

    const customers = getCustomers();

    const customer = customers.find(c =>
        String(c.accountNumber) === String(accountNumber) &&
        String(c.pin) === String(pin)
    );

    if (!customer) {
        return res.status(401).json({
            success: false,
            message: "Invalid account number or PIN."
        });
    }

    res.json({
        success: true,
        message: "Login successful.",
        customer: {
            accountNumber: customer.accountNumber,
            name: customer.name,
            birthdate: customer.birthdate,
            age: customer.age,
            balance: customer.balance
        }
    });
});


/* =========================
   CUSTOMER INFORMATION
========================= */

app.get("/customer/:accountNumber", (req, res) => {

    const customers = getCustomers();

    const customer = customers.find(c =>
        String(c.accountNumber) === String(req.params.accountNumber)
    );

    if (!customer) {
        return res.status(404).json({
            success: false,
            message: "Customer account not found."
        });
    }

    res.json({
        success: true,
        customer: {
            accountNumber: customer.accountNumber,
            name: customer.name,
            birthdate: customer.birthdate,
            age: customer.age,
            balance: customer.balance
        }
    });
});


/* =========================
   CUSTOMER TRANSACTIONS
========================= */

app.get("/transactions/:accountNumber", (req, res) => {

    const transactions = getTransactions();

    const customerTransactions = transactions
        .filter(t =>
            String(t.accountNumber) === String(req.params.accountNumber)
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
        success: true,
        transactions: customerTransactions
    });
});


/* =========================
   RECEIVE MONEY REQUEST
========================= */

app.post("/receive-request", (req, res) => {

    const {
        accountNumber,
        amount,
        source,
        reason
    } = req.body;

    const numericAmount = Number(amount);

    if (!accountNumber || !numericAmount || numericAmount <= 0 || !source) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid amount and money source."
        });
    }

    const customers = getCustomers();

    const customer = customers.find(c =>
        String(c.accountNumber) === String(accountNumber)
    );

    if (!customer) {
        return res.status(404).json({
            success: false,
            message: "Customer account not found."
        });
    }

    const requests = getReceiveRequests();

    const request = {
        id: Date.now(),
        accountNumber: customer.accountNumber,
        customerName: customer.name,
        amount: numericAmount,
        source: String(source).trim(),
        reason: reason ? String(reason).trim() : "",
        status: "Pending",
        date: new Date().toISOString()
    };

    requests.push(request);

    writeJSON(receiveRequestsFile, requests);

    res.json({
        success: true,
        message: "Receive-money request sent to the manager.",
        request
    });
});


/* =========================
   MANAGER ACCOUNT REQUESTS
========================= */

app.get("/manager/account-requests", (req, res) => {

    res.json({
        success: true,
        requests: getAccountRequests()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
    });
});


/* =========================
   MANAGER APPROVE ACCOUNT
========================= */

app.post("/manager/approve-account", (req, res) => {

    const { requestId, pin } = req.body;

    const requests = getAccountRequests();

    const request = requests.find(r =>
        String(r.id) === String(requestId)
    );

    if (!request) {
        return res.status(404).json({
            success: false,
            message: "Account request not found."
        });
    }

    if (request.status !== "Pending") {
        return res.status(400).json({
            success: false,
            message: "This request has already been processed."
        });
    }

    let customerPin;

    if (pin) {
        customerPin = String(pin);

        if (!/^\d{4}$/.test(customerPin)) {
            return res.status(400).json({
                success: false,
                message: "PIN must contain exactly 4 digits."
            });
        }
    } else {
        customerPin = String(
            Math.floor(1000 + Math.random() * 9000)
        );
    }

    const customers = getCustomers();

    const accountNumber = nextCustomerAccount();

    const customer = {
        accountNumber,
        pin: customerPin,
        name: request.name,
        birthdate: request.birthdate,
        age: request.age,
        balance: 0,
        createdAt: new Date().toISOString()
    };

    customers.push(customer);

    writeJSON(customersFile, customers);

    request.status = "Approved";
    request.accountNumber = accountNumber;
    request.pin = customerPin;
    request.processedAt = new Date().toISOString();

    writeJSON(accountRequestsFile, requests);

    addTransaction({
        type: "ACCOUNT_CREATED",
        accountNumber,
        amount: 0,
        source: "AGN Bank Ltd",
        description: "Customer account created",
        status: "Completed"
    });

    res.json({
        success: true,
        message: "Customer account approved successfully.",
        accountNumber,
        pin: customerPin
    });
});


/* =========================
   MANAGER REJECT ACCOUNT
========================= */

app.post("/manager/reject-account", (req, res) => {

    const { requestId } = req.body;

    const requests = getAccountRequests();

    const request = requests.find(r =>
        String(r.id) === String(requestId)
    );

    if (!request) {
        return res.status(404).json({
            success: false,
            message: "Account request not found."
        });
    }

    if (request.status !== "Pending") {
        return res.status(400).json({
            success: false,
            message: "This request has already been processed."
        });
    }

    request.status = "Rejected";
    request.processedAt = new Date().toISOString();

    writeJSON(accountRequestsFile, requests);

    res.json({
        success: true,
        message: "Account request rejected."
    });
});


/* =========================
   MANAGER CUSTOMERS
========================= */

app.get("/manager/customers", (req, res) => {

    const customers = getCustomers();

    res.json({
        success: true,
        customers
    });
});


/* =========================
   MANAGER RECEIVE REQUESTS
========================= */

app.get("/manager/receive-requests", (req, res) => {

    res.json({
        success: true,
        requests: getReceiveRequests()
            .sort((a, b) => new Date(b.date) - new Date(a.date))
    });
});


/* =========================
   MANAGER APPROVE RECEIVE MONEY
========================= */

app.post("/manager/approve-receive", (req, res) => {

    const { requestId } = req.body;

    const requests = getReceiveRequests();

    const request = requests.find(r =>
        String(r.id) === String(requestId)
    );

    if (!request) {
        return res.status(404).json({
            success: false,
            message: "Receive-money request not found."
        });
    }

    if (request.status !== "Pending") {
        return res.status(400).json({
            success: false,
            message: "This request has already been processed."
        });
    }

    const customers = getCustomers();

    const customer = customers.find(c =>
        String(c.accountNumber) === String(request.accountNumber)
    );

    if (!customer) {
        return res.status(404).json({
            success: false,
            message: "Customer account not found."
        });
    }

    customer.balance += Number(request.amount);

    writeJSON(customersFile, customers);

    request.status = "Approved";
    request.processedAt = new Date().toISOString();

    writeJSON(receiveRequestsFile, requests);

    addTransaction({
        type: "MONEY_RECEIVED",
        accountNumber: customer.accountNumber,
        amount: Number(request.amount),
        source: request.source,
        description: request.reason || "Approved receive-money request",
        status: "Completed"
    });

    res.json({
        success: true,
        message: "Money approved and added to the customer's balance.",
        newBalance: customer.balance
    });
});


/* =========================
   MANAGER REJECT RECEIVE
========================= */

app.post("/manager/reject-receive", (req, res) => {

    const { requestId } = req.body;

    const requests = getReceiveRequests();

    const request = requests.find(r =>
        String(r.id) === String(requestId)
    );

    if (!request) {
        return res.status(404).json({
            success: false,
            message: "Receive-money request not found."
        });
    }

    if (request.status !== "Pending") {
        return res.status(400).json({
            success: false,
            message: "This request has already been processed."
        });
    }

    request.status = "Rejected";
    request.processedAt = new Date().toISOString();

    writeJSON(receiveRequestsFile, requests);

    res.json({
        success: true,
        message: "Receive-money request rejected."
    });
});


/* =========================
   MANAGER SEND MONEY
========================= */

app.post("/manager/send-money", (req, res) => {

    const {
        accountNumber,
        amount,
        source,
        reason
    } = req.body;

    const numericAmount = Number(amount);

    if (!accountNumber || !numericAmount || numericAmount <= 0 || !source) {
        return res.status(400).json({
            success: false,
            message: "Account number, amount and source are required."
        });
    }

    const customers = getCustomers();

    const customer = customers.find(c =>
        String(c.accountNumber) === String(accountNumber)
    );

    if (!customer) {
        return res.status(404).json({
            success: false,
            message: "Customer account not found."
        });
    }

    customer.balance += numericAmount;

    writeJSON(customersFile, customers);

    addTransaction({
        type: "MANAGER_PAYMENT",
        accountNumber: customer.accountNumber,
        amount: numericAmount,
        source: String(source).trim(),
        description: reason
            ? String(reason).trim()
            : "Money sent by bank manager",
        status: "Completed"
    });

    res.json({
        success: true,
        message: "Money sent successfully.",
        newBalance: customer.balance
    });
});


/* =========================
   BILLS & PAYMENTS
========================= */

app.post("/bill-payment", (req, res) => {

    const {
        accountNumber,
        billType,
        reference,
        amount
    } = req.body;

    const numericAmount = Number(amount);

    const allowedBills = [
        "electricity",
        "water",
        "airtime",
        "internet",
        "tv"
    ];

    if (!accountNumber) {
        return res.status(400).json({
            success: false,
            message: "Account number is required."
        });
    }

    if (!allowedBills.includes(String(billType))) {
        return res.status(400).json({
            success: false,
            message: "Invalid bill type."
        });
    }

    if (!reference || !numericAmount || numericAmount <= 0) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid reference and amount."
        });
    }

    const customers = getCustomers();

    const customer = customers.find(c =>
        String(c.accountNumber) === String(accountNumber)
    );

    if (!customer) {
        return res.status(404).json({
            success: false,
            message: "Customer account not found."
        });
    }

    if (Number(customer.balance) < numericAmount) {
        return res.status(400).json({
            success: false,
            message: "Insufficient balance."
        });
    }

    const billNames = {
        electricity: "Electricity",
        water: "Water",
        airtime: "Airtime",
        internet: "Internet/Data",
        tv: "TV Subscription"
    };

    const billName = billNames[String(billType)];

    customer.balance -= numericAmount;

    writeJSON(customersFile, customers);

    addTransaction({
        type: "BILL_PAYMENT",
        accountNumber: customer.accountNumber,
        amount: numericAmount,
        source: billName,
        billType: String(billType),
        reference: String(reference).trim(),
        description: `${billName} payment`,
        status: "Completed"
    });

    res.json({
        success: true,
        message: `${billName} payment successful.`,
        newBalance: customer.balance
    });
});


/* =========================
   SCHOOLS
========================= */

app.get("/schools", (req, res) => {

    res.json({
        success: true,
        schools: getSchools()
    });
});


/* =========================
   SCHOOL FEES
========================= */

app.post("/school-fee-payment", (req, res) => {

    const {
        accountNumber,
        schoolId,
        studentName
    } = req.body;

    if (!accountNumber || !schoolId || !studentName) {
        return res.status(400).json({
            success: false,
            message: "Account number, school and student name are required."
        });
    }

    const customers = getCustomers();

    const customer = customers.find(c =>
        String(c.accountNumber) === String(accountNumber)
    );

    if (!customer) {
        return res.status(404).json({
            success: false,
            message: "Customer account not found."
        });
    }

    const schools = getSchools();

    const school = schools.find(s =>
        String(s.id) === String(schoolId)
    );

    if (!school) {
        return res.status(404).json({
            success: false,
            message: "School not found."
        });
    }

    const fee = Number(school.fee);

    if (Number(customer.balance) < fee) {
        return res.status(400).json({
            success: false,
            message: "Insufficient balance."
        });
    }

    customer.balance -= fee;

    writeJSON(customersFile, customers);

    addTransaction({
        type: "SCHOOL_FEE_PAYMENT",
        accountNumber: customer.accountNumber,
        amount: fee,
        source: school.name,
        description: `School fees for ${String(studentName).trim()}`,
        category: school.category,
        status: "Completed"
    });

    res.json({
        success: true,
        message: "School fees paid successfully.",
        school: school.name,
        amount: fee,
        newBalance: customer.balance
    });
});


/* =========================
   GROCERY PRODUCTS
========================= */

app.get("/grocery-products", (req, res) => {

    res.json({
        success: true,
        products: getGroceries()
    });
});


/* =========================
   GROCERY PURCHASE
========================= */

app.post("/grocery-purchase", (req, res) => {

    const {
        accountNumber,
        items
    } = req.body;

    if (!accountNumber || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Select at least one grocery item."
        });
    }

    const customers = getCustomers();

    const customer = customers.find(c =>
        String(c.accountNumber) === String(accountNumber)
    );

    if (!customer) {
        return res.status(404).json({
            success: false,
            message: "Customer account not found."
        });
    }

    const products = getGroceries();

    let total = 0;
    const purchasedItems = [];

    for (const item of items) {

        const product = products.find(p =>
            String(p.id) === String(item.productId)
        );

        const quantity = Number(item.quantity);

        if (!product) {
            return res.status(400).json({
                success: false,
                message: "One of the selected products was not found."
            });
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid product quantity."
            });
        }

        const itemTotal = Number(product.price) * quantity;

        total += itemTotal;

        purchasedItems.push({
            productId: product.id,
            name: product.name,
            quantity,
            price: product.price,
            total: itemTotal
        });
    }

    if (Number(customer.balance) < total) {
        return res.status(400).json({
            success: false,
            message: "Insufficient balance."
        });
    }

    customer.balance -= total;

    writeJSON(customersFile, customers);

    addTransaction({
        type: "GROCERY_PURCHASE",
        accountNumber: customer.accountNumber,
        amount: total,
        source: "AGN Grocery Corner",
        description: "Grocery purchase",
        items: purchasedItems,
        status: "Completed"
    });

    res.json({
        success: true,
        message: "Grocery purchase successful.",
        total,
        items: purchasedItems,
        newBalance: customer.balance
    });
});


/* =========================
   MANAGER TRANSACTIONS
========================= */

app.get("/manager/transactions", (req, res) => {

    const transactions = getTransactions()
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
        success: true,
        transactions
    });
});


/* =========================
   MANAGER SUMMARY
========================= */

app.get("/manager/summary", (req, res) => {

    const customers = getCustomers();
    const transactions = getTransactions();
    const accountRequests = getAccountRequests();
    const receiveRequests = getReceiveRequests();

    const totalMoney = customers.reduce(
        (total, customer) =>
            total + Number(customer.balance || 0),
        0
    );

    res.json({
        success: true,

        summary: {
            totalCustomers: customers.length,

            totalMoney,

            pendingAccountRequests:
                accountRequests.filter(r => r.status === "Pending").length,

            pendingReceiveRequests:
                receiveRequests.filter(r => r.status === "Pending").length,

            totalTransactions:
                transactions.length
        }
    });
});


/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `AGN Bank Ltd server is running on http://localhost:${PORT}`
    );

    console.log(
        `Customer App: http://localhost:${PORT}/customer`
    );

    console.log(
        `Manager App: http://localhost:${PORT}/manager`
    );
});