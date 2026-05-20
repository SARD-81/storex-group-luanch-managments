import { loginAction } from "@/actions/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  missing: "نام کاربری و رمز عبور را وارد کنید.",
  invalid: "اطلاعات ورود نامعتبر است یا حساب شما فعال نیست.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error ? errorMessages[params.error] : null;

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-zinc-950 p-8 text-zinc-50"
    >
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h1 className="mb-6 text-center text-2xl font-bold">ورود به سامانه</h1>

        {error ? (
          <p className="mb-4 rounded-xl bg-rose-900/40 p-3 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <div>
  <label htmlFor="username" className="mb-2 block text-sm text-zinc-300">
    نام کاربری
  </label>
  <input
    id="username"
    name="username"
    type="text"
    required
    autoComplete="username"
    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-right text-zinc-100 outline-none ring-zinc-500 transition focus:ring-2"
  />
</div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-zinc-300"
            >
              رمز عبور
            </label>
            <input
  id="password"
  name="password"
  type="password"
  required
  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-right text-zinc-100 outline-none ring-zinc-500 transition focus:ring-2"
/>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            ورود
          </button>
        </form>
      </section>
    </main>
  );
}
