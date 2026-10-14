// Ready-made catalogs for the "Suggestions" picker: the classes, subjects,
// sections, departments, rooms, sessions and calendar dates most Pakistani
// schools, colleges and universities start with. Each item is
// { label, sub, data } — `data` is what gets created when it's picked.
// Catalogs keyed by school / college / university follow the institute type
// from Settings; the picker lets the admin switch level.

const P = (name, code, extra = {}) => ({ label: name, sub: code, data: { name, code, ...extra } });
const S = (name, code, creditHours) => ({ label: name, sub: code, data: { name, code, ...(creditHours ? { creditHours } : {}) } });

export const CLASS_SUGGESTIONS = {
  school: [
    { label: "Early years", items: [P("Playgroup", "PG"), P("Nursery", "NUR"), P("Prep / KG", "KG")] },
    { label: "Primary (Class 1–5)", items: [1, 2, 3, 4, 5].map(n => P(`Class ${n}`, `C${n}`)) },
    { label: "Middle (Class 6–8)", items: [6, 7, 8].map(n => P(`Class ${n}`, `C${n}`)) },
    { label: "Secondary / Matric (Class 9–10)", items: [P("Class 9", "C9"), P("Class 10", "C10")] },
    { label: "Cambridge (O / A Level)", items: [P("O Level I", "O1"), P("O Level II", "O2"), P("O Level III", "O3"), P("AS Level", "AS"), P("A2 Level", "A2")] },
  ],
  college: [
    { label: "Intermediate — Science", items: [
      P("FSc Pre-Medical Part I", "FSC-PM-1"), P("FSc Pre-Medical Part II", "FSC-PM-2"),
      P("FSc Pre-Engineering Part I", "FSC-PE-1"), P("FSc Pre-Engineering Part II", "FSC-PE-2"),
      P("ICS Part I", "ICS-1"), P("ICS Part II", "ICS-2"),
    ] },
    { label: "Intermediate — Arts & Commerce", items: [P("FA Part I", "FA-1"), P("FA Part II", "FA-2"), P("I.Com Part I", "ICOM-1"), P("I.Com Part II", "ICOM-2")] },
    { label: "Associate degrees (2 years)", items: [
      P("ADP Computer Science", "ADP-CS", { requiredCredits: 68 }), P("ADP Business Administration", "ADP-BA", { requiredCredits: 68 }),
      P("ADP Commerce", "ADP-COM", { requiredCredits: 68 }), P("ADP Arts", "ADP-ARTS", { requiredCredits: 68 }),
    ] },
    { label: "BS programs (4 years)", items: [
      P("BS English", "BS-ENG", { requiredCredits: 130 }), P("BS Mathematics", "BS-MATH", { requiredCredits: 130 }),
      P("BS Computer Science", "BS-CS", { requiredCredits: 133 }), P("BS Economics", "BS-ECO", { requiredCredits: 130 }),
    ] },
  ],
  university: [
    { label: "Computing", items: [
      P("BS Computer Science", "BSCS", { requiredCredits: 133 }), P("BS Software Engineering", "BSSE", { requiredCredits: 133 }),
      P("BS Information Technology", "BSIT", { requiredCredits: 133 }), P("BS Artificial Intelligence", "BSAI", { requiredCredits: 133 }),
      P("BS Data Science", "BSDS", { requiredCredits: 133 }), P("BS Cyber Security", "BSCYS", { requiredCredits: 133 }),
    ] },
    { label: "Engineering", items: [
      P("BS Electrical Engineering", "BSEE", { requiredCredits: 136 }), P("BS Mechanical Engineering", "BSME", { requiredCredits: 136 }),
      P("BS Civil Engineering", "BSCE", { requiredCredits: 136 }),
    ] },
    { label: "Business & Economics", items: [
      P("BBA", "BBA", { requiredCredits: 130 }), P("BS Accounting & Finance", "BSAF", { requiredCredits: 130 }),
      P("BS Economics", "BSECO", { requiredCredits: 130 }), P("MBA", "MBA", { requiredCredits: 36 }),
    ] },
    { label: "Sciences", items: [
      P("BS Mathematics", "BSMATH", { requiredCredits: 130 }), P("BS Physics", "BSPHY", { requiredCredits: 130 }),
      P("BS Chemistry", "BSCHEM", { requiredCredits: 130 }), P("BS Biotechnology", "BSBT", { requiredCredits: 130 }),
      P("BS Psychology", "BSPSY", { requiredCredits: 130 }),
    ] },
    { label: "Arts, Law & Media", items: [
      P("BS English", "BSENG", { requiredCredits: 130 }), P("BS Mass Communication", "BSMC", { requiredCredits: 130 }),
      P("BS International Relations", "BSIR", { requiredCredits: 130 }), P("LLB (5 years)", "LLB", { requiredCredits: 166 }),
    ] },
    { label: "Health sciences", items: [
      P("Pharm-D", "PHARMD", { requiredCredits: 190 }), P("Doctor of Physical Therapy", "DPT", { requiredCredits: 180 }),
      P("BS Nursing", "BSN", { requiredCredits: 136 }), P("BS Medical Lab Technology", "BSMLT", { requiredCredits: 136 }),
    ] },
    { label: "Postgraduate", items: [
      P("MS Computer Science", "MSCS", { requiredCredits: 30 }), P("MS Data Science", "MSDS", { requiredCredits: 30 }),
      P("MPhil English", "MPHIL-ENG", { requiredCredits: 30 }), P("MPhil Mathematics", "MPHIL-MATH", { requiredCredits: 30 }),
      P("PhD Computer Science", "PHD-CS", { requiredCredits: 48 }),
    ] },
  ],
};

