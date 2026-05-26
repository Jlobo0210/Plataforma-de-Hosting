import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import App from "./pages/App";
import ServiceDetail from "./pages/ServiceDetail";

/**
 * main.jsx – Entry point de la Plataforma de Hosting
 *
 * Rutas:
 *  /              → App (Dashboard + Login según sesión)
 *  /projects/:id  → Detalle de proyecto (métricas, URL, rate limit)
 *  *              → Redirige a /
 */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<App />} />
        <Route path="/projects/:id"   element={<ServiceDetail />} />
        {/* Compatibilidad con rutas viejas del proyecto anterior */}
        <Route path="/services/:id"   element={<Navigate to="/" replace />} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);