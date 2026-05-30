export default function Loading() {
  return (
    <main
      dir="rtl"
      className="dashboard-aurora-shell min-h-screen p-6 text-right text-foreground md:p-8"
    >
      <div className="dashboard-aurora dashboard-aurora-one" />
      <div className="dashboard-aurora dashboard-aurora-two" />
      <div className="dashboard-aurora dashboard-aurora-three" />
      <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center">
        <div className="dashboard-glass-card flex items-center gap-4 px-6 py-5 text-base font-medium">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>در حال بارگذاری اطلاعات...</span>
        </div>
      </div>
    </main>
  );
}
