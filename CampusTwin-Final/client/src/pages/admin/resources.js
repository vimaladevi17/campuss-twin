// Settings for each admin management page.
// type: text | number | date | time | select | textarea | password
export const resources = {
  events: {
    title: "Events",
    singular: "event",
    endpoint: "/events",
    columns: [
      { key: "title", label: "Title" },
      { key: "category", label: "Category" },
      { key: "date", label: "Date" },
      { key: "time", label: "Time" },
      { key: "location", label: "Location" },
    ],
    fields: [
      { name: "title", label: "Event title", type: "text", required: true },
      { name: "category", label: "Category", type: "text", required: true, suggestions: ["Workshop", "Technical", "Cultural", "Sports", "Seminar", "Placement"] },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "time", label: "Time", type: "time", required: true },
      { name: "location", label: "Location", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },

  faculty: {
    title: "Faculty",
    singular: "faculty member",
    endpoint: "/faculty",
    columns: [
      { key: "name", label: "Name" },
      { key: "department", label: "Department" },
      { key: "designation", label: "Designation" },
      { key: "email", label: "Email" },
      { key: "cabin", label: "Cabin" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "department", label: "Department", type: "text", required: true },
      { name: "designation", label: "Designation", type: "text", required: true },
      { name: "email", label: "Email", type: "text", required: true },
      { name: "phone", label: "Phone", type: "text" },
      { name: "cabin", label: "Cabin", type: "text" },
      { name: "specialization", label: "Specialization", type: "text" },
      { name: "image", label: "Image URL", type: "text" },
    ],
  },

  labs: {
    title: "Labs (legacy)",
    intro: "Original lab list kept for reference. Use Laboratories for rooms that take part in scheduling and replacement.",
    singular: "lab",
    endpoint: "/labs",
    columns: [
      { key: "name", label: "Name" },
      { key: "location", label: "Location" },
      { key: "department", label: "Department" },
      { key: "capacity", label: "Capacity" },
      { key: "status", label: "Status", badge: true },
    ],
    fields: [
      { name: "name", label: "Lab name", type: "text", required: true },
      { name: "department", label: "Department", type: "text" },
      { name: "location", label: "Location", type: "text", required: true },
      { name: "capacity", label: "Capacity", type: "number", required: true },
      { name: "status", label: "Status", type: "select", options: ["Available", "Occupied", "Maintenance"], defaultValue: "Available" },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },

  notices: {
    title: "Notices",
    singular: "notice",
    endpoint: "/notices",
    columns: [
      { key: "title", label: "Title" },
      { key: "category", label: "Category" },
      { key: "priority", label: "Priority" },
      { key: "date", label: "Date" },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "category", label: "Category", type: "select", options: ["General", "Academic", "Exam", "Event", "Placement", "Urgent"], defaultValue: "General" },
      { name: "priority", label: "Priority", type: "select", options: ["Low", "Normal", "High"], defaultValue: "Normal" },
      { name: "date", label: "Date", type: "date" },
      { name: "createdBy", label: "Posted by", type: "text", defaultValue: "Admin" },
      { name: "description", label: "Description", type: "textarea", required: true },
    ],
  },

  users: {
    title: "User Accounts",
    singular: "user account",
    endpoint: "/users",
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "email", label: "Email", type: "text", required: true },
      { name: "role", label: "Role", type: "select", options: ["student", "faculty", "admin"], defaultValue: "student" },
      { name: "password", label: "Password (at least 6 characters)", type: "password", requiredOnCreate: true, hint: "Leave blank when editing to keep the current password" },
    ],
  },
};

// ---------- CampusTwin digital-twin resources ----------
const FACILITY_CATEGORIES = ["academic", "food", "amenity", "hostel", "transport_parking", "sports", "library", "healthcare", "shop", "toilet", "accessibility", "other"];
const VERIFICATION = ["manual", "verified_college", "imported_excel", "extracted_osm", "digitized_master_plan", "estimated_unverified"];
const BUILDING_OPT = { endpoint: "/buildings", label: (b) => `${b.code} - ${b.name}` };
const FLOOR_OPT = { endpoint: "/floors", param: "building", dependsOn: "building", label: (f) => f.name || `Floor ${f.number}` };
const roomColumns = [
  { key: "roomNumber", label: "Room" }, { key: "name", label: "Name" },
  { key: "building.name", label: "Building" }, { key: "floor", label: "Floor", render: (r) => (r.floor ? r.floor.name || `Floor ${r.floor.number}` : "") },
  { key: "type", label: "Type" }, { key: "capacity", label: "Capacity" },
  { key: "operationalStatus", label: "State", badge: true }, { key: "maintenanceStatus", label: "Maintenance" },
];
const roomCommon = [
  { name: "roomNumber", label: "Room number", type: "text", required: true },
  { name: "name", label: "Room name", type: "text" },
  { name: "building", label: "Building", type: "select", required: true, optionsFrom: BUILDING_OPT },
  { name: "floor", label: "Floor", type: "select", optionsFrom: FLOOR_OPT, hint: "Choose the building first" },
  { name: "capacity", label: "Seating / capacity", type: "number", required: true },
];
const roomTail = [
  { name: "operationalStatus", label: "Room state", type: "select", options: ["active", "inactive"], defaultValue: "active" },
  { name: "maintenanceStatus", label: "Maintenance flag", type: "select", options: [{ value: "none", label: "none" }, { value: "under_maintenance", label: "under maintenance" }], defaultValue: "none",
    hint: "Availability itself is calculated from timetable, reservations and maintenance records, not typed in." },
  { name: "notes", label: "Notes", type: "textarea" },
];

