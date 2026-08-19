-- The dcm_conversation_fk constraint is already created in 0001_productive_microbe.
-- Keep this historic migration as an explicit no-op so a new TiDB database does not
-- attempt to drop a legacy foreign-key name that was never created.
SELECT 1;
