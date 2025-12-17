import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  Building,
  Smartphone,
} from "lucide-react";
import Link from "next/link";

export default async function WalletPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Wallet</h1>
          <p className="text-gray-400 mt-1">
            Manage your earnings and withdrawals
          </p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-lg hover:opacity-90 transition-opacity">
          <Plus className="w-5 h-5" />
          Withdraw
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Wallet className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-sm text-gray-400">Points Balance</span>
          </div>
          <p className="text-3xl font-bold text-white">0</p>
          <p className="text-sm text-gray-500 mt-1">≈ $0.00 USD</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-sm text-gray-400">Total Earned</span>
          </div>
          <p className="text-3xl font-bold text-white">$0.00</p>
          <p className="text-sm text-gray-500 mt-1">Lifetime earnings</p>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <ArrowDownRight className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">Total Withdrawn</span>
          </div>
          <p className="text-3xl font-bold text-white">$0.00</p>
          <p className="text-sm text-gray-500 mt-1">Lifetime withdrawals</p>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Payment Methods</h2>
          <button className="text-sm text-indigo-400 hover:text-indigo-300">
            Add New
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-pink-400" />
              </div>
              <span className="font-medium text-white">bKash</span>
            </div>
            <p className="text-sm text-gray-500">Mobile wallet</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-orange-400" />
              </div>
              <span className="font-medium text-white">Nagad</span>
            </div>
            <p className="text-sm text-gray-500">Mobile wallet</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-amber-400" />
              </div>
              <span className="font-medium text-white">Binance</span>
            </div>
            <p className="text-sm text-gray-500">Crypto wallet</p>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-400" />
              </div>
              <span className="font-medium text-white">PayPal</span>
            </div>
            <p className="text-sm text-gray-500">International</p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            Transaction History
          </h2>
          <select className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="all">All Transactions</option>
            <option value="earnings">Earnings</option>
            <option value="withdrawals">Withdrawals</option>
          </select>
        </div>

        <div className="flex items-center justify-center py-12 text-gray-500">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No transactions yet</p>
            <p className="text-sm mt-1">
              Complete tasks to start earning!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