resources.buildings = {
  title: "Buildings", singular: "building", endpoint: "/buildings",
  intro: "Building footprints come from OpenStreetMap / the master plan import. Coordinates entered here set the marker position only.",
  columns: [{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "category", label: "Category" }, { key: "floorsCount", label: "Floors" },
    { key: "status", label: "Status" }, { key: "verification", label: "Verification" }],
  fields: [
    { name: "code", label: "Building code", type: "text", required: true }, { name: "name", label: "Name", type: "text", required: true },
    { name: "category", label: "Category", type: "select", options: FACILITY_CATEGORIES, defaultValue: "academic" },
    { name: "location", label: "Marker position (lat, lng)", type: "geopoint" },
    { name: "floorsCount", label: "Number of floors", type: "number", min: 0, defaultValue: 1 },
    { name: "heightM", label: "Height in metres (blank = estimate from floors)", type: "number", min: 0, step: "0.1" },
    { name: "status", label: "Status", type: "select", options: ["open", "closed", "under_construction"], defaultValue: "open" },
    { name: "facilities", label: "Facilities", type: "csv" },
    { name: "verification", label: "Data verification", type: "select", options: VERIFICATION, defaultValue: "manual" },
    { name: "source", label: "Data source", type: "text", defaultValue: "manual" },
    { name: "imageUrl", label: "Image URL", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
  ],
};
resources.floors = {
  title: "Floors", singular: "floor", endpoint: "/floors", tabs: [["/admin/rooms", "Rooms"], ["/admin/floors", "Floors"]],
  columns: [{ key: "building.name", label: "Building" }, { key: "number", label: "Floor no." }, { key: "name", label: "Name" }],
  fields: [
    { name: "building", label: "Building", type: "select", required: true, optionsFrom: BUILDING_OPT },
    { name: "number", label: "Floor number (0 = ground)", type: "number", min: -5, required: true },
    { name: "name", label: "Floor name", type: "text" },
  ],
};
resources.rooms = {
  title: "Rooms", singular: "room", endpoint: "/rooms", tabs: [["/admin/rooms", "Rooms"], ["/admin/floors", "Floors"]], equipment: true,
  columns: roomColumns,
  fields: [...roomCommon, { name: "type", label: "Room type", type: "select", options: ["classroom", "laboratory", "seminar_hall", "office", "other"], defaultValue: "classroom" },
    { name: "labCategory", label: "Lab category (laboratories)", type: "text", suggestions: ["computing", "networking", "electronics", "mechanical", "civil", "biotechnology", "chemistry", "physics"] },
    { name: "facilities", label: "Facilities", type: "csv" }, { name: "specialFacilities", label: "Special facilities", type: "csv" }, ...roomTail],
};
resources.classrooms = {
  title: "Classrooms", singular: "classroom", endpoint: "/rooms", query: { type: "classroom" }, fixed: { type: "classroom" }, equipment: true,
  columns: roomColumns.filter((c) => !["type", "maintenanceStatus"].includes(c.key)),
  fields: [...roomCommon, { name: "facilities", label: "Available facilities (projector, smart_board ...)", type: "csv" }, ...roomTail],
};
resources.laboratories = {
  title: "Laboratories", singular: "laboratory", endpoint: "/rooms", query: { type: "laboratory" }, fixed: { type: "laboratory" }, equipment: true,
  intro: "Use the Equipment button on a row to record equipment item by item. Replacement matching uses WORKING quantities.",
  columns: [...roomColumns.filter((c) => c.key !== "type").slice(0, 4), { key: "labCategory", label: "Category" }, ...roomColumns.filter((c) => ["capacity", "operationalStatus", "maintenanceStatus"].includes(c.key))],
  fields: [...roomCommon,
    { name: "labCategory", label: "Lab category", type: "text", suggestions: ["computing", "networking", "electronics", "mechanical", "civil", "biotechnology", "chemistry", "physics"] },
    { name: "specialFacilities", label: "Special facilities (air_conditioned, fume_hood ...)", type: "csv" }, ...roomTail],
};
resources.facilities = {
  title: "Facilities", singular: "facility", endpoint: "/facilities",
  intro: "Imported rows keep their source. Corrected fields are remembered so a re-import will not overwrite them.",
  columns: [{ key: "name", label: "Name" }, { key: "category", label: "Category" }, { key: "layer", label: "Layer" }, { key: "status", label: "Status" }, { key: "verification", label: "Verification" }],
  fields: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "category", label: "Category", type: "select", required: true, options: FACILITY_CATEGORIES, defaultValue: "amenity" },
    { name: "location", label: "Location (lat, lng)", type: "geopoint", required: true },
    { name: "tags", label: "Tags (library, parking ...)", type: "csv" },
    { name: "layer", label: "Map layer", type: "select", options: ["general", "accessibility"], defaultValue: "general" },
    { name: "accessibilityType", label: "Accessibility type", type: "select", options: ["", "accessible_toilet", "accessible_ramp", "day_care", "lactation_room", "transportation"], defaultValue: "" },
    { name: "status", label: "Operational status", type: "select", options: ["operational", "closed", "under_maintenance"], defaultValue: "operational" },
    { name: "verification", label: "Data verification", type: "select", options: VERIFICATION, defaultValue: "manual" },
    { name: "imageUrl", label: "Image URL", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
  ],
};
resources.courses = {
  title: "Courses", singular: "course", endpoint: "/courses",
  columns: [{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "department", label: "Department" }],
  fields: [{ name: "code", label: "Course code", type: "text", required: true }, { name: "name", label: "Course name", type: "text", required: true }, { name: "department", label: "Department", type: "text" }],
};