export const SUBJECT_SUGGESTIONS = {
  school: [
    { label: "Core — every class", items: [S("English", "ENG"), S("Urdu", "URD"), S("Mathematics", "MATH"), S("Islamiyat", "ISL"), S("Nazra / Tarjuma-tul-Quran", "QURAN")] },
    { label: "Early years", items: [S("Phonics", "PHON"), S("Number Work", "NUMW"), S("Rhymes & Stories", "RHYM"), S("Drawing & Colouring", "DRAW")] },
    { label: "Primary", items: [S("General Science", "GSCI"), S("Social Studies", "SST"), S("General Knowledge", "GK"), S("Computer", "COMP"), S("Art & Craft", "ART")] },
    { label: "Middle", items: [S("Science", "SCI"), S("History", "HIST"), S("Geography", "GEOG"), S("Computer Science", "CS"), S("Arabic", "ARB")] },
    { label: "Matric — Science group", items: [S("Physics", "PHY"), S("Chemistry", "CHEM"), S("Biology", "BIO"), S("Pakistan Studies", "PST")] },
    { label: "Matric — Arts group", items: [S("General Mathematics", "GMATH"), S("Education", "EDU"), S("Civics", "CIV"), S("Economics", "ECO"), S("Home Economics", "HECO")] },
    { label: "Co-curricular", items: [S("Physical Education", "PE"), S("Moral Education / Ethics", "ETH"), S("Library Period", "LIBP")] },
  ],
  college: [
    { label: "Compulsory", items: [S("English", "ENG"), S("Urdu", "URD"), S("Islamiyat", "ISL"), S("Pakistan Studies", "PST"), S("Tarjuma-tul-Quran", "QURAN")] },
    { label: "Science", items: [S("Physics", "PHY"), S("Chemistry", "CHEM"), S("Biology", "BIO"), S("Mathematics", "MATH"), S("Computer Science", "CS"), S("Statistics", "STAT")] },
    { label: "Commerce", items: [S("Principles of Accounting", "ACC"), S("Principles of Economics", "ECO"), S("Principles of Commerce", "COM"), S("Business Mathematics", "BMATH"), S("Banking", "BANK")] },
    { label: "Arts & Humanities", items: [S("Civics", "CIV"), S("Psychology", "PSY"), S("Sociology", "SOC"), S("Education", "EDU"), S("Islamic Studies (Elective)", "ISLE"), S("Fine Arts", "FART")] },
  ],
  university: [
    { label: "General education", items: [
      S("Functional English", "HUM-101", 3), S("Communication & Presentation Skills", "HUM-102", 3), S("Islamic Studies", "HUM-103", 2),
      S("Pakistan Studies", "HUM-104", 2), S("Calculus & Analytical Geometry", "MTH-101", 3), S("Linear Algebra", "MTH-201", 3),
      S("Probability & Statistics", "MTH-202", 3), S("Discrete Structures", "CS-102", 3),
    ] },
    { label: "Computing core", items: [
      S("Programming Fundamentals", "CS-101", 4), S("Object Oriented Programming", "CS-103", 4), S("Data Structures & Algorithms", "CS-201", 4),
      S("Database Systems", "CS-202", 4), S("Computer Organization & Assembly Language", "CS-203", 3), S("Operating Systems", "CS-301", 4),
      S("Computer Networks", "CS-302", 4), S("Theory of Automata", "CS-303", 3), S("Design & Analysis of Algorithms", "CS-304", 3),
      S("Software Engineering", "SE-201", 3), S("Information Security", "CS-401", 3), S("Final Year Project I", "CS-491", 3), S("Final Year Project II", "CS-492", 3),
    ] },
    { label: "AI & Data Science", items: [
      S("Artificial Intelligence", "AI-301", 3), S("Machine Learning", "AI-302", 3), S("Deep Learning", "AI-401", 3),
      S("Natural Language Processing", "AI-402", 3), S("Computer Vision", "AI-403", 3), S("Data Mining", "DS-301", 3), S("Big Data Analytics", "DS-401", 3),
    ] },
    { label: "Business", items: [
      S("Principles of Management", "MGT-101", 3), S("Financial Accounting", "ACC-101", 3), S("Microeconomics", "ECO-101", 3),
      S("Principles of Marketing", "MKT-101", 3), S("Business Communication", "MGT-102", 3), S("Entrepreneurship", "MGT-301", 3),
    ] },
  ],
};

