import { db, usersTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type UserRow = typeof usersTable.$inferSelect;
export type ProfileRow = typeof profilesTable.$inferSelect;

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  return row;
}

export async function findUserById(id: number): Promise<Pick<UserRow, "id" | "email" | "createdAt"> | undefined> {
  const [row] = await db
    .select({ id: usersTable.id, email: usersTable.email, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  return row;
}

export async function createUser(
  email: string,
  passwordHash: string,
): Promise<Pick<UserRow, "id" | "email" | "createdAt">> {
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash })
    .returning({ id: usersTable.id, email: usersTable.email, createdAt: usersTable.createdAt });
  return user!;
}

export async function findProfileByUserId(userId: number): Promise<ProfileRow | undefined> {
  const [row] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  return row;
}

export async function upsertProfile(
  userId: number,
  existing: ProfileRow | undefined,
  data: Partial<typeof profilesTable.$inferInsert>,
): Promise<ProfileRow> {
  if (existing) {
    const [updated] = await db
      .update(profilesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(profilesTable)
    .values({
      userId,
      name: "",
      sport: "",
      level: "beginner",
      goals: [],
      injuryConcerns: [],
      weeklyGoal: 3,
      trainingDays: [0, 1, 2, 3, 4, 5, 6],
      checkInHour: 9,
      avatarUrl: null,
      weeklyGoalCelebratedAt: null,
      ...data,
    })
    .returning();
  return created!;
}
