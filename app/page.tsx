import { prisma } from "@/lib/prisma";

export default async function Home() {
  const users = await prisma.user.findMany({
    include: {
      weeklyPreferences: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-zinc-50">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold">Lunch Dashboard</h1>

        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Weekly Preferences</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-800">
                  <td className="p-4">{user.name}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">{user.weeklyPreferences.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}