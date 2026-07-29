const internshipData = [
    {
        companyName: "Tata Motors Ltd",
        sector: "Automotive & Manufacturing",
        title: "Assembly & Quality Assurance Trainee",
        location: { district: "Pune", state: "Maharashtra" },
        minQualification: "ITI",
        requiredSkills: ["Quality Control", "Equipment Maintenance", "Safety Compliance"],
        monthlyStipend: 5000
    },
    {
        companyName: "Mahindra & Mahindra",
        sector: "Automotive & Manufacturing",
        title: "Production Line Assistant",
        location: { district: "Pune", state: "Maharashtra" },
        minQualification: "Diploma",
        requiredSkills: ["Machine Operations", "Assembly Line", "Tool Management"],
        monthlyStipend: 5000
    },
    {
        companyName: "Maruti Suzuki India",
        sector: "Automotive & Manufacturing",
        title: "Chassis Maintenance Intern",
        location: { district: "Gurugram", state: "Haryana" },
        minQualification: "ITI",
        requiredSkills: ["Auto Repair", "Fitting", "Basic Tool Handling"],
        monthlyStipend: 5000
    },
    {
        companyName: "Hero MotoCorp",
        sector: "Automotive & Manufacturing",
        title: "Shop Floor Operations Trainee",
        location: { district: "Haridwar", state: "Uttarakhand" },
        minQualification: "12th",
        requiredSkills: ["Inventory Audit", "Machine Safety", "Reporting"],
        monthlyStipend: 5000
    },
    {
        companyName: "Bajaj Auto",
        sector: "Automotive & Manufacturing",
        title: "Fabrication Assistant",
        location: { district: "Aurangabad", state: "Maharashtra" },
        minQualification: "ITI",
        requiredSkills: ["Welding", "Sheet Metal Operations", "Blueprint Reading"],
        monthlyStipend: 5000
    },

    {
        companyName: "Tech Mahindra",
        sector: "IT & Digital Services",
        title: "Junior Cloud Infrastructure Trainee",
        location: { district: "Pune", state: "Maharashtra" },
        minQualification: "B.Tech",
        requiredSkills: ["Linux Admin", "Python", "Basic Networking", "Troubleshooting"],
        monthlyStipend: 5000
    },
    {
        companyName: "L&T Heavy Engineering",
        sector: "Engineering & Infrastructure",
        title: "Site Operations & Mechanical Assistant",
        location: { district: "Surat", state: "Gujarat" },
        minQualification: "B.Tech",
        requiredSkills: ["CAD Design", "Site Safety", "Quality Inspection", "Material Testing"],
        monthlyStipend: 5000
    },
    {
        companyName: "TCS iON",
        sector: "IT & Services",
        title: "Digital Assessment Center Assistant",
        location: { district: "Varanasi", state: "Uttar Pradesh" },
        minQualification: "BCA",
        requiredSkills: ["Basic Networking", "System Troubleshooting", "Invigilations"],
        monthlyStipend: 5000
    },
    {
        companyName: "Dixon Technologies",
        sector: "Electronics Manufacturing",
        title: "Embedded Systems Testing Trainee",
        location: { district: "Noida", state: "Uttar Pradesh" },
        minQualification: "B.Tech",
        requiredSkills: ["Circuit Testing", "Microcontrollers", "Soldering", "Quality Assurance"],
        monthlyStipend: 5000
    },
    {
        companyName: "Airtel Digital",
        sector: "Telecom & Electronics",
        title: "Field Technical Assistant",
        location: { district: "Ghaziabad", state: "Uttar Pradesh" },
        minQualification: "Diploma",
        requiredSkills: ["Fiber Optics", "Network Testing", "Troubleshooting"],
        monthlyStipend: 5000
    },

    {
        companyName: "Cipla Pharmaceuticals",
        sector: "Pharmaceuticals & Healthcare",
        title: "Quality Control & Drug Testing Intern",
        location: { district: "Indore", state: "Madhya Pradesh" },
        minQualification: "B.Pharma",
        requiredSkills: ["Pharmacology", "Lab Analysis", "GMP Compliance", "Chemical Testing"],
        monthlyStipend: 5000
    },
    {
        companyName: "Mankind Pharma",
        sector: "Pharmaceuticals",
        title: "Formulation Support Trainee",
        location: { district: "Haridwar", state: "Uttarakhand" },
        minQualification: "B.Pharma",
        requiredSkills: ["Batch Processing", "Quality Assurance", "Drug Safety"],
        monthlyStipend: 5000
    },
    {
        companyName: "Sun Pharmaceutical",
        sector: "Pharmaceuticals",
        title: "Packaging Line Quality Assistant",
        location: { district: "Vadodara", state: "Gujarat" },
        minQualification: "BSc",
        requiredSkills: ["GMP Standards", "Label Verification", "Batch Record Keeping"],
        monthlyStipend: 5000
    },
    {
        companyName: "Apollo Pharmacy",
        sector: "Healthcare & Pharma",
        title: "Inventory Assistant",
        location: { district: "Indore", state: "Madhya Pradesh" },
        minQualification: "12th",
        requiredSkills: ["Medicine Auditing", "Stock Sorting", "Billing"],
        monthlyStipend: 5000
    },

    {
        companyName: "HDFC Bank",
        sector: "BFSI (Banking & Finance)",
        title: "Branch Helpdesk Coordinator",
        location: { district: "Ghaziabad", state: "Uttar Pradesh" },
        minQualification: "BCom",
        requiredSkills: ["Basic Accounting", "Data Entry", "Client Operations"],
        monthlyStipend: 5000
    },
    {
        companyName: "ICICI Bank",
        sector: "BFSI (Banking & Finance)",
        title: "Documentation & Service Assistant",
        location: { district: "Ahmedabad", state: "Gujarat" },
        minQualification: "BA",
        requiredSkills: ["Document Verification", "Customer Assistance", "MS Office"],
        monthlyStipend: 5000
    },
    {
        companyName: "Axis Bank",
        sector: "BFSI (Banking & Finance)",
        title: "Front-Office Operations Support",
        location: { district: "Jaipur", state: "Rajasthan" },
        minQualification: "BBA",
        requiredSkills: ["Communication", "KYC Compliance", "Record Keeping"],
        monthlyStipend: 5000
    },
    {
        companyName: "State Bank of India (Vendor)",
        sector: "BFSI (Banking & Finance)",
        title: "Financial Inclusion Data Associate",
        location: { district: "Patna", state: "Bihar" },
        minQualification: "12th",
        requiredSkills: ["Field Surveys", "Data Collection", "Regional Language"],
        monthlyStipend: 5000
    },

    {
        companyName: "Reliance Retail Enterprises",
        sector: "Retail & Logistics",
        title: "Warehouse Inventory Associate",
        location: { district: "Jaipur", state: "Rajasthan" },
        minQualification: "12th",
        requiredSkills: ["Stock Verification", "Barcode Operations", "Logistics"],
        monthlyStipend: 5000
    },
    {
        companyName: "Flipkart Logistics",
        sector: "Retail & Logistics",
        title: "Sorting Center Assistant",
        location: { district: "Bhiwandi", state: "Maharashtra" },
        minQualification: "10th",
        requiredSkills: ["Package Sorting", "Dispatch Handling", "Physical Auditing"],
        monthlyStipend: 5000
    },
    {
        companyName: "DMart (Avenue Supermarts)",
        sector: "Retail & Supply Chain",
        title: "Store Operations Trainee",
        location: { district: "Thane", state: "Maharashtra" },
        minQualification: "12th",
        requiredSkills: ["Stock Management", "Customer Service", "POS Systems"],
        monthlyStipend: 5000
    },
    {
        companyName: "Delhivery",
        sector: "Retail & Logistics",
        title: "Hub Operations Facilitator",
        location: { district: "Lucknow", state: "Uttar Pradesh" },
        minQualification: "Diploma",
        requiredSkills: ["Logistics Tracking", "Data Entry", "Route Planning"],
        monthlyStipend: 5000
    },

    {
        companyName: "Adani Solar",
        sector: "Renewable Energy",
        title: "Solar Field Maintenance Associate",
        location: { district: "Kutch", state: "Gujarat" },
        minQualification: "ITI",
        requiredSkills: ["Solar Panel Cleaning", "Wiring Inspections", "Field Auditing"],
        monthlyStipend: 5000
    },
    {
        companyName: "Amul (GCMMF)",
        sector: "FMCG & Food Processing",
        title: "Dairy Plant Helper Trainee",
        location: { district: "Anand", state: "Gujarat" },
        minQualification: "10th",
        requiredSkills: ["Hygiene Maintenance", "Package Sealing", "Cold Storage"],
        monthlyStipend: 5000
    },
    {
        companyName: "Nestlé India",
        sector: "FMCG & Food Processing",
        title: "Quality Audit Trainee",
        location: { district: "Moga", state: "Punjab" },
        minQualification: "BSc",
        requiredSkills: ["Quality Audits", "Lab Testing", "Record Keeping"],
        monthlyStipend: 5000
    },
    {
        companyName: "Jindal Steel & Power",
        sector: "Heavy Industries",
        title: "Safety Inspector Assistant",
        location: { district: "Angul", state: "Odisha" },
        minQualification: "Diploma",
        requiredSkills: ["Safety Audits", "Hazard Analysis", "Report Writing"],
        monthlyStipend: 5000
    },
    {
        companyName: "ITC Hotels",
        sector: "Hospitality & Services",
        title: "Front Desk & Guest Operations Intern",
        location: { district: "Agra", state: "Uttar Pradesh" },
        minQualification: "BA",
        requiredSkills: ["Customer Communication", "Booking Systems", "Language Support"],
        monthlyStipend: 5000
    },
    {
        companyName: "Vardhman Textiles",
        sector: "Textiles & Garments",
        title: "Loom Quality Helper",
        location: { district: "Ludhiana", state: "Punjab" },
        minQualification: "10th",
        requiredSkills: ["Fabric Inspection", "Yarn Quality", "Sorting"],
        monthlyStipend: 5000
    },
    {
        companyName: "IFFCO",
        sector: "Agriculture & Chemicals",
        title: "Distribution Center Assistant",
        location: { district: "Bareilly", state: "Uttar Pradesh" },
        minQualification: "BSc",
        requiredSkills: ["Fertilizer Stocking", "Farmer Interaction", "Register Entry"],
        monthlyStipend: 5000
    },
    {
        companyName: "UltraTech Cement",
        sector: "Manufacturing & Mining",
        title: "Kiln Operations Helper",
        location: { district: "Satna", state: "Madhya Pradesh" },
        minQualification: "ITI",
        requiredSkills: ["Machine Operation", "Thermal Safety", "Maintenance"],
        monthlyStipend: 5000
    }
];

module.exports = internshipData;