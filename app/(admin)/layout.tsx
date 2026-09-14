import { Sidebar } from "@/components/sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1 md:pl-64">
        <main className="h-full min-w-0 p-4 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  )
}
