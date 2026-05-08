import React from "react";

// import logo from "";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <img src={logo} alt="Logo" style={styles.logo} />
      <h1>Welcome to Attendance System</h1>

      <button
        style={styles.button}
        onClick={() => navigate("asad.jsx")}
      >
        Go to Attendance
      </button>
    </div>
  );
};

const styles = {
  container: {
    height: "200vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f6f8",
  },
  logo: {
    width: 150,
    marginBottom: 20,
  },
  button: {
    padding: "12px 25px",
    fontSize: 16,
    backgroundColor: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
};

export default Home;
