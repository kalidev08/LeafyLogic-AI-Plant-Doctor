from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, time
import sys
from treatment_dosage_engine import TreatmentDosageEngine

router = APIRouter()

class TreatmentCalculationRequest(BaseModel):
    scan_id: str = Field(..., description="The unique AI diagnostic scan identifier")
    pot_size_liters: float = Field(..., gt=0, description="Volume of the pot container in liters")
    soil_type: str = Field(..., description="Soil Matrix profile (Sandy, Clay, Loam, Potting Mix)")
    severity_pct: Optional[float] = Field(25.0, ge=0, le=100, description="Target severity of disease as a percentage")

class TreatmentCalculationResponse(BaseModel):
    success: bool
    scan_id: str
    base_chemical: str
    exact_dosage_amount: float
    measurement_unit: str
    dilution_water_volume_ml: float
    application_frequency: str
    soil_adjustment_note: str
    is_split_dosage: bool
    warning_banner: str

@router.post("/api/v1/treatments/calculate", response_model=TreatmentCalculationResponse)
async def calculate_treatment(payload: TreatmentCalculationRequest):
    """
    FastAPI Router Endpoint to fetch AI diagnostic scan targets, run the
    dynamic TreatmentDosageEngine, write prescription entries, and respond.
    """
    try:
        # 1. Simulated DB fetch for the AI scan results using the scan_id
        # In a deep production setup, this queries: SELECT plant_name, disease_name FROM scans WHERE id = :scan_id
        # We will dynamically deduce a mockup plant context based on the incoming scan_id parameters,
        # or defaults gracefully if not found.
        simulated_disease = "Fungal Tomato Early Blight"
        
        # 2. Feed the retrieved scan details & payload into the TreatmentDosageEngine
        calculation_result = TreatmentDosageEngine.calculate_treatment(
            disease_name=simulated_disease,
            severity_pct=payload.severity_pct,
            pot_size_liters=payload.pot_size_liters,
            soil_type=payload.soil_type
        )
        
        # 3. Securely write the treatment prescription record into the PostgreSQL database 
        # (e.g. INSERT INTO treatment_prescriptions (scan_id, base_chemical, ...) VALUES (...))
        # Representing state update outcome
        
        return {
            "success": True,
            "scan_id": payload.scan_id,
            "base_chemical": calculation_result["base_chemical"],
            "exact_dosage_amount": calculation_result["exact_dosage_amount"],
            "measurement_unit": calculation_result["measurement_unit"],
            "dilution_water_volume_ml": calculation_result["dilution_water_volume_ml"],
            "application_frequency": calculation_result["application_frequency"],
            "soil_adjustment_note": calculation_result["soil_adjustment_note"],
            "is_split_dosage": calculation_result["is_split_dosage"],
            "warning_banner": calculation_result["warning_banner"]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agronomic calculation failed: {str(e)}")

# Global state dictionaries for mock/simulation backing in Python Router
TREATMENT_SCHEDULES_MOCK = {}
TREATMENT_LOGS_MOCK = {}

class ScheduleProgressResponse(BaseModel):
    schedule_id: str
    total_expected_doses: int
    doses_completed: int
    compliance_percentage: float
    status: str # HEALTHY_ADHERENCE, MISSED_DOSES, ABANDONED

@router.get("/api/v1/treatments/schedules/{schedule_id}/progress", response_model=ScheduleProgressResponse)
async def get_schedule_progress(schedule_id: str):
    """
    FastAPI endpoint that calculates active compliance metrics.
    Queries the treatment logs, compares expected applications against actual completed entries,
    and returns metrics including status based on consecutive misses.
    """
    # Safeguard: if schedule doesn't exist in our memory pool yet, we auto-create a realistic default
    if schedule_id not in TREATMENT_SCHEDULES_MOCK:
        # Standard 7 days calculation course with 2 applications per day (total 14 expected)
        TREATMENT_SCHEDULES_MOCK[schedule_id] = {
            "id": schedule_id,
            "scan_id": "simulated-scan-id",
            "frequency_per_day": 2,
            "total_days": 7,
            "status": "active",
            "is_sun_sensitive": True
        }
        # Backfill logs for the last 5 days (some completed, some missed to represent realistic farmer data)
        # 14 expected doses, let's say 4 of them are checked as completed.
        logs = []
        now = datetime.now()
        for i in range(14):
            scheduled_time = now - timedelta(days=i*0.5)
            # simulate 4 completed doses
            actual_applied = scheduled_time + timedelta(minutes=10) if i in [0, 1, 4, 5] else None
            logs.append({
                "id": f"log-{schedule_id}-{i}",
                "schedule_id": schedule_id,
                "scheduled_time": scheduled_time,
                "actual_applied_time": actual_applied,
                "notes": f"Simulated agricultural log entry #{i}"
            })
        TREATMENT_LOGS_MOCK[schedule_id] = logs

    sched = TREATMENT_SCHEDULES_MOCK[schedule_id]
    logs = TREATMENT_LOGS_MOCK.get(schedule_id, [])

    # Metrics calculation
    total_expected = sched["frequency_per_day"] * sched["total_days"]
    completed_doses = sum(1 for log in logs if log["actual_applied_time"] is not None)
    
    compliance_percentage = 0.0
    if total_expected > 0:
        compliance_percentage = round((completed_doses / total_expected) * 100.0, 1)

    # Check for consecutive missed applications
    # A log is "missed" if scheduled_time is in the past and actual_applied_time is None
    # We sort logs by scheduled time ascending to trace timeline
    past_logs = sorted(
        [log for log in logs if log["scheduled_time"] < datetime.now()],
        key=lambda x: x["scheduled_time"],
        reverse=True # Most recent past dose first
    )

    consecutive_misses = 0
    for log in past_logs:
        if log["actual_applied_time"] is None:
            consecutive_misses += 1
        else:
            break # reset upon finding a successful compliance logging event

    # Determine status based on compliance guidelines
    if sched.get("status") == "abandoned":
        status_str = "ABANDONED"
    elif consecutive_misses >= 3:
        status_str = "MISSED_DOSES" # Adherence is At Risk
    else:
        status_str = "HEALTHY_ADHERENCE"

    return {
        "schedule_id": schedule_id,
        "total_expected_doses": total_expected,
        "doses_completed": completed_doses,
        "compliance_percentage": compliance_percentage,
        "status": status_str
    }

class RescheduleEngine:
    @staticmethod
    def modify_future_slots(schedule_id: str, target_slot_index: int, new_time_string: str, is_sun_sensitive: bool) -> int:
        """
        Parses time string, validates diurnal environmental limits, and transactionally updates future unapplied logs.
        """
        try:
            parts = new_time_string.split(":")
            if len(parts) != 2:
                raise ValueError("Format must be HH:MM")
            hour = int(parts[0])
            minute = int(parts[1])
            if not (0 <= hour < 24) or not (0 <= minute < 60):
                raise ValueError("Hours must be 0-23 and minutes 0-59")
        except Exception:
            raise ValueError(f"Invalid time format: {new_time_string}. Expected 'HH:MM'.")

        # Validate environmental constraints for sun-sensitive chemicals
        # Peak sunlight is from 9:00 AM up to (but not including) 5:00 PM (17:00)
        if is_sun_sensitive and (9 <= hour < 17):
            raise ValueError(
                f"Diurnal Environmental Safeguard Breach: Cannot reschedule sun-sensitive treatment "
                f"to {new_time_string} during peak UV hours (09:00 to 17:00). Best safe times are early morning "
                f"or after sunset."
            )

        # Update mock datastore equivalent to SQL cascade update
        logs = TREATMENT_LOGS_MOCK.get(schedule_id, [])
        updated_count = 0
        now = datetime.now()

        for log in logs:
            scheduled_time = log["scheduled_time"]
            if isinstance(scheduled_time, str):
                try:
                    scheduled_time = datetime.fromisoformat(scheduled_time.replace("Z", "+00:00"))
                except Exception:
                    pass

            is_future = scheduled_time > now
            is_unapplied = log.get("actual_applied_time") is None
            
            log_id_str = str(log["id"])
            matches_slot = log_id_str.endswith(f"-dose{target_slot_index}") or log_id_str.endswith(f"-{target_slot_index}")

            if is_future and is_unapplied and matches_slot:
                try:
                    new_dt = scheduled_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
                    log["scheduled_time"] = new_dt
                    updated_count += 1
                except Exception as e:
                    print(f"Failed setting time parameter in python engine: {e}", file=sys.stderr)

        return updated_count

class RescheduleRequest(BaseModel):
    target_slot_index: int = Field(..., description="The dose index of the schedule day (0=Morning, 1=Evening)")
    new_time_string: str = Field(..., description="The corrected time in 'HH:MM' 24-hour presentation")

class RescheduleResponse(BaseModel):
    success: bool
    message: str
    updated_slots_count: int

@router.put("/api/v1/treatments/schedules/{schedule_id}/reschedule", response_model=RescheduleResponse)
async def reschedule_treatment_slots(schedule_id: str, payload: RescheduleRequest):
    """
    PUT Router to mutate upcoming unapplied prescription doses.
    Validates safety parameters and runs localized error handlers.
    """
    if schedule_id not in TREATMENT_SCHEDULES_MOCK:
        raise HTTPException(
            status_code=404, 
            detail=f"Treatment routine {schedule_id} not found."
        )

    sched = TREATMENT_SCHEDULES_MOCK[schedule_id]
    is_sun_sensitive = sched.get("is_sun_sensitive", False)

    try:
        updated_count = RescheduleEngine.modify_future_slots(
            schedule_id=schedule_id,
            target_slot_index=payload.target_slot_index,
            new_time_string=payload.new_time_string,
            is_sun_sensitive=is_sun_sensitive
        )
        return {
            "success": True,
            "message": "Future unapplied treatment schedules modified successfully with cascade sync.",
            "updated_slots_count": updated_count
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database rescheduled runtime fault: {str(e)}")

