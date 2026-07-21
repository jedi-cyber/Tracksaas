async function recordAudit(client, { userId, entityName, entityId, action, oldValues, newValues, ipAddress }) {
  await client.query(
    `
      INSERT INTO audit_logs (
        user_id,
        entity_name,
        entity_id,
        action,
        old_values,
        new_values,
        ip_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      userId || null,
      entityName,
      entityId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress || null,
    ]
  );
}

module.exports = {
  recordAudit,
};
