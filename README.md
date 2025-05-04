# EquilibriumSys
## Project is live at [equilibriumsys.salmann.dev](https://equilibriumsys.salmann.dev)

# 🚀 EquilibriumSys – Inventory Management System for Small Businesses

**EquilibriumSys** is a real-time inventory and order management system built with **Next.js** and **PostgreSQL**. Designed for small to mid-sized businesses, it provides powerful features including automated low-stock alerts, detailed sales/inventory reporting, and secure role-based access.

---

## 🧩 Features

 Real-time inventory tracking  
 Low-stock alerts (email + in-app notifications)  
 Order creation & receipt management  
 Role-based access control (Admin, Staff)  
 Reports & dashboards (sales, stock movement)  
 Secure login (JWT), GDPR-ready  
 Scalable & responsive (mobile-first design)  

---

## 🏗️ System Architecture

Frontend (Next.js App Router)
│
├── /app → Pages + layouts (app router)
├── /components → Reusable UI components
├── /lib → Business logic, services (auth, db, mail, etc.)
├── /prisma → Schema + migrations
├── /public → Static assets
├── /styles → Global styles
│
Backend (API Routes)
├── /api/auth → Auth logic via NextAuth
├── /api/inventory → CRUD inventory management
├── /api/orders → Order processing & receipts
├── /api/reports → Sales, inventory reporting
├── /api/notifications → Alerts & notifications



---

## 🧩 Database Design

### 📊 Entity Relationship Diagram (ERD)

- `User` ←→ `Order` ←→ `OrderItem` ←→ `InventoryItem`
- `Customer` ←→ `Address`
- `Customer` ←→ `Order`
- `InventoryItem` ←→ `InventoryHistory`
- `Order` ←→ `Payment`, `OrderStatusLog`
- `User` ←→ `Notification`
- `User` ←→ `Session`, `Account`, `VerificationToken`

### 📘 Data Dictionary (Key Tables)

| Table              | Description                                      |
|--------------------|--------------------------------------------------|
| `User`             | Admin/Staff users with roles                     |
| `Account`          | External auth providers (OAuth, credentials)     |
| `Session`          | NextAuth session tracking                        |
| `VerificationToken`| For email verification and reset flows           |
| `Customer`         | Customers with address and contact info          |
| `Address`          | Linked to `Customer`, stores full address info   |
| `Order`            | Represents placed orders                         |
| `OrderItem`        | Line items within an order                       |
| `InventoryItem`    | Stock items with quantity, price, reorder level  |
| `InventoryHistory` | Movement log for inventory adds/removals         |
| `Payment`          | Order payment method, status, and amount         |
| `OrderStatusLog`   | Tracks lifecycle status updates of an order      |
| `Notification`     | System messages and low-stock alerts             |


