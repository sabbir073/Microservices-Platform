"use client";

import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Rahim Ahmed",
    role: "Student, Dhaka",
    avatar: "RA",
    rating: 5,
    content:
      "I've been using EarnGPT for 3 months and already earned over $500. The tasks are simple and payments are always on time via bKash!",
    earned: "$523",
  },
  {
    name: "Fatima Khan",
    role: "Housewife, Chittagong",
    avatar: "FK",
    rating: 5,
    content:
      "Perfect for earning from home. I complete tasks while my kids are at school. The referral system helped me earn passive income too.",
    earned: "$1,200",
  },
  {
    name: "Kamal Hossain",
    role: "Freelancer, Sylhet",
    avatar: "KH",
    rating: 5,
    content:
      "The Premium plan is worth every penny. Unlimited tasks and 0% withdrawal fee means I keep all my earnings. Best platform!",
    earned: "$2,150",
  },
  {
    name: "Nusrat Jahan",
    role: "Teacher, Rajshahi",
    avatar: "NJ",
    rating: 5,
    content:
      "I was skeptical at first, but EarnGPT proved me wrong. Real payments, real support, and genuine earning opportunities.",
    earned: "$890",
  },
  {
    name: "Imran Hasan",
    role: "University Student",
    avatar: "IH",
    rating: 5,
    content:
      "As a student, this is perfect for me. I earn during my free time and the mobile app makes it super convenient.",
    earned: "$340",
  },
  {
    name: "Rashida Begum",
    role: "Small Business Owner",
    avatar: "RB",
    rating: 5,
    content:
      "The 10-level referral system is amazing! I've built a team and now earn passive income every day without doing tasks myself.",
    earned: "$3,500",
  },
];

const stats = [
  { value: "4.9/5", label: "Average Rating" },
  { value: "50K+", label: "Happy Users" },
  { value: "$2M+", label: "Total Paid Out" },
  { value: "98%", label: "Satisfaction Rate" },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="py-20 sm:py-28 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Loved by{" "}
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              50,000+ Users
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Real stories from real earners. See what our community has to say.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, i) => (
            <div
              key={i}
              className="relative p-6 rounded-2xl bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              {/* Quote Icon */}
              <Quote className="absolute top-4 right-4 w-8 h-8 text-indigo-500/20" />

              {/* Header */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <h4 className="font-semibold text-white">{testimonial.name}</h4>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Content */}
              <p className="text-gray-400 leading-relaxed mb-4">
                &quot;{testimonial.content}&quot;
              </p>

              {/* Earned Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="text-xs text-gray-400">Total Earned:</span>
                <span className="text-sm font-bold text-green-400">{testimonial.earned}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="text-center p-6 rounded-2xl bg-gray-800/50 border border-gray-700"
            >
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
