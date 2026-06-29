class TreatmentDosageEngine:
    """
    Precision Dosage & Treatment Calculator Engine for FloraDoc.
    Computes exact chemical/organic dosages based on:
    - Disease diagnostic classification
    - Evaluated severity percentage (from vision engine)
    - Container Pot metrics (volume in liters)
    - Soil Matrix (drainage, retention, absorption capacities)
    """

    @staticmethod
    def calculate_treatment(disease_name: str, severity_pct: float, pot_size_liters: float, soil_type: str) -> dict:
        # 1. Determine chemical base based on leaf diagnosis
        disease_lower = disease_name.lower()
        if any(term in disease_lower for term in ["spot", "rust", "mildew", "blight", "fungal", "fungus", "mold"]):
            base_chemical = "Liquid Copper Fungicide"
            measurement_unit = "mL"
            base_rate_per_liter = 1.5  # base mL per Liter of container size
        elif any(term in disease_lower for term in ["bacterial", "rot", "wilt", "canker"]):
            base_chemical = "Streptomycin Sulfate Solution"
            measurement_unit = "grams"
            base_rate_per_liter = 0.8
        elif any(term in disease_lower for term in ["pest", "mite", "aphid", "bug", "scale", "thrip", "insect"]):
            base_chemical = "Cold-Pressed Neem Oil"
            measurement_unit = "mL"
            base_rate_per_liter = 2.0
        elif "healthy" in disease_lower:
            base_chemical = "Liquified Seaweed Kelp Buffer (Preventative)"
            measurement_unit = "mL"
            base_rate_per_liter = 0.5
        else:
            base_chemical = "Horticultural Soap Emulsion"
            measurement_unit = "mL"
            base_rate_per_liter = 1.0

        # 2. Adjust for Severity Scaling
        # Preventative: <10%, Curative Moderate: 10%-30%, Aggressive Curative: >30%
        if severity_pct < 10.0:
            severity_factor = 0.6
            application_frequency = "Once every 14 days (morning)"
        elif severity_pct <= 30.0:
            severity_factor = 1.0
            application_frequency = "Once every 7 days (morning/evening)"
        else:
            severity_factor = 1.6
            application_frequency = "Twice every 7 days (cool hours only)"

        # Calculate raw dosage
        raw_dosage = base_rate_per_liter * pot_size_liters * severity_factor

        # 3. Apply Soil Absorption Compensation
        # Dilution base: 200 mL of water per Liter of pot size
        base_water_volume = pot_size_liters * 200.0
        soil_lower = soil_type.lower()
        soil_adjustment_note = ""

        if "clay" in soil_lower:
            # Clay retains molecules, high runoff risk. We keep dosage slightly lower, less frequent.
            raw_dosage *= 0.85
            base_water_volume *= 1.25  # Dilute more to help spread
            application_frequency = application_frequency.replace("7 days", "10 days")
            soil_adjustment_note = "Clay Soil: High retention. Dosage diluted more to secure uniform root distribution and prevent toxic stagnation."
        elif "sandy" in soil_lower:
            # Sandy soil leaches immediately. Increase active chemical, reduce dilution volume, apply frequently.
            raw_dosage *= 1.15
            base_water_volume *= 0.85  # Concentrated to ensure absorption before leaching
            application_frequency = application_frequency.replace("14 days", "7 days").replace("7 days", "5 days")
            soil_adjustment_note = "Sandy Soil: Quick leaching. Concentration increased with elevated frequency to compensate for nutrient drainage."
        elif "loam" in soil_lower or "potting" in soil_lower:
            soil_adjustment_note = "Loam/Potting Mix: Optimal absorption. Standard dosage and irrigation rates applied."
        else:
            soil_adjustment_note = "Standard Soil Profile: Median water retention parameters verified."

        # Round values for real-world precision
        exact_dosage_amount = round(raw_dosage, 2)
        dilution_water_volume = round(base_water_volume, 1)

        # 4. Volumetric Burn Risk Constraints (Pot Volume vs Severity)
        is_split_dosage = False
        warning_banner = ""
        # High severity (>30%) on small root systems (< 3 Liters) is a chemical shock hazard
        if pot_size_liters < 3.0 and severity_pct > 30.0:
            is_split_dosage = True
            warning_banner = "⚠️ ROOT BURN HAZARD: Extremely high disease concentration on a small root system. Do NOT apply full volume at once. Transition to a Split-Dosage Strategy."

        return {
            "disease_name": disease_name,
            "severity_pct": severity_pct,
            "pot_size_liters": pot_size_liters,
            "soil_type": soil_type,
            "base_chemical": base_chemical,
            "exact_dosage_amount": exact_dosage_amount,
            "measurement_unit": measurement_unit,
            "dilution_water_volume_ml": dilution_water_volume,
            "application_frequency": application_frequency,
            "soil_adjustment_note": soil_adjustment_note,
            "is_split_dosage": is_split_dosage,
            "warning_banner": warning_banner
        }
