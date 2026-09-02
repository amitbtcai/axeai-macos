import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { mountApp } from "./mount-app";

mountApp(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
