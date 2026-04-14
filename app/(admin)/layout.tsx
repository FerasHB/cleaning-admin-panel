import { Sidebar } from "@/components/sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 md:pl-64">
        <main className="h-full p-4 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  )
}
