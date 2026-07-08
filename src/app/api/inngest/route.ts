import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Inngest handshake + function execution endpoint.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
