let currentGuardianId: number | undefined;
let currentGuardianName: string | undefined;

export function setCurrentGuardian(guardianId: number, guardianName: string) {
  currentGuardianId = guardianId;
  currentGuardianName = guardianName;
}

export function getCurrentGuardianId() {
  return currentGuardianId;
}

export function getCurrentGuardianName() {
  return currentGuardianName;
}

export function clearCurrentGuardianId() {
  currentGuardianId = undefined;
  currentGuardianName = undefined;
}
