import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users, type UserRecord } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<UserRecord> {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to sync user record:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function updateUserTimeZone(
  userId: number,
  timezone: string
): Promise<UserRecord | null> {
  const [updated] = await db
    .update(users)
    .set({
      timezone,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return updated ?? null;
}
