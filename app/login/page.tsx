import { LockKeyhole, UserRound } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { LoginSubmitButton } from "@/components/auth/login-submit-button";
import { ThemeToggle } from "@/components/theme-toggle";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await searchParams;

  return (
    <main
      dir="rtl"
      className="login-aurora-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6 text-foreground"
    >
      <div className="login-aurora login-aurora-one" />
      <div className="login-aurora login-aurora-two" />
      <div className="login-aurora login-aurora-three" />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/10 to-transparent dark:from-white/5" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/25 to-transparent dark:from-black/40" />

      <section className="relative z-10 w-full max-w-md animate-soft-fade-up">
        <div className="login-glass-card group relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/15 p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-black/30 dark:border-white/10 dark:bg-zinc-950/55">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-70" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl transition duration-500 group-hover:bg-cyan-300/30 dark:bg-cyan-400/10" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-48 w-48 rounded-full bg-indigo-300/20 blur-3xl transition duration-500 group-hover:bg-indigo-300/30 dark:bg-indigo-500/10" />

          <div className="relative">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  ورود به داشبورد
                </h1>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  برای مدیریت حضور صبحانه و ناهار، وارد حساب کاربری خود شوید.
                </p>
              </div>

              <ThemeToggle />
            </div>

            <form action={loginAction} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-foreground/85"
                >
                  نام کاربری
                </label>

                <div className="login-input-shell group">
                  <UserRound className="size-4 text-muted-foreground transition group-focus-within:text-foreground" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="مثلاً rasouli"
                    className="w-full bg-transparent px-3 py-3 text-right text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground/85"
                >
                  رمز عبور
                </label>

                <div className="login-input-shell group">
                  <LockKeyhole className="size-4 text-muted-foreground transition group-focus-within:text-foreground" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="رمز عبور"
                    className="w-full bg-transparent px-3 py-3 text-right text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              <LoginSubmitButton />
            </form>

            <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4 text-xs leading-6 text-muted-foreground backdrop-blur dark:border-white/10 dark:bg-white/[0.03]">
              <p>
                دسترسی به این سامانه فقط برای اعضای تعریف‌شده شرکت امکان‌پذیر
                است.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
