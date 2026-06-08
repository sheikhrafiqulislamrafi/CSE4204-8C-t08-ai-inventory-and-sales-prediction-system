# 🤖 AI Inventory & Sales Prediction System

> A smart web-based platform designed to help businesses manage inventory, track sales, and improve decision-making using Artificial Intelligence.

---

## 🚀 Project Description

The **AI Inventory & Sales Prediction System** is an intelligent, cloud-based business management platform engineered to modernize traditional warehouse keeping and transactional logging. Conventional inventory systems act as passive, historical repositories that record events after they occur. This platform transforms data collection into a forward-looking operational asset. 

By integrating decoupled full-stack web architectures with machine learning models and dynamic APIs, the system provides a unified operational surface to monitor real-time stock availability, record daily revenue streams, map micro-trends, and generate interactive next-month sales projection curves.

### The system helps businesses:
* ✅ **Reduce Overstocking & Stock Shortages:** Mitigates immediate operational friction, emergency reorder premiums, and capital confinement.
* 📈 **Analyze Product Performance:** Tracks baseline sales volumes, margins, and movement patterns over time.
* 💹 **Monitor Revenue & Sales Trends:** Visualizes real-time gross metrics and historical performance lines cleanly.
* 💡 **Generate Intelligent Business Insights:** Translates raw transaction matrices into strategic textual summaries and reordering directions.
* 🗓️ **Improve Business Planning & Decision-Making:** Removes dependency on standard heuristics or guesswork, replacing it with empirical data.

The platform provides a **responsive and user-friendly interface** for both desktop and mobile users.

---
## 👥 Team Information

| Field | Details |
|-------|---------|
| **Official Team Name** | CSE4204-8C-T08 |
| **Section** | 8C |
| **Team Leader** | Sheikh Rafiqul Islam Rafi |

### Team Members
| Serial | Name | Student ID |
|--------|------|------------|
| 1 | Sheikh Rafiqul Islam Rafi | 11220320922 |
| 2 | Antar Sadhu | 11220320940 |
| 3 | Md. Shajjad Mahmud | 11220320928 |
| 4 | Arjun Mirbor | 11220320971 |
---

## 🎯 Project Objectives

To meet academic and industry standard requirements, our platform guarantees the following system milestones:
1.  **Unified Inventory Management:** Engineering a structured, secure, and user-friendly interface to track granular product details, categories, costs, and localized stock status.
2.  **Real-Time Sales Ledger:** Constructing automated transaction workflows that instantaneously adjust downstream asset volumes upon item checkout to prevent manual entry errors.
3.  **AI-Driven Forecasting:** Embedding predictive analytics to evaluate historical sales logs and project next-month forward demand curves.
4.  **Proactive Automated Alerting:** Designing warning hooks that trigger immediate visual indicators on front-end dashboards when stock counts fall below custom low-stock thresholds.
5.  **Cloud-Scale Infrastructure:** Architecting a high-availability server layout capable of sustaining concurrent queries without an exponential rise in interface latency.

---

## ✨ Proposed Features & System Specification

### 🔐 Authentication System
* **FR-01 (User Registration):** Captures business emails, salted credentials, and defined user parameters.
* **FR-02 (Secure Login):** Authenticates user sessions against cryptographic database hashes to establish secure session tokens (JWT).
* **FR-03 (Token Invalidation):** Explicitly clears active session components and state values on user logout commands.
* **FR-04 (User Profiles):** Allows authenticated staff members to safely modify profile metadata and preferences.
* **FR-05 (Role-Based Access Control):** Restricts administrative control panels, configurations, and user listings exclusively to the Admin role.

### 📦 Inventory Management
* **FR-06 (Catalog Initialization):** Provides staff with UI forms to register fresh product titles, retail pricing, baseline tracking, and initial count logs.
* **FR-07 (Attribute Management):** Facilitates direct updates to active product profiles while maintaining referential integrity across the system data layer.
* **FR-08 (Soft-Deletion Protection):** Implements flags to hide obsolete catalog rows without breaking linked historical sales logs.
* **FR-09 (Manual Adjustments):** Allows manual stock volume overrides to account for inbound supplier shipments or structural audits.

### 💰 Sales Management
* **FR-10 (Automated Sychronization):** Backend automatically intercepts final checkout receipts to programmatically decrement inventory levels without latency.
* **FR-12 (Sales Recording):** Compiles financial transaction blocks, saving aggregated item costs, quantities, and timing metrics.
* **FR-13 (CRM Tracking):** Offers optional fields to map customer identity attributes to distinct invoices for marketing analysis.

### 📊 Dashboard & Analytics
* **FR-14 (Query Operations):** Provides fast text filters and dynamic categorization tools across item listings and receipt tables.
* **FR-15 (Visual Overview Dashboard):** Compiles active database metrics into responsive time-series charts, revenue summaries, and quick performance cards.

### 🤖 AI Features
* **FR-16 (AI Sales Prediction):** Processes historical data patterns through intelligent models to render reliable future month sales projection graphics.
* **FR-17 (Smart Inventory Recommendations):** Leverages purchase frequencies and historical asset lifecycles to calculate ideal product reordering milestones.
* **FR-18 (AI-Generated Business Insights):** Evaluates transaction layers to supply brief textual summaries highlighting an enterprise's top-growth avenues.

### 📝 Report Generation
* **FR-19 (Tabular Reports Engine):** Formats active metrics, performance parameters, and remaining stock inventories into exportable CSV or PDF documents.
* **FR-20 (Persistence Layer Maintenance):** Maps all business transactions, event history chains, and entity changes directly to cloud non-volatile storage collections.

---

## 🛠 Technology Stack

### Frontend
![React](https://img.shields.io/badge/React.js-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

### Backend
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)

### Database
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)

### AI Integration
![OpenAI](https://img.shields.io/badge/OpenAI_API-412991?style=for-the-badge&logo=openai&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Gemini_API-4285F4?style=for-the-badge&logo=google&logoColor=white)

### Deployment

| Service | Purpose |
| :--- | :--- |
| **Vercel** | Frontend Hosting & Global Edge Distribution |
| **Render / Railway** | Decoupled API Server Lifecycle Management |
| **MongoDB Atlas / Supabase** | High-Availability Cloud Database & Replication Clusters |

---

## 📂 Repository Structure

```text
ai-inventory-sales-system/
├── frontend/                 # Client UI application (Hosted on Vercel)
│   ├── public/               # Asset management, icons, manifest fields
│   └── src/
│       ├── components/       # Reusable UI widgets (Charts, Tables, Low-Stock Widgets)
│       ├── pages/            # Layout Views (Dashboard, Inventory Catalog, Login, Sales Gateway)
│       ├── context/          # Application global context states (AuthContext, ThemeContext)
│       └── hooks/            # Custom API sync and state validation hooks
├── backend/                  # Business API Server Engine (Hosted on Render/Railway)
│   └── src/
│       ├── config/           # Environment profiles and cloud database connections
│       ├── controllers/      # Route logic handlers for user and tracking operations
│       ├── models/           # Data definitions and schemas (User, Product, Transaction)
│       ├── routes/           # Network endpoint map trees (AuthRoutes, InventoryRoutes)
│       └── middleware/       # JWT interceptors and role verification blocks
├── ai-engine/                # Analytics engine, data pipelines, and machine learning scripts
│   ├── models/               # Saved mathematical algorithms or pipeline configurations
│   └── pipelines/            # Aggregation processors and prompt text synthesizers
└── docs/                     # SRS Documents, architectural diagrams, and project assets
