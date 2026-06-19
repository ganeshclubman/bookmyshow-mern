import React from "react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { hideLoading, showLoading } from "../redux/loaderSlice";
import { getShowById } from "../api/show";
import { useNavigate, useParams } from "react-router-dom";
import { message, Card, Row, Col, Button } from "antd";
import moment from "moment";
import { bookShow, createCheckoutSession } from "../api/booking";

// Demo mode: when true, "Pay Now" books directly with no Stripe call (handy if no
// keys are configured). When false (default), it opens Stripe's hosted Checkout,
// which runs server-side with the secret key in Backend/.env.
const DEMO_PAYMENT = false;

const BookShow = () => {
  const params = useParams();
  const dispatch = useDispatch();
  const [show, setShow] = useState();
  const [selectedSeats, setSelectedSeats] = useState([]);
  const { user } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const getData = async () => {
    try {
      dispatch(showLoading());
      const response = await getShowById({ showId: params.id });
      if (response.success) {
        setShow(response.data);
      } else {
        message.error(response.message);
      }
      dispatch(hideLoading());
    } catch (err) {
      message.error(err.message);
      dispatch(hideLoading());
    }
  };

  const getSeats = () => {
    let columns = 12;
    let totalSeats = show.totalSeats;
    let rows = Math.ceil(totalSeats / columns);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div className="w-100 max-width-600 mx-auto mb-25px">
          <p className="text-center mb-10px">
            Screen this side, you will be watching in this direction
          </p>
          <div className="screen-div"></div>
          <ul className="seat-ul justify-content-center">
            {Array.from(Array(rows).keys()).map((row) => {
              // to be discussed how we are spliting it into multiple rows
              return Array.from(Array(columns).keys()).map((column) => {
                let seatNumber = row * columns + column + 1;
                let seatClass = "seat-btn";
                if (selectedSeats.includes(seatNumber)) {
                  seatClass += " selected";
                }
                if (show.bookedSeats.includes(seatNumber)) {
                  seatClass += " booked";
                }
                if (seatNumber <= totalSeats)
                  return (
                    <li key={seatNumber}>
                      <button
                        onClick={() => {
                          if (!seatClass.split(" ").includes("booked")) {
                            if (selectedSeats.includes(seatNumber)) {
                              setSelectedSeats(
                                selectedSeats.filter(
                                  (curSeatNumber) =>
                                    curSeatNumber !== seatNumber
                                )
                              );
                            } else {
                              setSelectedSeats([...selectedSeats, seatNumber]);
                            }
                          }
                        }}
                        className={seatClass}
                      >
                        {seatNumber}
                      </button>
                    </li>
                  );
              });
            })}
          </ul>
        </div>
      </div>
    );
  };

  // const book = async (transactionId) => {
  //   try {
  //     dispatch(showLoading());
  //     const response = await bookShow({
  //       show: params.id,
  //       transactionId,
  //       seats: selectedSeats,
  //       user: user._id,
  //     });
  //     if (response.success) {
  //       message.success("Show Booking done!");
  //       navigate("/profile");
  //     } else {
  //       message.error(response.message);
  //     }
  //     dispatch(hideLoading());
  //   } catch (err) {
  //     message.error(err.message);
  //     dispatch(hideLoading());
  //   }
  // };

  // const onToken = async (token) => {
  //   try {
  //     dispatch(showLoading());
  //     const response = await makePayment(
  //       token,
  //       selectedSeats.length * show.ticketPrice
  //     );
  //     if (response.success) {
  //       message.success(response.message);
  //       book(response.data);
  //       console.log(response);
  //     } else {
  //       message.error(response.message);
  //     }
  //     dispatch(hideLoading());
  //   } catch (err) {
  //     message.error(err.message);
  //     dispatch(hideLoading());
  //   }
  // };

  const payWithCheckout = async () => {
    try {
      dispatch(showLoading());
      const response = await createCheckoutSession({
        showId: params.id,
        seats: selectedSeats,
        userId: user._id,
      });
      if (response.success && response.data?.url) {
        // hand off to Stripe's hosted payment page
        window.location.href = response.data.url;
      } else {
        message.error(response.message || "Unable to start checkout");
      }
    } catch (err) {
      message.error(err.message || "Checkout error");
    } finally {
      dispatch(hideLoading());
    }
  };

  const demoBook = async () => {
    try {
      dispatch(showLoading());
      const response = await bookShow({
        show: params.id,
        seats: selectedSeats,
        user: user._id,
        transactionId: "demo_" + Date.now(),
      });
      if (response.success) {
        message.success("Show Booking done!");
        navigate("/profile");
      } else {
        message.error(response.message);
      }
    } catch (err) {
      message.error(err);
    } finally {
      dispatch(hideLoading());
    }
  };

  useEffect(() => {
    getData();
  }, []);
  return (
    <div>
      {show && (
        <Row gutter={24}>
          <Col span={24}>
            <Card
              title={
                <div className="movie-title-details">
                  <h1>{show.movie.movieName}</h1>
                  <p>
                    Theatre: {show.theatre.name}, {show.theatre.address}
                  </p>
                </div>
              }
              extra={
                <div className="show-name py-3">
                  <h3>
                    <span>Show Name:</span> {show.name}
                  </h3>
                  <h3>
                    <span>Date & Time: </span>
                    {moment(show.date).format("MMM Do YYYY")} at
                    {moment(show.time, "HH:mm").format("hh:mm A")}
                  </h3>
                  <h3>
                    <span>Ticket Price:</span> Rs. {show.ticketPrice}/-
                  </h3>
                  <h3>
                    <span>Total Seats:</span> {show.totalSeats}
                    <span> &nbsp;|&nbsp; Available Seats:</span>
                    {show.totalSeats - show.bookedSeats.length}
                  </h3>
                </div>
              }
              style={{ width: "100%" }}
            >
              {getSeats()}

              {selectedSeats.length > 0 && (
                <div className="max-width-600 mx-auto">
                  <Button
                    type="primary"
                    shape="round"
                    size="large"
                    block
                    onClick={DEMO_PAYMENT ? demoBook : payWithCheckout}
                  >
                    Pay Now
                  </Button>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default BookShow;
