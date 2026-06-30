import React from "react";
import { createRoot } from "react-dom/client";
import Almanac from "./Almanac.jsx";

const el = document.getElementById("root");
createRoot(el).render(
  <React.StrictMode>
    <Almanac />
  </React.StrictMode>
);
