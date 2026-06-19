const stripe = require("stripe")(process.env.STRIPE_KEY);
const Booking = require("../models/bookingSchema");
const Show = require("../models/showSchema");
const EmailHelper = require("../utils/emailHelper");
const mongoose = require("mongoose");

const makePayment = async (req, res) => {
  try {
    // create a customer
    const { token, amount } = req.body;
    // to do instead of creating customer each time check if customer
    // already exisiting in strip db

    const customers = await stripe.customers.list({
      email: token.email,
      limit: 1,
    });

    let currCustomer = null;
    if (customers.data.length > 0) {
      currCustomer = customers.data[0];
    } else {
      const createNewCustomer = async () => {
        return await stripe.customers.create({
          source: token.id,
          email: token.email,
        });
      };
      currCustomer = await createNewCustomer();
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      customer: currCustomer.id,
      payment_method_types: ["card"],
      receipt_email: token.email,
      description: "Token has been assigned to the movie",
    });
    const transactionId = paymentIntent.id;
    res.send({
      success: true,
      message: "Payment Successfull ! Tickets Booked",
      data: transactionId,
    });
  } catch (error) {
    res.send({
      success: false,
      message: error.message,
    });
  }
};

const bookShow = async (req, res) => {
  try {
    // booking it
    const newBooking = new Booking(req.body);
    await newBooking.save();

    // we are marking booked seats
    const show = await Show.findById(req.body.show).populate("movie");
    // check if tickets are booked
    const updatedBookedSeats = [...show.bookedSeats, ...req.body.seats];
    await Show.findByIdAndUpdate(req.body.show, {
      bookedSeats: updatedBookedSeats,
    });

    const populatedBooking = await Booking.findById(newBooking._id)
      .populate("user")
      .populate("show")
      .populate({
        path: "show",
        populate: {
          path: "movie",
          model: "movies",
        },
      })
      .populate({
        path: "show",
        populate: {
          path: "theatre",
          model: "theatres",
        },
      });

    try {
      await EmailHelper("ticketTemplate.html", populatedBooking.user.email, {
        name: populatedBooking.user.name,
        movie: populatedBooking.show.movie.movieName,
        theatre: populatedBooking.show.theatre.name,
        date: populatedBooking.show.date,
        time: populatedBooking.show.time,
        seats: populatedBooking.seats,
        amount: populatedBooking.seats.length * populatedBooking.show.ticketPrice,
        transactionId: populatedBooking.transactionId,
      });
    } catch (mailErr) {
      // ticket email is best-effort (e.g. Gmail not configured in demo) — never fail the booking
      console.log("Ticket email skipped:", mailErr.message);
    }
    res.send({
      success: true,
      message: "New Booking done!",
      data: newBooking,
    });
  } catch (err) {
    res.send({
      success: false,
      message: err.message,
    });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.body.userId })
      .populate("user")
      .populate("show")
      .populate({
        path: "show",
        populate: {
          path: "movie",
          model: "movies",
        },
      })
      .populate({
        path: "show",
        populate: {
          path: "theatre",
          model: "theatres",
        },
      });

    res.send({
      success: true,
      message: "Bookings fetched!",
      data: bookings,
    });
  } catch (err) {
    res.send({
      success: false,
      message: err.message,
    });
  }
};

