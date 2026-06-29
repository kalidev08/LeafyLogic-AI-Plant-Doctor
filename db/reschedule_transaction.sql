-- FloraDoc Prescription Schedule Rescheduling & Correction Transaction
-- Safely modifies future, unapplied treatment slot times without corrupting completed records.

CREATE OR REPLACE FUNCTION modify_future_treatment_slots(
    p_schedule_id VARCHAR,
    p_target_slot_index INT,
    p_new_hour INT,
    p_new_minute INT,
    p_is_sun_sensitive BOOLEAN
) RETURNS INT AS $$
DECLARE
    v_updated_count INT := 0;
    v_safety_breach BOOLEAN := FALSE;
BEGIN
    -- 1. Validate environmental Diurnal daylight safety if compound is sun-sensitive
    -- 9:00 AM to 5:00 PM (17:00) represents high UV peak; blocked if true
    IF p_is_sun_sensitive AND (p_new_hour >= 9 AND p_new_hour < 17) THEN
        RAISE EXCEPTION 'DIURNAL_UV_BREACH: Target hour %:00 is within peak sunlight (09:00 - 17:00) which causes chemical degradation.', p_new_hour;
    END IF;

    -- 2. Execute transactional update on unapplied future instances (scheduled_time > NOW())
    -- We parse and adjust the high-precision hour & minute of the scheduled UTC datetime
    -- We target the specific slot index (e.g. dose 0 vs dose 1) using suffixes
    UPDATE treatment_logs
    SET scheduled_time = (
        (scheduled_time::timestamp::date)::timestamp + 
        (p_new_hour * INTERVAL '1 hour') + 
        (p_new_minute * INTERVAL '1 minute')
    )::timestamp
    WHERE schedule_id = p_schedule_id
      AND actual_applied_time IS NULL
      AND scheduled_time > NOW()
      AND (
          -- Suffix match on log ID to match the correct dose (target_slot_index)
          -- Log ID format: log-scheduleId-d<day>-dose<dose>
          id LIKE '%-dose' || p_target_slot_index
      );

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;
