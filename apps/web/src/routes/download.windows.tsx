import { createFileRoute } from "@tanstack/react-router";
import { handleDownloadWindows } from "@/landing/endpoints";

export const Route = createFileRoute("/download/windows")({
  server: {
    handlers: {
      GET: () => handleDownloadWindows(),
    },
  },
});
