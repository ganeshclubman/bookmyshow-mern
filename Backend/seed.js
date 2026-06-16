/**
 * Seed script for BookMyShow.
 * Populates the database with demo users (admin / partner / user), movies,
 * a theatre, and shows so the app has content to browse, book, and screenshot.
 *
 * Usage:  node seed.js
 * (Reads MONGODB_URL from .env — make sure MongoDB is running.)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("./models/userSchema");
const Movie = require("./models/movieSchema");
const Theatre = require("./models/theatreSchema");
const Show = require("./models/showSchema");

const DEMO_PASSWORD = "Passw0rd!"; // same password for every seeded account

const poster = (name, bg = "1a1a2e") =>
  `https://placehold.co/300x450/${bg}/ffffff?text=${encodeURIComponent(name)}`;

async function upsertUser(name, email, role) {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, await bcrypt.genSalt(10));
  return User.findOneAndUpdate(
    { email },
    { name, email, role, password: hashed },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("Connected to", process.env.MONGODB_URL);

  // 1) Users (one of each role) + promote the existing demo user to admin
  const admin = await upsertUser("Admin User", "admin@bms.com", "admin");
  const partner = await upsertUser("Partner Owner", "partner@bms.com", "partner");
  const user = await upsertUser("Regular User", "user@bms.com", "user");
  await User.findOneAndUpdate({ email: "demo@bms.com" }, { role: "admin" });
  console.log("Users ready: admin@bms.com, partner@bms.com, user@bms.com (+demo@bms.com=admin)");

  // 2) Fresh movies/theatres/shows
  await Promise.all([Movie.deleteMany({}), Theatre.deleteMany({}), Show.deleteMany({})]);

  const movies = await Movie.insertMany([
    { movieName: "Inception", description: "A thief who steals corporate secrets through dream-sharing technology is given a chance to erase his past.", duration: 148, genre: "Sci-Fi", language: "English", releaseDate: new Date("2010-07-16"), poster: poster("Inception", "0f3460") },
    { movieName: "The Dark Knight", description: "Batman raises the stakes in his war on crime against the Joker, who plunges Gotham into chaos.", duration: 152, genre: "Action", language: "English", releaseDate: new Date("2008-07-18"), poster: poster("The Dark Knight", "16213e") },
    { movieName: "Interstellar", description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.", duration: 169, genre: "Sci-Fi", language: "English", releaseDate: new Date("2014-11-07"), poster: poster("Interstellar", "1b1b2f") },
    { movieName: "3 Idiots", description: "Two friends search for their long-lost companion while recalling their college days and an unconventional genius.", duration: 170, genre: "Comedy/Drama", language: "Hindi", releaseDate: new Date("2009-12-25"), poster: poster("3 Idiots", "533483") },
    { movieName: "RRR", description: "A fictional history of two legendary revolutionaries and their journey away from home before they began fighting for their country.", duration: 187, genre: "Action/Drama", language: "Telugu", releaseDate: new Date("2022-03-25"), poster: poster("RRR", "7b2cbf") },
    { movieName: "Oppenheimer", description: "The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.", duration: 180, genre: "Biography/Drama", language: "English", releaseDate: new Date("2023-07-21"), poster: poster("Oppenheimer", "1a1a2e") },
  ]);
  console.log(`Movies inserted: ${movies.length}`);

  // 3) Theatre owned by the partner, ACTIVE so it appears for booking
  const theatre = await Theatre.create({
    name: "PVR Cinemas - Phoenix Mall",
    address: "Whitefield, Bengaluru, Karnataka",
    phone: 9876543210,
    email: "phoenix@pvrcinemas.com",
    owner: partner._id,
    isActive: true,
  });
  const theatre2 = await Theatre.create({
    name: "INOX - Forum Mall",
    address: "Koramangala, Bengaluru, Karnataka",
    phone: 9123456780,
    email: "forum@inox.com",
    owner: partner._id,
    isActive: true,
  });
  console.log("Theatres inserted: 2 (active)");

  // 4) Shows over the next few days
  const d = (offsetDays) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    dt.setHours(0, 0, 0, 0);
    return dt;
  };
  const shows = [];
  const times = ["10:00 AM", "01:30 PM", "06:00 PM", "09:30 PM"];
  movies.slice(0, 4).forEach((m, i) => {
    times.forEach((t, j) => {
      shows.push({
        name: `${m.movieName} - ${t}`,
        date: d(i % 3),
        time: t,
        movie: m._id,
        theatre: (j % 2 === 0 ? theatre : theatre2)._id,
        ticketPrice: 200 + j * 50,
        totalSeats: 100,
        bookedSeats: [],
      });
    });
  });
  const createdShows = await Show.insertMany(shows);
  console.log(`Shows inserted: ${createdShows.length}`);

  console.log("\n===== SEED COMPLETE =====");
  console.log("Login (password for all = " + DEMO_PASSWORD + "):");
  console.log("  admin@bms.com    -> admin   (manage movies, activate theatres)");
  console.log("  partner@bms.com  -> partner (owns theatres, add shows)");
  console.log("  user@bms.com     -> user    (browse & book tickets)");
  console.log("  demo@bms.com     -> admin");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (e) => {
  console.error("SEED ERROR:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
