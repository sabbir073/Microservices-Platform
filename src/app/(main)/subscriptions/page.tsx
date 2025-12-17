import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Crown, Check, Star } from "lucide-react";

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      features: ["5 tasks per day", "Basic support", "Standard withdrawals"],
      current: true,
    },
    {
      name: "Pro",
      price: "$9.99",
      period: "/month",
      features: ["Unlimited tasks", "Priority support", "Lower withdrawal fees", "Exclusive tasks", "2x XP bonus"],
      popular: true,
    },
    {
      name: "Premium",
      price: "$19.99",
      period: "/month",
      features: ["Everything in Pro", "VIP support", "No withdrawal fees", "Early access", "3x XP bonus", "Custom badge"],
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Upgrade Your Plan</h1>
        <p className="text-gray-400 mt-1">Unlock more earning potential</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <div
            key={plan.name}
            className={`relative bg-gray-900 rounded-xl border p-6 ${
              plan.popular ? "border-indigo-500" : "border-gray-800"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 text-white text-xs font-medium rounded-full">
                Most Popular
              </span>
            )}
            <div className="text-center mb-6">
              <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4 ${
                plan.popular ? "bg-indigo-500/20" : "bg-gray-800"
              }`}>
                {plan.popular ? <Crown className="w-6 h-6 text-indigo-400" /> : <Star className="w-6 h-6 text-gray-400" />}
              </div>
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                <span className="text-gray-500">{plan.period}</span>
              </div>
            </div>
            <ul className="space-y-3 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-gray-400">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                plan.current
                  ? "bg-gray-800 text-gray-400 cursor-default"
                  : plan.popular
                  ? "bg-indigo-500 text-white hover:bg-indigo-600"
                  : "bg-gray-800 text-white hover:bg-gray-700"
              }`}
              disabled={plan.current}
            >
              {plan.current ? "Current Plan" : "Upgrade"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