export const SECTION_SUGGESTIONS = [
  { label: "Letters", items: ["A", "B", "C", "D", "E", "F"].map(n => ({ label: n, data: { name: n } })) },
  { label: "Shifts & groups", items: ["Morning", "Evening", "Weekend", "Boys", "Girls"].map(n => ({ label: n, data: { name: n } })) },
  { label: "Colours", items: ["Blue", "Green", "Red", "Yellow"].map(n => ({ label: n, data: { name: n } })) },
];

const D = (name, code, kind = "academic") => ({ label: name, sub: code, data: { name, code, kind, status: "active" } });
const ADMIN_DEPTS = [
  D("Administration", "ADMIN", "administrative"), D("Accounts & Finance", "ACCTS", "administrative"), D("Admissions", "ADMS", "administrative"),
  D("Examinations", "EXAMS", "administrative"), D("Human Resources", "HR", "administrative"), D("IT Services", "ITS", "support"),
  D("Library", "LIB", "support"), D("Transport", "TRANS", "support"), D("Security", "SEC", "support"), D("Maintenance", "MAINT", "support"),
];
export const DEPARTMENT_SUGGESTIONS = {
  school: [
    { label: "Academic sections", items: [D("Early Years", "EY"), D("Primary Section", "PRI"), D("Middle Section", "MID"), D("Senior Section", "SEN"), D("Cambridge Wing", "CAM")] },
    { label: "Subject departments", items: [D("Science", "SCI"), D("Languages", "LANG"), D("Mathematics", "MATH"), D("Islamic Studies", "ISL"), D("Computer", "COMP"), D("Sports", "SPORTS")] },
    { label: "Offices & support", items: ADMIN_DEPTS },
  ],
  college: [
    { label: "Academic departments", items: [D("Science", "SCI"), D("Computer Science", "CS"), D("Commerce", "COM"), D("Arts & Humanities", "ARTS"), D("English", "ENG"), D("Urdu", "URD"), D("Islamic Studies", "ISL")] },
    { label: "Offices & support", items: ADMIN_DEPTS },
  ],
  university: [
    { label: "Faculties & departments", items: [
      D("Computer Science", "CS"), D("Software Engineering", "SE"), D("Artificial Intelligence", "AI"), D("Electrical Engineering", "EE"),
      D("Business Administration", "BA"), D("Mathematics", "MATH"), D("Physics", "PHY"), D("Chemistry", "CHEM"), D("English", "ENG"),
      D("Psychology", "PSY"), D("Islamic Studies", "ISL"), D("Law", "LAW"),
    ] },
    { label: "Offices & support", items: [...ADMIN_DEPTS, D("Registrar Office", "REG", "administrative"), D("ORIC (Research)", "ORIC", "administrative"), D("Quality Enhancement Cell", "QEC", "administrative")] },
  ],
};

