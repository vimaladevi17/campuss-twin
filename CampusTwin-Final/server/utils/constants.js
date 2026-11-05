// Shared enums. Keep the frontend dropdowns in sync with these values.
const VERIFICATION = [
  "verified_college",      // confirmed from a college source
  "imported_excel",        // imported from the KARE facilities workbook
  "extracted_osm",         // extracted from OpenStreetMap
  "digitized_master_plan", // traced from the master plan image (approximate)
  "manual",                // entered by an administrator
  "estimated_unverified",  // estimated / not verified
];

const FACILITY_CATEGORIES = [
  "food", "academic", "amenity", "hostel", "transport_parking", "sports",
  "library", "healthcare", "shop", "toilet", "accessibility", "other",
];

const ROOM_TYPES = ["classroom", "laboratory", "seminar_hall", "office", "other"];

const EQUIPMENT_TYPES = [
  "desktop_computer", "workstation", "networking", "electronics",
  "scientific_instrument", "projector", "specialized", "other",
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CLASS_TYPES = ["lecture", "lab", "tutorial", "seminar", "exam", "other"];

// Default scoring weights (Score = 0.40A + 0.30E + 0.20C + 0.10D)
const DEFAULT_WEIGHTS = { equipment: 0.4, capacity: 0.3, availability: 0.2, distance: 0.1 };

module.exports = {
  VERIFICATION, FACILITY_CATEGORIES, ROOM_TYPES, EQUIPMENT_TYPES,
  DAYS, CLASS_TYPES, DEFAULT_WEIGHTS,
};
