function shouldRetainForever(entityName, action, newValues) {
  if (["license_units", "license_activations"].includes(entityName)) return true;

  const operation = newValues?.operation;
  return ["reserve", "release_reservation", "mark_expired", "expire_overdue"].includes(operation)
    || ["activate", "cancel"].includes(action);
}

async function recordAudit(client, { userId, entityName, entityId, action, oldValues, newValues, ipAddress, retainForever }) {
  const finalRetainForever =
    retainForever !== undefined
      ? Boolean(retainForever)
      : shouldRetainForever(entityName, action, newValues);

  await client.query(
    `
      INSERT INTO audit_logs (
        user_id,
        entity_name,
        entity_id,
        action,
        old_values,
        new_values,
        ip_address,
        retain_forever
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      userId || null,
      entityName,
      entityId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress || null,
      finalRetainForever,
    ]
  );
}

module.exports = {
  recordAudit,
};
