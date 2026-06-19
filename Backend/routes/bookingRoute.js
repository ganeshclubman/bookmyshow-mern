const router = require("express").Router();
const {
  makePayment,
  bookShow,
  getAllBookings,
  makePaymentAndBookShow,
  createCheckoutSession,
  confirmBooking,
} = require("../controllers/bookingController");

router.post("/makePayment", makePayment);
router.post("/bookShow", bookShow);
router.get("/getAllBookings", getAllBookings);
router.post("/makePaymentAndBookShow", makePaymentAndBookShow);
router.post("/createCheckoutSession", createCheckoutSession);
router.post("/confirmBooking", confirmBooking);

module.exports = router;
