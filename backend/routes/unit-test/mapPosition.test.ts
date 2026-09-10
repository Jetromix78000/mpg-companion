import { mapPosition } from "../apiFootball";

describe("mapPosition", () => {
  it("mappe un gardien sur 'G'", () => {
    expect(mapPosition("Goalkeeper")).toEqual({ short: "G", long: "Goalkeeper" });
  });

  it("mappe un défenseur sur 'D'", () => {
    expect(mapPosition("Defender")).toEqual({ short: "D", long: "Defender" });
  });

  it("mappe un milieu sur 'M'", () => {
    expect(mapPosition("Midfielder")).toEqual({ short: "M", long: "Midfielder" });
  });

  it("mappe un attaquant sur 'A'", () => {
    expect(mapPosition("Attacker")).toEqual({ short: "A", long: "Attacker" });
  });

  it("retombe sur 'A' / 'Inconnu' si la position est null", () => {
    expect(mapPosition(null)).toEqual({ short: "A", long: "Inconnu" });
  });
});