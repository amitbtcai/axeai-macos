import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { mountApp } from "./mount-app";

export function mountEmbeddedApp(): void {
  mountApp(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}
