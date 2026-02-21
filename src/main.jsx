import React from "react";
import  app from "./App.jsx";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AttendanceApp from "./asad.jsx"; 

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <AttendanceApp />
  </React.StrictMode>
);