const makePaymentAndBookShow = async (req, res) => {
  try {
    const { token, amount, show: showId, seats } = req.body;

    // step 1: ensure a Stripe customer exists for this email
    const customers = await stripe.customers.list({
      email: token.email,
      limit: 1,
    });

    let currCustomer;
    if (customers.data.length > 0) {
      currCustomer = customers.data[0];
    } else {
      currCustomer = await stripe.customers.create({
        email: token.email,
        source: token.id,
      });
    }

    // step 2: create the payment intent using the customer
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      customer: currCustomer.id,
      payment_method_types: ["card"],
      receipt_email: token.email,
      description: "Payment for movie booking!",
    });

    const transactionId = paymentIntent.id;

    // step 3: book the show. The Docker Mongo runs standalone, which doesn't
    // support multi-document transactions, so we guard double-booking with a
    // pre-write check rather than a transaction.
    const show = await Show.findById(showId).populate("movie");
    const seatAlreadyBooked = seats.some((seat) =>
      show.bookedSeats.includes(seat)
    );
    if (seatAlreadyBooked) {
      return res.send({
        success: false,
        message: "One or more seats are already booked.",
      });
    }

    await Show.findByIdAndUpdate(showId, {
      bookedSeats: [...show.bookedSeats, ...seats],
    });
    const newBooking = await new Booking({ ...req.body, transactionId }).save();

    const populatedBooking = await Booking.findById(newBooking._id)
      .populate("user")
      .populate({
        path: "show",
        populate: { path: "movie", model: "movies" },
      })
      .populate({
        path: "show",
        populate: { path: "theatre", model: "theatres" },
      });

    res.send({
      success: true,
      message: "Payment and Booking successful!",
      data: populatedBooking,
    });

    // ticket email is best-effort — never fail a booking if Gmail isn't configured
    try {
      await EmailHelper("ticketTemplate.html", populatedBooking.user.email, {
        name: populatedBooking.user.name,
        movie: populatedBooking.show.movie.movieName,
        theatre: populatedBooking.show.theatre.name,
        date: populatedBooking.show.date,
        time: populatedBooking.show.time,
        seats: populatedBooking.seats,
        amount: populatedBooking.seats.length * populatedBooking.show.ticketPrice,
        transactionId: populatedBooking.transactionId,
      });
    } catch (mailErr) {
      console.log("Ticket email skipped:", mailErr.message);
    }
  } catch (err) {
    res.send({
      success: false,
      message: err.message,
    });
  }
};

// ---- Modern Stripe Checkout (hosted payment page) ----
// New Stripe accounts block publishable-key card tokenization (used by the legacy
// react-stripe-checkout popup). Checkout Sessions run server-side with the secret
// key and redirect to Stripe's hosted page, so there's nothing for the account to
// restrict. createCheckoutSession starts the payment; confirmBooking finalises the
// booking when the user returns to the success_url.
const createCheckoutSession = async (req, res) => {
  try {
    const { showId, seats, userId } = req.body;
    const show = await Show.findById(showId)
      .populate("movie")
      .populate("theatre");
    if (!show) {
      return res.send({ success: false, message: "Show not found" });
    }
    const alreadyBooked = seats.some((s) => show.bookedSeats.includes(s));
    if (alreadyBooked) {
      return res.send({
        success: false,
        message: "One or more seats are already booked.",
      });
    }

    const origin = req.headers.origin || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `${show.movie.movieName} @ ${show.theatre.name}`,
              description: `${show.name} | Seats: ${seats.join(", ")}`,
            },
            unit_amount: show.ticketPrice * 100, // price per seat, in paise
          },
          quantity: seats.length,
        },
      ],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book-show/${showId}`,
      metadata: {
        showId: String(showId),
        userId: String(userId),
        seats: JSON.stringify(seats),
      },
    });

    res.send({
      success: true,
      message: "Checkout session created",
      data: { id: session.id, url: session.url },
    });
  } catch (err) {
    res.send({ success: false, message: err.message });
  }
};

const confirmBooking = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== "paid") {
      return res.send({ success: false, message: "Payment not completed." });
    }

    const transactionId = session.payment_intent || session.id;

    // idempotent: if this session was already booked (e.g. page refresh), return it
    const already = await Booking.findOne({ transactionId });
    if (already) {
      return res.send({
        success: true,
        message: "Booking already confirmed!",
        data: already,
      });
    }

    const { showId, userId, seats: seatsJson } = session.metadata;
    const seats = JSON.parse(seatsJson);

    const show = await Show.findById(showId);
    const seatTaken = seats.some((s) => show.bookedSeats.includes(s));
    if (seatTaken) {
      return res.send({
        success: false,
        message: "One or more seats are already booked.",
      });
    }

    await Show.findByIdAndUpdate(showId, {
      bookedSeats: [...show.bookedSeats, ...seats],
    });
    const booking = await new Booking({
      show: showId,
      user: userId,
      seats,
      transactionId,
    }).save();

    res.send({
      success: true,
      message: "Payment and Booking successful!",
      data: booking,
    });
  } catch (err) {
    res.send({ success: false, message: err.message });
  }
};

module.exports = {
  bookShow,
  makePayment,
  getAllBookings,
  makePaymentAndBookShow,
  createCheckoutSession,
  confirmBooking,
};
