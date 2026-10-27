/**
 * Small hardcoded option lists for the profile module's `<select>` fields
 * (Age Range, Device Type, District, …). None of these map to a Prisma enum
 * — the schema stores plain strings — so wording can change here without a
 * migration. See the profile-module plan for why.
 */

export const AGE_RANGE_OPTIONS = ["Under 15", "15-20", "20-25", "25-30", "30-35", "35+"];

export const DEVICE_TYPE_OPTIONS = ["Mobile", "Laptop", "Desktop", "Tablet"];

export const INTERNET_TYPE_OPTIONS = ["Broadband", "Mobile Data", "WiFi", "Other"];

export const YEARS_OF_EXPERIENCE_OPTIONS = ["0", "1", "2", "3", "4", "5+"];

export const AREA_TYPE_OPTIONS = ["Village", "Town", "City"];

export const EDUCATION_LEVEL_OPTIONS = [
    "SSC",
    "HSC",
    "Diploma",
    "Bachelor/Honors",
    "Masters",
    "Other",
];

export const CURRENT_YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Final Year"];

export const BD_DISTRICTS = [
    "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria",
    "Chandpur", "Chattogram", "Chuadanga", "Cox's Bazar", "Cumilla", "Dhaka", "Dinajpur",
    "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur",
    "Jashore", "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachari", "Khulna", "Kishoreganj",
    "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj",
    "Meherpur", "Moulvibazar", "Munshiganj", "Mymensingh", "Naogaon", "Narail", "Narayanganj",
    "Narsingdi", "Natore", "Netrokona", "Nilphamari", "Noakhali", "Pabna", "Panchagarh",
    "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi", "Rangamati", "Rangpur", "Satkhira",
    "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon",
];

export const COUNTRY_OPTIONS = ["Bangladesh", "Other"];

export const JOB_TYPE_OPTIONS = ["Full-time", "Part-time", "Intern", "Contractual"];

export const JOB_PREFERENCE_OPTIONS = ["Onsite", "Remote", "Both"];

export const HIRED_JOB_TYPE_OPTIONS = ["Intern", "Full-time", "Contractual"];
