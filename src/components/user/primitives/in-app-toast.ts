import { toast } from "sonner";

export const inAppToast = {
  success(message: string, description?: string) {
    return toast.success(message, { description, duration: 4000 });
  },
  error(message: string, description?: string) {
    return toast.error(message, { description, duration: 4000 });
  },
  info(message: string, description?: string) {
    return toast(message, { description, duration: 4000 });
  },
  warning(message: string, description?: string) {
    return toast.warning(message, { description, duration: 4000 });
  },
  reward(amount: number, unit: "pts" | "USD" = "pts", description?: string) {
    return toast.success(
      unit === "pts"
        ? `+${amount.toLocaleString()} pts`
        : `+$${amount.toFixed(2)}`,
      {
        description: description ?? "Reward credited",
        duration: 4000,
      }
    );
  },
};