const R = (name, type, capacity) => ({ label: name, sub: type === "classroom" ? `${capacity} seats` : type, data: { name, type, capacity } });
export const ROOM_SUGGESTIONS = [
  { label: "Classrooms", items: Array.from({ length: 12 }, (_, i) => R(`Room ${i + 1}`, "classroom", 40)) },
  { label: "Labs", items: [R("Computer Lab 1", "lab", 30), R("Computer Lab 2", "lab", 30), R("Physics Lab", "lab", 30), R("Chemistry Lab", "lab", 30), R("Biology Lab", "lab", 30), R("Science Lab", "lab", 30), R("Language Lab", "lab", 30)] },
  { label: "Halls & offices", items: [R("Library", "other", 60), R("Auditorium", "auditorium", 300), R("Examination Hall", "auditorium", 150), R("Staff Room", "office", 25), R("Principal's Office", "office", 6), R("Admin Office", "office", 10), R("Accounts Office", "office", 6), R("Sick Bay", "other", 4), R("Prayer Room", "other", 40)] },
];

// Sessions and calendar dates are worked out from today, so the list is
// always the current and next year.
const iso = d => d.toISOString().slice(0, 10);
const ymd = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
export function sessionSuggestions(today = new Date()) {
  const y = today.getUTCFullYear();
  const start = today.getUTCMonth() + 1 >= 4 ? y : y - 1; // Pakistani schools start in April
  const yr = s => `${s}-${String(s + 1).slice(2)}`;
  const fall = today.getUTCMonth() + 1 >= 8 ? y : y - 1;
  return {
    school: [{ label: "Academic years (April – March)", items: [start, start + 1].map(s => ({ label: yr(s), sub: `Apr ${s} – Mar ${s + 1}`, data: { name: yr(s), startDate: iso(ymd(s, 4, 1)), endDate: iso(ymd(s + 1, 3, 31)) } })) }],
    college: [{ label: "Academic years (August – July)", items: [fall, fall + 1].map(s => ({ label: yr(s), sub: `Aug ${s} – Jul ${s + 1}`, data: { name: yr(s), startDate: iso(ymd(s, 8, 1)), endDate: iso(ymd(s + 1, 7, 31)) } })) }],
    university: [{ label: "Semesters", items: [
      { label: `Fall ${fall}`, sub: `Sep ${fall} – Jan ${fall + 1}`, data: { name: `Fall ${fall}`, startDate: iso(ymd(fall, 9, 1)), endDate: iso(ymd(fall + 1, 1, 31)) } },
      { label: `Spring ${fall + 1}`, sub: `Feb – Jun ${fall + 1}`, data: { name: `Spring ${fall + 1}`, startDate: iso(ymd(fall + 1, 2, 1)), endDate: iso(ymd(fall + 1, 6, 30)) } },
      { label: `Summer ${fall + 1}`, sub: `Jul – Aug ${fall + 1}`, data: { name: `Summer ${fall + 1}`, startDate: iso(ymd(fall + 1, 7, 1)), endDate: iso(ymd(fall + 1, 8, 31)) } },
      { label: `Fall ${fall + 1}`, sub: `Sep ${fall + 1} – Jan ${fall + 2}`, data: { name: `Fall ${fall + 1}`, startDate: iso(ymd(fall + 1, 9, 1)), endDate: iso(ymd(fall + 2, 1, 31)) } },
    ] }],
  };
}

