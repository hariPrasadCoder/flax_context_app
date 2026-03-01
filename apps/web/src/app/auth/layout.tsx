// Auth pages render without the app shell (no sidebar)
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
