# 📦 Inventory & Bill Management System

A full-stack Inventory, Billing, and Invoicing web application designed for retail businesses (e.g. Om Sahu Vastralaya).

---

## 🚀 Features

- **📊 Modern Dashboard**: Real-time business metrics, sales insights, inventory status, and low-stock alerts.
- **🧾 Point of Sale / Invoice Generation**: Quick barcode/product search, discounts, GST calculation, print-ready PDF/thermal receipts.
- **📷 Smart Bill / OCR Scanner**: Scan vendor bills/receipts to auto-populate inventory and purchase entries.
- **🏷️ Product Master**: Complete inventory tracking with categories, HSN codes, purchase/selling pricing, and barcode support.
- **📥 Purchase & Stock Management**: Inward stock logs, vendor purchase records, and automated cost updating.
- **📈 Sales & Profit Reports**: Detailed daily, monthly, and category-wise sales analytics and PDF export.
- **⚙️ Settings & Backup**: Tax rates, store branding info, and database migration/backup tools.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Lucide Icons, Modern Glassmorphic UI / Vanilla CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose ODM) & Local Browser Dexie DB fallback / offline capability
- **OCR / Processing**: Tesseract.js for receipt scanning

---

## 📂 Project Structure

```text
├── backend/                # Node.js & Express API server
│   ├── config/             # Database connection setup
│   ├── controllers/        # Business logic controllers
│   ├── models/             # Mongoose schemas & models
│   ├── routes/             # REST API endpoints
│   └── scripts/            # DB seed and reset utilities
├── frontend/               # React + Vite Frontend application
│   ├── public/             # Static assets and icons
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── services/       # Axios API client & business services
│       └── views/          # Page views & dashboards
├── .env.example            # Environment variables template
└── .gitignore              # Files excluded from git
```

---

## ⚡ Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [MongoDB](https://www.mongodb.com/) (Local instance or MongoDB Atlas URI)

### 2. Installation

Clone the repository and install dependencies:

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Configuration

Create `.env` inside `backend/` (or copy from `.env.example`):

```env
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/omsahuvastralaya
NODE_ENV=development
```

### 4. Running the Application

From the root directory:

```bash
# Run both Frontend & Backend concurrently
npm run dev
```

Or run them individually:

```bash
# Start Backend (Port 5050)
cd backend && npm run dev

# Start Frontend (Port 5173)
cd frontend && npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
