import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { message } from "antd";
import { hideLoading, showLoading } from "../redux/loaderSlice";
import { confirmBooking } from "../api/booking";

// Landing page Stripe redirects to after a successful hosted-Checkout payment.
// It reads the Checkout session id from the URL, asks the backend to verify the
// payment and create the booking, then sends the user to their bookings.
const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [status, setStatus] = useState("Confirming your payment…");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      navigate("/");
      return;
    }
    (async () => {
      try {
        dispatch(showLoading());
        const response = await confirmBooking(sessionId);
        if (response.success) {
          message.success("Payment successful — booking confirmed!");
          navigate("/profile");
        } else {
          setStatus(response.message || "Could not confirm your booking.");
          message.error(response.message || "Could not confirm your booking.");
        }
      } catch (err) {
        setStatus("Something went wrong while confirming your booking.");
        message.error(err.message || "Error");
      } finally {
        dispatch(hideLoading());
      }
    })();
  }, []);

  return (
    <div className="text-center pt-3">
      <h2 className="blue-clr">{status}</h2>
    </div>
  );
};

export default PaymentSuccess;
