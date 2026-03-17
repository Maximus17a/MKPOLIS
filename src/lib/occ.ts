// Optimistic Concurrency Control helpers

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export class ConflictError extends Error {
  constructor(table: string, id: string) {
    super(`OCC conflict on ${table} id=${id}. Version mismatch — another update occurred.`);
    this.name = 'ConflictError';
  }
}

type VersionedTable = 'games' | 'players' | 'properties';

/**
 * Perform an OCC-safe update: increment version and use WHERE version = currentVersion.
 * Returns the updated row or throws ConflictError.
 */
export async function occUpdate<T extends Record<string, unknown>>(
  supabase: SupabaseClient<Database>,
  table: VersionedTable,
  id: string,
  currentVersion: number,
  updates: T
) {
  const { data, error } = await supabase
    .from(table)
    .update({ ...updates, version: currentVersion + 1 } as never)
    .eq('id', id)
    .eq('version', currentVersion)
    .select()
    .single();

  if (error || !data) {
    throw new ConflictError(table, id);
  }

  return data;
}

/**
 * Build a standard JSON error response for OCC conflicts → HTTP 409
 */
export function conflictResponse() {
  return Response.json(
    { error: 'Conflict', message: 'Version mismatch. Please retry with latest state.' },
    { status: 409 }
  );
}
