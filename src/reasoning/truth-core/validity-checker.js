/**
 * validity-checker.js
 * Logical consistency validation for new facts or statements.
 */
import { getFact } from './foundation-facts.js';
import { publish } from '../../core/events.js';

/**
 * Validate a new statement against foundational facts.
 * @param {{ key: string, value: any }} statement
 * @returns {{ valid: boolean, conflict: object|null }}
 */
export function validateStatement(statement) {
  const existing = getFact(statement.key);
  let valid = true;
  let conflict = null;
  if (existing !== null && existing.toString() !== statement.value.toString()) {
    valid = false;
    conflict = { key: statement.key, existing, proposed: statement.value };
  }
  publish('reasoning:statement-validated', { statement, valid, conflict });
  return { valid, conflict };
}
