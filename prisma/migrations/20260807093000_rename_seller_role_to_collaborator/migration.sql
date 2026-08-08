UPDATE "Role"
SET "key" = 'collaborator',
    "name" = 'Colaborador',
    "updatedAt" = NOW()
WHERE "key" = 'seller';
