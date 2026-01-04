import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Store,
  Package,
  DollarSign,
  Eye,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { CreateListingButton } from "@/components/admin/marketplace-actions";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    category?: string;
    search?: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  ACTIVE: { label: "Active", color: "text-emerald-400 bg-emerald-500/10", icon: CheckCircle },
  SOLD: { label: "Sold", color: "text-blue-400 bg-blue-500/10", icon: ShoppingCart },
  CANCELLED: { label: "Cancelled", color: "text-red-400 bg-red-500/10", icon: XCircle },
  EXPIRED: { label: "Expired", color: "text-gray-400 bg-gray-500/10", icon: Clock },
};

export default async function AdminMarketplacePage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "marketplace.view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const statusFilter = params.status || "";
  const categoryFilter = params.category || "";
  const searchQuery = params.search || "";

  // Build where clause
  const where: Record<string, unknown> = {};
  if (statusFilter) {
    where.status = statusFilter;
  }
  if (categoryFilter) {
    where.category = categoryFilter;
  }
  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  // Fetch listings with pagination
  const [listings, totalCount] = await Promise.all([
    prisma.marketplaceListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: { purchases: true },
        },
      },
    }),
    prisma.marketplaceListing.count({ where }),
  ]);

  // Type assertion for Prisma Accelerate
  type ListingWithSeller = (typeof listings)[0] & {
    seller: { id: string; name: string | null; email: string; avatar: string | null };
    _count: { purchases: number };
  };
  const typedListings = listings as ListingWithSeller[];

  // Get stats
  const [totalListings, activeListings, totalSales, totalRevenue] = await Promise.all([
    prisma.marketplaceListing.count(),
    prisma.marketplaceListing.count({ where: { status: "ACTIVE" } }),
    prisma.marketplacePurchase.count(),
    prisma.marketplacePurchase.aggregate({ _sum: { amount: true } }),
  ]);

  // Get unique categories
  const categories = await prisma.marketplaceListing.groupBy({
    by: ["category"],
    _count: { id: true },
  });
  type CategoryCount = { category: string; _count: { id: number } };
  const typedCategories = categories as CategoryCount[];

  const totalPages = Math.ceil(totalCount / pageSize);
  const canManage = hasPermission(adminRole, "marketplace.manage");

  const buildQueryString = (newPage: number, newStatus?: string, newCategory?: string) => {
    const queryParams = new URLSearchParams();
    queryParams.set("page", newPage.toString());
    if (newStatus !== undefined) {
      if (newStatus) queryParams.set("status", newStatus);
    } else if (statusFilter) {
      queryParams.set("status", statusFilter);
    }
    if (newCategory !== undefined) {
      if (newCategory) queryParams.set("category", newCategory);
    } else if (categoryFilter) {
      queryParams.set("category", categoryFilter);
    }
    if (searchQuery) queryParams.set("search", searchQuery);
    return queryParams.toString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketplace Management</h1>
          <p className="text-gray-400 mt-1">
            Manage listings, sales, and marketplace activity
          </p>
        </div>
        <CreateListingButton canManage={canManage} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <Package className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalListings.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Listings</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Store className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeListings.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Active Listings</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalSales.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Sales</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                ${(totalRevenue._sum.amount || 0).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">Total Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <form className="flex-1 max-w-md" action="/admin/marketplace" method="GET">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Search listings..."
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
            />
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/marketplace"
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !statusFilter && !categoryFilter
                ? "bg-indigo-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            All
          </Link>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <Link
              key={status}
              href={`/admin/marketplace?${buildQueryString(1, status, "")}`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                statusFilter === status
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {config.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Category Filters */}
      {typedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 py-1">Categories:</span>
          {typedCategories.map((cat) => (
            <Link
              key={cat.category}
              href={`/admin/marketplace?${buildQueryString(1, "", cat.category)}`}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                categoryFilter === cat.category
                  ? "bg-purple-500 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {cat.category} ({cat._count.id})
            </Link>
          ))}
        </div>
      )}

      {/* Listings Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {typedListings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Listing</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Seller</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Category</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Price</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Stats</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {typedListings.map((listing) => {
                  const statusConfig = STATUS_CONFIG[listing.status] || STATUS_CONFIG.ACTIVE;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={listing.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="max-w-xs">
                          <p className="font-medium text-white truncate">{listing.title}</p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(listing.createdAt))} ago
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                            {listing.seller.name?.charAt(0) || listing.seller.email.charAt(0)}
                          </div>
                          <div>
                            <Link
                              href={`/admin/users/${listing.seller.id}`}
                              className="text-sm text-white hover:text-indigo-400"
                            >
                              {listing.seller.name || "Unnamed"}
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                          {listing.category}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-white font-semibold">
                          ${listing.price.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {listing.views}
                          </span>
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="w-3.5 h-3.5" />
                            {listing._count.purchases}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Link
                          href={`/admin/marketplace/${listing.id}`}
                          className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center">
            <Store className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-medium text-white mb-2">No listings found</h3>
            <p className="text-gray-400">
              {searchQuery || statusFilter || categoryFilter
                ? "Try adjusting your filters"
                : "Marketplace listings will appear here"}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalCount > pageSize && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {skip + 1} - {Math.min(skip + pageSize, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <Link
                href={page > 1 ? `/admin/marketplace?${buildQueryString(page - 1)}` : "#"}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  page > 1
                    ? "bg-gray-800 text-white hover:bg-gray-700"
                    : "bg-gray-800/50 text-gray-600 cursor-not-allowed"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Link>
              <Link
                href={
                  page < totalPages
                    ? `/admin/marketplace?${buildQueryString(page + 1)}`
                    : "#"
                }
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  page < totalPages
                    ? "bg-gray-800 text-white hover:bg-gray-700"
                    : "bg-gray-800/50 text-gray-600 cursor-not-allowed"
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
