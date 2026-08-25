import { createFileRoute } from "@tanstack/react-router";
import { handleDownloadLinux } from "@/landing/endpoints";

export const Route = createFileRoute("/download/linux")({
  server: {
    handlers: {
      GET: () => handleDownloadLinux(),
    },
  },
});
