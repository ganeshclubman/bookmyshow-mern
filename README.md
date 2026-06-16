# 🎬 BookMyShow — MERN Movie Ticket Booking Platform

A full-stack movie ticket–booking application (a BookMyShow clone) built with the **MERN** stack. Users browse movies, pick a theatre and show, select seats, and pay via **Stripe**. Role-based access supports **admins** (manage movies, approve theatres), **theatre partners** (manage their theatres and shows), and **users** (browse and book).

> Master of Science in Computer Science — Applied Full-Stack Capstone Project.

---

## ✨ Features

- **Authentication & authorization** — register/login with **JWT**, passwords hashed with **bcrypt**, forgot/reset password via email (OTP).
- **Role-based access** — `admin`, `partner`, `user`.
- **Movies** — admins add/update/delete movies; everyone can browse & search.
- **Theatres** — partners register theatres; admins approve (activate) them.
- **Shows** — partners schedule shows (movie + theatre + date/time/price/seats).
- **Booking & payments** — seat selection and **Stripe** payment, then ticket booking with a transaction id.
- **Security** — `helmet`, `express-rate-limit`, `express-mongo-sanitize`, CORS, content-security-policy.

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Redux Toolkit, React Router, Ant Design, Axios, Luxon, `react-stripe-checkout` |
| **Backend** | Node.js, Express, Mongoose |
| **Database** | MongoDB |
| **Auth/Security** | JWT, bcrypt, helmet, express-rate-limit, express-mongo-sanitize, CORS |
| **Payments** | Stripe |
| **Email** | Nodemailer (Gmail) |

## 📁 Structure

```
BookMyShow/
├── Backend/                 # Express API (MVC)
│   ├── config/db.js         # MongoDB connection
│   ├── controllers/         # user, movie, theatre, show, booking
│   ├── middleware/          # JWT auth middleware
│   ├── models/              # Mongoose schemas
│   ├── routes/              # /bms/* routes
│   ├── utils/               # email helper + templates
│   ├── seed.js              # demo data seeder
│   └── server.js            # entry point (port 8083)
└── FrontEnd/                # React + Vite app (proxies /bms -> :8083)
    └── src/                 # api, components, pages, redux
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local, or Docker: `docker run -d -p 27017:27017 --name bms-mongo mongo:7`)

### 1. Backend
```bash
cd Backend
npm install
cp .env.example .env        # then fill in the values
npm start                   # runs on http://localhost:8083
```

### 2. Frontend
```bash
cd FrontEnd
npm install
npm run dev                 # Vite dev server, proxies /bms -> :8083
```

### 3. (Optional) Seed demo data
```bash
cd Backend
node seed.js
```
Creates demo accounts (password `Passw0rd!`): `admin@bms.com` (admin), `partner@bms.com` (partner), `user@bms.com` (user), plus movies, theatres and shows.

## 🔑 Environment Variables (`Backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | API port — **must be 8083** (the Vite proxy target) |
| `MONGODB_URL` | MongoDB connection string |
| `SECRET_KEY` | JWT signing secret |
| `STRIPE_KEY` | Stripe **secret** (test) key for payments |
| `GMAIL_USER` | Gmail address for password-reset emails |
| `GMAIL_APP_PASSWORD` | Gmail app password |

## 🔌 API (base path `/bms`)

| Resource | Endpoints |
|---|---|
| Users | `POST /users/register`, `POST /users/login`, `GET /users/getCurrentUser`, `POST /users/forgetPassword`, `POST /users/resetPassword` |
| Movies | `GET /movies/getAllMovies`, `POST /movies/addMovie`, `PATCH /movies/updateMovie`, `DELETE /movies/deleteMovie/:id`, `GET /movies/movie/:id` |
| Theatres | `POST /theatres/addTheatre`, `PATCH /theatres/updateTheatre`, `GET /theatres/getAllTheatres`, `GET /theatres/getAllTheatresByOwner`, `DELETE /theatres/deleteTheatre/:id` |
| Shows | `POST /shows/addShow`, `PATCH /shows/updateShow`, `DELETE /shows/deleteShow/:id`, `POST /shows/getAllShowsByTheatre`, `POST /shows/getAllTheatersByMovie`, `POST /shows/getShowById` |
| Bookings | `POST /bookings/makePayment`, `POST /bookings/bookShow`, `POST /bookings/makePaymentAndBookShow`, `GET /bookings/getAllBookings` |

_All routes except `/users` require a `Authorization: Bearer <JWT>` header._