// Islamic holidays follow the moon; these are the expected dates and are
// marked tentative so the office can shift them a day once announced.
const ISLAMIC = [
  ["Ashura (9–10 Muharram)", "2026-06-24", "2026-06-25"], ["Eid Milad-un-Nabi (12 Rabi-ul-Awwal)", "2026-08-25"],
  ["Eid-ul-Fitr", "2027-03-10", "2027-03-12"], ["Eid-ul-Adha", "2027-05-17", "2027-05-19"],
  ["Ashura (9–10 Muharram)", "2027-06-14", "2027-06-15"], ["Eid Milad-un-Nabi (12 Rabi-ul-Awwal)", "2027-08-15"],
  ["Eid-ul-Fitr", "2028-02-27", "2028-02-29"], ["Eid-ul-Adha", "2028-05-05", "2028-05-07"],
];
const NATIONAL = [["Kashmir Solidarity Day", 2, 5], ["Pakistan Day", 3, 23], ["Labour Day", 5, 1], ["Youm-e-Takbeer", 5, 28], ["Independence Day", 8, 14], ["Iqbal Day", 11, 9], ["Quaid-e-Azam Day", 12, 25]];
const EVENTS = {
  school: [["Annual Examinations", 3, 1, 3, 15, "exam"], ["Result Day", 3, 31, null, null, "event"], ["New Session Begins", 4, 1, null, null, "term"], ["Summer Vacation", 6, 1, 7, 31, "holiday"], ["Mid-Term Examinations", 10, 12, 10, 23, "exam"], ["Annual Sports Day", 11, 20, null, null, "event"], ["Winter Vacation", 12, 22, 12, 31, "holiday"]],
  college: [["Board Practical Exams", 4, 1, 4, 20, "exam"], ["Board Annual Exams", 4, 25, 5, 31, "exam"], ["Summer Vacation", 6, 1, 7, 31, "holiday"], ["Classes Begin", 8, 15, null, null, "term"], ["Send-up Examinations", 2, 1, 2, 20, "exam"], ["Winter Vacation", 12, 22, 12, 31, "holiday"]],
  university: [["Fall Semester Begins", 9, 1, null, null, "term"], ["Fall Midterms", 10, 26, 11, 1, "exam"], ["Fall Finals", 1, 11, 1, 22, "exam"], ["Spring Semester Begins", 2, 1, null, null, "term"], ["Spring Midterms", 3, 29, 4, 4, "exam"], ["Spring Finals", 6, 7, 6, 18, "exam"], ["Convocation", 11, 28, null, null, "event"], ["Winter Break", 12, 24, 12, 31, "holiday"]],
};
export function calendarSuggestions(level, today = new Date()) {
  const t = iso(today);
  const next = (m, d) => { const a = ymd(today.getUTCFullYear(), m, d); return iso(a) >= t ? a : ymd(today.getUTCFullYear() + 1, m, d); };
  const ev = (title, start, end, type, sub) => ({ label: title, sub: sub || (end ? `${start} → ${end}` : start), data: { title, type, audience: "all", start, ...(end ? { end } : {}) } });
  const national = NATIONAL.map(([n, m, d]) => ev(n, iso(next(m, d)), null, "holiday")).sort((a, b) => a.data.start.localeCompare(b.data.start));
  const islamic = ISLAMIC.filter(([, s, e]) => (e || s) >= t).slice(0, 5).map(([n, s, e]) => ev(n, s, e, "holiday", `${s}${e ? ` → ${e}` : ""} · tentative`));
  const events = (EVENTS[level] || EVENTS.school).map(([n, m, d, m2, d2, type]) => {
    const s = next(m, d);
    let e = null;
    if (m2) { e = ymd(s.getUTCFullYear(), m2, d2); if (e < s) e = ymd(s.getUTCFullYear() + 1, m2, d2); }
    return ev(n, iso(s), e && iso(e), type);
  }).sort((a, b) => a.data.start.localeCompare(b.data.start));
  return [
    { label: "National holidays (Pakistan)", items: national },
    { label: "Islamic holidays — moon-sighting dates, adjust if needed", items: islamic },
    { label: "Academic year", items: events },
  ];
}
