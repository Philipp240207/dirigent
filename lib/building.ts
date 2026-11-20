import building from "../data/building.json";

type AffectedUnit = {
  unit_id: string;
  risk: "confirmed" | "source" | "high" | "check";
};

type LeakAssessment = {
  affected: AffectedUnit[];
  riser: { id: string; main_valve: string; units: string[] } | null;
  likelySource: { unit_id: string; reason: string } | null;
};

export function findAffectedUnits(
  unitId: string,
  incidentType: string,
  { ceilingLeak = incidentType === "water_leak" }: { ceilingLeak?: boolean } = {},
): LeakAssessment {
  if (incidentType !== "water_leak" && incidentType !== "drain_blocked") return { affected: [], riser: null, likelySource: null };

  const reportedUnit = building.units.find((unit) => unit.id === unitId);
  const riser = building.infrastructure.risers.find((pipe) => pipe.connects.includes(unitId));
  if (!reportedUnit || !riser) return { affected: [], riser: null, likelySource: null };

  const affected: AffectedUnit[] = [{ unit_id: unitId, risk: "confirmed" }];
  const lowerUnits = building.units
    .filter((unit) => unit.floor < reportedUnit.floor && riser.connects.includes(unit.id))
    .sort((first, second) => second.floor - first.floor);

  for (const unit of lowerUnits) {
    affected.push({
      unit_id: unit.id,
      risk: reportedUnit.floor - unit.floor === 1 ? "high" : "check",
    });
  }

  if (riser.connects.includes("cellar")) {
    affected.push({ unit_id: "cellar", risk: "check" });
  }

  const source = ceilingLeak && incidentType === "water_leak"
    ? building.units.find((unit) =>
        unit.floor === reportedUnit.floor + 1 && riser.connects.includes(unit.id),
      )
    : undefined;

  if (source) affected.push({ unit_id: source.id, risk: "source" });

  return {
    affected,
    riser: {
      id: riser.id,
      main_valve: riser.main_valve,
      units: riser.connects.filter((id) => id !== "cellar"),
    },
    likelySource: source
      ? { unit_id: source.id, reason: "Ceiling leak, same riser, directly above." }
      : null,
  };
}
