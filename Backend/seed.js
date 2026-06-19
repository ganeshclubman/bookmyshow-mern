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
const Booking = require("./models/bookingSchema");

const DEMO_PASSWORD = "Passw0rd!"; // same password for every seeded account

// Posters are real images served locally by Vite from FrontEnd/public/posters/*.jpg
const poster = (slug) => `/posters/${slug}.jpg`;

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
  await Promise.all([Movie.deleteMany({}), Theatre.deleteMany({}), Show.deleteMany({}), Booking.deleteMany({})]);

  const movies = await Movie.insertMany([
    { movieName: "Inception", description: "A thief who steals corporate secrets through dream-sharing technology is given a chance to erase his past.", duration: 148, genre: "Sci-Fi", language: "English", releaseDate: new Date("2010-07-16"), poster: poster("inception") },
    { movieName: "The Dark Knight", description: "Batman raises the stakes in his war on crime against the Joker, who plunges Gotham into chaos.", duration: 152, genre: "Action", language: "English", releaseDate: new Date("2008-07-18"), poster: poster("dark-knight") },
    { movieName: "Interstellar", description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.", duration: 169, genre: "Sci-Fi", language: "English", releaseDate: new Date("2014-11-07"), poster: poster("interstellar") },
    { movieName: "3 Idiots", description: "Two friends search for their long-lost companion while recalling their college days and an unconventional genius.", duration: 170, genre: "Comedy/Drama", language: "Hindi", releaseDate: new Date("2009-12-25"), poster: poster("three-idiots") },
    { movieName: "RRR", description: "A fictional history of two legendary revolutionaries and their journey away from home before they began fighting for their country.", duration: 187, genre: "Action/Drama", language: "Telugu", releaseDate: new Date("2022-03-25"), poster: poster("rrr") },
    { movieName: "Oppenheimer", description: "The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.", duration: 180, genre: "Biography/Drama", language: "English", releaseDate: new Date("2023-07-21"), poster: poster("oppenheimer") },
    { movieName: "Dune: Part Two", description: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.", duration: 166, genre: "Sci-Fi", language: "English", releaseDate: new Date("2024-03-01"), poster: poster("dune-part-two") },
    { movieName: "Deadpool & Wolverine", description: "A listless Wade Wilson toils away in civilian life until the Time Variance Authority pulls him into a fight to save the multiverse alongside a reluctant Wolverine.", duration: 128, genre: "Action/Comedy", language: "English", releaseDate: new Date("2024-07-26"), poster: poster("deadpool-wolverine") },
    { movieName: "Inside Out 2", description: "Teenager Riley's mind headquarters is overhauled to make room for new emotions led by Anxiety, just as puberty arrives.", duration: 96, genre: "Animation", language: "English", releaseDate: new Date("2024-06-14"), poster: poster("inside-out-2") },
    { movieName: "Kalki 2898 AD", description: "In a dystopian future, a bounty hunter and a band of rebels protect a pregnant woman whose unborn child is destined to save the world.", duration: 181, genre: "Sci-Fi", language: "Telugu", releaseDate: new Date("2024-06-27"), poster: poster("kalki-2898-ad") },
    { movieName: "Stree 2", description: "The headless entity Sarkata terrorises Chanderi by abducting its women, and the town's unlikely protectors must rise once more.", duration: 149, genre: "Horror/Comedy", language: "Hindi", releaseDate: new Date("2024-08-15"), poster: poster("stree-2") },
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

  // 4) Shows over the next few days.
  // The frontend queries shows with a "YYYY-MM-DD" string, which Mongoose casts
  // to UTC midnight. So we must store the show date as UTC midnight of the LOCAL
  // calendar date (today + offset) — using local midnight would be off by the
  // timezone, and no theatres would match. Times are "HH:mm" (24h) because the
  // UI re-parses them with moment(time, "HH:mm") for display.
  const d = (offsetDays) => {
    const now = new Date();
    now.setDate(now.getDate() + offsetDays);
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  };
  const shows = [];
  const times = ["10:00", "13:30", "18:00", "21:30"];
  movies.forEach((m, i) => {
    // every movie gets a show TODAY, tomorrow and the day after (offsets 0,1,2)
    // so whichever day the seed is run, each movie is bookable "today"
    [0, 1, 2].forEach((offset) => {
      const t = times[(i + offset) % times.length];
      shows.push({
        name: `${m.movieName} - ${t}`,
        date: d(offset),
        time: t,
        movie: m._id,
        theatre: (offset % 2 === 0 ? theatre : theatre2)._id,
        ticketPrice: 200 + offset * 50,
        totalSeats: 100,
        bookedSeats: [],
      });
    });
  });
  const createdShows = await Show.insertMany(shows);
  console.log(`Shows inserted: ${createdShows.length}`);

  // 5) One confirmed booking for user@bms.com so the "My Bookings" page has content
  const sampleSeats = [23, 24];
  const oppShow = createdShows.find((s) => String(s.movie) === String(movies[5]._id)); // Oppenheimer, today
  await Booking.create({
    show: oppShow._id,
    user: user._id,
    seats: sampleSeats,
    transactionId: "pi_demo_seed_BMS0001",
  });
  await Show.findByIdAndUpdate(oppShow._id, { bookedSeats: sampleSeats }); // reflect on the seat map
  console.log(`Sample booking: user@bms.com -> "${oppShow.name}" seats ${sampleSeats.join(", ")}`);

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
