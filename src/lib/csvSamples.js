// Example rows for each list page's "Import CSV" template, keyed by the
// page's API base. Keys are the form field names; select values may be the
// option value or its label, and linked records (student, program, route…)
// are referred to by roll number, name or code.
export const CSV_SAMPLES = {
  "/api/hr/departments": [
    { name: "Computer Science", code: "CS", kind: "academic", head: "Dr. Ayesha Malik", status: "active", description: "BS and MS computing programs" },
    { name: "Accounts Office", code: "ACC", kind: "administrative", head: "Mr. Imran Qureshi", status: "active" },
  ],
  "/api/hr/staff": [
    { name: "Sana Tariq", designation: "Lecturer", email: "sana.tariq@example.com", phone: "0300-1234567", department: "CS", category: "teaching", employmentType: "permanent", joinDate: "2024-08-01", qualification: "MS Computer Science", basicSalary: 85000, status: "active", bankName: "HBL", bankAccount: "1234-5678-9012", allowances: "House Rent=15000; Medical=5000", deductions: "Provident Fund=4250" },
    { name: "Muhammad Aslam", designation: "Accountant", phone: "0321-7654321", department: "ACC", category: "administrative", employmentType: "contract", joinDate: "2025-01-15", basicSalary: 60000, status: "active", allowances: "Conveyance=3000" },
  ],
  "/api/hr/leaves": [
    { staff: "EMP-0001", type: "sick", from: "2026-11-03", to: "2026-11-04", reason: "Flu — medical certificate attached" },
    { staff: "Muhammad Aslam", type: "casual", from: "2026-11-10", to: "2026-11-10", reason: "Family function" },
  ],
  "/api/finance/scholarships": [
    { student: "C1-001", title: "Merit Scholarship", kind: "merit", type: "percent", value: 25, validUntil: "2027-03-31", status: "active", notes: "Topped the annual exam" },
    { student: "KG-005", title: "Sibling Discount", kind: "sibling", type: "fixed", value: 1000, status: "active" },
  ],
  "/api/finance/expenses": [
    { title: "Electricity bill — October", amount: 48500, category: "utilities", date: "2026-11-05", paidTo: "LESCO", method: "bank", reference: "VCH-1021" },
    { title: "Whiteboard markers", amount: 3200, category: "supplies", date: "2026-11-06", paidTo: "Al-Fatah Stationers", method: "cash", reference: "VCH-1022" },
  ],
  "/api/finance/structures": [
    { name: "Class 1 Monthly Fee", program: "Class 1", frequency: "monthly", status: "active", items: "Tuition=4500; Computer Lab=500" },
    { name: "Annual Charges", program: "", frequency: "annual", status: "active", items: "Annual Fund=3000; Exam=1500" },
  ],
  "/api/campus/assets": [
    { name: "Dell OptiPlex Desktop", tag: "IT-0001", category: "it_equipment", location: "Computer Lab 1", quantity: 20, unitCost: 95000, purchaseDate: "2025-07-15", condition: "good", assignedTo: "Lab In-charge" },
    { name: "Student Chair", tag: "FUR-0101", category: "furniture", location: "Room 12", quantity: 40, unitCost: 4500, condition: "new" },
  ],
  "/api/campus/visitors": [
    { name: "Kashif Mehmood", phone: "0333-1112223", nationalId: "35202-1234567-1", toMeet: "Principal", badgeNo: "V-12", purpose: "Admission inquiry" },
  ],
  "/api/campus/transport/routes": [
    { name: "Route 1 — Model Town", vehicleNo: "LEA-1234", driverName: "Ghulam Rasool", driverPhone: "0300-5556667", capacity: 30, monthlyFare: 3500, status: "active", stops: "Model Town Link Rd, Kalma Chowk, Campus" },
    { name: "Route 2 — Johar Town", vehicleNo: "LEB-5678", driverName: "Riaz Ahmed", driverPhone: "0301-2223334", capacity: 40, monthlyFare: 4000, status: "active", stops: "Emporium, Expo Centre, Campus" },
  ],
  "/api/campus/transport/assignments": [
    { student: "C1-001", route: "Route 1 — Model Town", stop: "Kalma Chowk" },
    { student: "C2-003", route: "Route 2 — Johar Town", stop: "Expo Centre" },
  ],
  "/api/campus/hostel/hostels": [
    { name: "Iqbal Hall", type: "boys", warden: "Mr. Shahid Nawaz", wardenPhone: "0300-9998887", status: "active", address: "Block B, Main Campus" },
    { name: "Fatima Hall", type: "girls", warden: "Mrs. Rubina Akhtar", wardenPhone: "0321-4445556", status: "active" },
  ],
  "/api/campus/hostel/rooms": [
    { hostel: "Iqbal Hall", number: "101", floor: "Ground", capacity: 2, monthlyRent: 8000, status: "available" },
    { hostel: "Fatima Hall", number: "204", floor: "2nd", capacity: 3, monthlyRent: 7000, status: "available" },
  ],
  "/api/library/books": [
    { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", isbn: "9780262046305", category: "Computer Science", publisher: "MIT Press", year: 2022, shelf: "CS-A3", copies: 4, status: "active" },
    { title: "Peer-e-Kamil", author: "Umera Ahmed", isbn: "9789695730079", category: "Urdu Literature", publisher: "Ferozsons", year: 2004, shelf: "UR-B1", copies: 2, status: "active" },
  ],
  "/api/engage/records": [
    { student: "C3-004", kind: "achievement", title: "1st position — inter-school quiz", date: "2026-10-20", severity: "info", details: "Represented the school at the district quiz." },
    { student: "C5-010", kind: "discipline", title: "Late arrival (3rd time)", date: "2026-10-22", severity: "minor", actionTaken: "Parents informed" },
  ],
  "/api/engage/alumni": [
    { name: "Hamza Rauf", rollNo: "BSCS-2019-014", program: "BS Computer Science", graduationYear: 2023, email: "hamza.rauf@example.com", phone: "0300-7778889", currentOrganization: "Systems Ltd", currentPosition: "Software Engineer", city: "Lahore", cgpa: 3.42 },
  ],
  "/api/engage/certificates": [
    { student: "C5-001", type: "character", purpose: "admission to next school" },
    { student: "C4-003", type: "bonafide", purpose: "bank account" },
  ],
  "/api/admissions": [
    { name: "Areeba Khalid", email: "areeba.k@example.com", phone: "0300-1112233", dob: "2019-04-12", gender: "female", program: "Class 1", academicSession: "2026-27", source: "walk_in", guardianName: "Khalid Mehmood", guardianPhone: "0300-1112233", city: "Lahore", previousInstitute: "Little Stars Montessori", previousPercentage: 88, testScore: 75 },
    { name: "Usman Ali", phone: "0321-4455667", dob: "2018-09-01", gender: "male", program: "Class 2", academicSession: "2026-27", source: "referral", guardianName: "Ali Raza", guardianPhone: "0321-4455667", city: "Lahore" },
  ],
  "/api/examsuite/sessions": [
    { name: "Midterm — Fall 2026", academicSession: "2026-27", kind: "midterm", startDate: "2026-11-16", endDate: "2026-11-27", slots: "09:00=11:00; 12:00=14:00", requireAttendance: "yes", requireFeeClearance: "yes", instructions: "Bring your admit card and CNIC/B-Form." },
  ],
  "/api/smart/surveys": [
    { title: "Fall 2026 Teacher Evaluation", academicSession: "2026-27", closesOn: "2026-12-20" },
  ],
  "/api/parents": [
    { name: "Imran Khan", email: "imran.khan@example.com", phone: "0300-1234567", whatsappNumber: "0300-1234567" },
    { name: "Nasreen Akhtar", phone: "0321-7654321" },
  ],
};
